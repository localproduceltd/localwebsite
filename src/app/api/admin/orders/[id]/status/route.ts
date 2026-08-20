import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getOrder, updateOrderStatus, setCustomerOutstandingBox, type Order } from "@/lib/data";
import { recordBottleDeposit } from "@/lib/bottle-deposits";
import { sendOrderStatusUpdate } from "@/lib/email";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * PATCH /api/admin/orders/[id]/status
 * Body: { status: Order["status"] }
 * Updates the order status.
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  try {
    const { id } = await context.params;
    const existing = await getOrder(id, supabaseAdmin);
    if (!existing) {
      return NextResponse.json(
        { error: { code: "not_found", message: "Order not found" } },
        { status: 404 },
      );
    }

    const body = (await request.json()) as { status?: Order["status"] };

    if (!body.status) {
      return NextResponse.json(
        {
          error: {
            code: "validation_error",
            message: "Missing required field: status",
          },
        },
        { status: 400 },
      );
    }

    const validStatuses: Order["status"][] = ["ordered", "prepped", "next_hour", "delivered", "cancelled"];
    if (!validStatuses.includes(body.status)) {
      return NextResponse.json(
        {
          error: {
            code: "validation_error",
            message: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
          },
        },
        { status: 400 },
      );
    }

    await updateOrderStatus(id, body.status, supabaseAdmin);
    console.log("[admin/orders/[id]/status PATCH]", { 
      userId: gate.userId, 
      orderId: id, 
      status: body.status,
    });

    // Side effect: Set has_outstanding_box when order with box deposit is marked delivered
    if (body.status === "delivered" && existing.boxDepositPaid) {
      await setCustomerOutstandingBox(existing.userId, true, supabaseAdmin);
    }

    // Side effect: same rule for milk bottles - the deposit only counts as
    // outstanding once the bottles are physically with them. Best-effort: a
    // failure here must not stop the order being marked delivered.
    if (body.status === "delivered" && existing.bottleDepositQty > 0) {
      try {
        await recordBottleDeposit(existing.userId, id, existing.bottleDepositQty);
      } catch (e) {
        console.error("Failed to record bottle deposit on delivery:", e);
      }
    }

    // Side effect: Send status update email for prepped, next_hour, delivered, cancelled
    const emailStatuses = ["prepped", "next_hour", "delivered", "cancelled"] as const;
    if (existing.customerEmail && emailStatuses.includes(body.status as typeof emailStatuses[number])) {
      try {
        const deliveryDay = existing.deliveryDay
          ? new Date(existing.deliveryDay + "T00:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })
          : "Not set";
        await sendOrderStatusUpdate({
          customerEmail: existing.customerEmail,
          customerName: existing.customerName || existing.customerEmail.split("@")[0],
          orderNumber: existing.orderNumber,
          status: body.status as "prepped" | "next_hour" | "delivered" | "cancelled",
          deliveryDay,
          deliveryWindow: existing.deliveryWindow ?? undefined,
          deliveryOption: existing.deliveryOption ?? undefined,
          safePlace: existing.safePlace ?? undefined,
        });
      } catch (emailErr) {
        console.error("[admin/orders/[id]/status PATCH] Failed to send status email:", emailErr);
      }
    }

    const updated = await getOrder(id, supabaseAdmin);
    return NextResponse.json({ order: updated });
  } catch (err) {
    console.error("[admin/orders/[id]/status PATCH]", err);
    return NextResponse.json(
      { error: { code: "server_error", message: (err as Error).message } },
      { status: 500 },
    );
  }
}
