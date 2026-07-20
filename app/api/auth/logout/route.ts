import { cookies } from "next/headers";
import { supabase, SESSION_COOKIE, hashToken, setSessionCookie, json, dbMissing } from "@/server/api";

export const dynamic = "force-dynamic";

export async function POST() {
  const miss = dbMissing(); if (miss) return miss;
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (token) await supabase.from("sessions").delete().eq("token_hash", hashToken(token));
  const res = json({ ok: true });
  setSessionCookie(res, "", 0);
  return res;
}
