import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { addItemsToOrder, createOrder, getOrder, getOrderByStripeSession, isTopUpSessionProcessed, markTopUpSessionProcessed, parseItemsFromMetadata, type DeliveryWindow, type DeliveryOption, type OrderItem, setCustomerOutstandingBox, getActiveDeliveryDays } from "@/lib/data";
import { sendOrderConfirmation } from "@/lib/email";
import { DELIVERY_FEE } from "@/lib/constants";
import { clerkClient } from "@clerk/nextjs/server";
import Stripe from "stripe";

// Resolve a customer's name from their Clerk profile (best-effort).
async function resolveCustomerName(userId?: string): Promise<string | undefined> {
  if (!userId) return undefined;
  try {
    const clerk = await clerkClient();
    const u = await clerk.users.getUser(userId);
    return [u.firstName, u.lastName].filter(Boolean).join(" ") || undefined;
  } catch (e) {
    console.error("Webhook: failed to resolve customer name from Clerk:", e);
    return undefined;
  }
}

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
          customerName: existingOrder.customerName || "",
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

      // Resolve the customer's name from Clerk so the order + emails are personalised
      const customerName = await resolveCustomerName(metadata.userId);

      // Pull any discount/promo code applied at checkout so we can store it on the order
      let discountCode: string | undefined;
      let couponName: string | undefined;
      let discountAmount: number | undefined;
      try {
        const full = await stripe.checkout.sessions.retrieve(sessionId, {
          expand: ["discounts.promotion_code", "discounts.coupon"],
        });
        const amt = full.total_details?.amount_discount ?? 0;
        if (amt > 0) discountAmount = amt / 100;
        const d = full.discounts?.[0];
        if (d) {
          if (d.promotion_code && typeof d.promotion_code !== "string") {
            discountCode = d.promotion_code.code;
          }
          if (d.coupon && typeof d.coupon !== "string") {
            couponName = d.coupon.name ?? undefined;
          }
        }
      } catch (e) {
        console.error("Webhook: failed to read discount from session:", e);
      }

      // Create the order (including address data)
      const order = await createOrder({
        userId: metadata.userId,
        customerEmail: session.customer_email || "",
        customerName,
        total,
        deliveryDay: metadata.deliveryDay,
        items,
        deliveryWindow: metadata.deliveryWindow as DeliveryWindow,
        willBeIn: metadata.willBeIn === "true",
        deliveryOption: (metadata.deliveryOption as DeliveryOption) || "in",
        safePlace: metadata.safePlace || undefined,
        boxDepositPaid,
        bottleDepositPaid,
        stripeSessionId: sessionId,
        discountCode,
        couponName,
        discountAmount,
        address: metadata.addressLine1 ? {
          addressLine1: metadata.addressLine1,
          addressLine2: metadata.addressLine2 || undefined,
          city: metadata.city,
          postcode: metadata.postcode,
        } : undefined,
      });

      console.log(`Order ${order.orderNumber} created via webhook for session ${sessionId}`);

      // Note: has_outstanding_box is set when order is marked delivered, not at checkout
      // This ensures the flag reflects physical possession of a box

      // Send emails
      const customerEmail = session.customer_email;
      if (customerEmail) {
        const deliveryDayFormatted = new Date(metadata.deliveryDay + "T00:00:00").toLocaleDateString("en-GB", { 
          weekday: "long", day: "numeric", month: "long" 
        });

        try {
          const deliveryWindow = metadata.deliveryWindow as "morning" | "afternoon" | undefined;
          
          // Get cutoff day for this delivery
          const deliveryDays = await getActiveDeliveryDays();
          const thisDelivery = deliveryDays.find(d => d.deliveryDate === metadata.deliveryDay);
          const cutoffFormatted = thisDelivery?.cutoffDate 
            ? new Date(thisDelivery.cutoffDate + "T00:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })
            : undefined;
          
          await sendOrderConfirmation({
            customerEmail,
            customerName: customerName || "",
            orderNumber: order.orderNumber,
            deliveryDay: deliveryDayFormatted,
            deliveryWindow,
            address: metadata.addressLine1 ? `${metadata.addressLine1}${metadata.addressLine2 ? ", " + metadata.addressLine2 : ""}, ${metadata.city}, ${metadata.postcode}` : undefined,
            willBeIn: metadata.willBeIn === "true",
            safePlace: metadata.safePlace || undefined,
            deliveryOption: metadata.deliveryOption || undefined,
            boxDepositPaid,
            bottleDepositPaid,
            deliveryFee: DELIVERY_FEE,
            items: items.map((item) => ({
              productName: item.productName,
              quantity: item.quantity,
              price: item.price,
              supplierName: item.supplierName,
            })),
            total,
            cutoffDay: cutoffFormatted,
            cutoffTime: thisDelivery?.cutoffTime,
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
