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

export const adSchema = z.object({
  title: z.string().trim().min(1, "A title is required.").max(200),
  brand: shortText(40).default("whatsapp"),
  category: shortText(40).default("social"),
  price: priceField,
  quantity: z.coerce.number().int().min(1).max(100_000).default(1),
  description: shortText(1000).optional(),
});
