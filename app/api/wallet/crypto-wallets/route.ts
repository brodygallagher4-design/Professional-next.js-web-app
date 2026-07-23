import type { NextRequest } from "next/server";
import crypto from "node:crypto";
import { supabase, getSessionEmail, json, dbMissing, unauthorized, assertSameOrigin, parseBody, rateLimitDb, clientIp } from "@/server/api";
import { createWalletSchema, CRYPTO_ASSETS } from "@/server/schemas";
import { createStaticWallet, heleketConfigured } from "@/server/heleket";
import { logger } from "@/server/logger";

export const dynamic = "force-dynamic";

// GET — the caller's static wallets (address is safe to expose to its owner).
export async function GET() {
  const miss = dbMissing(); if (miss) return miss;
  const email = await getSessionEmail();
  if (!email) return unauthorized();
  const { data, error } = await supabase.from("crypto_wallets")
    .select("id, asset, currency, network, label, address, created_at")
    .eq("owner_email", email).order("created_at", { ascending: true });
  if (error) return json({ error: error.message }, 500);
  return json({ wallets: data ?? [], configured: heleketConfigured() });
}

// POST — generate (or return the existing) static wallet for one asset.
export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req); if (csrf) return csrf;
  const miss = dbMissing(); if (miss) return miss;
  const email = await getSessionEmail();
  if (!email) return unauthorized();

  if (!heleketConfigured()) return json({ error: "Crypto payments aren't configured yet — please try again later." }, 503);
  // Guard the provider from abuse: a handful of wallet creations per minute.
  if (!(await rateLimitDb(`cryptowallet:${email}:${clientIp(req)}`, 12, 60_000)))
    return json({ error: "Too many requests. Please wait a moment and try again." }, 429);

  const { data: b, bad } = await parseBody(req, createWalletSchema);
  if (bad) return bad;

  const meta = CRYPTO_ASSETS.find((a) => a.id === b!.asset)!;

  // Idempotent: if this user already has this asset's wallet, return it as-is.
  const { data: existing } = await supabase.from("crypto_wallets")
    .select("id, asset, currency, network, label, address, created_at")
    .eq("owner_email", email).eq("asset", meta.id).maybeSingle();
  if (existing) return json({ wallet: existing, existed: true });

  const orderId = `CW-${crypto.randomUUID()}`;
  const proto = (req.headers.get("x-forwarded-proto") ?? "https").split(",")[0].trim();
  const host = req.headers.get("host");
  const base = process.env.APP_URL ?? (host ? `${proto}://${host}` : "");
  const isPublic = /^https:\/\//.test(base) && !/localhost|127\.0\.0\.1|0\.0\.0\.0/.test(base);
  const callbackUrl = process.env.HELEKET_WEBHOOK_URL ?? (isPublic ? `${base}/api/webhooks/heleket` : undefined);

  const created = await createStaticWallet({ currency: meta.currency, network: meta.network, orderId, callbackUrl });
  if (!created.ok || !created.wallet) {
    logger.error({ owner: email, asset: meta.id, status: created.status }, "heleket wallet create failed");
    return json({ error: created.error ?? "Could not create the wallet. Please try again." }, created.status ?? 502);
  }

  const row = {
    owner_email: email, asset: meta.id, currency: meta.currency, network: meta.network,
    label: meta.label, address: created.wallet.address, provider_uuid: created.wallet.uuid, order_id: orderId,
  };
  const { data: saved, error: insErr } = await supabase.from("crypto_wallets").insert(row)
    .select("id, asset, currency, network, label, address, created_at").maybeSingle();
  if (insErr) {
    // Lost a race (unique key) — return whatever now exists for this asset.
    const { data: race } = await supabase.from("crypto_wallets")
      .select("id, asset, currency, network, label, address, created_at")
      .eq("owner_email", email).eq("asset", meta.id).maybeSingle();
    if (race) return json({ wallet: race, existed: true });
    return json({ error: insErr.message }, 500);
  }
  logger.info({ owner: email, asset: meta.id }, "heleket static wallet created");
  return json({ wallet: saved });
}
