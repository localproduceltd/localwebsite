/**
 * Export Stripe checkout session metadata for orders on a specific delivery day.
 * 
 * Usage: npx tsx scripts/export-stripe-metadata.ts 2026-06-12
 * 
 * This will output a JSON file with session metadata that can be used to
 * backfill missing instructions and pin locations.
 */

import Stripe from "stripe";
import * as fs from "fs";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

if (!STRIPE_SECRET_KEY) {
  console.error("❌ STRIPE_SECRET_KEY environment variable is required");
  console.error("   Run with: STRIPE_SECRET_KEY=sk_live_xxx npx tsx scripts/export-stripe-metadata.ts 2026-06-12");
  process.exit(1);
}

const stripe = new Stripe(STRIPE_SECRET_KEY);

const deliveryDay = process.argv[2];
if (!deliveryDay) {
  console.error("❌ Please provide a delivery day as argument");
  console.error("   Usage: npx tsx scripts/export-stripe-metadata.ts 2026-06-12");
  process.exit(1);
}

async function exportMetadata() {
  console.log(`🔍 Fetching Stripe sessions for delivery day: ${deliveryDay}\n`);

  const sessions: Array<{
    sessionId: string;
    customerEmail: string | null;
    deliveryDay: string;
    instructions: string;
    pinLat: string;
    pinLng: string;
    addressLine1: string;
    postcode: string;
    created: string;
  }> = [];

  // Fetch all completed checkout sessions (paginated)
  let hasMore = true;
  let startingAfter: string | undefined;

  while (hasMore) {
    const response = await stripe.checkout.sessions.list({
      limit: 100,
      starting_after: startingAfter,
    });

    for (const session of response.data) {
      const metadata = session.metadata;
      
      // Filter by delivery day
      if (metadata?.deliveryDay === deliveryDay) {
        sessions.push({
          sessionId: session.id,
          customerEmail: session.customer_email,
          deliveryDay: metadata.deliveryDay,
          instructions: metadata.instructions || "",
          pinLat: metadata.pinLat || "",
          pinLng: metadata.pinLng || "",
          addressLine1: metadata.addressLine1 || "",
          postcode: metadata.postcode || "",
          created: new Date(session.created * 1000).toISOString(),
        });
      }
    }

    hasMore = response.has_more;
    if (response.data.length > 0) {
      startingAfter = response.data[response.data.length - 1].id;
    }
  }

  console.log(`✅ Found ${sessions.length} sessions for ${deliveryDay}\n`);

  // Output summary
  const withInstructions = sessions.filter(s => s.instructions);
  const withPin = sessions.filter(s => s.pinLat && s.pinLng);
  
  console.log(`📝 Sessions with instructions: ${withInstructions.length}`);
  console.log(`📍 Sessions with pin location: ${withPin.length}\n`);

  // Print table
  console.log("Session ID | Email | Instructions | Pin");
  console.log("-".repeat(80));
  for (const s of sessions) {
    const instrPreview = s.instructions ? s.instructions.substring(0, 30) + (s.instructions.length > 30 ? "..." : "") : "—";
    const pin = s.pinLat && s.pinLng ? `${s.pinLat}, ${s.pinLng}` : "—";
    console.log(`${s.sessionId.substring(0, 20)}... | ${s.customerEmail?.substring(0, 20) || "—"} | ${instrPreview} | ${pin}`);
  }

  // Save to file
  const outputFile = `stripe-metadata-${deliveryDay}.json`;
  fs.writeFileSync(outputFile, JSON.stringify(sessions, null, 2));
  console.log(`\n💾 Full data saved to: ${outputFile}`);

  // Generate SQL update statements
  if (withInstructions.length > 0 || withPin.length > 0) {
    console.log("\n📋 SQL UPDATE statements (run these against your database):\n");
    
    for (const s of sessions) {
      if (s.instructions || (s.pinLat && s.pinLng)) {
        const updates: string[] = [];
        if (s.instructions) {
          updates.push(`instructions = '${s.instructions.replace(/'/g, "''")}'`);
        }
        if (s.pinLat) {
          updates.push(`pin_lat = ${s.pinLat}`);
        }
        if (s.pinLng) {
          updates.push(`pin_lng = ${s.pinLng}`);
        }
        
        console.log(`UPDATE orders SET ${updates.join(", ")} WHERE stripe_session_id = '${s.sessionId}';`);
      }
    }
  }
}

exportMetadata().catch(console.error);
