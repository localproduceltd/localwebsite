import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getProduct, archiveProduct } from "@/lib/data";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/admin/products/[id]/archive
 * Archives a product (soft delete via archived_at timestamp).
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  try {
    const { id } = await context.params;
    const existing = await getProduct(id, supabaseAdmin);
    if (!existing) {
      return NextResponse.json(
        { error: { code: "not_found", message: "Product not found" } },
        { status: 404 },
      );
    }

    await archiveProduct(id, supabaseAdmin);
    console.log("[admin/products/[id]/archive POST]", { userId: gate.userId, id });
    return NextResponse.json({ success: true, archived: true });
  } catch (err) {
    console.error("[admin/products/[id]/archive POST]", err);
    return NextResponse.json(
      { error: { code: "server_error", message: (err as Error).message } },
      { status: 500 },
    );
  }
}
