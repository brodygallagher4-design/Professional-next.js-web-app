import { randomUUID } from "node:crypto";
import { supabase, getSessionEmail, walletBalance, notify, MERCHANT_FEE_USD, json, dbMissing, unauthorized } from "@/server/api";

export const dynamic = "force-dynamic";

// Charges the one-time merchant fee from the wallet. No free access.
export async function POST() {
  const miss = dbMissing(); if (miss) return miss;
  const email = await getSessionEmail();
  if (!email) return unauthorized();
  const { data: prof, error: perr } = await supabase.from("profiles").select("id, is_seller, merchant_id").eq("email", email).maybeSingle();
  if (perr) return json({ error: perr.message }, 500);
  if (!prof) return json({ error: "Profile not found." }, 404);
  if (prof.is_seller) {
    // Already a seller — make sure they have a stable storefront id (backfill).
    if (!prof.merchant_id) await supabase.from("profiles").update({ merchant_id: randomUUID() }).eq("id", prof.id);
    return json({ ok: true, already: true });
  }

  const balance = await walletBalance(email);
  if (balance < MERCHANT_FEE_USD) {
    return json({
      error: `A one-time $${MERCHANT_FEE_USD.toFixed(2)} merchant fee is required. Your wallet balance is $${balance.toFixed(2)} — add $${(MERCHANT_FEE_USD - balance).toFixed(2)} to continue.`,
      needs_funds: true, balance, fee: MERCHANT_FEE_USD,
    }, 402);
  }
  const { error: cerr } = await supabase.from("wallet_transactions").insert({
    owner_email: email, kind: "withdrawal", amount: MERCHANT_FEE_USD, means: "Merchant activation fee", status: "Completed",
  });
  if (cerr) return json({ error: cerr.message }, 500);
  const { error } = await supabase.from("profiles")
    .update({ is_seller: true, seller_since: new Date().toISOString(), merchant_id: prof.merchant_id ?? randomUUID() })
    .eq("id", prof.id);
  if (error) return json({ error: error.message }, 500);
  await notify(email, "seller", "Seller account activated", `Your $${MERCHANT_FEE_USD.toFixed(2)} merchant fee was received — you are now a verified SimBazaar seller 🎉`);
  return json({ ok: true, charged: MERCHANT_FEE_USD });
}
