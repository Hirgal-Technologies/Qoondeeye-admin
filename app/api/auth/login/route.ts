import { NextResponse, type NextRequest } from "next/server";
import { clientAddress, createRateLimiter } from "@/lib/api/rate-limit";
import { createClient } from "@/lib/supabase/server";

// Failed sign-ins are throttled per address and per account. Supabase Auth's
// own limits only see this server's IP, so they can't tell callers apart.
const FAILURE_WINDOW_MS = 15 * 60_000;
const failuresByAddress = createRateLimiter({ limit: 30, windowMs: FAILURE_WINDOW_MS });
const failuresByEmail = createRateLimiter({ limit: 10, windowMs: FAILURE_WINDOW_MS });

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim() : null;
  const password = typeof body?.password === "string" ? body.password : null;

  if (!email || !password) {
    return NextResponse.json({ data: null, error: "email and password are required" }, { status: 400 });
  }

  const addressKey = clientAddress(request.headers);
  const emailKey = email.toLowerCase();
  const retryAfter = Math.max(
    failuresByAddress.retryAfter(addressKey),
    failuresByEmail.retryAfter(emailKey)
  );
  if (retryAfter > 0) {
    return NextResponse.json(
      { data: null, error: "too many sign-in attempts" },
      { status: 429, headers: { "retry-after": String(retryAfter) } }
    );
  }

  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (authError || !authData.user) {
    failuresByAddress.hit(addressKey);
    failuresByEmail.hit(emailKey);
    return NextResponse.json({ data: null, error: "invalid credentials" }, { status: 401 });
  }

  // Session-bound (anon-key) client: the admin_users RLS policy lets a
  // signed-in user read their own row, so this works without the
  // service-role key.
  const { data: adminRow, error: adminError } = await supabase
    .from("admin_users")
    .select("id, email, role")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (adminError) {
    await supabase.auth.signOut();
    console.error("[api:auth.login]", adminError);
    return NextResponse.json({ data: null, error: "internal server error" }, { status: 500 });
  }

  if (!adminRow) {
    failuresByAddress.hit(addressKey);
    await supabase.auth.signOut();
    return NextResponse.json({ data: null, error: "forbidden" }, { status: 403 });
  }

  failuresByEmail.reset(emailKey);
  return NextResponse.json({ data: adminRow, error: null });
}
