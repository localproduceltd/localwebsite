import "server-only";
import { supabaseAdmin } from "./supabase-admin";
import { sendOrderStatusUpdate } from "./email";
import { updateOrderStatus } from "./data";

/**
 * Shared engine for the Thursday-evening "confirming your delivery tomorrow"
 * emails, used by both the automatic cron (/api/cron/prepped-emails, 6pm UK
 * Thursday) and the manual "Mark All Prepped" button on /admin/orders.
 *
 * For one delivery day: marks every eligible order prepped and sends each
 * customer the single "coming tomorrow" email with their resolved slot +
 * rough position (from delivery_routes). Eligible = not cancelled, not
 * delivered, not already prepped, not fully refunded ("not coming"), has an
 * email.
 *
 * Skipping already-prepped orders is the double-send guard: however many
 * times this runs (cron then button, button then cron, Vercel double-firing
 * the cron), each customer is only ever emailed once. A deliberate re-send
 * for one order is still possible via the single-order status control on
 * /admin/orders.
 */
export interface PreppedEmailsSummary {
  success: boolean;
  message: string;
  sent: number;
  skipped: number;
  errors?: string[];
}

export async function sendPreppedEmails(options: {
  deliveryDay: string; // "YYYY-MM-DD"
  /**
   * When true (the cron), do nothing unless the day's route has been
   * uploaded - without delivery_routes rows the emails would go out with no
   * slot or position. The manual button passes false: a deliberate click
   * sends regardless, falling back to window-only wording.
   */
  requireRoute: boolean;
}): Promise<PreppedEmailsSummary> {
  const { deliveryDay, requireRoute } = options;

  // Route info (leg + position + arrival band) for the day, plus leg sizes
  // for the position-phrase fallback when a stop has no band
  const { data: routeData, error: routeError } = await supabaseAdmin
    .from("delivery_routes")
    .select("order_id, leg, route_position, eta_band")
    .eq("delivery_day", deliveryDay);

  if (routeError) {
    console.error("Error fetching delivery routes:", routeError);
    return { success: false, message: routeError.message, sent: 0, skipped: 0 };
  }

  if (requireRoute && (!routeData || routeData.length === 0)) {
    return {
      success: true,
      message: `No route uploaded for ${deliveryDay} - skipping so nobody gets a slotless email`,
      sent: 0,
      skipped: 0,
    };
  }

  // Eligible orders for this delivery day. Already-prepped orders have had
  // their email - see the double-send guard note above.
  const { data: orders, error: ordersError } = await supabaseAdmin
    .from("orders")
    .select("*")
    .eq("delivery_day", deliveryDay)
    .neq("status", "cancelled")
    .neq("status", "delivered")
    .neq("status", "prepped");

  if (ordersError) {
    console.error("Error fetching orders:", ordersError);
    return { success: false, message: ordersError.message, sent: 0, skipped: 0 };
  }

  if (!orders || orders.length === 0) {
    return { success: true, message: "No eligible orders", sent: 0, skipped: 0 };
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

  const deliveryDayFormatted = new Date(deliveryDay + "T00:00:00").toLocaleDateString("en-GB", {
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
      // Mark prepped before sending: if the send then fails, the order shows
      // prepped without an email (visible in the summary errors), rather than
      // ever risking a customer being emailed twice.
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

  return {
    success: true,
    message: `Sent ${sent} prepped email${sent === 1 ? "" : "s"} for ${deliveryDay}`,
    sent,
    skipped,
    errors: errors.length > 0 ? errors : undefined,
  };
}
