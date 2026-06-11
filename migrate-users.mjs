// migrate-users.mjs
// One-off: import dev-export users into the Clerk PRODUCTION instance.
//
// - Keeps passwords for the password users (bcrypt digest carried over).
// - Creates the Google users with no password so they sign in via Google.
// - IDEMPOTENT: if a user with the same email already exists in prod, it is
//   skipped (no duplicate) and its existing id is still recorded. Safe to re-run.
// - Writes user-id-map.csv  (old_id -> new_id, keyed by email) for the Supabase remap.
//
// Run from inside the local-produce-ltd folder. No extra installs needed.
//
// Usage:
//   Dry run (creates NOTHING):
//     CLERK_SECRET_KEY="sk_live_xxx" DRY_RUN=1 node migrate-users.mjs ./export.csv
//   Real run (safe to run again if some failed):
//     CLERK_SECRET_KEY="sk_live_xxx" node migrate-users.mjs ./export.csv

import fs from 'node:fs';
import { createClerkClient } from '@clerk/backend';

const CSV = process.argv[2];
const DRY = process.env.DRY_RUN === '1';

if (!process.env.CLERK_SECRET_KEY?.startsWith('sk_live_')) {
  throw new Error('Set CLERK_SECRET_KEY to your production sk_live_... key first.');
}
if (!CSV || !fs.existsSync(CSV)) {
  throw new Error('Usage: node migrate-users.mjs <path-to-export.csv>');
}

// --- tiny CSV parser (handles quoted fields, commas/newlines inside quotes) ---
function parseCSV(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false; }
      else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c === '\r') { /* ignore */ }
    else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  const header = rows.shift();
  return rows.filter(r => r.length > 1).map(r => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])));
}

const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
const rows = parseCSV(fs.readFileSync(CSV, 'utf8'));
console.log(`${rows.length} users to import${DRY ? '  (DRY RUN - nothing will be created)' : ''}\n`);

async function findByEmail(email) {
  const res = await clerk.users.getUserList({ emailAddress: [email], limit: 1 });
  const arr = Array.isArray(res) ? res : res.data;
  return arr && arr[0];
}

const out = [];
let created = 0, skipped = 0, fail = 0;
for (const r of rows) {
  const email = (r.primary_email_address || '').trim();
  if (!email) { console.log('skip (no email):', r.id); continue; }
  const digest = (r.password_digest || '').trim();
  const method = digest ? 'password' : 'google';

  try {
    const existing = await findByEmail(email);
    if (existing) {
      out.push(`${r.id},${email},${existing.id},${method},existing`);
      console.log('skip (already exists):', email, '->', existing.id); skipped++;
      continue;
    }
    if (DRY) { console.log('would create:', email, `(${method})`); continue; }

    const u = await clerk.users.createUser({
      emailAddress: [email],
      firstName: r.first_name || undefined,
      lastName: r.last_name || undefined,
      publicMetadata: { dev_user_id: r.id },
      skipPasswordChecks: true,
      ...(digest
        ? { passwordDigest: digest, passwordHasher: (r.password_hasher || 'bcrypt').trim() }
        : { skipPasswordRequirement: true }),
    });
    out.push(`${r.id},${email},${u.id},${method},created`);
    console.log('ok:', email, '->', u.id); created++;
  } catch (e) {
    const msg = (e.errors?.[0]?.longMessage || e.errors?.[0]?.message || e.message || 'unknown')
      .replace(/[\r\n,]+/g, ' ');
    out.push(`${r.id},${email},,${method},ERROR:${msg}`);
    console.error('FAIL:', email, '-', msg); fail++;
  }
  await new Promise((res) => setTimeout(res, 600)); // gentle on rate limits
}

if (!DRY) {
  fs.writeFileSync('user-id-map.csv', 'old_id,email,new_id,method,status\n' + out.join('\n') + '\n');
  console.log(`\nDone. created=${created} already-existed=${skipped} failed=${fail}. Wrote user-id-map.csv`);
}
