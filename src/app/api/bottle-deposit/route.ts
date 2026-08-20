import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getBottleBalance, recordBottleReturn } from "@/lib/bottle-deposits";

/**
 * The customer's own milk-bottle deposit position, for their account page.
 *
 * GET  -> { outstandingBottles, creditPence }
 * POST { bottles } -> marks that many empties as returned and turns the
 *        deposit into credit for their next order.
 *
 * Always scoped to the signed-in Clerk user - the caller never says who they
 * are, so one customer can't read or spend another's credit. The ledger itself
 * is service-role only, so this route is the only way in from the browser.
 */

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  try {
    return NextResponse.json(await getBottleBalance(userId));
  } catch (err) {
    console.error("[bottle-deposit GET]", err);
    return NextResponse.json({ error: "Could not load your bottle deposits" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as { bottles?: number };
    const requested = Number(body.bottles);
    if (!Number.isFinite(requested) || requested < 1) {
      return NextResponse.json({ error: "Tell us how many bottles" }, { status: 400 });
    }

    // We take them at their word that the empties are out - the only check is
    // that nobody can claim back more than they were charged for.
    const { outstandingBottles } = await getBottleBalance(userId);
    if (outstandingBottles === 0) {
      return NextResponse.json(
        { error: "You haven't got any bottles out with us at the moment" },
        { status: 400 },
      );
    }
    if (requested > outstandingBottles) {
      return NextResponse.json(
        { error: `You've only got ${outstandingBottles} bottle${outstandingBottles === 1 ? "" : "s"} out with us` },
        { status: 400 },
      );
    }

    await recordBottleReturn(userId, Math.floor(requested));
    const balance = await getBottleBalance(userId);

    console.log("[bottle-deposit POST]", { userId, bottles: Math.floor(requested), balance });
    return NextResponse.json({ success: true, ...balance });
  } catch (err) {
    console.error("[bottle-deposit POST]", err);
    return NextResponse.json({ error: "Could not record your return" }, { status: 500 });
  }
}
