import type { NextRequest } from "next/server";
import { supabase, getSessionEmail, countryByIso, json, dbMissing, unauthorized, assertSameOrigin } from "@/server/api";

export const dynamic = "force-dynamic";

const MIN_AGE = 18, MAX_AGE = 100;
const pad2 = (n: number) => String(n).padStart(2, "0");
// Validate a DD/MM/YYYY date of birth: a real calendar date, not in the future,
// and within the allowed age range. Returns the normalised value or an error.
function validateDob(raw: string): { value?: string; error?: string } {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw.trim());
  if (!m) return { error: "Use the date format DD/MM/YYYY." };
  const d = +m[1], mo = +m[2], y = +m[3];
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return { error: "Enter a real date of birth." };
  const dt = new Date(y, mo - 1, d);
  // Reject impossible dates that JS silently rolls over (e.g. 31/02 → 03/03).
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return { error: "That date doesn't exist." };
  const today = new Date(); today.setHours(0, 0, 0, 0);
  if (dt.getTime() > today.getTime()) return { error: "Date of birth can't be in the future." };
  let age = today.getFullYear() - y;
  const hadBirthday = today.getMonth() > mo - 1 || (today.getMonth() === mo - 1 && today.getDate() >= d);
  if (!hadBirthday) age -= 1;
  if (age < MIN_AGE) return { error: `You must be at least ${MIN_AGE} years old.` };
  if (age > MAX_AGE) return { error: "Enter a valid date of birth." };
  return { value: `${pad2(d)}/${pad2(mo)}/${y}` };
}

// Update editable "additional information" only — never name or email.
export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req); if (csrf) return csrf;
  const miss = dbMissing(); if (miss) return miss;
  const email = await getSessionEmail();
  if (!email) return unauthorized();
  const b = await req.json().catch(() => ({} as Record<string, unknown>));
  const patch: Record<string, unknown> = {};
  if (b.country !== undefined) {
    const country = String(b.country).trim().toUpperCase();
    if (country && !countryByIso(country)) return json({ error: "Select a valid country." }, 400);
    patch.country = country || null;
  }
  if (b.state !== undefined) patch.state = String(b.state).slice(0, 80) || null;
  if (b.city !== undefined) patch.city = String(b.city).slice(0, 80) || null;
  if (b.address !== undefined) patch.address = String(b.address).slice(0, 200) || null;
  if (b.bio !== undefined) patch.bio = String(b.bio).slice(0, 500) || null;
  if (b.dob !== undefined) {
    const dob = String(b.dob).trim();
    if (!dob) { patch.dob = null; }
    else {
      const check = validateDob(dob);
      if (check.error) return json({ error: check.error }, 400);
      patch.dob = check.value ?? null;
    }
  }
  if (Object.keys(patch).length === 0) return json({ error: "Nothing to update." }, 400);
  const { data, error } = await supabase.from("profiles").update(patch).eq("email", email).select().single();
  if (error) return json({ error: error.message }, 500);
  return json(data);
}
