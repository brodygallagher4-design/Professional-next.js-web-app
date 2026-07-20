import type { NextRequest } from "next/server";
import { supabase, getSessionEmail, notify, json, dbMissing, unauthorized } from "@/server/api";

export const dynamic = "force-dynamic";

// A buyer leaves a review on one of THEIR orders. The seller/product come from
// the order itself (unspoofable), and one review per order is allowed.
export async function POST(req: NextRequest) {
  const miss = dbMissing(); if (miss) return miss;
  const email = await getSessionEmail();
  if (!email) return unauthorized();
  const b = await req.json().catch(() => ({} as Record<string, unknown>));
  const orderId = String(b.order_id ?? "").trim();
  if (!orderId) return json({ error: "An order is required to leave a review." }, 400);
  const { data: order } = await supabase.from("purchases").select("id, buyer_email, seller_email, seller, title").eq("id", orderId).maybeSingle();
  if (!order) return json({ error: "Order not found." }, 404);
  if (order.buyer_email !== email) return json({ error: "You can only review your own orders." }, 403);
  const { data: existing } = await supabase.from("reviews").select("id").eq("order_id", orderId).eq("author_email", email).maybeSingle();
  if (existing) return json({ error: "You've already reviewed this order." }, 409);

  const sentiment = b.sentiment === "negative" ? "negative" : "positive";
  const { data, error } = await supabase.from("reviews").insert({
    author_email: email, seller_email: order.seller_email ?? null, order_id: orderId, sentiment,
    feedback: String(b.feedback ?? "").slice(0, 1000), product_title: order.title, seller: order.seller,
  }).select().single();
  if (error) return json({ error: error.message }, 500);
  await notify(email, "review", "Review submitted", `You left a ${sentiment} review for ${order.seller}`);
  if (order.seller_email) await notify(order.seller_email, "review", "New review received", `A buyer left you a ${sentiment} review on "${order.title}"`);
  return json(data, 201);
}
