import type { NextRequest } from "next/server";
import { supabase, getSessionEmail, notify, PLATFORM_FEE_RATE, json, dbMissing, unauthorized, assertSameOrigin } from "@/server/api";

export const dynamic = "force-dynamic";

// Buyer releases escrow: the pending order completes and the seller is paid.
// The status transition is atomic (`.eq("status","pending")`) so a race can
// never pay the seller twice or pay after a cancellation.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const csrf = assertSameOrigin(req); if (csrf) return csrf;
  const miss = dbMissing(); if (miss) return miss;
  const email = await getSessionEmail();
  if (!email) return unauthorized();

  const { data: order } = await supabase.from("purchases").select("*").eq("id", params.id).maybeSingle();
  if (!order) return json({ error: "Order not found." }, 404);
  if (order.buyer_email !== email) return json({ error: "You can only confirm your own orders." }, 403);
  if (order.status !== "pending") return json({ error: `This order is already ${order.status}.` }, 409);

  const { data: updated } = await supabase.from("purchases")
    .update({ status: "completed" }).eq("id", params.id).eq("status", "pending").select().maybeSingle();
  if (!updated) return json({ error: "This order was already resolved." }, 409);

  // Release the escrowed funds to the seller (minus the platform fee).
  if (order.seller_email) {
    const payout = +(Number(order.price) * (1 - PLATFORM_FEE_RATE)).toFixed(2);
    await supabase.from("wallet_transactions").insert({
      owner_email: order.seller_email, kind: "deposit", amount: payout, means: `Sale: ${order.title}`.slice(0, 60), status: "Completed",
    });
    await notify(order.seller_email, "order", "Sale completed", `"${order.title}" was confirmed — $${payout.toFixed(2)} released to your wallet.`);
  }
  await notify(email, "order", "Order completed", `Your order for "${order.title}" is completed.`);
  return json(updated);
}
