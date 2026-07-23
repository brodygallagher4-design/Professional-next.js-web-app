import type { NextRequest } from "next/server";
import { supabase, getSessionEmail, json, dbMissing, unauthorized } from "@/server/api";

export const dynamic = "force-dynamic";

const MEDIA_TYPES: Record<string, { ext: string; kind: "image" | "video"; max: number }> = {
  "image/png":  { ext: "png",  kind: "image", max: 4 * 1024 * 1024 },
  "image/jpeg": { ext: "jpg",  kind: "image", max: 4 * 1024 * 1024 },
  "image/webp": { ext: "webp", kind: "image", max: 4 * 1024 * 1024 },
  "video/mp4":  { ext: "mp4",  kind: "video", max: 12 * 1024 * 1024 },
  "video/webm": { ext: "webm", kind: "video", max: 12 * 1024 * 1024 },
  "video/quicktime": { ext: "mov", kind: "video", max: 12 * 1024 * 1024 },
};

// GET — public. A seller's active (non-expired) statuses, resolved by their
// merchant_id (?merchant=) for storefront viewers, or the caller's own (?mine=1).
export async function GET(req: NextRequest) {
  const miss = dbMissing(); if (miss) return miss;
  const merchant = (req.nextUrl.searchParams.get("merchant") ?? "").trim();
  const mine = req.nextUrl.searchParams.get("mine") === "1";

  let ownerEmail: string | null = null;
  if (mine) {
    ownerEmail = await getSessionEmail();
    if (!ownerEmail) return unauthorized();
  } else if (merchant) {
    const { data: prof } = await supabase.from("profiles").select("email").eq("merchant_id", merchant).eq("is_seller", true).maybeSingle();
    ownerEmail = prof?.email ?? null;
  }
  if (!ownerEmail) return json([]);

  const { data, error } = await supabase.from("seller_status")
    .select("id, kind, media_url, caption, bg, created_at")
    .eq("owner_email", ownerEmail).gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: true });
  if (error) return json({ error: error.message }, 500);
  const rows = data ?? [];

  // The owner viewing their own statuses also gets who reacted and who viewed.
  if (mine && rows.length) {
    const ids = rows.map((r) => r.id);
    const { data: reacts } = await supabase.from("status_reactions").select("status_id, emoji, reactor_name").in("status_id", ids);
    const { data: views } = await supabase.from("status_views").select("status_id, viewer_name").in("status_id", ids);
    const rx = new Map<number, { emoji: string; name: string }[]>();
    for (const rc of reacts ?? []) { const l = rx.get(rc.status_id) ?? []; l.push({ emoji: rc.emoji, name: rc.reactor_name ?? "Someone" }); rx.set(rc.status_id, l); }
    const vw = new Map<number, string[]>();
    for (const v of views ?? []) { const l = vw.get(v.status_id) ?? []; l.push(v.viewer_name ?? "Someone"); vw.set(v.status_id, l); }
    return json(rows.map((r) => ({ ...r, reactions: rx.get(r.id) ?? [], viewers: vw.get(r.id) ?? [] })));
  }
  return json(rows);
}

// POST — create a status. Sellers only. Accepts an image/video (base64 data URL)
// or a text status. Media is uploaded to the public `status` bucket.
export async function POST(req: NextRequest) {
  const miss = dbMissing(); if (miss) return miss;
  const email = await getSessionEmail();
  if (!email) return unauthorized();
  const { data: prof } = await supabase.from("profiles").select("id, is_seller").eq("email", email).maybeSingle();
  if (!prof?.is_seller) return json({ error: "Only verified sellers can post a status." }, 403);

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const kindIn = String(body.kind ?? "");
  const caption = String(body.caption ?? "").trim().slice(0, 300);
  const bg = String(body.bg ?? "").trim().slice(0, 40);

  if (kindIn === "text") {
    if (!caption) return json({ error: "Write something for your text status." }, 400);
    const { data, error } = await supabase.from("seller_status")
      .insert({ owner_email: email, kind: "text", caption, bg: bg || "#f04e23" }).select().single();
    if (error) return json({ error: error.message }, 500);
    return json(data, 201);
  }

  // image / video
  const dataUrl = String(body.media ?? "");
  const match = /^data:([-\w/.]+);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) return json({ error: "Attach a valid image or video." }, 400);
  const [, mime, b64] = match;
  const spec = MEDIA_TYPES[mime];
  if (!spec) return json({ error: "Supported: JPG, PNG, WebP, MP4, WebM, MOV." }, 400);
  const bytes = Buffer.from(b64, "base64");
  if (bytes.length < 100) return json({ error: "That file is empty." }, 400);
  if (bytes.length > spec.max) return json({ error: `File too large — ${spec.kind === "video" ? "video max 12 MB" : "image max 4 MB"}.` }, 400);

  const path = `status-${prof.id}-${Date.now()}.${spec.ext}`;
  const { error: uerr } = await supabase.storage.from("status").upload(path, bytes, { contentType: mime, upsert: false });
  if (uerr) return json({ error: uerr.message }, 500);
  const { data: pub } = supabase.storage.from("status").getPublicUrl(path);

  const { data, error } = await supabase.from("seller_status")
    .insert({ owner_email: email, kind: spec.kind, media_url: pub.publicUrl, caption: caption || null }).select().single();
  if (error) return json({ error: error.message }, 500);
  return json(data, 201);
}
