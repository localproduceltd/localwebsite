import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { permanentlyDeleteProduct } from "@/lib/data";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * DELETE /api/admin/products/[id]/permanent
 * Permanently deletes a product if no outstanding orders exist.
 * Returns DeleteProductResult.
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  try {
    const { id } = await context.params;
    const result = await permanentlyDeleteProduct(id, supabaseAdmin);
    console.log("[admin/products/[id]/permanent DELETE]", { userId: gate.userId, id, result });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[admin/products/[id]/permanent DELETE]", err);
    return NextResponse.json(
      { error: { code: "server_error", message: (err as Error).message } },
      { status: 500 },
    );
  }
}
