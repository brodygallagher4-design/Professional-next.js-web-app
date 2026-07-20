import type { NextRequest } from "next/server";
import { supabase, getSessionEmail, canAccessOrder, json, dbMissing, unauthorized } from "@/server/api";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { orderId: string } }) {
  const miss = dbMissing(); if (miss) return miss;
  const email = await getSessionEmail();
  if (!email) return unauthorized();
  if (!(await canAccessOrder(params.orderId, email))) return json({ error: "This order is not yours." }, 403);
  const { data, error } = await supabase.from("chat_messages").select("*").eq("order_id", params.orderId).order("created_at");
  if (error) return json({ error: error.message }, 500);
  // "mine" is relative to the viewer.
  const rows = (data ?? []).map((m) => ({ ...m, mine: m.sender_email ? m.sender_email === email : m.mine }));
  return json(rows);
}

export async function POST(req: NextRequest, { params }: { params: { orderId: string } }) {
  const miss = dbMissing(); if (miss) return miss;
  const email = await getSessionEmail();
  if (!email) return unauthorized();
  if (!(await canAccessOrder(params.orderId, email))) return json({ error: "This order is not yours." }, 403);
  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const text = String(body.text ?? "").trim();
  if (!text) return json({ error: "Message text is required." }, 400);
  if (text.length > 2000) return json({ error: "Message is too long." }, 400);
  const { data, error } = await supabase.from("chat_messages")
    .insert({ order_id: params.orderId, text, mine: true, sender_email: email }).select().single();
  if (error) return json({ error: error.message }, 500);
  return json(data, 201);
}
