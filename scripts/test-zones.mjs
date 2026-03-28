// Quick test script to check delivery_zones table
// Run with: node --env-file=.env.local scripts/test-zones.mjs

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

console.log("--- Checking delivery_zones table ---");
const { data: zones, error: zonesErr } = await supabase
  .from("delivery_zones")
  .select("*");

if (zonesErr) {
  console.error("ERROR reading delivery_zones:", zonesErr.message, zonesErr.code, zonesErr.details);
} else {
  console.log(`Found ${zones.length} zone(s):`);
  zones.forEach((z) =>
    console.log(`  - ${z.name}: lat=${z.centre_lat}, lng=${z.centre_lng}, radius=${z.radius_miles} miles`)
  );
}

// Test insert
console.log("\n--- Testing INSERT (then deleting) ---");
const { data: testInsert, error: insertErr } = await supabase
  .from("delivery_zones")
  .insert({ name: "_test_zone", centre_lat: 53.0, centre_lng: -1.5, radius_miles: 1 })
  .select()
  .single();

if (insertErr) {
  console.error("ERROR inserting:", insertErr.message, insertErr.code, insertErr.details);
} else {
  console.log("INSERT OK:", testInsert.id);
  // Clean up
  const { error: delErr } = await supabase.from("delivery_zones").delete().eq("id", testInsert.id);
  if (delErr) console.error("ERROR deleting test:", delErr.message);
  else console.log("DELETE OK (cleaned up test zone)");
}

// Check customer_profiles
console.log("\n--- Checking customer_profiles table ---");
const { data: profiles, error: profErr } = await supabase
  .from("customer_profiles")
  .select("*");

if (profErr) {
  console.error("ERROR reading customer_profiles:", profErr.message, profErr.code);
} else {
  console.log(`Found ${profiles.length} profile(s):`);
  profiles.forEach((p) =>
    console.log(`  - ${p.clerk_user_id}: postcode=${p.postcode}, lat=${p.lat}, lng=${p.lng}`)
  );
}

// Check delivery_settings (old table)
console.log("\n--- Checking delivery_settings table (old) ---");
const { data: settings, error: settErr } = await supabase
  .from("delivery_settings")
  .select("*");

if (settErr) {
  console.error("delivery_settings:", settErr.message, "(this is expected if table was dropped)");
} else {
  console.log(`Found ${settings.length} row(s) in delivery_settings`);
}
