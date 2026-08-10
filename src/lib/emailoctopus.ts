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
