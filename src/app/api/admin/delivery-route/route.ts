import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

// GET: Fetch the route for a specific delivery day
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const deliveryDay = searchParams.get("deliveryDay");

  if (!deliveryDay) {
    return NextResponse.json({ error: "deliveryDay is required" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("delivery_routes")
    .select("*")
    .eq("delivery_day", deliveryDay)
    .order("route_position", { ascending: true });

  if (error) {
    console.error("Error fetching delivery route:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data || []);
}

// POST: Upload/replace a route for a delivery day
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { delivery_day, route } = body;

    if (!delivery_day || !route || !Array.isArray(route)) {
      return NextResponse.json(
        { error: "delivery_day and route array are required" },
        { status: 400 }
      );
    }

    // Validate route items
    for (const item of route) {
      if (typeof item.order_number !== "number" || typeof item.position !== "number") {
        return NextResponse.json(
          { error: "Each route item must have order_number and position" },
          { status: 400 }
        );
      }
    }

    // Get order IDs for the order numbers
    const orderNumbers = route.map((r: { order_number: number }) => r.order_number);
    const { data: orders, error: ordersError } = await supabaseAdmin
      .from("orders")
      .select("id, order_number, box_number")
      .eq("delivery_day", delivery_day)
      .in("order_number", orderNumbers);

    if (ordersError) {
      console.error("Error fetching orders:", ordersError);
      return NextResponse.json({ error: ordersError.message }, { status: 500 });
    }

    if (!orders || orders.length === 0) {
      return NextResponse.json(
        { error: "No matching orders found for the given delivery day" },
        { status: 404 }
      );
    }

    // Create maps of order_number -> order_id / box_number
    const orderMap = new Map(orders.map((o) => [o.order_number, o.id]));
    const boxMap = new Map(orders.map((o) => [o.order_number, o.box_number]));

    // Delete existing route for this day
    const { error: deleteError } = await supabaseAdmin
      .from("delivery_routes")
      .delete()
      .eq("delivery_day", delivery_day);

    if (deleteError) {
      console.error("Error deleting existing route:", deleteError);
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    // Insert new route entries
    const routeEntries = route
      .filter((r: { order_number: number }) => orderMap.has(r.order_number))
      .map((r: { order_number: number; position: number; leg: string }) => ({
        delivery_day,
        order_id: orderMap.get(r.order_number),
        order_number: r.order_number,
        box_number: boxMap.get(r.order_number) ?? null,
        route_position: r.position,
        leg: r.leg || "morning",
      }));

    if (routeEntries.length === 0) {
      return NextResponse.json(
        { error: "No valid route entries to insert" },
        { status: 400 }
      );
    }

    const { error: insertError } = await supabaseAdmin
      .from("delivery_routes")
      .insert(routeEntries);

    if (insertError) {
      console.error("Error inserting route:", insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Route uploaded: ${routeEntries.length} stops for ${delivery_day}`,
      stops: routeEntries.length,
    });
  } catch (error) {
    console.error("Error processing route upload:", error);
    return NextResponse.json(
      { error: "Failed to process route upload" },
      { status: 500 }
    );
  }
}
