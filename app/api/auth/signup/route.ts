import type { NextRequest } from "next/server";
import {
  supabase, EMAIL_RE, countryByIso, validatePhone, ensureProfile, createSession,
  setSessionCookie, SESSION_DAYS, rateLimitDb, clientIp, json, dbMissing, assertSameOrigin
} from "@/server/api";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req); if (csrf) return csrf;
  const miss = dbMissing(); if (miss) return miss;
  if (!(await rateLimitDb(`signup:${clientIp(req)}`, 6, 60 * 60 * 1000))) {
    return json({ error: "Too many signup attempts — please try again later." }, 429);
  }
  const b = await req.json().catch(() => ({} as Record<string, unknown>));
  const fullName = String(b.full_name ?? "").trim().slice(0, 80);
  const email = String(b.email ?? "").trim().toLowerCase();
  const password = String(b.password ?? "");
  const country = String(b.country ?? "").trim().toUpperCase();
  if (!fullName) return json({ error: "Your full name is required." }, 400);
  if (!EMAIL_RE.test(email)) return json({ error: "Enter a valid email address." }, 400);
  if (password.length < 6 || password.length > 30) return json({ error: "Password must be 6-30 characters long." }, 400);
  if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) return json({ error: "Password must include letters and at least one number." }, 400);
  const c = countryByIso(country);
  if (!c) return json({ error: "Select your country." }, 400);
  const rawPhone = String(b.phone ?? "");
  const phoneCheck = validatePhone(country, rawPhone.startsWith(c.dial) ? rawPhone.slice(c.dial.length) : rawPhone);
  if (!phoneCheck.ok) return json({ error: phoneCheck.error }, 400);

  const { error } = await supabase.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { full_name: fullName },
  });
  if (error) {
    const exists = /already|registered|exists/i.test(error.message);
    return json({ error: exists ? "An account with this email already exists — please log in." : error.message }, exists ? 409 : 500);
  }
  try {
    const profile = await ensureProfile(email, fullName, { phone: phoneCheck.e164, country });
    const token = await createSession(email);
    const res = json({ ok: true, profile }, 201);
    setSessionCookie(res, token, SESSION_DAYS * 24 * 3600);
    return res;
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
}
