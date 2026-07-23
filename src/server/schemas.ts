// ─── Request validation schemas (Zod) ────────────────────────────────────────
// Every state-changing endpoint validates its body against a typed schema before
// any logic runs — the professional-stack pattern: one source of truth for shape,
// types, and limits, with clear 400 errors instead of ad-hoc `String(b.x)` casts.

import { z } from "zod";

// Pure Zod schemas (no server imports) so they're trivially unit-testable. The
// `parseBody` helper that turns a failure into an HTTP 400 lives in ./api.

const priceField = z.coerce.number().finite().positive("A valid price is required.").max(1_000_000);
const shortText = (max: number, label = "text") => z.string().trim().max(max, `${label} is too long.`);

export const cartItemSchema = z.object({
  title: z.string().trim().min(1, "A title is required.").max(200),
  price: priceField,
  description: shortText(500).optional(),
  brand: shortText(40).optional(),
  seller: shortText(80).optional(),
});

export const reviewSchema = z.object({
  order_id: z.string().trim().min(1, "An order is required to leave a review."),
  sentiment: z.enum(["positive", "negative"]).default("positive"),
  feedback: shortText(1000).optional(),
});

// Korapay wallet top-up: the buyer enters a USD amount; the server charges the
// local-currency equivalent and credits the USD amount once the webhook confirms.
export const DEPOSIT_CURRENCIES = ["NGN", "GHS", "KES", "ZAR", "XOF"] as const;
export const depositSchema = z.object({
  amount: z.coerce.number().finite().min(1, "Minimum deposit is $1.").max(10_000, "Maximum deposit is $10,000."),
  currency: z.enum(DEPOSIT_CURRENCIES),
});

// ─── Crypto static wallets (Heleket) ─────────────────────────────────────────
// The catalog of assets a user can generate a static deposit wallet for. `id` is
// the stable key used everywhere (URL-safe); `currency`/`network` are Heleket's
// codes; `label`/`color`/`symbol` drive the UI. Single source of truth shared by
// the client grid and the server create endpoint.
export interface CryptoAsset { id: string; currency: string; network: string; label: string; color: string; symbol: string; }
export const CRYPTO_ASSETS: CryptoAsset[] = [
  { id: "btc",         currency: "BTC",  network: "btc",     label: "BTC",          color: "#f7931a", symbol: "₿" },
  { id: "eth",         currency: "ETH",  network: "eth",     label: "ETH",          color: "#627eea", symbol: "♦" },
  { id: "ltc",         currency: "LTC",  network: "ltc",     label: "LTC",          color: "#345dbe", symbol: "Ł" },
  { id: "usdt-trc20",  currency: "USDT", network: "tron",    label: "USDT (TRC20)", color: "#26a17b", symbol: "₮" },
  { id: "usdt-bep20",  currency: "USDT", network: "bsc",     label: "USDT (BEP20)", color: "#26a17b", symbol: "₮" },
  { id: "bnb",         currency: "BNB",  network: "bsc",     label: "BNB",          color: "#f3ba2f", symbol: "◆" },
  { id: "trx",         currency: "TRX",  network: "tron",    label: "TRX",          color: "#ef0027", symbol: "▾" },
  { id: "usdt-erc20",  currency: "USDT", network: "eth",     label: "USDT (ERC20)", color: "#26a17b", symbol: "₮" },
  { id: "usdc-bep20",  currency: "USDC", network: "bsc",     label: "USDC (BEP20)", color: "#2775ca", symbol: "$" },
  { id: "usdc-erc20",  currency: "USDC", network: "eth",     label: "USDC (ERC20)", color: "#2775ca", symbol: "$" },
];
export const CRYPTO_ASSET_IDS = CRYPTO_ASSETS.map((a) => a.id) as [string, ...string[]];
export const createWalletSchema = z.object({ asset: z.enum(CRYPTO_ASSET_IDS) });

// ─── Seller story / status ───────────────────────────────────────────────────
// Strip control + zero-width characters and clamp length so stored captions are
// clean, safe text (React escapes on render; this removes invisible/abuse chars).
const cleanText = (max: number) =>
  z.string().max(max + 2000).optional().transform((s) => (s ?? "")
    .replace(/[\u0000-\u001F\u007F\u200B-\u200D\uFEFF]/g, "")
    .trim().slice(0, max));
// A background is only ever a hex colour we control — reject anything else so no
// arbitrary CSS/URL can be stored and re-rendered.
const hexColor = z.string().regex(/^#[0-9a-fA-F]{3,8}$/).optional();
export const statusSchema = z.object({
  kind: z.enum(["image", "video", "text"]),
  media: z.string().max(24_000_000).optional(), // data URL; byte size re-checked server-side
  caption: cleanText(300),
  bg: hexColor,
});

export const adSchema = z.object({
  title: z.string().trim().min(1, "A title is required.").max(200),
  brand: shortText(40).default("whatsapp"),
  category: shortText(40).default("social"),
  price: priceField,
  quantity: z.coerce.number().int().min(1).max(100_000).default(1),
  description: shortText(1000).optional(),
});
