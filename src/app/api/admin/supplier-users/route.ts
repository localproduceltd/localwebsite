import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { createSupplierUser, getSupplierUsers } from "@/lib/data";

/**
 * GET /api/admin/supplier-users
 * Returns all supplier user mappings.
 */
export async function GET(request: NextRequest) {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  try {
    const supplierUsers = await getSupplierUsers(supabaseAdmin);
    return NextResponse.json({ supplierUsers });
  } catch (err) {
    console.error("[admin/supplier-users GET]", err);
    return NextResponse.json(
      { error: { code: "server_error", message: (err as Error).message } },
      { status: 500 },
    );
  }
}

/**
 * POST /api/admin/supplier-users
 * Body: { clerkUserId: string, supplierId: string }
 * Creates a new supplier user mapping.
 */
export async function POST(request: NextRequest) {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  try {
    const body = (await request.json()) as { clerkUserId?: string; supplierId?: string };

    if (!body.clerkUserId || !body.supplierId) {
      return NextResponse.json(
        {
          error: {
            code: "validation_error",
            message: "Missing required fields: clerkUserId, supplierId",
          },
        },
        { status: 400 },
      );
    }

    await createSupplierUser(body.clerkUserId, body.supplierId, supabaseAdmin);
    console.log("[admin/supplier-users POST]", { 
      userId: gate.userId, 
      clerkUserId: body.clerkUserId, 
      supplierId: body.supplierId,
    });
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (err) {
    console.error("[admin/supplier-users POST]", err);
    return NextResponse.json(
      { error: { code: "server_error", message: (err as Error).message } },
      { status: 500 },
    );
  }
}
