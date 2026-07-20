import { supabase, getSessionEmail, json, dbMissing, unauthorized } from "@/server/api";

export const dynamic = "force-dynamic";

export async function GET() {
  const miss = dbMissing(); if (miss) return miss;
  const email = await getSessionEmail();
  if (!email) return unauthorized();
  const { data, error } = await supabase.from("notifications")
    .select("*").eq("owner_email", email).order("created_at", { ascending: false }).limit(30);
  if (error) return json({ error: error.message }, 500);
  return json(data);
}
