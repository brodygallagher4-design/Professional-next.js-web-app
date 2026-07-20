// Shared server-side helpers for the Next.js API route handlers. This is the
// port of the former Express server (server/index.mjs) — same Supabase logic,
// same session model — adapted to Next.js route handlers + cookie APIs.
// Imported ONLY by files under app/api (server-only); never by client code.

import { createClient } from "@supabase/supabase-js";
import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { validatePhone, countryByIso } from "@/app/lib/countries";

export { validatePhone, countryByIso };

export const SUPABASE_URL = process.env.SUPABASE_URL as string;
export const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

// Service-role client (server only). Never carries session state.
export const supabase = createClient(SUPABASE_URL ?? "", SUPABASE_KEY ?? "", {
  auth: { persistSession: false, autoRefreshToken: false },
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
export function clientIp(req: Request): string {
  return (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
}

export const dynamic = "force-dynamic";
