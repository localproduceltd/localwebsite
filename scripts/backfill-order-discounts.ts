/**
 * One-off backfill: fill discount_code / coupon_name / discount_amount on existing
 * orders by reading each order's Stripe checkout session.
 *
 * Only touches orders that have a stripe_session_id and no discount captured yet,
 * so it's safe to run more than once.
 *
 * Run from the local-produce-ltd folder:
 *   npm run backfill-discounts
 *
 * Reads keys from .env.local automatically.
 * Needs: STRIPE_SECRET_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

// Load .env.local ourselves so this works without any extra flags or tooling.
function loadEnvLocal() {
  const file = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(file)) return;
  for (const raw of fs.readFileSync(file, "utf8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}
loadEnvLocal();

const missing = ["STRIPE_SECRET_KEY", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"].filter(
  (k) => !process.env[k],
);
if (missing.length) {
  console.error(`Missing required env var(s): ${missing.join(", ")}. Check your .env.local.`);
  process.exit(1);
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { typescript: true });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function main() {
  const { data: orders, error } = await supabase
    .from("orders")
    .select("id, order_number, stripe_session_id")
    .not("stripe_session_id", "is", null)
    .is("discount_amount", null);

  if (error) throw error;
  if (!orders?.length) {
    console.log("No orders to backfill.");
    return;
  }

  console.log(`Checking ${orders.length} order(s)...`);
  let updated = 0;

  for (const o of orders) {
    try {
      const session = await stripe.checkout.sessions.retrieve(o.stripe_session_id!, {
        expand: ["discounts.promotion_code", "discounts.coupon"],
      });

      const amt = session.total_details?.amount_discount ?? 0;
      if (amt <= 0) continue; // no discount on this order

      let discountCode: string | null = null;
      let couponName: string | null = null;
      const d = session.discounts?.[0];
      if (d) {
        if (d.promotion_code && typeof d.promotion_code !== "string") {
          discountCode = d.promotion_code.code;
        }
        if (d.coupon && typeof d.coupon !== "string") {
          couponName = d.coupon.name ?? null;
        }
      }

      const { error: upErr } = await supabase
        .from("orders")
        .update({
          discount_code: discountCode,
          coupon_name: couponName,
          discount_amount: amt / 100,
        })
        .eq("id", o.id);
      if (upErr) throw upErr;

      updated++;
      console.log(
        `  Order #${o.order_number}: £${(amt / 100).toFixed(2)} off` +
          `${discountCode ? ` (code ${discountCode})` : ""}` +
          `${couponName ? ` [${couponName}]` : ""}`,
      );
    } catch (e) {
      console.error(`  Order #${o.order_number}: failed -`, e);
    }
  }

  console.log(`Done. Backfilled ${updated} discounted order(s).`);
}

main().then(() => process.exit(0));
