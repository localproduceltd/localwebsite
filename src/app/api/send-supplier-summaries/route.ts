import { NextRequest, NextResponse } from "next/server";
import { getOrdersByDeliveryDay, getSuppliers, getOrdersWithTopUps } from "@/lib/data";
import { sendSupplierOrderSummary } from "@/lib/email";
import { requireAdmin } from "@/lib/admin-auth";

export async function POST(request: NextRequest) {
  // Emails every supplier their order summary - admin only, like /api/admin/*
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  try {
    const { deliveryDate } = await request.json();

    if (!deliveryDate) {
      return NextResponse.json({ error: "Delivery date is required" }, { status: 400 });
    }

    // Get all orders for this delivery day
    const orders = await getOrdersByDeliveryDay(deliveryDate);

    if (orders.length === 0) {
      return NextResponse.json({ error: "No orders found for this delivery date" }, { status: 400 });
    }

    // Get all suppliers
    const suppliers = await getSuppliers();
    const supplierMap = new Map(suppliers.map((s) => [s.id, s]));

    // Get orders that have been topped up
    const toppedUpOrderIds = await getOrdersWithTopUps();

    // Group order items by supplier
    const supplierOrders: Map<string, {
      supplier: { id: string; name: string; email: string | null };
      orders: Map<number, { orderNumber: number; boxNumber: number | null; orderId: string; items: Array<{ productName: string; unit: string; quantity: number; price: number }> }>;
      stockTotals: Map<string, { productName: string; unit: string; totalQuantity: number }>;
    }> = new Map();

    for (const order of orders) {
      for (const item of order.items) {
        if (!item.supplierId) continue;

        const supplier = supplierMap.get(item.supplierId);
        if (!supplier) continue;

        if (!supplierOrders.has(item.supplierId)) {
          supplierOrders.set(item.supplierId, {
            supplier: { id: supplier.id, name: supplier.name, email: supplier.email },
            orders: new Map(),
            stockTotals: new Map(),
          });
        }

        const supplierData = supplierOrders.get(item.supplierId)!;

        // Add to orders
        if (!supplierData.orders.has(order.orderNumber)) {
          supplierData.orders.set(order.orderNumber, {
            orderNumber: order.orderNumber,
            boxNumber: order.boxNumber,
            orderId: order.id,
            items: [],
          });
        }
        supplierData.orders.get(order.orderNumber)!.items.push({
          productName: item.productName,
          unit: item.unit,
          quantity: item.quantity,
          price: item.price,
        });

        // Add to stock totals - key by productName + unit so different pack sizes don't merge
        const stockKey = `${item.productName}|${item.unit || ""}`;
        if (!supplierData.stockTotals.has(stockKey)) {
          supplierData.stockTotals.set(stockKey, {
            productName: item.productName,
            unit: item.unit,
            totalQuantity: 0,
          });
        }
        supplierData.stockTotals.get(stockKey)!.totalQuantity += item.quantity;
      }
    }

    // Send emails to each supplier with delay to avoid rate limits
    const results: Array<{ supplier: string; success: boolean; error?: string }> = [];
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    for (const [, data] of supplierOrders) {
      if (!data.supplier.email) {
        results.push({
          supplier: data.supplier.name,
          success: false,
          error: "No email address",
        });
        continue;
      }

      const ordersArray = Array.from(data.orders.values()).map((order) => ({
        orderNumber: order.orderNumber,
        boxNumber: order.boxNumber,
        items: order.items,
        subtotal: order.items.reduce((sum, item) => sum + item.price * item.quantity, 0),
        hasTopUp: toppedUpOrderIds.has(order.orderId),
      }));

      const grandTotal = ordersArray.reduce((sum, order) => sum + order.subtotal, 0);

      try {
        await sendSupplierOrderSummary({
          supplierEmail: data.supplier.email,
          supplierName: data.supplier.name,
          deliveryDate,
          stockTotals: Array.from(data.stockTotals.values()).sort((a, b) => a.productName.localeCompare(b.productName)),
          orders: ordersArray,
          grandTotal,
        });

        results.push({
          supplier: data.supplier.name,
          success: true,
        });
        
        // Wait 250ms between emails to avoid rate limits
        await delay(250);
      } catch (error) {
        results.push({
          supplier: data.supplier.name,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    return NextResponse.json({
      message: `Sent ${successCount} emails${failCount > 0 ? `, ${failCount} failed` : ""}`,
      results,
    });
  } catch (error) {
    console.error("Error sending supplier summaries:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to send supplier summaries" },
      { status: 500 }
    );
  }
}
