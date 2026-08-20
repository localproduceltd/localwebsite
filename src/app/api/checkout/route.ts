import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { auth } from "@clerk/nextjs/server";
import { type DeliveryWindow, type DeliveryOption, type OrderAddress, getSuppliersHolidayInfo, isSupplierOnHoliday, checkStockForItems } from "@/lib/data";
import { BOX_DEPOSIT_PENCE, BOTTLE_DEPOSIT_PENCE, DELIVERY_FEE_PENCE } from "@/lib/constants";
import { getBottleBalance } from "@/lib/bottle-deposits";

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
  deliveryOption: DeliveryOption;
  safePlace?: string;
  customerEmail: string;
  boxDepositPaid: boolean;
  bottleDepositPaid: boolean;
  bottleDepositQty: number;
  total: number;
  address: OrderAddress;
  phone?: string;
  instructions?: string;
  pinLat?: number;
  pinLng?: number;
  // False = "this order only": don't write these details back to the
  // customer's profile after payment. Defaults to true.
  saveProfile?: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: CheckoutRequest = await request.json();
    const { items, deliveryDay, deliveryWindow, willBeIn, deliveryOption, safePlace, customerEmail, boxDepositPaid, bottleDepositPaid, bottleDepositQty, total, address, phone, instructions, pinLat, pinLng, saveProfile } = body;

    if (!items || items.length === 0) {
      return NextResponse.json({ error: "No items in cart" }, { status: 400 });
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

    // Weekly stock gate: re-check availability at the moment of payment.
    // Baskets don't reserve stock, so this is the authoritative check.
    const stockViolations = await checkStockForItems(
      items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
      deliveryDay
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
        unit_amount: DELIVERY_FEE_PENCE,
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
          unit_amount: BOX_DEPOSIT_PENCE,
        },
        quantity: 1,
      });
    }

    // Add bottle deposit if applicable
    if (bottleDepositPaid && bottleDepositQty > 0) {
      lineItems.push({
        price_data: {
          currency: "gbp",
          product_data: {
            name: "Returnable Bottle Deposit",
            description: `${bottleDepositQty} bottle${bottleDepositQty > 1 ? "s" : ""} – refunded when returned`,
          },
          unit_amount: BOTTLE_DEPOSIT_PENCE,
        },
        quantity: bottleDepositQty,
      });
    }

    // Bottle credit: money owed back for empties the customer has told us are
    // returned. Read server-side from the ledger - never taken from the browser.
    // It's only *spent* once the order exists (see /checkout/confirm and the
    // webhook), so an abandoned checkout doesn't burn it.
    let bottleCreditPence = 0;
    try {
      const { creditPence } = await getBottleBalance(userId);
      if (creditPence > 0) {
        // Leave at least £1 to charge - Stripe needs a payable amount, and the
        // £25 minimum order means this cap never bites in practice.
        const lineItemTotal = lineItems.reduce(
          (sum, li) => sum + (li.price_data?.unit_amount ?? 0) * (li.quantity ?? 1),
          0,
        );
        bottleCreditPence = Math.max(0, Math.min(creditPence, lineItemTotal - 100));
      }
    } catch (e) {
      // Never block a checkout over credit - worst case they keep it for next time.
      console.error("Failed to read bottle credit, continuing without it:", e);
    }

    let bottleCreditCouponId: string | null = null;
    if (bottleCreditPence > 0) {
      try {
        const coupon = await stripe.coupons.create({
          amount_off: bottleCreditPence,
          currency: "gbp",
          duration: "once",
          name: "Bottle deposit refund",
          max_redemptions: 1,
        });
        bottleCreditCouponId = coupon.id;
      } catch (e) {
        console.error("Failed to create bottle credit coupon, continuing without it:", e);
        bottleCreditPence = 0;
      }
    }

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: lineItems,
      mode: "payment",
      // Stripe rejects `discounts` and `allow_promotion_codes` together, so an
      // order paying with bottle credit can't also take a promo code. Only
      // affects the handful of customers holding credit.
      ...(bottleCreditCouponId
        ? { discounts: [{ coupon: bottleCreditCouponId }] }
        : { allow_promotion_codes: true }),
      success_url: `${request.nextUrl.origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${request.nextUrl.origin}/cart`,
      customer_email: customerEmail,
      metadata: {
        userId,
        deliveryDay,
        deliveryWindow,
        willBeIn: willBeIn ? "true" : "false",
        deliveryOption: deliveryOption || "",
        safePlace: safePlace || "",
        boxDepositPaid: boxDepositPaid ? "true" : "false",
        bottleDepositPaid: bottleDepositPaid ? "true" : "false",
        bottleDepositQty: bottleDepositQty.toString(),
        bottleCreditPence: bottleCreditPence.toString(),
        addressLine1: address.addressLine1 || "",
        addressLine2: address.addressLine2 || "",
        city: address.city || "",
        postcode: address.postcode || "",
        phone: phone || "",
        instructions: instructions || "",
        pinLat: pinLat?.toString() || "",
        pinLng: pinLng?.toString() || "",
        saveProfile: saveProfile === false ? "false" : "true",
        // The client sends the gross total; the credit is ours to apply.
        total: (total - bottleCreditPence / 100).toFixed(2),
        itemCount: items.length.toString(),
        // Split items across multiple metadata fields to stay under 500 char limit per field
        ...(() => {
          const itemsCompact = items.map(i => `${i.productId}:${i.quantity}:${i.supplierId}`);
          const chunks: Record<string, string> = {};
          let currentChunk = 0;
          let currentStr = "";
          for (const item of itemsCompact) {
            if (currentStr.length + item.length + 1 > 490) {
              chunks[`items${currentChunk}`] = currentStr;
              currentChunk++;
              currentStr = item;
            } else {
              currentStr = currentStr ? `${currentStr},${item}` : item;
            }
          }
          if (currentStr) chunks[`items${currentChunk}`] = currentStr;
          return chunks;
        })(),
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
