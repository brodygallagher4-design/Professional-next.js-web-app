import type { NextRequest } from "next/server";
import crypto from "node:crypto";
import { supabase, json, dbMissing } from "@/server/api";
import { logger } from "@/server/logger";

export const dynamic = "force-dynamic";

const KORA_VERIFY = (ref: string) => `https://api.korapay.com/merchant/api/v1/charges/${encodeURIComponent(ref)}`;

// Korapay payment webhook. Authentication is the HMAC signature (NOT a session /
// same-origin check — Korapay calls this cross-origin). Flow:
//   1. Verify the x-korapay-signature = HMAC-SHA256(secret, JSON.stringify(data)).
//   2. On charge.success, re-verify the charge directly with Korapay.
//   3. Credit the wallet exactly once via an atomic Pending → Completed flip.
export async function POST(req: NextRequest) {
  const miss = dbMissing(); if (miss) return miss;
  const secret = process.env.KORAPAY_SECRET_KEY;
  if (!secret) return json({ error: "Not configured." }, 503);

  const body = (await req.json().catch(() => null)) as { event?: string; data?: Record<string, unknown> } | null;
  if (!body?.data) return json({ error: "Invalid payload." }, 400);

  // 1) Verify signature (timing-safe). Korapay signs ONLY the `data` object.
  const provided = req.headers.get("x-korapay-signature") ?? "";
  const expected = crypto.createHmac("sha256", secret).update(JSON.stringify(body.data)).digest("hex");
  const a = Buffer.from(provided), e = Buffer.from(expected);
  if (a.length !== e.length || !crypto.timingSafeEqual(a, e)) {
    logger.warn({ event: body.event }, "korapay webhook: invalid signature");
    return json({ error: "Invalid signature." }, 401);
  }

  if (body.event !== "charge.success") return json({ status: true });

  const reference = String(body.data.reference ?? "").trim();
  if (!reference) return json({ status: true });

  // Human-friendly payment method for the user's history (never the processor).
  const labelFor = (raw: string) => {
    const s = raw.toLowerCase();
    if (s.includes("card")) return "Card";
    if (s.includes("mobile")) return "Mobile money";
    if (s.includes("bank") || s.includes("transfer")) return "Bank transfer";
    return "";
  };
  const meansFrom = (source: Record<string, unknown>) => {
    const label = labelFor(String(source.payment_method ?? source.channel ?? ""));
    const cur = String(source.currency ?? "").toUpperCase();
    if (!label) return null;
    return cur ? `${label} • ${cur}` : label;
  };

  // 2) Defense-in-depth: confirm the charge really succeeded with Korapay itself,
  // and read the actual payment method the customer used.
  let means: string | null = meansFrom(body.data);
  try {
    const vr = await fetch(KORA_VERIFY(reference), { headers: { Authorization: `Bearer ${secret}` } });
    const v = (await vr.json().catch(() => ({}))) as { status?: boolean; data?: Record<string, unknown> };
    if (!v?.status || String(v?.data?.status ?? "").toLowerCase() !== "success") {
      logger.warn({ reference }, "korapay webhook: verify did not confirm success");
      return json({ status: true });
    }
    if (v.data) means = meansFrom(v.data) ?? means;
  } catch {
    // If the verify call is unreachable, trust the signed webhook and proceed.
  }

  // 3) Credit exactly once: only a still-Pending row flips to Completed. A retried
  // webhook (or a duplicate) updates 0 rows and credits nothing. Also record the
  // real payment method so history shows "Card"/"Bank transfer"/"Mobile money".
  const completed = means ? { status: "Completed", means } : { status: "Completed" };
  const { data: credited } = await supabase.from("wallet_transactions")
    .update(completed).eq("reference", reference).eq("status", "Pending").select().maybeSingle();
  if (credited) {
    logger.info({ reference, owner: credited.owner_email, amount: credited.amount }, "wallet deposit credited");
    return json({ status: true });
  }

  // Fallback for databases without the `reference` column: match on `means`.
  const { data: pend } = await supabase.from("wallet_transactions")
    .select("id").ilike("means", `%${reference}%`).eq("status", "Pending").maybeSingle();
  if (pend) {
    await supabase.from("wallet_transactions").update(completed).eq("id", pend.id).eq("status", "Pending");
    logger.info({ reference }, "wallet deposit credited (means fallback)");
  }
  return json({ status: true });
}
