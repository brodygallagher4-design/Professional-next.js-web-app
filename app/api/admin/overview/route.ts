import { NextResponse } from "next/server";
import { supabase, requireAdmin, json, dbMissing, PLATFORM_FEE_RATE } from "@/server/api";

export const dynamic = "force-dynamic";

// Admin dashboard data: platform-wide stats + recent users, listings and orders.
// Admin-only (requireAdmin) — a non-admin session gets 403 before any data reads.
export async function GET() {
  const miss = dbMissing(); if (miss) return miss;
  const gate = await requireAdmin(); if (gate instanceof NextResponse) return gate;

  const [{ data: users }, { data: ads }, { data: orders }] = await Promise.all([
    supabase.from("profiles").select("email, full_name, is_seller, joined, country, avatar_url").order("joined", { ascending: false }),
    supabase.from("ads").select("id, title, owner_email, price, quantity, status, brand, created_at").order("created_at", { ascending: false }),
    supabase.from("purchases").select("id, title, buyer, buyer_email, seller, seller_email, price, status, created_at").order("created_at", { ascending: false }),
  ]);
  const u = users ?? [], a = ads ?? [], o = orders ?? [];
  const low = (s: unknown) => String(s).toLowerCase();
  const gmv = o.filter((x) => low(x.status) === "completed").reduce((s, x) => s + (Number(x.price) || 0), 0);

  const stats = {
    users: u.length,
    sellers: u.filter((x) => x.is_seller).length,
    ads: a.length,
    activeAds: a.filter((x) => x.status === "active").length,
    orders: o.length,
    pending: o.filter((x) => ["pending", "processing"].includes(low(x.status))).length,
    completed: o.filter((x) => low(x.status) === "completed").length,
    cancelled: o.filter((x) => low(x.status) === "cancelled").length,
    gmv: +gmv.toFixed(2),
    fees: +(gmv * PLATFORM_FEE_RATE).toFixed(2),
  };
  return json({ stats, users: u.slice(0, 150), ads: a.slice(0, 150), orders: o.slice(0, 150) });
}
