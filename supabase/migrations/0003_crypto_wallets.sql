-- ═══════════════════════════════════════════════════════════════════════════
-- SimBazaar — migration 0003: Heleket crypto static wallets
-- Per-user, per-asset deposit addresses. One row per (owner, asset); the unique
-- key makes "create wallet" idempotent so a user can't spawn duplicates.
-- Run once (idempotent).
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS crypto_wallets (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  owner_email   text NOT NULL,
  asset         text NOT NULL,                 -- catalog id: btc, usdt-trc20, …
  currency      text NOT NULL,                 -- Heleket currency: BTC, USDT, …
  network       text NOT NULL,                 -- Heleket network: btc, tron, …
  label         text NOT NULL,                 -- display: "USDT (TRC20)"
  address       text NOT NULL,
  provider_uuid text,                          -- Heleket wallet uuid
  order_id      text,                          -- our reference sent to Heleket
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- One wallet per user per asset.
CREATE UNIQUE INDEX IF NOT EXISTS uq_crypto_wallet_owner_asset
  ON crypto_wallets (owner_email, asset);

CREATE INDEX IF NOT EXISTS idx_crypto_wallets_owner ON crypto_wallets (owner_email);
-- Fast attribution of an incoming webhook to its wallet/owner.
CREATE INDEX IF NOT EXISTS idx_crypto_wallets_address ON crypto_wallets (address);
CREATE INDEX IF NOT EXISTS idx_crypto_wallets_uuid ON crypto_wallets (provider_uuid);

ALTER TABLE crypto_wallets ENABLE ROW LEVEL SECURITY;
