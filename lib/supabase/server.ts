import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.SUPABASE_KEY!;

/**
 * Cookie-bound Supabase client for the current request. Runs as the signed-in
 * admin (subject to RLS) — use this to check "who is the caller", not for
 * aggregate analytics reads (see lib/supabase/admin.ts for that).
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component render (not a Route Handler/Server
          // Function) — cookie writes are ignored there; session refresh is
          // handled by whatever Route Handler runs next.
        }
      },
    },
  });
}
