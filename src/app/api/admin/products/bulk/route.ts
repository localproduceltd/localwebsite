import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  createProduct,
  type Product,
  type Locality,
  type ProductStatus,
} from "@/lib/data";

// In-memory idempotency store (for demo; use Redis/DB in production)
const processedKeys = new Map<string, { products: Product[]; timestamp: number }>();
const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function cleanupOldKeys() {
  const now = Date.now();
  for (const [key, value] of processedKeys) {
    if (now - value.timestamp > IDEMPOTENCY_TTL_MS) {
      processedKeys.delete(key);
    }
  }
}

/**
 * POST /api/admin/products/bulk
 * Body: { items: Array<Omit<Product, "id" | "supplierName">> }
 * Accepts Idempotency-Key header for deduplication.
 * Returns { products: Product[] }
 */
export async function POST(request: NextRequest) {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  try {
    const idempotencyKey = request.headers.get("Idempotency-Key");
    
    // Check for duplicate request
    if (idempotencyKey) {
      cleanupOldKeys();
      const cached = processedKeys.get(idempotencyKey);
      if (cached) {
        console.log("[admin/products/bulk POST] Returning cached response for idempotency key", { idempotencyKey });
        return NextResponse.json({ products: cached.products }, { status: 201 });
      }
    }

    const body = (await request.json()) as { items?: Partial<Product>[] };

    if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json(
        {
          error: {
            code: "validation_error",
            message: "Request body must contain a non-empty 'items' array",
          },
        },
        { status: 400 },
      );
    }

    // Validate all items before creating any
    const requiredFields = ["name", "supplierId", "price", "unit", "image", "category"];
    for (let i = 0; i < body.items.length; i++) {
      const item = body.items[i];
      const missing = requiredFields.filter(
        (k) => item[k as keyof Product] === undefined || item[k as keyof Product] === null,
      );
      if (missing.length > 0) {
        return NextResponse.json(
          {
            error: {
              code: "validation_error",
              message: `Item ${i}: Missing required fields: ${missing.join(", ")}`,
            },
          },
          { status: 400 },
        );
      }
    }

    const createdProducts: Product[] = [];

    for (const item of body.items) {
      const product: Omit<Product, "id" | "supplierName"> = {
        name: item.name!,
        supplierId: item.supplierId!,
        description: item.description ?? "",
        price: item.price!,
        unit: item.unit!,
        image: item.image!,
        category: item.category!,
        inStock: item.inStock ?? true,
        weeklyStock: item.weeklyStock ?? null,
        stockCountedOn: item.stockCountedOn ?? null,
        refrigerated: item.refrigerated ?? false,
        locality: (item.locality as Locality) ?? "Local",
        lat: item.lat ?? null,
        lng: item.lng ?? null,
        variableLocation: item.variableLocation ?? false,
        status: (item.status as ProductStatus) ?? "approved",
        rejectionReason: item.rejectionReason ?? null,
        archivedAt: item.archivedAt ?? null,
        allergens: item.allergens ?? [],
        tags: item.tags ?? [],
        ingredients: item.ingredients ?? null,
      };

      const created = await createProduct(product, supabaseAdmin);
      createdProducts.push(created);
    }

    // Store for idempotency
    if (idempotencyKey) {
      processedKeys.set(idempotencyKey, { products: createdProducts, timestamp: Date.now() });
    }

    console.log("[admin/products/bulk POST]", { 
      userId: gate.userId, 
      count: createdProducts.length,
      ids: createdProducts.map(p => p.id),
    });
    return NextResponse.json({ products: createdProducts }, { status: 201 });
  } catch (err) {
    console.error("[admin/products/bulk POST]", err);
    return NextResponse.json(
      { error: { code: "server_error", message: (err as Error).message } },
      { status: 500 },
    );
  }
}
