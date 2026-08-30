import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { settleOrderItemRefund, refundReasonConfig, type RefundPaidBy } from "@/lib/data";
import { sendSupplierRefundNotice } from "@/lib/email";

type RouteContext = { params: Promise<{ id: string }> };

const PAID_BY: RefundPaidBy[] = ["local", "supplier", "50-50"];

/**
 * POST /api/admin/refunds/[id]/settle
 * Body: { paidBy, supplierDeduction, supplierNote?, notifySupplier? }
 *
 * The supplier half of a two-stage refund. The customer was refunded and
 * emailed at the packing bench; this is Josie's who-pays call, made later on
 * the Stock tab - which is where grace for a new supplier gets decided.
 *
 * Nothing reaches the producer until this runs.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  try {
    const { id } = await context.params;
    const body = (await request.json()) as {
      paidBy?: RefundPaidBy;
      supplierDeduction?: number;
      supplierNote?: string | null;
      notifySupplier?: boolean;
    };

    if (!body.paidBy || !PAID_BY.includes(body.paidBy)) {
      return NextResponse.json(
        { error: { code: "bad_request", message: "paidBy must be local, supplier or 50-50" } },
        { status: 400 },
      );
    }

    const { data: existing, error: readError } = await supabaseAdmin
      .from("order_item_refunds")
      .select("*, orders(order_number, delivery_day)")
      .eq("id", id)
      .single();
    if (readError || !existing) {
      return NextResponse.json(
        { error: { code: "not_found", message: "Refund not found" } },
        { status: 404 },
      );
    }
    if (existing.supplier_status === "settled") {
      return NextResponse.json(
        { error: { code: "conflict", message: "This refund has already been settled" } },
        { status: 409 },
      );
    }

    const deduction = Math.max(0, Number(body.supplierDeduction) || 0);
    const supplierNote = body.supplierNote?.trim() || null;
    const settled = await settleOrderItemRefund(id, body.paidBy, deduction, supplierNote, supabaseAdmin);

    // The line's unit price, so the notice can say "£2 of the full £4".
    const { data: lines } = await supabaseAdmin
      .from("order_items")
      .select("price, quantity")
      .eq("order_id", existing.order_id)
      .eq("product_name", existing.product_name);
    const unitPrice = lines?.length ? Number(lines[0].price) : 0;
    const fullLineValue = Math.round(unitPrice * settled.quantityRefunded * 100) / 100;

    // Supabase types the to-one join loosely - it can come back either way.
    const joined = existing.orders as { order_number?: number } | { order_number?: number }[] | null;
    const orderNumber = (Array.isArray(joined) ? joined[0]?.order_number : joined?.order_number) ?? 0;

    // Tell the producer when their payout moves: either they're docked, or
    // the units never arrived (where a zero deduction means we're covering it
    // and paying them anyway - worth saying out loud). Josie can override.
    const affectsSupplier = deduction > 0 || !settled.itemArrived;
    const shouldNotify = (body.notifySupplier ?? affectsSupplier) && !!settled.supplierId;

    let notified = false;
    if (shouldNotify) {
      const { data: supplier } = await supabaseAdmin
        .from("suppliers")
        .select("name, email")
        .eq("id", settled.supplierId)
        .single();

      if (supplier?.email) {
        try {
          await sendSupplierRefundNotice({
            supplierEmail: supplier.email,
            supplierName: supplier.name || "",
            orderNumber: orderNumber,
            productName: settled.productName,
            quantity: settled.quantityRefunded,
            refundAmount: settled.refundAmount,
            reasonLabel: refundReasonConfig[settled.reasonType]?.label ?? "",
            reason: settled.customerNote,
            supplierNote,
            paidBy: settled.paidBy,
            itemArrived: settled.itemArrived,
            supplierDeduction: deduction,
            fullLineValue,
          });
          notified = true;
        } catch (emailError) {
          // The decision is recorded either way - a bounced notice must not
          // send Josie round the loop a second time and double-settle it.
          console.error("Failed to send supplier refund notice:", emailError);
        }
      }
    }

    return NextResponse.json({ success: true, refund: settled, notified });
  } catch (error) {
    console.error("Settle refund error:", error);
    return NextResponse.json(
      {
        error: {
          code: "server_error",
          message: error instanceof Error ? error.message : "Failed to settle refund",
        },
      },
      { status: 500 },
    );
  }
}
