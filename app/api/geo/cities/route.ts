import type { NextRequest } from "next/server";
import { City } from "country-state-city";
import { json } from "@/server/api";

export const dynamic = "force-dynamic";

// Cities for a state within a country (both ISO-2 codes). Feeds the cascading
// City dropdown once a state is chosen on the settings page.
export async function GET(req: NextRequest) {
  const country = (req.nextUrl.searchParams.get("country") ?? "").trim().toUpperCase();
  const state = (req.nextUrl.searchParams.get("state") ?? "").trim();
  if (!country || !state) return json([]);
  const cities = City.getCitiesOfState(country, state) ?? [];
  // De-duplicate names (some datasets repeat) and keep them ordered.
  const seen = new Set<string>();
  const out: string[] = [];
  for (const c of cities) { if (!seen.has(c.name)) { seen.add(c.name); out.push(c.name); } }
  return json(out);
}
