import { NextRequest, NextResponse } from "next/server";
import { sendBasketReminders } from "@/lib/basket-reminders";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/cron/basket-reminder
 *
 * Weekly abandoned-basket reminder, targeting 4pm UK on Wednesdays (order
 * cut-off day). Vercel cron only speaks UTC, so vercel.json fires this at
 * both 15:00 and 16:00 UTC every Wednesday; the Europe/London hour check
 * below lets exactly one of those through year-round (15:00 UTC = 4pm BST
 * in summer, 16:00 UTC = 4pm GMT in winter).
 *
 * Auth: Vercel sends `Authorization: Bearer ${CRON_SECRET}` automatically
 * once the CRON_SECRET env var is set in the project. Fails closed if the
 * env var is missing.
 *
 * Double-send guard: sendBasketReminders skips any basket reminded in the
 * last 6 days (reminder_sent_at, stamped per successful send).
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const londonHour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/London",
      hour: "2-digit",
      hour12: false,
    }).format(new Date())
  );
  if (londonHour !== 16) {
    return NextResponse.json({
      sent: 0,
      skipped: true,
      reason: `It's ${londonHour}:00 in London, not 16:00 - this is the off-season cron slot.`,
    });
  }

  try {
    const summary = await sendBasketReminders({ skipRemindedWithinDays: 6 });
    console.log(
      `Basket reminder cron: sent ${summary.sent}, failed ${summary.failed}, skipped ${summary.skipped}`
    );
    return NextResponse.json(summary);
  } catch (error) {
    console.error("Basket reminder cron failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to send reminders" },
      { status: 500 }
    );
  }
}
