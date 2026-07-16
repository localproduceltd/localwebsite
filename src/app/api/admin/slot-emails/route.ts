import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { sendSlotEmail } from "@/lib/email";

/**
 * POST /api/admin/slot-emails
 * Body: { delivery_day: "YYYY-MM-DD" }
 *
 * Sends the Thursday "your slot" email (via Resend) to every customer on the
 * day who picked "I don't mind" (delivery_window = 'any'), using the uploaded
 * route (delivery_routes: leg, position, eta_band). Called by the Thursday
 * route task AFTER Josie approves the route; can also be triggered by an admin.
 *
 * Idempotent: orders already stamped slot_email_sent_at are skipped, so a
 * second call can't double-email anyone.
 *
 * Auth: a signed-in admin, OR the x-route-upload-key secret header (same key
 * as the route upload) for the headless task.
 */
export async function POST(request: NextRequest) {
  const uploadKey = process.env.ROUTE_UPLOAD_KEY;
  const headerKey = request.headers.get("x-route-upload-key");
  if (!uploadKey || headerKey !== uploadKey) {
    const gate = await requireAdmin();
    if (gate instanceof NextResponse) return gate;
  }

  try {
    const body = await request.json();
    const { delivery_day } = body;

    if (!delivery_day) {
      return NextResponse.json({ error: "delivery_day is required" }, { status: 400 });
    }

    const { data: orders, error: ordersError } = await supabaseAdmin
      .from("orders")
      .select("id, order_number, customer_email, customer_name, delivery_option, safe_place, slot_email_sent_at")
      .eq("delivery_day", delivery_day)
      .eq("delivery_window", "any")
      .neq("status", "cancelled");

    if (ordersError) {
      console.error("Error fetching orders:", ordersError);
      return NextResponse.json({ error: ordersError.message }, { status: 500 });
    }

    const { data: routeData, error: routeError } = await supabaseAdmin
      .from("delivery_routes")
      .select("order_id, leg, route_position, eta_band")
      .eq("delivery_day", delivery_day);

    if (routeError) {
      console.error("Error fetching route:", routeError);
      return NextResponse.json({ error: routeError.message }, { status: 500 });
    }

    if (!routeData || routeData.length === 0) {
      return NextResponse.json(
        { error: "No route uploaded for this delivery day - upload the route first" },
        { status: 409 },
      );
    }

    const routeMap = new Map<string, { leg: "morning" | "afternoon"; position: number; etaBand: string | null }>();
    let morningCount = 0;
    let afternoonCount = 0;
    for (const r of routeData) {
      routeMap.set(r.order_id, {
        leg: r.leg as "morning" | "afternoon",
        position: r.route_position,
        etaBand: r.eta_band ?? null,
      });
      if (r.leg === "morning") morningCount++;
      else afternoonCount++;
    }

    // "17 July" for the subject + "this Friday (17 July)" line
    const dayShort = new Date(delivery_day + "T00:00:00").toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
    });

    let sent = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const order of orders ?? []) {
      const routeInfo = routeMap.get(order.id);
      if (!order.customer_email || !routeInfo || order.slot_email_sent_at) {
        skipped++;
        continue;
      }

      try {
        await sendSlotEmail({
          customerEmail: order.customer_email,
          customerName: order.customer_name || order.customer_email.split("@")[0],
          deliveryDay: dayShort,
          leg: routeInfo.leg,
          stopPosition: routeInfo.position,
          legSize: routeInfo.leg === "morning" ? morningCount : afternoonCount,
          etaBand: routeInfo.etaBand ?? undefined,
          deliveryOption: order.delivery_option ?? undefined,
          safePlace: order.safe_place ?? undefined,
        });

        await supabaseAdmin
          .from("orders")
          .update({ slot_email_sent_at: new Date().toISOString() })
          .eq("id", order.id);

        sent++;
      } catch (err) {
        console.error(`Error sending slot email for order ${order.order_number}:`, err);
        errors.push(`Order #${order.order_number}: ${(err as Error).message}`);
      }
    }

    console.log("[admin/slot-emails POST]", { delivery_day, sent, skipped, errors: errors.length });

    return NextResponse.json({
      success: true,
      message: `Sent ${sent} slot email${sent === 1 ? "" : "s"} for ${delivery_day}`,
      sent,
      skipped,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error("Error in slot-emails:", error);
    return NextResponse.json({ error: "Failed to process slot emails" }, { status: 500 });
  }
}
