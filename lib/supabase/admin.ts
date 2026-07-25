import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Service-role Supabase client. Bypasses RLS entirely — only ever import this
 * from server-side code (Route Handlers, data-access functions). Never send
 * this client, or the key it holds, to the browser.
 */
function buildAdminClient(serviceRoleKey: string) {
  return createSupabaseClient(SUPABASE_URL, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

let cachedClient: ReturnType<typeof buildAdminClient> | null = null;

export function createAdminClient() {
  if (!SERVICE_ROLE_KEY) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. Add it to .env (server-only, get it from Supabase dashboard -> Project Settings -> API)."
    );
  }

  // The service-role client is stateless (no session persistence), so one
  // instance can be shared by every request in the process instead of paying
  // client construction on each query.
  cachedClient ??= buildAdminClient(SERVICE_ROLE_KEY);
  return cachedClient;
}
