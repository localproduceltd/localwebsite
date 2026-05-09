import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { addItemsToOrder, createOrder, getOrder, getOrderByStripeSession, isTopUpSessionProcessed, markTopUpSessionProcessed, parseItemsFromMetadata, type DeliveryWindow, type OrderItem, setCustomerOutstandingBox } from "@/lib/data";
import { sendOrderConfirmation } from "@/lib/email";
import Stripe from "stripe";

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

// Handle top-up orders as webhook backup (in case confirm endpoint fails)
async function handleTopUpWebhook(
  session: Stripe.Checkout.Session,
  sessionId: string,
  metadata: Stripe.Metadata
): Promise<NextResponse> {
  // Check if already processed
  const alreadyProcessed = await isTopUpSessionProcessed(sessionId);
  if (alreadyProcessed) {
    console.log(`Top-up session ${sessionId} already processed, skipping`);
    return NextResponse.json({ received: true, status: "topup_already_processed" });
  }

  const orderId = metadata.orderId;
  if (!orderId) {
    console.error("No orderId in top-up session metadata");
    return NextResponse.json({ error: "No orderId" }, { status: 400 });
  }

  try {
    // Mark as processed first (idempotency)
    await markTopUpSessionProcessed(sessionId, orderId);

    // Get the existing order
    const existingOrder = await getOrder(orderId);
    if (!existingOrder) {
      console.error(`Order ${orderId} not found for top-up`);
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Parse and add items
    const items: OrderItem[] = await parseItemsFromMetadata(metadata);
    const topUpTotal = parseFloat(metadata.total);
    await addItemsToOrder(orderId, items, topUpTotal);

    console.log(`Top-up items added to order ${existingOrder.orderNumber} via webhook`);

    // Send emails
    const customerEmail = session.customer_email;
    if (customerEmail) {
      const deliveryDayFormatted = new Date(existingOrder.deliveryDay + "T00:00:00").toLocaleDateString("en-GB", {
        weekday: "long", day: "numeric", month: "long"
      });

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
        console.error("Webhook: Failed to send top-up confirmation email:", emailError);
      }

      // Supplier emails disabled - they receive a summary at cutoff instead
    }

    return NextResponse.json({ received: true, status: "topup_processed", orderNumber: existingOrder.orderNumber });
  } catch (error) {
    console.error("Webhook top-up error:", error);
    return NextResponse.json({ error: "Failed to process top-up" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature || !webhookSecret) {
    console.error("Missing signature or webhook secret");
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    
    // Only process paid sessions
    if (session.payment_status !== "paid") {
      return NextResponse.json({ received: true, status: "payment_not_completed" });
    }

    const sessionId = session.id;

    // IDEMPOTENCY CHECK: Skip if order already exists
    const existingOrder = await getOrderByStripeSession(sessionId);
    if (existingOrder) {
      console.log(`Order already exists for session ${sessionId}, skipping webhook processing`);
      return NextResponse.json({ received: true, status: "already_processed" });
    }

    const metadata = session.metadata;
    if (!metadata) {
      console.error("No metadata in session");
      return NextResponse.json({ error: "No metadata" }, { status: 400 });
    }

    // Handle top-up orders separately
    if (metadata.isTopUp === "true") {
      return await handleTopUpWebhook(session, sessionId, metadata);
    }

    try {
      // Parse items using shared helper
      const items: OrderItem[] = await parseItemsFromMetadata(metadata);
      const total = parseFloat(metadata.total);
      const boxDepositPaid = metadata.boxDepositPaid === "true";
      const bottleDepositPaid = metadata.bottleDepositPaid === "true";

      // Create the order (including address data)
      const order = await createOrder({
        userId: metadata.userId,
        customerEmail: session.customer_email || "",
        total,
        deliveryDay: metadata.deliveryDay,
        items,
        deliveryWindow: metadata.deliveryWindow as DeliveryWindow,
        willBeIn: metadata.willBeIn === "true",
        safePlace: metadata.safePlace || undefined,
        boxDepositPaid,
        bottleDepositPaid,
        stripeSessionId: sessionId,
        address: metadata.addressLine1 ? {
          addressLine1: metadata.addressLine1,
          addressLine2: metadata.addressLine2 || undefined,
          city: metadata.city,
          postcode: metadata.postcode,
        } : undefined,
      });

      console.log(`Order ${order.orderNumber} created via webhook for session ${sessionId}`);

      // Update customer box status if needed
      if (boxDepositPaid) {
        await setCustomerOutstandingBox(metadata.userId, true);
      }

      // Send emails
      const customerEmail = session.customer_email;
      if (customerEmail) {
        const deliveryDayFormatted = new Date(metadata.deliveryDay + "T00:00:00").toLocaleDateString("en-GB", { 
          weekday: "long", day: "numeric", month: "long" 
        });

        try {
          const deliveryWindow = metadata.deliveryWindow as "morning" | "afternoon" | undefined;
          await sendOrderConfirmation({
            customerEmail,
            customerName: "Customer",
            orderNumber: order.orderNumber,
            deliveryDay: deliveryDayFormatted,
            deliveryWindow,
            address: metadata.addressLine1 ? `${metadata.addressLine1}${metadata.addressLine2 ? ", " + metadata.addressLine2 : ""}, ${metadata.city}, ${metadata.postcode}` : undefined,
            willBeIn: metadata.willBeIn === "true",
            safePlace: metadata.safePlace || undefined,
            boxDepositPaid,
            bottleDepositPaid,
            items: items.map((item) => ({
              productName: item.productName,
              quantity: item.quantity,
              price: item.price,
            })),
            total,
          });
        } catch (emailError) {
          console.error("Webhook: Failed to send customer email:", emailError);
        }

        // Supplier emails disabled - they receive a summary at cutoff instead
      }

      return NextResponse.json({ received: true, orderNumber: order.orderNumber });
    } catch (error) {
      console.error("Webhook order creation error:", error);
      return NextResponse.json({ error: "Failed to create order" }, { status: 500 });
    }
  }

  // Handle other event types if needed
  return NextResponse.json({ received: true });
}
