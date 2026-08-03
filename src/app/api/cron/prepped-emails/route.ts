import { NextRequest, NextResponse } from "next/server";
import { sendPreppedEmails } from "@/lib/prepped-emails";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/cron/prepped-emails
 *
 * Automatic "confirming your delivery tomorrow" emails, targeting 6pm UK on
 * Thursdays - after the 8am route build, Josie's route approval and any
 * refund decisions on flagged products. Vercel cron only speaks UTC, so
 * vercel.json fires this at both 17:00 and 18:00 UTC every Thursday; the
 * Europe/London hour check below lets exactly one of those through
 * year-round (17:00 UTC = 6pm BST in summer, 18:00 UTC = 6pm GMT in
 * winter).
 *
 * Auth: Vercel sends `Authorization: Bearer ${CRON_SECRET}` automatically
 * once the CRON_SECRET env var is set in the project. Fails closed if the
 * env var is missing.
 *
 * Double-send guard: the engine skips already-prepped orders, so this can
 * never re-email anyone the "Mark All Prepped" button (or a double-fired
 * cron) already reached. It also does nothing unless tomorrow's route has
 * been uploaded - no slotless emails if the Thursday route build didn't run.
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
  if (londonHour !== 18) {
    return NextResponse.json({
      sent: 0,
      skipped: true,
      reason: `It's ${londonHour}:00 in London, not 18:00 - this is the off-season cron slot.`,
    });
  }

  // Tomorrow's date in UK time - the Friday delivery day this Thursday run
  // is confirming.
  const tomorrow = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(Date.now() + 24 * 60 * 60 * 1000));

  try {
    const summary = await sendPreppedEmails({ deliveryDay: tomorrow, requireRoute: true });
    console.log(
      `Prepped-emails cron (${tomorrow}): ${summary.message} - sent ${summary.sent}, skipped ${summary.skipped}`
    );
    return NextResponse.json(summary);
  } catch (error) {
    console.error("Prepped-emails cron failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to send prepped emails" },
      { status: 500 }
    );
  }
}
