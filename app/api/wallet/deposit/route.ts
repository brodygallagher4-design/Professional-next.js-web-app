import type { NextRequest } from "next/server";
import crypto from "node:crypto";
import { supabase, getSessionEmail, json, dbMissing, unauthorized, assertSameOrigin, parseBody } from "@/server/api";
import { depositSchema } from "@/server/schemas";
import { logger } from "@/server/logger";

export const dynamic = "force-dynamic";

const KORA_INITIALIZE = "https://api.korapay.com/merchant/api/v1/charges/initialize";

// Server-authoritative USD → local-currency rates (the client can never dictate
// what it's charged). Amounts are in each currency's MAIN unit (Korapay uses
// naira/cedi/shilling/rand/franc, not subunits).
const RATES: Record<string, number> = { NGN: 1588, GHS: 15.4, KES: 129, ZAR: 18.2, XOF: 603 };

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
  const rate = RATES[b!.currency];
  const localAmount = Math.max(1, Math.round(usd * rate));
  const reference = `SB-${crypto.randomUUID()}`;

  const { data: prof } = await supabase.from("profiles").select("full_name").eq("email", email).maybeSingle();

  // Record the pending deposit. `status: "Pending"` keeps it OUT of the wallet
  // balance until the webhook flips it to "Completed". Resilient to a missing
  // `reference` column (falls back to encoding the ref in `means`).
  let insErr = (await supabase.from("wallet_transactions").insert({
    owner_email: email, kind: "deposit", amount: usd, means: `Korapay ${b!.currency} deposit`, status: "Pending", reference,
  })).error;
  if (insErr && /reference|column/i.test(insErr.message)) {
    insErr = (await supabase.from("wallet_transactions").insert({
      owner_email: email, kind: "deposit", amount: usd, means: `Korapay ${b!.currency} • ${reference}`, status: "Pending",
    })).error;
  }
  if (insErr) return json({ error: insErr.message }, 500);

  const proto = (req.headers.get("x-forwarded-proto") ?? "https").split(",")[0].trim();
  const host = req.headers.get("host");
  const base = process.env.APP_URL ?? (host ? `${proto}://${host}` : "");
  // The webhook lives on THIS app — target its own domain so Korapay always calls
  // the handler that credits SimBazaar wallets (overridable via env if needed).
  const webhookUrl = process.env.KORAPAY_WEBHOOK_URL ?? `${base}/api/webhooks/korapay`;

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
        redirect_url: `${base}/wallet?deposit=processing`,
        notification_url: webhookUrl,
        narration: `SimBazaar wallet top-up ($${usd.toFixed(2)})`,
        channels: ["card", "bank_transfer", "mobile_money"],
        metadata: { owner_email: email, usd: String(usd) },
      }),
    });
    kora = await res.json().catch(() => ({}));
    if (!res.ok || !kora?.status || !kora?.data?.checkout_url) {
      logger.error({ reference, status: res.status, message: kora?.message }, "korapay initialize failed");
      // Roll back the pending record so it doesn't linger.
      await supabase.from("wallet_transactions").delete().eq("reference", reference);
      return json({ error: kora?.message ?? "Could not start the payment. Please try again." }, 502);
    }
  } catch (e) {
    await supabase.from("wallet_transactions").delete().eq("reference", reference);
    logger.error({ reference, err: (e as Error).message }, "korapay initialize error");
    return json({ error: "Could not reach the payment provider. Please try again." }, 502);
  }

  logger.info({ reference, owner: email, usd, currency: b!.currency, localAmount }, "deposit initialized");
  return json({ checkout_url: kora.data!.checkout_url, reference });
}
