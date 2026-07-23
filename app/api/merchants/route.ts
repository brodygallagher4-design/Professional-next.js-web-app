import { supabase, getSessionEmail, json, dbMissing } from "@/server/api";

export const dynamic = "force-dynamic";

// Top Merchants = the platform's REAL verified sellers (is_seller profiles), with
// live-computed stats (completed sales + active listings). No seeded/demo
// merchants — a name only appears here if that seller actually exists.
export async function GET() {
  const miss = dbMissing(); if (miss) return miss;

  const { data: sellers, error } = await supabase
    .from("profiles").select("*").eq("is_seller", true);
  if (error) return json({ error: error.message }, 500);
  if (!sellers || sellers.length === 0) return json([]);

  // Count active ads per seller and completed sales per seller in two reads.
  const { data: ads } = await supabase.from("ads").select("owner_email, status");
  const { data: purch } = await supabase.from("purchases").select("seller_email, status");
  const activeAds = new Map<string, number>();
  for (const a of ads ?? []) if (a.status === "active" && a.owner_email) activeAds.set(a.owner_email, (activeAds.get(a.owner_email) ?? 0) + 1);
  const sales = new Map<string, number>();
  for (const p of purch ?? []) if (String(p.status).toLowerCase() === "completed" && p.seller_email) sales.set(p.seller_email, (sales.get(p.seller_email) ?? 0) + 1);
  // Active statuses per seller (id + owner) — for the story ring and its
  // viewed/unviewed state relative to the current viewer.
  const { data: statuses } = await supabase.from("seller_status").select("id, owner_email").gt("expires_at", new Date().toISOString());
  const statusByOwner = new Map<string, number[]>();
  for (const s of statuses ?? []) { if (!s.owner_email) continue; const l = statusByOwner.get(s.owner_email) ?? []; l.push(s.id); statusByOwner.set(s.owner_email, l); }

  // What the current viewer has already seen (so the ring can go grey).
  const viewer = await getSessionEmail();
  const seen = new Set<number>();
  if (viewer && (statuses ?? []).length) {
    const { data: views } = await supabase.from("status_views")
      .select("status_id").eq("viewer_email", viewer).in("status_id", (statuses ?? []).map((s) => s.id));
    for (const v of views ?? []) seen.add(v.status_id);
  }

  const merchants = sellers.map((s) => {
    const sold = sales.get(s.email) ?? 0;
    return {
      id: s.id,
      merchant_id: s.merchant_id ?? null,
      name: s.full_name ?? String(s.email ?? "").split("@")[0] ?? "Seller",
      rating: 5,
      sales: sold,
      success_rate: 100,
      avatar_url: s.avatar_url ?? null,
      hot: sold >= 10,
      location: s.country ?? s.state ?? null,
      joined: s.seller_since ?? s.joined ?? null,
      bio: s.bio ?? null,
      active_ads: activeAds.get(s.email) ?? 0,
      has_status: (statusByOwner.get(s.email) ?? []).length > 0,
      status_unviewed: (statusByOwner.get(s.email) ?? []).some((id) => !seen.has(id)),
    };
  }).sort((a, b) => b.sales - a.sales || b.active_ads - a.active_ads);

  return json(merchants);
}
