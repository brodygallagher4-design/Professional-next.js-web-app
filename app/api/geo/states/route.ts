import type { NextRequest } from "next/server";
import { State } from "country-state-city";
import { json } from "@/server/api";

export const dynamic = "force-dynamic";

// States / regions / provinces for a country (ISO-2 code). Feeds the cascading
// State dropdown on the settings page.
export async function GET(req: NextRequest) {
  const country = (req.nextUrl.searchParams.get("country") ?? "").trim().toUpperCase();
  if (!country) return json([]);
  const states = State.getStatesOfCountry(country) ?? [];
  return json(states.map((s) => ({ code: s.isoCode, name: s.name })));
}
