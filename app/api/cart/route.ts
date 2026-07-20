import type { NextRequest } from "next/server";
import { supabase, getSessionEmail, json, dbMissing, unauthorized } from "@/server/api";

export const dynamic = "force-dynamic";

export async function GET() {
  const miss = dbMissing(); if (miss) return miss;
  const email = await getSessionEmail();
  if (!email) return unauthorized();
  const { data, error } = await supabase.from("cart_items").select("*").eq("owner_email", email).order("created_at", { ascending: false });
  if (error) return json({ error: error.message }, 500);
  return json(data);
}

export async function POST(req: NextRequest) {
  const miss = dbMissing(); if (miss) return miss;
  const email = await getSessionEmail();
  if (!email) return unauthorized();
  const b = await req.json().catch(() => ({} as Record<string, unknown>));
  const title = String(b.title ?? "").trim();
  const price = Number(b.price);
  if (!title || !Number.isFinite(price) || price <= 0) return json({ error: "A valid title and price are required." }, 400);
  const { data, error } = await supabase.from("cart_items").insert({
    owner_email: email, title, price,
    description: String(b.description ?? "").slice(0, 500),
    brand: String(b.brand ?? "whatsapp").slice(0, 40),
    seller: String(b.seller ?? "Seller").slice(0, 80),
  }).select().single();
  if (error) return json({ error: error.message }, 500);
  return json(data, 201);
}
