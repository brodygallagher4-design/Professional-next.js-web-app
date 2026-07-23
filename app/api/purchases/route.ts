import type { NextRequest } from "next/server";
import { supabase, getSessionEmail, walletBalance, notify, PLATFORM_FEE_RATE, json, dbMissing, unauthorized, assertSameOrigin } from "@/server/api";
import { logger } from "@/server/logger";

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
  const csrf = assertSameOrigin(req); if (csrf) return csrf;
  const miss = dbMissing(); if (miss) return miss;
  const email = await getSessionEmail();
  if (!email) return unauthorized();
  const b = await req.json().catch(() => ({} as Record<string, unknown>));
  const productId = Number.isInteger(Number(b.product_id)) ? Number(b.product_id) : null;

  let title: string, price: number, sellerName: string, glyph: string, description: string, productType: string;
  let adRow: { id: number; owner_email: string; quantity: number; title: string } | null = null;
  if (productId) {
    // The marketplace catalogue is real seller ads — resolve the listing there.
    const { data: ad } = await supabase.from("ads").select("*").eq("id", productId).maybeSingle();
    if (!ad) return json({ error: "That product is no longer available." }, 404);
    if ((Number(ad.quantity) || 0) <= 0) return json({ error: "That product is out of stock." }, 409);
    const { data: ownerProf } = ad.owner_email
      ? await supabase.from("profiles").select("full_name").eq("email", ad.owner_email).maybeSingle()
      : { data: null };
    title = ad.title; price = Number(ad.price);
    sellerName = ownerProf?.full_name ?? String(ad.owner_email ?? "").split("@")[0] ?? "Seller";
    glyph = ["whatsapp", "voice", "facebook"].includes(String(b.glyph)) ? String(b.glyph) : "whatsapp";
    description = String(b.description ?? "").slice(0, 500);
    productType = ad.brand ? String(ad.brand).charAt(0).toUpperCase() + String(ad.brand).slice(1) : "Account";
    adRow = { id: ad.id, owner_email: ad.owner_email, quantity: Number(ad.quantity) || 0, title: ad.title };
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

  // Auto-deliver: consume ONE unsold credential for this ad and hand it to the
  // buyer. `.eq("sold", false)` on the update makes the claim atomic so the same
  // account can't be sold twice. Legacy ads with no credentials fall back to the
  // trade-chat delivery note.
  let delivered: { login: string; password: string; email: string; email_pass: string; preview_link: string; notes: string } | null = null;
  if (adRow) {
    const { data: cred } = await supabase.from("ad_credentials")
      .select("*").eq("ad_id", adRow.id).eq("sold", false).order("created_at", { ascending: true }).limit(1).maybeSingle();
    if (cred) {
      const { data: claimed } = await supabase.from("ad_credentials")
        .update({ sold: true, buyer_email: email }).eq("id", cred.id).eq("sold", false).select().single();
      if (claimed) delivered = claimed as typeof delivered;
    }
  }
  const deliveryNote = delivered
    ? ["Your account details:", `Login: ${delivered.login}`, `Password: ${delivered.password}`,
       delivered.email ? `Email: ${delivered.email}` : "", delivered.email_pass ? `Email password: ${delivered.email_pass}` : "",
       delivered.preview_link ? `Preview: ${delivered.preview_link}` : "", delivered.notes ? `Notes: ${delivered.notes}` : ""].filter(Boolean).join("\n")
    : "Your access details will be shared by the seller in the trade chat.";

  const row = {
    title, buyer: buyerProf?.full_name ?? "Buyer", buyer_email: email, seller_email: sellerProf?.email ?? null,
    // Orders open in ESCROW: held as "pending" for a 1-hour window. The buyer's
    // funds are debited now but the seller is NOT paid until the order completes
    // (buyer confirms) — and are refunded in full if the buyer cancels.
    glyph, description, product_type: productType, seller: sellerName, price, status: "pending",
    username: delivered?.login ?? null, password: delivered?.password ?? null,
    note: deliveryNote,
    note_time: new Date().toLocaleString([], { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" }),
  };
  const { data, error } = await supabase.from("purchases").insert(row).select().single();
  if (error) { logger.error({ err: error.message, buyer: email }, "purchase insert failed"); return json({ error: error.message }, 500); }
  logger.info({ orderId: data.id, buyer: email, seller: sellerName, price, escrow: true }, "order placed");

  // Debit the buyer now — the money moves into escrow (held by the platform).
  await supabase.from("wallet_transactions").insert({
    owner_email: email, kind: "withdrawal", amount: +price.toFixed(2), means: `Escrow: ${title}`.slice(0, 60), status: "Completed",
  });
  if (adRow) {
    // Credential-backed ads track stock by unsold credentials; legacy ads by count.
    const { count: totalCreds } = await supabase.from("ad_credentials").select("id", { count: "exact", head: true }).eq("ad_id", adRow.id);
    let remaining: number;
    if ((totalCreds ?? 0) > 0) {
      const { count: unsold } = await supabase.from("ad_credentials").select("id", { count: "exact", head: true }).eq("ad_id", adRow.id).eq("sold", false);
      remaining = unsold ?? 0;
    } else {
      remaining = Math.max(0, adRow.quantity - 1);
    }
    await supabase.from("ads").update({ quantity: remaining }).eq("id", adRow.id);
    // Tell the seller the moment a listing runs out of stock so they can restock.
    if (remaining === 0 && adRow.owner_email) {
      await notify(adRow.owner_email, "ad", "Out of stock", `"${adRow.title}" just sold out — add stock from My Ads to keep selling.`);
    }
  }
  await notify(email, "order", "Order placed", `Your order for "${row.title}" is in escrow. Confirm it once you're satisfied, or cancel for a refund.`);
  if (sellerProf?.email) await notify(sellerProf.email, "order", "New order", `You received an order for "${row.title}" ($${price.toFixed(2)}) — deliver it in the trade chat.`);
  return json(data, 201);
}
