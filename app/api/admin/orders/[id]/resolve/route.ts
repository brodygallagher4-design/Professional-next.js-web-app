import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { supabase, requireAdmin, notify, json, dbMissing, assertSameOrigin } from "@/server/api";

export const dynamic = "force-dynamic";

// Admin dispute resolution: force-cancel a PENDING (escrowed) order and refund the
// buyer in full. Atomic transition (`.eq("status","pending")`) so the refund can
// fire at most once and never after the order has completed.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const csrf = assertSameOrigin(req); if (csrf) return csrf;
  const miss = dbMissing(); if (miss) return miss;
  const gate = await requireAdmin(); if (gate instanceof NextResponse) return gate;

  const { data: order } = await supabase.from("purchases").select("*").eq("id", params.id).maybeSingle();
  if (!order) return json({ error: "Order not found." }, 404);
  if (order.status !== "pending") return json({ error: `Order is ${order.status} — only pending orders can be refunded here.` }, 409);

  const { data: updated } = await supabase.from("purchases")
    .update({ status: "cancelled" }).eq("id", params.id).eq("status", "pending").select().maybeSingle();
  if (!updated) return json({ error: "This order was already resolved." }, 409);

  const refund = +Number(order.price).toFixed(2);
  if (order.buyer_email) {
    await supabase.from("wallet_transactions").insert({
      owner_email: order.buyer_email, kind: "deposit", amount: refund, means: `Admin refund: ${order.title}`.slice(0, 60), status: "Completed",
    });
    await notify(order.buyer_email, "order", "Order refunded", `An admin refunded your order "${order.title}" — $${refund.toFixed(2)} returned to your wallet.`);
  }
  if (order.seller_email) await notify(order.seller_email, "order", "Order refunded", `An admin refunded the buyer for "${order.title}" following a review.`);
  return json({ ok: true });
}
