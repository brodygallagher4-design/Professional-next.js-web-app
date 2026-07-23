import type { NextRequest } from "next/server";
import { supabase, getSessionEmail, notify, json, dbMissing, unauthorized, assertSameOrigin, parseBody } from "@/server/api";
import { adSchema } from "@/server/schemas";

export const dynamic = "force-dynamic";

// A seller's own listings.
export async function GET() {
  const miss = dbMissing(); if (miss) return miss;
  const email = await getSessionEmail();
  if (!email) return unauthorized();
  const { data, error } = await supabase.from("ads").select("*").eq("owner_email", email).order("created_at", { ascending: false });
  if (error) return json({ error: error.message }, 500);
  return json(data);
}

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req); if (csrf) return csrf;
  const miss = dbMissing(); if (miss) return miss;
  const email = await getSessionEmail();
  if (!email) return unauthorized();
  // Only verified sellers may list ads.
  const { data: prof } = await supabase.from("profiles").select("is_seller").eq("email", email).maybeSingle();
  if (!prof?.is_seller) return json({ error: "Only verified sellers can post ads." }, 403);
  const { data: b, bad } = await parseBody(req, adSchema);
  if (bad) return bad;
  const description = (b!.description ?? "").slice(0, 1000).trim();
  const baseRow = {
    owner_email: email, title: b!.title, price: b!.price,
    brand: b!.brand.slice(0, 40),
    category: b!.category.slice(0, 40),
    quantity: b!.quantity,
    // Listings go live immediately so real accounts appear on the marketplace and
    // the seller's storefront in real time (no stuck "pending" limbo).
    status: "active",
  };
  // Store the seller's description. If the `description` column hasn't been added
  // to the ads table yet, Postgres rejects the unknown column — fall back to an
  // insert without it so listing never breaks. (Add the column to persist it:
  //   ALTER TABLE ads ADD COLUMN description text;)
  let { data, error } = await supabase.from("ads").insert({ ...baseRow, description }).select().single();
  if (error && /description/i.test(error.message)) {
    ({ data, error } = await supabase.from("ads").insert(baseRow).select().single());
  }
  if (error) return json({ error: error.message }, 500);
  await notify(email, "ad", "Ad published", `Your ad "${b!.title}" is now live on the marketplace 🎉`);
  return json(data, 201);
}
