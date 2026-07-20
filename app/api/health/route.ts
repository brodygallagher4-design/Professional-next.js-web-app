import { SUPABASE_URL, SUPABASE_KEY, json } from "@/server/api";

export const dynamic = "force-dynamic";

export async function GET() {
  return json({ ok: true, db: Boolean(SUPABASE_URL && SUPABASE_KEY), time: new Date().toISOString() });
}
