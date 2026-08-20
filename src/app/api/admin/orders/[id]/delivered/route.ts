import { NextRequest, NextResponse } from "next/server";
import { requireAdminOrDriver } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getOrder, markOrderDelivered, setCustomerOutstandingBox } from "@/lib/data";
import { sendOrderStatusUpdate } from "@/lib/email";
import { recordBottleDeposit } from "@/lib/bottle-deposits";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/admin/orders/[id]/delivered
 * Body: { boxLeft?: boolean, boxCollected?: boolean }
 *
 * Marks an order delivered and records what happened with Local cool boxes at
 * the door, in one place for both the Driver Run and admin Deliveries pages:
 *   - box_left / box_collected are stored on the order (the per-delivery record)
 *   - customer_profiles.has_outstanding_box is kept in step: leaving a box means
 *     the customer now holds one (a swap - left one, took the empty - still
 *     leaves them holding one); collecting without leaving means they don't
 *   - the "delivered" email is sent server-side
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const gate = await requireAdminOrDriver();
  if (gate instanceof NextResponse) return gate;

  try {
    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as {
      boxLeft?: boolean;
      boxCollected?: boolean;
    };
    const boxLeft = body.boxLeft === true;
    const boxCollected = body.boxCollected === true;

    const order = await getOrder(id, supabaseAdmin);
    if (!order) {
      return NextResponse.json(
        { error: { code: "not_found", message: "Order not found" } },
        { status: 404 },
      );
    }

    // Atomic transition; false means it was already delivered (double tap),
    // in which case nothing is re-applied and no second email goes out.
    const justDelivered = await markOrderDelivered(id, supabaseAdmin);
    if (!justDelivered) {
      return NextResponse.json({ delivered: false, alreadyDelivered: true });
    }

    const { error: boxError } = await supabaseAdmin
      .from("orders")
      .update({ box_left: boxLeft, box_collected: boxCollected })
      .eq("id", id);
    if (boxError) {
      console.error("[admin/orders/[id]/delivered] box outcome update failed:", boxError);
    }

    if (boxLeft) {
      await setCustomerOutstandingBox(order.userId, true, supabaseAdmin);
    } else if (boxCollected) {
      await setCustomerOutstandingBox(order.userId, false, supabaseAdmin);
    }

    // Milk bottles follow the same rule as the box: the deposit only counts as
    // outstanding once the bottles are actually at their door. From here the
    // customer can claim them back from their account page. Best-effort - a
    // failure must not undo a delivery that's already been marked.
    if (order.bottleDepositQty > 0) {
      try {
        await recordBottleDeposit(order.userId, id, order.bottleDepositQty);
      } catch (e) {
        console.error("[admin/orders/[id]/delivered] bottle deposit record failed:", e);
      }
    }

    let emailSent = false;
    if (order.customerEmail) {
      try {
        await sendOrderStatusUpdate({
          customerEmail: order.customerEmail,
          customerName: order.customerName || order.customerEmail.split("@")[0],
          orderNumber: order.orderNumber,
          status: "delivered",
          deliveryDay: order.deliveryDay
            ? new Date(order.deliveryDay + "T00:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })
            : "Not set",
          deliveryWindow: order.deliveryWindow ?? undefined,
        });
        emailSent = true;
      } catch (emailErr) {
        console.error("[admin/orders/[id]/delivered] Failed to send delivered email:", emailErr);
      }
    }

    console.log("[admin/orders/[id]/delivered POST]", {
      userId: gate.userId,
      orderId: id,
      boxLeft,
      boxCollected,
      emailSent,
    });

    return NextResponse.json({ delivered: true, boxLeft, boxCollected, emailSent });
  } catch (err) {
    console.error("[admin/orders/[id]/delivered POST]", err);
    return NextResponse.json(
      { error: { code: "server_error", message: (err as Error).message } },
      { status: 500 },
    );
  }
}
