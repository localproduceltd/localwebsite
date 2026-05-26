import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getDeliveryDay, updateDeliveryDay, deleteDeliveryDay, type DeliveryDay } from "@/lib/data";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/admin/delivery-days/[id]
 * Returns a single delivery day by ID.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  try {
    const { id } = await context.params;
    const deliveryDay = await getDeliveryDay(id, supabaseAdmin);
    if (!deliveryDay) {
      return NextResponse.json(
        { error: { code: "not_found", message: "Delivery day not found" } },
        { status: 404 },
      );
    }
    return NextResponse.json({ deliveryDay });
  } catch (err) {
    console.error("[admin/delivery-days/[id] GET]", err);
    return NextResponse.json(
      { error: { code: "server_error", message: (err as Error).message } },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/admin/delivery-days/[id]
 * Partial update of a delivery day.
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  try {
    const { id } = await context.params;
    const existing = await getDeliveryDay(id, supabaseAdmin);
    if (!existing) {
      return NextResponse.json(
        { error: { code: "not_found", message: "Delivery day not found" } },
        { status: 404 },
      );
    }

    const body = (await request.json()) as Partial<DeliveryDay>;

    const merged: DeliveryDay = {
      id: existing.id,
      deliveryDate: body.deliveryDate ?? existing.deliveryDate,
      cutoffDate: body.cutoffDate ?? existing.cutoffDate,
      cutoffTime: body.cutoffTime ?? existing.cutoffTime,
    };

    await updateDeliveryDay(merged, supabaseAdmin);
    console.log("[admin/delivery-days/[id] PATCH]", { userId: gate.userId, id });

    const updated = await getDeliveryDay(id, supabaseAdmin);
    return NextResponse.json({ deliveryDay: updated });
  } catch (err) {
    console.error("[admin/delivery-days/[id] PATCH]", err);
    return NextResponse.json(
      { error: { code: "server_error", message: (err as Error).message } },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/admin/delivery-days/[id]
 * Deletes a delivery day.
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  try {
    const { id } = await context.params;
    const existing = await getDeliveryDay(id, supabaseAdmin);
    if (!existing) {
      return NextResponse.json(
        { error: { code: "not_found", message: "Delivery day not found" } },
        { status: 404 },
      );
    }

    await deleteDeliveryDay(id, supabaseAdmin);
    console.log("[admin/delivery-days/[id] DELETE]", { userId: gate.userId, id });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[admin/delivery-days/[id] DELETE]", err);
    return NextResponse.json(
      { error: { code: "server_error", message: (err as Error).message } },
      { status: 500 },
    );
  }
}
