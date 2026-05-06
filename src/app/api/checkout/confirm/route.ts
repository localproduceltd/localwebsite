import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createOrder, getOrderByStripeSession, type DeliveryWindow, type OrderItem, getSupplier, getProduct, setCustomerOutstandingBox } from "@/lib/data";
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

    // Parse the items from metadata
    // Items are split across items0, items1, etc. as "productId:quantity:supplierId" strings
    let allItemsStr = "";
    for (let i = 0; ; i++) {
      const chunk = metadata[`items${i}`];
      if (!chunk) break;
      allItemsStr = allItemsStr ? `${allItemsStr},${chunk}` : chunk;
    }
    
    // Also handle old format with single "items" field
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

    // Create the order with stripe_session_id for idempotency
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
      stripeSessionId: sessionId,
    });

    // If box deposit was paid, update customer profile
    if (boxDepositPaid) {
      await setCustomerOutstandingBox(metadata.userId, true);
    }

    // Send emails - await them to ensure delivery
    const customerEmail = session.customer_email;
    if (customerEmail) {
      const deliveryDayFormatted = new Date(metadata.deliveryDay + "T00:00:00").toLocaleDateString("en-GB", { 
        weekday: "long", day: "numeric", month: "long" 
      });
      
      // Send customer confirmation email
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
        console.error("Failed to send customer confirmation email:", emailError);
      }

      // Send emails to suppliers
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
          console.error(`Failed to send supplier email for ${supplierId}:`, emailError);
        }
      }
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
