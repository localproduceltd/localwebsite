import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { sendBasketReminders } from "@/lib/basket-reminders";

/**
 * POST /api/admin/saved-baskets/remind
 *
 * Emails every pending (not-yet-converted) saved basket that has an email
 * address a "your basket's waiting" checkout reminder - the same send the
 * Wednesday cron does (see /api/cron/basket-reminder), but triggered by hand
 * and without the reminded-this-week skip: a deliberate click always sends.
 * Each send stamps reminder_sent_at, so the cron won't email the same people
 * again this week. Admin only.
 */
export async function POST() {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  try {
    const { sent, failed, results } = await sendBasketReminders({ skipRemindedWithinDays: 0 });

    return NextResponse.json({
      message: `Sent ${sent} reminder${sent === 1 ? "" : "s"}${failed > 0 ? `, ${failed} failed` : ""}`,
      sent,
      failed,
      results,
    });
  } catch (error) {
    console.error("Error sending saved basket reminders:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to send reminders" },
      { status: 500 }
    );
  }
}
