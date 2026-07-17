import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  typescript: true,
});

// Promo/discount details applied on Stripe's checkout page. The session must be
// retrieved with expand: ["discounts.promotion_code", "discounts.coupon"] for
// the code and coupon name to resolve - amount_discount is always present.
export const DISCOUNT_EXPAND = ["discounts.promotion_code", "discounts.coupon"];

export interface SessionDiscount {
  discountCode?: string;
  couponName?: string;
  discountAmount?: number;
}

export function extractSessionDiscount(session: Stripe.Checkout.Session): SessionDiscount {
  const result: SessionDiscount = {};
  const amount = session.total_details?.amount_discount ?? 0;
  if (amount > 0) result.discountAmount = amount / 100;
  const d = session.discounts?.[0];
  if (d) {
    if (d.promotion_code && typeof d.promotion_code !== "string") {
      result.discountCode = d.promotion_code.code;
    }
    if (d.coupon && typeof d.coupon !== "string") {
      result.couponName = d.coupon.name ?? undefined;
    }
  }
  return result;
}
