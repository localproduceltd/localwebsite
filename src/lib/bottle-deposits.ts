import "server-only";
import { supabaseAdmin } from "./supabase-admin";
import { BOTTLE_DEPOSIT_PENCE } from "./constants";

/**
 * Milk bottle deposits.
 *
 * Customers pay £1 a bottle at checkout. When they tell us the empties are
 * back we cancel the deposit and hold the money as credit, which comes off
 * their next order automatically.
 *
 * Everything is derived from `bottle_deposit_ledger` - an append-only table of
 * deltas. It is service-role only (see the migration for why), so every read
 * and write here has to go through the server. Never trust a balance sent up
 * from the browser.
 */

/** Postgres unique-violation - our one-row-per-order guards. */
const UNIQUE_VIOLATION = "23505";

export interface BottleBalance {
  /** Bottles we believe are physically with the customer. */
  outstandingBottles: number;
  /** Money owed back to them, in pence, waiting to come off an order. */
  creditPence: number;
}

export async function getBottleBalance(clerkUserId: string): Promise<BottleBalance> {
  const { data, error } = await supabaseAdmin
    .from("bottle_deposit_ledger")
    .select("bottles_delta, credit_delta_pence")
    .eq("clerk_user_id", clerkUserId);
  if (error) throw error;

  const balance = { outstandingBottles: 0, creditPence: 0 };
  for (const row of data ?? []) {
    balance.outstandingBottles += row.bottles_delta ?? 0;
    balance.creditPence += row.credit_delta_pence ?? 0;
  }
  // Deltas should never take a balance negative, but clamp so a bad row can't
  // put the account page or the checkout maths into a strange state.
  balance.outstandingBottles = Math.max(0, balance.outstandingBottles);
  balance.creditPence = Math.max(0, balance.creditPence);
  return balance;
}

/**
 * The customer now physically has `qty` bottles. Called when an order with a
 * bottle deposit is marked delivered - not at checkout - so the count tracks
 * possession, the same rule `has_outstanding_box` follows.
 *
 * Safe to call twice: the second call hits the one-deposit-per-order index and
 * is ignored.
 */
export async function recordBottleDeposit(
  clerkUserId: string,
  orderId: string,
  qty: number,
): Promise<void> {
  if (qty <= 0) return;
  const { error } = await supabaseAdmin.from("bottle_deposit_ledger").insert({
    clerk_user_id: clerkUserId,
    order_id: orderId,
    kind: "deposit",
    bottles_delta: qty,
    credit_delta_pence: 0,
    note: `${qty} bottle${qty === 1 ? "" : "s"} delivered on deposit`,
  });
  if (error && error.code !== UNIQUE_VIOLATION) throw error;
}

/**
 * The customer says they've put `bottles` empties back out. We take them at
 * their word - the check is that they can't claim more than they have out.
 *
 * Returns the credit added, in pence.
 */
export async function recordBottleReturn(
  clerkUserId: string,
  bottles: number,
): Promise<number> {
  const { outstandingBottles } = await getBottleBalance(clerkUserId);
  const claimed = Math.min(Math.max(0, Math.floor(bottles)), outstandingBottles);
  if (claimed === 0) return 0;

  const creditPence = claimed * BOTTLE_DEPOSIT_PENCE;
  const { error } = await supabaseAdmin.from("bottle_deposit_ledger").insert({
    clerk_user_id: clerkUserId,
    order_id: null,
    kind: "returned",
    bottles_delta: -claimed,
    credit_delta_pence: creditPence,
    note: `Customer reported ${claimed} bottle${claimed === 1 ? "" : "s"} returned`,
  });
  if (error) throw error;
  return creditPence;
}

/**
 * Spend `pence` of credit against an order. Called from the checkout route
 * once Stripe has accepted the discounted session, so credit is only ever
 * consumed for a checkout that actually reached Stripe.
 *
 * Safe to call twice for the same order: the one-credit-per-order index makes
 * the repeat a no-op.
 */
export async function applyBottleCredit(
  clerkUserId: string,
  orderId: string,
  pence: number,
): Promise<void> {
  if (pence <= 0) return;
  const { error } = await supabaseAdmin.from("bottle_deposit_ledger").insert({
    clerk_user_id: clerkUserId,
    order_id: orderId,
    kind: "credit_applied",
    bottles_delta: 0,
    credit_delta_pence: -pence,
    note: `£${(pence / 100).toFixed(2)} credit used on this order`,
  });
  if (error && error.code !== UNIQUE_VIOLATION) throw error;
}

/** Manual correction from the admin side, e.g. a bottle came back broken. */
export async function adjustBottleBalance(
  clerkUserId: string,
  { bottlesDelta = 0, creditDeltaPence = 0, note }: {
    bottlesDelta?: number;
    creditDeltaPence?: number;
    note: string;
  },
): Promise<void> {
  const { error } = await supabaseAdmin.from("bottle_deposit_ledger").insert({
    clerk_user_id: clerkUserId,
    order_id: null,
    kind: "adjustment",
    bottles_delta: bottlesDelta,
    credit_delta_pence: creditDeltaPence,
    note,
  });
  if (error) throw error;
}
