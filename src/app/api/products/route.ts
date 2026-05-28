import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

/**
 * GET /api/products?ids=id1,id2,id3
 * Returns products with id and category for the given IDs.
 * Used by the packing page to determine chilled items.
 */
export async function GET(request: NextRequest) {
  const idsParam = request.nextUrl.searchParams.get("ids");
  
  if (!idsParam) {
    return NextResponse.json(
      { error: "ids parameter required" },
      { status: 400 }
    );
  }

  const ids = idsParam.split(",").filter(Boolean);
  
  if (ids.length === 0) {
    return NextResponse.json([]);
  }

  try {
    const { data, error } = await supabase
      .from("products")
      .select("id, category")
      .in("id", ids);

    if (error) throw error;

    return NextResponse.json(data || []);
  } catch (err) {
    console.error("[products GET]", err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
