import type { NextRequest } from "next/server";
import { supabase, getSessionEmail, notify, json, dbMissing, unauthorized } from "@/server/api";

export const dynamic = "force-dynamic";

// Confirms the ad exists and belongs to the signed-in seller. Returns the ad row
// or an error response — every mutation goes through this ownership gate.
async function ownedAd(id: string, email: string) {
  const adId = Number(id);
  if (!Number.isInteger(adId)) return { error: json({ error: "Invalid ad id." }, 400) } as const;
  const { data: ad } = await supabase.from("ads").select("*").eq("id", adId).maybeSingle();
  if (!ad) return { error: json({ error: "Ad not found." }, 404) } as const;
  if (ad.owner_email !== email) return { error: json({ error: "This ad is not yours." }, 403) } as const;
  return { ad } as const;
}

const str = (v: unknown, max = 2000) => String(v ?? "").trim().slice(0, max);

// PATCH — add stock to an existing ad by uploading real account credentials.
// Each credential row is one sellable unit; the ad's `quantity` is kept in sync
// with the number of UNSOLD credentials. Only the owner may add stock.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const miss = dbMissing(); if (miss) return miss;
  const email = await getSessionEmail();
  if (!email) return unauthorized();
  const gate = await ownedAd(params.id, email);
  if ("error" in gate) return gate.error;

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const rawCreds = Array.isArray(body.credentials) ? body.credentials : null;
  if (!rawCreds || rawCreds.length === 0) {
    return json({ error: "Add at least one account's login details." }, 400);
  }
  if (rawCreds.length > 200) return json({ error: "You can add up to 200 accounts at once." }, 400);

  // Every account must have at least a login and a password.
  const rows = [];
  for (const c of rawCreds as Record<string, unknown>[]) {
    const login = str(c.login, 200);
    const password = str(c.password, 200);
    if (!login || !password) return json({ error: "Each account needs both a login/username and a password." }, 400);
    rows.push({
      ad_id: gate.ad.id,
      login, password,
      email: str(c.email, 200),
      email_pass: str(c.emailPass, 200),
      preview_link: str(c.previewLink, 500),
      notes: str(c.notes, 1000),
      sold: false,
    });
  }

  const { error: insErr } = await supabase.from("ad_credentials").insert(rows);
  if (insErr) return json({ error: insErr.message }, 500);

  // Keep quantity == number of unsold credentials; restock reactivates the ad.
  const { count } = await supabase.from("ad_credentials")
    .select("id", { count: "exact", head: true }).eq("ad_id", gate.ad.id).eq("sold", false);
  const nextQty = count ?? rows.length;
  const nextStatus = gate.ad.status === "removed" || gate.ad.status === "denied" ? "active" : gate.ad.status;
  const { data, error } = await supabase.from("ads")
    .update({ quantity: nextQty, status: nextStatus }).eq("id", gate.ad.id).select().single();
  if (error) return json({ error: error.message }, 500);
  await notify(email, "ad", "Stock added", `You added ${rows.length} account${rows.length > 1 ? "s" : ""} to "${gate.ad.title}" — ${nextQty} now in stock`);
  return json(data);
}

// DELETE — permanently remove an ad. Only the owner may.
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const miss = dbMissing(); if (miss) return miss;
  const email = await getSessionEmail();
  if (!email) return unauthorized();
  const gate = await ownedAd(params.id, email);
  if ("error" in gate) return gate.error;

  const { error } = await supabase.from("ads").delete().eq("id", gate.ad.id);
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true });
}
