// SimBazaar backend — runs on Railway, reads from Supabase.
// Serves the built frontend from ../dist and exposes JSON APIs under /api/*.
import express from "express";
import cors from "cors";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { validatePhone, countryByIso } from "./countries.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(cors());
app.use(express.json({ limit: "4mb" }));

// ── Security headers on every response ──────────────────────────────────────
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
});

// ── Rate limiting (in-memory, per IP) for the auth endpoints ────────────────
const rateBuckets = new Map();
const clientIp = (req) => String(req.headers["x-forwarded-for"] ?? req.ip ?? "").split(",")[0].trim() || "unknown";
const rateLimit = (key, limit, windowMs) => {
  const now = Date.now();
  if (rateBuckets.size > 5000) {
    for (const [k, b] of rateBuckets) if (now > b.reset) rateBuckets.delete(k);
  }
  const bucket = rateBuckets.get(key);
  if (!bucket || now > bucket.reset) { rateBuckets.set(key, { count: 1, reset: now + windowMs }); return true; }
  if (bucket.count >= limit) return false;
  bucket.count += 1;
  return true;
};

// ── Supabase client (service role key stays on the server only) ────────────
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = SUPABASE_URL && SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;

const requireDb = (res) => {
  if (!supabase) {
    res.status(503).json({ error: "Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY." });
    return false;
  }
  return true;
};

// ── API routes ──────────────────────────────────────────────────────────────
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, db: Boolean(supabase), time: new Date().toISOString() });
});

// ── Authentication (Supabase Auth + server-side sessions) ───────────────────
// The browser only ever holds an opaque random token in an httpOnly cookie;
// passwords are verified by Supabase Auth and never stored by this server.
const SESSION_COOKIE = "sb_session";
const SESSION_DAYS = 30;
const hashToken = (t) => crypto.createHash("sha256").update(t).digest("hex");
const parseCookies = (req) => Object.fromEntries(
  String(req.headers.cookie ?? "").split(";").map((c) => {
    const i = c.indexOf("=");
    return i < 0 ? [c.trim(), ""] : [c.slice(0, i).trim(), decodeURIComponent(c.slice(i + 1).trim())];
  }).filter(([k]) => k),
);
const setSessionCookie = (req, res, token, maxAgeSeconds) => {
  const secure = req.secure || req.headers["x-forwarded-proto"] === "https";
  res.setHeader("Set-Cookie",
    `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${secure ? "; Secure" : ""}`);
};
const createSession = async (req, res, email) => {
  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + SESSION_DAYS * 24 * 3600 * 1000).toISOString();
  await supabase.from("sessions").delete().lt("expires_at", new Date().toISOString()); // tidy expired
  const { error } = await supabase.from("sessions").insert({ token_hash: hashToken(token), email, expires_at: expires });
  if (error) throw new Error(error.message);
  setSessionCookie(req, res, token, SESSION_DAYS * 24 * 3600);
};
const sessionEmail = async (req) => {
  const token = parseCookies(req)[SESSION_COOKIE];
  if (!token || !supabase) return null;
  const { data } = await supabase.from("sessions").select("email, expires_at").eq("token_hash", hashToken(token)).maybeSingle();
  if (!data || new Date(data.expires_at).getTime() < Date.now()) return null;
  return data.email;
};
// A profile row always exists for an authenticated account (created on signup,
// self-healed on login for accounts created before profiles existed).
const ensureProfile = async (email, fullName, extra = {}) => {
  const { data: existing } = await supabase.from("profiles").select("*").eq("email", email).maybeSingle();
  if (existing) {
    // Backfill phone/country when the account signs up for an existing profile
    const patch = {};
    if (extra.phone && !existing.phone) patch.phone = extra.phone;
    if (extra.country && !existing.country) patch.country = extra.country;
    if (Object.keys(patch).length) await supabase.from("profiles").update(patch).eq("id", existing.id);
    return { ...existing, ...patch };
  }
  const { data: created, error } = await supabase.from("profiles")
    .insert({ full_name: fullName || email.split("@")[0], email, joined: new Date().toISOString(), ...extra })
    .select().single();
  if (error) throw new Error(error.message);
  return created;
};
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

app.post("/api/auth/signup", async (req, res) => {
  if (!requireDb(res)) return;
  if (!rateLimit(`signup:${clientIp(req)}`, 6, 60 * 60 * 1000)) {
    return res.status(429).json({ error: "Too many signup attempts — please try again later." });
  }
  const fullName = String(req.body?.full_name ?? "").trim().slice(0, 80);
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  const password = String(req.body?.password ?? "");
  const country = String(req.body?.country ?? "").trim().toUpperCase();
  if (!fullName) return res.status(400).json({ error: "Your full name is required." });
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: "Enter a valid email address." });
  if (password.length < 6 || password.length > 30) return res.status(400).json({ error: "Password must be 6-30 characters long." });
  if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) return res.status(400).json({ error: "Password must include letters and at least one number." });
  if (!countryByIso(country)) return res.status(400).json({ error: "Select your country." });
  const rawPhone = String(req.body?.phone ?? "");
  const dial = countryByIso(country).dial;
  const phoneCheck = validatePhone(country, rawPhone.startsWith(dial) ? rawPhone.slice(dial.length) : rawPhone);
  if (!phoneCheck.ok) return res.status(400).json({ error: phoneCheck.error });
  const { error } = await supabase.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { full_name: fullName },
  });
  if (error) {
    const exists = /already|registered|exists/i.test(error.message);
    return res.status(exists ? 409 : 500).json({ error: exists ? "An account with this email already exists — please log in." : error.message });
  }
  try {
    const profile = await ensureProfile(email, fullName, { phone: phoneCheck.e164, country });
    await createSession(req, res, email);
    res.status(201).json({ ok: true, profile });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/auth/login", async (req, res) => {
  if (!requireDb(res)) return;
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  const password = String(req.body?.password ?? "");
  if (!EMAIL_RE.test(email) || !password) return res.status(400).json({ error: "Email and password are required." });
  if (!rateLimit(`login:${clientIp(req)}`, 15, 10 * 60 * 1000) || !rateLimit(`login:${clientIp(req)}:${email}`, 8, 10 * 60 * 1000)) {
    return res.status(429).json({ error: "Too many login attempts — please wait a few minutes and try again." });
  }
  // Fresh client per attempt so the shared service client never carries auth state
  const authClient = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await authClient.auth.signInWithPassword({ email, password });
  if (error || !data?.user) return res.status(401).json({ error: "Incorrect email or password." });
  try {
    const profile = await ensureProfile(email, data.user.user_metadata?.full_name);
    await createSession(req, res, email);
    res.json({ ok: true, profile });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/auth/logout", async (req, res) => {
  if (!requireDb(res)) return;
  const token = parseCookies(req)[SESSION_COOKIE];
  if (token) await supabase.from("sessions").delete().eq("token_hash", hashToken(token));
  setSessionCookie(req, res, "", 0);
  res.json({ ok: true });
});

app.get("/api/auth/session", async (req, res) => {
  if (!requireDb(res)) return;
  const email = await sessionEmail(req);
  if (!email) return res.json({ authenticated: false });
  const { data: profile } = await supabase.from("profiles").select("*").eq("email", email).maybeSingle();
  res.json({ authenticated: true, profile: profile ?? null });
});

// ── Auth guard — everything below requires a signed-in session except the
//    public marketplace reads (products + merchants + a seller's public
//    reviews, all viewable on the public storefront) and health/auth above. ──
const PUBLIC_API = new Set(["/api/products", "/api/merchants"]);
const PUBLIC_API_RE = [/^\/api\/merchants\/[^/]+\/reviews$/];
app.use(async (req, res, next) => {
  if (!req.path.startsWith("/api/")) return next();
  if (req.method === "GET" && (PUBLIC_API.has(req.path) || PUBLIC_API_RE.some((re) => re.test(req.path)))) return next();
  if (!supabase) return res.status(503).json({ error: "Supabase is not configured." });
  const email = await sessionEmail(req);
  if (!email) return res.status(401).json({ error: "Please log in to continue." });
  req.userEmail = email;
  next();
});

// Public reviews for a seller's storefront, resolved by their merchant UUID.
// Only genuine reviews (tied to a real seller account) are returned.
app.get("/api/merchants/:merchantId/reviews", async (req, res) => {
  if (!requireDb(res)) return;
  const { data: prof } = await supabase.from("profiles").select("email").eq("merchant_id", req.params.merchantId).maybeSingle();
  if (!prof?.email) return res.json([]); // seed merchant or unknown → no real reviews
  const { data, error } = await supabase.from("reviews")
    .select("id, sentiment, feedback, created_at, response, response_at")
    .eq("seller_email", prof.email).order("created_at", { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ── Per-user helpers ────────────────────────────────────────────────────────
// A notification always belongs to exactly one account.
const notify = (ownerEmail, kind, title, body) =>
  supabase.from("notifications").insert({ owner_email: ownerEmail, kind, title, body });

// Available wallet balance = completed deposits − (completed + pending withdrawals).
// Pending withdrawals are held so a balance can't be spent twice.
const MERCHANT_FEE_USD = 49.99;
const walletBalance = async (email) => {
  const { data } = await supabase.from("wallet_transactions").select("kind, amount, status").eq("owner_email", email);
  let bal = 0;
  for (const tx of data ?? []) {
    const amt = Number(tx.amount) || 0;
    if (tx.kind === "deposit" && tx.status === "Completed") bal += amt;
    else if (tx.kind === "withdrawal") bal -= amt; // held whether Pending or Completed
  }
  return +bal.toFixed(2);
};

app.get("/api/profile", async (req, res) => {
  if (!requireDb(res)) return;
  const { data, error } = await supabase.from("profiles").select("*").eq("email", req.userEmail).maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: "Profile not found." });
  res.json(data);
});

app.get("/api/wallet/balance", async (req, res) => {
  if (!requireDb(res)) return;
  res.json({ balance: await walletBalance(req.userEmail), merchant_fee: MERCHANT_FEE_USD });
});

// Update the account's editable "additional information" (never the identity
// fields — name and email are fixed). Persists in real time to the profile.
app.post("/api/profile/update", async (req, res) => {
  if (!requireDb(res)) return;
  const b = req.body ?? {};
  const patch = {};
  if (b.country !== undefined) {
    const country = String(b.country).trim().toUpperCase();
    if (country && !countryByIso(country)) return res.status(400).json({ error: "Select a valid country." });
    patch.country = country || null;
  }
  if (b.state !== undefined) patch.state = String(b.state).slice(0, 80) || null;
  if (b.city !== undefined) patch.city = String(b.city).slice(0, 80) || null;
  if (b.address !== undefined) patch.address = String(b.address).slice(0, 200) || null;
  if (b.dob !== undefined) {
    const dob = String(b.dob).trim();
    if (dob && !/^\d{2}\/\d{2}\/\d{2,4}$/.test(dob)) return res.status(400).json({ error: "Use the date format DD/MM/YYYY." });
    patch.dob = dob || null;
  }
  if (Object.keys(patch).length === 0) return res.status(400).json({ error: "Nothing to update." });
  const { data, error } = await supabase.from("profiles").update(patch).eq("email", req.userEmail).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.get("/api/products", async (_req, res) => {
  if (!requireDb(res)) return;
  const { data, error } = await supabase.from("products").select("*").order("id");
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.get("/api/merchants", async (_req, res) => {
  if (!requireDb(res)) return;
  const { data, error } = await supabase.from("merchants").select("*").order("sales", { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Buyers see what they bought (?role=buyer, default); sellers see orders placed
// against them (?role=seller). A user never sees another account's orders.
app.get("/api/purchases", async (req, res) => {
  if (!requireDb(res)) return;
  const column = req.query.role === "seller" ? "seller_email" : "buyer_email";
  const { data, error } = await supabase.from("purchases").select("*").eq(column, req.userEmail).order("created_at", { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

const PLATFORM_FEE_RATE = 0.10; // 10% marketplace fee on each sale
app.post("/api/purchases", async (req, res) => {
  if (!requireDb(res)) return;
  const b = req.body ?? {};
  const productId = Number.isInteger(Number(b.product_id)) ? Number(b.product_id) : null;

  // Authoritative product data: when a real catalogue product is referenced,
  // the server uses its own price/title/seller — the client cannot underpay.
  let title, price, sellerName, glyph, description, productType;
  if (productId) {
    const { data: prod } = await supabase.from("products").select("*").eq("id", productId).maybeSingle();
    if (!prod) return res.status(404).json({ error: "That product is no longer available." });
    if (prod.available <= 0) return res.status(409).json({ error: "That product is out of stock." });
    title = prod.title;
    price = Number(prod.price);
    sellerName = prod.seller;
    glyph = ["whatsapp", "voice", "facebook"].includes(b.glyph) ? b.glyph : "whatsapp";
    description = String(b.description ?? "").slice(0, 500);
    productType = prod.brand ? prod.brand.charAt(0).toUpperCase() + prod.brand.slice(1) : "Account";
  } else {
    title = String(b.title ?? "").trim();
    price = Number(b.price);
    sellerName = String(b.seller ?? "Seller").slice(0, 80);
    glyph = ["whatsapp", "voice", "facebook"].includes(b.glyph) ? b.glyph : "whatsapp";
    description = String(b.description ?? "").slice(0, 500);
    productType = String(b.product_type ?? "Account").slice(0, 60);
  }
  if (!title || !Number.isFinite(price) || price <= 0) {
    return res.status(400).json({ error: "A valid title and price are required." });
  }

  // Real money: the buyer pays from their wallet. No funds → no order.
  const balance = await walletBalance(req.userEmail);
  if (balance < price) {
    return res.status(402).json({
      error: `Insufficient wallet balance. This costs $${price.toFixed(2)} and your balance is $${balance.toFixed(2)}. Add $${(price - balance).toFixed(2)} to continue.`,
      needs_funds: true, balance, price,
    });
  }

  const { data: buyerProf } = await supabase.from("profiles").select("full_name").eq("email", req.userEmail).maybeSingle();
  // Tie the order to the seller's account when the seller is a real member.
  const { data: sellerProf } = await supabase.from("profiles").select("email").eq("full_name", sellerName).maybeSingle();
  const row = {
    title,
    buyer: buyerProf?.full_name ?? "Buyer",
    buyer_email: req.userEmail,
    seller_email: sellerProf?.email ?? null,
    glyph,
    description,
    product_type: productType,
    seller: sellerName,
    price,
    status: "completed",
    note: "Your access details will be shared by the seller in the trade chat.",
    note_time: new Date().toLocaleString([], { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" }),
  };
  const { data, error } = await supabase.from("purchases").insert(row).select().single();
  if (error) return res.status(500).json({ error: error.message });

  // Debit the buyer, and credit the seller net of the marketplace fee.
  await supabase.from("wallet_transactions").insert({
    owner_email: req.userEmail, kind: "withdrawal", amount: +price.toFixed(2),
    means: `Purchase: ${title}`.slice(0, 60), status: "Completed",
  });
  if (sellerProf?.email) {
    const payout = +(price * (1 - PLATFORM_FEE_RATE)).toFixed(2);
    await supabase.from("wallet_transactions").insert({
      owner_email: sellerProf.email, kind: "deposit", amount: payout,
      means: `Sale: ${title}`.slice(0, 60), status: "Completed",
    });
  }
  // Decrement stock on a real catalogue product.
  if (productId) {
    const { data: prod } = await supabase.from("products").select("available").eq("id", productId).maybeSingle();
    if (prod) await supabase.from("products").update({ available: Math.max(0, prod.available - 1) }).eq("id", productId);
  }

  await notify(req.userEmail, "order", "Order Completed", `Your order for "${row.title}" is Completed`);
  if (sellerProf?.email) await notify(sellerProf.email, "order", "New sale", `You sold "${row.title}" for $${price.toFixed(2)}`);
  res.status(201).json(data);
});

// ── Profile avatar upload (validated image -> Supabase Storage) ─────────────
const AVATAR_TYPES = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };
app.post("/api/profile/avatar", async (req, res) => {
  if (!requireDb(res)) return;
  const dataUrl = String(req.body?.image ?? "");
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) return res.status(400).json({ error: "Provide a PNG, JPEG or WebP image." });
  const [, mime, b64] = match;
  const bytes = Buffer.from(b64, "base64");
  if (bytes.length < 100) return res.status(400).json({ error: "Image is empty." });
  if (bytes.length > 2 * 1024 * 1024) return res.status(400).json({ error: "Image must be under 2 MB." });
  const { data: prof, error: perr } = await supabase.from("profiles").select("id").eq("email", req.userEmail).maybeSingle();
  if (perr || !prof) return res.status(500).json({ error: perr?.message ?? "Profile not found." });
  const path = `profile-${prof.id}.${AVATAR_TYPES[mime]}`;
  const { error: uerr } = await supabase.storage.from("avatars").upload(path, bytes, { contentType: mime, upsert: true });
  if (uerr) return res.status(500).json({ error: uerr.message });
  const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
  const avatarUrl = `${pub.publicUrl}?v=${Date.now()}`; // cache-bust on change
  const { error: werr } = await supabase.from("profiles").update({ avatar_url: avatarUrl }).eq("id", prof.id);
  if (werr) return res.status(500).json({ error: werr.message });
  res.json({ ok: true, avatar_url: avatarUrl });
});

// ── Seller activation — charges the one-time merchant fee from the wallet.
//    No free access: without enough balance the account stays a buyer. ───────
app.post("/api/seller/activate", async (req, res) => {
  if (!requireDb(res)) return;
  const { data: prof, error: perr } = await supabase.from("profiles").select("id, is_seller").eq("email", req.userEmail).maybeSingle();
  if (perr) return res.status(500).json({ error: perr.message });
  if (!prof) return res.status(404).json({ error: "Profile not found." });
  if (prof.is_seller) return res.json({ ok: true, already: true });

  const balance = await walletBalance(req.userEmail);
  if (balance < MERCHANT_FEE_USD) {
    return res.status(402).json({
      error: `A one-time $${MERCHANT_FEE_USD.toFixed(2)} merchant fee is required. Your wallet balance is $${balance.toFixed(2)} — add $${(MERCHANT_FEE_USD - balance).toFixed(2)} to continue.`,
      needs_funds: true, balance, fee: MERCHANT_FEE_USD,
    });
  }
  // Charge the fee (recorded in the ledger) then flip the account to seller.
  const { error: cerr } = await supabase.from("wallet_transactions").insert({
    owner_email: req.userEmail, kind: "withdrawal", amount: MERCHANT_FEE_USD,
    means: "Merchant activation fee", status: "Completed",
  });
  if (cerr) return res.status(500).json({ error: cerr.message });
  const { error } = await supabase.from("profiles").update({ is_seller: true, seller_since: new Date().toISOString() }).eq("id", prof.id);
  if (error) return res.status(500).json({ error: error.message });
  await notify(req.userEmail, "seller", "Seller account activated", `Your $${MERCHANT_FEE_USD.toFixed(2)} merchant fee was received — you are now a verified SimBazaar seller 🎉`);
  res.json({ ok: true, charged: MERCHANT_FEE_USD });
});

// ── Wallet transactions ─────────────────────────────────────────────────────
app.get("/api/wallet/transactions", async (req, res) => {
  if (!requireDb(res)) return;
  const { data, error } = await supabase.from("wallet_transactions").select("*").eq("owner_email", req.userEmail).order("created_at", { ascending: false }).limit(50);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Manual deposits/withdrawals are disabled until a real payment provider is
// integrated. This is enforced server-side too, so no one can add funds by
// calling the API directly. (Sale earnings and the merchant fee still move
// money through their own audited flows.)
app.post("/api/wallet/transactions", (_req, res) => {
  res.status(503).json({
    error: "Deposits and withdrawals aren't available yet — payment processing is being connected.",
    coming_soon: true,
  });
});

// ── Cart ────────────────────────────────────────────────────────────────────
app.get("/api/cart", async (req, res) => {
  if (!requireDb(res)) return;
  const { data, error } = await supabase.from("cart_items").select("*").eq("owner_email", req.userEmail).order("created_at", { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.post("/api/cart", async (req, res) => {
  if (!requireDb(res)) return;
  const b = req.body ?? {};
  const title = String(b.title ?? "").trim();
  const price = Number(b.price);
  if (!title || !Number.isFinite(price) || price <= 0) return res.status(400).json({ error: "A valid title and price are required." });
  const { data, error } = await supabase.from("cart_items").insert({
    owner_email: req.userEmail,
    title, price,
    description: String(b.description ?? "").slice(0, 500),
    brand: String(b.brand ?? "whatsapp").slice(0, 40),
    seller: String(b.seller ?? "Seller").slice(0, 80),
  }).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

app.delete("/api/cart/:id", async (req, res) => {
  if (!requireDb(res)) return;
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid cart item id." });
  // Ownership scope — a user can only remove their own cart items.
  const { error } = await supabase.from("cart_items").delete().eq("id", id).eq("owner_email", req.userEmail);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// ── Notifications ───────────────────────────────────────────────────────────
app.get("/api/notifications", async (req, res) => {
  if (!requireDb(res)) return;
  const { data, error } = await supabase.from("notifications").select("*").eq("owner_email", req.userEmail).order("created_at", { ascending: false }).limit(30);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ── Reviews ──────────────────────────────────────────────────────────────────
// Reviews a seller has RECEIVED (for the seller's own profile — with responses).
app.get("/api/reviews/received", async (req, res) => {
  if (!requireDb(res)) return;
  const { data, error } = await supabase.from("reviews").select("*").eq("seller_email", req.userEmail).order("created_at", { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// A buyer leaves a review on one of THEIR orders. The seller, product and
// seller account are taken from the order itself (the client can't spoof them),
// and one review per order is allowed.
app.post("/api/reviews", async (req, res) => {
  if (!requireDb(res)) return;
  const b = req.body ?? {};
  const orderId = String(b.order_id ?? "").trim();
  if (!orderId) return res.status(400).json({ error: "An order is required to leave a review." });
  const { data: order } = await supabase.from("purchases").select("id, buyer_email, seller_email, seller, title").eq("id", orderId).maybeSingle();
  if (!order) return res.status(404).json({ error: "Order not found." });
  if (order.buyer_email !== req.userEmail) return res.status(403).json({ error: "You can only review your own orders." });
  const { data: existing } = await supabase.from("reviews").select("id").eq("order_id", orderId).eq("author_email", req.userEmail).maybeSingle();
  if (existing) return res.status(409).json({ error: "You've already reviewed this order." });

  const sentiment = b.sentiment === "negative" ? "negative" : "positive";
  const { data, error } = await supabase.from("reviews").insert({
    author_email: req.userEmail,
    seller_email: order.seller_email ?? null,
    order_id: orderId,
    sentiment,
    feedback: String(b.feedback ?? "").slice(0, 1000),
    product_title: order.title,
    seller: order.seller,
  }).select().single();
  if (error) return res.status(500).json({ error: error.message });
  await notify(req.userEmail, "review", "Review submitted", `You left a ${sentiment} review for ${order.seller}`);
  if (order.seller_email) await notify(order.seller_email, "review", "New review received", `A buyer left you a ${sentiment} review on "${order.title}"`);
  res.status(201).json(data);
});

// A seller replies to a review they received. Only the reviewed seller can.
app.post("/api/reviews/:id/response", async (req, res) => {
  if (!requireDb(res)) return;
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid review id." });
  const text = String(req.body?.response ?? "").trim();
  if (!text) return res.status(400).json({ error: "A response is required." });
  if (text.length > 1000) return res.status(400).json({ error: "Response is too long." });
  const { data: review } = await supabase.from("reviews").select("id, seller_email, author_email").eq("id", id).maybeSingle();
  if (!review) return res.status(404).json({ error: "Review not found." });
  if (review.seller_email !== req.userEmail) return res.status(403).json({ error: "You can only respond to your own reviews." });
  const { data, error } = await supabase.from("reviews").update({ response: text, response_at: new Date().toISOString() }).eq("id", id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  if (review.author_email) await notify(review.author_email, "review", "Seller responded to your review", text.slice(0, 120));
  res.json(data);
});

// ── Ads (a seller's own listings) ───────────────────────────────────────────
app.get("/api/ads", async (req, res) => {
  if (!requireDb(res)) return;
  const { data, error } = await supabase.from("ads").select("*").eq("owner_email", req.userEmail).order("created_at", { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.post("/api/ads", async (req, res) => {
  if (!requireDb(res)) return;
  // Only verified sellers may list ads.
  const { data: prof } = await supabase.from("profiles").select("is_seller").eq("email", req.userEmail).maybeSingle();
  if (!prof?.is_seller) return res.status(403).json({ error: "Only verified sellers can post ads." });
  const b = req.body ?? {};
  const title = String(b.title ?? "").trim();
  const price = Number(b.price);
  if (!title || !Number.isFinite(price) || price <= 0) return res.status(400).json({ error: "A valid title and price are required." });
  const { data, error } = await supabase.from("ads").insert({
    owner_email: req.userEmail,
    title, price,
    brand: String(b.brand ?? "whatsapp").slice(0, 40),
    category: String(b.category ?? "social").slice(0, 40),
    quantity: Number.isInteger(Number(b.quantity)) ? Number(b.quantity) : 1,
    status: "pending",
  }).select().single();
  if (error) return res.status(500).json({ error: error.message });
  await notify(req.userEmail, "ad", "Ad submitted", `Your ad "${title}" was submitted and is pending review`);
  res.status(201).json(data);
});

// Only the buyer or seller on an order may read/write its trade chat.
const canAccessOrder = async (orderId, email) => {
  const { data } = await supabase.from("purchases").select("buyer_email, seller_email").eq("id", orderId).maybeSingle();
  if (!data) return false;
  return data.buyer_email === email || data.seller_email === email;
};

app.get("/api/orders/:orderId/messages", async (req, res) => {
  if (!requireDb(res)) return;
  if (!(await canAccessOrder(req.params.orderId, req.userEmail))) return res.status(403).json({ error: "This order is not yours." });
  const { data, error } = await supabase
    .from("chat_messages").select("*")
    .eq("order_id", req.params.orderId)
    .order("created_at");
  if (error) return res.status(500).json({ error: error.message });
  // "mine" is relative to the viewer: a message is mine when I sent it.
  const rows = (data ?? []).map((m) => ({ ...m, mine: m.sender_email ? m.sender_email === req.userEmail : m.mine }));
  res.json(rows);
});

app.post("/api/orders/:orderId/messages", async (req, res) => {
  if (!requireDb(res)) return;
  if (!(await canAccessOrder(req.params.orderId, req.userEmail))) return res.status(403).json({ error: "This order is not yours." });
  const text = String(req.body?.text ?? "").trim();
  if (!text) return res.status(400).json({ error: "Message text is required." });
  if (text.length > 2000) return res.status(400).json({ error: "Message is too long." });
  const { data, error } = await supabase
    .from("chat_messages")
    .insert({ order_id: req.params.orderId, text, mine: true, sender_email: req.userEmail })
    .select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// Unknown API route → JSON 404 (never the SPA shell or HTML).
app.use("/api", (_req, res) => res.status(404).json({ error: "Not found." }));

// ── Static frontend (production) ────────────────────────────────────────────
const dist = path.join(__dirname, "..", "dist");
app.use(express.static(dist));
// SPA fallback — anything that isn't /api/* gets the app shell
app.use((req, res, next) => {
  if (req.method !== "GET" || req.path.startsWith("/api/")) return next();
  res.sendFile(path.join(dist, "index.html"));
});

// Central error handler — return clean JSON, never leak a stack trace.
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (err?.type === "entity.parse.failed") return res.status(400).json({ error: "Invalid request body." });
  if (err?.type === "entity.too.large") return res.status(413).json({ error: "Request body is too large." });
  console.error("Unhandled error:", err?.message ?? err);
  if (res.headersSent) return;
  res.status(500).json({ error: "Something went wrong. Please try again." });
});

const port = Number(process.env.PORT) || 8787;
app.listen(port, () => console.log(`SimBazaar server listening on :${port} (db: ${supabase ? "connected" : "NOT CONFIGURED"})`));
