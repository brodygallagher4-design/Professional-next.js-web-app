import type { NextRequest } from "next/server";
import { supabase, getSessionEmail, notify, json, dbMissing, unauthorized, assertSameOrigin } from "@/server/api";

export const dynamic = "force-dynamic";

// Seller marks a pending order as delivered — nudging the buyer to review and
// confirm so escrow releases. Only the order's own seller may call it, and only
// while the order is still pending. Persists a `delivered` flag when that column
// exists (degrades gracefully to a notification-only signal if it doesn't).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const csrf = assertSameOrigin(req); if (csrf) return csrf;
  const miss = dbMissing(); if (miss) return miss;
  const email = await getSessionEmail();
  if (!email) return unauthorized();

  const { data: order } = await supabase.from("purchases").select("id, seller_email, buyer_email, status, title").eq("id", params.id).maybeSingle();
  if (!order) return json({ error: "Order not found." }, 404);
  if (order.seller_email !== email) return json({ error: "You can only deliver your own sales." }, 403);
  if (order.status !== "pending") return json({ error: `This order is already ${order.status}.` }, 409);

  const { error } = await supabase.from("purchases").update({ delivered: true }).eq("id", params.id).eq("seller_email", email);
  if (error && !/delivered/i.test(error.message)) return json({ error: error.message }, 500);

  if (order.buyer_email) {
    await notify(order.buyer_email, "order", "Order delivered", `The seller marked "${order.title}" as delivered — review it and confirm to release the funds.`);
  }
  return json({ ok: true });
}
