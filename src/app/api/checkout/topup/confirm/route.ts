import { NextRequest, NextResponse } from "next/server";
import { stripe, DISCOUNT_EXPAND, extractSessionDiscount } from "@/lib/stripe";
import { addItemsToOrder, getOrder, getSupplier, isTopUpSessionProcessed, markTopUpSessionProcessed, markBasketConverted, parseItemsFromMetadata, rollbackTopUpSession, type OrderItem } from "@/lib/data";
import { sendOrderConfirmation, sendSupplierNewOrder } from "@/lib/email";
import { auth, clerkClient } from "@clerk/nextjs/server";

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

    // IDEMPOTENCY CHECK: Return early if this session was already processed
    const alreadyProcessed = await isTopUpSessionProcessed(sessionId);
    if (alreadyProcessed) {
      const existingOrder = await getOrder(alreadyProcessed.orderId);
      return NextResponse.json({ 
        success: true, 
        orderId: alreadyProcessed.orderId, 
        orderNumber: existingOrder?.orderNumber ?? 0,
        alreadyProcessed: true 
      });
    }

    // Retrieve the session from Stripe (discount expanded so the email can show it)
    const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: DISCOUNT_EXPAND });

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

    // Fetch customer name from Clerk for email greeting
    const clerk = await clerkClient();
    const clerkUser = await clerk.users.getUser(userId);
    const customerName = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || null;

    const orderId = metadata.orderId;
    if (!orderId) {
      return NextResponse.json({ error: "No order ID in session" }, { status: 400 });
    }

    // Mark session as processed BEFORE adding items (prevents race conditions)
    await markTopUpSessionProcessed(sessionId, orderId);

    // Get the existing order
    const existingOrder = await getOrder(orderId);
    if (!existingOrder) {
      // Rollback the session marker so it can be retried
      await rollbackTopUpSession(sessionId);
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Parse items using shared helper
    const items: OrderItem[] = await parseItemsFromMetadata(metadata);
    const topUpTotal = parseFloat(metadata.total);

    // Add items to the existing order - rollback session marker if this fails
    try {
      await addItemsToOrder(orderId, items, topUpTotal);
    } catch (addError) {
      console.error("Failed to add items to order, rolling back session marker:", addError);
      await rollbackTopUpSession(sessionId);
      throw addError;
    }

    // Mark any pending saved basket as converted - the items just went onto an
    // order via top-up, so it must not linger as an open basket (mirrors the
    // normal checkout path in /api/checkout/confirm).
    if (session.customer_email) {
      try {
        await markBasketConverted(session.customer_email);
      } catch (e) {
        console.error("Failed to mark basket converted (top-up):", e);
      }
    }

    // Send emails
    const customerEmail = session.customer_email;
    if (customerEmail) {
      const deliveryDayFormatted = new Date(existingOrder.deliveryDay + "T00:00:00").toLocaleDateString("en-GB", { 
        weekday: "long", day: "numeric", month: "long" 
      });
      
      // Send customer confirmation email for the top-up
      try {
        const { discountCode, couponName, discountAmount } = extractSessionDiscount(session);
        await sendOrderConfirmation({
          customerEmail,
          customerName: customerName || "there",
          orderNumber: existingOrder.orderNumber,
          deliveryDay: deliveryDayFormatted,
          items: items.map((item) => ({
            productName: item.productName,
            quantity: item.quantity,
            price: item.price,
            supplierName: item.supplierName,
          })),
          total: topUpTotal,
          isTopUp: true,
          discountCode,
          couponName,
          discountAmount,
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
      orderNumber: existingOrder.orderNumber,
      // For the GA4 purchase event on the success page
      total: topUpTotal,
      items: items.map((item) => ({
        productId: item.productId,
        productName: item.productName,
        supplierName: item.supplierName,
        price: item.price,
        quantity: item.quantity,
      })),
    });
  } catch (error) {
    console.error("Top-up confirm error:", error);
    return NextResponse.json(
      { error: "Failed to confirm top-up" },
      { status: 500 }
    );
  }
}
