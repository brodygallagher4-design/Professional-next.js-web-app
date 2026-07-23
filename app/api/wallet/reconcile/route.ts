import type { NextRequest } from "next/server";
import { supabase, getSessionEmail, json, dbMissing, unauthorized, assertSameOrigin, rateLimitDb, clientIp } from "@/server/api";
import { logger } from "@/server/logger";

export const dynamic = "force-dynamic";

const KORA_VERIFY = (ref: string) => `https://api.korapay.com/merchant/api/v1/charges/${encodeURIComponent(ref)}`;

// Reconcile the caller's still-"Pending" Korapay deposits against the provider's
// authoritative status. This is the fallback that keeps history accurate when a
// webhook is delayed or never arrives (e.g. local/no public URL): a deposit that
// actually succeeded flips to Completed, an abandoned/expired one to Failed —
// exactly what professional platforms show, instead of a permanent "Pending".
export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req); if (csrf) return csrf;
  const miss = dbMissing(); if (miss) return miss;
  const email = await getSessionEmail();
  if (!email) return unauthorized();

  const secret = process.env.KORAPAY_SECRET_KEY;
  if (!secret) return json({ updated: 0 });
  // Bounded: a few reconcile sweeps a minute per user/IP.
  if (!(await rateLimitDb(`reconcile:${email}:${clientIp(req)}`, 20, 60_000))) return json({ updated: 0 });

  // Only THIS user's pending deposits that carry a provider reference.
  const { data: pend } = await supabase.from("wallet_transactions")
    .select("id, reference")
    .eq("owner_email", email).eq("kind", "deposit").eq("status", "Pending")
    .not("reference", "is", null)
    .order("created_at", { ascending: false }).limit(20);
  if (!pend?.length) return json({ updated: 0 });

  let updated = 0;
  for (const row of pend) {
    const ref = String(row.reference ?? "").trim();
    if (!ref) continue;
    try {
      const vr = await fetch(KORA_VERIFY(ref), { headers: { Authorization: `Bearer ${secret}` } });
      const v = (await vr.json().catch(() => ({}))) as { status?: boolean; data?: { status?: string } };
      const st = String(v?.data?.status ?? "").toLowerCase();
      let next: "Completed" | "Failed" | null = null;
      if (v?.status && st === "success") next = "Completed";
      else if (["failed", "expired", "cancelled", "canceled"].includes(st)) next = "Failed";
      if (!next) continue;
      // Atomic Pending→X so a concurrent webhook can't double-apply.
      const { data: done } = await supabase.from("wallet_transactions")
        .update({ status: next }).eq("id", row.id).eq("status", "Pending").select("id").maybeSingle();
      if (done) updated += 1;
    } catch { /* skip this one, try the rest */ }
  }
  if (updated) logger.info({ owner: email, updated }, "deposits reconciled");
  return json({ updated });
}
