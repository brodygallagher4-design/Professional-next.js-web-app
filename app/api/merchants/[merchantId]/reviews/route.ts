import { supabase, json, dbMissing } from "@/server/api";

export const dynamic = "force-dynamic";

// Public reviews for a seller's storefront, resolved by their merchant UUID.
export async function GET(_req: Request, { params }: { params: { merchantId: string } }) {
  const miss = dbMissing(); if (miss) return miss;
  const { data: prof } = await supabase.from("profiles").select("email").eq("merchant_id", params.merchantId).maybeSingle();
  if (!prof?.email) return json([]); // seed merchant or unknown → no real reviews
  const { data, error } = await supabase.from("reviews")
    .select("id, sentiment, feedback, created_at, response, response_at")
    .eq("seller_email", prof.email).order("created_at", { ascending: false });
  if (error) return json({ error: error.message }, 500);
  return json(data);
}
