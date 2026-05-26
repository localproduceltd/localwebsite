import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  createProduct,
  getProducts,
  getProductsBySupplier,
  type Product,
  type Locality,
  type ProductStatus,
} from "@/lib/data";

/**
 * GET /api/admin/products
 * Returns all products. Optional `?supplierId=` to filter by supplier.
 */
export async function GET(request: NextRequest) {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  try {
    const supplierId = request.nextUrl.searchParams.get("supplierId");
    let products: Product[];
    if (supplierId) {
      products = await getProductsBySupplier(supplierId, supabaseAdmin);
    } else {
      products = await getProducts(supabaseAdmin);
    }
    return NextResponse.json({ products });
  } catch (err) {
    console.error("[admin/products GET]", err);
    return NextResponse.json(
      { error: { code: "server_error", message: (err as Error).message } },
      { status: 500 },
    );
  }
}

/**
 * POST /api/admin/products
 * Body: Omit<Product, "id" | "supplierName"> (required: name, supplierId, price, unit, image, category).
 * Returns the created product row.
 */
export async function POST(request: NextRequest) {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  try {
    const body = (await request.json()) as Partial<Product>;

    // Minimal validation
    const missing = ["name", "supplierId", "price", "unit", "image", "category"].filter(
      (k) => body[k as keyof Product] === undefined || body[k as keyof Product] === null,
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

    const product: Omit<Product, "id" | "supplierName"> = {
      name: body.name!,
      supplierId: body.supplierId!,
      description: body.description ?? "",
      price: body.price!,
      unit: body.unit!,
      image: body.image!,
      category: body.category!,
      inStock: body.inStock ?? true,
      locality: (body.locality as Locality) ?? "Local",
      lat: body.lat ?? null,
      lng: body.lng ?? null,
      variableLocation: body.variableLocation ?? false,
      status: (body.status as ProductStatus) ?? "approved",
      rejectionReason: body.rejectionReason ?? null,
      archivedAt: body.archivedAt ?? null,
      allergens: body.allergens ?? [],
      tags: body.tags ?? [],
      ingredients: body.ingredients ?? null,
    };

    const created = await createProduct(product, supabaseAdmin);
    console.log("[admin/products POST]", { userId: gate.userId, id: created.id });
    return NextResponse.json({ product: created }, { status: 201 });
  } catch (err) {
    console.error("[admin/products POST]", err);
    return NextResponse.json(
      { error: { code: "server_error", message: (err as Error).message } },
      { status: 500 },
    );
  }
}
