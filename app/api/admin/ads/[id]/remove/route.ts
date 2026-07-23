import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { supabase, requireAdmin, notify, json, dbMissing, assertSameOrigin } from "@/server/api";

export const dynamic = "force-dynamic";

// Admin moderation: take a listing down (status → "removed") and notify the seller.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const csrf = assertSameOrigin(req); if (csrf) return csrf;
  const miss = dbMissing(); if (miss) return miss;
  const gate = await requireAdmin(); if (gate instanceof NextResponse) return gate;

  const { data, error } = await supabase.from("ads").update({ status: "removed" }).eq("id", params.id).select().maybeSingle();
  if (error) return json({ error: error.message }, 500);
  if (!data) return json({ error: "Listing not found." }, 404);
  if (data.owner_email) await notify(data.owner_email, "ad", "Listing removed", `Your listing "${data.title}" was removed by an admin for policy review.`);
  return json({ ok: true });
}
