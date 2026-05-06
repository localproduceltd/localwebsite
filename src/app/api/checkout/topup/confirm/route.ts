import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { addItemsToOrder, getOrder, getProduct, getSupplier, type OrderItem } from "@/lib/data";
import { sendOrderConfirmation, sendSupplierNewOrder } from "@/lib/email";
import { auth } from "@clerk/nextjs/server";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { sessionId } = await request.json();
    if (!sessionId) {
      return NextResponse.json({ error: "No session ID" }, { status: 400 });
    }

    // Retrieve the session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== "paid") {
      return NextResponse.json({ error: "Payment not completed" }, { status: 400 });
    }

    const metadata = session.metadata;
    if (!metadata || metadata.isTopUp !== "true") {
      return NextResponse.json({ error: "Invalid top-up session" }, { status: 400 });
    }

    // Validate user matches the session owner
    if (metadata.userId !== userId) {
      return NextResponse.json({ error: "User mismatch" }, { status: 403 });
    }

    const orderId = metadata.orderId;
    if (!orderId) {
      return NextResponse.json({ error: "No order ID in session" }, { status: 400 });
    }

    // Get the existing order
    const existingOrder = await getOrder(orderId);
    if (!existingOrder) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Parse the items from metadata
    let allItemsStr = "";
    for (let i = 0; ; i++) {
      const chunk = metadata[`items${i}`];
      if (!chunk) break;
      allItemsStr = allItemsStr ? `${allItemsStr},${chunk}` : chunk;
    }

    const items: OrderItem[] = await Promise.all(
      allItemsStr.split(",").filter(Boolean).map(async (itemStr) => {
        const [productId, quantityStr, supplierId] = itemStr.split(":");
        const product = await getProduct(productId);
        return {
          productId,
          productName: product?.name || "Unknown Product",
          quantity: parseInt(quantityStr, 10),
          price: product?.price || 0,
          supplierId,
        };
      })
    );

    const topUpTotal = parseFloat(metadata.total);

    // Add items to the existing order
    await addItemsToOrder(orderId, items, topUpTotal);

    // Send emails
    const customerEmail = session.customer_email;
    if (customerEmail) {
      const deliveryDayFormatted = new Date(existingOrder.deliveryDay + "T00:00:00").toLocaleDateString("en-GB", { 
        weekday: "long", day: "numeric", month: "long" 
      });
      
      // Send customer confirmation email for the top-up
      try {
        await sendOrderConfirmation({
          customerEmail,
          customerName: "Customer",
          orderNumber: existingOrder.orderNumber,
          deliveryDay: deliveryDayFormatted,
          items: items.map((item) => ({
            productName: item.productName,
            quantity: item.quantity,
            price: item.price,
          })),
          total: topUpTotal,
          isTopUp: true,
        });
      } catch (emailError) {
        console.error("Failed to send top-up confirmation email:", emailError);
      }

      // Send emails to suppliers for new items
      const supplierItems = new Map<string, OrderItem[]>();
      for (const item of items) {
        if (item.supplierId) {
          const existing = supplierItems.get(item.supplierId) || [];
          existing.push(item);
          supplierItems.set(item.supplierId, existing);
        }
      }

      for (const [supplierId, supplierOrderItems] of supplierItems) {
        try {
          const supplier = await getSupplier(supplierId);
          if (supplier?.email) {
            const subtotal = supplierOrderItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
            await sendSupplierNewOrder({
              supplierEmail: supplier.email,
              supplierName: supplier.name,
              orderNumber: existingOrder.orderNumber,
              deliveryDay: deliveryDayFormatted,
              items: supplierOrderItems.map((item) => ({
                productName: item.productName,
                quantity: item.quantity,
                price: item.price,
              })),
              subtotal,
              isTopUp: true,
            });
          }
        } catch (emailError) {
          console.error(`Failed to send supplier email for ${supplierId}:`, emailError);
        }
      }
    }

    return NextResponse.json({ 
      success: true, 
      orderId: existingOrder.id, 
      orderNumber: existingOrder.orderNumber 
    });
  } catch (error) {
    console.error("Top-up confirm error:", error);
    return NextResponse.json(
      { error: "Failed to confirm top-up" },
      { status: 500 }
    );
  }
}
