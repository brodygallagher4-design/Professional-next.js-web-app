"use client";

import { useState, useEffect, useId, useRef, useCallback, createContext, useContext, type ReactNode, type CSSProperties } from "react";
import { fetchProfile, fetchAuthSession, authLogout, fetchCart, readCache, writeCache, type ApiProfile } from "./lib/api";
import {
  ShoppingBag01Icon, ShoppingCart01Icon, Notification01Icon, ArrowLeft01Icon,
  CustomerService01Icon, Menu01Icon, UserIcon,
} from "hugeicons-react";

// ─── DESIGN TOKENS ─────────────────────────────────────────────────────────────
// Neutral surfaces resolve through CSS variables so the app can switch between
// dark (default) and light themes — values live in src/styles/theme.css.
// The orange accent P stays a literal hex: it is identical in both themes and
// is concatenated with alpha suffixes (e.g. `${P}44`) in shadow strings.
export const P    = "#f04e23";
export const BG   = "var(--sb-bg)";
export const BG2  = "var(--sb-bg2)";
export const CARD  = "var(--sb-card)";
export const CARD2 = "var(--sb-card2)";
export const BD   = "var(--sb-bd)";
export const FONT = "'Plus Jakarta Sans', system-ui, sans-serif";

// Marketplace-specific tokens (slightly cooler/darker to match reference)
export const MBG   = "var(--sb-mbg)";
export const MCARD = "var(--sb-mcard)";
export const MCARD2= "var(--sb-mcard2)";
export const MBD   = "var(--sb-mbd)";

// ─── THEME ─────────────────────────────────────────────────────────────────────
export const ThemeContext = createContext<{ dark:boolean; toggle:()=>void }>({ dark: true, toggle: () => {} });
export const useTheme = () => useContext(ThemeContext);

// ─── SELECTED MERCHANT (for the Seller Store page) ─────────────────────────────
export interface StoreMerchant {
  id?: number | string;
  name: string;
  avatar?: string;
  rating?: string;
  sales?: string;
  success?: string;
  location?: string;
  joined?: string;
  bio?: string;
}
/* URL identity for a seller storefront: numeric database id when known,
   otherwise a readable slug of the seller name. */
export const sellerSlug = (m: { id?: number | string; name: string }): string =>
  m.id !== undefined && m.id !== null && String(m.id).length > 0
    ? String(m.id)
    : m.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

let _storeMerchant: StoreMerchant | null = null;
export const setStoreMerchant = (m: StoreMerchant | null) => { _storeMerchant = m; };
export const getStoreMerchant = () => _storeMerchant;

// ─── ACCOUNT PROFILE ───────────────────────────────────────────────────────────
// Loaded once from the backend; cached so every surface (drawer, top-nav
// dropdown, profile page) shows the same real identity.
export interface Profile { full_name: string; email: string; joined?: string; is_seller?: boolean; is_admin?: boolean; merchant_id?: string; avatar_url?: string; phone?: string; country?: string; address?: string; dob?: string; state?: string; city?: string; bio?: string; }
const DEFAULT_PROFILE: Profile = { full_name: "My Account", email: "" };
let _profileCache: Profile | null = null;
// Every mounted useProfile() subscribes, so a single authoritative update (from
// the session check, a direct fetch, or activation) refreshes the whole app at
// once — no surface is ever left stuck on the "My Account" placeholder.
const _profileListeners = new Set<(p: Profile) => void>();
const mapApiProfile = (p: ApiProfile): Profile => ({
  full_name: p.full_name, email: p.email, joined: p.joined ?? undefined,
  is_seller: Boolean(p.is_seller), is_admin: Boolean(p.is_admin), merchant_id: p.merchant_id ?? undefined,
  avatar_url: p.avatar_url ?? undefined, phone: p.phone ?? undefined, country: p.country ?? undefined,
  address: p.address ?? undefined, dob: p.dob ?? undefined, state: p.state ?? undefined, city: p.city ?? undefined,
  bio: p.bio ?? undefined,
});
export function setProfileFromApi(p: ApiProfile): void {
  _profileCache = mapApiProfile(p);
  writeCache("sb-profile", _profileCache);
  _profileListeners.forEach((l) => l(_profileCache!));
}
export function clearProfileCache(): void {
  _profileCache = null;
  try { sessionStorage.removeItem("sb-profile"); } catch { /* ignore */ }
  _profileListeners.forEach((l) => l(DEFAULT_PROFILE));
}
// Refetch the profile from the server and push it everywhere. Use this after an
// action that changes the account (login, seller activation) so every surface
// reflects the new state immediately — never left on the "My Account" default.
export async function refreshProfile(): Promise<void> {
  const p = await fetchProfile();
  if (p) setProfileFromApi(p);
}
export function useProfile(): Profile {
  const [profile, setProfile] = useState<Profile>(_profileCache ?? readCache<Profile>("sb-profile") ?? DEFAULT_PROFILE);
  useEffect(() => {
    const listener = (p: Profile) => setProfile(p);
    _profileListeners.add(listener);
    let cancelled = false;
    // Fetch our own copy only if the session check hasn't already provided it.
    if (!_profileCache) {
      fetchProfile().then((p) => { if (!cancelled && p) setProfileFromApi(p); });
    }
    return () => { cancelled = true; _profileListeners.delete(listener); };
  }, []);
  return profile;
}

// Live cart count for the header badge — the real number of items in the
// signed-in account's cart (0 hides the badge). Cached to avoid a flash.
export function useCartCount(): number {
  const [count, setCount] = useState<number>(() => readCache<number>("sb-cart-count") ?? 0);
  useEffect(() => {
    let cancelled = false;
    fetchCart().then((rows) => {
      if (cancelled || !rows) return;
      writeCache("sb-cart-count", rows.length);
      setCount(rows.length);
    });
    return () => { cancelled = true; };
  }, []);
  return count;
}

// ─── AUTH STATE ────────────────────────────────────────────────────────────────
// "Am I signed in?" — resolved once from the httpOnly session cookie via the
// server, cached for instant page gating, revalidated in the background.
let _authed: boolean | null = readCache<boolean>("sb-authed");
let _authChecked = false;
const _authListeners = new Set<(v: boolean) => void>();
export function setAuthedState(v: boolean): void {
  _authed = v;
  writeCache("sb-authed", v);
  _authListeners.forEach((l) => l(v));
}
export function isAuthed(): boolean { return _authed === true; }
export function useAuthed(): boolean | null {
  const [authed, setAuthed] = useState<boolean | null>(_authed);
  useEffect(() => {
    const listener = (v: boolean) => setAuthed(v);
    _authListeners.add(listener);
    if (!_authChecked) {
      _authChecked = true;
      // The session check is authoritative: it validates the httpOnly cookie and
      // returns the real profile in one call. This keeps the cached `sb-authed`
      // flag honest (a stale "true" is corrected to false when the session has
      // expired) and populates the profile so no surface is left on "My Account".
      fetchAuthSession().then((sess) => {
        if (!sess) return; // network hiccup — keep the cached state, retry on next load
        setAuthedState(sess.authenticated);
        if (sess.authenticated && sess.profile) setProfileFromApi(sess.profile);
        else if (!sess.authenticated) clearProfileCache();
      });
    }
    return () => { _authListeners.delete(listener); };
  }, []);
  return authed;
}
export async function performLogout(setPage: (p: Page) => void): Promise<void> {
  await authLogout();
  try { sessionStorage.clear(); } catch { /* ignore */ }
  clearProfileCache();
  setAuthedState(false);
  setPage("login");
}

// ─── SELECTED ORDER (for the trade / order-details page) ───────────────────────
let _currentOrder: unknown = null;
export const setCurrentOrder = (o: unknown) => { _currentOrder = o; };
export const getCurrentOrder = <T,>() => _currentOrder as T | null;

// ─── ESCROW COUNTDOWN — a live 1-hour window from an order's creation time ──────
export const ESCROW_WINDOW_MS = 60 * 60 * 1000; // 1 hour
export function useOrderCountdown(createdAt?: string | null) {
  const deadline = createdAt ? new Date(createdAt).getTime() + ESCROW_WINDOW_MS : 0;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!deadline) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [deadline]);
  const ms = Math.max(0, deadline - now);
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600), m = Math.floor((totalSec % 3600) / 60), s = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    hasDeadline: deadline > 0,
    expired: deadline > 0 && ms <= 0,
    hms: `${pad(h)} : ${pad(m)} : ${pad(s)}`,     // 00 : 59 : 08
    mmss: `${pad(m + h * 60)}:${pad(s)}`,          // 59:08
  };
}

export type Page =
  | "home" | "login" | "signup" | "signup-success" | "marketplace" | "wallet" | "user-profile"
  | "cart" | "notifications" | "support" | "merchant" | "become-merchant" | "ads"
  | "purchase" | "order" | "referral" | "settings" | "merchants" | "store" | "admin";

export type BrandKey =
  | "telegram" | "whatsapp" | "instagram" | "apple" | "snapchat" | "netflix"
  | "steam" | "giftcard" | "surfshark" | "cyberghost" | "expressvpn" | "pia"
  | "vpn" | "tiktok" | "x" | "facebook" | "gmail" | "spotify" | "discord"
  | "amazon" | "google" | "youtube"
  | "linkedin" | "pinterest" | "reddit" | "threads" | "signal" | "viber"
  | "outlook" | "wechat" | "ebay" | "playstation" | "tinder" | "yahoo";

// Real, full-colour brand logos rendered on a TRANSPARENT background — the actual
// recognisable mark for each platform (no generic colour tile behind them). `bg`
// is kept only for a few legacy chips; BrandIcon never draws it. Monochrome marks
// (X, Apple) use currentColor so they adapt to light/dark.
export const BRAND_LOGOS: Record<BrandKey, { bg:string; svg:React.ReactNode | ((uid:string)=>React.ReactNode) }> = {
  telegram: { bg:"#229ED9", svg:<><circle cx="12" cy="12" r="11" fill="#229ED9"/><path fill="#fff" d="M17.1 7.4l-1.85 8.72c-.14.62-.5.77-1.02.48l-2.86-2.11-1.38 1.33c-.15.15-.28.28-.58.28l.2-2.92 5.31-4.8c.23-.2-.05-.32-.36-.12L7.99 13l-2.83-.88c-.61-.2-.62-.61.13-.9l11.06-4.27c.51-.19.96.12.75.34z"/></> },
  whatsapp: { bg:"#25D366", svg:<><path fill="#25D366" d="M12 2a10 10 0 0 0-8.6 15.05L2 22l5.05-1.32A10 10 0 1 0 12 2z"/><path fill="#fff" d="M9.53 7.33c-.18-.4-.36-.34-.5-.35h-.42c-.15 0-.4.06-.6.28-.2.22-.79.77-.79 1.87s.81 2.17.92 2.32c.11.15 1.57 2.4 3.8 3.36 1.86.8 2.24.64 2.65.6.4-.03 1.3-.53 1.48-1.05.18-.51.18-.95.13-1.05-.05-.1-.2-.15-.42-.26-.22-.11-1.3-.64-1.5-.72-.2-.07-.35-.11-.5.11-.15.22-.57.72-.7.87-.13.15-.26.17-.48.06-.22-.11-.93-.34-1.77-1.09-.65-.58-1.1-1.3-1.22-1.52-.13-.22-.01-.34.1-.45.1-.1.22-.26.33-.39.11-.13.14-.22.22-.37.07-.15.03-.28-.02-.39-.05-.11-.48-1.2-.71-1.64z"/></> },
  instagram:{ bg:"#E1306C", svg:(uid:string)=><><defs><radialGradient id={uid} cx="30%" cy="105%" r="130%"><stop offset="0" stopColor="#ffd776"/><stop offset=".3" stopColor="#f3603c"/><stop offset=".6" stopColor="#e1306c"/><stop offset="1" stopColor="#5b51d8"/></radialGradient></defs><rect x="2" y="2" width="20" height="20" rx="6" fill={`url(#${uid})`}/><rect x="6.4" y="6.4" width="11.2" height="11.2" rx="3.6" fill="none" stroke="#fff" strokeWidth="1.7"/><circle cx="17" cy="7" r="1.15" fill="#fff"/></> },
  apple:    { bg:"#1c1c1e", svg:<path fill="currentColor" d="M16.4 12.6c0-2.2 1.8-3.3 1.9-3.3-1-1.5-2.6-1.7-3.2-1.7-1.4-.1-2.6.8-3.3.8-.7 0-1.7-.8-2.8-.8-1.4 0-2.8.8-3.5 2.1-1.5 2.6-.4 6.5 1.1 8.6.7 1 1.6 2.2 2.7 2.1 1.1 0 1.5-.7 2.8-.7s1.6.7 2.8.7c1.1 0 1.9-1 2.6-2 .8-1.2 1.2-2.3 1.2-2.4-.1 0-2.3-.9-2.3-3.5zM14.3 6.3c.6-.7 1-1.7.9-2.7-.9 0-1.9.6-2.5 1.3-.6.6-1 1.6-.9 2.6 1 .1 1.9-.5 2.5-1.2z"/> },
  snapchat: { bg:"#FFFC00", svg:<><circle cx="12" cy="12" r="11" fill="#FFFC00"/><path fill="#111" d="M12 5.4c2 0 3.4 1.5 3.5 3.5.02.44 0 .96-.03 1.46.05-.02.13-.03.2-.03.45 0 .95.28.95.72 0 .35-.28.6-.78.78-.42.15-.86.24-.86.6 0 .5 1.4 1.9 2.6 2.26.26.08.44.26.44.5 0 .43-.87.78-1.56.87-.1.18-.09.44-.26.55-.17.11-.6.08-1.03.08-.35 0-.68.09-1.03.35-.44.34-1.03.77-2.18.77s-1.74-.43-2.18-.77c-.35-.26-.68-.35-1.03-.35-.43 0-.86.03-1.03-.08-.17-.11-.16-.37-.26-.55-.69-.09-1.56-.44-1.56-.87 0-.24.18-.42.44-.5 1.2-.36 2.6-1.76 2.6-2.26 0-.36-.44-.45-.86-.6-.5-.18-.78-.43-.78-.78 0-.44.5-.72.95-.72.07 0 .15.01.2.03-.03-.5-.05-1.02-.03-1.46.1-2 1.5-3.5 3.5-3.5z"/></> },
  netflix:  { bg:"#141414", svg:<path fill="#E50914" d="M8.5 2v20l3.3.3V13l3.4 9.6 3.3.3V2l-3.3.3v9.4L11.6 2z"/> },
  steam:    { bg:"#1b2838", svg:<><circle cx="12" cy="12" r="11" fill="#1b2838"/><path fill="#fff" d="M12 4a8 8 0 0 0-7.9 6.9l4.3 1.78a2.3 2.3 0 0 1 1.3-.42h.13l1.9-2.75v-.04a3 3 0 1 1 3 3h-.07l-2.7 1.93v.1a2.3 2.3 0 0 1-4.6.1l-3.05-1.27A8 8 0 1 0 12 4zm-3.9 11.6l-1-.4a1.75 1.75 0 0 0 3.2-.25 1.75 1.75 0 0 0-2.3-2.14l1.05.44a1.28 1.28 0 1 1-.95 2.35zm7.5-5.35a2 2 0 1 0-2-2 2 2 0 0 0 2 2zm0-3.13a1.13 1.13 0 1 1-1.12 1.13A1.13 1.13 0 0 1 15.6 7.1z"/></> },
  giftcard: { bg:"#f04e23", svg:<><rect x="2.5" y="7.5" width="19" height="13" rx="2.5" fill="#f04e23"/><path d="M2.5 12h19" stroke="#fff" strokeWidth="1.4"/><path d="M12 7.5v13" stroke="#fff" strokeWidth="1.4"/><path fill="none" stroke="#fff" strokeWidth="1.4" d="M12 7.5C11 4.2 9.6 3.5 8.6 3.9 7 4.5 8 7 12 7.5zm0 0c1-3.3 2.4-4 3.4-3.6 1.6.6.6 3.1-3.4 3.6z"/></> },
  surfshark:{ bg:"#178a80", svg:<><circle cx="12" cy="12" r="11" fill="#1EBFBF"/><path fill="#fff" d="M4.5 12.5c3-.6 4.6-2.3 5.6-4.2.9 2.4 3 3.7 6 3.7 1.5 0 2.9-.3 4.2-.9-.9 4-4.4 6.9-8.6 6.9-3.2 0-6-1.9-7.2-5.5z"/></> },
  cyberghost:{ bg:"#f5c518", svg:<><circle cx="12" cy="12" r="11" fill="#FFCC2F"/><path fill="#1c1c1c" d="M12 4.5c-3.3 0-5 2.5-5 6v8l1.7-1.3 1.6 1.3 1.7-1.3 1.7 1.3 1.6-1.3 1.7 1.3v-8c0-3.5-1.7-6-5-6zm-1.7 5a1.1 1.1 0 1 1 0 2.2 1.1 1.1 0 0 1 0-2.2zm3.4 0a1.1 1.1 0 1 1 0 2.2 1.1 1.1 0 0 1 0-2.2z"/></> },
  expressvpn:{ bg:"#da3940", svg:<><path fill="#DA3940" d="M12 2.2l8 3v6c0 5-3.4 9.4-8 10.8C7.4 20.6 4 16.2 4 11.2v-6z"/><path fill="#fff" d="M15.6 8.9l-4.1 5.6a1 1 0 0 1-1.55.08l-2.2-2.3 1.45-1.4 1.36 1.42 3.4-4.65z"/></> },
  pia:      { bg:"#16a34a", svg:<><path fill="#4CB749" d="M12 2.2l8 3v6c0 5-3.4 9.4-8 10.8C7.4 20.6 4 16.2 4 11.2v-6z"/><path fill="#fff" d="M12 7a2.6 2.6 0 0 1 1 5v3.2h-2V12a2.6 2.6 0 0 1 1-5z"/></> },
  vpn:      { bg:"#0ea5a0", svg:<><path fill="#0EA5A0" d="M12 2.2l8 3v6c0 5-3.4 9.4-8 10.8C7.4 20.6 4 16.2 4 11.2v-6z"/><path fill="#fff" d="M8.4 9h1.7l1.9 4.9L13.9 9h1.7l-2.9 7h-1.4z"/></> },
  tiktok:   { bg:"#010101", svg:<><path fill="#25F4EE" d="M10.6 9.6v5.2a1.9 1.9 0 1 1-1.9-1.9c.16 0 .32.02.47.06v-2.5a4.4 4.4 0 1 0 3.9 4.37V9.8a5.9 5.9 0 0 0 3.2 1V8.3a3.3 3.3 0 0 1-.8-.1z"/><path fill="#FE2C55" d="M11.4 8.8v5.2a1.9 1.9 0 1 1-1.9-1.9c.16 0 .32.02.47.06v-2.5a4.4 4.4 0 1 0 3.9 4.37V9a5.9 5.9 0 0 0 3.2 1V7.5a3.3 3.3 0 0 1-2.55-2.5H12v.5z"/><path fill="currentColor" d="M11 9.2v5.2a1.9 1.9 0 1 1-1.9-1.9c.16 0 .32.02.47.06v-2.5a4.4 4.4 0 1 0 3.9 4.37V9.4a5.9 5.9 0 0 0 3.2 1V7.9a3.3 3.3 0 0 1-2.55-2.5h-2.3z"/></> },
  x:        { bg:"#000000", svg:<path fill="currentColor" d="M17.5 3h2.9l-6.35 7.26L21.5 21h-5.8l-4.55-5.95L5.9 21H3l6.8-7.77L2.7 3h5.95l4.1 5.42zm-1.02 16.25h1.6L7.6 4.66H5.88z"/> },
  facebook: { bg:"#1877F2", svg:<><circle cx="12" cy="12" r="11" fill="#1877F2"/><path fill="#fff" d="M13.6 12.5h1.9l.32-2.2h-2.22V8.7c0-.63.2-1.06 1.1-1.06h1.18V5.66c-.26-.03-1.14-.11-2.16-.11-2.13 0-3.59 1.3-3.59 3.69v1.06H8.2v2.2h1.94V19h3.46z"/></> },
  gmail:    { bg:"#EA4335", svg:<><path fill="#fff" d="M4 6.5h16v11H4z"/><path fill="#EA4335" d="M4.2 6.2h1.6L12 10.6l6.2-4.4h1.6c.7 0 1.2.5 1.2 1.2v.9L12 14.5 3 8.3v-.9c0-.7.5-1.2 1.2-1.2z"/><path fill="#FBBC04" d="M3 8.3l1.8 1.24V17.3H3.9c-.5 0-.9-.4-.9-.9z"/><path fill="#34A853" d="M21 8.3v8.1c0 .5-.4.9-.9.9h-1.9V9.54z"/><path fill="#4285F4" d="M4.8 9.54L12 14.5l7.2-4.96V17.3H4.8z" opacity=".0"/></> },
  spotify:  { bg:"#1DB954", svg:<><circle cx="12" cy="12" r="11" fill="#1DB954"/><path fill="#fff" d="M16.6 16.3a.7.7 0 0 1-.96.23c-2.63-1.6-5.94-1.97-9.83-1.08a.7.7 0 1 1-.3-1.36c4.26-.98 7.92-.55 10.87 1.25.33.2.43.64.22.96zm1.23-2.73a.87.87 0 0 1-1.2.29c-3.01-1.85-7.6-2.39-11.16-1.31a.87.87 0 1 1-.5-1.67c4.07-1.23 9.13-.63 12.58 1.49.4.24.53.78.28 1.2zm.1-2.85C14.42 8.66 8.78 8.46 5.34 9.5a1.05 1.05 0 1 1-.6-2C8.68 6.3 14.9 6.53 18.85 8.88a1.04 1.04 0 1 1-1.07 1.79z"/></> },
  discord:  { bg:"#5865F2", svg:<><circle cx="12" cy="12" r="11" fill="#5865F2"/><path fill="#fff" d="M17 7.6a12 12 0 0 0-3-.93l-.18.37a11 11 0 0 1 2.65 1.35 10.7 10.7 0 0 0-9-.02 11 11 0 0 1 2.65-1.33l-.18-.37c-1.06.19-2.07.5-3 .93-1.86 2.74-2.37 5.44-2.11 8.1A12 12 0 0 0 7.4 17.6l.72-.99a7.8 7.8 0 0 1-1.24-.6l.3-.24a8.5 8.5 0 0 0 7.64 0l.3.24c-.4.24-.81.44-1.24.6l.72 1a12 12 0 0 0 3.62-1.84c.3-3.06-.51-5.73-2.12-8.17zM9.7 14.3c-.7 0-1.28-.65-1.28-1.44s.56-1.44 1.28-1.44 1.3.65 1.28 1.44c0 .8-.57 1.44-1.28 1.44zm4.7 0c-.7 0-1.28-.65-1.28-1.44s.56-1.44 1.28-1.44 1.29.65 1.28 1.44c0 .8-.56 1.44-1.28 1.44z"/></> },
  amazon:   { bg:"#232F3E", svg:<><circle cx="12" cy="12" r="11" fill="#232F3E"/><path fill="#FF9900" d="M17 16.2c-2.5 1.85-6.1 2.83-9.2 2.83a13.4 13.4 0 0 1-9-3.44c-.19-.17.02-.4.24-.27a18.2 18.2 0 0 0 9 2.4 18 18 0 0 0 6.9-1.42c.33-.14.6.22.28.44zm.85-.96c-.32-.4-2.1-.2-2.9-.1-.24.03-.28-.18-.06-.33 1.42-1 3.76-.71 4.03-.38.27.34-.08 2.68-1.4 3.8-.2.17-.4.08-.31-.14.3-.72.96-2.34.64-2.85z"/><path fill="#FF9900" d="M15.1 8.3v-.66c0-.1.08-.17.17-.17h2.96c.1 0 .18.07.18.17v.57c0 .1-.09.23-.24.43l-1.54 2.2c.57-.02 1.17.07 1.69.36.12.07.15.16.16.26v.71c0 .1-.11.22-.23.16a3.4 3.4 0 0 0-3.13 0c-.11.06-.22-.06-.22-.16v-.67c0-.11 0-.3.12-.48l1.78-2.55h-1.55c-.1 0-.18-.07-.18-.17z" opacity=".9"/></> },
  google:   { bg:"#ffffff", svg:<><path fill="#4285F4" d="M21.6 12.2c0-.64-.06-1.25-.16-1.84H12v3.49h5.38a4.6 4.6 0 0 1-2 3.02v2.5h3.23c1.89-1.74 2.99-4.3 2.99-7.17z"/><path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.61-2.42l-3.23-2.5c-.9.6-2.05.95-3.38.95-2.6 0-4.8-1.75-5.59-4.11H3.08v2.58A9.99 9.99 0 0 0 12 22z"/><path fill="#FBBC05" d="M6.41 13.92a6 6 0 0 1 0-3.84V7.5H3.08a10 10 0 0 0 0 9z"/><path fill="#EA4335" d="M12 5.96c1.47 0 2.79.5 3.83 1.5l2.86-2.86A9.98 9.98 0 0 0 3.08 7.5l3.33 2.58C7.2 7.7 9.4 5.96 12 5.96z"/></> },
  youtube:  { bg:"#FF0000", svg:<><path fill="#FF0000" d="M22.5 8.4a2.6 2.6 0 0 0-1.83-1.84C19.06 6.13 12 6.13 12 6.13s-7.06 0-8.67.43A2.6 2.6 0 0 0 1.5 8.4C1.07 10.02 1.07 12 1.07 12s0 1.98.43 3.6a2.6 2.6 0 0 0 1.83 1.84c1.61.43 8.67.43 8.67.43s7.06 0 8.67-.43a2.6 2.6 0 0 0 1.83-1.84c.43-1.62.43-3.6.43-3.6s0-1.98-.43-3.6z"/><path fill="#fff" d="M9.75 15.02V8.98L15 12z"/></> },
  linkedin: { bg:"#0A66C2", svg:<><rect x="2" y="2" width="20" height="20" rx="4" fill="#0A66C2"/><path fill="#fff" d="M7.1 9.6H4.7V18h2.4V9.6Zm-1.2-4a1.4 1.4 0 1 0 0 2.8 1.4 1.4 0 0 0 0-2.8ZM19.4 18v-4.7c0-2.5-1.34-3.66-3.12-3.66-1.44 0-2.08.8-2.44 1.35V9.6H11.5V18h2.36v-4.66c0-1.23.47-1.92 1.5-1.92.94 0 1.66.55 1.66 1.92V18h2.38Z"/></> },
  pinterest:{ bg:"#E60023", svg:<><circle cx="12" cy="12" r="10" fill="#E60023"/><path fill="#fff" d="M12.4 6.4c-3.35 0-5.4 2.24-5.4 5.02 0 1.3.72 2.9 1.87 3.42.18.08.28.04.32-.13l.18-.7c.05-.18.03-.24-.1-.4-.35-.42-.57-.96-.57-1.72 0-2.22 1.66-4.2 4.32-4.2 2.36 0 3.65 1.44 3.65 3.36 0 2.52-1.12 4.65-2.78 4.65-.92 0-1.6-.76-1.38-1.69.26-1.11.77-2.31.77-3.11 0-.72-.39-1.32-1.19-1.32-.94 0-1.7.98-1.7 2.28 0 .83.28 1.4.28 1.4l-1.13 4.78c-.24 1.01-.11 2.5-.05 2.66 0 .1.11.12.16.05.07-.09 1-1.22 1.31-2.35l.5-1.96c.25.48.98.88 1.76.88 2.31 0 3.98-2.12 3.98-5.06 0-2.28-1.94-4.19-4.9-4.19Z"/></> },
  reddit:   { bg:"#FF4500", svg:<><circle cx="12" cy="12" r="10" fill="#FF4500"/><circle cx="8.6" cy="12.4" r="1.25" fill="#fff"/><circle cx="15.4" cy="12.4" r="1.25" fill="#fff"/><path d="M9 15c.85.7 1.9 1 3 1s2.15-.3 3-1" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" fill="none"/><circle cx="18.3" cy="8.2" r="1.5" fill="#fff"/><path d="M12 9.4l1.3-3.2 3.1.9" stroke="#fff" strokeWidth="1.1" strokeLinecap="round" fill="none"/><circle cx="19" cy="11" r="1.6" fill="#fff"/><circle cx="5" cy="11" r="1.6" fill="#fff"/></> },
  threads:  { bg:"#000000", svg:<><rect x="2" y="2" width="20" height="20" rx="6" fill="#000"/><path fill="#fff" d="M16.05 11.55c-.07-.03-.14-.07-.22-.1-.13-2.36-1.42-3.72-3.6-3.73-1.31-.01-2.4.54-3.06 1.55l1.2.82c.49-.74 1.26-.9 1.85-.9h.02c.74 0 1.3.22 1.68.65.26.31.44.74.53 1.28-.66-.11-1.36-.15-2.12-.1-2.12.12-3.48 1.35-3.39 3.07.05.88.48 1.63 1.22 2.11.63.42 1.44.62 2.29.57 1.12-.06 2-.49 2.6-1.27.46-.6.76-1.36.89-2.32.54.32.94.75 1.15 1.27.37.88.4 2.33-.78 3.5-1.03 1.03-2.27 1.48-4.15 1.49-2.08-.01-3.66-.68-4.68-1.98-.96-1.22-1.45-2.98-1.47-5.24.02-2.26.51-4.02 1.47-5.24 1.02-1.3 2.6-1.98 4.68-1.99 2.1.02 3.71.69 4.78 2 .53.65.93 1.46 1.19 2.4l1.28-.34c-.31-1.15-.81-2.15-1.49-2.98-1.37-1.68-3.38-2.54-5.75-2.55h-.01c-2.37.01-4.36.87-5.68 2.55-1.17 1.5-1.77 3.58-1.79 6.19v.01c.02 2.61.62 4.7 1.79 6.19 1.32 1.68 3.31 2.53 5.68 2.55h.01c2.32-.02 3.96-.63 5.31-1.98 1.77-1.77 1.72-3.98 1.13-5.34-.42-.97-1.23-1.76-2.34-2.29Zm-3.68 3.79c-.94.05-1.9-.37-1.95-1.31-.04-.7.5-1.48 2.01-1.56.17-.01.34-.02.51-.02.55 0 1.06.05 1.52.16-.17 2.16-1.19 2.68-2.09 2.73Z"/></> },
  signal:   { bg:"#2C6BED", svg:<><circle cx="12" cy="12" r="10" fill="#3A76F0"/><path fill="none" stroke="#fff" strokeWidth="1.7" d="M12 6.8a5.2 5.2 0 0 0-4.55 7.73l-.65 2.34 2.4-.63A5.2 5.2 0 1 0 12 6.8Z"/></> },
  viber:    { bg:"#7360F2", svg:<><circle cx="12" cy="12" r="10" fill="#7360F2"/><path fill="#fff" d="M10.15 8.3c.28-.13.6-.03.76.23l.85 1.42c.14.24.1.55-.1.74l-.5.48c-.13.13-.15.24-.06.42.35.7 1.15 1.5 1.87 1.83.18.09.3.06.42-.07l.48-.5c.19-.2.5-.24.74-.1l1.42.85c.26.16.36.48.23.76-.29.62-1 1.05-1.72 1-2.3-.16-5.1-2.96-5.26-5.26-.05-.72.38-1.43 1-1.72Z"/></> },
  outlook:  { bg:"#0A67C0", svg:<><rect x="9" y="5.5" width="12" height="13" rx="1.5" fill="#0A67C0"/><path fill="#fff" d="M15 8h5.4c.33 0 .6.27.6.6v1L15 13.2z"/><path fill="#28A8EA" d="M21 9.6v6.8c0 .33-.27.6-.6.6H15V13.2z"/><rect x="2.5" y="6.5" width="9.5" height="11" rx="1.4" fill="#0364B8"/><ellipse cx="7.25" cy="12" rx="2.7" ry="2.9" fill="none" stroke="#fff" strokeWidth="1.5"/></> },
  wechat:   { bg:"#07C160", svg:<><circle cx="12" cy="12" r="10" fill="#07C160"/><path fill="#fff" d="M9.3 6.5C6.5 6.5 4.3 8.4 4.3 10.7c0 1.3.7 2.4 1.8 3.2l-.4 1.4 1.6-.8c.6.15 1.1.24 1.9.24h.4a3.8 3.8 0 0 1-.15-1.05c0-2.2 2.1-3.95 4.75-3.95.17 0 .33 0 .5.02C14.4 8 12.1 6.5 9.3 6.5Zm-1.8 2.1a.7.7 0 1 1 0 1.4.7.7 0 0 1 0-1.4Zm3.6 0a.7.7 0 1 1 0 1.4.7.7 0 0 1 0-1.4Z"/><path fill="#fff" d="M19.7 13.7c0-1.9-1.9-3.45-4.2-3.45s-4.2 1.55-4.2 3.45 1.9 3.45 4.2 3.45c.5 0 .95-.07 1.4-.2l1.3.68-.35-1.15c.85-.63 1.85-1.6 1.85-2.78Zm-5.55-.85a.6.6 0 1 1 0-1.2.6.6 0 0 1 0 1.2Zm2.7 0a.6.6 0 1 1 0-1.2.6.6 0 0 1 0 1.2Z"/></> },
  ebay:     { bg:"#ffffff", svg:<><text x="12" y="15.5" textAnchor="middle" fontSize="8" fontWeight="800" fontFamily="Arial, sans-serif"><tspan fill="#E53238">e</tspan><tspan fill="#0064D2">b</tspan><tspan fill="#F5AF02">a</tspan><tspan fill="#86B817">y</tspan></text></> },
  playstation:{ bg:"#003791", svg:<><circle cx="12" cy="12" r="10" fill="#003791"/><path fill="#fff" d="M10.4 6.5v11l2.1.7V9.1c0-.5.1-.8.5-.7.5.15.6.5.6.95v3.1c1.3.63 2.35 0 2.35-1.67 0-1.72-.6-2.48-2.4-3.1-.7-.24-2-.65-3.15-1.18Zm-2 8.9L6.7 15c-.5.18-.6.5-.2.7.6.28 1.6.5 2.5.24l2.2-.8v-1.35l-2.35.84c-.4.14-.9.15-1.25.02-.35-.13-.28-.38.1-.5l.9-.34v-.02Z"/></> },
  tinder:   { bg:"#FE3C72", svg:<><circle cx="12" cy="12" r="10" fill="#FD267D"/><path fill="#fff" d="M13 5.5c-.3-.2-.65.02-.6.36.2 1.5-.35 2.6-1.2 3.4-.3-.5-.35-1.1-.28-1.85.03-.35-.35-.6-.66-.4C8.9 8 8 9.7 8 11.9a4.35 4.35 0 0 0 8.7 0c0-2.9-2.35-4.9-3.7-6.4Z"/></> },
  yahoo:    { bg:"#6001D2", svg:<><rect x="2" y="2" width="20" height="20" rx="4" fill="#6001D2"/><path fill="#fff" d="M6 8.2h2.2l1.6 3.1 1.6-3.1H13.6L10.7 13v3.1H8.8V13L6 8.2Zm9.5 4a1.3 1.3 0 1 1 0 2.6 1.3 1.3 0 0 1 0-2.6Zm.5-4.1L14.4 12h-1.9l1.6-3.9H16Z"/></> },
};

export function BrandIcon({ brand, size=48, radius }: { brand:BrandKey; size?:number; radius?:number }) {
  // Fall back safely for unknown/missing keys (e.g. cart items cached before a
  // brand was stored) so a bad key can never crash the tree reading `.svg`.
  const b = BRAND_LOGOS[brand] ?? BRAND_LOGOS.vpn ?? Object.values(BRAND_LOGOS)[0];
  // Some marks embed an SVG gradient/filter that needs a DOM-unique id — a fixed
  // id collides when the same logo renders twice (e.g. a marketplace card AND the
  // filter panel), and unmounting one breaks the other's `url(#id)` reference,
  // painting it black. Give each instance its own id via useId.
  const uid = "sb-" + useId().replace(/:/g, "");
  const content = typeof b.svg === "function" ? b.svg(uid) : b.svg;
  // No colour tile behind the logo — the real, full-colour mark on a transparent
  // background. `radius` is accepted for call-site compatibility but unused now.
  void radius;
  return (
    <span className="inline-flex items-center justify-center shrink-0 select-none" style={{ width:size, height:size, color:"var(--sb-nav-active)" }}>
      <svg width={size} height={size} viewBox="0 0 24 24">{content}</svg>
    </span>
  );
}

// ─── PREMIUM 3D BRAND ICON ───────────────────────────────────────────────────────
// Self-contained 3D shopping-bag app mark. Uses useId so multiple instances
// (desktop + mobile nav) never share SVG gradient/filter IDs.
export function Brand3D({ size = 34 }: { size?: number }) {
  const u = useId().replace(/:/g, "");
  const id = (n: string) => `b3d_${n}_${u}`;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
      <defs>
        {/* Rounded tile backdrop */}
        <linearGradient id={id("tile")} x1="8" y1="6" x2="56" y2="58" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ff8a4d"/><stop offset="0.5" stopColor="#f04e23"/><stop offset="1" stopColor="#c0360f"/>
        </linearGradient>
        {/* Bag body */}
        <linearGradient id={id("body")} x1="22" y1="24" x2="44" y2="52" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fff4ec"/><stop offset="1" stopColor="#ffd8c2"/>
        </linearGradient>
        <linearGradient id={id("bodyShade")} x1="32" y1="24" x2="32" y2="52" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffffff" stopOpacity="0"/><stop offset="1" stopColor="#e0784f" stopOpacity="0.35"/>
        </linearGradient>
        {/* Glossy top-light on tile */}
        <linearGradient id={id("gloss")} x1="8" y1="6" x2="20" y2="34" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffffff" stopOpacity="0.55"/><stop offset="1" stopColor="#ffffff" stopOpacity="0"/>
        </linearGradient>
        <linearGradient id={id("handle")} x1="24" y1="16" x2="40" y2="30" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffe0cf"/><stop offset="1" stopColor="#d9541f"/>
        </linearGradient>
        <filter id={id("ds")} x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="3" stdDeviation="3.2" floodColor="#c0360f" floodOpacity="0.55"/>
        </filter>
      </defs>

      {/* Rounded tile with 3D drop shadow */}
      <g filter={`url(#${id("ds")})`}>
        <rect x="6" y="5" width="52" height="54" rx="16" fill={`url(#${id("tile")})`}/>
      </g>
      {/* Top gloss highlight */}
      <rect x="6" y="5" width="52" height="54" rx="16" fill={`url(#${id("gloss")})`}/>
      {/* Inner rim light */}
      <rect x="7.2" y="6.2" width="49.6" height="51.6" rx="14.6" fill="none" stroke="#ffffff" strokeOpacity="0.28" strokeWidth="1.2"/>

      {/* Bag handles (behind body) */}
      <path d="M25 30 C25 19 39 19 39 30" stroke={`url(#${id("handle")})`} strokeWidth="3.6" strokeLinecap="round" fill="none"/>
      <path d="M25 30 C25 19 39 19 39 30" stroke="rgba(120,40,10,0.25)" strokeWidth="1.3" strokeLinecap="round" fill="none"/>

      {/* Bag body */}
      <path d="M21 29 L23.5 47 Q24 51 28 51 L36 51 Q40 51 40.5 47 L43 29 Z" fill={`url(#${id("body")})`}/>
      <path d="M21 29 L23.5 47 Q24 51 28 51 L36 51 Q40 51 40.5 47 L43 29 Z" fill={`url(#${id("bodyShade")})`}/>
      {/* Bag rim */}
      <rect x="20" y="26.5" width="24" height="4.4" rx="2.2" fill="#fff8f2"/>
      {/* Lettermark */}
      <text x="32" y="42.5" textAnchor="middle" dominantBaseline="middle" fontSize="15" fontWeight="900" fontFamily="Arial Black, system-ui, sans-serif" fill="#f04e23">S</text>
    </svg>
  );
}

// ─── SHARED NAVIGATION ───────────────────────────────────────────────────────────
export function DesktopTopNav({ setPage, active }: { setPage:(p:Page)=>void; active:Page }) {
  const [userOpen, setUserOpen] = useState(false);
  const profile = useProfile();
  const authed = useAuthed();
  const cartCount = useCartCount();
  const links: { label:string; page:Page }[] = [
    { label:"Home",     page:"home" },
    { label:"Market",   page:"marketplace" },
    { label: profile.is_seller ? "Orders" : "Purchase", page:"purchase" },
    { label:"Ads",      page:"ads" },
    { label:"Wallet",   page:"wallet" },
    ...(profile.is_admin ? [{ label:"Admin", page:"admin" as Page }] : []),
  ];
  return (
    <nav className="hidden md:flex items-center px-8 gap-8 shrink-0" style={{ height: 64, background: MBG, borderBottom: `1px solid ${MBD}`, fontFamily: FONT, position: "relative", zIndex: 60 }}>
      <button onClick={() => setPage("marketplace")} className="flex items-center gap-2.5 shrink-0 group">
        <span className="transition-transform group-hover:scale-105"><Brand3D size={34}/></span>
        <span className="text-[15px] font-extrabold text-white tracking-tight">SimBazaar</span>
      </button>

      <div className="flex items-center gap-1 flex-1 justify-center">
        {links.map(({ label, page }) => (
          <button key={label} onClick={() => setPage(page)}
            className="px-4 py-2 rounded-full text-[14px] font-semibold transition-all"
            style={{ color: active === page ? "var(--sb-nav-active)" : "var(--sb-nav-inactive)", background: active === page ? "var(--sb-nav-active-bg)" : "transparent" }}>
            {label}
          </button>
        ))}
      </div>

      {authed !== true ? (
        <div className="flex items-center gap-3 shrink-0">
          <button onClick={() => setPage("login")}
            className="px-4 py-2 rounded-full text-[14px] font-semibold transition-colors"
            style={{ color: "var(--sb-nav-inactive)" }}>
            Login
          </button>
          <button onClick={() => setPage("signup")}
            className="px-5 py-2.5 rounded-full text-[13px] font-bold text-white transition-all hover:opacity-90 active:scale-95"
            style={{ background: P, boxShadow: `0 4px 16px ${P}55` }}>
            Sign up
          </button>
        </div>
      ) : (
      <div className="flex items-center gap-3 shrink-0">
        <button onClick={() => setPage("merchant")}
          className="px-5 py-2.5 rounded-full text-[13px] font-bold text-white transition-all hover:opacity-90 active:scale-95"
          style={{ background: P, boxShadow: `0 4px 16px ${P}55` }}>
          Sell Product
        </button>

        <button onClick={() => setPage("cart")}
          className="relative w-9 h-9 flex items-center justify-center rounded-full transition-colors hover:bg-white/5">
          <CartLineIcon size={21} color="var(--sb-nav-inactive)"/>
          {cartCount > 0 && <span className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white" style={{ background: P }}>{cartCount}</span>}
        </button>

        <button onClick={() => setPage("notifications")}
          className="w-9 h-9 flex items-center justify-center rounded-full transition-colors hover:bg-white/5">
          <Notification01Icon size={20} color="#9ca3af"/>
        </button>

        <div className="relative">
          <button onClick={() => setUserOpen(v => !v)}
            className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all hover:opacity-90"
            style={{ color: "var(--sb-nav-inactive)" }}>
            <ProfileAvatar size={30}/>
          </button>
          {userOpen && (
            <>
              <div className="fixed inset-0 z-[50]" onClick={() => setUserOpen(false)}/>
              <div className="absolute right-0 top-12 z-[60] w-[220px] rounded-2xl overflow-hidden shadow-2xl py-2"
                style={{ background: "var(--sb-card)", border: `1px solid ${MBD}`, fontFamily: FONT }}>
                <div className="px-4 py-3" style={{ borderBottom: `1px solid ${MBD}` }}>
                  <p className="text-[14px] font-bold text-white">{profile.full_name}</p>
                  <p className="text-[12px] text-gray-400">{profile.email}</p>
                </div>
                {[
                  { label:"Referral",         page:"referral" as Page },
                  { label:"Account settings", page:"settings" as Page },
                  { label:"Support",          page:"support" as Page },
                ].map(({ label, page }) => (
                  <button key={label} onClick={() => { setUserOpen(false); setPage(page); }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] text-gray-300 hover:bg-white/5 transition-colors">
                    {label}
                  </button>
                ))}
                <div style={{ borderTop: `1px solid ${MBD}`, margin: "4px 0" }}/>
                <button onClick={() => { setUserOpen(false); performLogout(setPage); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] hover:bg-white/5 transition-colors" style={{ color: "#ef4444" }}>
                  Log Out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      )}
    </nav>
  );
}

function SideDrawer({ open, onClose, setPage }: { open:boolean; onClose:()=>void; setPage:(p:Page)=>void }) {
  const { dark, toggle } = useTheme();
  const profile = useProfile();
  const authed = useAuthed();
  const go = (page:Page) => {
    onClose();
    setPage(page);
  };
  const palette = dark
    ? {
        ground: "#202b3d", surface: "#030303", rule: "rgba(255,255,255,0.12)", text: "#f8fafc",
        sub: "#9ca3af", icon: "#f4f4f5", hover: "hover:bg-white/[0.055]", avatar: "#f7f7f7",
      }
    : {
        ground: "#eff3f8", surface: "#ffffff", rule: "rgba(15,23,42,0.11)", text: "#111827",
        sub: "#64748b", icon: "#1f2937", hover: "hover:bg-slate-950/[0.045]", avatar: "#f8fafc",
      };

  useScrollLock(open); // lock background scroll while the drawer is open
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  /* Public (logged-out) drawer — exact reference design: brand header, simple
     Home / About / Features / How it Works list with hairline separators, an
     outlined "log in" and a filled "Sign up" button. Partial-width panel. */
  if (authed !== true) {
    const goLanding = (anchor: string) => {
      onClose();
      setPage("home");
      window.setTimeout(() => { document.getElementById(anchor)?.scrollIntoView({ behavior: "smooth" }); }, 320);
    };
    const publicItems = [
      { label: "Home", anchor: "top" },
      { label: "About", anchor: "why-us" },
      { label: "Features", anchor: "features" },
      { label: "How it Works", anchor: "how-it-works" },
    ];
    return (
      <div className={`fixed inset-0 z-[100] ${open ? "pointer-events-auto" : "pointer-events-none"}`} aria-hidden={!open}>
        <button aria-label="Close navigation" onClick={onClose} className={`absolute inset-0 bg-black/45 transition-opacity duration-300 ${open ? "opacity-100" : "opacity-0"}`}/>
        <aside
          role="dialog"
          aria-modal="true"
          aria-label="Site navigation"
          className={`absolute inset-y-0 left-0 flex w-[80%] max-w-[330px] flex-col transition-transform duration-300 ease-out ${open ? "translate-x-0" : "-translate-x-full"}`}
          style={{ background: palette.surface, fontFamily: FONT, boxShadow: open ? "14px 0 44px rgba(0,0,0,.35)" : "none" }}
        >
          <div className="flex h-[64px] shrink-0 items-center gap-2 px-5" style={{ borderBottom: `1px solid ${palette.rule}` }}>
            <Brand3D size={30}/>
            <span className="text-[19px] font-extrabold tracking-tight" style={{ color: palette.text }}>SimBazaar</span>
          </div>
          <nav className="px-5 pt-2" aria-label="Site menu">
            {publicItems.map((item) => (
              <button key={item.label} onClick={() => goLanding(item.anchor)}
                className="flex w-full items-center gap-2.5 py-[13px] text-left text-[15px] transition-opacity active:opacity-60"
                style={{ color: palette.text, borderBottom: `1px solid ${palette.rule}` }}>
                {item.label === "Home" && (
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ color: palette.icon }}>
                    <path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5"/>
                  </svg>
                )}
                {item.label}
              </button>
            ))}
          </nav>
          <div className="space-y-4 px-5 pt-7">
            <button onClick={() => go("login")}
              className="w-full rounded-[6px] py-3 text-[15px] font-medium transition active:scale-[.98]"
              style={{ border: `1px solid ${P}`, color: P, background: "transparent" }}>
              log in
            </button>
            <button onClick={() => go("signup")}
              className="w-full rounded-full py-3 text-[15px] font-semibold text-white transition active:scale-[.98]"
              style={{ background: P }}>
              Sign up
            </button>
          </div>
        </aside>
      </div>
    );
  }

  const menuItems = [
    { label: "Referral", page: "referral" as Page, icon: <svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><circle cx="12" cy="7" r="3.1"/><circle cx="5.3" cy="9" r="2.4"/><circle cx="18.7" cy="9" r="2.4"/><path d="M12 11.4c-2.9 0-5.4 2.1-5.8 5-.1.7.4 1.3 1.1 1.3h9.4c.7 0 1.2-.6 1.1-1.3-.4-2.9-2.9-5-5.8-5Z"/><path d="M5.3 12.4c-2 0-3.8 1.4-4.2 3.4-.1.6.3 1.1.9 1.1H4c.2-1.9 1-3.5 2.3-4.7-.3-.1-.6-.2-1-.2Z"/><path d="M18.7 12.4c-.4 0-.7.1-1 .2 1.3 1.2 2.1 2.8 2.3 4.7h2c.6 0 1-.5.9-1.1-.4-2-2.2-3.4-4.2-3.4Z"/></svg> },
    { label: "Account settings", page: "settings" as Page, icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.05.05a2 2 0 1 1-2.83 2.83l-.05-.05a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.04 1.56V21a2 2 0 0 1-4 0v-.08A1.7 1.7 0 0 0 8.96 19.4a1.7 1.7 0 0 0-1.87.34l-.05.05a2 2 0 1 1-2.83-2.83l.05-.05A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.56-1.04H3a2 2 0 0 1 0-4h.08A1.7 1.7 0 0 0 4.6 8.96a1.7 1.7 0 0 0-.34-1.87l-.05-.05a2 2 0 1 1 2.83-2.83l.05.05a1.7 1.7 0 0 0 1.87.34H9a1.7 1.7 0 0 0 1.04-1.56V3a2 2 0 0 1 4 0v.08A1.7 1.7 0 0 0 15.04 4.6a1.7 1.7 0 0 0 1.87-.34l.05-.05a2 2 0 1 1 2.83 2.83l-.05.05A1.7 1.7 0 0 0 19.4 9v.04A1.7 1.7 0 0 0 20.96 10H21a2 2 0 0 1 0 4h-.04A1.7 1.7 0 0 0 19.4 15Z"/></svg> },
    { label: "Support", page: "support" as Page, icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13a7 7 0 0 1 14 0"/><path d="M6.5 13.5H5.5A2.5 2.5 0 0 0 3 16v1a2.5 2.5 0 0 0 2.5 2.5H6a.5.5 0 0 0 .5-.5v-5a.5.5 0 0 0-.5-.5Z"/><path d="M17.5 13.5h1A2.5 2.5 0 0 1 21 16v1a2.5 2.5 0 0 1-2.5 2.5H18a.5.5 0 0 1-.5-.5v-5a.5.5 0 0 1 .5-.5Z"/><path d="M18 19.5v.5a2.5 2.5 0 0 1-2.5 2.5H13.5"/></svg> },
  ];

  return (
    <div className={`fixed inset-0 z-[100] ${open ? "pointer-events-auto" : "pointer-events-none"}`} aria-hidden={!open}>
      <button aria-label="Close navigation" onClick={onClose} className={`absolute inset-0 bg-black/55 backdrop-blur-[2px] transition-opacity duration-500 ${open ? "opacity-100" : "opacity-0"}`}/>
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Account navigation"
        className={`absolute inset-0 flex w-full flex-col overflow-hidden transition-transform duration-500 ease-[cubic-bezier(.22,1,.36,1)] ${open ? "translate-x-0" : "-translate-x-full"}`}
        style={{ background: palette.ground, fontFamily: FONT, boxShadow: open ? "18px 0 54px rgba(0,0,0,.42)" : "none" }}
      >
        <header className={`flex h-[60px] items-end px-4 pb-2.5 transition-all duration-500 ${open ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0"}`}>
          <button onClick={onClose} aria-label="Back" className={`grid h-9 w-9 place-items-center rounded-full border transition-all duration-200 ${palette.hover} active:scale-95`} style={{ borderColor: dark ? "rgba(255,255,255,.55)" : "rgba(15,23,42,.28)", color: palette.icon }}>
            <ArrowLeft01Icon size={20} strokeWidth={1.7}/>
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 pb-5 [scrollbar-width:none]">
          <div className={`min-h-[calc(100vh-92px)] overflow-hidden rounded-[10px] border transition-all duration-500 ${open ? "translate-y-0 opacity-100" : "translate-y-5 opacity-0"}`} style={{ background: palette.surface, borderColor: palette.rule, transitionDelay: open ? "90ms" : "0ms" }}>
            <button onClick={() => go("user-profile")} className={`group flex w-full items-center gap-2.5 px-3.5 py-3 text-left transition-colors ${palette.hover}`} style={{ borderBottom: `1px solid ${palette.rule}` }}>
              <span className="grid h-9 w-9 shrink-0 place-items-center transition-transform duration-300 group-hover:scale-105">
                <ProfileAvatar size={34} color={palette.icon}/>
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 min-w-0">
                  <span className="block truncate text-[14px] font-semibold leading-5" style={{ color: palette.text }}>{profile.full_name}</span>
                  {profile.is_seller && <span className="shrink-0 px-1.5 py-0.5 rounded-md text-[9px] font-bold" style={{ background: "rgba(34,197,94,0.15)", color: "#16a34a" }}>Seller ✓</span>}
                </span>
                <span className="mt-0.5 block truncate text-[12px] leading-4" style={{ color: palette.sub }}>{profile.email}</span>
              </span>
            </button>

            <nav className="px-2 py-1.5" aria-label="Account menu">
              {menuItems.map((item, index) => (
                <button key={item.label} onClick={() => go(item.page)} className={`group flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-all duration-200 ${palette.hover} active:scale-[.985]`} style={{ color: palette.text, transitionDelay: open ? `${130 + index * 35}ms` : "0ms" }}>
                  <span className="h-[19px] w-[19px] shrink-0 transition-transform duration-200 group-hover:scale-110 group-hover:-rotate-3" style={{ color: palette.icon }}>{item.icon}</span>
                  <span className="text-[14px] font-medium leading-5">{item.label}</span>
                </button>
              ))}
              <button onClick={toggle} aria-pressed={dark} aria-label={dark ? "Switch to light mode" : "Switch to dark mode"} className={`group flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-all duration-200 ${palette.hover} active:scale-[.985]`} style={{ color: palette.text }}>
                {/* fi-br-dark-mode-alt — rounded contrast circle. The filled half
                    flips to the active side so the icon itself shows the mode. */}
                <span className="grid h-[19px] w-[19px] shrink-0 place-items-center transition-transform duration-500 ease-[cubic-bezier(.22,1,.36,1)] group-hover:scale-110" style={{ color: palette.icon, transform: dark ? "rotate(0deg)" : "rotate(180deg)" }}>
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
                    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2"/>
                    <path d="M12 3a9 9 0 0 1 0 18Z" fill="currentColor"/>
                    <circle cx="6.6" cy="7.4" r="0.95" fill="currentColor"/>
                    <circle cx="4.9" cy="10.8" r="0.7" fill="currentColor"/>
                  </svg>
                </span>
                <span className="text-[14px] font-medium leading-5">{dark ? "Dark Mode" : "Light Mode"}</span>
              </button>
              <button onClick={() => { onClose(); performLogout(setPage); }} className={`group flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-all duration-200 ${palette.hover} active:scale-[.985]`} style={{ color: palette.text }}>
                <span className="h-[19px] w-[19px] shrink-0 transition-transform duration-200 group-hover:translate-x-0.5" style={{ color: palette.icon }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10 5H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h4"/><path d="m14 16 4-4-4-4M18 12H9"/></svg></span>
                <span className="text-[14px] font-medium leading-5">Log Out</span>
              </button>
            </nav>

            <div className="px-4 pt-2 pb-4">
              <button onClick={() => go("merchant")} className="relative h-[40px] w-full overflow-hidden rounded-[11px] text-[14px] font-semibold text-white shadow-[0_8px_18px_rgba(240,78,35,.22)] transition-all duration-200 hover:brightness-110 active:scale-[.985]" style={{ background: P }}>
                <span className="relative z-10">Sell Product</span>
                <span className="absolute inset-x-7 top-0 h-px bg-white/35"/>
                <span className="absolute -right-5 -top-8 h-24 w-24 rounded-full bg-white/10 blur-xl"/>
              </button>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
export function AppMenuButton({ setPage }: { setPage:(p:Page)=>void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button aria-label="Open menu" onClick={() => setOpen(true)} className="mr-3 grid h-9 w-7 shrink-0 place-items-center text-white transition-transform active:scale-90">
        <Menu01Icon size={24} strokeWidth={1.9} color="currentColor"/>
      </button>
      <SideDrawer open={open} onClose={() => setOpen(false)} setPage={setPage}/>
    </>
  );
}


/* Shopping cart — thin outline with a single straight line inside the basket */
export function CartLineIcon({ size = 22, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.5 3.5h1.9a1 1 0 0 1 .98.8L7.4 14a1.8 1.8 0 0 0 1.76 1.44h7.9A1.8 1.8 0 0 0 18.8 14l1.9-7.1a1 1 0 0 0-.97-1.26H5.2"/>
      <path d="M8 11h11.3"/>
      <circle cx="9.7" cy="19.7" r="1.5"/>
      <circle cx="16.9" cy="19.7" r="1.5"/>
    </svg>
  );
}

/* Profile avatar — thin circle-user mark (flaticon fi-ts-circle-user style) */
export function CircleUserIcon({ size = 30, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9.3"/>
      <circle cx="12" cy="9.6" r="3.1"/>
      <path d="M5.9 19c1.1-2.9 3.4-4.5 6.1-4.5s5 1.6 6.1 4.5"/>
    </svg>
  );
}

/* Premium 3D megaphone empty-state illustration — the "AD" megaphone in a soft
   peach circle. Shared by the Ads page and the My Purchase / My Orders empty
   states so every empty screen uses the exact same artwork. */
export function EmptyMegaphone({ size = 130 }: { size?: number }) {
  const glyph = Math.round(size * 0.554);
  const badge = Math.round(size * 0.20);
  return (
    <div className="mx-auto rounded-full flex items-center justify-center relative" style={{ width: size, height: size, background: "radial-gradient(circle at 50% 40%, #fff 0%, #fbe9e2 100%)" }}>
      <svg width={glyph} height={glyph} viewBox="0 0 64 64" fill="none">
        <path d="M14 28l24-11v30L14 36v-8z" fill="#f04e23"/>
        <path d="M38 17l6-3v36l-6-3V17z" fill="#f8a03d"/>
        <rect x="9" y="28" width="6" height="8" rx="2" fill="#c73a12"/>
        <path d="M16 37l4 9c.6 1.4 2.2 2 3.6 1.4l2-.9c1.4-.6 2-2.2 1.4-3.6L24 36l-8 1z" fill="#f8a03d"/>
        <path d="M46 24c3 1 5 3.5 5 6.5S49 36 46 37" stroke="#f04e23" strokeWidth="2.4" strokeLinecap="round"/>
      </svg>
      <span className="absolute flex items-center justify-center rounded-full text-white" style={{ top: size * 0.154, right: size * 0.169, width: badge, height: badge, background: "#ef4444", fontSize: Math.round(size * 0.069), fontWeight: 800, border: "2.5px solid #fff" }}>AD</span>
    </div>
  );
}

/* Locks background scrolling while a modal / slide-up sheet is open. Uses the
   position:fixed technique so it fully works on mobile Safari (where
   `overflow:hidden` alone still scrolls), preserves and restores the scroll
   position, and reference-counts so nested modals don't unlock early. The
   modal's own content still scrolls internally. */
let _scrollLockCount = 0;
let _savedScrollY = 0;
export function useScrollLock(locked: boolean): void {
  useEffect(() => {
    if (!locked) return;
    if (_scrollLockCount === 0) {
      _savedScrollY = window.scrollY || window.pageYOffset || 0;
      const body = document.body;
      body.style.position = "fixed";
      body.style.top = `-${_savedScrollY}px`;
      body.style.left = "0";
      body.style.right = "0";
      body.style.width = "100%";
      body.style.overflow = "hidden";
      document.documentElement.style.overflow = "hidden";
    }
    _scrollLockCount += 1;
    return () => {
      _scrollLockCount = Math.max(0, _scrollLockCount - 1);
      if (_scrollLockCount === 0) {
        const body = document.body;
        body.style.position = "";
        body.style.top = "";
        body.style.left = "";
        body.style.right = "";
        body.style.width = "";
        body.style.overflow = "";
        document.documentElement.style.overflow = "";
        window.scrollTo(0, _savedScrollY);
      }
    };
  }, [locked]);
}

/* Skeleton placeholder — a shimmering block used while real data loads, exactly
   like professional platforms. Compose these into page-specific skeletons
   (product cards, list rows, etc.). Theme-aware and respects reduced-motion. */
export function Skeleton({ className = "", rounded = "rounded-md", style }: { className?: string; rounded?: string; style?: CSSProperties }) {
  return <span className={`sb-skeleton block ${rounded} ${className}`} style={style} aria-hidden="true"/>;
}

/* Premium verified badge — a green scalloped seal with a white check. Used for
   every "verified" indicator across the app (storefront, merchant cards, header). */
export function VerifiedBadge({ size = 18, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" role="img" aria-label="Verified" className={`shrink-0 ${className}`}>
      <path d="m99.5 52.8-1.9 4.7c-.6 1.6-.6 3.3 0 4.9l1.9 4.7c1.1 2.8.2 6-2.3 7.8l-4.2 2.9c-1.4 1-2.3 2.5-2.7 4.1l-.9 5c-.6 3-3.1 5.2-6.1 5.3l-5.1.2c-1.7.1-3.3.8-4.5 2l-3.5 3.7c-2.1 2.2-5.4 2.7-8 1.2l-4.4-2.6c-1.5-.9-3.2-1.1-4.9-.7l-5 1.2c-2.9.7-6-.7-7.4-3.4l-2.3-4.6c-.8-1.5-2.1-2.7-3.7-3.2l-4.8-1.6c-2.9-1-4.7-3.8-4.4-6.8l.5-5.1c.2-1.7-.3-3.4-1.4-4.7l-3.2-4c-1.9-2.4-1.9-5.7 0-8.1l3.2-4c1.1-1.3 1.6-3 1.4-4.7l-.5-5.1c-.3-3 1.5-5.8 4.4-6.8l4.8-1.6c1.6-.5 2.9-1.7 3.7-3.2l2.3-4.6c1.4-2.7 4.4-4.1 7.4-3.4l5 1.2c1.6.4 3.4.2 4.9-.7l4.4-2.6c2.6-1.5 5.9-1.1 8 1.2l3.5 3.7c1.2 1.2 2.8 2 4.5 2l5.1.2c3 .1 5.6 2.3 6.1 5.3l.9 5c.3 1.7 1.3 3.2 2.7 4.1l4.2 2.9c2.5 2.2 3.5 5.4 2.3 8.2z" fill="#00d566"/>
      <g opacity=".15" fill="#000">
        <path d="m43.4 93.5-2.3-4.6c-.8-1.5-2.1-2.7-3.7-3.2l-4.8-1.6c-2.9-1-4.7-3.8-4.4-6.8l.5-5.1c.2-1.7-.3-3.4-1.4-4.7l-3.2-4c-1.9-2.4-1.9-5.7 0-8.1l3.2-4c1.1-1.3 1.6-3 1.4-4.7l-.5-5.1c-.3-3 1.5-5.8 4.4-6.8l4.8-1.6c1.6-.5 2.9-1.7 3.7-3.2l2.3-4.6c.8-1.6 2.2-2.7 3.7-3.2-2.7-.4-5.4 1-6.6 3.5l-2.3 4.6c-.8 1.5-2.1 2.7-3.7 3.2l-4.8 1.6c-2.9 1-4.7 3.8-4.4 6.8l.5 5.1c.2 1.7-.3 3.4-1.4 4.7l-3.2 4c-1.9 2.4-1.9 5.7 0 8.1l3.2 4c1.1 1.3 1.6 3 1.4 4.7l-.5 5.1c-.3 3 1.5 5.8 4.4 6.8l4.8 1.6c1.6.5 2.9 1.7 3.7 3.2l2.3 4.6c1.4 2.7 4.4 4.1 7.4 3.4l.6-.1c-2.2-.4-4.1-1.6-5.1-3.6z"/>
      </g>
      <path d="m53.5 75.3c-1.4 0-2.8-.6-3.8-1.7l-12.5-14.3c-1.8-2.1-1.6-5.2.4-7.1 2.1-1.8 5.2-1.6 7.1.4l9.4 10.7 21.9-17.6c2.1-1.7 5.3-1.4 7 .8s1.4 5.3-.8 7l-25.6 20.7c-.9.7-2 1.1-3.1 1.1z" fill="#fff"/>
    </svg>
  );
}

/* Load gate for a data page/section. Guarantees the skeleton is ALWAYS visible
   for at least `minMs` on every mount — even when the fetch resolves instantly
   (localhost) or the data is cached — so loading feels like a smooth, intentional
   moment on every page, the way premium platforms present it. Start rendering
   the skeleton while `loaded` is false; call `finishLoading()` when the fetch
   settles (in both .then and .catch). */
export function useLoadGate(minMs = 500): { loaded: boolean; finishLoading: () => void } {
  const [loaded, setLoaded] = useState(false);
  const startRef = useRef<number>(Date.now());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);
  const finishLoading = useCallback(() => {
    const wait = Math.max(0, minMs - (Date.now() - startRef.current));
    if (wait <= 0) setLoaded(true);
    else timerRef.current = setTimeout(() => setLoaded(true), wait);
  }, [minMs]);
  return { loaded, finishLoading };
}

/* Reusable loading spinner — dropped inside any button while an async action
   runs, so every professional action shows in-button feedback. */
export function Spinner({ size = 16, color = "currentColor", stroke = 2.4 }: { size?: number; color?: string; stroke?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className="animate-spin shrink-0" role="status" aria-label="Loading">
      <circle cx="12" cy="12" r="9" stroke={color} strokeOpacity="0.28" strokeWidth={stroke}/>
      <path d="M21 12a9 9 0 0 0-9-9" stroke={color} strokeWidth={stroke} strokeLinecap="round"/>
    </svg>
  );
}

/* Account avatar — the user's uploaded photo, or the circle-user mark */
export function ProfileAvatar({ size = 30, color = "currentColor" }: { size?: number; color?: string }) {
  const profile = useProfile();
  if (profile.avatar_url) {
    return <img src={profile.avatar_url} alt="Profile" className="rounded-full object-cover shrink-0" style={{ width: size, height: size }}/>;
  }
  return <CircleUserIcon size={size} color={color}/>;
}

/* Unified mobile app header — the exact Support Center header design, shared by
   every inside page. The landing page keeps its own marketing navbar.
   `menuSlot` lets the marketplace inject its drawer-opening menu button; by
   default the menu button navigates back to the marketplace. */
export function AppMobileHeader({ setPage, cartCount, menuSlot, className = "" }:
  { setPage:(p:Page)=>void; cartCount?:number; menuSlot?:ReactNode; className?:string }) {
  const liveCount = useCartCount();
  const count = cartCount ?? liveCount; // real cart count unless a caller overrides
  return (
    <header className={`sticky top-0 z-50 flex h-[58px] items-center border-b border-white/[0.10] bg-[#030303] px-4 ${className}`} style={{ fontFamily: FONT }}>
      {menuSlot ?? <AppMenuButton setPage={setPage}/>}
      <button onClick={() => setPage("marketplace")} className="flex min-w-0 flex-1 items-center gap-2 text-left">
        <Brand3D size={30}/>
        <span className="truncate text-[20px] font-medium tracking-[-0.02em] text-white">SimBazaar</span>
      </button>
      <div className="ml-2 flex items-center gap-2">
        <button onClick={() => setPage("support")} aria-label="Support" className="grid h-9 w-8 place-items-center text-white transition active:scale-90"><CustomerService01Icon size={23} strokeWidth={1.8}/></button>
        <span className="h-6 w-px bg-white/[0.14]"/>
        <button onClick={() => setPage("cart")} aria-label="Cart" className="relative grid h-9 w-8 place-items-center text-white transition active:scale-90"><CartLineIcon size={23}/>{count > 0 && <span className="absolute -right-0.5 -top-0.5 grid h-[16px] min-w-[16px] place-items-center rounded-full px-1 text-[9px] font-bold text-white" style={{ background: P }}>{count}</span>}</button>
        <button onClick={() => setPage("notifications")} aria-label="Notifications" className="grid h-9 w-7 place-items-center text-white transition active:scale-90"><Notification01Icon size={23} strokeWidth={1.8}/></button>
        <button onClick={() => setPage("user-profile")} aria-label="Profile" className="grid h-9 w-9 place-items-center text-white transition active:scale-90"><ProfileAvatar size={30}/></button>
      </div>
    </header>
  );
}

export function MerchantMobileBar({ setPage }: { setPage:(p:Page)=>void }) {
  return (
    <div className="md:hidden flex items-center justify-between px-4 h-14 shrink-0" style={{ background: MBG, borderBottom:`1px solid ${MBD}` }}>
      <button onClick={()=>setPage("marketplace")} className="flex items-center gap-1.5 text-gray-300">
        <ArrowLeft01Icon size={20}/>
        <span className="text-[14px] font-semibold">Back</span>
      </button>
      <div className="flex items-center gap-2">
        <Brand3D size={30}/>
        <span className="text-[14px] font-extrabold text-white">SimBazaar</span>
      </div>
      <div className="w-12"/>
    </div>
  );
}
