import { NextRequest, NextResponse } from "next/server";
import { sendSupplierSummaries, nextDeliveryDayWithOrders } from "@/lib/supplier-summaries";
import { sendSupplierSummaryCronAlert } from "@/lib/email";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/cron/supplier-summaries
 *
 * The Wednesday supplier order summaries, targeting 7:10pm UK - ten minutes
 * after the 7pm order cut-off, so late baskets are in. Vercel cron only speaks
 * UTC, so vercel.json fires this at both 18:10 and 19:10 UTC every Wednesday;
 * the Europe/London hour check below lets exactly one through year-round
 * (18:10 UTC = 7:10pm BST in summer, 19:10 UTC = 7:10pm GMT in winter).
 *
 * Auth: Vercel sends `Authorization: Bearer ${CRON_SECRET}` automatically once
 * the CRON_SECRET env var is set. Fails closed if it's missing.
 *
 * Double-send guard: every send is recorded per supplier in
 * supplier_summary_sends and already-sent suppliers are skipped, so a
 * double-fired cron or a press of the backup button can't email anyone twice.
 *
 * If it can't send - no delivery day found, or nothing went out - Josie gets an
 * email. A silent failure here means no supplier knows what to bring on
 * Thursday, which is the one failure that wrecks the whole week.
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
  if (londonHour !== 19) {
    return NextResponse.json({
      sent: 0,
      skipped: true,
      reason: `It's ${londonHour}:00 in London, not 19:00 - this is the off-season cron slot.`,
    });
  }

  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  try {
    const deliveryDay = await nextDeliveryDayWithOrders(today);
    if (!deliveryDay) {
      await alert(`No upcoming delivery day with orders was found after ${today}, so no summaries went out.`);
      return NextResponse.json({ sent: 0, reason: "No upcoming delivery day with orders" });
    }

    const run = await sendSupplierSummaries({ deliveryDay, sentBy: "cron" });
    console.log(`Supplier-summaries cron (${deliveryDay}): ${run.message}`);

    // Nothing sent and nothing deliberately skipped = something is wrong.
    if (run.sent === 0 && run.skipped === 0) {
      await alert(
        `No supplier summaries went out for ${deliveryDay}. ${run.message}. ` +
          `Send them from the Stock tab before Thursday morning.`
      );
    } else if (run.failed > 0) {
      const failed = run.results.filter(r => !r.success && !r.skipped).map(r => `${r.supplier} (${r.error})`);
      await alert(`Supplier summaries for ${deliveryDay}: ${run.message}. Failed: ${failed.join(", ")}.`);
    }

    return NextResponse.json(run);
  } catch (error) {
    console.error("Supplier-summaries cron failed:", error);
    await alert(
      `The Wednesday supplier summaries crashed: ${error instanceof Error ? error.message : "unknown error"}. ` +
        `Send them from the Stock tab before Thursday morning.`
    );
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to send supplier summaries" },
      { status: 500 }
    );
  }
}

// A failed alert must never turn a partial send into a 500.
async function alert(message: string) {
  try {
    await sendSupplierSummaryCronAlert(message);
  } catch (error) {
    console.error("Failed to send supplier-summary cron alert:", error);
  }
}
