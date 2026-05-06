import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createOrder, getOrderByStripeSession, type DeliveryWindow, type OrderItem, getSupplier, getProduct, setCustomerOutstandingBox } from "@/lib/data";
import { sendOrderConfirmation, sendSupplierNewOrder } from "@/lib/email";
import Stripe from "stripe";

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

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

    try {
      // Parse items from metadata
      let allItemsStr = "";
      for (let i = 0; ; i++) {
        const chunk = metadata[`items${i}`];
        if (!chunk) break;
        allItemsStr = allItemsStr ? `${allItemsStr},${chunk}` : chunk;
      }

      // Handle old format
      let parsedItems: OrderItem[] | undefined;
      if (!allItemsStr && metadata.items) {
        try {
          const oldItems = JSON.parse(metadata.items);
          parsedItems = await Promise.all(
            oldItems.map(async (item: { p: string; q: number; s: string } | { productId: string; productName: string; quantity: number; price: number; supplierId: string }) => {
              if ("p" in item) {
                const product = await getProduct(item.p);
                return { productId: item.p, productName: product?.name || "Unknown Product", quantity: item.q, price: product?.price || 0, supplierId: item.s };
              } else {
                return { productId: item.productId, productName: item.productName, quantity: item.quantity, price: item.price, supplierId: item.supplierId };
              }
            })
          );
          allItemsStr = "OLD_FORMAT";
        } catch {
          allItemsStr = "";
        }
      }

      const items: OrderItem[] = allItemsStr === "OLD_FORMAT" && parsedItems ? parsedItems : await Promise.all(
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

      const total = parseFloat(metadata.total);
      const boxDepositPaid = metadata.boxDepositPaid === "true";
      const bottleDepositPaid = metadata.bottleDepositPaid === "true";

      // Create the order
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
          await sendOrderConfirmation({
            customerEmail,
            customerName: "Customer",
            orderNumber: order.orderNumber,
            deliveryDay: deliveryDayFormatted,
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

        // Send supplier emails
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
                orderNumber: order.orderNumber,
                deliveryDay: deliveryDayFormatted,
                items: supplierOrderItems.map((item) => ({
                  productName: item.productName,
                  quantity: item.quantity,
                  price: item.price,
                })),
                subtotal,
              });
            }
          } catch (emailError) {
            console.error(`Webhook: Failed to send supplier email for ${supplierId}:`, emailError);
          }
        }
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
