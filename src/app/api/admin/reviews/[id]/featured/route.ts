import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { setReviewFeatured } from "@/lib/data";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * PATCH /api/admin/reviews/[id]/featured
 * Body: { kind: "product_review" | "order_review", featured: boolean }
 * Sets the featured status of a review.
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  try {
    const { id } = await context.params;
    const body = (await request.json()) as { 
      kind?: "product_review" | "order_review"; 
      featured?: boolean;
    };

    if (!body.kind || !["product_review", "order_review"].includes(body.kind)) {
      return NextResponse.json(
        {
          error: {
            code: "validation_error",
            message: "Missing or invalid field: kind (must be 'product_review' or 'order_review')",
          },
        },
        { status: 400 },
      );
    }

    if (typeof body.featured !== "boolean") {
      return NextResponse.json(
        {
          error: {
            code: "validation_error",
            message: "Missing required field: featured (boolean)",
          },
        },
        { status: 400 },
      );
    }

    await setReviewFeatured(body.kind, id, body.featured, supabaseAdmin);
    console.log("[admin/reviews/[id]/featured PATCH]", { 
      userId: gate.userId, 
      reviewId: id, 
      kind: body.kind,
      featured: body.featured,
    });

    return NextResponse.json({ success: true, featured: body.featured });
  } catch (err) {
    console.error("[admin/reviews/[id]/featured PATCH]", err);
    return NextResponse.json(
      { error: { code: "server_error", message: (err as Error).message } },
      { status: 500 },
    );
  }
}
