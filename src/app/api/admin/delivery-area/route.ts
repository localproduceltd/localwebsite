import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getDeliveryArea, saveDeliveryArea, deleteDeliveryArea } from "@/lib/data";

/**
 * GET /api/admin/delivery-area
 * Returns the current delivery area polygon.
 */
export async function GET(request: NextRequest) {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  try {
    const deliveryArea = await getDeliveryArea(supabaseAdmin);
    return NextResponse.json({ deliveryArea });
  } catch (err) {
    console.error("[admin/delivery-area GET]", err);
    return NextResponse.json(
      { error: { code: "server_error", message: (err as Error).message } },
      { status: 500 },
    );
  }
}

/**
 * PUT /api/admin/delivery-area
 * Body: { polygonGeojson: GeoJSON }
 * Creates or updates the delivery area polygon.
 */
export async function PUT(request: NextRequest) {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  try {
    const body = (await request.json()) as { polygonGeojson?: unknown };

    if (!body.polygonGeojson) {
      return NextResponse.json(
        {
          error: {
            code: "validation_error",
            message: "Missing required field: polygonGeojson",
          },
        },
        { status: 400 },
      );
    }

    await saveDeliveryArea(body.polygonGeojson, supabaseAdmin);
    console.log("[admin/delivery-area PUT]", { userId: gate.userId });

    const updated = await getDeliveryArea(supabaseAdmin);
    return NextResponse.json({ deliveryArea: updated });
  } catch (err) {
    console.error("[admin/delivery-area PUT]", err);
    return NextResponse.json(
      { error: { code: "server_error", message: (err as Error).message } },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/admin/delivery-area
 * Deletes the delivery area polygon.
 */
export async function DELETE(request: NextRequest) {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  try {
    await deleteDeliveryArea(supabaseAdmin);
    console.log("[admin/delivery-area DELETE]", { userId: gate.userId });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[admin/delivery-area DELETE]", err);
    return NextResponse.json(
      { error: { code: "server_error", message: (err as Error).message } },
      { status: 500 },
    );
  }
}
