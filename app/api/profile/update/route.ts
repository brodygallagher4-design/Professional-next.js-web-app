import type { NextRequest } from "next/server";
import { supabase, getSessionEmail, countryByIso, json, dbMissing, unauthorized } from "@/server/api";

export const dynamic = "force-dynamic";

// Update editable "additional information" only — never name or email.
export async function POST(req: NextRequest) {
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
  if (b.dob !== undefined) {
    const dob = String(b.dob).trim();
    if (dob && !/^\d{2}\/\d{2}\/\d{2,4}$/.test(dob)) return json({ error: "Use the date format DD/MM/YYYY." }, 400);
    patch.dob = dob || null;
  }
  if (Object.keys(patch).length === 0) return json({ error: "Nothing to update." }, 400);
  const { data, error } = await supabase.from("profiles").update(patch).eq("email", email).select().single();
  if (error) return json({ error: error.message }, 500);
  return json(data);
}
