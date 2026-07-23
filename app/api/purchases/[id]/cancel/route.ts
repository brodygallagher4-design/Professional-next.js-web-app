import type { NextRequest } from "next/server";
import { supabase, getSessionEmail, notify, json, dbMissing, unauthorized, assertSameOrigin } from "@/server/api";

export const dynamic = "force-dynamic";

const ESCROW_WINDOW_MS = 60 * 60 * 1000; // 1 hour

// Buyer cancels a pending order after the 1-hour escrow window and is refunded
// in full. The window and ownership are enforced server-side (the client can't
// bypass them), and the status transition is atomic so a refund can happen at
// most once and never after the order has completed.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const csrf = assertSameOrigin(req); if (csrf) return csrf;
  const miss = dbMissing(); if (miss) return miss;
  const email = await getSessionEmail();
  if (!email) return unauthorized();

  const { data: order } = await supabase.from("purchases").select("*").eq("id", params.id).maybeSingle();
  if (!order) return json({ error: "Order not found." }, 404);
  if (order.buyer_email !== email) return json({ error: "You can only cancel your own orders." }, 403);
  if (order.status !== "pending") return json({ error: `This order is already ${order.status}.` }, 409);

  const created = new Date(order.created_at).getTime();
  if (Number.isFinite(created) && Date.now() - created < ESCROW_WINDOW_MS) {
    const mins = Math.ceil((ESCROW_WINDOW_MS - (Date.now() - created)) / 60000);
    return json({ error: `You can cancel once the delivery window ends — about ${mins} min left.` }, 403);
  }

  const { data: updated } = await supabase.from("purchases")
    .update({ status: "cancelled" }).eq("id", params.id).eq("status", "pending").select().maybeSingle();
  if (!updated) return json({ error: "This order was already resolved." }, 409);

  // Refund the buyer the full escrowed amount (no platform fee was taken yet).
  const refund = +Number(order.price).toFixed(2);
  await supabase.from("wallet_transactions").insert({
    owner_email: email, kind: "deposit", amount: refund, means: `Refund: ${order.title}`.slice(0, 60), status: "Completed",
  });
  await notify(email, "order", "Order cancelled", `Your order for "${order.title}" was cancelled — $${refund.toFixed(2)} refunded to your wallet.`);
  if (order.seller_email) await notify(order.seller_email, "order", "Order cancelled", `The buyer cancelled "${order.title}" after the delivery window closed.`);
  return json(updated);
}
