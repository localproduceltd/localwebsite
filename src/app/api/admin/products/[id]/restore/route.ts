import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getArchivedProducts, restoreProduct } from "@/lib/data";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/admin/products/[id]/restore
 * Restores an archived product (clears archived_at timestamp).
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  try {
    const { id } = await context.params;
    
    // Check if product exists in archived products
    const archived = await getArchivedProducts(supabaseAdmin);
    const existing = archived.find((p) => p.id === id);
    if (!existing) {
      return NextResponse.json(
        { error: { code: "not_found", message: "Archived product not found" } },
        { status: 404 },
      );
    }

    await restoreProduct(id, supabaseAdmin);
    console.log("[admin/products/[id]/restore POST]", { userId: gate.userId, id });
    return NextResponse.json({ success: true, restored: true });
  } catch (err) {
    console.error("[admin/products/[id]/restore POST]", err);
    return NextResponse.json(
      { error: { code: "server_error", message: (err as Error).message } },
      { status: 500 },
    );
  }
}
