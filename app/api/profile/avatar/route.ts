import type { NextRequest } from "next/server";
import { supabase, getSessionEmail, json, dbMissing, unauthorized } from "@/server/api";

export const dynamic = "force-dynamic";

const AVATAR_TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

export async function POST(req: NextRequest) {
  const miss = dbMissing(); if (miss) return miss;
  const email = await getSessionEmail();
  if (!email) return unauthorized();
  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const dataUrl = String(body.image ?? "");
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) return json({ error: "Provide a PNG, JPEG or WebP image." }, 400);
  const [, mime, b64] = match;
  const bytes = Buffer.from(b64, "base64");
  if (bytes.length < 100) return json({ error: "Image is empty." }, 400);
  if (bytes.length > 2 * 1024 * 1024) return json({ error: "Image must be under 2 MB." }, 400);
  const { data: prof, error: perr } = await supabase.from("profiles").select("id").eq("email", email).maybeSingle();
  if (perr || !prof) return json({ error: perr?.message ?? "Profile not found." }, 500);
  const path = `profile-${prof.id}.${AVATAR_TYPES[mime]}`;
  const { error: uerr } = await supabase.storage.from("avatars").upload(path, bytes, { contentType: mime, upsert: true });
  if (uerr) return json({ error: uerr.message }, 500);
  const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
  const avatarUrl = `${pub.publicUrl}?v=${Date.now()}`;
  const { error: werr } = await supabase.from("profiles").update({ avatar_url: avatarUrl }).eq("id", prof.id);
  if (werr) return json({ error: werr.message }, 500);
  return json({ ok: true, avatar_url: avatarUrl });
}
