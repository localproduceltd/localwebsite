// check-clerk-users.mjs — READ ONLY. Diagnoses sign-in problems on the Clerk production instance.
// Reports the state of one account, and scans every user for locked / banned accounts.
//
// Usage (from the local-produce-ltd folder):
//   CLERK_SECRET_KEY="sk_live_xxx" node check-clerk-users.mjs theotill8@aol.com
//
// It makes no changes - only reads.

import { createClerkClient } from '@clerk/backend';

if (!process.env.CLERK_SECRET_KEY?.startsWith('sk_live_')) {
  throw new Error('Set CLERK_SECRET_KEY to your production sk_live_... key first.');
}
const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
const target = process.argv[2];

function summarise(u) {
  const pe = u.emailAddresses?.find((e) => e.id === u.primaryEmailAddressId);
  return {
    id: u.id,
    email: pe?.emailAddress,
    emailVerified: pe?.verification?.status,
    passwordEnabled: u.passwordEnabled,
    locked: u.locked,
    lockoutExpiresInSeconds: u.lockoutExpiresInSeconds ?? null,
    banned: u.banned,
  };
}

// 1) the specific account
if (target) {
  const res = await clerk.users.getUserList({ emailAddress: [target] });
  const arr = Array.isArray(res) ? res : res.data;
  console.log(`\n=== ${target} — ${arr.length} account(s) found ===`);
  if (arr.length === 0) console.log('  No account with this email in the PRODUCTION instance.');
  if (arr.length > 1) console.log('  ⚠️ MORE THAN ONE account with this email — likely a duplicate.');
  arr.forEach((u) => console.log(' ', summarise(u)));
}

// 2) scan everyone for locked / banned (the "is anyone else affected?" check)
const locked = [], banned = [];
let offset = 0;
for (;;) {
  const res = await clerk.users.getUserList({ limit: 100, offset });
  const arr = Array.isArray(res) ? res : res.data;
  for (const u of arr) {
    if (u.locked) locked.push(summarise(u));
    if (u.banned) banned.push(summarise(u));
  }
  if (arr.length < 100) break;
  offset += 100;
}
console.log(`\n=== Locked accounts: ${locked.length} ===`);
locked.forEach((u) => console.log(' ', u.email, u.id, `unlock in ${u.lockoutExpiresInSeconds}s`));
console.log(`\n=== Banned accounts: ${banned.length} ===`);
banned.forEach((u) => console.log(' ', u.email, u.id));
console.log('\nDone (read-only — nothing was changed).');
