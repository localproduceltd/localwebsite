import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getOrder, cancelOrder } from "@/lib/data";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/admin/orders/[id]/cancel
 * Cancels an order if before cutoff.
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

    await cancelOrder(id, supabaseAdmin);
    console.log("[admin/orders/[id]/cancel POST]", { userId: gate.userId, orderId: id });

    const updated = await getOrder(id, supabaseAdmin);
    return NextResponse.json({ order: updated });
  } catch (err) {
    const message = (err as Error).message;
    console.error("[admin/orders/[id]/cancel POST]", err);
    
    // Handle cutoff error specifically
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
