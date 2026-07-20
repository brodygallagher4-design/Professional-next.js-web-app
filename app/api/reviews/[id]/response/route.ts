import type { NextRequest } from "next/server";
import { supabase, getSessionEmail, notify, json, dbMissing, unauthorized } from "@/server/api";

export const dynamic = "force-dynamic";

// A seller replies to a review they received. Only the reviewed seller can.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const miss = dbMissing(); if (miss) return miss;
  const email = await getSessionEmail();
  if (!email) return unauthorized();
  const id = Number(params.id);
  if (!Number.isInteger(id)) return json({ error: "Invalid review id." }, 400);
  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const text = String(body.response ?? "").trim();
  if (!text) return json({ error: "A response is required." }, 400);
  if (text.length > 1000) return json({ error: "Response is too long." }, 400);
  const { data: review } = await supabase.from("reviews").select("id, seller_email, author_email").eq("id", id).maybeSingle();
  if (!review) return json({ error: "Review not found." }, 404);
  if (review.seller_email !== email) return json({ error: "You can only respond to your own reviews." }, 403);
  const { data, error } = await supabase.from("reviews").update({ response: text, response_at: new Date().toISOString() }).eq("id", id).select().single();
  if (error) return json({ error: error.message }, 500);
  if (review.author_email) await notify(review.author_email, "review", "Seller responded to your review", text.slice(0, 120));
  return json(data);
}
