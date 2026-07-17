import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { auth } from "@clerk/nextjs/server";
import { canModifyOrder, getOrder, getSuppliersHolidayInfo, isSupplierOnHoliday, checkStockForItems } from "@/lib/data";

interface CartItem {
  productId: string;
  productName: string;
  price: number;
  quantity: number;
  unit: string;
  supplierName: string;
  supplierId: string;
}

interface TopUpCheckoutRequest {
  orderId: string;
  items: CartItem[];
  customerEmail: string;
  total: number;
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: TopUpCheckoutRequest = await request.json();
    const { orderId, items, customerEmail, total } = body;

    if (!orderId) {
      return NextResponse.json({ error: "No order ID" }, { status: 400 });
    }

    if (!items || items.length === 0) {
      return NextResponse.json({ error: "No items in cart" }, { status: 400 });
    }

    // Check if order can still be modified
    const canModify = await canModifyOrder(orderId);
    if (!canModify) {
      return NextResponse.json({ error: "Order cannot be modified - cutoff has passed" }, { status: 400 });
    }

    // Check for on-holiday suppliers
    const supplierIds = [...new Set(items.map((item) => item.supplierId))];
    const suppliersInfo = await getSuppliersHolidayInfo(supplierIds);
    const holidaySuppliers = suppliersInfo.filter(isSupplierOnHoliday);
    if (holidaySuppliers.length > 0) {
      const names = holidaySuppliers.map((s) => s.name).join(", ");
      return NextResponse.json(
        { error: `Cannot checkout: ${names} ${holidaySuppliers.length === 1 ? "is" : "are"} currently on holiday. Please remove their items from your cart.` },
        { status: 400 }
      );
    }

    // Weekly stock gate: top-up items count against the same delivery day as
    // the original order (its existing lines are already in the ordered totals).
    const order = await getOrder(orderId);
    if (order?.deliveryDay) {
      const stockViolations = await checkStockForItems(
        items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
        order.deliveryDay
      );
      if (stockViolations.length > 0) {
        const parts = stockViolations.map((v) =>
          v.remaining > 0
            ? `only ${v.remaining} of "${v.productName}" ${v.remaining === 1 ? "is" : "are"} left for this delivery`
            : `"${v.productName}" is sold out for this delivery`
        );
        return NextResponse.json(
          { error: `Sorry - ${parts.join(", and ")}. Please adjust your basket and try again.`, stockViolations },
          { status: 400 }
        );
      }
    }

    // Create line items for Stripe (no delivery fee for top-ups)
    const lineItems = items.map((item) => ({
      price_data: {
        currency: "gbp",
        product_data: {
          name: item.productName,
          description: `${item.unit} - from ${item.supplierName}`,
        },
        unit_amount: Math.round(item.price * 100),
      },
      quantity: item.quantity,
    }));

    // Build items metadata string (same format as regular checkout)
    const itemsForMeta = items.map((item) => `${item.productId}:${item.quantity}:${item.supplierId}`);
    const itemsStr = itemsForMeta.join(",");
    
    // Split items into chunks if needed (Stripe metadata limit is 500 chars per value)
    const chunks: string[] = [];
    let currentChunk = "";
    for (const itemStr of itemsForMeta) {
      if (currentChunk.length + itemStr.length + 1 > 450) {
        chunks.push(currentChunk);
        currentChunk = itemStr;
      } else {
        currentChunk = currentChunk ? `${currentChunk},${itemStr}` : itemStr;
      }
    }
    if (currentChunk) chunks.push(currentChunk);

    const metadata: Record<string, string> = {
      userId,
      orderId,
      total: total.toString(),
      isTopUp: "true",
    };
    
    // Add item chunks to metadata
    chunks.forEach((chunk, i) => {
      metadata[`items${i}`] = chunk;
    });

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: lineItems,
      mode: "payment",
      allow_promotion_codes: true,
      success_url: `${request.nextUrl.origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}&topup=true`,
      cancel_url: `${request.nextUrl.origin}/cart`,
      customer_email: customerEmail,
      metadata,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Top-up checkout error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to create checkout session: ${errorMessage}` },
      { status: 500 }
    );
  }
}
