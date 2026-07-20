import { supabase, getSessionEmail, json, dbMissing, unauthorized } from "@/server/api";

export const dynamic = "force-dynamic";

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const miss = dbMissing(); if (miss) return miss;
  const email = await getSessionEmail();
  if (!email) return unauthorized();
  const id = Number(params.id);
  if (!Number.isInteger(id)) return json({ error: "Invalid cart item id." }, 400);
  // Ownership scope — a user can only remove their own cart items.
  const { error } = await supabase.from("cart_items").delete().eq("id", id).eq("owner_email", email);
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true });
}
