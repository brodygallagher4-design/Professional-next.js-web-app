import type { NextRequest } from "next/server";
import { supabase, getSessionEmail, notify, json, dbMissing, unauthorized } from "@/server/api";

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
  const miss = dbMissing(); if (miss) return miss;
  const email = await getSessionEmail();
  if (!email) return unauthorized();
  // Only verified sellers may list ads.
  const { data: prof } = await supabase.from("profiles").select("is_seller").eq("email", email).maybeSingle();
  if (!prof?.is_seller) return json({ error: "Only verified sellers can post ads." }, 403);
  const b = await req.json().catch(() => ({} as Record<string, unknown>));
  const title = String(b.title ?? "").trim();
  const price = Number(b.price);
  if (!title || !Number.isFinite(price) || price <= 0) return json({ error: "A valid title and price are required." }, 400);
  const { data, error } = await supabase.from("ads").insert({
    owner_email: email, title, price,
    brand: String(b.brand ?? "whatsapp").slice(0, 40),
    category: String(b.category ?? "social").slice(0, 40),
    quantity: Number.isInteger(Number(b.quantity)) ? Number(b.quantity) : 1,
    // Listings go live immediately so real accounts appear on the marketplace and
    // the seller's storefront in real time (no stuck "pending" limbo).
    status: "active",
  }).select().single();
  if (error) return json({ error: error.message }, 500);
  await notify(email, "ad", "Ad published", `Your ad "${title}" is now live on the marketplace 🎉`);
  return json(data, 201);
}
