import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { auth } from "@clerk/nextjs/server";
import { type DeliveryWindow } from "@/lib/data";

interface CartItem {
  productId: string;
  productName: string;
  price: number;
  quantity: number;
  unit: string;
  supplierName: string;
  supplierId: string;
}

interface CheckoutRequest {
  items: CartItem[];
  deliveryDay: string;
  deliveryWindow: DeliveryWindow;
  willBeIn: boolean;
  safePlace?: string;
  customerEmail: string;
  boxDepositPaid: boolean;
  total: number;
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: CheckoutRequest = await request.json();
    const { items, deliveryDay, deliveryWindow, willBeIn, safePlace, customerEmail, boxDepositPaid, total } = body;

    if (!items || items.length === 0) {
      return NextResponse.json({ error: "No items in cart" }, { status: 400 });
    }

    // Create line items for Stripe
    const lineItems = items.map((item) => ({
      price_data: {
        currency: "gbp",
        product_data: {
          name: item.productName,
          description: `${item.unit} - from ${item.supplierName}`,
        },
        unit_amount: Math.round(item.price * 100), // Stripe uses pence
      },
      quantity: item.quantity,
    }));

    // Add delivery fee
    lineItems.push({
      price_data: {
        currency: "gbp",
        product_data: {
          name: "Delivery Fee",
          description: "Home delivery",
        },
        unit_amount: 299, // £2.99
      },
      quantity: 1,
    });

    // Add box deposit if applicable
    if (boxDepositPaid) {
      lineItems.push({
        price_data: {
          currency: "gbp",
          product_data: {
            name: "Returnable Box Deposit",
            description: "Refunded when box is returned",
          },
          unit_amount: 1000, // £10
        },
        quantity: 1,
      });
    }

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: lineItems,
      mode: "payment",
      success_url: `${request.nextUrl.origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${request.nextUrl.origin}/cart`,
      customer_email: customerEmail,
      metadata: {
        userId,
        deliveryDay,
        deliveryWindow,
        willBeIn: willBeIn ? "true" : "false",
        safePlace: safePlace || "",
        boxDepositPaid: boxDepositPaid ? "true" : "false",
        total: total.toString(),
        itemCount: items.length.toString(),
        // Store minimal item data - just IDs and quantities, prices looked up on confirm
        items: JSON.stringify(items.map(i => ({ p: i.productId, q: i.quantity, s: i.supplierId }))),
      },
    });

    return NextResponse.json({ sessionId: session.id, url: session.url });
  } catch (error) {
    console.error("Checkout error:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
