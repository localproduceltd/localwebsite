import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getDeliveryDays, createDeliveryDay, type DeliveryDay } from "@/lib/data";

/**
 * GET /api/admin/delivery-days
 * Returns all delivery days.
 */
export async function GET(request: NextRequest) {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  try {
    const deliveryDays = await getDeliveryDays(supabaseAdmin);
    return NextResponse.json({ deliveryDays });
  } catch (err) {
    console.error("[admin/delivery-days GET]", err);
    return NextResponse.json(
      { error: { code: "server_error", message: (err as Error).message } },
      { status: 500 },
    );
  }
}

/**
 * POST /api/admin/delivery-days
 * Body: { deliveryDate: string, cutoffDate: string, cutoffTime: string }
 * Creates a new delivery day.
 */
export async function POST(request: NextRequest) {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  try {
    const body = (await request.json()) as Partial<DeliveryDay>;

    const missing = ["deliveryDate", "cutoffDate", "cutoffTime"].filter(
      (k) => !body[k as keyof DeliveryDay],
    );
    if (missing.length > 0) {
      return NextResponse.json(
        {
          error: {
            code: "validation_error",
            message: `Missing required fields: ${missing.join(", ")}`,
          },
        },
        { status: 400 },
      );
    }

    const created = await createDeliveryDay(
      {
        deliveryDate: body.deliveryDate!,
        cutoffDate: body.cutoffDate!,
        cutoffTime: body.cutoffTime!,
      },
      supabaseAdmin,
    );

    console.log("[admin/delivery-days POST]", { userId: gate.userId, id: created.id });
    return NextResponse.json({ deliveryDay: created }, { status: 201 });
  } catch (err) {
    console.error("[admin/delivery-days POST]", err);
    return NextResponse.json(
      { error: { code: "server_error", message: (err as Error).message } },
      { status: 500 },
    );
  }
}
