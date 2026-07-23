import type { NextRequest } from "next/server";
import { supabase, json, dbMissing } from "@/server/api";
import { verifyHeleketWebhook } from "@/server/heleket";
import { logger } from "@/server/logger";

export const dynamic = "force-dynamic";

// Heleket crypto webhook. Auth is the `sign` inside the body (Heleket calls this
// cross-origin, so no same-origin/session check). Flow:
//   1. Verify sign = md5( base64(body without sign) + API_KEY ).
//   2. On a paid status, attribute the deposit to its wallet's owner.
//   3. Credit the wallet exactly once, keyed on the payment uuid/txid.
export async function POST(req: NextRequest) {
  const miss = dbMissing(); if (miss) return miss;
  const apiKey = process.env.HELEKET_API_KEY;
  if (!apiKey) return json({ error: "Not configured." }, 503);

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return json({ error: "Invalid payload." }, 400);

  if (!verifyHeleketWebhook(body, apiKey)) {
    logger.warn({ order_id: body.order_id }, "heleket webhook: invalid signature");
    return json({ error: "Invalid signature." }, 401);
  }

  const status = String(body.status ?? "").toLowerCase();
  // "paid" = exact, "paid_over" = customer sent more than requested. Both credit.
  if (status !== "paid" && status !== "paid_over") return json({ status: true });

  const orderId = String(body.order_id ?? "").trim();
  const uuid = String(body.uuid ?? "").trim();
  const address = String(body.address ?? body.wallet_address ?? "").trim();

  // Attribute to the wallet that received the funds (order_id → uuid → address).
  let owner: string | null = null;
  let label = "Crypto";
  for (const [col, val] of [["order_id", orderId], ["provider_uuid", uuid], ["address", address]] as const) {
    if (!val) continue;
    const { data } = await supabase.from("crypto_wallets").select("owner_email, label").eq(col, val).maybeSingle();
    if (data?.owner_email) { owner = data.owner_email; label = data.label ?? label; break; }
  }
  if (!owner) { logger.warn({ orderId, uuid, address }, "heleket webhook: no matching wallet"); return json({ status: true }); }

  // Credit the USD value Heleket reports (paid → merchant, after network fees).
  const usd = Number(body.payment_amount_usd ?? body.merchant_amount ?? body.amount_usd ?? body.amount ?? 0);
  if (!Number.isFinite(usd) || usd <= 0) { logger.warn({ orderId }, "heleket webhook: non-positive usd"); return json({ status: true }); }

  // Idempotency key: the payment's own id. A retried webhook hits the unique
  // `reference` index and inserts nothing, so funds are credited exactly once.
  const reference = `HK-${uuid || body.txid || orderId}`;
  const { data: exists } = await supabase.from("wallet_transactions").select("id").eq("reference", reference).maybeSingle();
  if (exists) return json({ status: true });

  const { error } = await supabase.from("wallet_transactions").insert({
    owner_email: owner, kind: "deposit", amount: Math.round(usd * 100) / 100,
    means: `${label} deposit`, status: "Completed", reference,
  });
  if (error && !/duplicate|unique/i.test(error.message)) {
    logger.error({ reference, err: error.message }, "heleket webhook: credit insert failed");
    return json({ status: true });
  }
  logger.info({ reference, owner, usd }, "crypto deposit credited");
  return json({ status: true });
}
