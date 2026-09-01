import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  deleteSupplier,
  getSupplier,
  updateSupplier,
  type Supplier,
} from "@/lib/data";
import { SUPPLIER_CATEGORIES, isSupplierCategory } from "@/lib/supplier-categories";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/admin/suppliers/[id]
 */
export async function GET(_request: NextRequest, ctx: RouteContext) {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  try {
    const { id } = await ctx.params;
    const supplier = await getSupplier(id, supabaseAdmin);
    if (!supplier) {
      return NextResponse.json(
        { error: { code: "not_found", message: "Supplier not found" } },
        { status: 404 },
      );
    }
    return NextResponse.json({ supplier });
  } catch (err) {
    console.error("[admin/suppliers/[id] GET]", err);
    return NextResponse.json(
      { error: { code: "server_error", message: (err as Error).message } },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/admin/suppliers/[id]
 * Partial update. Body fields are merged onto the existing supplier.
 */
export async function PATCH(request: NextRequest, ctx: RouteContext) {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  try {
    const { id } = await ctx.params;
    const existing = await getSupplier(id, supabaseAdmin);
    if (!existing) {
      return NextResponse.json(
        { error: { code: "not_found", message: "Supplier not found" } },
        { status: 404 },
      );
    }

    const patch = (await request.json()) as Partial<Supplier>;

    // Only checked when the patch actually touches category, so existing rows
    // can still be edited on other fields.
    if (patch.category !== undefined && !isSupplierCategory(patch.category)) {
      return NextResponse.json(
        {
          error: {
            code: "validation_error",
            message: `Invalid category "${patch.category}". Must be one of: ${SUPPLIER_CATEGORIES.join(", ")}`,
          },
        },
        { status: 400 },
      );
    }

    const merged: Supplier = { ...existing, ...patch, id: existing.id };

    await updateSupplier(merged, supabaseAdmin);
    console.log("[admin/suppliers/[id] PATCH]", { userId: gate.userId, id });
    return NextResponse.json({ supplier: merged });
  } catch (err) {
    console.error("[admin/suppliers/[id] PATCH]", err);
    return NextResponse.json(
      { error: { code: "server_error", message: (err as Error).message } },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/admin/suppliers/[id]
 * Cascades products / order_items / ratings / supplier_users / supplier_order_items.
 * Will fail if there are FK constraints we don't know about - if a supplier has live orders,
 * the existing `deleteSupplier` removes the related rows; the admin UI used to fall back to
 * "set to Not Live" in that case. Same advice applies here.
 */
export async function DELETE(_request: NextRequest, ctx: RouteContext) {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  try {
    const { id } = await ctx.params;
    await deleteSupplier(id, supabaseAdmin);
    console.log("[admin/suppliers/[id] DELETE]", { userId: gate.userId, id });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[admin/suppliers/[id] DELETE]", err);
    return NextResponse.json(
      {
        error: {
          code: "delete_failed",
          message:
            "Could not delete supplier. They may still be linked to orders. " +
            "Consider setting status to 'archived' instead.",
        },
      },
      { status: 409 },
    );
  }
}
