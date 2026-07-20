// Thin API layer for the Railway backend.
// Every helper resolves to `null` when the backend/database is unreachable, so
// callers can keep using the built-in demo data as a fallback.

async function get<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(path, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export interface ApiProduct {
  id: number;
  title: string;
  brand: string;
  category: string;
  seller: string;
  price: number;
  rating: number;
  available: number;
  badge: string | null;
  preview_url?: string | null;
}

export interface ApiMerchant {
  id: number;
  merchant_id?: string | null;
  name: string;
  rating: number;
  sales: number;
  success_rate: number;
  avatar_url: string | null;
  hot: boolean;
  location?: string | null;
  joined?: string | null;
  bio?: string | null;
}

export interface ApiPurchase {
  id: string;
  title: string;
  buyer?: string | null;
  glyph: "whatsapp" | "voice" | "facebook";
  description: string | null;
  product_type: string;
  seller: string;
  price: number;
  status: string;
  reviewed: boolean | null;
  username: string | null;
  password: string | null;
  note: string | null;
  note_time: string | null;
  created_at: string;
}

export interface ApiMessage {
  id: number;
  order_id: string;
  text: string;
  mine: boolean;
  created_at: string;
}

export interface ApiStoreAd {
  id: number | string;
  title: string;
  price: number;
  brand: string;
  category: string;
  quantity: number;
  status: string;
}
export interface ApiStorefront extends ApiMerchant {
  active_ads: number;
  ads: ApiStoreAd[];
}

export const fetchProducts = () => get<ApiProduct[]>("/api/products");
export const fetchMerchants = () => get<ApiMerchant[]>("/api/merchants");
// Public storefront resolve by merchant_id / id / name-slug (cold deep-link load).
export const fetchStorefront = (key: string) => get<ApiStorefront>(`/api/merchants/${encodeURIComponent(key)}`);

// Cascading geo dropdowns for the settings page (country → states → cities).
export interface ApiState { code: string; name: string }
export const fetchStates = (country: string) => get<ApiState[]>(`/api/geo/states?country=${encodeURIComponent(country)}`);
export const fetchCities = (country: string, state: string) => get<string[]>(`/api/geo/cities?country=${encodeURIComponent(country)}&state=${encodeURIComponent(state)}`);
// role "buyer" → orders I placed; role "seller" → orders placed against me.
export const fetchPurchases = (role: "buyer" | "seller" = "buyer") => get<ApiPurchase[]>(`/api/purchases?role=${role}`);
export const fetchOrderMessages = (orderId: string) => get<ApiMessage[]>(`/api/orders/${orderId}/messages`);
export interface ApiProfile { id: number; full_name: string; email: string; joined: string | null; is_seller?: boolean; seller_since?: string | null; merchant_id?: string | null; avatar_url?: string | null; phone?: string | null; country?: string | null; address?: string | null; dob?: string | null; state?: string | null; city?: string | null; }
export interface UpdateResult { ok: boolean; error?: string }
export const updateProfile = async (fields: { country?: string; state?: string; city?: string; address?: string; dob?: string }): Promise<UpdateResult> => {
  try {
    const res = await fetch("/api/profile/update", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(fields) });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) return { ok: false, error: data.error ?? "Could not save your changes." };
    return { ok: true };
  } catch { return { ok: false, error: "Could not reach the server — check your connection." }; }
};
export const uploadAvatar = async (imageDataUrl: string): Promise<string | null> => {
  try {
    const res = await fetch("/api/profile/avatar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: imageDataUrl }),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { avatar_url?: string };
    return body.avatar_url ?? null;
  } catch { return null; }
};
export const fetchProfile = () => get<ApiProfile>("/api/profile");
export const fetchHealth = () => get<{ ok: boolean; db: boolean }>("/api/health");

// ── Authentication ──────────────────────────────────────────────────────────
// The session lives in an httpOnly cookie set by the server; the client only
// ever learns "authenticated or not" plus its own profile.
export interface AuthResult { ok: boolean; error?: string }
const postAuth = async (path: string, body: object): Promise<AuthResult> => {
  try {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) return { ok: false, error: data.error ?? "Something went wrong — please try again." };
    return { ok: true };
  } catch { return { ok: false, error: "Could not reach the server — check your connection." }; }
};
export const authSignup = (full_name: string, email: string, password: string, phone: string, country: string) =>
  postAuth("/api/auth/signup", { full_name, email, password, phone, country });
export const authLogin = (email: string, password: string) =>
  postAuth("/api/auth/login", { email, password });
export const authLogout = async (): Promise<boolean> => {
  try { return (await fetch("/api/auth/logout", { method: "POST" })).ok; } catch { return false; }
};
export const fetchAuthSession = () => get<{ authenticated: boolean; profile?: ApiProfile | null }>("/api/auth/session");

export interface PurchaseResult { ok: boolean; error?: string; needsFunds?: boolean; balance?: number; price?: number }
export const createPurchase = async (order: {
  title: string; glyph: string; description: string; product_type: string; seller: string; price: number; product_id?: number;
}): Promise<PurchaseResult> => {
  try {
    const res = await fetch("/api/purchases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(order),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string; needs_funds?: boolean; balance?: number; price?: number };
    if (!res.ok) return { ok: false, error: data.error ?? "Purchase failed.", needsFunds: Boolean(data.needs_funds), balance: data.balance, price: data.price };
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not reach the server — check your connection." };
  }
};

export const sendOrderMessage = async (orderId: string, text: string) => {
  try {
    const res = await fetch(`/api/orders/${orderId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    return res.ok;
  } catch {
    return false;
  }
};

export interface ApiCartItem { id: number; title: string; description: string | null; brand: string; seller: string; price: number; qty: number; created_at: string; }
export interface ApiNotification { id: number; kind: string; title: string; body: string | null; created_at: string; }
export interface ApiReview { id: number; product_title?: string | null; seller?: string | null; sentiment: string; feedback: string | null; created_at: string; response?: string | null; response_at?: string | null; order_id?: string | null; }
export interface ApiAd { id: number; title: string; brand: string; category: string; price: number; quantity: number; status: string; created_at: string; }

export const fetchCart = () => get<ApiCartItem[]>("/api/cart");
export const fetchNotifications = () => get<ApiNotification[]>("/api/notifications");
export const fetchAds = () => get<ApiAd[]>("/api/ads");

const post = async (path: string, body: unknown): Promise<boolean> => {
  try {
    const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return res.ok;
  } catch { return false; }
};

export const addCartItem = (item: { title: string; description?: string; brand: string; seller: string; price: number }) => post("/api/cart", item);
export const removeCartItem = async (id: number): Promise<boolean> => {
  try { return (await fetch(`/api/cart/${id}`, { method: "DELETE" })).ok; } catch { return false; }
};
export interface ApiWalletTx { id: number; kind: "deposit" | "withdrawal"; amount: number; means: string; status: string; txid: string; created_at: string; }
export const fetchWalletTransactions = () => get<ApiWalletTx[]>("/api/wallet/transactions");
export const createWalletTransaction = async (tx: { kind: "deposit" | "withdrawal"; amount: number; means: string }): Promise<ApiWalletTx | null> => {
  try {
    const res = await fetch("/api/wallet/transactions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(tx) });
    if (!res.ok) return null;
    return (await res.json()) as ApiWalletTx;
  } catch { return null; }
};

export interface ActivateResult { ok: boolean; error?: string; needsFunds?: boolean; balance?: number; fee?: number }
export const activateSeller = async (): Promise<ActivateResult> => {
  try {
    const res = await fetch("/api/seller/activate", { method: "POST" });
    const data = (await res.json().catch(() => ({}))) as { error?: string; needs_funds?: boolean; balance?: number; fee?: number };
    if (!res.ok) return { ok: false, error: data.error ?? "Activation failed.", needsFunds: Boolean(data.needs_funds), balance: data.balance, fee: data.fee };
    return { ok: true };
  } catch { return { ok: false, error: "Could not reach the server — check your connection." }; }
};
export const fetchWalletBalance = () => get<{ balance: number; merchant_fee: number }>("/api/wallet/balance");
// A buyer leaves a review on one of their orders (seller resolved server-side).
export interface ReviewResult { ok: boolean; error?: string }
export const submitReview = async (r: { order_id: string; sentiment: string; feedback: string }): Promise<ReviewResult> => {
  try {
    const res = await fetch("/api/reviews", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(r) });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) return { ok: false, error: data.error ?? "Could not submit your review." };
    return { ok: true };
  } catch { return { ok: false, error: "Could not reach the server — check your connection." }; }
};
// Reviews a seller has received (their own profile) and a storefront's public reviews.
export const fetchReceivedReviews = () => get<ApiReview[]>("/api/reviews/received");
export const fetchSellerReviews = (merchantId: string) => get<ApiReview[]>(`/api/merchants/${encodeURIComponent(merchantId)}/reviews`);
export const respondToReview = async (id: number, response: string): Promise<ReviewResult> => {
  try {
    const res = await fetch(`/api/reviews/${id}/response`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ response }) });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) return { ok: false, error: data.error ?? "Could not post your response." };
    return { ok: true };
  } catch { return { ok: false, error: "Could not reach the server — check your connection." }; }
};
export const createAd = (ad: { title: string; brand: string; category: string; price: number; quantity: number }) => post("/api/ads", ad);

// ── Session cache: lets pages render the last-known live data instantly on
// refresh instead of flashing the built-in fallback first. ────────────────
export function readCache<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch { return null; }
}
export function writeCache(key: string, data: unknown): void {
  try { sessionStorage.setItem(key, JSON.stringify(data)); } catch { /* ignore */ }
}
