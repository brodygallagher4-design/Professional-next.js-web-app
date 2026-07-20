import { getSessionEmail, walletBalance, MERCHANT_FEE_USD, json, dbMissing, unauthorized } from "@/server/api";

export const dynamic = "force-dynamic";

export async function GET() {
  const miss = dbMissing(); if (miss) return miss;
  const email = await getSessionEmail();
  if (!email) return unauthorized();
  return json({ balance: await walletBalance(email), merchant_fee: MERCHANT_FEE_USD });
}
