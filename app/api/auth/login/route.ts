import type { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  SUPABASE_URL, SUPABASE_KEY, EMAIL_RE, ensureProfile, createSession, setSessionCookie,
  SESSION_DAYS, rateLimit, clientIp, json, dbMissing,
} from "@/server/api";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const miss = dbMissing(); if (miss) return miss;
  const b = await req.json().catch(() => ({} as Record<string, unknown>));
  const email = String(b.email ?? "").trim().toLowerCase();
  const password = String(b.password ?? "");
  if (!EMAIL_RE.test(email) || !password) return json({ error: "Email and password are required." }, 400);
  if (!rateLimit(`login:${clientIp(req)}`, 15, 10 * 60 * 1000) || !rateLimit(`login:${clientIp(req)}:${email}`, 8, 10 * 60 * 1000)) {
    return json({ error: "Too many login attempts — please wait a few minutes and try again." }, 429);
  }
  // Fresh client per attempt so the shared service client never carries auth state.
  const authClient = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await authClient.auth.signInWithPassword({ email, password });
  if (error || !data?.user) return json({ error: "Incorrect email or password." }, 401);
  try {
    const profile = await ensureProfile(email, data.user.user_metadata?.full_name as string | undefined);
    const token = await createSession(email);
    const res = json({ ok: true, profile });
    setSessionCookie(res, token, SESSION_DAYS * 24 * 3600);
    return res;
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
}
