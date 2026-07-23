import type { NextRequest } from "next/server";
import { supabase, getSessionEmail, notify, json, dbMissing, unauthorized } from "@/server/api";

export const dynamic = "force-dynamic";

const ALLOWED = ["👍", "❤️", "🔥", "😮", "😂", "😍", "👏", "😢"];

// POST — react to a status. Any signed-in user; one reaction per person per
// status (re-reacting replaces it). The seller is notified.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const miss = dbMissing(); if (miss) return miss;
  const email = await getSessionEmail();
  if (!email) return unauthorized();
  const id = Number(params.id);
  if (!Number.isInteger(id)) return json({ error: "Invalid status id." }, 400);

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const emoji = String(body.emoji ?? "");
  if (!ALLOWED.includes(emoji)) return json({ error: "Pick a valid reaction." }, 400);

  const { data: st } = await supabase.from("seller_status").select("owner_email, caption").eq("id", id).maybeSingle();
  if (!st) return json({ error: "Status not found." }, 404);

  const { data: prof } = await supabase.from("profiles").select("full_name").eq("email", email).maybeSingle();
  const reactorName = prof?.full_name ?? email.split("@")[0];

  const { error } = await supabase.from("status_reactions")
    .upsert({ status_id: id, reactor_email: email, reactor_name: reactorName, emoji }, { onConflict: "status_id,reactor_email" });
  if (error) return json({ error: error.message }, 500);

  // Notify the seller (not for reacting to your own status).
  if (st.owner_email && st.owner_email !== email) {
    await notify(st.owner_email, "status", "New status reaction", `${reactorName} reacted ${emoji} to your status`);
  }
  return json({ ok: true });
}
