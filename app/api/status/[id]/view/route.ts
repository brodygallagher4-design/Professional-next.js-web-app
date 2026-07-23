import type { NextRequest } from "next/server";
import { supabase, getSessionEmail, json, dbMissing, unauthorized } from "@/server/api";

export const dynamic = "force-dynamic";

// POST — record that the signed-in user viewed a status (once per person).
// The seller sees the "seen by" list on their own status.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const miss = dbMissing(); if (miss) return miss;
  const email = await getSessionEmail();
  if (!email) return unauthorized();
  const id = Number(params.id);
  if (!Number.isInteger(id)) return json({ error: "Invalid status id." }, 400);

  const { data: st } = await supabase.from("seller_status").select("owner_email").eq("id", id).maybeSingle();
  if (!st) return json({ error: "Status not found." }, 404);
  // Don't log the seller viewing their own status as a "view".
  if (st.owner_email === email) return json({ ok: true, self: true });

  const { data: prof } = await supabase.from("profiles").select("full_name").eq("email", email).maybeSingle();
  await supabase.from("status_views")
    .upsert({ status_id: id, viewer_email: email, viewer_name: prof?.full_name ?? email.split("@")[0] }, { onConflict: "status_id,viewer_email", ignoreDuplicates: true });
  return json({ ok: true });
}
