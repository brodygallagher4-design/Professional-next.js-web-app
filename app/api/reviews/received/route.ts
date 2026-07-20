import { supabase, getSessionEmail, json, dbMissing, unauthorized } from "@/server/api";

export const dynamic = "force-dynamic";

// Reviews a seller has received (for their own profile — with responses).
export async function GET() {
  const miss = dbMissing(); if (miss) return miss;
  const email = await getSessionEmail();
  if (!email) return unauthorized();
  const { data, error } = await supabase.from("reviews").select("*").eq("seller_email", email).order("created_at", { ascending: false });
  if (error) return json({ error: error.message }, 500);
  return json(data);
}
