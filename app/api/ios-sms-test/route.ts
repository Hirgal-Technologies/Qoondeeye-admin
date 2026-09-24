import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const HEADER_NAME = "x-qoondeeye-test-key";
const MAX_SENDER_CHARS = 64;
const MAX_CONTENT_BYTES = 10 * 1024; // 10 KB

type SuccessBody = {
  success: true;
  sender: string;
  contentLength: number;
};

type ErrorBody = {
  success: false;
  error: string;
};

function jsonError(error: string, status: number) {
  return NextResponse.json<ErrorBody>({ success: false, error }, { status });
}

function jsonSuccess(body: SuccessBody) {
  return NextResponse.json<SuccessBody>(body);
}

function keysEqual(provided: string, expected: string) {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Temporary Apple Shortcuts SMS PoC.
 * Auth is a shared test key header — not the dashboard admin session.
 * Do not persist to Supabase from this route yet.
 */
export async function POST(request: NextRequest) {
  const configuredKey = process.env.IOS_SMS_TEST_KEY;
  if (!configuredKey) {
    return jsonError("server_not_configured", 500);
  }

  const providedKey = request.headers.get(HEADER_NAME);
  if (!providedKey || !keysEqual(providedKey, configuredKey)) {
    return jsonError("unauthorized", 401);
  }

  const body = await request.json().catch(() => null);
  const sender = typeof body?.sender === "string" ? body.sender.trim() : "";
  const content = typeof body?.content === "string" ? body.content : "";

  if (!sender || !content.trim()) {
    return jsonError("sender and content must be non-empty strings", 400);
  }

  if (sender.length > MAX_SENDER_CHARS) {
    return jsonError(`sender must be at most ${MAX_SENDER_CHARS} characters`, 400);
  }

  if (Buffer.byteLength(content, "utf8") > MAX_CONTENT_BYTES) {
    return jsonError("content must be at most 10 KB", 400);
  }

  // TEMPORARY / SENSITIVE: full SMS body logged only for the Shortcuts PoC.
  // Remove or redact this log before any long-lived / multi-tenant use.
  console.log("[api:ios-sms-test] TEMPORARY SENSITIVE LOG — full SMS body", {
    sender,
    contentLength: content.length,
    content,
  });

  return jsonSuccess({
    success: true,
    sender,
    contentLength: content.length,
  });
}
