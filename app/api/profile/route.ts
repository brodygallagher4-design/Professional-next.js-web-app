import { supabase, getSessionEmail, json, dbMissing, unauthorized } from "@/server/api";

export const dynamic = "force-dynamic";

export async function GET() {
  const miss = dbMissing(); if (miss) return miss;
  const email = await getSessionEmail();
  if (!email) return unauthorized();
  const { data, error } = await supabase.from("profiles").select("*").eq("email", email).maybeSingle();
  if (error) return json({ error: error.message }, 500);
  if (!data) return json({ error: "Profile not found." }, 404);
  return json(data);
}
