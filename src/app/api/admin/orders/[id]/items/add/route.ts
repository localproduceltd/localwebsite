import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getOrder, addItemsToOrder, type OrderItem } from "@/lib/data";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/admin/orders/[id]/items/add
 * Body: { items: OrderItem[], additionalTotal: number }
 * Adds items to an existing order.
 */
export async function POST(request: NextRequest, context: RouteContext) {
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

    const body = (await request.json()) as { items?: OrderItem[]; additionalTotal?: number };

    if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json(
        {
          error: {
            code: "validation_error",
            message: "Missing required field: items (non-empty array)",
          },
        },
        { status: 400 },
      );
    }

    if (typeof body.additionalTotal !== "number") {
      return NextResponse.json(
        {
          error: {
            code: "validation_error",
            message: "Missing required field: additionalTotal (number)",
          },
        },
        { status: 400 },
      );
    }

    await addItemsToOrder(id, body.items, body.additionalTotal, supabaseAdmin);
    console.log("[admin/orders/[id]/items/add POST]", { 
      userId: gate.userId, 
      orderId: id, 
      itemCount: body.items.length,
      additionalTotal: body.additionalTotal,
    });

    const updated = await getOrder(id, supabaseAdmin);
    return NextResponse.json({ order: updated });
  } catch (err) {
    const message = (err as Error).message;
    console.error("[admin/orders/[id]/items/add POST]", err);
    
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
