import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createOrder, getOrderByStripeSession, parseItemsFromMetadata, type DeliveryWindow, type DeliveryOption, type OrderItem, setCustomerOutstandingBox, getActiveDeliveryDays, markBasketConverted } from "@/lib/data";
import { sendOrderConfirmation } from "@/lib/email";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { DELIVERY_FEE } from "@/lib/constants";

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

    // IDEMPOTENCY CHECK: Return existing order if already created for this session
    const existingOrder = await getOrderByStripeSession(sessionId);
    if (existingOrder) {
      return NextResponse.json({ 
        success: true, 
        orderId: existingOrder.id, 
        orderNumber: existingOrder.orderNumber,
        alreadyProcessed: true 
      });
    }

    // Retrieve the session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== "paid") {
      return NextResponse.json({ error: "Payment not completed" }, { status: 400 });
    }

    const metadata = session.metadata;
    if (!metadata) {
      return NextResponse.json({ error: "No metadata" }, { status: 400 });
    }

    // Validate user matches the session owner
    if (metadata.userId !== userId) {
      return NextResponse.json({ error: "User mismatch" }, { status: 403 });
    }

    // Fetch customer name from Clerk
    const clerk = await clerkClient();
    const clerkUser = await clerk.users.getUser(userId);
    const customerName = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || null;

    // Parse items using shared helper
    const items: OrderItem[] = await parseItemsFromMetadata(metadata);
    const total = parseFloat(metadata.total);
    const boxDepositPaid = metadata.boxDepositPaid === "true";
    const bottleDepositPaid = metadata.bottleDepositPaid === "true";

    // Create the order with stripe_session_id for idempotency
    const order = await createOrder({
      userId: metadata.userId,
      customerEmail: session.customer_email || "",
      customerName: customerName || undefined,
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
      address: metadata.addressLine1 ? {
        addressLine1: metadata.addressLine1,
        addressLine2: metadata.addressLine2 || undefined,
        city: metadata.city,
        postcode: metadata.postcode,
      } : undefined,
      phone: metadata.phone || undefined,
      instructions: metadata.instructions || undefined,
      pinLat: metadata.pinLat ? parseFloat(metadata.pinLat) : undefined,
      pinLng: metadata.pinLng ? parseFloat(metadata.pinLng) : undefined,
    });

    // Note: has_outstanding_box is set when order is marked delivered, not at checkout
    // This ensures the flag reflects physical possession of a box

    // Mark the saved basket as converted (keyed on email) before the cart clears,
    // so it moves to the Converted tab rather than being deleted as an empty cart.
    if (session.customer_email) {
      try {
        await markBasketConverted(session.customer_email);
      } catch (e) {
        console.error("Failed to mark basket converted:", e);
      }
    }

    // Send emails - await them to ensure delivery
    const customerEmail = session.customer_email;
    if (customerEmail) {
      const deliveryDayFormatted = new Date(metadata.deliveryDay + "T00:00:00").toLocaleDateString("en-GB", { 
        weekday: "long", day: "numeric", month: "long" 
      });
      
      // Send customer confirmation email
      try {
        const deliveryWindow = metadata.deliveryWindow as "morning" | "afternoon" | "any" | undefined;
        
        // Get cutoff day for this delivery
        const deliveryDays = await getActiveDeliveryDays();
        const thisDelivery = deliveryDays.find(d => d.deliveryDate === metadata.deliveryDay);
        const cutoffFormatted = thisDelivery?.cutoffDate 
          ? new Date(thisDelivery.cutoffDate + "T00:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })
          : undefined;
        
        await sendOrderConfirmation({
          customerEmail,
          customerName: customerName || "there",
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
        console.error("Failed to send customer confirmation email:", emailError);
      }

      // Supplier emails disabled - they receive a summary at cutoff instead
    }

    return NextResponse.json({ success: true, orderId: order.id, orderNumber: order.orderNumber });
  } catch (error) {
    console.error("Confirm checkout error:", error);
    return NextResponse.json(
      { error: "Failed to confirm order" },
      { status: 500 }
    );
  }
}
