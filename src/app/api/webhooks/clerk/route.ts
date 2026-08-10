import { NextRequest, NextResponse } from "next/server";
import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { eoAddContact } from "@/lib/emailoctopus";

// Clerk webhook - fires the moment someone creates an account on the site.
// Adds them to the Email Octopus list tagged "prospect", which starts the
// welcome-email automation.
//
// Clerk dashboard config: endpoint /api/webhooks/clerk, event user.created,
// signing secret in CLERK_WEBHOOK_SIGNING_SECRET (Vercel + .env.local).
export async function POST(request: NextRequest) {
  let evt;
  try {
    evt = await verifyWebhook(request);
  } catch (err) {
    console.error("Clerk webhook verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (evt.type === "user.created") {
    const data = evt.data;
    const email =
      data.email_addresses?.find(
        (e) => e.id === data.primary_email_address_id
      )?.email_address || data.email_addresses?.[0]?.email_address;
    if (email) {
      await eoAddContact({
        email,
        firstName: data.first_name || undefined,
        lastName: data.last_name || undefined,
        tags: ["prospect"],
      });
    }
  }

  return NextResponse.json({ received: true });
}
