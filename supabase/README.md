# Supabase Setup

Everything the database needs lives in this folder.

## Files

| File | Purpose |
|------|---------|
| `schema.sql` | Full schema: tables, indexes, RLS policies, triggers. Run this first. |
| `seed-data.sql` | Optional sample suppliers and products for dev environments. |
| `storage-setup.sql` | Creates the `product-images` storage bucket + policies. |

## Fresh Setup (New Supabase Project)

1. Create a new project in the Supabase dashboard.
2. Open **SQL Editor** and run, in order:
   1. `schema.sql`
   2. `storage-setup.sql`
   3. `seed-data.sql` *(optional — only for dev)*
3. Copy your project URL + anon key into `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   ```

## Making Schema Changes

Going forward, add a new file named `YYYYMMDD_description.sql` to this folder and run it against your Supabase project. Then update `schema.sql` so it reflects the current state (new developers should only ever need to run `schema.sql`, not a chain of migrations).

## Auth Notes

- Authentication is handled by **Clerk**, not Supabase Auth.
- The Supabase RLS policies are intentionally permissive (`USING (true)`) — access control is enforced in the app layer via Clerk `userId` checks and the `supplier_users` table linking Clerk users to suppliers.
- Admin role is stored in Clerk `publicMetadata.role = 'admin'`.
