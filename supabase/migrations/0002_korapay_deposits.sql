-- ═══════════════════════════════════════════════════════════════════════════
-- SimBazaar — migration 0002: Korapay wallet deposits
-- Adds an idempotency key so a payment webhook credits a deposit exactly once,
-- even if Korapay retries the notification. Run once (idempotent).
-- ═══════════════════════════════════════════════════════════════════════════

-- Korapay charge reference on the wallet transaction (pending → completed).
ALTER TABLE wallet_transactions ADD COLUMN IF NOT EXISTS reference text;

-- One transaction per Korapay reference — the webhook's atomic Pending→Completed
-- flip plus this unique key make double-crediting impossible.
CREATE UNIQUE INDEX IF NOT EXISTS uq_wallet_tx_reference
  ON wallet_transactions (reference)
  WHERE reference IS NOT NULL;
