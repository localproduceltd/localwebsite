import "server-only";
import { getSavedBaskets, SavedBasketWithProducts } from "./data";
import { supabaseAdmin } from "./supabase-admin";
import { sendSavedBasketReminder } from "./email";

/**
 * Shared engine for the "your basket's waiting" reminder, used by both the
 * Tuesday cron (/api/cron/basket-reminder) and the manual button on the
 * admin Saved Baskets page.
 *
 * Sends one email per customer: pending baskets (items, not converted, has an
 * email) are collapsed to the most recently updated basket per address. The
 * greeting name comes from the customer's most recent order, falling back to
 * "there". Each successful send stamps `reminder_sent_at` on the basket row
 * straight away, so a crashed or retried run never re-emails the people it
 * already reached.
 */
export interface BasketReminderSummary {
  sent: number;
  failed: number;
  skipped: number;
  results: Array<{ email: string; success: boolean; error?: string }>;
}

export async function sendBasketReminders(options: {
  /**
   * Skip baskets already reminded within this many days. The cron passes 6 so
   * the weekly run (and Vercel's occasional double-invocations) can never
   * double-send; the manual admin button passes 0 - a deliberate click always
   * sends.
   */
  skipRemindedWithinDays: number;
}): Promise<BasketReminderSummary> {
  const baskets = await getSavedBaskets();

  // One basket per customer - getSavedBaskets orders by updated_at descending,
  // so the first basket we see for an address is their most recent.
  const byEmail = new Map<string, SavedBasketWithProducts>();
  for (const basket of baskets) {
    if (basket.convertedAt || !basket.customerEmail || basket.products.length === 0) continue;
    const key = basket.customerEmail.trim().toLowerCase();
    if (!byEmail.has(key)) byEmail.set(key, basket);
  }

  const cutoff = Date.now() - options.skipRemindedWithinDays * 24 * 60 * 60 * 1000;
  let skipped = 0;
  const pending: SavedBasketWithProducts[] = [];
  for (const basket of byEmail.values()) {
    if (
      options.skipRemindedWithinDays > 0 &&
      basket.reminderSentAt &&
      new Date(basket.reminderSentAt).getTime() > cutoff
    ) {
      skipped++;
      continue;
    }
    pending.push(basket);
  }

  // Greeting names: most recent order's customer_name per email address.
  const nameByEmail = new Map<string, string>();
  if (pending.length > 0) {
    const { data: orders } = await supabaseAdmin
      .from("orders")
      .select("customer_email, customer_name, created_at")
      .in("customer_email", pending.map((b) => b.customerEmail!))
      .order("created_at", { ascending: false });
    for (const order of orders ?? []) {
      const key = (order.customer_email ?? "").trim().toLowerCase();
      if (key && order.customer_name && !nameByEmail.has(key)) {
        nameByEmail.set(key, order.customer_name);
      }
    }
  }

  const results: BasketReminderSummary["results"] = [];
  const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  for (const basket of pending) {
    const email = basket.customerEmail!;
    try {
      await sendSavedBasketReminder({
        customerEmail: email,
        customerName: nameByEmail.get(email.trim().toLowerCase()) ?? null,
        items: basket.products.map((p) => ({
          productName: p.productName,
          quantity: p.quantity,
          price: p.price,
          supplierName: p.supplierName,
        })),
        total: basket.total,
      });
      await supabaseAdmin
        .from("saved_baskets")
        .update({ reminder_sent_at: new Date().toISOString() })
        .eq("id", basket.id);
      results.push({ email, success: true });
      // Stay within Resend's rate limits, mirroring the supplier-summary send.
      await delay(250);
    } catch (error) {
      results.push({
        email,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return {
    sent: results.filter((r) => r.success).length,
    failed: results.filter((r) => !r.success).length,
    skipped,
    results,
  };
}
