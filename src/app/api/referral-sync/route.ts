import { NextRequest, NextResponse } from "next/server";
import { eoSyncContact, EoSyncInput } from "@/lib/emailoctopus";

// Referral-scheme sync endpoint (added Aug 2026).
//
// Called by Claude's weekly Sunday referral task (which cannot reach the
// Email Octopus API directly) to update EO contacts: set the ReferralCode /
// RewardCode fields and add/remove the referral10 / reward10 tags. Adding
// those tags fires the EO automations that email each customer their code
// or reward - so the website stays the single place that talks to EO.
//
// Auth: the REFERRAL_SYNC_KEY env var must match the x-sync-key header.
// The same key is stored in Supabase (referral_config) for the task to read.
//
// POST body: { "contacts": [ { email, firstName?, fields?, addTags?, removeTags? }, ... ] }
// Response:  { "results": [ { email, ok, created?, error? }, ... ] }

export async function POST(request: NextRequest) {
  const expected = process.env.REFERRAL_SYNC_KEY;
  if (!expected) {
    return NextResponse.json(
      { error: "REFERRAL_SYNC_KEY is not configured" },
      { status: 500 }
    );
  }
  if (request.headers.get("x-sync-key") !== expected) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  let contacts: EoSyncInput[];
  try {
    const body = await request.json();
    contacts = body?.contacts;
    if (!Array.isArray(contacts) || contacts.length === 0) {
      throw new Error("contacts must be a non-empty array");
    }
    if (contacts.length > 50) {
      throw new Error("max 50 contacts per call");
    }
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 400 });
  }

  const results = [];
  for (const c of contacts) {
    results.push(await eoSyncContact(c));
  }
  return NextResponse.json({ results });
}
