import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { stripe } from "@/lib/stripe";
import {
  createOrderItemRefund,
  refundedQtyForLine,
  refundReasonConfig,
  orderIssueConfig,
  type OrderIssueType,
  type RefundPaidBy,
} from "@/lib/data";
import { sendOrderItemRefund, sendSupplierRefundNotice, sendOrderIssueReplied } from "@/lib/email";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/admin/order-issues/[id]/resolve
 * Body:
 *   { outcome: "refund", refundAmount, paidBy, supplierDeduction, customerNote, supplierNote? }
 *   { outcome: "decline" | "note", reply }
 *
 * Josie's decision on a customer-reported problem.
 *
 * Unlike a refund off the packing bench, this settles BOTH halves in one go -
 * she's making the "does this get refunded" and "who bears it" calls in the
 * same moment, so making her work a second queue afterwards would be silly.
 *
 * The customer hears once either way: the refund email if money went back, the
 * reply email if it didn't. Never both.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  try {
    const { id } = await context.params;
    const body = await request.json();
    const outcome = body.outcome as "refund" | "decline" | "note";

    const { data: issue, error: issueError } = await supabaseAdmin
      .from("order_issues")
      .select("*")
      .eq("id", id)
      .single();
    if (issueError || !issue) {
      return NextResponse.json({ error: { code: "not_found", message: "Report not found" } }, { status: 404 });
    }
    if (issue.status !== "open") {
      return NextResponse.json(
        { error: { code: "conflict", message: "That report has already been dealt with" } },
        { status: 409 }
      );
    }

    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("id, order_number, customer_name, customer_email, stripe_session_id")
      .eq("id", issue.order_id)
      .single();
    if (orderError || !order) {
      return NextResponse.json({ error: { code: "not_found", message: "Order not found" } }, { status: 404 });
    }

    // ── No money: declined, or nothing was owed ("I got too many") ───────────
    if (outcome === "decline" || outcome === "note") {
      const reply = (body.reply || "").trim();
      if (!reply) {
        return NextResponse.json(
          { error: { code: "bad_request", message: "Write the customer a line explaining why" } },
          { status: 400 }
        );
      }

      await supabaseAdmin
        .from("order_issues")
        .update({
          status: outcome === "note" ? "noted" : "declined",
          admin_reply: reply,
          resolved_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (order.customer_email) {
        try {
          await sendOrderIssueReplied({
            customerEmail: order.customer_email,
            customerName: order.customer_name || "",
            orderNumber: order.order_number,
            productName: issue.product_name,
            quantity: issue.quantity,
            reply,
          });
        } catch (emailError) {
          console.error("Failed to send order issue reply:", emailError);
        }
      }

      return NextResponse.json({ success: true, status: outcome === "note" ? "noted" : "declined" });
    }

    // ── Refund ───────────────────────────────────────────────────────────────
    if (outcome !== "refund") {
      return NextResponse.json(
        { error: { code: "bad_request", message: "outcome must be refund, decline or note" } },
        { status: 400 }
      );
    }

    const config = orderIssueConfig[issue.issue_type as OrderIssueType];
    if (!config.refundable) {
      return NextResponse.json(
        { error: { code: "bad_request", message: `"${config.label}" reports don't carry a refund` } },
        { status: 400 }
      );
    }

    const paidBy = (body.paidBy as RefundPaidBy) || config.defaultPaidBy;
    const units = issue.quantity;

    // Same guard as every other refund: never more units than were ordered.
    const { data: lines } = await supabaseAdmin
      .from("order_items")
      .select("quantity, price, supplier_id")
      .eq("order_id", issue.order_id)
      .eq("product_name", issue.product_name);
    if (!lines || lines.length === 0) {
      return NextResponse.json(
        { error: { code: "bad_request", message: "That line isn't on the order any more" } },
        { status: 400 }
      );
    }
    const orderedQty = lines.reduce((sum, l) => sum + (l.quantity ?? 0), 0);
    const unitPrice = Number(lines[0].price) || 0;
    const supplierId = lines[0].supplier_id as string | null;

    const alreadyRefunded = await refundedQtyForLine(issue.order_id, issue.product_name);
    if (alreadyRefunded + units > orderedQty) {
      return NextResponse.json(
        {
          error: {
            code: "conflict",
            message: `Only ${orderedQty - alreadyRefunded} of ${orderedQty} ${issue.product_name} left to refund on #${order.order_number}.`,
          },
        },
        { status: 409 }
      );
    }

    // Partial refunds are allowed - "squished but we ate it" isn't always worth
    // the full line back. Defaults to the full value of the units reported.
    const fullLineValue = Math.round(units * unitPrice * 100) / 100;
    const amount = typeof body.refundAmount === "number" ? body.refundAmount : fullLineValue;
    if (!(amount > 0) || amount > fullLineValue + 0.001) {
      return NextResponse.json(
        { error: { code: "bad_request", message: `Refund must be between £0.01 and £${fullLineValue.toFixed(2)}` } },
        { status: 400 }
      );
    }

    let stripeRefundId: string | null = null;
    let manualRefundRequired = false;
    if (!order.stripe_session_id) {
      manualRefundRequired = true;
    } else {
      const session = await stripe.checkout.sessions.retrieve(order.stripe_session_id);
      if (!session.payment_intent) {
        manualRefundRequired = true;
      } else {
        const refund = await stripe.refunds.create(
          {
            payment_intent: session.payment_intent as string,
            amount: Math.round(amount * 100),
            reason: "requested_by_customer",
            metadata: {
              order_id: issue.order_id,
              order_number: order.order_number.toString(),
              product_name: issue.product_name,
              issue_id: id,
            },
          },
          { idempotencyKey: `order-issue-${id}` }
        );
        stripeRefundId = refund.id;
      }
    }

    const deduction = typeof body.supplierDeduction === "number" ? Math.max(0, body.supplierDeduction) : 0;
    const customerNote = (body.customerNote || "").trim() || null;
    const supplierNote = (body.supplierNote || "").trim() || null;
    const reasonType = config.reasonType;

    // Settled on creation - the who-pays call has just been made above.
    const created = await createOrderItemRefund({
      orderId: issue.order_id,
      productName: issue.product_name,
      quantityRefunded: units,
      refundAmount: amount,
      reasonType,
      customerNote,
      itemArrived: refundReasonConfig[reasonType]?.itemArrived ?? true,
      supplierId,
      faultHint: null,
      supplierStatus: "settled",
      paidBy,
      supplierDeduction: deduction,
      supplierNote,
    });

    await supabaseAdmin
      .from("order_issues")
      .update({
        status: "refunded",
        refund_id: created.id,
        admin_reply: customerNote,
        resolved_at: new Date().toISOString(),
      })
      .eq("id", id);

    let supplier: { name: string | null; email: string | null } | null = null;
    if (supplierId) {
      const { data } = await supabaseAdmin.from("suppliers").select("name, email").eq("id", supplierId).single();
      supplier = data;
    }

    if (order.customer_email) {
      try {
        await sendOrderItemRefund({
          customerEmail: order.customer_email,
          customerName: order.customer_name || "",
          orderNumber: order.order_number,
          productName: issue.product_name,
          supplierName: supplier?.name || undefined,
          quantity: units,
          refundAmount: amount,
          reasonLabel: refundReasonConfig[reasonType]?.label ?? "",
          reason: customerNote,
        });
      } catch (emailError) {
        console.error("Failed to send refund email:", emailError);
      }
    }

    if (supplierId && deduction > 0 && supplier?.email) {
      try {
        await sendSupplierRefundNotice({
          supplierEmail: supplier.email,
          supplierName: supplier.name || "",
          orderNumber: order.order_number,
          productName: issue.product_name,
          quantity: units,
          refundAmount: amount,
          reasonLabel: refundReasonConfig[reasonType]?.label ?? "",
          reason: customerNote,
          supplierNote,
          paidBy,
          itemArrived: refundReasonConfig[reasonType]?.itemArrived ?? true,
          supplierDeduction: deduction,
          fullLineValue,
        });
      } catch (emailError) {
        console.error("Failed to send supplier refund notice:", emailError);
      }
    }

    return NextResponse.json({
      success: true,
      status: "refunded",
      amount,
      refundId: stripeRefundId,
      manualRefundRequired,
    });
  } catch (error) {
    console.error("Resolve order issue error:", error);
    return NextResponse.json(
      {
        error: {
          code: "server_error",
          message: error instanceof Error ? error.message : "Failed to resolve that report",
        },
      },
      { status: 500 }
    );
  }
}
