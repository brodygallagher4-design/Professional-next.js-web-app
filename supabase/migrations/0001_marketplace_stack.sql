-- ═══════════════════════════════════════════════════════════════════════════
-- SimBazaar — marketplace stack migration 0001
-- Run once in the Supabase SQL editor (or `supabase db push`). Idempotent: safe
-- to re-run. Brings the database up to date with the application code.
-- ═══════════════════════════════════════════════════════════════════════════

-- Seller-written listing description (shown on the marketplace, buy sheet, cart).
ALTER TABLE ads       ADD COLUMN IF NOT EXISTS description text;

-- Escrow: seller "Mark as Delivered" flag on an order.
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS delivered   boolean DEFAULT false;

-- Cross-instance rate limiting (auth abuse protection under load).
CREATE TABLE IF NOT EXISTS rate_limits (
  key      text PRIMARY KEY,
  count    integer NOT NULL,
  reset_at timestamptz NOT NULL
);

-- Helpful indexes for the hot query paths.
CREATE INDEX IF NOT EXISTS idx_purchases_buyer   ON purchases (buyer_email);
CREATE INDEX IF NOT EXISTS idx_purchases_seller  ON purchases (seller_email);
CREATE INDEX IF NOT EXISTS idx_purchases_status  ON purchases (status);
CREATE INDEX IF NOT EXISTS idx_ads_owner         ON ads (owner_email);
CREATE INDEX IF NOT EXISTS idx_ads_status        ON ads (status);
CREATE INDEX IF NOT EXISTS idx_cart_owner        ON cart_items (owner_email);
