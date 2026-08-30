import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { sendSupplierSummaries, getSummariesSent } from "@/lib/supplier-summaries";

/**
 * POST /api/send-supplier-summaries
 * Body: { deliveryDate, resend? }
 *
 * The manual backup behind the Wednesday 7:10pm cron. Same engine, so a press
 * of the button after the cron has run skips everyone who already had theirs -
 * pressing it is always safe. `resend: true` deliberately sends again to
 * everyone (for a genuine re-send, e.g. the order list changed after cut-off).
 */
export async function POST(request: NextRequest) {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  try {
    const { deliveryDate, resend } = await request.json();
    if (!deliveryDate) {
      return NextResponse.json({ error: "Delivery date is required" }, { status: 400 });
    }

    const run = await sendSupplierSummaries({
      deliveryDay: deliveryDate,
      sentBy: "manual",
      resend: resend === true,
    });

    return NextResponse.json(run);
  } catch (error) {
    console.error("Error sending supplier summaries:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to send supplier summaries" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/send-supplier-summaries?deliveryDate=YYYY-MM-DD
 * Who's already had their summary, so the Stock tab can show the state rather
 * than making Josie guess whether the cron ran.
 */
export async function GET(request: NextRequest) {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  const deliveryDate = request.nextUrl.searchParams.get("deliveryDate");
  if (!deliveryDate) {
    return NextResponse.json({ error: "Delivery date is required" }, { status: 400 });
  }

  try {
    const sent = await getSummariesSent(deliveryDate);
    return NextResponse.json({ deliveryDate, sentSupplierIds: [...sent] });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to read summary state" },
      { status: 500 }
    );
  }
}
