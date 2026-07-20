-- SimBazaar — Supabase schema
-- Run this once in your Supabase project: Dashboard → SQL Editor → paste → Run.

create table if not exists merchants (
  id          bigint generated always as identity primary key,
  name        text not null,
  rating      numeric(2,1) not null default 5.0,
  sales       int not null default 0,
  success_rate int not null default 100,
  avatar_url  text,
  location    text default 'Nigeria',
  joined      date default now(),
  bio         text,
  hot         boolean default false,
  created_at  timestamptz not null default now()
);

create table if not exists products (
  id          bigint generated always as identity primary key,
  title       text not null,
  brand       text not null,           -- whatsapp | telegram | facebook | pia | ...
  category    text not null default 'social',
  seller      text not null,
  price       numeric(10,2) not null,
  rating      numeric(2,1) not null default 4.0,
  available   int not null default 1,
  badge       text default 'hand',
  created_at  timestamptz not null default now()
);

create table if not exists purchases (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  glyph        text not null default 'whatsapp',   -- whatsapp | voice | facebook
  description  text,
  product_type text not null default 'WhatsApp',
  seller       text not null,
  price        numeric(10,2) not null,
  status       text not null default 'completed',
  reviewed     boolean default false,
  username     text,
  password     text,
  note         text,
  note_time    text,
  created_at   timestamptz not null default now()
);

create table if not exists chat_messages (
  id         bigint generated always as identity primary key,
  order_id   uuid not null references purchases(id) on delete cascade,
  text       text not null,
  mine       boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists referrals (
  id          bigint generated always as identity primary key,
  code        text not null unique,
  invitees    int not null default 0,
  earned      numeric(10,2) not null default 0,
  status      text not null default 'pending',
  created_at  timestamptz not null default now()
);

-- The backend uses the service-role key, so RLS can stay enabled with no
-- public policies: browsers can never query these tables directly.
alter table merchants     enable row level security;
alter table products      enable row level security;
alter table purchases     enable row level security;
alter table chat_messages enable row level security;
alter table referrals     enable row level security;

-- ── Seed data (matches the current app) ─────────────────────────────────────
insert into merchants (name, rating, sales, success_rate, avatar_url, hot) values
  ('OlaMore',          5.0, 24,   100, 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=96&h=96&fit=crop&auto=format', false),
  ('Akan confidence',  4.9, 61,   97,  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=96&h=96&fit=crop&auto=format', false),
  ('olayinkafaruq5',   4.8, 476,  94,  'https://images.unsplash.com/photo-1519345182560-3f2917c472ef?w=96&h=96&fit=crop&auto=format', false),
  ('Behappy',          4.8, 298,  94,  'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=96&h=96&fit=crop&auto=format', false),
  ('Egosim',           4.2, 2600, 91,  'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=96&h=96&fit=crop&auto=format', true),
  ('Account Na Water', 4.5, 183,  96,  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=96&h=96&fit=crop&auto=format', false)
on conflict do nothing;

insert into products (title, brand, category, seller, price, rating, available) values
  ('1 YEAR ACTIVE PIA VPN',        'pia',      'vpn',     'Lavidamide', 2.98, 3.0, 5),
  ('U.S us +1 WhatsApp number',    'whatsapp', 'numbers', 'Vino',       3.90, 3.0, 1),
  ('STRONG USA us WHATSAPP NUMBER','whatsapp', 'numbers', 'Amos',       3.70, 3.0, 1),
  ('USA Apple iCloud / ID Account','apple',    'social',  'Sunny''s',   3.90, 3.0, 1),
  ('HIGH QUALITY INSTAGRAM...',    'instagram','social',  'CHASELOGS',  5.00, 3.0, 1),
  ('Valid USA us TELEGRAM number!','telegram', 'numbers', 'Talk2mandi', 3.99, 3.0, 1)
on conflict do nothing;

insert into purchases (title, glyph, description, product_type, seller, price, status, reviewed, username, password, note, note_time) values
  ('Strong USA 🇺🇸 WhatsApp', 'whatsapp', 'Strong active usa WhatsApp number for verification code', 'WhatsApp', 'Owolabi Adeola', 3.00, 'completed', true, '+1 747495 75491', '747495 75491', 'Dm me on WhatsApp for verification +234 907 148 2332', 'Friday, October 8th, 6:52 PM'),
  ('🇺🇸Very Strong 💪 Gmail Google voice account (...', 'voice', 'USA is texting 💬, verification and calling 📞 number 100% strong 💖', 'GoogleVoice', 'Log seller', 6.00, 'completed', false, 'tsysiaoashsiaoo@gmail.com', 'Aassdd3344eessd', 'DM me on WhatsApp if any issue occur and I''ll respond as soon as possible: +2348075944417 Thanks 🙏 for your trust ❤️', 'Monday, October 7th, 7:07 PM'),
  ('✅ Strong Foreign Facebook Account +...', 'facebook', 'All Features Are Working and No Restrictions', 'Facebook', 'Barry White', 7.90, 'completed', false, 'barry.white.fb@outlook.com', 'Fb!marketplace90', 'Marketplace access is fully enabled on this profile.', 'Tuesday, October 8th, 8:09 AM')
on conflict do nothing;

-- ── Auth sessions (opaque server-side tokens; the browser only holds an
--    httpOnly cookie — passwords live in Supabase Auth, never here) ──────────
create table if not exists sessions (
  id bigint generated always as identity primary key,
  token_hash text not null unique,
  email text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
alter table sessions enable row level security;
-- New signups automatically receive a permanent merchant link id
alter table profiles alter column merchant_id set default gen_random_uuid();

-- ── End-to-end audit hardening ──────────────────────────────────────────────
-- Per-account ownership so no user ever sees another account's private data.
alter table purchases           add column if not exists buyer_email  text;
alter table purchases           add column if not exists seller_email text;
alter table wallet_transactions add column if not exists owner_email  text;
alter table cart_items          add column if not exists owner_email  text;
alter table notifications       add column if not exists owner_email  text;
alter table ads                 add column if not exists owner_email  text;
alter table reviews             add column if not exists author_email text;
alter table chat_messages       add column if not exists sender_email text;
create index if not exists idx_purchases_buyer  on purchases(buyer_email);
create index if not exists idx_purchases_seller on purchases(seller_email);
create index if not exists idx_wallet_owner     on wallet_transactions(owner_email);
create index if not exists idx_cart_owner       on cart_items(owner_email);
create index if not exists idx_notif_owner      on notifications(owner_email);
create index if not exists idx_ads_owner        on ads(owner_email);
create index if not exists idx_reviews_author   on reviews(author_email);
create index if not exists idx_chat_order       on chat_messages(order_id);
-- One account per email; new accounts get a permanent merchant link id.
alter table profiles add constraint profiles_email_unique unique (email);
alter table profiles alter column merchant_id set default gen_random_uuid();

-- ── Real-time seller reviews ────────────────────────────────────────────────
-- Buyers review an order; the review is tied to the seller account and shows on
-- their storefront + profile. Sellers can respond, which the buyer then sees.
alter table reviews add column if not exists seller_email text;
alter table reviews add column if not exists order_id     uuid;
alter table reviews add column if not exists response     text;
alter table reviews add column if not exists response_at  timestamptz;
create index if not exists idx_reviews_seller_email on reviews(seller_email);
create index if not exists idx_reviews_order on reviews(order_id);

-- ── Account settings: editable additional information (saved in real time) ───
alter table profiles add column if not exists address text;
alter table profiles add column if not exists dob     text;
alter table profiles add column if not exists state   text;
alter table profiles add column if not exists city    text;
