import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getOrder, updateOrderItems, type OrderItem } from "@/lib/data";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * PATCH /api/admin/orders/[id]/items
 * Body: { items: OrderItem[] }
 * Replaces all order items with the provided list.
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  try {
    const { id } = await context.params;
    const existing = await getOrder(id, supabaseAdmin);
    if (!existing) {
      return NextResponse.json(
        { error: { code: "not_found", message: "Order not found" } },
        { status: 404 },
      );
    }

    const body = (await request.json()) as { items?: OrderItem[] };

    if (!body.items || !Array.isArray(body.items)) {
      return NextResponse.json(
        {
          error: {
            code: "validation_error",
            message: "Missing required field: items (array)",
          },
        },
        { status: 400 },
      );
    }

    await updateOrderItems(id, body.items, supabaseAdmin);
    console.log("[admin/orders/[id]/items PATCH]", { 
      userId: gate.userId, 
      orderId: id, 
      itemCount: body.items.length,
    });

    const updated = await getOrder(id, supabaseAdmin);
    return NextResponse.json({ order: updated });
  } catch (err) {
    const message = (err as Error).message;
    console.error("[admin/orders/[id]/items PATCH]", err);
    
    if (message.includes("cutoff")) {
      return NextResponse.json(
        { error: { code: "cutoff_passed", message } },
        { status: 400 },
      );
    }
    
    return NextResponse.json(
      { error: { code: "server_error", message } },
      { status: 500 },
    );
  }
}
