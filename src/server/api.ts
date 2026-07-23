// Shared server-side helpers for the Next.js API route handlers. This is the
// port of the former Express server (server/index.mjs) — same Supabase logic,
// same session model — adapted to Next.js route handlers + cookie APIs.
// Imported ONLY by files under app/api (server-only); never by client code.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { validatePhone, countryByIso } from "@/app/lib/countries";
import type { z } from "zod";
import "./env"; // validate + log server configuration once at startup

export { validatePhone, countryByIso };

export const SUPABASE_URL = process.env.SUPABASE_URL as string;
export const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

// Service-role client (server only). Never carries session state.
// Created lazily on first use so createClient is NOT invoked at module
// import time — otherwise next build (page-data collection) evaluates the
// route modules with no env vars set and Supabase throws "supabaseUrl is
// required." before any handler (or the dbMissing() guard) can run.
let _supabase: SupabaseClient | null = null;
function getSupabase(): SupabaseClient {
  if (!_supabase) {
    _supabase = createClient(SUPABASE_URL ?? "", SUPABASE_KEY ?? "", {
      auth: { persistSession: false, autoRefreshToken: false },
      // supabase-js queries through fetch, which Next.js caches by default — that
      // makes every read return stale data (old bio, old avatar, etc.). Force
      // `no-store` so every query hits the database live (true real-time).
      global: { fetch: (input: RequestInfo | URL, init?: RequestInit) => fetch(input, { ...init, cache: "no-store" }) },
    });
  }
  return _supabase;
}

// Proxy preserves the existing supabase.from(...) call sites while deferring
// client construction until the first property access at request time.
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getSupabase() as unknown as Record<string | symbol, unknown>;
    const value = client[prop];
    return typeof value === "function" ? (value as (...args: unknown[]) => unknown).bind(client) : value;
  },
});

export const SESSION_COOKIE = "sb_session";
export const SESSION_DAYS = 30;
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const MERCHANT_FEE_USD = 49.99;
export const PLATFORM_FEE_RATE = 0.1;

export const hashToken = (t: string) => crypto.createHash("sha256").update(t).digest("hex");

// ── JSON response helpers ────────────────────────────────────────────────────
export const json = (data: unknown, status = 200) => NextResponse.json(data, { status });
export const unauthorized = () => json({ error: "Please log in to continue." }, 401);
export const dbMissing = () =>
  !SUPABASE_URL || !SUPABASE_KEY ? json({ error: "Supabase is not configured." }, 503) : null;

// ── Sessions ─────────────────────────────────────────────────────────────────
export async function getSessionEmail(): Promise<string | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const { data } = await supabase
    .from("sessions").select("email, expires_at").eq("token_hash", hashToken(token)).maybeSingle();
  if (!data || new Date(data.expires_at).getTime() < Date.now()) return null;
  return data.email as string;
}

// Inserts a session row and returns the opaque token; the route sets the cookie.
export async function createSession(email: string): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + SESSION_DAYS * 24 * 3600 * 1000).toISOString();
  await supabase.from("sessions").delete().lt("expires_at", new Date().toISOString());
  const { error } = await supabase.from("sessions").insert({ token_hash: hashToken(token), email, expires_at: expires });
  if (error) throw new Error(error.message);
  return token;
}

export function setSessionCookie(res: NextResponse, token: string, maxAgeSeconds: number) {
  // The cookie must be `Secure` ONLY on a real HTTPS connection. Tying it to
  // NODE_ENV breaks local/LAN testing: `next start` sets NODE_ENV=production, so
  // a production build served over plain HTTP (http://localhost:3000, or a phone
  // hitting http://<lan-ip>:3000) would set Secure=true — and browsers silently
  // drop a Secure cookie on an insecure origin. The session then never persists
  // and the user appears logged out right after signing in. Deriving `secure`
  // from the actual request protocol keeps cookies working over HTTP locally and
  // stays Secure on HTTPS deployments (Vercel sets x-forwarded-proto=https).
  let isHttps = false;
  try { isHttps = (headers().get("x-forwarded-proto") ?? "").split(",")[0].trim() === "https"; } catch { /* no request context */ }
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isHttps,
    path: "/",
    maxAge: maxAgeSeconds,
  });
}

// ── Per-user helpers ─────────────────────────────────────────────────────────
export const notify = (ownerEmail: string, kind: string, title: string, body: string) =>
  supabase.from("notifications").insert({ owner_email: ownerEmail, kind, title, body });

export async function walletBalance(email: string): Promise<number> {
  const { data } = await supabase.from("wallet_transactions").select("kind, amount, status").eq("owner_email", email);
  let bal = 0;
  for (const tx of (data ?? []) as { kind: string; amount: number; status: string }[]) {
    const amt = Number(tx.amount) || 0;
    if (tx.kind === "deposit" && tx.status === "Completed") bal += amt;
    else if (tx.kind === "withdrawal") bal -= amt;
  }
  return +bal.toFixed(2);
}

export async function ensureProfile(email: string, fullName?: string, extra: Record<string, unknown> = {}) {
  const { data: existing } = await supabase.from("profiles").select("*").eq("email", email).maybeSingle();
  if (existing) {
    const patch: Record<string, unknown> = {};
    if (extra.phone && !existing.phone) patch.phone = extra.phone;
    if (extra.country && !existing.country) patch.country = extra.country;
    if (Object.keys(patch).length) await supabase.from("profiles").update(patch).eq("id", existing.id);
    return { ...existing, ...patch };
  }
  const { data: created, error } = await supabase.from("profiles")
    .insert({ full_name: fullName || email.split("@")[0], email, joined: new Date().toISOString(), ...extra })
    .select().single();
  if (error) throw new Error(error.message);
  return created;
}

// Only the buyer or seller on an order may read/write its trade chat.
export async function canAccessOrder(orderId: string, email: string): Promise<boolean> {
  const { data } = await supabase.from("purchases").select("buyer_email, seller_email").eq("id", orderId).maybeSingle();
  if (!data) return false;
  return data.buyer_email === email || data.seller_email === email;
}

// ── Rate limiting (in-memory; best-effort on serverless) ─────────────────────
const rateBuckets = new Map<string, { count: number; reset: number }>();
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  if (rateBuckets.size > 5000) for (const [k, b] of rateBuckets) if (now > b.reset) rateBuckets.delete(k);
  const bucket = rateBuckets.get(key);
  if (!bucket || now > bucket.reset) { rateBuckets.set(key, { count: 1, reset: now + windowMs }); return true; }
  if (bucket.count >= limit) return false;
  bucket.count += 1;
  return true;
}

// Persistent, cross-instance rate limit backed by a `rate_limits` table so limits
// hold across serverless instances (real protection under load). Degrades to the
// in-memory limiter if the table hasn't been created yet, so it never breaks a
// request. Returns true when the call is allowed.
//   CREATE TABLE rate_limits (key text PRIMARY KEY, count int NOT NULL, reset_at timestamptz NOT NULL);
export async function rateLimitDb(key: string, limit: number, windowMs: number): Promise<boolean> {
  const now = Date.now();
  try {
    const { data, error } = await supabase.from("rate_limits").select("count, reset_at").eq("key", key).maybeSingle();
    if (error) return rateLimit(key, limit, windowMs); // table missing / unreachable → in-memory
    if (!data || new Date(data.reset_at).getTime() < now) {
      await supabase.from("rate_limits").upsert({ key, count: 1, reset_at: new Date(now + windowMs).toISOString() });
      return true;
    }
    if (Number(data.count) >= limit) return false;
    await supabase.from("rate_limits").update({ count: Number(data.count) + 1 }).eq("key", key);
    return true;
  } catch {
    return rateLimit(key, limit, windowMs);
  }
}

// ── Admin authorisation ───────────────────────────────────────────────────────
// Admins are configured out-of-band (env ADMIN_EMAILS, comma-separated) so admin
// power is never granted by anything a user can set on their own profile.
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "brodygallagher4@gmail.com")
  .split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
export const isAdmin = (email?: string | null): boolean => !!email && ADMIN_EMAILS.includes(email.toLowerCase());
// Resolve the caller and require admin — returns the email, or a ready response.
export async function requireAdmin(): Promise<{ email: string } | NextResponse> {
  const email = await getSessionEmail();
  if (!email) return unauthorized();
  if (!isAdmin(email)) return json({ error: "Admin access required." }, 403);
  return { email };
}
export function clientIp(req: Request): string {
  return (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
}

// ── CSRF defence-in-depth ─────────────────────────────────────────────────────
// The session cookie is already SameSite=Lax (browsers won't attach it to a
// cross-site POST), but we also verify the request Origin/Referer matches the
// host on every state-changing route. A forged cross-site request is rejected
// before it can touch money, orders, or account data. Same-origin browser
// requests always carry a matching Origin, so legitimate traffic is unaffected.
// Parse + validate a request body against a Zod schema. Returns the typed data,
// or a ready 400 with a human-readable, field-scoped message (never throws).
export async function parseBody<S extends z.ZodTypeAny>(
  req: Request,
  schema: S,
): Promise<{ data?: z.infer<S>; bad?: NextResponse }> {
  const raw = await req.json().catch(() => ({}));
  const result = schema.safeParse(raw);
  if (!result.success) {
    const first = result.error.issues[0];
    return { bad: json({ error: first?.message ?? "Invalid request.", field: first?.path.join(".") }, 400) };
  }
  return { data: result.data };
}

export function assertSameOrigin(req: Request): NextResponse | null {
  const host = req.headers.get("host");
  const source = req.headers.get("origin") ?? req.headers.get("referer");
  if (!source) return null; // no Origin/Referer (native app, curl) — Lax cookie still guards
  try {
    if (host && new URL(source).host !== host) return json({ error: "Cross-origin request blocked." }, 403);
  } catch {
    return json({ error: "Invalid request origin." }, 403);
  }
  return null;
}

export const dynamic = "force-dynamic";
