import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createOrder, type DeliveryWindow, type OrderItem, getSupplier, setCustomerOutstandingBox } from "@/lib/data";
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
    if (!metadata) {
      return NextResponse.json({ error: "No metadata" }, { status: 400 });
    }

    // Parse the items from metadata
    const itemsData = JSON.parse(metadata.items || "[]");
    const items: OrderItem[] = itemsData.map((item: { productId: string; productName: string; quantity: number; price: number; supplierId: string }) => ({
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
      price: item.price,
      supplierId: item.supplierId,
    }));

    const total = parseFloat(metadata.total);
    const boxDepositPaid = metadata.boxDepositPaid === "true";

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
    });

    // If box deposit was paid, update customer profile
    if (boxDepositPaid) {
      await setCustomerOutstandingBox(metadata.userId, true);
    }

    // Send order confirmation email
    const customerEmail = session.customer_email;
    if (customerEmail) {
      const deliveryDayFormatted = new Date(metadata.deliveryDay + "T00:00:00").toLocaleDateString("en-GB", { 
        weekday: "long", day: "numeric", month: "long" 
      });
      
      fetch(`${request.nextUrl.origin}/api/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "order_confirmation",
          data: {
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
          },
        }),
      }).catch(console.error);

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
        getSupplier(supplierId).then((supplier) => {
          if (supplier?.email) {
            const subtotal = supplierOrderItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
            fetch(`${request.nextUrl.origin}/api/email`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                type: "supplier_new_order",
                data: {
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
                },
              }),
            }).catch(console.error);
          }
        }).catch(console.error);
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
