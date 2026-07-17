import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  createSupplier,
  getSuppliers,
  type Supplier,
  type SupplierStatus,
} from "@/lib/data";

/**
 * GET /api/admin/suppliers
 * Returns all suppliers. Optional `?status=launch_live|launch_not_live|archived`.
 */
export async function GET(request: NextRequest) {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  try {
    const status = request.nextUrl.searchParams.get("status") as SupplierStatus | null;
    let suppliers = await getSuppliers(supabaseAdmin);
    if (status) {
      suppliers = suppliers.filter((s) => s.status === status);
    }
    return NextResponse.json({ suppliers });
  } catch (err) {
    console.error("[admin/suppliers GET]", err);
    return NextResponse.json(
      { error: { code: "server_error", message: (err as Error).message } },
      { status: 500 },
    );
  }
}

/**
 * POST /api/admin/suppliers
 * Body: Omit<Supplier, "id"> (most fields optional; required: name, description, image, location, category).
 * Returns the created supplier row.
 */
export async function POST(request: NextRequest) {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  try {
    const body = (await request.json()) as Partial<Supplier>;

    // Minimal validation - everything else has DB-level constraints / defaults
    const missing = ["name", "description", "image", "location", "category"].filter(
      (k) => !body[k as keyof Supplier],
    );
    if (missing.length > 0) {
      return NextResponse.json(
        {
          error: {
            code: "validation_error",
            message: `Missing required fields: ${missing.join(", ")}`,
          },
        },
        { status: 400 },
      );
    }

    const supplier: Omit<Supplier, "id"> = {
      name: body.name!,
      description: body.description!,
      image: body.image!,
      location: body.location!,
      category: body.category!,
      lat: body.lat ?? null,
      lng: body.lng ?? null,
      status: body.status ?? "launch_not_live",
      email: body.email ?? null,
      instagram: body.instagram ?? null,
      featured: body.featured ?? false,
      stockTracking: body.stockTracking ?? false,
      onHoliday: body.onHoliday ?? false,
      holidayUntil: body.holidayUntil ?? null,
      holidayMessage: body.holidayMessage ?? null,
    };

    const created = await createSupplier(supplier, supabaseAdmin);
    console.log("[admin/suppliers POST]", { userId: gate.userId, id: created.id });
    return NextResponse.json({ supplier: created }, { status: 201 });
  } catch (err) {
    console.error("[admin/suppliers POST]", err);
    return NextResponse.json(
      { error: { code: "server_error", message: (err as Error).message } },
      { status: 500 },
    );
  }
}
