import { randomUUID } from "node:crypto";
import { supabase, json, dbMissing } from "@/server/api";

export const dynamic = "force-dynamic";

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

// Public storefront resolver. Resolves a seller by their stable merchant_id, a
// numeric/uuid id, or a legacy name-slug — checking the seeded `merchants` table
// first, then real sellers in `profiles` (is_seller). Returns storefront identity
// + the seller's real live ads + computed stats. This is what makes a shared
// /seller/<id> link open the correct storefront on a cold page load.
export async function GET(_req: Request, { params }: { params: { merchantId: string } }) {
  const miss = dbMissing(); if (miss) return miss;
  const key = decodeURIComponent(params.merchantId ?? "").trim();
  if (!key) return json({ error: "Missing storefront id." }, 400);

  // 1) Seeded merchants table (curated top merchants).
  let seeded = (await supabase.from("merchants").select("*").eq("merchant_id", key).maybeSingle()).data;
  if (!seeded && /^\d+$/.test(key)) {
    seeded = (await supabase.from("merchants").select("*").eq("id", Number(key)).maybeSingle()).data;
  }

  // 2) Real seller in profiles (the source of truth for activated sellers).
  //    profiles.merchant_id is a uuid; only look it up when the key is a uuid.
  let prof = isUuid(key)
    ? (await supabase.from("profiles").select("*").eq("merchant_id", key).eq("is_seller", true).maybeSingle()).data
    : null;
  if (!prof && !seeded) {
    // Legacy name-slug link — match against verified sellers.
    const { data: sellers } = await supabase.from("profiles").select("*").eq("is_seller", true);
    prof = (sellers ?? []).find((p) => slugify(String(p.full_name ?? "")) === key) ?? null;
  }

  if (!prof && !seeded) return json({ error: "Store not found." }, 404);

  // Resolve the seller's email + a stable merchant_id (backfill if missing).
  const email: string | undefined = prof?.email ?? undefined;
  let merchantId: string = prof?.merchant_id ?? seeded?.merchant_id ?? "";
  if (prof && !prof.merchant_id) {
    merchantId = randomUUID();
    await supabase.from("profiles").update({ merchant_id: merchantId }).eq("id", prof.id);
  }

  // Real ads for this seller (live listings only — never rejected/hidden).
  let ads: Record<string, unknown>[] = [];
  if (email) {
    const { data } = await supabase.from("ads").select("*")
      .eq("owner_email", email).eq("status", "active").order("created_at", { ascending: false });
    ads = data ?? [];
  }

  // Real "total sold" = completed orders placed against this seller.
  let sales = seeded?.sales ?? 0;
  if (email) {
    const { count } = await supabase.from("purchases").select("id", { count: "exact", head: true })
      .eq("seller_email", email).eq("status", "Completed");
    sales = count ?? 0;
  }

  const merchant = {
    id: prof?.id ?? seeded?.id ?? merchantId,
    merchant_id: merchantId,
    name: prof ? String(prof.full_name ?? email?.split("@")[0] ?? "Seller") : seeded!.name,
    rating: seeded?.rating ?? 5,
    sales,
    success_rate: seeded?.success_rate ?? 100,
    avatar_url: prof?.avatar_url ?? seeded?.avatar_url ?? null,
    hot: seeded?.hot ?? false,
    location: prof?.country ?? prof?.state ?? seeded?.location ?? null,
    joined: prof?.seller_since ?? prof?.joined ?? seeded?.joined ?? null,
    bio: prof?.bio ?? seeded?.bio ?? null,
    active_ads: ads.length,
    ads: ads.map((a) => ({
      id: a.id,
      title: a.title,
      price: a.price,
      brand: a.brand ?? "whatsapp",
      category: a.category ?? "social",
      quantity: a.quantity ?? 1,
      status: a.status ?? "active",
    })),
  };

  return json(merchant);
}
