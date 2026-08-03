import { NextRequest, NextResponse } from "next/server";
import { createSupplierProductFlag, getOrders, getRefundsForDeliveryDay, removeSupplierProductFlag } from "@/lib/data";
import { sendSupplierFlagAlert } from "@/lib/email";
import { supabase } from "@/lib/supabase";

export async function POST(request: NextRequest) {
  try {
    const { deliveryDay, supplierId, productName, quantityUnavailable } = await request.json();

    if (!deliveryDay || !supplierId || !productName) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // How many they can't supply. null/absent = whole line.
    const qtyUnavailable: number | null =
      typeof quantityUnavailable === "number" && quantityUnavailable > 0
        ? Math.floor(quantityUnavailable)
        : null;

    // Get supplier name
    const { data: supplier, error: supplierError } = await supabase
      .from("suppliers")
      .select("name")
      .eq("id", supplierId)
      .single();

    if (supplierError || !supplier) {
      return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
    }

    // Create the flag
    await createSupplierProductFlag(deliveryDay, supplierId, productName, "supplier", qtyUnavailable);

    // Count affected customers
    const orders = await getOrders();
    const affectedOrders = orders.filter(
      o => o.deliveryDay === deliveryDay && 
           o.status !== "cancelled" &&
           o.items.some(i => i.supplierId === supplierId && i.productName === productName)
    );
    const affectedCount = affectedOrders.length;

    // Send admin notification email. A failed send never fails the flag -
    // the flag itself is already saved and visible on the Stock tab.
    try {
      await sendSupplierFlagAlert({
        supplierName: supplier.name,
        productName,
        quantityUnavailable: qtyUnavailable,
        deliveryDay,
        affectedCount,
        affectedOrderNumbers: affectedOrders.map(o => o.orderNumber),
      });
    } catch (emailError) {
      console.error("Supplier flag alert email failed:", emailError);
    }

    return NextResponse.json({
      success: true,
      affectedCount,
    });
  } catch (error) {
    console.error("Flag product error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to flag product" },
      { status: 500 }
    );
  }
}

// Undo a "can't supply" flag ("Actually, I can supply").
// Blocked once customers have been refunded against this product for the day -
// we don't want to imply those refunds are reversed.
export async function DELETE(request: NextRequest) {
  try {
    const { deliveryDay, supplierId, productName } = await request.json();

    if (!deliveryDay || !supplierId || !productName) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Find orders on this day that include this supplier's product.
    const orders = await getOrders();
    const relevantOrderIds = new Set(
      orders
        .filter(o =>
          o.deliveryDay === deliveryDay &&
          o.items.some(i => i.supplierId === supplierId && i.productName === productName)
        )
        .map(o => o.id)
    );

    // Have any of those orders been refunded as "not coming" for this product?
    const dayRefunds = await getRefundsForDeliveryDay(deliveryDay);
    const alreadyRefunded = dayRefunds.some(r =>
      relevantOrderIds.has(r.orderId) &&
      r.productName === productName &&
      !r.itemArrived
    );

    if (alreadyRefunded) {
      return NextResponse.json(
        { error: "Customers have already been refunded for this item, so it can't be un-flagged. Please contact Local." },
        { status: 409 }
      );
    }

    await removeSupplierProductFlag(deliveryDay, supplierId, productName);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Unflag product error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to remove flag" },
      { status: 500 }
    );
  }
}
