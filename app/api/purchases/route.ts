import type { NextRequest } from "next/server";
import { supabase, getSessionEmail, walletBalance, notify, PLATFORM_FEE_RATE, json, dbMissing, unauthorized } from "@/server/api";

export const dynamic = "force-dynamic";

// Buyers see what they bought (?role=buyer, default); sellers see orders placed
// against them (?role=seller). A user never sees another account's orders.
export async function GET(req: NextRequest) {
  const miss = dbMissing(); if (miss) return miss;
  const email = await getSessionEmail();
  if (!email) return unauthorized();
  const role = req.nextUrl.searchParams.get("role") === "seller" ? "seller_email" : "buyer_email";
  const { data, error } = await supabase.from("purchases").select("*").eq(role, email).order("created_at", { ascending: false });
  if (error) return json({ error: error.message }, 500);
  return json(data);
}

export async function POST(req: NextRequest) {
  const miss = dbMissing(); if (miss) return miss;
  const email = await getSessionEmail();
  if (!email) return unauthorized();
  const b = await req.json().catch(() => ({} as Record<string, unknown>));
  const productId = Number.isInteger(Number(b.product_id)) ? Number(b.product_id) : null;

  let title: string, price: number, sellerName: string, glyph: string, description: string, productType: string;
  if (productId) {
    const { data: prod } = await supabase.from("products").select("*").eq("id", productId).maybeSingle();
    if (!prod) return json({ error: "That product is no longer available." }, 404);
    if (prod.available <= 0) return json({ error: "That product is out of stock." }, 409);
    title = prod.title; price = Number(prod.price); sellerName = prod.seller;
    glyph = ["whatsapp", "voice", "facebook"].includes(String(b.glyph)) ? String(b.glyph) : "whatsapp";
    description = String(b.description ?? "").slice(0, 500);
    productType = prod.brand ? prod.brand.charAt(0).toUpperCase() + prod.brand.slice(1) : "Account";
  } else {
    title = String(b.title ?? "").trim();
    price = Number(b.price);
    sellerName = String(b.seller ?? "Seller").slice(0, 80);
    glyph = ["whatsapp", "voice", "facebook"].includes(String(b.glyph)) ? String(b.glyph) : "whatsapp";
    description = String(b.description ?? "").slice(0, 500);
    productType = String(b.product_type ?? "Account").slice(0, 60);
  }
  if (!title || !Number.isFinite(price) || price <= 0) return json({ error: "A valid title and price are required." }, 400);

  const balance = await walletBalance(email);
  if (balance < price) {
    return json({
      error: `Insufficient wallet balance. This costs $${price.toFixed(2)} and your balance is $${balance.toFixed(2)}. Add $${(price - balance).toFixed(2)} to continue.`,
      needs_funds: true, balance, price,
    }, 402);
  }

  const { data: buyerProf } = await supabase.from("profiles").select("full_name").eq("email", email).maybeSingle();
  const { data: sellerProf } = await supabase.from("profiles").select("email").eq("full_name", sellerName).maybeSingle();
  const row = {
    title, buyer: buyerProf?.full_name ?? "Buyer", buyer_email: email, seller_email: sellerProf?.email ?? null,
    glyph, description, product_type: productType, seller: sellerName, price, status: "completed",
    note: "Your access details will be shared by the seller in the trade chat.",
    note_time: new Date().toLocaleString([], { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" }),
  };
  const { data, error } = await supabase.from("purchases").insert(row).select().single();
  if (error) return json({ error: error.message }, 500);

  await supabase.from("wallet_transactions").insert({
    owner_email: email, kind: "withdrawal", amount: +price.toFixed(2), means: `Purchase: ${title}`.slice(0, 60), status: "Completed",
  });
  if (sellerProf?.email) {
    const payout = +(price * (1 - PLATFORM_FEE_RATE)).toFixed(2);
    await supabase.from("wallet_transactions").insert({
      owner_email: sellerProf.email, kind: "deposit", amount: payout, means: `Sale: ${title}`.slice(0, 60), status: "Completed",
    });
  }
  if (productId) {
    const { data: prod } = await supabase.from("products").select("available").eq("id", productId).maybeSingle();
    if (prod) await supabase.from("products").update({ available: Math.max(0, prod.available - 1) }).eq("id", productId);
  }
  await notify(email, "order", "Order Completed", `Your order for "${row.title}" is Completed`);
  if (sellerProf?.email) await notify(sellerProf.email, "order", "New sale", `You sold "${row.title}" for $${price.toFixed(2)}`);
  return json(data, 201);
}
