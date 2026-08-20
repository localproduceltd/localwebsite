/**
 * One-off backfill: recover milk-bottle deposit quantities from Stripe.
 *
 * Until the bottle-deposit ledger existed, orders only stored the boolean
 * `bottle_deposit_paid` - the quantity went to Stripe and nowhere else. This
 * reads each affected order's checkout session, pulls the count back out, and:
 *   1. writes it to orders.bottle_deposit_qty
 *   2. adds a 'deposit' row to bottle_deposit_ledger for orders already
 *      delivered, so those customers can claim their deposit back
 *
 * The quantity is read from the "Returnable Bottle Deposit" line item, with
 * session metadata (bottleDepositQty) as a fallback.
 *
 * Note it keys off the ORDER's user_id, not the session metadata's userId -
 * those diverged in the Clerk migration and only the order's is current.
 *
 * Safe to run more than once: the ledger's one-deposit-per-order index makes
 * repeat rows a no-op, and orders already carrying a qty are skipped.
 *
 * Dry run first (prints, writes nothing):
 *   npm run backfill-bottles
 * Then apply:
 *   npm run backfill-bottles -- --apply
 *
 * Needs: STRIPE_SECRET_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

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

const APPLY = process.argv.includes("--apply");

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { typescript: true });
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function qtyFromSession(sessionId: string): Promise<number> {
  const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ["line_items"] });

  const line = session.line_items?.data.find((li) =>
    (li.description ?? "").toLowerCase().includes("bottle deposit"),
  );
  if (line?.quantity) return line.quantity;

  const fromMeta = parseInt(session.metadata?.bottleDepositQty ?? "", 10);
  return Number.isFinite(fromMeta) ? fromMeta : 0;
}

async function main() {
  console.log(APPLY ? "APPLYING changes.\n" : "DRY RUN - nothing will be written. Re-run with --apply.\n");

  const { data: orders, error } = await supabase
    .from("orders")
    .select("id, order_number, user_id, customer_name, status, created_at, stripe_session_id, bottle_deposit_qty")
    .eq("bottle_deposit_paid", true)
    .not("stripe_session_id", "is", null)
    .order("created_at");

  if (error) throw error;
  if (!orders?.length) {
    console.log("No bottle-deposit orders found.");
    return;
  }

  let qtyWritten = 0;
  let ledgerRows = 0;
  let bottlesTotal = 0;

  for (const o of orders) {
    try {
      const qty = o.bottle_deposit_qty || (await qtyFromSession(o.stripe_session_id!));
      if (qty <= 0) {
        console.log(`  #${o.order_number} ${o.customer_name}: no quantity found - skipping`);
        continue;
      }

      const needsQty = !o.bottle_deposit_qty;
      // Only orders that actually reached the doorstep count as bottles out.
      const delivered = o.status === "delivered";
      bottlesTotal += delivered ? qty : 0;

      console.log(
        `  #${o.order_number} ${o.customer_name} (${String(o.created_at).slice(0, 10)}): ` +
          `${qty} bottle${qty === 1 ? "" : "s"}` +
          `${needsQty ? " [set qty]" : ""}` +
          `${delivered ? " [ledger +]" : ` [${o.status} - no ledger row]`}`,
      );

      if (!APPLY) continue;

      if (needsQty) {
        const { error: upErr } = await supabase
          .from("orders")
          .update({ bottle_deposit_qty: qty })
          .eq("id", o.id);
        if (upErr) throw upErr;
        qtyWritten++;
      }

      if (delivered) {
        const { error: ledErr } = await supabase.from("bottle_deposit_ledger").insert({
          clerk_user_id: o.user_id,
          order_id: o.id,
          kind: "deposit",
          bottles_delta: qty,
          credit_delta_pence: 0,
          note: `Backfilled from Stripe: ${qty} bottle${qty === 1 ? "" : "s"} on order #${o.order_number}`,
        });
        // 23505 = already backfilled, which is fine.
        if (ledErr && ledErr.code !== "23505") throw ledErr;
        if (!ledErr) ledgerRows++;
      }
    } catch (e) {
      console.error(`  #${o.order_number}: failed -`, e);
    }
  }

  console.log(
    `\n${APPLY ? "Done" : "Would write"}: ${APPLY ? qtyWritten : "-"} qty update(s), ` +
      `${APPLY ? ledgerRows : "-"} ledger row(s). ` +
      `${bottlesTotal} bottle(s) outstanding across delivered orders (£${bottlesTotal}.00).`,
  );
}

main().then(() => process.exit(0));
