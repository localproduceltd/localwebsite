// create-test-user.mjs
// Stage-1 verification ONLY. Creates one disposable test account so we can check
// whether the Account Portal handles the Client Trust code step.
// The email is a "+alias" of your own address, so the test code lands in YOUR inbox.
// Delete this test user afterwards (instructions provided in chat).
//
// Run from the local-produce-ltd folder:
//   CLERK_SECRET_KEY="sk_live_xxx" node create-test-user.mjs

import { createClerkClient } from '@clerk/backend';

if (!process.env.CLERK_SECRET_KEY?.startsWith('sk_live_')) {
  throw new Error('Set CLERK_SECRET_KEY to your production sk_live_... key first.');
}
const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

const email = 'josie+cttest@localproduce.ltd';
const password = 'CtTest-' + Math.random().toString(36).slice(2, 10) + '!9';

// remove any leftover test user from a previous run
const listed = await clerk.users.getUserList({ emailAddress: [email] });
const existing = Array.isArray(listed) ? listed : listed.data;
for (const u of existing || []) {
  await clerk.users.deleteUser(u.id);
  console.log('removed previous test user', u.id);
}

const u = await clerk.users.createUser({
  emailAddress: [email],
  password,
  firstName: 'ClientTrust',
  lastName: 'Test',
  skipPasswordChecks: true,
});

console.log('\n=== TEST ACCOUNT CREATED ===');
console.log('Email:    ', email);
console.log('Password: ', password);
console.log('User id:  ', u.id);
console.log('\nNext: sign in with these on https://accounts.localproduce.ltd/sign-in');
console.log('(in a fresh/incognito window so the device is untrusted).');
