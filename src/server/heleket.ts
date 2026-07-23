// ─── Heleket crypto payment gateway client ───────────────────────────────────
// Heleket (heleket.com) issues per-user *static* deposit wallets: a fixed address
// for a given currency/network that credits the merchant whenever crypto lands on
// it. Auth is a signed request: sign = md5( base64(jsonBody) + API_KEY ), sent in
// the `sign` header alongside the `merchant` id. The same scheme verifies inbound
// webhooks. Server-only — the API key never reaches the browser.

import crypto from "node:crypto";

const HELEKET_BASE = "https://api.heleket.com/v1";

export const heleketConfigured = () =>
  Boolean(process.env.HELEKET_MERCHANT_ID && process.env.HELEKET_API_KEY);

// Heleket signs the *exact* JSON string it receives, so we sign that same string
// and send it as the body (never re-serialize between signing and sending).
export function heleketSign(rawBody: string, apiKey: string): string {
  const payload = Buffer.from(rawBody, "utf8").toString("base64");
  return crypto.createHash("md5").update(payload + apiKey).digest("hex");
}

// Verify an inbound webhook: the body carries its own `sign`; recompute it over
// the body with `sign` removed and compare timing-safely.
export function verifyHeleketWebhook(body: Record<string, unknown>, apiKey: string): boolean {
  const provided = String(body.sign ?? "");
  if (!provided) return false;
  const rest: Record<string, unknown> = { ...body };
  delete rest.sign;
  // Heleket signs the JSON with slashes unescaped (PHP JSON_UNESCAPED_SLASHES).
  const raw = JSON.stringify(rest).replace(/\//g, "\\/");
  const expected = heleketSign(raw, apiKey);
  const a = Buffer.from(provided), e = Buffer.from(expected);
  if (a.length !== e.length) return false;
  return crypto.timingSafeEqual(a, e);
}

export interface HeleketWallet { address: string; uuid: string; network: string; currency: string; url?: string; }

// Create (or fetch) a static wallet for a currency/network. `orderId` ties the
// wallet to our user so webhooks can be attributed. Returns a flat result shape
// so callers can branch on `.ok` without discriminated-union narrowing.
export async function createStaticWallet(params: {
  currency: string; network: string; orderId: string; callbackUrl?: string;
}): Promise<{ ok: true; wallet: HeleketWallet } | { ok: false; error: string; status: number }> {
  const merchant = process.env.HELEKET_MERCHANT_ID;
  const apiKey = process.env.HELEKET_API_KEY;
  if (!merchant || !apiKey) return { ok: false, error: "Crypto payments aren't configured yet.", status: 503 };

  const bodyObj: Record<string, unknown> = {
    currency: params.currency,
    network: params.network,
    order_id: params.orderId,
  };
  if (params.callbackUrl) bodyObj.url_callback = params.callbackUrl;
  const raw = JSON.stringify(bodyObj);

  try {
    const res = await fetch(`${HELEKET_BASE}/wallet`, {
      method: "POST",
      headers: { merchant, sign: heleketSign(raw, apiKey), "Content-Type": "application/json" },
      body: raw,
    });
    const j = (await res.json().catch(() => ({}))) as { result?: Record<string, unknown>; message?: string; errors?: unknown };
    const r = j?.result;
    if (!res.ok || !r?.address) {
      return { ok: false, error: (j?.message as string) ?? "Could not create the wallet. Please try again.", status: 502 };
    }
    return {
      ok: true,
      wallet: {
        address: String(r.address),
        uuid: String(r.wallet_uuid ?? r.uuid ?? ""),
        network: String(r.network ?? params.network),
        currency: String(r.currency ?? params.currency),
        url: r.url ? String(r.url) : undefined,
      },
    };
  } catch {
    return { ok: false, error: "Could not reach the crypto provider. Please try again.", status: 502 };
  }
}
