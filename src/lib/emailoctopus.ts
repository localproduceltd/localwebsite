import { createHash } from "crypto";

// Email Octopus push - phase 2 of the welcome-flow system.
// Adds/updates contacts on the Local list so the EO automation
// (30-min wait -> welcome or first-order thank-you) can run.
//
// Fail-soft by design: any error is logged and swallowed, so a marketing
// push can never break a sign-up or an order.

const API_BASE = "https://api.emailoctopus.com";
const LIST_ID =
  process.env.EMAILOCTOPUS_LIST_ID || "9c40e498-85aa-11f1-a5bb-bd8884190aa2";

type EoTag = "prospect" | "customer" | "welcomed";

interface EoContactInput {
  email: string;
  firstName?: string;
  lastName?: string;
  tags: EoTag[];
}

function contactId(email: string): string {
  return createHash("md5").update(email.toLowerCase().trim()).digest("hex");
}

async function eoFetch(path: string, init?: RequestInit): Promise<Response> {
  const key = process.env.EMAILOCTOPUS_API_KEY;
  if (!key) throw new Error("EMAILOCTOPUS_API_KEY is not set");
  return fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
}

/**
 * Add a contact to the Email Octopus list, or merge tags onto them if they
 * already exist. Never changes the status of an existing contact, so an
 * unsubscribed person is never re-subscribed.
 */
export async function eoAddContact({
  email,
  firstName,
  lastName,
  tags,
}: EoContactInput): Promise<void> {
  const cleaned = email.toLowerCase().trim();
  if (!cleaned || !cleaned.includes("@")) return;

  try {
    const id = contactId(cleaned);
    const existing = await eoFetch(`/lists/${LIST_ID}/contacts/${id}`);

    if (existing.status === 404) {
      // New contact - create as subscribed with tags. This fires the EO
      // "contact added" automation (the welcome flow).
      const res = await eoFetch(`/lists/${LIST_ID}/contacts`, {
        method: "POST",
        body: JSON.stringify({
          email_address: cleaned,
          status: "subscribed",
          tags,
          fields: {
            ...(firstName ? { FirstName: firstName } : {}),
            ...(lastName ? { LastName: lastName } : {}),
          },
        }),
      });
      if (!res.ok) {
        throw new Error(`EO create failed (${res.status}): ${await res.text()}`);
      }
      return;
    }

    if (!existing.ok) {
      throw new Error(
        `EO lookup failed (${existing.status}): ${await existing.text()}`
      );
    }

    // Existing contact - merge the tags on, touch nothing else.
    const current = (await existing.json()) as { tags?: string[] };
    const missing = tags.filter((t) => !(current.tags || []).includes(t));
    if (missing.length === 0) return;

    const res = await eoFetch(`/lists/${LIST_ID}/contacts/${id}`, {
      method: "PUT",
      body: JSON.stringify({
        tags: Object.fromEntries(missing.map((t) => [t, true])),
      }),
    });
    if (!res.ok) {
      throw new Error(`EO update failed (${res.status}): ${await res.text()}`);
    }
  } catch (e) {
    console.error(`Email Octopus push failed for ${cleaned}:`, e);
  }
}

// ---------------------------------------------------------------------------
// Referral-scheme sync (added Aug 2026).
// Used by /api/referral-sync, which Claude's weekly Sunday task calls to set
// ReferralCode / RewardCode fields and flip the referral10 / reward10 tags.
// Adding those tags is what fires the EO "tag added" automations that send
// the code + reward emails - so all customer email stays inside EO.
//
// Unlike eoAddContact this is NOT fail-soft: the caller wants the truth per
// contact so the weekly task can report failures.

export interface EoSyncInput {
  email: string;
  firstName?: string;
  fields?: Record<string, string>;
  addTags?: string[];
  removeTags?: string[];
}

export interface EoSyncResult {
  email: string;
  ok: boolean;
  created?: boolean;
  error?: string;
}

export async function eoSyncContact(input: EoSyncInput): Promise<EoSyncResult> {
  const cleaned = input.email.toLowerCase().trim();
  if (!cleaned || !cleaned.includes("@")) {
    return { email: input.email, ok: false, error: "invalid email" };
  }

  try {
    const id = contactId(cleaned);
    const existing = await eoFetch(`/lists/${LIST_ID}/contacts/${id}`);

    if (existing.status === 404) {
      // New contact - create as subscribed with fields + tags in one go.
      const res = await eoFetch(`/lists/${LIST_ID}/contacts`, {
        method: "POST",
        body: JSON.stringify({
          email_address: cleaned,
          status: "subscribed",
          tags: input.addTags || [],
          fields: {
            ...(input.firstName ? { FirstName: input.firstName } : {}),
            ...(input.fields || {}),
          },
        }),
      });
      if (!res.ok) {
        return {
          email: cleaned,
          ok: false,
          error: `EO create failed (${res.status}): ${await res.text()}`,
        };
      }
      return { email: cleaned, ok: true, created: true };
    }

    if (!existing.ok) {
      return {
        email: cleaned,
        ok: false,
        error: `EO lookup failed (${existing.status}): ${await existing.text()}`,
      };
    }

    // Existing contact - update fields and tags. Status is never touched, so
    // an unsubscribed contact stays unsubscribed (they just won't receive
    // the automation email).
    const tags: Record<string, boolean> = {};
    for (const t of input.removeTags || []) tags[t] = false;
    for (const t of input.addTags || []) tags[t] = true;

    const body: Record<string, unknown> = {};
    if (input.fields || input.firstName) {
      body.fields = {
        ...(input.firstName ? { FirstName: input.firstName } : {}),
        ...(input.fields || {}),
      };
    }
    if (Object.keys(tags).length > 0) body.tags = tags;
    if (Object.keys(body).length === 0) return { email: cleaned, ok: true };

    const res = await eoFetch(`/lists/${LIST_ID}/contacts/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      return {
        email: cleaned,
        ok: false,
        error: `EO update failed (${res.status}): ${await res.text()}`,
      };
    }
    return { email: cleaned, ok: true };
  } catch (e) {
    return { email: cleaned, ok: false, error: String(e) };
  }
}
