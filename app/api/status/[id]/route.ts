import type { NextRequest } from "next/server";
import { supabase, getSessionEmail, json, dbMissing, unauthorized } from "@/server/api";

export const dynamic = "force-dynamic";

// DELETE — remove one of the caller's own statuses. Owner-only.
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const miss = dbMissing(); if (miss) return miss;
  const email = await getSessionEmail();
  if (!email) return unauthorized();
  const id = Number(params.id);
  if (!Number.isInteger(id)) return json({ error: "Invalid status id." }, 400);

  const { data: st } = await supabase.from("seller_status").select("id, owner_email").eq("id", id).maybeSingle();
  if (!st) return json({ error: "Status not found." }, 404);
  if (st.owner_email !== email) return json({ error: "This status is not yours." }, 403);

  const { error } = await supabase.from("seller_status").delete().eq("id", id);
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true });
}
