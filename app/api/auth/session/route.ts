import { supabase, getSessionEmail, isAdmin, json, dbMissing } from "@/server/api";

export const dynamic = "force-dynamic";

export async function GET() {
  const miss = dbMissing(); if (miss) return miss;
  const email = await getSessionEmail();
  if (!email) return json({ authenticated: false });
  const { data: profile } = await supabase.from("profiles").select("*").eq("email", email).maybeSingle();
  return json({ authenticated: true, profile: profile ? { ...profile, is_admin: isAdmin(email) } : null });
}
