import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getSavedBaskets } from "@/lib/data";
import { sendSavedBasketReminder } from "@/lib/email";

/**
 * POST /api/admin/saved-baskets/remind
 *
 * Emails every pending (not-yet-converted) saved basket that has an email
 * address a "your basket is still waiting" checkout reminder. Sends one at a
 * time with a small delay to stay within Resend's rate limits, mirroring the
 * supplier-summary send. Admin only.
 */
export async function POST() {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  try {
    const baskets = await getSavedBaskets();
    const pending = baskets.filter(
      (b) => !b.convertedAt && b.customerEmail && b.products.length > 0
    );

    const results: Array<{ email: string; success: boolean; error?: string }> = [];
    const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    for (const basket of pending) {
      try {
        await sendSavedBasketReminder({
          customerEmail: basket.customerEmail!,
          items: basket.products.map((p) => ({
            productName: p.productName,
            quantity: p.quantity,
            price: p.price,
            supplierName: p.supplierName,
          })),
          total: basket.total,
        });
        results.push({ email: basket.customerEmail!, success: true });
        await delay(250);
      } catch (error) {
        results.push({
          email: basket.customerEmail!,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    const sent = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

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
