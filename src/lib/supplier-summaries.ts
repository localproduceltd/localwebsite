import { getOrdersByDeliveryDay, getSuppliers, getOrdersWithTopUps } from "@/lib/data";
import { sendSupplierOrderSummary } from "@/lib/email";
import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * The Wednesday 7pm supplier order summaries: what each producer needs to drop
 * at the warehouse on Thursday.
 *
 * One engine, two callers - the Wednesday cron and the manual backup button on
 * /admin/stock - so they can't drift apart. Every send is recorded in
 * supplier_summary_sends, and already-sent suppliers are skipped, which makes
 * running it twice harmless: the double-fired cron, the button pressed after
 * the cron, and a retry after a partial failure all do the right thing.
 */

export interface SupplierSummaryResult {
  supplier: string;
  supplierId: string;
  success: boolean;
  skipped?: boolean;
  error?: string;
}

export interface SupplierSummaryRun {
  deliveryDay: string;
  sent: number;
  skipped: number;
  failed: number;
  message: string;
  results: SupplierSummaryResult[];
}

/** Suppliers already told about this delivery day. */
export async function getSummariesSent(deliveryDay: string): Promise<Set<string>> {
  const { data, error } = await supabaseAdmin
    .from("supplier_summary_sends")
    .select("supplier_id")
    .eq("delivery_day", deliveryDay);
  if (error) throw error;
  return new Set((data ?? []).map(r => r.supplier_id as string));
}

/**
 * The next delivery day worth sending summaries for: the earliest one with
 * orders on it that is still ahead of us, within the next week.
 *
 * Derived rather than assumed to be "Wednesday + 2" so that a moved delivery
 * day (bank holiday, a one-off shift) still gets its summaries.
 */
export async function nextDeliveryDayWithOrders(today: string): Promise<string | null> {
  const horizon = new Date(today + "T00:00:00");
  horizon.setDate(horizon.getDate() + 7);
  const horizonDay = horizon.toISOString().slice(0, 10);

  const { data, error } = await supabaseAdmin
    .from("orders")
    .select("delivery_day")
    .gt("delivery_day", today)
    .lte("delivery_day", horizonDay)
    .neq("status", "cancelled")
    .order("delivery_day", { ascending: true })
    .limit(1);
  if (error) throw error;
  return data?.[0]?.delivery_day ?? null;
}

export async function sendSupplierSummaries(options: {
  deliveryDay: string;
  sentBy: "cron" | "manual";
  /** Send again to suppliers already told. Only the button offers this. */
  resend?: boolean;
}): Promise<SupplierSummaryRun> {
  const { deliveryDay, sentBy, resend = false } = options;

  const orders = await getOrdersByDeliveryDay(deliveryDay);
  if (orders.length === 0) {
    return {
      deliveryDay,
      sent: 0,
      skipped: 0,
      failed: 0,
      message: `No orders for ${deliveryDay}`,
      results: [],
    };
  }

  const suppliers = await getSuppliers();
  const supplierMap = new Map(suppliers.map(s => [s.id, s]));
  const toppedUpOrderIds = await getOrdersWithTopUps();
  const alreadySent = resend ? new Set<string>() : await getSummariesSent(deliveryDay);

  // Group this day's order lines by supplier: the totals they need to drop,
  // plus the per-box breakdown.
  const supplierOrders = new Map<string, {
    supplier: { id: string; name: string; email: string | null };
    orders: Map<number, { orderNumber: number; boxNumber: number | null; orderId: string; items: Array<{ productName: string; unit: string; quantity: number; price: number }> }>;
    stockTotals: Map<string, { productName: string; unit: string; totalQuantity: number }>;
  }>();

  for (const order of orders) {
    for (const item of order.items) {
      if (!item.supplierId) continue;
      const supplier = supplierMap.get(item.supplierId);
      if (!supplier) continue;

      if (!supplierOrders.has(item.supplierId)) {
        supplierOrders.set(item.supplierId, {
          supplier: { id: supplier.id, name: supplier.name, email: supplier.email },
          orders: new Map(),
          stockTotals: new Map(),
        });
      }
      const data = supplierOrders.get(item.supplierId)!;

      if (!data.orders.has(order.orderNumber)) {
        data.orders.set(order.orderNumber, {
          orderNumber: order.orderNumber,
          boxNumber: order.boxNumber,
          orderId: order.id,
          items: [],
        });
      }
      data.orders.get(order.orderNumber)!.items.push({
        productName: item.productName,
        unit: item.unit,
        quantity: item.quantity,
        price: item.price,
      });

      // Keyed by name + unit so different pack sizes don't merge.
      const stockKey = `${item.productName}|${item.unit || ""}`;
      if (!data.stockTotals.has(stockKey)) {
        data.stockTotals.set(stockKey, { productName: item.productName, unit: item.unit, totalQuantity: 0 });
      }
      data.stockTotals.get(stockKey)!.totalQuantity += item.quantity;
    }
  }

  const results: SupplierSummaryResult[] = [];
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  for (const [supplierId, data] of supplierOrders) {
    if (alreadySent.has(supplierId)) {
      results.push({ supplier: data.supplier.name, supplierId, success: false, skipped: true });
      continue;
    }
    if (!data.supplier.email) {
      results.push({ supplier: data.supplier.name, supplierId, success: false, error: "No email address" });
      continue;
    }

    const ordersArray = Array.from(data.orders.values()).map(order => ({
      orderNumber: order.orderNumber,
      boxNumber: order.boxNumber,
      items: order.items,
      subtotal: order.items.reduce((sum, item) => sum + item.price * item.quantity, 0),
      hasTopUp: toppedUpOrderIds.has(order.orderId),
    }));
    const grandTotal = ordersArray.reduce((sum, order) => sum + order.subtotal, 0);

    try {
      await sendSupplierOrderSummary({
        supplierEmail: data.supplier.email,
        supplierName: data.supplier.name,
        deliveryDate: deliveryDay,
        stockTotals: Array.from(data.stockTotals.values()).sort((a, b) => a.productName.localeCompare(b.productName)),
        orders: ordersArray,
        grandTotal,
      });

      // Recorded straight after the send, so a crash mid-run can never cause a
      // second email to the suppliers already reached.
      const { error: markError } = await supabaseAdmin
        .from("supplier_summary_sends")
        .upsert(
          { delivery_day: deliveryDay, supplier_id: supplierId, sent_by: sentBy, sent_at: new Date().toISOString() },
          { onConflict: "delivery_day,supplier_id" }
        );
      if (markError) console.error(`Sent summary to ${data.supplier.name} but failed to record it:`, markError);

      results.push({ supplier: data.supplier.name, supplierId, success: true });
      await delay(250); // Resend rate limit
    } catch (error) {
      results.push({
        supplier: data.supplier.name,
        supplierId,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  const sent = results.filter(r => r.success).length;
  const skipped = results.filter(r => r.skipped).length;
  const failed = results.filter(r => !r.success && !r.skipped).length;

  return {
    deliveryDay,
    sent,
    skipped,
    failed,
    message: `Sent ${sent}${skipped > 0 ? `, ${skipped} already had theirs` : ""}${failed > 0 ? `, ${failed} failed` : ""}`,
    results,
  };
}
