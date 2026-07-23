import type { NextRequest } from "next/server";
import crypto from "node:crypto";
import { supabase, getSessionEmail, json, dbMissing, unauthorized, assertSameOrigin, parseBody } from "@/server/api";
import { depositSchema } from "@/server/schemas";
import { logger } from "@/server/logger";

export const dynamic = "force-dynamic";

const KORA_INITIALIZE = "https://api.korapay.com/merchant/api/v1/charges/initialize";
const KORA_RATES = "https://api.korapay.com/merchant/api/v1/conversions/rates";

// 5% processing markup: a $10 deposit charges the local-currency value of $10.50.
const FEE_RATE = 0.05;

// Fallback USD → local rates if Korapay's live rate API is briefly unreachable
// (main unit — naira/cedi/shilling/rand/franc, never subunits). Server-only, so
// the client can never dictate what it's charged.
const FALLBACK_RATES: Record<string, number> = { NGN: 1588, GHS: 15.4, KES: 129, ZAR: 18.2, XOF: 603 };

// Convert a USD amount to the local currency at Korapay's LIVE rate, falling back
// to the static table if the rate call fails. Returns the local charge amount.
async function convertUsdToLocal(usd: number, currency: string, secret: string, reference: string): Promise<{ amount: number; rate: number; live: boolean }> {
  try {
    const res = await fetch(KORA_RATES, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from_currency: "USD", to_currency: currency, amount: usd, reference }),
    });
    const j = (await res.json().catch(() => ({}))) as { status?: boolean; data?: { to_amount?: number; rate?: number } };
    if (res.ok && j?.status && j?.data?.to_amount) {
      return { amount: Math.max(1, Math.round(Number(j.data.to_amount))), rate: Number(j.data.rate) || 0, live: true };
    }
  } catch { /* fall through to static rates */ }
  const rate = FALLBACK_RATES[currency];
  return { amount: Math.max(1, Math.round(usd * rate)), rate, live: false };
}

// Start a wallet deposit: create a PENDING transaction (credited only when the
// Korapay webhook confirms) and return the hosted checkout URL to redirect to.
export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req); if (csrf) return csrf;
  const miss = dbMissing(); if (miss) return miss;
  const email = await getSessionEmail();
  if (!email) return unauthorized();

  const secret = process.env.KORAPAY_SECRET_KEY;
  if (!secret) return json({ error: "Payments aren't configured yet — please try again later." }, 503);

  const { data: b, bad } = await parseBody(req, depositSchema);
  if (bad) return bad;

  const usd = Math.round(b!.amount * 100) / 100;
  // Add the 5% markup, then convert to the local currency at Korapay's live rate.
  const usdCharged = Math.round(usd * (1 + FEE_RATE) * 100) / 100; // $10 → $10.50
  const reference = `SB-${crypto.randomUUID()}`;
  const conv = await convertUsdToLocal(usdCharged, b!.currency, secret, reference);
  const localAmount = conv.amount;

  const { data: prof } = await supabase.from("profiles").select("full_name").eq("email", email).maybeSingle();

  // Record the pending deposit. `status: "Pending"` keeps it OUT of the wallet
  // balance until the webhook flips it to "Completed". Resilient to a missing
  // `reference` column (falls back to encoding the ref in `means`).
  // `means` is what the user sees in their history — never the processor name.
  // At this point the channel (card / bank / mobile money) isn't known yet, so we
  // show the currency; the webhook refines it to the actual method on success.
  let insErr = (await supabase.from("wallet_transactions").insert({
    owner_email: email, kind: "deposit", amount: usd, means: `${b!.currency} payment`, status: "Pending", reference,
  })).error;
  if (insErr && /reference|column/i.test(insErr.message)) {
    insErr = (await supabase.from("wallet_transactions").insert({
      owner_email: email, kind: "deposit", amount: usd, means: `${b!.currency} • ${reference}`, status: "Pending",
    })).error;
  }
  if (insErr) return json({ error: insErr.message }, 500);

  const proto = (req.headers.get("x-forwarded-proto") ?? "https").split(",")[0].trim();
  const host = req.headers.get("host");
  const base = process.env.APP_URL ?? (host ? `${proto}://${host}` : "");
  // Korapay rejects non-public URLs (http / localhost). Only send redirect +
  // notification URLs when we have a real public https origin (production); on
  // localhost we omit them so the charge still initializes for UI testing (it
  // just uses the dashboard-configured webhook). The webhook lives on THIS app.
  const isPublic = /^https:\/\//.test(base) && !/localhost|127\.0\.0\.1|0\.0\.0\.0/.test(base);
  const webhookUrl = process.env.KORAPAY_WEBHOOK_URL ?? `${base}/api/webhooks/korapay`;
  const urlFields = isPublic
    ? { redirect_url: `${base}/wallet?deposit=processing`, notification_url: webhookUrl }
    : {};

  let kora: { status?: boolean; message?: string; data?: { checkout_url?: string; reference?: string } } = {};
  try {
    const res = await fetch(KORA_INITIALIZE, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: localAmount,
        currency: b!.currency,
        reference,
        customer: { email, name: prof?.full_name ?? email.split("@")[0] },
        ...urlFields,
        narration: `SimBazaar wallet top up ${Math.round(usd)} USD`,
        channels: ["card", "bank_transfer", "mobile_money"],
        metadata: { owner_email: email, usd: String(usd) },
      }),
    });
    kora = await res.json().catch(() => ({}));
    if (!res.ok || !kora?.status || !kora?.data?.checkout_url) {
      logger.error({ reference, status: res.status, localAmount, currency: b!.currency, koraBody: kora }, "korapay initialize failed");
      // Roll back the pending record so it doesn't linger.
      await supabase.from("wallet_transactions").delete().eq("reference", reference);
      return json({ error: kora?.message ?? "Could not start the payment. Please try again." }, 502);
    }
  } catch (e) {
    await supabase.from("wallet_transactions").delete().eq("reference", reference);
    logger.error({ reference, err: (e as Error).message }, "korapay initialize error");
    return json({ error: "Could not reach the payment provider. Please try again." }, 502);
  }

  logger.info({ reference, owner: email, usd, usdCharged, currency: b!.currency, localAmount, liveRate: conv.live }, "deposit initialized");
  return json({ checkout_url: kora.data!.checkout_url, reference, amount_local: localAmount, currency: b!.currency });
}
