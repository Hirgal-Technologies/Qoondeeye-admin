import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Service-role Supabase client. Bypasses RLS entirely — only ever import this
 * from server-side code (Route Handlers, data-access functions). Never send
 * this client, or the key it holds, to the browser.
 */
export function createAdminClient() {
  if (!SERVICE_ROLE_KEY) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. Add it to .env (server-only, get it from Supabase dashboard -> Project Settings -> API)."
    );
  }

  return createSupabaseClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
