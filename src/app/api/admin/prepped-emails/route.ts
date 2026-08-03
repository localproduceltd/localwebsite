import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { sendPreppedEmails } from "@/lib/prepped-emails";

/**
 * POST /api/admin/prepped-emails
 * Body: { delivery_day: "YYYY-MM-DD" }
 *
 * Powers the "Mark All Prepped" button. Shares its engine with the Thursday
 * 6pm cron (/api/cron/prepped-emails) - see src/lib/prepped-emails.ts.
 * Already-prepped orders are always skipped, so the button is safe to press
 * even after the cron has run (nobody gets the email twice).
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

    // A deliberate click sends even without an uploaded route (falls back to
    // window-only wording), so requireRoute is false here.
    const summary = await sendPreppedEmails({ deliveryDay: delivery_day, requireRoute: false });

    if (!summary.success) {
      return NextResponse.json({ error: summary.message }, { status: 500 });
    }

    return NextResponse.json(summary);
  } catch (error) {
    console.error("Error in prepped-emails:", error);
    return NextResponse.json({ error: "Failed to process prepped emails" }, { status: 500 });
  }
}
