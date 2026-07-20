import { supabase, getSessionEmail, json, dbMissing, unauthorized } from "@/server/api";

export const dynamic = "force-dynamic";

export async function GET() {
  const miss = dbMissing(); if (miss) return miss;
  const email = await getSessionEmail();
  if (!email) return unauthorized();
  const { data, error } = await supabase.from("wallet_transactions")
    .select("*").eq("owner_email", email).order("created_at", { ascending: false }).limit(50);
  if (error) return json({ error: error.message }, 500);
  return json(data);
}

// Manual deposits/withdrawals are disabled until a real payment provider is
// integrated — enforced server-side so no one can add funds via the API.
export async function POST() {
  return json({
    error: "Deposits and withdrawals aren't available yet — payment processing is being connected.",
    coming_soon: true,
  }, 503);
}
