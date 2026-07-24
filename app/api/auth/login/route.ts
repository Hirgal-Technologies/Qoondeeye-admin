import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email : null;
  const password = typeof body?.password === "string" ? body.password : null;

  if (!email || !password) {
    return NextResponse.json({ data: null, error: "email and password are required" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (authError || !authData.user) {
    return NextResponse.json({ data: null, error: "invalid credentials" }, { status: 401 });
  }

  // Session-bound (anon-key) client: the admin_users RLS policy lets a
  // signed-in user read their own row, so this works without the
  // service-role key.
  const { data: adminRow } = await supabase
    .from("admin_users")
    .select("id, email, role")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (!adminRow) {
    await supabase.auth.signOut();
    return NextResponse.json({ data: null, error: "forbidden" }, { status: 403 });
  }

  return NextResponse.json({ data: adminRow, error: null });
}
