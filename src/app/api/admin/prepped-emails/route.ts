import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { sendOrderStatusUpdate } from "@/lib/email";
import { updateOrderStatus } from "@/lib/data";

/**
 * POST /api/admin/prepped-emails
 * Body: { delivery_day: "YYYY-MM-DD" }
 *
 * Powers the "Mark All Prepped" button. For one delivery day, marks every
 * eligible order prepped and sends each customer the single "coming tomorrow"
 * email with their resolved slot + rough position (from delivery_routes).
 * Eligible = not cancelled, not delivered, not fully refunded ("not coming").
 *
 * Gated by requireAdmin() (Clerk) - Josie triggers it logged in, no secret.
 */
export async function POST(request: NextRequest) {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  try {
    const body = await request.json();
    const { delivery_day } = body;

    if (!delivery_day) {
      return NextResponse.json({ error: "delivery_day is required" }, { status: 400 });
    }

    // Eligible orders for this delivery day
    const { data: orders, error: ordersError } = await supabaseAdmin
      .from("orders")
      .select("*")
      .eq("delivery_day", delivery_day)
      .neq("status", "cancelled")
      .neq("status", "delivered");

    if (ordersError) {
      console.error("Error fetching orders:", ordersError);
      return NextResponse.json({ error: ordersError.message }, { status: 500 });
    }

    if (!orders || orders.length === 0) {
      return NextResponse.json({ success: true, message: "No eligible orders", sent: 0, skipped: 0 });
    }

    // Refund totals per order, to skip fully-refunded ("not coming") orders
    const orderIds = orders.map((o) => o.id);
    const { data: refunds } = await supabaseAdmin
      .from("order_item_refunds")
      .select("order_id, refund_amount")
      .in("order_id", orderIds);

    const refundTotals = new Map<string, number>();
    for (const r of refunds ?? []) {
      refundTotals.set(r.order_id, (refundTotals.get(r.order_id) ?? 0) + Number(r.refund_amount));
    }

    // Route info (leg + position + arrival band) for the day, plus leg sizes
    // for the position-phrase fallback when a stop has no band
    const { data: routeData } = await supabaseAdmin
      .from("delivery_routes")
      .select("order_id, leg, route_position, eta_band")
      .eq("delivery_day", delivery_day);

    const routeMap = new Map<string, { leg: "morning" | "afternoon"; position: number; etaBand: string | null }>();
    let morningCount = 0;
    let afternoonCount = 0;
    for (const r of routeData ?? []) {
      routeMap.set(r.order_id, {
        leg: r.leg as "morning" | "afternoon",
        position: r.route_position,
        etaBand: r.eta_band ?? null,
      });
      if (r.leg === "morning") morningCount++;
      else afternoonCount++;
    }

    const deliveryDayFormatted = new Date(delivery_day + "T00:00:00").toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });

    let sent = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const order of orders) {
      // Skip fully refunded
      const totalRefunded = refundTotals.get(order.id) ?? 0;
      if (totalRefunded >= Number(order.total)) {
        skipped++;
        continue;
      }

      if (!order.customer_email) {
        skipped++;
        continue;
      }

      const routeInfo = routeMap.get(order.id);
      const legSize = routeInfo?.leg === "morning" ? morningCount : afternoonCount;

      try {
        await updateOrderStatus(order.id, "prepped", supabaseAdmin);

        await sendOrderStatusUpdate({
          customerEmail: order.customer_email,
          customerName: order.customer_name || order.customer_email.split("@")[0],
          orderNumber: order.order_number,
          status: "prepped",
          deliveryDay: deliveryDayFormatted,
          deliveryWindow: order.delivery_window ?? undefined,
          deliveryOption: order.delivery_option ?? undefined,
          safePlace: order.safe_place ?? undefined,
          routeLeg: routeInfo?.leg,
          routePosition: routeInfo?.position,
          legSize: legSize || undefined,
          etaBand: routeInfo?.etaBand ?? undefined,
        });

        sent++;
      } catch (err) {
        console.error(`Error processing order ${order.order_number}:`, err);
        errors.push(`Order #${order.order_number}: ${(err as Error).message}`);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Sent ${sent} prepped email${sent === 1 ? "" : "s"} for ${delivery_day}`,
      sent,
      skipped,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("Error in prepped-emails:", error);
    return NextResponse.json({ error: "Failed to process prepped emails" }, { status: 500 });
  }
}
