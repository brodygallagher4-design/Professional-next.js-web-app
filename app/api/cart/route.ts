import type { NextRequest } from "next/server";
import { supabase, getSessionEmail, json, dbMissing, unauthorized, assertSameOrigin, parseBody } from "@/server/api";
import { cartItemSchema } from "@/server/schemas";

export const dynamic = "force-dynamic";

export async function GET() {
  const miss = dbMissing(); if (miss) return miss;
  const email = await getSessionEmail();
  if (!email) return unauthorized();
  const { data, error } = await supabase.from("cart_items").select("*").eq("owner_email", email).order("created_at", { ascending: false });
  if (error) return json({ error: error.message }, 500);

  // Attach each seller's real profile avatar so the cart can show the seller's
  // photo (matching the marketplace). `seller` is the seller's display name; look
  // up the matching profiles in one read and map name → avatar_url.
  const rows = data ?? [];
  const names = Array.from(new Set(rows.map((r) => r.seller).filter(Boolean)));
  const avatarByName = new Map<string, string | null>();
  if (names.length) {
    const { data: profs } = await supabase.from("profiles").select("full_name, avatar_url").in("full_name", names);
    for (const p of profs ?? []) avatarByName.set(p.full_name, p.avatar_url ?? null);
  }
  const enriched = rows.map((r) => ({ ...r, seller_avatar: avatarByName.get(r.seller) ?? null }));
  return json(enriched);
}

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req); if (csrf) return csrf;
  const miss = dbMissing(); if (miss) return miss;
  const email = await getSessionEmail();
  if (!email) return unauthorized();
  const { data: b, bad } = await parseBody(req, cartItemSchema);
  if (bad) return bad;
  const { data, error } = await supabase.from("cart_items").insert({
    owner_email: email, title: b!.title, price: b!.price,
    description: (b!.description ?? "").slice(0, 500),
    brand: (b!.brand ?? "whatsapp").slice(0, 40),
    seller: (b!.seller ?? "Seller").slice(0, 80),
  }).select().single();
  if (error) return json({ error: error.message }, 500);
  return json(data, 201);
}
