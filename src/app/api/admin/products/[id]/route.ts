import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  getProduct,
  updateProduct,
  deleteProduct,
  updateProductStatus,
  type Product,
  type ProductStatus,
} from "@/lib/data";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/admin/products/[id]
 * Returns a single product by ID.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  try {
    const { id } = await context.params;
    const product = await getProduct(id, supabaseAdmin);
    if (!product) {
      return NextResponse.json(
        { error: { code: "not_found", message: "Product not found" } },
        { status: 404 },
      );
    }
    return NextResponse.json({ product });
  } catch (err) {
    console.error("[admin/products/[id] GET]", err);
    return NextResponse.json(
      { error: { code: "server_error", message: (err as Error).message } },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/admin/products/[id]
 * Partial update. If body contains `status`, routes through updateProductStatus.
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
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

    const body = (await request.json()) as Partial<Product> & { rejectionReason?: string };

    // If status is being updated, use updateProductStatus for proper handling
    if (body.status !== undefined && body.status !== existing.status) {
      await updateProductStatus(id, body.status as ProductStatus, body.rejectionReason, supabaseAdmin);
      // Remove status from body to avoid double-update
      delete body.status;
      delete body.rejectionReason;
    }

    // Merge remaining fields
    const merged: Product = {
      ...existing,
      ...body,
      id: existing.id,
      supplierName: existing.supplierName,
    };

    await updateProduct(merged, supabaseAdmin);
    console.log("[admin/products/[id] PATCH]", { userId: gate.userId, id });

    // Fetch updated product to return
    const updated = await getProduct(id, supabaseAdmin);
    return NextResponse.json({ product: updated });
  } catch (err) {
    console.error("[admin/products/[id] PATCH]", err);
    return NextResponse.json(
      { error: { code: "server_error", message: (err as Error).message } },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/admin/products/[id]
 * Soft delete if outstanding orders exist, hard delete otherwise.
 * Returns DeleteProductResult.
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
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

    const result = await deleteProduct(id, supabaseAdmin);
    console.log("[admin/products/[id] DELETE]", { userId: gate.userId, id, result });
    return NextResponse.json(result);
  } catch (err) {
    console.error("[admin/products/[id] DELETE]", err);
    return NextResponse.json(
      { error: { code: "server_error", message: (err as Error).message } },
      { status: 500 },
    );
  }
}
