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
  description?: string | null;
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
  has_status?: boolean;
  status_unviewed?: boolean;
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
  delivered?: boolean | null;
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

// Seller status / stories.
export interface ApiStatusReaction { emoji: string; name: string }
export interface ApiStatus { id: number; kind: "image" | "video" | "text"; media_url: string | null; caption: string | null; bg: string | null; created_at: string; reactions?: ApiStatusReaction[]; viewers?: string[] }
export const reactStatus = async (id: number, emoji: string): Promise<boolean> => {
  try { return (await fetch(`/api/status/${id}/react`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ emoji }) })).ok; } catch { return false; }
};
export const viewStatus = async (id: number): Promise<void> => {
  try { await fetch(`/api/status/${id}/view`, { method: "POST" }); } catch { /* best-effort */ }
};
export const fetchMerchantStatus = (merchantId: string) => get<ApiStatus[]>(`/api/status?merchant=${encodeURIComponent(merchantId)}`);
export const fetchMyStatus = () => get<ApiStatus[]>("/api/status?mine=1");
export const postStatus = async (payload: { kind: "image" | "video" | "text"; media?: string; caption?: string; bg?: string }): Promise<{ ok: boolean; error?: string }> => {
  try {
    const res = await fetch("/api/status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (res.ok) return { ok: true };
    return { ok: false, error: ((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Could not post status." };
  } catch { return { ok: false, error: "Network error — please try again." }; }
};
export const deleteStatus = async (id: number): Promise<boolean> => {
  try { return (await fetch(`/api/status/${id}`, { method: "DELETE" })).ok; } catch { return false; }
};

// Cascading geo dropdowns for the settings page (country → states → cities).
export interface ApiState { code: string; name: string }
export const fetchStates = (country: string) => get<ApiState[]>(`/api/geo/states?country=${encodeURIComponent(country)}`);
export const fetchCities = (country: string, state: string) => get<string[]>(`/api/geo/cities?country=${encodeURIComponent(country)}&state=${encodeURIComponent(state)}`);
// role "buyer" → orders I placed; role "seller" → orders placed against me.
export const fetchPurchases = (role: "buyer" | "seller" = "buyer") => get<ApiPurchase[]>(`/api/purchases?role=${role}`);
export const fetchOrderMessages = (orderId: string) => get<ApiMessage[]>(`/api/orders/${orderId}/messages`);
export interface ApiProfile { id: number; full_name: string; email: string; joined: string | null; is_seller?: boolean; is_admin?: boolean; seller_since?: string | null; merchant_id?: string | null; avatar_url?: string | null; phone?: string | null; country?: string | null; address?: string | null; dob?: string | null; state?: string | null; city?: string | null; bio?: string | null; }
export interface UpdateResult { ok: boolean; error?: string }
export const updateProfile = async (fields: { country?: string; state?: string; city?: string; address?: string; dob?: string; bio?: string }): Promise<UpdateResult> => {
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

export interface PurchaseResult { ok: boolean; error?: string; needsFunds?: boolean; balance?: number; price?: number; order?: ApiPurchase }
export const createPurchase = async (order: {
  title: string; glyph: string; description: string; product_type: string; seller: string; price: number; product_id?: number;
}): Promise<PurchaseResult> => {
  try {
    const res = await fetch("/api/purchases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(order),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string; needs_funds?: boolean; balance?: number; price?: number } & Partial<ApiPurchase>;
    if (!res.ok) return { ok: false, error: data.error ?? "Purchase failed.", needsFunds: Boolean(data.needs_funds), balance: data.balance, price: data.price };
    return { ok: true, order: (data.id ? (data as ApiPurchase) : undefined) };
  } catch {
    return { ok: false, error: "Could not reach the server — check your connection." };
  }
};

// Escrow lifecycle: buyer confirms (releases funds to the seller) or cancels
// (refunds themselves once the 1-hour delivery window has passed).
export interface OrderActionResult { ok: boolean; error?: string }
const orderAction = async (id: string, action: "confirm" | "cancel" | "deliver"): Promise<OrderActionResult> => {
  try {
    const res = await fetch(`/api/purchases/${encodeURIComponent(id)}/${action}`, { method: "POST" });
    if (res.ok) return { ok: true };
    return { ok: false, error: ((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Could not update the order." };
  } catch { return { ok: false, error: "Could not reach the server — check your connection." }; }
};
// ── Admin ─────────────────────────────────────────────────────────────────────
export interface AdminUser { email: string; full_name: string; is_seller?: boolean; joined?: string | null; country?: string | null; avatar_url?: string | null; }
export interface AdminAdRow { id: number; title: string; owner_email?: string | null; price: number; quantity: number; status: string; brand: string; created_at: string; }
export interface AdminOrderRow { id: string; title: string; buyer?: string | null; buyer_email?: string | null; seller?: string | null; seller_email?: string | null; price: number; status: string; created_at: string; }
export interface AdminOverview {
  stats: { users: number; sellers: number; ads: number; activeAds: number; orders: number; pending: number; completed: number; cancelled: number; gmv: number; fees: number };
  users: AdminUser[]; ads: AdminAdRow[]; orders: AdminOrderRow[];
}
export const fetchAdminOverview = () => get<AdminOverview>("/api/admin/overview");
const adminAction = async (path: string): Promise<OrderActionResult> => {
  try {
    const res = await fetch(path, { method: "POST" });
    if (res.ok) return { ok: true };
    return { ok: false, error: ((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Action failed." };
  } catch { return { ok: false, error: "Could not reach the server." }; }
};
export const adminRemoveAd = (id: number) => adminAction(`/api/admin/ads/${id}/remove`);
export const adminResolveOrder = (id: string) => adminAction(`/api/admin/orders/${encodeURIComponent(id)}/resolve`);

export const confirmOrder = (id: string) => orderAction(id, "confirm");
export const cancelOrder = (id: string) => orderAction(id, "cancel");
export const markDelivered = (id: string) => orderAction(id, "deliver");

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

export interface ApiCartItem { id: number; title: string; description: string | null; brand: string; seller: string; seller_avatar: string | null; price: number; qty: number; created_at: string; }
export interface ApiNotification { id: number; kind: string; title: string; body: string | null; created_at: string; }
export interface ApiReview { id: number; product_title?: string | null; seller?: string | null; sentiment: string; feedback: string | null; created_at: string; response?: string | null; response_at?: string | null; order_id?: string | null; }
export interface ApiAd { id: number; title: string; brand: string; category: string; price: number; quantity: number; status: string; created_at: string; description?: string | null; }

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
export interface ApiWalletTx { id: number; kind: "deposit" | "withdrawal"; amount: number; means: string; status: string; txid: string | null; reference: string | null; created_at: string; }
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

// Start a Korapay wallet top-up: sends the USD amount + local currency, gets back
// the hosted checkout URL to redirect the buyer to.
export interface DepositResult { ok: boolean; checkout_url?: string; error?: string }
export const startDeposit = async (amount: number, currency: string): Promise<DepositResult> => {
  try {
    const res = await fetch("/api/wallet/deposit", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amount, currency }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string; checkout_url?: string };
    if (!res.ok || !data.checkout_url) return { ok: false, error: data.error ?? "Could not start the deposit." };
    return { ok: true, checkout_url: data.checkout_url };
  } catch { return { ok: false, error: "Could not reach the server — check your connection." }; }
};
// ─── Heleket crypto static wallets ───────────────────────────────────────────
export interface CryptoWallet { id: number; asset: string; currency: string; network: string; label: string; address: string; created_at: string; }
export const fetchCryptoWallets = () => get<{ wallets: CryptoWallet[]; configured: boolean }>("/api/wallet/crypto-wallets");
export interface CreateWalletResult { ok: boolean; wallet?: CryptoWallet; error?: string }
export const createCryptoWallet = async (asset: string): Promise<CreateWalletResult> => {
  try {
    const res = await fetch("/api/wallet/crypto-wallets", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ asset }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string; wallet?: CryptoWallet };
    if (!res.ok || !data.wallet) return { ok: false, error: data.error ?? "Could not create the wallet." };
    return { ok: true, wallet: data.wallet };
  } catch { return { ok: false, error: "Could not reach the server — check your connection." }; }
};

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
export const createAd = (ad: { title: string; brand: string; category: string; price: number; quantity: number; description?: string }) => post("/api/ads", ad);
// One account's login details — a single unit of stock.
export interface AdCredential { login: string; password: string; email?: string; emailPass?: string; previewLink?: string; notes?: string }
// Add stock to an existing ad by uploading real credentials / delete it (owner-only, server-enforced).
export const addAdStock = async (id: number, credentials: AdCredential[]): Promise<{ ok: boolean; error?: string }> => {
  try {
    const res = await fetch(`/api/ads/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ credentials }) });
    if (res.ok) return { ok: true };
    return { ok: false, error: ((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Could not add stock." };
  } catch { return { ok: false, error: "Network error — please try again." }; }
};
export const deleteAd = async (id: number): Promise<{ ok: boolean; error?: string }> => {
  try {
    const res = await fetch(`/api/ads/${id}`, { method: "DELETE" });
    if (res.ok) return { ok: true };
    return { ok: false, error: ((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Could not delete ad." };
  } catch { return { ok: false, error: "Network error — please try again." }; }
};

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
