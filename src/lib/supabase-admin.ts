import "server-only";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client using the service-role key.
 *
 * Bypasses Row Level Security. NEVER import this from anything that runs in the
 * browser. The `"server-only"` import above causes a build error if you do.
 *
 * Use this in API routes that have already enforced their own auth check
 * (e.g. via `requireAdmin()` in `./admin-auth.ts`).
 *
 * Required env var: SUPABASE_SERVICE_ROLE_KEY (in .env.local for dev,
 * configured in Vercel for production). Find it at:
 *   Supabase dashboard -> Project Settings -> API -> service_role secret.
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
}
if (!serviceRoleKey) {
  throw new Error(
    "SUPABASE_SERVICE_ROLE_KEY is not set. Add it to .env.local " +
      "(Supabase dashboard -> Settings -> API -> service_role secret).",
  );
}

export const supabaseAdmin: SupabaseClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});
