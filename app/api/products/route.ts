import { supabase, json, dbMissing } from "@/server/api";

export const dynamic = "force-dynamic";

// The marketplace catalogue is the sellers' REAL live listings — every active ad
// from the `ads` table, resolved with its seller's display name. No demo/seed
// data: an empty marketplace means no live listings yet.
export async function GET() {
  const miss = dbMissing(); if (miss) return miss;

  const { data: ads, error } = await supabase
    .from("ads").select("*").eq("status", "active").order("created_at", { ascending: false });
  if (error) return json({ error: error.message }, 500);

  // Resolve seller display names (owner_email → full_name) in one query.
  const emails = [...new Set((ads ?? []).map((a) => a.owner_email).filter(Boolean))];
  const nameByEmail = new Map<string, string>();
  if (emails.length) {
    const { data: profs } = await supabase.from("profiles").select("email, full_name").in("email", emails);
    for (const p of profs ?? []) nameByEmail.set(p.email, p.full_name);
  }

  const products = (ads ?? []).map((a) => ({
    id: a.id,
    title: a.title,
    brand: a.brand ?? "whatsapp",
    category: a.category ?? "social",
    seller: nameByEmail.get(a.owner_email) ?? String(a.owner_email ?? "").split("@")[0] ?? "Seller",
    price: Number(a.price) || 0,
    rating: 5,
    available: a.quantity ?? 1,
    badge: "flash",
    preview_url: null,
  }));
  return json(products);
}
