import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { deleteSupplierUser, getSupplierUsers } from "@/lib/data";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * DELETE /api/admin/supplier-users/[id]
 * Deletes a supplier user mapping by ID.
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  try {
    const { id } = await context.params;
    
    // Check if supplier user exists
    const supplierUsers = await getSupplierUsers(supabaseAdmin);
    const existing = supplierUsers.find((su) => su.id === id);
    if (!existing) {
      return NextResponse.json(
        { error: { code: "not_found", message: "Supplier user not found" } },
        { status: 404 },
      );
    }

    await deleteSupplierUser(id, supabaseAdmin);
    console.log("[admin/supplier-users/[id] DELETE]", { userId: gate.userId, id });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[admin/supplier-users/[id] DELETE]", err);
    return NextResponse.json(
      { error: { code: "server_error", message: (err as Error).message } },
      { status: 500 },
    );
  }
}
