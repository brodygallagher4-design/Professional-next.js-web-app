"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Menu01Icon, Cancel01Icon, Search01Icon, ArrowRight01Icon, ArrowLeft01Icon,
  Shield01Icon, FlashIcon, StarIcon, CheckmarkCircle01Icon, UserIcon,
  Wallet01Icon, LockIcon, CustomerService01Icon, ShoppingBag01Icon,
  Store01Icon, ViewIcon, ViewOffIcon, Notification01Icon, ShoppingCart01Icon,
  Home01Icon, GridIcon, ArrowDown01Icon, ArrowUp01Icon, Mail01Icon, Megaphone01Icon,
} from "hugeicons-react";

import {
  P, BG, BG2, CARD, CARD2, BD, FONT, MBG, MCARD, MCARD2, MBD,
  BRAND_LOGOS, BrandIcon, DesktopTopNav, AppMobileHeader, Brand3D,
  ThemeContext, useTheme, setStoreMerchant, setCurrentOrder, useProfile, AppMenuButton, clearProfileCache, refreshProfile, CircleUserIcon, CartLineIcon,
  useAuthed, setAuthedState, isAuthed, EmptyMegaphone, useCartCount, Spinner, useScrollLock, Skeleton, useLoadGate, VerifiedBadge,
} from "./shared";
import type { Page, BrandKey } from "./shared";
import {
  fetchMerchants, readCache, writeCache, createPurchase, activateSeller,
  fetchCart, addCartItem, removeCartItem, fetchNotifications, fetchAds, createAd, addAdStock, deleteAd, fetchWalletBalance,
  fetchReceivedReviews, fetchPurchases, uploadAvatar, authLogin, authSignup, submitReview,
  fetchMyStatus, fetchMerchantStatus, updateProfile,
  type ApiNotification, type ApiReview, type ApiAd, type ActivateResult, type ApiStatus, type ApiPurchase,
} from "./lib/api";
import { createPortal } from "react-dom";
import { StatusComposer, StatusViewer, StatusRing, MyStoriesPage } from "./components/status";
import { CelebrationIcon } from "./components/celebration-icon";
import { useProductsQuery, useMerchantsQuery, useNotificationsQuery, useInvalidate, qk } from "./lib/query";
import { ReviewsList, THEMED_REVIEW_PALETTE } from "./components/reviews";
import { WalletPage } from "./components/wallet-page";
import { MyPurchasePage } from "./components/purchase-page";
import { OrderDetailsPage } from "./components/order-details-page";
import { SupportCenterPage } from "./components/support-center-page";
import { AccountSettingsPage } from "./components/account-settings-page";
import { ReferralPage } from "./components/referral-page";
import { SellerStorePage, TopMerchantsPage } from "./components/merchant-pages";
import { AdminPage } from "./components/admin-page";
import { COUNTRIES, countryByIso, validatePhone } from "./lib/countries";
import { ToastHost, toast } from "./toast";

type MktView = "main" | "listings" | "merchants";

// ─── NAV DATA ─────────────────────────────────────────────────────────────────
const NAV = ["Home", "Features", "How it Works", "Why Us", "Become a Merchant"];

const WHY = [
  { bold: "Trusted eSIM Marketplace:",               body: " Buy and sell eSIMs, virtual numbers, VPN accounts, and data plans from verified sellers on SimBazaar." },
  { bold: "Secure Escrow & Protected Transactions:", body: " Every purchase is protected through secure escrow payments, ensuring buyers receive their eSIM before funds are released to sellers." },
  { bold: "Direct Access to Verified Sellers:",      body: " Communicate directly with sellers to verify plan details, negotiate prices, and ensure safe delivery before purchasing." },
];

const STATS = [
  { val: "10K+", label: "Active Users" },
  { val: "500+", label: "Verified Sellers" },
  { val: "50K+", label: "Orders Completed" },
  { val: "4.9",  label: "Average Rating" },
];

const TESTIMONIALS = [
  { name: "Kwame Adjei",  role: "Frequent Traveler", img: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=96&h=96&fit=crop&auto=format", stars: 5, quote: "SimBazaar made it really easy to find the eSIM I needed. The marketplace has many sellers and the purchase process was smooth. Definitely one of the best platforms for digital connectivity." },
  { name: "Amara Osei",   role: "Digital Nomad",     img: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=96&h=96&fit=crop&auto=format", stars: 5, quote: "I was skeptical at first but the escrow protection gave me confidence. Got my eSIM activated in under 2 minutes. The seller was responsive and professional throughout." },
  { name: "David Mensah", role: "Business Traveler", img: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=96&h=96&fit=crop&auto=format", stars: 5, quote: "The best marketplace for eSIMs. Competitive prices, verified sellers, and instant delivery. I use it every trip I take internationally." },
];

// ─── MARKETPLACE DATA ──────────────────────────────────────────────────────────
const TOP_MERCHANTS = [
  { name: "Your",    rating: 4.8, sales: "639",  avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=64&h=64&fit=crop&auto=format", online: true  },
  { name: "Egosim",  rating: 4.2, sales: "2.6k", avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=64&h=64&fit=crop&auto=format", online: true, hot: true },
  { name: "OlaMore", rating: 5.0, sales: "24",   avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=64&h=64&fit=crop&auto=format", online: false },
  { name: "Akan",    rating: 4.9, sales: "61",   avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=64&h=64&fit=crop&auto=format", online: true  },
  { name: "Faruq5",  rating: 4.8, sales: "476",  avatar: "https://images.unsplash.com/photo-1519345182560-3f2917c472ef?w=64&h=64&fit=crop&auto=format", online: false },
  { name: "Behappy", rating: 4.8, sales: "298",  avatar: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=64&h=64&fit=crop&auto=format", online: true  },
];

const ALL_MERCHANTS = [
  { name: "OlaMore",           rating: 5.0, sales: 24,  successRate: 100, avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=96&h=96&fit=crop&auto=format" },
  { name: "Akan confidence",   rating: 4.9, sales: 61,  successRate: 97,  avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=96&h=96&fit=crop&auto=format" },
  { name: "olayinkafaruq5",    rating: 4.8, sales: 476, successRate: 94,  avatar: "https://images.unsplash.com/photo-1519345182560-3f2917c472ef?w=96&h=96&fit=crop&auto=format" },
  { name: "Behappy シ",        rating: 4.8, sales: 298, successRate: 94,  avatar: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=96&h=96&fit=crop&auto=format" },
  { name: "Egosim",            rating: 4.2, sales: 2600,successRate: 91,  avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=96&h=96&fit=crop&auto=format" },
  { name: "Account Na Water",  rating: 4.5, sales: 183, successRate: 96,  avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=96&h=96&fit=crop&auto=format" },
];

interface Product {
  id: number;
  title: string;
  seller: string;
  badge: "flash" | "hand";
  rating: number;
  available: number;
  price: number;
  category: string;
  iconBg: string;
  iconChar: string;
  brand: BrandKey;
  previewUrl?: string;
  description?: string;
}

const PRODUCTS: Product[] = [
  { id:1,  title:"1 YEAR ACTIVE PIA VPN",                   seller:"Lavidamide", badge:"flash", rating:3, available:5, price:2.98, category:"vpn",     iconBg:"#16a34a", iconChar:"🔒", brand:"pia" },
  { id:2,  title:"U.S 🇺🇸 +1 WhatsApp number",              seller:"Vino",       badge:"hand",  rating:3, available:1, price:3.90, category:"social",   iconBg:"#25D366", iconChar:"💬", brand:"whatsapp" },
  { id:3,  title:"STRONG USA us WHATSAPP NUMBER",            seller:"Amos",       badge:"hand",  rating:3, available:1, price:3.70, category:"social",   iconBg:"#25D366", iconChar:"💬", brand:"whatsapp" },
  { id:4,  title:"USA Apple iCloud / ID Account",            seller:"Sunny's",    badge:"flash", rating:3, available:1, price:3.90, category:"social",   iconBg:"#1c1c1e", iconChar:"🍎", brand:"apple" },
  { id:5,  title:"HIGH QUALITY INSTAGRAM ACCOUNTs",          seller:"CHASELOGS",  badge:"flash", rating:3, available:1, price:5.00, category:"social",   iconBg:"#E1306C", iconChar:"📷", brand:"instagram" },
  { id:6,  title:"Valid USA 🇺🇸 TELEGRAM number!",           seller:"Talk2mandi", badge:"hand",  rating:3, available:1, price:3.99, category:"numbers",  iconBg:"#0088cc", iconChar:"✈️", brand:"telegram" },
  { id:7,  title:"1 WEEK premium Surfshark vpn",             seller:"Lavidamide", badge:"flash", rating:3, available:3, price:1.00, category:"vpn",      iconBg:"#1e7a69", iconChar:"🦈", brand:"surfshark" },
  { id:8,  title:"1 month premium HMA vpn",                  seller:"Lavidamide", badge:"flash", rating:3, available:2, price:2.00, category:"vpn",      iconBg:"#20b2aa", iconChar:"🌐", brand:"vpn" },
  { id:9,  title:"1 month premium CYBERGHOST vpn",           seller:"Lavidamide", badge:"flash", rating:3, available:2, price:2.00, category:"vpn",      iconBg:"#e5b800", iconChar:"👻", brand:"cyberghost" },
  { id:10, title:"1 Month Premium Express VPN FOR LAPTOP",   seller:"Vino",       badge:"flash", rating:3, available:4, price:2.50, category:"vpn",      iconBg:"#da3940", iconChar:"🛡️", brand:"expressvpn" },
  { id:11, title:"Get Snapchat+ Premium 1 Month",            seller:"PanelSuite", badge:"flash", rating:4, available:8, price:1.50, category:"subscriptions", iconBg:"#fffc00", iconChar:"👻", brand:"snapchat" },
  { id:12, title:"Netflix Premium 1 Month Shared",           seller:"Egosim",     badge:"flash", rating:4, available:6, price:3.99, category:"subscriptions", iconBg:"#e50914", iconChar:"🎬", brand:"netflix" },
  { id:13, title:"USA UK Gift Card $10",                     seller:"Faruq5",     badge:"flash", rating:4, available:3, price:8.50, category:"giftcards", iconBg:"#ff6b35", iconChar:"🎁", brand:"giftcard" },
  { id:14, title:"Steam Gift Card $5",                       seller:"Behappy",    badge:"hand",  rating:3, available:2, price:4.20, category:"gaming",   iconBg:"#1b2838", iconChar:"🎮", brand:"steam" },
];

const CATEGORIES = [
  { id: "trending",      label: "Trending"       },
  { id: "social",        label: "Social accounts"},
  { id: "vpn",           label: "VPN"            },
  { id: "numbers",       label: "Numbers"        },
  { id: "subscriptions", label: "Subscription"   },
  { id: "gaming",        label: "Gaming"         },
  { id: "giftcards",     label: "Giftcards"      },
];

/* Category pill glyphs — bare outline icons drawn inline (no background box),
   matching the reference chips: flame, phone, globe, handset, card, pad, gift. */
function CategoryGlyph({ id, size = 14 }: { id: string; size?: number }) {
  const s = { fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (id) {
    case "trending": return (
      <svg width={size} height={size} viewBox="0 0 24 24">
        <path d="M12 22c4.4 0 7.5-3 7.5-7.2 0-3.1-1.7-5.6-3.4-7.5-.5 1.2-1.3 2.2-2.4 2.8C13.5 7.6 12.6 4 9.8 2c.3 3-1 4.7-2.4 6.3C6 9.9 4.5 11.6 4.5 14.8 4.5 19 7.6 22 12 22Z" fill="currentColor" stroke="none"/>
      </svg>);
    case "social": return (
      <svg width={size} height={size} viewBox="0 0 24 24" {...{}}>
        <rect x="7" y="2.5" width="10" height="19" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.7"/>
        <path d="M10.5 18.5h3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
      </svg>);
    case "vpn": return (
      <svg width={size} height={size} viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="9" {...s}/>
        <path d="M3 12h18M12 3c2.5 2.6 3.8 5.7 3.8 9S14.5 18.4 12 21c-2.5-2.6-3.8-5.7-3.8-9S9.5 5.6 12 3Z" {...s}/>
      </svg>);
    case "numbers": return (
      <svg width={size} height={size} viewBox="0 0 24 24">
        <path d="M6.6 3.2 8.9 5.5c.5.5.6 1.3.2 1.9L7.9 9.2a1.5 1.5 0 0 0 .2 1.9l4.8 4.8c.5.5 1.3.6 1.9.2l1.8-1.2c.6-.4 1.4-.3 1.9.2l2.3 2.3c.6.6.6 1.6 0 2.2l-1.5 1.5c-.8.8-2 1.1-3.1.8-6-1.9-10.8-6.7-12.7-12.7-.3-1.1 0-2.3.8-3.1l1.5-1.5c.6-.6 1.6-.6 2.2 0Z" {...s}/>
      </svg>);
    case "subscriptions": return (
      <svg width={size} height={size} viewBox="0 0 24 24">
        <rect x="3" y="5" width="18" height="15" rx="2.5" {...s}/>
        <path d="M3 10h18M8 2.8V7M16 2.8V7" {...s}/>
      </svg>);
    case "gaming": return (
      <svg width={size} height={size} viewBox="0 0 24 24">
        <path d="M6.5 7h11a5 5 0 0 1 5 5.3l-.3 3.5a3.2 3.2 0 0 1-5.7 1.7l-1-1.3a2 2 0 0 0-1.6-.8h-3.8a2 2 0 0 0-1.6.8l-1 1.3a3.2 3.2 0 0 1-5.7-1.7l-.3-3.5A5 5 0 0 1 6.5 7Z" {...s}/>
        <path d="M8.5 10.5v3M7 12h3M15.5 10.7h.01M17.8 12.9h.01" {...s}/>
      </svg>);
    case "giftcards": return (
      <svg width={size} height={size} viewBox="0 0 24 24">
        <rect x="3.5" y="8" width="17" height="13" rx="2" {...s}/>
        <path d="M3.5 12.5h17M12 8v13M12 8s-1.2-5-4-5-2.7 4 4 5Zm0 0s1.2-5 4-5 2.7 4-4 5Z" {...s}/>
      </svg>);
    default: return null;
  }
}

const FILTER_CATS = [
  "Social Media", "Emails & Messaging Service", "Giftcards",
  "VPN & PROXYs", "Websites", "E-commerce Platforms",
  "Gaming", "Accounts & Subscriptions", "Others",
];

// ─── SHARED SMALL COMPONENTS ──────────────────────────────────────────────────
function Pill({ children }: { children: React.ReactNode }) {
  return <span className="inline-block px-5 py-2 rounded-full text-sm font-bold text-white" style={{ background: P }}>{children}</span>;
}
function OBtn({ children, outline = false, className = "", onClick }: { children: React.ReactNode; outline?: boolean; className?: string; onClick?: () => void }) {
  return (
    <button onClick={onClick} className={`px-7 py-3.5 rounded-full font-bold text-base transition-all active:scale-[0.97] ${className}`}
      style={outline ? { border:"2px solid rgba(255,255,255,0.35)", color:"#fff", background:"transparent" } : { background:P, color:"#fff" }}>
      {children}
    </button>
  );
}
function StarRow({ n }: { n: number }) {
  return <div className="flex gap-0.5">{Array.from({length:n}).map((_,i)=><StarIcon key={i} size={18} color="#f59e0b"/>)}</div>;
}
/* Bold solid flame (matches Flaticon `fi-bs-flame`), used for "Trending now". */
function FlameIcon({ size = 16, color = P }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden="true" className="shrink-0">
      <path d="M12.8 1.6c-.5-.5-1.4-.2-1.5.5-.3 2.2-1.3 3.6-2.4 4.9-.3.4-.7.8-1 1.2-.5-.7-.8-1.5-.9-2.6-.1-.7-.9-1-1.5-.6C3.4 6.5 2 9.2 2 12.4A8 8 0 0 0 18 12.4c0-2.4-.9-4.1-2-5.7-1.1-1.6-2.4-3.1-3.2-5.1Zm-.6 17.6a3.3 3.3 0 0 1-3.3-3.3c0-1.5 1-2.6 1.7-3.4.3.5.7.9 1.3 1.2.5-1.4 1.3-2.4 2-3.2.6 1.1 1.6 2.4 1.6 4.1a3.3 3.3 0 0 1-3.3 3.3Z"/>
    </svg>
  );
}
function StarsMini({ rating, max=5 }: { rating:number; max?:number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({length:max}).map((_,i)=>(
        <StarIcon key={i} size={11} color={i < rating ? "#f59e0b" : "#374151"} />
      ))}
    </div>
  );
}

// ─── AUTH COMPONENTS ──────────────────────────────────────────────────────────
/* Palette for the auth pages — pure white in light mode (exact reference
   design), marketplace-black in dark mode. */
function useAuthPalette() {
  const { dark } = useTheme();
  return dark
    ? { page:"#0a0a0a", text:"#ffffff", sub:"#9ca3af", label:"#e5e7eb", inputBg:"#141414", inputBorder:"rgba(255,255,255,0.14)", panel:"#161616", rule:"rgba(255,255,255,0.10)" }
    : { page:"#ffffff", text:"#101828", sub:"#667085", label:"#344054", inputBg:"#ffffff", inputBorder:"#d0d5dd", panel:"#ffffff", rule:"#eaecf0" };
}
type AuthPalette = ReturnType<typeof useAuthPalette>;

function AuthLabel({ c, label, required }: { c:AuthPalette; label:string; required?:boolean }) {
  return <label className="mb-1.5 block text-[14px] font-medium" style={{ color:c.label }}>{label}{required && <span className="ml-0.5" style={{ color:P }}>*</span>}</label>;
}
function AuthInput({ c, placeholder, type="text", value, onChange }: { c:AuthPalette; placeholder:string; type?:string; value:string; onChange:(v:string)=>void }) {
  return (
    <input type={type} placeholder={placeholder} value={value} onChange={(e)=>onChange(e.target.value)}
      className="h-[46px] w-full rounded-lg px-3.5 text-[15px] outline-none transition-colors placeholder:text-[#98a2b3]"
      style={{ background:c.inputBg, border:`1px solid ${c.inputBorder}`, color:c.text, fontFamily:FONT }}
      onFocus={(e)=>{ e.currentTarget.style.borderColor=P; }}
      onBlur={(e)=>{ e.currentTarget.style.borderColor=c.inputBorder; }}/>
  );
}
function PasswordInput({ c, placeholder, value, onChange }: { c:AuthPalette; placeholder:string; value:string; onChange:(v:string)=>void }) {
  const [show,setShow]=useState(false);
  return (
    <div className="relative">
      <input type={show?"text":"password"} placeholder={placeholder} value={value} onChange={(e)=>onChange(e.target.value)}
        className="h-[46px] w-full rounded-lg px-3.5 pr-11 text-[15px] outline-none transition-colors placeholder:text-[#98a2b3]"
        style={{ background:c.inputBg, border:`1px solid ${c.inputBorder}`, color:c.text, fontFamily:FONT }}
        onFocus={(e)=>{ e.currentTarget.style.borderColor=P; }}
        onBlur={(e)=>{ e.currentTarget.style.borderColor=c.inputBorder; }}/>
      <button type="button" aria-label={show ? "Hide password" : "Show password"} onClick={()=>setShow(!show)}
        className="absolute right-3.5 top-1/2 -translate-y-1/2 transition-opacity hover:opacity-70" style={{ color:c.sub }}>
        {show ? <ViewOffIcon size={19}/> : <ViewIcon size={19}/>}
      </button>
    </div>
  );
}

/* Phone field — flag + dial code + national number in one bordered control,
   with a searchable country picker. Numbers are validated per country. */
function PhoneField({ c, iso, setIso, phone, setPhone }: { c:AuthPalette; iso:string; setIso:(v:string)=>void; phone:string; setPhone:(v:string)=>void }) {
  const [open,setOpen]=useState(false); const [q,setQ]=useState("");
  useScrollLock(open); // lock background scroll while the country picker is open
  const sel = countryByIso(iso) ?? COUNTRIES[0];
  const query = q.trim().toLowerCase();
  const list = query ? COUNTRIES.filter((x)=>x.name.toLowerCase().includes(query) || x.dial.includes(query)) : COUNTRIES;
  return (
    <div className="relative">
      <div className="flex h-[46px] items-center rounded-lg" style={{ background:c.inputBg, border:`1px solid ${c.inputBorder}` }}>
        <button type="button" onClick={()=>setOpen(v=>!v)} aria-label="Select country" aria-expanded={open}
          className="flex h-full shrink-0 items-center gap-1 pl-3.5 pr-1.5 transition-opacity active:opacity-70">
          <span className="text-[17px] leading-none">{sel.flag}</span>
          <svg width="10" height="6" viewBox="0 0 10 6" fill="none"><path d="M1 1l4 4 4-4" stroke={c.sub} strokeWidth="1.5" strokeLinecap="round"/></svg>
        </button>
        <span className="pl-1 pr-2 text-[15px] font-medium" style={{ color:c.text }}>{sel.dial}</span>
        <input inputMode="numeric" autoComplete="tel-national" placeholder="Phone number" value={phone}
          onChange={(e)=>setPhone(e.target.value.replace(/[^\d\s-]/g,"").slice(0,17))}
          className="h-full min-w-0 flex-1 rounded-r-lg bg-transparent pr-3.5 text-[15px] outline-none placeholder:text-[#98a2b3]"
          style={{ color:c.text, fontFamily:FONT }}/>
      </div>
      {open && (
        <>
          <button type="button" aria-label="Close country list" className="fixed inset-0 z-[70] cursor-default" onClick={()=>{ setOpen(false); setQ(""); }}/>
          <div className="absolute left-0 top-[50px] z-[80] w-[300px] overflow-hidden rounded-xl shadow-2xl" style={{ background:c.panel, border:`1px solid ${c.inputBorder}` }}>
            <div className="p-2" style={{ borderBottom:`1px solid ${c.rule}` }}>
              <input autoFocus placeholder="Search country" value={q} onChange={(e)=>setQ(e.target.value)}
                className="h-9 w-full rounded-lg px-3 text-[13.5px] outline-none placeholder:text-[#98a2b3]"
                style={{ background:c.inputBg, border:`1px solid ${c.inputBorder}`, color:c.text, fontFamily:FONT }}/>
            </div>
            <div className="max-h-[264px] overflow-y-auto py-1">
              {list.map((x)=>(
                <button type="button" key={x.iso} onClick={()=>{ setIso(x.iso); setOpen(false); setQ(""); }}
                  className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left transition-colors hover:bg-[rgba(128,128,128,0.12)]"
                  style={{ color:c.text }}>
                  <span className="text-[16px] leading-none">{x.flag}</span>
                  <span className="min-w-0 flex-1 truncate text-[13.5px]">{x.name}</span>
                  <span className="text-[12.5px]" style={{ color:c.sub }}>{x.dial}</span>
                </button>
              ))}
              {list.length===0 && <p className="px-3.5 py-3 text-[13px]" style={{ color:c.sub }}>No matches</p>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── LOGIN PAGE ───────────────────────────────────────────────────────────────
function LoginPage({ setPage }: { setPage:(p:Page)=>void }) {
  const c = useAuthPalette();
  const [email,setEmail]=useState(""); const [password,setPassword]=useState("");
  const [busy,setBusy]=useState(false); const [err,setErr]=useState("");
  const submit = async () => {
    if (busy) return;
    if (!email.trim() || !password) { setErr("Enter your email and password."); toast.error("Enter your email and password.", { title: "Missing details" }); return; }
    setBusy(true); setErr("");
    const result = await authLogin(email.trim(), password);
    setBusy(false);
    if (!result.ok) {
      const msg = result.error ?? "Login failed — please try again.";
      setErr(msg);
      toast.error(msg, { title: "Sign in failed" });
      return;
    }
    toast.success("You're signed in — welcome back!", { title: "Signed in" });
    finishAuth(setPage);
  };
  return (
    <div className="flex min-h-screen items-center justify-center px-5" style={{ background:c.page, fontFamily:FONT }}>
      <form className="w-full max-w-[400px] py-10" onSubmit={(e)=>{ e.preventDefault(); submit(); }}>
        <h1 className="text-[26px] font-bold leading-tight" style={{ color:c.text }}>Login to your account</h1>
        <p className="mt-1.5 mb-6 text-[13.5px]" style={{ color:c.sub }}>Don&apos;t have an account?{" "}<button type="button" onClick={()=>setPage("signup")} className="font-medium hover:underline" style={{ color:P }}>Sign up</button></p>
        <div className="space-y-[18px]">
          <div><AuthLabel c={c} label="Email address" required/><AuthInput c={c} placeholder="Type your Email address" type="email" value={email} onChange={setEmail}/></div>
          <div>
            <AuthLabel c={c} label="Password" required/>
            <PasswordInput c={c} placeholder="Type your Password" value={password} onChange={setPassword}/>
            <div className="mt-2 text-right"><button type="button" className="text-[13px] transition-opacity hover:opacity-70" style={{ color:c.sub }}>Forgot Password?</button></div>
          </div>
          {err && <p className="rounded-lg px-3.5 py-2.5 text-[13px] font-medium" style={{ color:"#ef4444", background:"rgba(239,68,68,0.08)" }}>{err}</p>}
          <button type="submit" disabled={busy} className="flex h-[46px] w-full items-center justify-center gap-2 rounded-full text-[15px] font-medium text-white transition-all hover:opacity-90 active:scale-[0.99] disabled:opacity-70" style={{ background:P }}>{busy && <Spinner size={17}/>}{busy ? "Logging in…" : "Login"}</button>
        </div>
      </form>
    </div>
  );
}

// ─── SIGNUP PAGE ──────────────────────────────────────────────────────────────
function SignupPage({ setPage }: { setPage:(p:Page)=>void }) {
  const c = useAuthPalette();
  const [name,setName]=useState(""); const [email,setEmail]=useState("");
  const [iso,setIso]=useState("NG"); const [phone,setPhone]=useState("");
  const [password,setPassword]=useState(""); const [confirm,setConfirm]=useState(""); const [agreed,setAgreed]=useState(false);
  const [busy,setBusy]=useState(false); const [err,setErr]=useState("");
  const fail = (msg: string) => { setErr(msg); toast.error(msg, { title: "Check your details" }); };
  const submit = async () => {
    if (busy) return;
    if (!name.trim()) { fail("Enter your full name."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { fail("Enter a valid email address."); return; }
    const checked = validatePhone(iso, phone);
    if (!checked.ok) { fail(checked.error); return; }
    if (password.length < 6 || password.length > 30) { fail("Password must be 6-30 characters long."); return; }
    if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) { fail("Password must include letters and at least one number."); return; }
    if (password !== confirm) { fail("Passwords do not match."); return; }
    if (!agreed) { fail("Please accept the Privacy Policy and Terms of Use to continue."); return; }
    setBusy(true); setErr("");
    const result = await authSignup(name.trim(), email.trim(), password, checked.e164, iso);
    setBusy(false);
    if (!result.ok) {
      const msg = result.error ?? "Signup failed — please try again.";
      setErr(msg);
      toast.error(msg, { title: "Sign up failed" });
      return;
    }
    toast.success("Your account is ready — welcome to SimBazaar!", { title: "Account created" });
    finishAuth(setPage, "signup-success");
  };
  return (
    <div className="flex min-h-screen items-center justify-center px-5" style={{ background:c.page, fontFamily:FONT }}>
      <form className="w-full max-w-[400px] py-10" onSubmit={(e)=>{ e.preventDefault(); submit(); }}>
        <h1 className="text-[24px] font-bold leading-tight" style={{ color:c.text }}>Welcome to SimBazaar 👋</h1>
        <p className="mt-1.5 mb-6 text-[13.5px]" style={{ color:c.sub }}>Already have an account?{" "}<button type="button" onClick={()=>setPage("login")} className="font-medium hover:underline" style={{ color:P }}>Login</button></p>
        <div className="space-y-[18px]">
          <div><AuthLabel c={c} label="Full Name" required/><AuthInput c={c} placeholder="Type your full name" value={name} onChange={setName}/></div>
          <div><AuthLabel c={c} label="Email address" required/><AuthInput c={c} placeholder="Type your Email address" type="email" value={email} onChange={setEmail}/></div>
          <PhoneField c={c} iso={iso} setIso={setIso} phone={phone} setPhone={setPhone}/>
          <div>
            <AuthLabel c={c} label="Password" required/>
            <PasswordInput c={c} placeholder="Type your Password" value={password} onChange={setPassword}/>
            <ul className="mt-2 space-y-1">
              {["Minimum length of 6-30 characters","Must include letters and at least one number"].map((r)=>(
                <li key={r} className="flex items-start gap-1.5 text-[12.5px]" style={{ color:c.sub }}><span className="mt-[2px] shrink-0">•</span>{r}</li>
              ))}
            </ul>
          </div>
          <div><AuthLabel c={c} label="Confirm password" required/><PasswordInput c={c} placeholder="Type your Confirm password" value={confirm} onChange={setConfirm}/></div>
          <button type="button" onClick={()=>setAgreed(!agreed)} className="flex w-full select-none items-start gap-2.5 text-left">
            <span className="mt-[1px] grid h-4 w-4 shrink-0 place-items-center rounded transition-colors" style={{ border:`1.5px solid ${agreed?P:c.inputBorder}`, background:agreed?P:"transparent" }}>
              {agreed && <svg width="9" height="7" viewBox="0 0 9 7" fill="none"><path d="M1 3.5l2.5 2.5L8 1" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
            </span>
            <span className="text-[12.5px] leading-relaxed" style={{ color:c.sub }}>By clicking on this, I give consent to SimBazaar <span className="font-semibold" style={{ color:c.text }}>Privacy Policy</span> and <span className="font-semibold" style={{ color:c.text }}>Terms of Use</span></span>
          </button>
          {err && <p className="rounded-lg px-3.5 py-2.5 text-[13px] font-medium" style={{ color:"#ef4444", background:"rgba(239,68,68,0.08)" }}>{err}</p>}
          <button type="submit" disabled={busy} className="flex h-[46px] w-full items-center justify-center gap-2 rounded-full text-[15px] font-medium text-white transition-all hover:opacity-90 active:scale-[0.99] disabled:opacity-70" style={{ background:P, opacity:agreed?1:0.6 }}>{busy && <Spinner size={17}/>}{busy ? "Creating account…" : "Sign up"}</button>
        </div>
      </form>
    </div>
  );
}

// ─── SIGNUP SUCCESS PAGE ──────────────────────────────────────────────────────
/* Confetti-burst illustration — soft circle, stars, streamers and floating
   sparkles, matching the reference artwork. Pure SVG, gently animated. */
function ConfettiBurstArt() {
  return (
    <div className="relative mx-auto h-[170px] w-[190px] select-none" style={{ animation:"sbPopIn .55s cubic-bezier(.2,.9,.3,1.2) both" }}>
      <svg viewBox="0 0 200 170" className="h-full w-full">
        <circle cx="100" cy="85" r="62" fill="#fdefec"/>
        <path d="M78 110c-9-2-15-9-16-18" stroke="#ef4444" strokeWidth="5" strokeLinecap="round" fill="none"/>
        <path d="M124 58c9 2 15 9 16 18" stroke="#3b82f6" strokeWidth="5" strokeLinecap="round" fill="none"/>
        <path d="M68 62c2-9 9-15 18-16" stroke="#fbbf24" strokeWidth="5" strokeLinecap="round" fill="none"/>
        <path d="M132 108c-2 9-9 15-18 16" stroke="#22c55e" strokeWidth="5" strokeLinecap="round" fill="none"/>
        <path d="M100 58l6.4 13 14.4 2.1-10.4 10.1 2.5 14.3-12.9-6.8-12.9 6.8 2.5-14.3-10.4-10.1 14.4-2.1z" fill="#fbbf24"/>
        <path d="M129 92l3.2 6.5 7.2 1-5.2 5.1 1.2 7.1-6.4-3.4-6.4 3.4 1.2-7.1-5.2-5.1 7.2-1z" fill="#f59e0b"/>
        <path d="M73 92l2.6 5.2 5.7.8-4.1 4 1 5.7-5.2-2.7-5.2 2.7 1-5.7-4.1-4 5.7-.8z" fill="#fcd34d"/>
        <circle cx="86" cy="50" r="3.4" fill="#3b82f6"/>
        <circle cx="121" cy="123" r="3.4" fill="#ef4444"/>
        <circle cx="63" cy="113" r="3" fill="#fbbf24"/>
        <circle cx="139" cy="50" r="3" fill="#22c55e"/>
      </svg>
      <svg viewBox="0 0 24 24" className="absolute left-[8px] top-[8px] h-[15px] w-[15px]" style={{ animation:"sbTwinkle 2.4s ease-in-out infinite" }}><path d="M12 2l2 8 8 2-8 2-2 8-2-8-8-2 8-2z" fill="#fbbf24"/></svg>
      <svg viewBox="0 0 24 24" className="absolute bottom-[4px] left-[18px] h-[17px] w-[17px]" style={{ animation:"sbTwinkle 2.9s .5s ease-in-out infinite" }}><path d="M12 2l2 8 8 2-8 2-2 8-2-8-8-2 8-2z" fill="none" stroke="#22c55e" strokeWidth="2.4" strokeLinejoin="round"/></svg>
      <svg viewBox="0 0 24 24" className="absolute right-[6px] top-[54px] h-[12px] w-[12px]" style={{ animation:"sbTwinkle 2.1s .9s ease-in-out infinite" }}><path d="M12 2l2 8 8 2-8 2-2 8-2-8-8-2 8-2z" fill="none" stroke="#9ca3af" strokeWidth="2.2" strokeLinejoin="round"/></svg>
      <svg viewBox="0 0 24 24" className="absolute right-[28px] top-[4px] h-[10px] w-[10px]" style={{ animation:"sbTwinkle 2.6s .3s ease-in-out infinite" }}><path d="M12 2l2 8 8 2-8 2-2 8-2-8-8-2 8-2z" fill="#fca5a5"/></svg>
    </div>
  );
}

function SignupSuccessPage({ setPage }: { setPage:(p:Page)=>void }) {
  const c = useAuthPalette();
  const profile = useProfile();
  const perks = [
    { t:"Escrow protection active", d:"Every order you place is held safely until delivery is confirmed." },
    { t:"Secure wallet ready", d:"Deposit funds and receive payouts straight from your dashboard." },
    { t:"Your merchant link reserved", d:"A permanent storefront URL is ready whenever you start selling." },
  ];
  return (
    <div className="flex min-h-screen items-center justify-center px-5" style={{ background:c.page, fontFamily:FONT }}>
      <div className="w-full max-w-[560px] py-12 text-center">
        <ConfettiBurstArt/>
        <h1 className="mx-auto mt-4 max-w-[430px] text-[24px] font-bold leading-snug" style={{ color:c.text }}>Congratulations, account created successfully</h1>
        <button onClick={()=>setPage("marketplace")} className="mt-7 h-[46px] w-full rounded-full text-[15px] font-medium text-white transition-all hover:opacity-90 active:scale-[0.99]" style={{ background:P }}>Go to Marketplace</button>
        {/* Premium extras — what the new account already includes */}
        <div className="mx-auto mt-9 max-w-[430px] rounded-xl border p-4 text-left" style={{ borderColor:c.rule, background:c.panel }}>
          <p className="text-[11px] font-bold tracking-[0.12em]" style={{ color:P }}>YOUR ACCOUNT INCLUDES</p>
          <div className="mt-3 space-y-3">
            {perks.map((perk)=>(
              <div key={perk.t} className="flex items-start gap-2.5">
                <span className="mt-0.5 grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full" style={{ background:"rgba(34,197,94,0.14)" }}>
                  <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4l2.6 2.6L9 1" stroke="#16a34a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </span>
                <span className="min-w-0">
                  <span className="block text-[13.5px] font-semibold leading-5" style={{ color:c.text }}>{perk.t}</span>
                  <span className="block text-[12.5px] leading-[18px]" style={{ color:c.sub }}>{perk.d}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
        {profile.email ? <p className="mt-5 text-[12.5px]" style={{ color:c.sub }}>Signed in as <span className="font-semibold" style={{ color:c.text }}>{profile.email}</span></p> : null}
      </div>
    </div>
  );
}

// ─── MARKETPLACE COMPONENTS ───────────────────────────────────────────────────

// Product icon square (emoji fallback — retained for legacy callers)
function ProductIcon({ bg, char, size=48 }: { bg:string; char:string; size?:number }) {
  return (
    <div className="rounded-xl flex items-center justify-center shrink-0 text-xl select-none"
      style={{ width:size, height:size, background:bg, fontSize:size*0.45 }}>
      {char}
    </div>
  );
}

// Seller badge (⚡ or 🤚)
function SellerBadge({ type }: { type:"flash"|"hand" }) {
  return <span className="text-xs">{type==="flash" ? "⚡" : "🤚"}</span>;
}

// Product card — VERTICAL LIST VIEW (used in listings, Other Products)
function ProductCardList({ product, onBuy }: { product:Product; onBuy?:()=>void }) {
  const [liked, setLiked] = useState(false);
  return (
    <div className="sb-pcard flex items-center gap-3 p-4 rounded-2xl relative">
      <BrandIcon brand={product.brand}/>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-white leading-snug mb-1 pr-2 line-clamp-1">{product.title}</p>
        <div className="flex items-center gap-1.5 mb-1">
          <StarsMini rating={product.rating}/>
          <span className="text-xs text-gray-400">By {product.seller}</span>
          <SellerBadge type={product.badge}/>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0"/>
          <span className="text-xs text-green-400">{product.available} available</span>
        </div>
      </div>
      <div className="flex flex-col items-end gap-2 shrink-0">
        <button onClick={()=>setLiked(!liked)} className="text-gray-500 hover:text-white transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill={liked?"#f04e23":"none"} stroke={liked?"#f04e23":"currentColor"} strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
        </button>
        <span className="text-base font-extrabold text-white" style={{fontVariantNumeric:"tabular-nums"}}>${product.price.toFixed(2)}</span>
        <button onClick={onBuy} className="text-xs font-bold px-4 py-1.5 rounded-full text-white whitespace-nowrap hover:opacity-90 transition-all active:scale-[0.95]" style={{background:P}}>Buy now</button>
      </div>
    </div>
  );
}

// Product card — HORIZONTAL SCROLL (Trending Now)
function ProductCardHorizontal({ product, onBuy }: { product:Product; onBuy?:()=>void }) {
  const [liked,setLiked]=useState(false);
  return (
    <div className="sb-pcard rounded-2xl p-3 flex flex-col shrink-0" style={{width:150}}>
      <div className="flex justify-between items-start mb-3">
        <BrandIcon brand={product.brand} size={44}/>
        <button onClick={()=>setLiked(!liked)} className="text-gray-500 hover:text-white transition-colors mt-0.5">
          <svg width="15" height="15" viewBox="0 0 24 24" fill={liked?"#f04e23":"none"} stroke={liked?"#f04e23":"currentColor"} strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
        </button>
      </div>
      <p className="text-xs font-bold text-white leading-snug mb-1.5 line-clamp-2 flex-1">{product.title}</p>
      <div className="flex items-center gap-1 mb-1">
        <StarsMini rating={product.rating}/>
      </div>
      <p className="text-[10px] text-gray-400 mb-1">By {product.seller} <SellerBadge type={product.badge}/></p>
      <div className="flex items-center gap-1 mb-2">
        <span className="w-1.5 h-1.5 rounded-full bg-green-500"/>
        <span className="text-[10px] text-green-400">{product.available} available</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm font-extrabold text-white" style={{fontVariantNumeric:"tabular-nums"}}>${product.price.toFixed(2)}</span>
        <button onClick={onBuy} className="text-[10px] font-bold px-2.5 py-1.5 rounded-full text-white transition-all active:scale-[0.95]" style={{background:P}}>Buy now</button>
      </div>
    </div>
  );
}

// Skeleton placeholders that mirror the real product cards while data loads.
function ProductCardHorizontalSkeleton() {
  return (
    <div className="rounded-2xl p-3 flex flex-col shrink-0" style={{ width: 150, background: MCARD, border: `1px solid ${MBD}`, boxShadow: "var(--sb-pshadow)" }}>
      <div className="flex justify-between items-start mb-3">
        <Skeleton className="h-11 w-11" rounded="rounded-xl"/>
        <Skeleton className="h-4 w-4" rounded="rounded-full"/>
      </div>
      <Skeleton className="h-3 w-full mb-1.5"/>
      <Skeleton className="h-3 w-3/4 mb-2.5"/>
      <Skeleton className="h-2.5 w-16 mb-3"/>
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-12"/>
        <Skeleton className="h-6 w-14" rounded="rounded-full"/>
      </div>
    </div>
  );
}
function ProductCardListSkeleton() {
  return (
    <div className="flex items-center gap-3 p-4 rounded-2xl" style={{ background: MCARD, border: `1px solid ${MBD}`, boxShadow: "var(--sb-pshadow)" }}>
      <Skeleton className="h-12 w-12" rounded="rounded-xl"/>
      <div className="flex-1 min-w-0 space-y-2">
        <Skeleton className="h-3.5 w-4/5"/>
        <Skeleton className="h-3 w-2/5"/>
        <Skeleton className="h-2.5 w-24"/>
      </div>
      <div className="flex flex-col items-end gap-2 shrink-0">
        <Skeleton className="h-4 w-14"/>
        <Skeleton className="h-7 w-16" rounded="rounded-full"/>
      </div>
    </div>
  );
}

// ─── PRODUCT PURCHASE SHEET (Buy now → slide-up modal) ────────────────────────
function ProductPurchaseSheet({ product, setPage, onClose }:
  { product:Product; setPage:(p:Page)=>void; onClose:()=>void }) {
  useScrollLock(true); // lock the page behind the slide-up sheet
  // One selectable row per account the seller listed (their entered quantity).
  const accounts = Array.from({ length: Math.max(product.available, 1) }, (_, i) => ({ id: i + 1, price: product.price }));
  const [selected, setSelected] = useState<Set<number>>(() => new Set([1]));
  // Prefer the seller's own description; fall back to a sensible line only when
  // the listing has none, so the cart / purchase always carry real text.
  const desc = (product.description && product.description.trim())
    ? product.description.trim()
    : (product.brand === "whatsapp"
        ? "USA 🇺🇸 WhatsApp number for verification , it a one time verification number, Code will be available after purchase"
        : `${product.title} — full account details and access code will be available right after purchase.`);
  const [coupon, setCoupon] = useState("");
  const [couponState, setCouponState] = useState<"none" | "ok" | "bad">("none");
  const [paid, setPaid] = useState(false);
  // Real wallet balance from the server (0 until it loads).
  const [walletBalance, setWalletBalance] = useState(0);
  // Real seller stats, looked up by name from the merchants list.
  const [sellerStats, setSellerStats] = useState<{ id?: number | string; sales: string; success: string } | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetchWalletBalance().then((r) => { if (!cancelled && r) setWalletBalance(r.balance); });
    fetchMerchants().then((rows) => {
      if (cancelled || !rows) return;
      const m = rows.find((x) => x.name.toLowerCase() === product.seller.toLowerCase());
      if (m) setSellerStats({
        id: m.merchant_id ?? m.id,
        sales: m.sales >= 1000 ? `${(m.sales / 1000).toFixed(1)}k` : String(m.sales),
        success: `${m.success_rate}%`,
      });
    });
    return () => { cancelled = true; };
  }, [product.seller]);

  // Select/deselect an account for the immediate purchase (does NOT touch the cart).
  const toggle = (id: number) => setSelected(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  // Explicit "Add to cart" — the only path that writes to the persistent cart.
  const [addedToCart, setAddedToCart] = useState<Set<number>>(() => new Set());
  const addToCart = (id: number) => {
    if (addedToCart.has(id)) return;
    setAddedToCart(prev => new Set(prev).add(id));
    addCartItem({ title: product.title, description: desc, brand: product.brand, seller: product.seller, price: product.price });
    try { sessionStorage.removeItem("sb-cart"); sessionStorage.removeItem("sb-cart-count"); } catch { /* ignore */ }
    toast.success("Added to your cart", { title: product.title });
  };
  const subtotal = [...selected].reduce((sum) => sum + product.price, 0);
  const openPreview = (id: number) => {
    const url = product.previewUrl || "https://www.simbazaar.com";
    window.open(`${url}${url.includes("?") ? "&" : "?"}account=${id}`, "_blank", "noopener");
  };
  const discount = couponState === "ok" ? +(subtotal * 0.05).toFixed(2) : 0;
  const total = +(Math.max(subtotal - discount, 0) * 1.10).toFixed(2);

  const applyCoupon = () => {
    if (!coupon.trim()) return;
    setCouponState(coupon.trim().toUpperCase() === "SIM5" ? "ok" : "bad");
  };
  const viewStore = () => {
    // Pass the real seller identity/stats when known; the storefront resolves
    // the rest from the database by id.
    setStoreMerchant({ id: sellerStats?.id, name: product.seller, sales: sellerStats?.sales, success: sellerStats?.success });
    onClose();
    setPage("store");
  };
  const [paying, setPaying] = useState(false);
  const [payErr, setPayErr] = useState("");
  const [needsFunds, setNeedsFunds] = useState(false);
  const GLYPH_BY_BRAND: Record<string, string> = { whatsapp: "whatsapp", gmail: "voice", facebook: "facebook" };
  const pay = async () => {
    if (paid || paying || selected.size === 0) return;
    if (!isAuthed()) { setPage("login"); return; }
    setPaying(true); setPayErr(""); setNeedsFunds(false);
    // One order per selected account, charged sequentially from the wallet so
    // the balance is re-checked before each charge (no self-double-spend).
    let placed = 0;
    for (let i = 0; i < selected.size; i++) {
      const result = await createPurchase({
        product_id: product.id,
        title: product.title,
        glyph: GLYPH_BY_BRAND[product.brand] ?? "whatsapp",
        description: desc,
        product_type: product.brand.charAt(0).toUpperCase() + product.brand.slice(1),
        seller: product.seller,
        price: product.price,
      });
      if (!result.ok) {
        setPaying(false);
        const msg = placed > 0
          ? `Placed ${placed} order${placed === 1 ? "" : "s"}. ${result.error ?? ""}`.trim()
          : (result.error ?? "Payment could not be completed.");
        setPayErr(msg);
        setNeedsFunds(Boolean(result.needsFunds));
        toast.error(msg, { title: result.needsFunds ? "Insufficient balance" : "Payment failed" });
        if (placed > 0) { try { sessionStorage.removeItem("sb-purchases"); } catch { /* ignore */ } }
        return;
      }
      placed += 1;
    }
    try { sessionStorage.removeItem("sb-purchases"); sessionStorage.removeItem("sb-wallet-tx"); } catch { /* ignore */ }
    setPaying(false);
    setPaid(true);
    toast.success(`${placed} order${placed === 1 ? "" : "s"} confirmed — check My Purchase`, { title: "Payment successful" });
    setTimeout(() => { onClose(); setPage("purchase"); }, 1200);
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-end md:items-center justify-center md:p-5"
      style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(2px)", fontFamily: FONT }}
      onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        className="w-full md:max-w-[520px] flex flex-col overflow-hidden rounded-t-[24px] md:rounded-[22px] animate-[sheetUp_.28s_cubic-bezier(.2,.9,.3,1)] md:animate-[popIn_.22s_cubic-bezier(.2,.9,.3,1.3)] shadow-2xl min-h-[84vh] md:min-h-0"
        style={{ background: "var(--sb-card)", maxHeight: "92vh" }}>

        {/* Drag line — tap to close (mobile) */}
        <button onClick={onClose} aria-label="Close" className="pt-2.5 pb-2 w-full flex justify-center md:hidden">
          <span className="w-12 h-[5px] rounded-full" style={{ background: "var(--sb-chip)" }}/>
        </button>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-4 md:px-5 pt-2" style={{ scrollbarWidth: "thin", scrollbarColor: `${P} transparent` }}>

          {/* ── Product header */}
          <div className="flex items-start gap-3">
            <BrandIcon brand={product.brand} size={52}/>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <p className="text-[16px] font-extrabold text-white leading-snug truncate">{product.title}</p>
                <p className="text-[16px] font-extrabold text-white shrink-0">$ {product.price.toFixed(2)}</p>
              </div>
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                <StarsMini rating={product.rating}/>
                <VerifiedBadge size={15}/>
                <span className="text-[12px] font-semibold" style={{ color: "#16a34a" }}>{product.available} available</span>
              </div>
              <div className="flex items-center gap-1 mt-1.5">
                <span className="text-[12px]">✋</span>
                <span className="text-[11px] font-bold text-white">Delivery in 5 minutes</span>
              </div>
            </div>
          </div>

          {/* ── Seller strip */}
          <div className="flex items-center gap-3 rounded-[16px] px-3.5 py-3 mt-4" style={{ background: "rgba(240,78,35,0.08)" }}>
            <span className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: "var(--sb-card)", border: "1.5px solid var(--sb-bd)" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-white"><circle cx="12" cy="8" r="3.6"/><path d="M5 20c.8-3.4 3.5-5.4 7-5.4s6.2 2 7 5.4"/></svg>
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1">
                <span className="text-[14px] font-bold text-white truncate">{product.seller}</span>
                <VerifiedBadge size={14}/>
              </div>
              {sellerStats
                ? <p className="text-[12px] text-white mt-0.5">{sellerStats.sales} Sales <span className="mx-0.5">•</span> {sellerStats.success} Success Rate</p>
                : <p className="text-[12px] mt-0.5" style={{ color: "rgba(255,255,255,0.6)" }}>Verified seller</p>}
            </div>
            <button onClick={viewStore} className="flex items-center gap-1 text-[13px] font-bold shrink-0 transition hover:opacity-80 active:scale-95" style={{ color: P }}>
              View store <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
            </button>
          </div>

          {/* ── Description */}
          <div className="flex items-center gap-1.5 mt-4">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={P} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M8 13h8M8 17h5"/></svg>
            <span className="text-[14px] font-bold text-white">Description</span>
          </div>
          <p className="text-[13px] leading-relaxed mt-1.5" style={{ color: "var(--sb-chip-text)" }}>{desc}</p>

          {/* ── Select account */}
          <div className="flex items-center justify-between mt-4 mb-2">
            <span className="text-[14px] font-bold text-white">Select account</span>
            <span className="text-[13px] font-bold" style={{ color: P }}>({selected.size} of {accounts.length} selected)</span>
          </div>
          <div className="space-y-2.5 max-h-[240px] overflow-y-auto pr-1.5 pb-1" style={{ scrollbarWidth: "thin", scrollbarColor: `${P} transparent`, borderTop: "1px solid var(--sb-bd)", paddingTop: 10 }}>
            {accounts.map(acc => {
              const isSel = selected.has(acc.id);
              return (
                <div key={acc.id} className="flex items-center gap-3 rounded-[14px] px-3.5 py-3 transition-colors" style={isSel
                    ? { background: "rgba(240,78,35,0.08)", border: `1.5px solid ${P}` }
                    : { background: "var(--sb-card)", border: "1px solid var(--sb-bd)", boxShadow: "0 1px 6px rgba(0,0,0,0.05)" }}>
                  <button onClick={() => toggle(acc.id)} aria-label={`Select account ${acc.id}`} className="w-[20px] h-[20px] rounded-full shrink-0 flex items-center justify-center transition-all"
                    style={isSel ? { background: P } : { border: "2px solid var(--sb-bd)" }}>
                    {isSel && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-semibold text-white">Account {acc.id}</p>
                    <p className="text-[13px] font-bold mt-0.5" style={{ color: P }}>$ {acc.price.toFixed(2)}</p>
                  </div>
                  {product.previewUrl && (
                    <button onClick={() => openPreview(acc.id)} title="Preview this account" aria-label={`Preview account ${acc.id}`}
                      className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition hover:opacity-75 active:scale-95"
                      style={{ border: "1.5px solid var(--sb-bd)", color: "var(--sb-chip-text)" }}>
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    </button>
                  )}
                  <button onClick={() => addToCart(acc.id)}
                    className="px-4 py-2 rounded-full text-[12.5px] font-bold text-white shrink-0 transition-all active:scale-95 hover:opacity-90 disabled:opacity-60"
                    disabled={addedToCart.has(acc.id)}
                    style={{ background: P }}>
                    {addedToCart.has(acc.id) ? "Added ✓" : "Add to cart"}
                  </button>
                </div>
              );
            })}
          </div>

          {/* ── Coupon */}
          <p className="text-[14px] font-bold text-white mt-4 mb-2">Coupon code</p>
          <div className="flex items-center gap-2">
            <input value={coupon} onChange={(e) => { setCoupon(e.target.value); setCouponState("none"); }} placeholder="Enter coupon"
              className="flex-1 rounded-[12px] px-4 py-3 text-[13px] text-white outline-none placeholder:text-gray-500 min-w-0"
              style={{ background: "var(--sb-chip)" }}/>
            <button onClick={applyCoupon} className="px-5 py-3 rounded-[12px] text-[13px] font-bold shrink-0 transition hover:opacity-80 active:scale-95"
              style={{ background: "var(--sb-chip)", color: "var(--sb-chip-text)" }}>Apply</button>
          </div>
          {couponState === "ok" && <p className="text-[12px] font-semibold mt-1.5" style={{ color: "#16a34a" }}>Coupon applied — 5% off</p>}
          {couponState === "bad" && <p className="text-[12px] font-semibold mt-1.5" style={{ color: "#e02d2d" }}>Invalid coupon code</p>}

          {/* ── Summary */}
          <div className="rounded-[16px] px-4 py-3.5 mt-4 mb-3" style={{ background: "rgba(240,78,35,0.08)" }}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[12px] text-white">Total ({selected.size} item{selected.size === 1 ? "" : "s"})</p>
                <p className="text-[17px] font-extrabold mt-0.5" style={{ color: P }}>$ {total.toFixed(2)}</p>
              </div>
              <button onClick={() => { onClose(); setPage("wallet"); }} className="flex items-center gap-2 rounded-[12px] px-3.5 py-2.5 transition hover:opacity-85 active:scale-95" style={{ background: "var(--sb-card)", boxShadow: "0 1px 6px rgba(0,0,0,0.07)" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-white"><rect x="2.5" y="6" width="19" height="13" rx="2.5"/><path d="M2.5 10h19"/></svg>
                <span className="text-[13px] font-bold text-white">Wallet Balance</span>
                <span className="text-[13px] font-extrabold text-white">$ {walletBalance.toFixed(2)}</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-white"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
              </button>
            </div>
            {payErr && (
              <div className="mt-3 rounded-xl px-3.5 py-2.5 text-[12.5px] font-medium" style={{ background: "rgba(239,68,68,0.10)", color: "#ef4444" }}>
                {payErr}
                {needsFunds && (
                  <button onClick={() => { onClose(); setPage("wallet"); }} className="ml-1.5 font-bold underline" style={{ color: P }}>Add funds</button>
                )}
              </div>
            )}
            <button onClick={pay} disabled={selected.size === 0 || paying}
              className="w-full mt-3.5 py-3 rounded-[6px] text-[14px] font-bold text-white transition-all hover:opacity-90 active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ background: paid ? "#16a34a" : P }}>
              {paying && <Spinner size={17}/>}
              {paid ? "✓ Payment Successful" : paying ? "Processing payment…" : `Pay $ ${total.toFixed(2)} Securely`}
            </button>
            <p className="text-center text-[11px] mt-2.5 text-white">Your payment is protected by SimBazaar Buyer Protection</p>
          </div>
        </div>
      </div>
      <style>{`@keyframes sheetUp{from{transform:translateY(60px);opacity:.4}to{transform:translateY(0);opacity:1}}`}</style>
    </div>
  );
}
function MerchantRowCard({ merchant, onViewStore }: { merchant:typeof ALL_MERCHANTS[0]; onViewStore: () => void }) {
  return (
    <div className="p-4 rounded-2xl" style={{background:MCARD, border:`1px solid ${MBD}`}}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="relative shrink-0">
            <img src={merchant.avatar} alt={merchant.name} className="w-12 h-12 rounded-full object-cover" style={{border:`2px solid rgba(255,255,255,0.1)`}}/>
            <span className="absolute -bottom-0.5 -right-0.5 text-xs">⭐</span>
          </div>
          <div>
            <p className="text-sm font-bold text-white">{merchant.name}</p>
            <span className="text-xs">⭐</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <StarIcon size={14} color="#f59e0b"/>
          <span className="text-sm font-bold text-white">{merchant.rating.toFixed(1)}</span>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <p className="text-base font-extrabold text-white">{merchant.sales >= 1000 ? `${(merchant.sales/1000).toFixed(1)}k` : merchant.sales}</p>
            <p className="text-xs text-gray-500">Sales</p>
          </div>
          <div className="w-px h-8" style={{background:"rgba(255,255,255,0.12)"}}/>
          <div>
            <p className="text-base font-extrabold text-white">{merchant.successRate}%</p>
            <p className="text-xs text-gray-500">Success Rate</p>
          </div>
        </div>
        <button onClick={onViewStore} className="flex items-center gap-1.5 px-4 py-2.5 rounded-full text-xs font-bold text-white hover:opacity-90 transition-opacity" style={{background:P}}>
          View store <ArrowRight01Icon size={12}/>
        </button>
      </div>
    </div>
  );
}

// ─── FILTER PANEL ─────────────────────────────────────────────────────────────

// Stroke SVG icons matching the reference screenshots exactly
function FiSocialMedia() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2L4.5 5.5v6c0 4.7 3.2 9 7.5 10.5 4.3-1.5 7.5-5.8 7.5-10.5v-6L12 2z"/>
      <circle cx="12" cy="10" r="2.5"/>
      <path d="M8 17c0-2.2 1.8-4 4-4s4 1.8 4 4"/>
    </svg>
  );
}
function FiEmailMsg() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="14" rx="3"/>
      <path d="M2 7l10 7 10-7"/>
    </svg>
  );
}
function FiGiftcard() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="10" width="18" height="12" rx="2"/>
      <path d="M3 10V8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2"/>
      <path d="M12 6V22"/>
      <path d="M12 6c0 0-2.5-3-4-2s-1 3.5 4 2z"/>
      <path d="M12 6c0 0 2.5-3 4-2s1 3.5-4 2z"/>
    </svg>
  );
}
function FiVPN() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9"/>
      <path d="M3 12h18"/>
      <path d="M12 3c-4 3-4 15 0 18"/>
      <path d="M12 3c4 3 4 15 0 18"/>
    </svg>
  );
}
function FiWebsites() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9"/>
      <path d="M3 12h18"/>
      <path d="M12 3c-3.5 3.5-3.5 14.5 0 18"/>
      <path d="M12 3c3.5 3.5 3.5 14.5 0 18"/>
    </svg>
  );
}
function FiEcommerce() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
      <line x1="3" y1="6" x2="21" y2="6"/>
      <path d="M16 10a4 4 0 0 1-8 0"/>
    </svg>
  );
}
function FiGaming() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="12" rx="4"/>
      <path d="M7 12h4m-2-2v4"/>
      <circle cx="16" cy="11" r="1" fill="currentColor"/>
      <circle cx="18" cy="14" r="1" fill="currentColor"/>
    </svg>
  );
}
function FiAccounts() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="3"/>
      <circle cx="12" cy="10" r="3"/>
      <path d="M6 21c0-3.3 2.7-6 6-6s6 2.7 6 6"/>
    </svg>
  );
}
function FiOthers() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9"/>
      <path d="M8 14s1.5 2 4 2 4-2 4-2"/>
      <line x1="9" y1="9" x2="9.01" y2="9" strokeWidth="2.5"/>
      <line x1="15" y1="9" x2="15.01" y2="9" strokeWidth="2.5"/>
    </svg>
  );
}

// Checkbox for sub-items
function FilterCheck({ checked, onToggle }: { checked: boolean; onToggle: () => void }) {
  return (
    // stopPropagation: the parent row also toggles, so without this a click on the
    // box fires the toggle twice (on→off) and nothing appears to happen.
    <div onClick={(e) => { e.stopPropagation(); onToggle(); }} className="shrink-0 cursor-pointer rounded flex items-center justify-center transition-colors"
      style={{ width: 18, height: 18, background: checked ? P : "rgba(255,255,255,0.06)", border: `1.5px solid ${checked ? P : "rgba(255,255,255,0.2)"}` }}>
      {checked && (
        <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
          <path d="M1 4l3 3 5-6" stroke="#fff" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )}
    </div>
  );
}

interface FilterSubItem { name: string; bg: string; icon: React.ReactNode; brand?: BrandKey; }
interface FilterCategory {
  name: string;
  Icon: React.FC;
  items: FilterSubItem[];
}

const FILTER_CATEGORIES: FilterCategory[] = [
  {
    name: "Social Media", Icon: FiSocialMedia,
    items: [
      { name:"Facebook",       bg:"#1877F2", icon:<span>f</span>, brand:"facebook" },
      { name:"Twitter",        bg:"#000000", icon:<span className="text-white font-black">𝕏</span>, brand:"x" },
      { name:"Instagram",      bg:"linear-gradient(135deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)", icon:<span>📷</span>, brand:"instagram" },
      { name:"LinkedIn",       bg:"#0A66C2", icon:<span className="text-white font-black text-[9px]">in</span>, brand:"linkedin" },
      { name:"Pinterest",      bg:"#E60023", icon:<span>📌</span>, brand:"pinterest" },
      { name:"Snapchat",       bg:"#FFFC00", icon:<span>👻</span>, brand:"snapchat" },
      { name:"TikTok",         bg:"#010101", icon:<span>🎵</span>, brand:"tiktok" },
      { name:"Threads",        bg:"#000000", icon:<span className="text-white">@</span>, brand:"threads" },
      { name:"Tinder",         bg:"#FE3C72", icon:<span>🔥</span>, brand:"tinder" },
      { name:"Bumble",         bg:"#F9B90E", icon:<span>🐝</span> },
      { name:"Reddit",         bg:"#FF4500", icon:<span>🤖</span>, brand:"reddit" },
      { name:"Discord",        bg:"#5865F2", icon:<span>💬</span>, brand:"discord" },
      { name:"Pof",            bg:"#1355be", icon:<span className="text-white text-[9px] font-bold">POF</span> },
      { name:"Hinge",          bg:"#E8184B", icon:<span className="text-white font-black">H</span> },
      { name:"Grindr",         bg:"#FEDA44", icon:<span>🐻</span> },
      { name:"Viber",          bg:"#7D3DAF", icon:<span>📞</span>, brand:"viber" },
      { name:"GMX",            bg:"#003580", icon:<span className="text-white text-[8px] font-bold">GMX</span> },
      { name:"Quora",          bg:"#B92B27", icon:<span className="text-white font-black">Q</span> },
      { name:"Match",          bg:"#E42727", icon:<span>❤️</span> },
      { name:"Ourtime",        bg:"#FF6584", icon:<span>💗</span> },
      { name:"Hellotalk",      bg:"#00C08B", icon:<span>🌍</span> },
      { name:"Zoosk",          bg:"#0080FF", icon:<span className="text-white text-[8px] font-bold">Zk</span> },
      { name:"Okcupid",        bg:"#DE2B7A", icon:<span className="text-white text-[8px] font-bold">okc</span> },
      { name:"SMSmode",        bg:"#00BFA5", icon:<span>📱</span> },
      { name:"Noplace",        bg:"#111111", icon:<span className="text-white text-[8px]">np</span> },
      { name:"TenTen",         bg:"#CC0000", icon:<span>⚡</span> },
      { name:"BeReal",         bg:"#1C1C1C", icon:<span className="text-white text-[7px] font-bold">BeR</span> },
      { name:"Airchat",        bg:"#222222", icon:<span>🎙️</span> },
      { name:"YikYak",         bg:"#4CAF50", icon:<span>🦬</span> },
      { name:"SubstackNotes",  bg:"#FF6719", icon:<span>📝</span> },
      { name:"Coverstar",      bg:"#E53935", icon:<span>⭐</span> },
      { name:"Jagat",          bg:"#1A1A2E", icon:<span>🌐</span> },
      { name:"Fizz",           bg:"#7C3AED", icon:<span>✨</span> },
      { name:"Lemon8",         bg:"#FFD600", icon:<span>🍋</span> },
      { name:"Lapse",          bg:"#FF7043", icon:<span>📸</span> },
    ],
  },
  {
    name: "Emails & Messaging Service", Icon: FiEmailMsg,
    items: [
      { name:"Gmail",         bg:"#EA4335", icon:<span className="text-white font-black text-[9px]">G</span>, brand:"gmail" },
      { name:"Ymail",         bg:"#720E9E", icon:<span className="text-white font-black text-[9px]">Y!</span>, brand:"yahoo" },
      { name:"Hotmail",       bg:"#0072C6", icon:<span className="text-white text-[8px] font-bold">H</span>, brand:"outlook" },
      { name:"MailRu",        bg:"#005FF9", icon:<span>📧</span> },
      { name:"Outlook",       bg:"#0078D4", icon:<span className="text-white text-[8px] font-bold">Ol</span>, brand:"outlook" },
      { name:"Whatsapp",      bg:"#25D366", icon:<span>💬</span>, brand:"whatsapp" },
      { name:"Google Voice",  bg:"#4285F4", icon:<span>📞</span> },
      { name:"Telegram",      bg:"#2AABEE", icon:<span>✈️</span>, brand:"telegram" },
      { name:"WeChat",        bg:"#09B83E", icon:<span>💚</span>, brand:"wechat" },
      { name:"TextNow",       bg:"#7B5EA7", icon:<span>💬</span> },
      { name:"TextPlus",      bg:"#00A651", icon:<span>➕</span> },
      { name:"Signal",        bg:"#3A76F0", icon:<span>🔵</span>, brand:"signal" },
    ],
  },
  {
    name: "Giftcards", Icon: FiGiftcard,
    items: [
      { name:"Amazon",       bg:"#FF9900", icon:<span className="text-white font-black text-[9px]">a</span>, brand:"amazon" },
      { name:"Amex",         bg:"#007BC1", icon:<span className="text-white text-[7px] font-bold">AMEX</span> },
      { name:"Ebay",         bg:"#E53238", icon:<span className="text-white font-black text-[9px]">e</span>, brand:"ebay" },
      { name:"Google Play",  bg:"#01875F", icon:<span>▶️</span> },
      { name:"Nike",         bg:"#111111", icon:<span className="text-white">✔</span> },
      { name:"NordStrom",    bg:"#000000", icon:<span className="text-white font-black text-[9px]">N</span> },
      { name:"Playstation",  bg:"#003087", icon:<span>🎮</span>, brand:"playstation" },
      { name:"Sephora",      bg:"#000000", icon:<span className="text-white text-[8px] font-bold">S</span> },
      { name:"Steam",        bg:"#1B2838", icon:<span>🎮</span>, brand:"steam" },
    ],
  },
  {
    name: "VPN & PROXYs", Icon: FiVPN,
    items: [
      { name:"Windscribe",  bg:"#0F4C81", icon:<span>💨</span> },
      { name:"Nord",        bg:"#4687FF", icon:<span>🛡️</span> },
      { name:"911 Proxy",   bg:"#6A0DAD", icon:<span>🔮</span> },
      { name:"Pia",         bg:"#4CAF50", icon:<span>🔒</span>, brand:"pia" },
      { name:"Express",     bg:"#DA3940", icon:<span>🚀</span>, brand:"expressvpn" },
      { name:"IP VANISH",   bg:"#222222", icon:<span className="text-[#E8B84B] text-[7px] font-bold">IP</span> },
      { name:"CyberGhost",  bg:"#E8B84B", icon:<span>👻</span>, brand:"cyberghost" },
      { name:"Private",     bg:"#1C1C2E", icon:<span>🔐</span> },
      { name:"Total",       bg:"#1565C0", icon:<span>🌐</span> },
      { name:"Surfshark",   bg:"#1A9E8F", icon:<span>🦈</span>, brand:"surfshark" },
    ],
  },
  {
    name: "Websites", Icon: FiWebsites,
    items: [
      { name:"Website",   bg:"#374151", icon:<span>🌐</span> },
      { name:"Onlyfans",  bg:"#1DA1F2", icon:<span className="text-white text-[7px] font-bold">OF</span> },
    ],
  },
  {
    name: "E-commerce Platforms", Icon: FiEcommerce,
    items: [
      { name:"Aliexpress",   bg:"#FF6A00", icon:<span className="text-white text-[8px] font-bold">Ali</span> },
      { name:"Alibaba",      bg:"#FF6A00", icon:<span>🛒</span> },
      { name:"Amazon",       bg:"#FF9900", icon:<span className="text-white font-black text-[9px]">a</span>, brand:"amazon" },
      { name:"Shopify",      bg:"#96BF48", icon:<span>🛍️</span> },
      { name:"Ebay",         bg:"#E53238", icon:<span className="text-white font-black text-[9px]">e</span>, brand:"ebay" },
      { name:"Shopee",       bg:"#EE4D2D", icon:<span>🧡</span> },
      { name:"OZON",         bg:"#005BFF", icon:<span className="text-white text-[7px] font-bold">OZ</span> },
      { name:"RedBook",      bg:"#FF2741", icon:<span>📕</span> },
      { name:"OLX",          bg:"#6ABF4B", icon:<span className="text-[8px] font-bold text-white">OLX</span> },
      { name:"Vinted",       bg:"#09B4A8", icon:<span className="text-white font-black text-[9px]">V</span> },
      { name:"youla.ru",     bg:"#7B4FBF", icon:<span>💎</span> },
      { name:"JDcom",        bg:"#CC0000", icon:<span className="text-white text-[7px] font-bold">JD</span> },
      { name:"Magicbricks",  bg:"#D0021B", icon:<span className="text-white text-[7px] font-bold">mb</span> },
      { name:"Wish",         bg:"#2FB7EC", icon:<span className="text-white font-black text-[9px]">W</span> },
    ],
  },
  {
    name: "Gaming", Icon: FiGaming,
    items: [
      { name:"Playstation",   bg:"#003087", icon:<span>🎮</span> },
      { name:"Call of Duty",  bg:"#D4A84B", icon:<span>🔫</span> },
      { name:"PUBG",          bg:"#F5C518", icon:<span className="text-black text-[7px] font-bold">PUBG</span> },
      { name:"Steam",         bg:"#1B2838", icon:<span>🎮</span>, brand:"steam" },
      { name:"GTA",           bg:"#1C1C1C", icon:<span className="text-white font-black text-[8px]">GTA</span> },
      { name:"Fortnite",      bg:"#7B2FBE", icon:<span>⚡</span> },
      { name:"Epic",          bg:"#313131", icon:<span className="text-white text-[7px] font-bold">Epic</span> },
    ],
  },
  {
    name: "Accounts & Subscriptions", Icon: FiAccounts,
    items: [
      { name:"Netflix",    bg:"#E50914", icon:<span className="text-white font-black text-[8px]">N</span>, brand:"netflix" },
      { name:"Spotify",    bg:"#1DB954", icon:<span>🎵</span>, brand:"spotify" },
      { name:"YouTube",    bg:"#FF0000", icon:<span>▶️</span>, brand:"youtube" },
      { name:"Disney+",    bg:"#113CCF", icon:<span>✨</span> },
      { name:"Apple TV",   bg:"#1C1C1E", icon:<span>🍎</span>, brand:"apple" },
      { name:"Hulu",       bg:"#1CE783", icon:<span className="text-black font-bold text-[8px]">H</span> },
      { name:"Amazon Prime", bg:"#00A8E0", icon:<span>▶️</span> },
      { name:"iCloud",     bg:"#1C1C1E", icon:<span>☁️</span> },
    ],
  },
  {
    name: "Others", Icon: FiOthers,
    items: [
      { name:"Miscellaneous", bg:"#374151", icon:<span>📦</span> },
      { name:"Other Services", bg:"#4B5563", icon:<span>🔧</span> },
    ],
  },
];

/* Dual-thumb price slider + editable min/max — updates filters in real time */
function PriceRangeControl({ min, max, setMin, setMax }: { min:number; max:number; setMin:(n:number)=>void; setMax:(n:number)=>void }) {
  const LO = 0, HI = 1000;
  const pct = (v:number) => ((v - LO) / (HI - LO)) * 100;
  const clampMin = (v:number) => setMin(Math.max(LO, Math.min(Number.isFinite(v) ? v : LO, max - 1)));
  const clampMax = (v:number) => setMax(Math.min(HI, Math.max(Number.isFinite(v) ? v : HI, min + 1)));
  return (
    <>
      <div className="relative mb-6" style={{ height: 22, marginLeft: 8, marginRight: 8 }}>
        <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 rounded-full" style={{ height: 4, background: "var(--sb-chip)" }}/>
        <div className="absolute top-1/2 -translate-y-1/2 rounded-full" style={{ height: 4, left: `${pct(min)}%`, right: `${100 - pct(max)}%`, background: P }}/>
        <input type="range" min={LO} max={HI} value={min} onChange={(e)=>clampMin(Number(e.target.value))} className="sb-range" aria-label="Minimum price"/>
        <input type="range" min={LO} max={HI} value={max} onChange={(e)=>clampMax(Number(e.target.value))} className="sb-range" aria-label="Maximum price"/>
      </div>
      <div className="flex items-center gap-2">
        <label className="flex-1 px-3 py-2.5 rounded-xl block cursor-text" style={{ background: "var(--sb-chip)" }}>
          <p className="text-[10px] font-bold mb-1" style={{ color: "var(--sb-chip-text)" }}>Minimum</p>
          <div className="flex items-center text-sm font-bold text-white">
            <span>$&nbsp;</span>
            <input type="number" inputMode="numeric" value={min} onChange={(e)=>clampMin(parseInt(e.target.value, 10) || 0)} className="w-full bg-transparent outline-none text-sm font-bold text-white"/>
          </div>
        </label>
        <span className="text-gray-500 font-bold text-sm shrink-0">—</span>
        <label className="flex-1 px-3 py-2.5 rounded-xl block cursor-text" style={{ background: "var(--sb-chip)" }}>
          <p className="text-[10px] font-bold mb-1" style={{ color: "var(--sb-chip-text)" }}>Maximum</p>
          <div className="flex items-center text-sm font-bold text-white">
            <span>$&nbsp;</span>
            <input type="number" inputMode="numeric" value={max} onChange={(e)=>clampMax(parseInt(e.target.value, 10) || HI)} className="w-full bg-transparent outline-none text-sm font-bold text-white"/>
          </div>
        </label>
      </div>
    </>
  );
}

function FilterPanel({ open, onClose, priceMin, priceMax, setPriceMin, setPriceMax, brandFilters, toggleBrand, clearBrands }: {
  open: boolean; onClose: () => void;
  priceMin: number; priceMax: number; setPriceMin: (n:number)=>void; setPriceMax: (n:number)=>void;
  brandFilters: string[]; toggleBrand: (brand:string)=>void; clearBrands: ()=>void;
}) {
  const [expandedCat, setExpandedCat] = useState<string | null>(null);
  const toggleCat = (name: string) => setExpandedCat(prev => prev === name ? null : name);

  useScrollLock(open); // lock background scroll while the filter panel is open
  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[75]" style={{ background: "rgba(0,0,0,0.5)" }} onClick={onClose}/>

      {/* Panel — full height, sits above the app header */}
      <div className="fixed left-0 top-0 bottom-0 z-[80] overflow-y-auto" style={{ width: "min(78vw, 330px)", background: MBG }}>
        <div className="px-4 pt-5 pb-24">

          {/* Header */}
          <div className="flex items-center justify-between mb-1">
            <p className="text-[16px] font-bold text-white" style={{ fontFamily: FONT }}>Filter</p>
            <button onClick={onClose} aria-label="Close filters" className="p-1 text-white transition-transform hover:rotate-90 duration-200">
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>
          <p className="text-[13px] font-bold text-white mb-3" style={{ fontFamily: FONT }}>Account Category</p>

          {/* Categories */}
          <div>
            {FILTER_CATEGORIES.map(({ name, Icon, items }) => {
              const isOpen = expandedCat === name;
              return (
                <div key={name}>
                  {/* Category header row */}
                  <button
                    className="w-full flex items-center justify-between py-3 transition-opacity active:opacity-70"
                    style={{ borderBottom: isOpen ? "none" : "1px solid var(--sb-mbd)" }}
                    onClick={() => toggleCat(name)}
                  >
                    <div className="flex items-center gap-2.5 text-gray-200 min-w-0">
                      <span className="shrink-0"><Icon/></span>
                      <span className="text-[13px] font-bold text-left leading-snug truncate">{name}</span>
                    </div>
                    <svg width="11" height="7" viewBox="0 0 11 7" fill="none" className="shrink-0 ml-2 transition-transform" style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}>
                      <path d="M1 1l4.5 4.5L10 1" stroke="#6b7280" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>

                  {/* Sub-items (accordion) */}
                  {isOpen && (
                    <div className="pb-1" style={{ borderBottom: "1px solid var(--sb-mbd)" }}>
                      {items.map(item => {
                        const brand = item.brand ?? item.name.toLowerCase().replace(/[^a-z0-9]+/g, "");
                        const active = brandFilters.includes(brand);
                        return (
                          <div key={item.name} className="flex items-center gap-3 py-2.5 cursor-pointer" onClick={() => toggleBrand(brand)}>
                            <FilterCheck checked={active} onToggle={() => toggleBrand(brand)}/>
                            {item.brand ? (
                              <BrandIcon brand={item.brand} size={26} radius={7}/>
                            ) : (
                              <span className="rounded-[7px] flex items-center justify-center shrink-0 text-white font-extrabold text-[10px] uppercase leading-none"
                                style={{ width: 26, height: 26, background: item.bg }}>
                                {item.name.replace(/[^A-Za-z0-9]/g, "").slice(0, 2)}
                              </span>
                            )}
                            <span className="text-[13px] text-gray-200 font-bold">{item.name}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Price range */}
          <p className="text-[14px] font-bold text-white mt-6 mb-5" style={{ fontFamily: FONT }}>Price range</p>

          <PriceRangeControl min={priceMin} max={priceMax} setMin={setPriceMin} setMax={setPriceMax}/>

        </div>
      </div>
    </>
  );
}

// Custom wallet icon matching the reference screenshot (open bifold wallet)
function WalletTabIcon({ color }: { color: string }) {
  return (
    <svg width="24" height="22" viewBox="0 0 24 22" fill="none">
      <rect x="1" y="4" width="22" height="15" rx="3" stroke={color} strokeWidth="1.7"/>
      <path d="M1 8h22" stroke={color} strokeWidth="1.7"/>
      <path d="M5 1l3 3H1" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill={color} fillOpacity="0.15"/>
      <rect x="15" y="11" width="6" height="5" rx="1.5" fill={color} opacity="0.85"/>
      <circle cx="18" cy="13.5" r="1" fill="#0a0a0a"/>
    </svg>
  );
}

// Bottom Tab Bar — solid filled icon variants shown on the active tab
function HomeTabFilled({ color }: { color:string }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path fillRule="evenodd" clipRule="evenodd" d="M12.53 2.47a.75.75 0 0 0-1.06 0l-8.5 8.03A2.25 2.25 0 0 0 2.25 12v7.25A2.25 2.25 0 0 0 4.5 21.5h15a2.25 2.25 0 0 0 2.25-2.25V12c0-.63-.26-1.2-.72-1.5l-8.5-8.03ZM10 21.5v-5.25a2 2 0 1 1 4 0v5.25h-4Z" fill={color}/>
    </svg>
  );
}

function MarketTabFilled({ color }: { color:string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <rect x="3.25" y="3.25" width="7.5" height="7.5" rx="1.8" fill={color}/>
      <rect x="13.25" y="3.25" width="7.5" height="7.5" rx="1.8" fill={color}/>
      <rect x="3.25" y="13.25" width="7.5" height="7.5" rx="1.8" fill={color}/>
      <rect x="13.25" y="13.25" width="7.5" height="7.5" rx="1.8" fill={color}/>
    </svg>
  );
}

function MarketTabOutline({ color }: { color:string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <rect x="3.6" y="3.6" width="6.8" height="6.8" rx="1.6" stroke={color} strokeWidth="1.6"/>
      <rect x="13.6" y="3.6" width="6.8" height="6.8" rx="1.6" stroke={color} strokeWidth="1.6"/>
      <rect x="3.6" y="13.6" width="6.8" height="6.8" rx="1.6" stroke={color} strokeWidth="1.6"/>
      <rect x="13.6" y="13.6" width="6.8" height="6.8" rx="1.6" stroke={color} strokeWidth="1.6"/>
    </svg>
  );
}

function PurchaseTabOutline({ color }: { color:string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M8.5 8V6.25a3.5 3.5 0 0 1 7 0V8" stroke={color} strokeWidth="1.6" strokeLinecap="round"/>
      <rect x="4.35" y="7.35" width="15.3" height="13.8" rx="3.3" stroke={color} strokeWidth="1.6"/>
    </svg>
  );
}

function PurchaseTabFilled({ color }: { color:string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M8.5 8V6.25a3.5 3.5 0 0 1 7 0V8" stroke={color} strokeWidth="1.7" strokeLinecap="round"/>
      <rect x="4" y="7" width="16" height="14.5" rx="3.5" fill={color}/>
    </svg>
  );
}

function WalletTabFilled({ color }: { color:string }) {
  return (
    <svg width="24" height="22" viewBox="0 0 24 22" fill="none">
      <path d="M5 1l3 3H1l4-3Z" fill={color}/>
      <path fillRule="evenodd" clipRule="evenodd" d="M3.5 4A2.5 2.5 0 0 0 1 6.5v10A2.5 2.5 0 0 0 3.5 19h17a2.5 2.5 0 0 0 2.5-2.5v-10A2.5 2.5 0 0 0 20.5 4h-17ZM18 14.85a1.35 1.35 0 1 0 0-2.7 1.35 1.35 0 0 0 0 2.7Z" fill={color}/>
    </svg>
  );
}

function WalletTabOutline({ color }: { color:string }) {
  return (
    <svg width="24" height="22" viewBox="0 0 24 22" fill="none">
      <path d="M5.2 1.3 7.9 4H2l3.2-2.7Z" stroke={color} strokeWidth="1.5" strokeLinejoin="round"/>
      <rect x="1.8" y="4.8" width="20.4" height="13.4" rx="2.1" stroke={color} strokeWidth="1.6"/>
      <circle cx="18" cy="11.5" r="1.35" fill={color}/>
    </svg>
  );
}

function HomeTabOutline({ color }: { color:string }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M3 10.75 12 2.9l9 7.85v8.5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-8.5Z" stroke={color} strokeWidth="1.6" strokeLinejoin="round"/>
      <path d="M9.75 21v-4.75a2.25 2.25 0 0 1 4.5 0V21" stroke={color} strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  );
}

/* Ads tab — hugeicons megaphone (native orientation faces right) */
function AdsTabOutline({ color }: { color:string }) {
  return <Megaphone01Icon size={22} color={color} strokeWidth={1.6}/>;
}

function AdsTabFilled({ color }: { color:string }) {
  return <Megaphone01Icon size={22} color={color} strokeWidth={2.4}/>;
}

function BottomTabBar({ active, setPage, setView }: { active:string; setPage:(p:Page)=>void; setView?:(v:MktView)=>void }) {
  const seller = Boolean(useProfile().is_seller);
  const handleTab = (id: string) => {
    // Home = marketplace feed; Market = products page (listings view).
    if (id === "home") { setMarketIntent({ view: "main" }); setPage("marketplace"); setView?.("main"); }
    else if (id === "market") { setMarketIntent({ view: "listings" }); setPage("marketplace"); setView?.("listings"); }
    else if (id === "purchase") setPage("purchase");
    else if (id === "ads") setPage("ads");
    else if (id === "wallet") setPage("wallet");
  };

  // Sellers get the 5-tab layout from the reference: Orders (same bag icon)
  // replaces My Purchase, and an Ads megaphone tab appears before Wallet.
  const tabs = [
    { id:"home",     label:"Home",        renderIcon:(c:string,a:boolean)=> a ? <HomeTabFilled color={c}/> : <HomeTabOutline color={c}/> },
    { id:"market",   label:"Market",      renderIcon:(c:string,a:boolean)=> a ? <MarketTabFilled color={c}/> : <MarketTabOutline color={c}/> },
    { id:"purchase", label: seller ? "Orders" : "My Purchase", renderIcon:(c:string,a:boolean)=> a ? <PurchaseTabFilled color={c}/> : <PurchaseTabOutline color={c}/> },
    ...(seller ? [{ id:"ads" as const, label:"Ads", renderIcon:(c:string,a:boolean)=> a ? <AdsTabFilled color={c}/> : <AdsTabOutline color={c}/> }] : []),
    { id:"wallet",   label:"Wallet",      renderIcon:(c:string,a:boolean)=> a ? <WalletTabFilled color={c}/> : <WalletTabOutline color={c}/> },
  ];

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 flex items-center" style={{background:"var(--sb-chrome)", borderTop:`1px solid ${MBD}`, paddingBottom:"env(safe-area-inset-bottom,0px)"}}>
      {tabs.map(({id,label,renderIcon})=>{
        const isActive = active === id;
        const color = isActive ? P : "var(--sb-tab-inactive)";
        return (
          <button key={id} onClick={()=>handleTab(id)}
            className="flex-1 flex flex-col items-center py-3 gap-1 transition-colors active:scale-95"
            style={{color}}>
            {renderIcon(color, isActive)}
            <span className="text-[11px] font-medium">{label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ─── SHARED TOPBAR COMPONENTS ─────────────────────────────────────────────────

function HeadphonesIco({ size=20, color="#9ca3af" }: { size?:number; color?:string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 18v-6a9 9 0 0 1 18 0v6"/>
      <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3z"/>
      <path d="M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/>
    </svg>
  );
}

function AppLogo({ onPress }: { onPress?:()=>void }) {
  return (
    <button onClick={onPress} className="flex items-center gap-2.5 flex-1 min-w-0">
      <Brand3D size={32}/>
      <span className="text-[15px] font-extrabold text-white tracking-tight truncate" style={{ fontFamily: FONT }}>SimBazaar</span>
    </button>
  );
}

function TopBarRight({ setPage, cartCount }: { setPage:(p:Page)=>void; cartCount?:number }) {
  const liveCount = useCartCount();
  const count = cartCount ?? liveCount;
  return (
    <div className="flex items-center gap-1 shrink-0">
      <button onClick={() => setPage("support")}
        className="w-9 h-9 flex items-center justify-center rounded-full transition-colors hover:bg-white/5 active:bg-white/10">
        <HeadphonesIco size={19} color="#9ca3af"/>
      </button>
      <div className="w-px h-5 rounded-full mx-0.5" style={{ background: "rgba(255,255,255,0.12)" }}/>
      <button onClick={() => setPage("cart")}
        className="w-9 h-9 flex items-center justify-center rounded-full relative transition-colors hover:bg-white/5 active:bg-white/10">
        <CartLineIcon size={20} color="var(--sb-nav-inactive)"/>
        {count > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-[15px] h-[15px] rounded-full flex items-center justify-center text-[9px] font-bold text-white px-0.5" style={{ background: P }}>
            {count}
          </span>
        )}
      </button>
      <button onClick={() => setPage("notifications")}
        className="w-9 h-9 flex items-center justify-center rounded-full transition-colors hover:bg-white/5 active:bg-white/10">
        <Notification01Icon size={19} color="#9ca3af"/>
      </button>
      <button onClick={() => setPage("user-profile")}
        className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all hover:opacity-90 active:scale-95"
        style={{ border: "1.5px solid rgba(255,255,255,0.2)", background: "#1e2330" }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
        </svg>
      </button>
    </div>
  );
}

// Top bar for marketplace — switches to "← Filters" mode when filter panel is open
// ─── DESKTOP TOP NAV (md+ only) ───────────────────────────────────────────────
// ─── PROMO CAROUSEL ────────────────────────────────────────────────────────────

// 3D orange shopping bag — exact match to reference (orange body + white "A")
function MerchantBag3D({ size = 104 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 130 140" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="mb_glow" cx="50%" cy="55%" r="55%">
          <stop offset="0%" stopColor="#ffa040" stopOpacity="0.8"/>
          <stop offset="70%" stopColor="#ff6500" stopOpacity="0.3"/>
          <stop offset="100%" stopColor="#ff4000" stopOpacity="0"/>
        </radialGradient>
        <linearGradient id="mb_body" x1="35" y1="42" x2="95" y2="128" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ff7a3d"/><stop offset="0.5" stopColor="#f04e23"/><stop offset="1" stopColor="#b83510"/>
        </linearGradient>
        <linearGradient id="mb_shine" x1="42" y1="42" x2="78" y2="90" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffffff" stopOpacity="0.5"/><stop offset="1" stopColor="#ffffff" stopOpacity="0"/>
        </linearGradient>
        <linearGradient id="mb_handle" x1="50" y1="28" x2="80" y2="46" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffc49e"/><stop offset="1" stopColor="#d94a1a"/>
        </linearGradient>
        <filter id="mb_shadow">
          <feDropShadow dx="0" dy="8" stdDeviation="10" floodColor="#000" floodOpacity="0.6"/>
        </filter>
      </defs>
      {/* Glow halo behind bag */}
      <ellipse cx="65" cy="98" rx="54" ry="40" fill="url(#mb_glow)"/>
      <g filter="url(#mb_shadow)">
        {/* Bag body */}
        <path d="M36 55 L44 124 Q45 132 54 132 L76 132 Q85 132 86 124 L94 55 Z" fill="url(#mb_body)"/>
        {/* Shine */}
        <path d="M36 55 L44 124 Q45 132 54 132 L76 132 Q85 132 86 124 L94 55 Z" fill="url(#mb_shine)"/>
        {/* Top rim */}
        <rect x="34" y="50" width="62" height="8" rx="4" fill="#ff9060"/>
        {/* Handles */}
        <path d="M51 52 C51 34 79 34 79 52" stroke="url(#mb_handle)" strokeWidth="5.5" strokeLinecap="round" fill="none"/>
        <path d="M51 52 C51 34 79 34 79 52" stroke="rgba(0,0,0,0.18)" strokeWidth="2" strokeLinecap="round" fill="none"/>
        {/* White "A" lettermark */}
        <text x="65" y="102" textAnchor="middle" dominantBaseline="middle"
          fontSize="40" fontWeight="900" fontFamily="Arial Black,system-ui,sans-serif"
          fill="rgba(255,255,255,0.95)">A</text>
        {/* Bottom shadow inside */}
        <path d="M42 120 L44 124 Q45 132 54 132 L76 132 Q85 132 86 124 L88 120 Z" fill="rgba(0,0,0,0.22)"/>
      </g>
      {/* Floor shadow */}
      <ellipse cx="65" cy="134" rx="30" ry="4.5" fill="rgba(0,0,0,0.4)"/>
    </svg>
  );
}

// Opens the Seller Store page for a spotlight merchant (Gold / Prince promos)
function openSpotlightStore(setPage: ((p:Page)=>void) | undefined, who: "gold" | "prince") {
  if (!setPage) return;
  setStoreMerchant(who === "gold"
    ? { name: "Gold", sales: "566+", success: "29%" }
    : { name: "Prince", avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&auto=format", sales: "7+", success: "0%" });
  setPage("store");
}

function PromoCarousel({ setPage }: { onBuy?: (p: Product) => void; setPage?: (p: Page) => void }) {
  const [idx, setIdx] = useState(0);
  const TOTAL = 3;

  useEffect(() => {
    const timer = setInterval(() => setIdx(i => (i + 1) % TOTAL), 4500);
    return () => clearInterval(timer);
  }, []);

  // Dot row — shared across all three slides
  const Dots = () => (
    <div className="flex items-center justify-center gap-1.5 pt-2 pb-2.5">
      {Array.from({ length: TOTAL }).map((_, i) => (
        <button key={i} onClick={() => setIdx(i)}
          style={{
            height: 6,
            width: i === idx ? 22 : 7,
            borderRadius: 99,
            background: i === idx ? P : "rgba(255,255,255,0.38)",
            transition: "all 0.3s",
            border: "none",
            padding: 0,
            cursor: "pointer",
          }}/>
      ))}
    </div>
  );

  return (
    <div style={{ fontFamily: FONT, borderRadius: 18, overflow: "hidden", position: "relative" }}>
      {/* Outer overflow-hidden wrapper, inner track slides */}
      <div style={{ overflow: "hidden", borderRadius: 18 }}>
        <div style={{
          display: "flex",
          transition: "transform 0.48s cubic-bezier(0.4,0,0.2,1)",
          transform: `translateX(-${idx * 100}%)`,
          willChange: "transform",
        }}>

          {/* ══ SLIDE 1 — Merchant Spotlight (dark, Gold) ══ */}
          <div style={{
            minWidth: "100%",
            background: "radial-gradient(ellipse 180% 200% at 90% 50%, #3d1404 0%, #1c0a03 40%, #0c0503 100%)",
            position: "relative",
            overflow: "hidden",
          }}>
            {/* Warm glow */}
            <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 70% 100% at 80% 50%, rgba(255,100,20,0.32) 0%, transparent 65%)", pointerEvents: "none" }}/>
            {/* Visit store */}
            <button onClick={() => openSpotlightStore(setPage, "gold")} style={{ position: "absolute", top: 12, right: 12, zIndex: 10, display: "flex", alignItems: "center", gap: 4, padding: "6px 12px", borderRadius: 99, background: "#fff", color: "#111", fontSize: 11, fontWeight: 700, border: "none", cursor: "pointer", boxShadow: "0 2px 8px rgba(0,0,0,0.3)", fontFamily: FONT }}>
              Visit store <ArrowRight01Icon size={11} color="#111"/>
            </button>
            <div style={{ display: "flex", alignItems: "center", padding: "16px 14px 4px 14px", position: "relative", zIndex: 2 }}>
              {/* Text */}
              <div style={{ flex: 1, minWidth: 0 }}>
                {/* Label */}
                <div style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "rgba(250,160,60,0.18)", padding: "3px 8px", borderRadius: 4, marginBottom: 8 }}>
                  <span style={{ fontSize: 9, fontWeight: 800, color: "#f4a243", letterSpacing: "0.1em", textTransform: "uppercase" }}>🔶 MERCHANT SPOTLIGHT</span>
                </div>
                {/* Name + badge */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 19, fontWeight: 800, color: "#fff" }}>Gold</span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 3, background: "#16a34a", color: "#fff", fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 99 }}>
                    <CheckmarkCircle01Icon size={9} color="#fff"/> Verified Merchant
                  </span>
                </div>
                <p style={{ fontSize: 12, color: "rgba(255,255,255,0.52)", margin: 0 }}>566+ Sales &bull; 29% Success Rate</p>
              </div>
              {/* Bag */}
              <div style={{ flexShrink: 0, marginTop: -16, marginBottom: -8 }}><MerchantBag3D size={100}/></div>
            </div>
            <Dots/>
          </div>

          {/* ══ SLIDE 2 — Featured Merchant (orange gradient, Prince) ══ */}
          <div style={{
            minWidth: "100%",
            background: "linear-gradient(105deg,#e8460f 0%,#f35b22 50%,#c43c0c 100%)",
            position: "relative",
            overflow: "hidden",
          }}>
            {/* Shine */}
            <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 80% 100% at 18% 30%, rgba(255,255,255,0.16) 0%, transparent 60%)", pointerEvents: "none" }}/>
            {/* Visit store */}
            <button onClick={() => openSpotlightStore(setPage, "prince")} style={{ position: "absolute", top: 12, right: 12, zIndex: 10, display: "flex", alignItems: "center", gap: 4, padding: "6px 12px", borderRadius: 99, background: "#fff", color: "#111", fontSize: 11, fontWeight: 700, border: "none", cursor: "pointer", boxShadow: "0 2px 8px rgba(0,0,0,0.25)", fontFamily: FONT }}>
              Visit store <ArrowRight01Icon size={11} color="#111"/>
            </button>
            <div style={{ display: "flex", alignItems: "center", padding: "16px 14px 4px 14px", position: "relative", zIndex: 2 }}>
              {/* Avatar */}
              <img src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=64&h=64&fit=crop&auto=format"
                alt="Prince" style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover", border: "2px solid rgba(255,255,255,0.5)", flexShrink: 0, marginRight: 10 }}/>
              {/* Text */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <span style={{ fontSize: 18, fontWeight: 800, color: "#fff" }}>Prince</span>
                  <CheckmarkCircle01Icon size={13} color="#fff"/>
                </div>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 3, background: "#c43c0c", color: "#fff", fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 99, border: "1px solid rgba(255,255,255,0.25)", marginBottom: 6 }}>
                  🌟 Top rated
                </span>
                <p style={{ fontSize: 12, color: "rgba(255,255,255,0.82)", margin: 0 }}>7+ Sales &bull; 0% Success Rate</p>
              </div>
              {/* Bag */}
              <div style={{ flexShrink: 0, marginTop: -16, marginBottom: -8 }}><MerchantBag3D size={100}/></div>
            </div>
            <Dots/>
          </div>

          {/* ══ SLIDE 3 — PanelSuite Ad (blue, floating app icons) ══ */}
          <div style={{
            minWidth: "100%",
            background: "linear-gradient(108deg,#1b50c8 0%,#2c66e8 55%,#1540b0 100%)",
            position: "relative",
            overflow: "hidden",
          }}>
            {/* Shine */}
            <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 70% 100% at 12% 30%, rgba(255,255,255,0.18) 0%, transparent 58%)", pointerEvents: "none" }}/>
            <div style={{ display: "flex", alignItems: "center", padding: "16px 14px 4px 14px", position: "relative", zIndex: 2, gap: 8 }}>
              {/* Text */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 800, color: "#fff", lineHeight: 1.35, marginBottom: 8 }}>
                  Get Snapchat+, Telegram Premium,<br/>X Premium instantly on PanelSuite
                </p>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                  {["100% secure", "100% instant", "100% legit"].map(f => (
                    <span key={f} style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.88)" }}>
                      <CheckmarkCircle01Icon size={10} color="#fff"/>{f}
                    </span>
                  ))}
                </div>
                <button style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "#fff", color: "#1b50c8", fontSize: 11, fontWeight: 700, padding: "6px 14px", borderRadius: 99, border: "none", cursor: "pointer", fontFamily: FONT }}>
                  Download now <ArrowRight01Icon size={11} color="#1b50c8"/>
                </button>
              </div>
              {/* App icons cluster */}
              <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 8 }}>
                {/* Left col: Telegram + Snapchat staggered */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: -4 }}>
                  {/* Telegram */}
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: "linear-gradient(135deg,#37bbfe,#007dbb)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 6px 16px rgba(0,0,0,0.4)", marginLeft: 4 }}>
                    <svg width="19" height="19" viewBox="0 0 24 24" fill="#fff"><path d="M21.9 4.3l-3.3 15.6c-.25 1.1-.9 1.37-1.83.85l-5.05-3.72-2.44 2.35c-.27.27-.5.5-1 .5l.36-5.13L18.1 6.9c.4-.36-.09-.56-.63-.2L7.16 13.4l-5-1.57c-1.08-.34-1.1-1.08.23-1.6l19.55-7.53c.9-.34 1.69.2 1.4 1.6z"/></svg>
                  </div>
                  {/* Snapchat */}
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: "#FFFC00", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 6px 16px rgba(0,0,0,0.35)", marginLeft: -4 }}>
                    <svg width="19" height="19" viewBox="0 0 24 24" fill="#111"><path d="M12 2c2.9 0 4.6 2.2 4.6 5 0 .9-.05 1.7-.05 1.7.4.2.9.15 1.4-.05.6-.25 1.15.6.6 1.1-.5.45-1.5.7-1.5 1.2 0 .9 2.4 2.3 3.3 2.6.5.15.4.8-.1.95-.7.2-1.5.2-1.7.7-.15.4.15 1 .05 1.2-.15.3-.9.15-1.7.35-.6.15-.75 1.1-1.15 1.35-.35.2-1-.15-1.85-.15-.85 0-1.5.5-2.35.5s-1.5-.5-2.35-.5c-.85 0-1.5.35-1.85.15-.4-.25-.55-1.2-1.15-1.35-.8-.2-1.55-.05-1.7-.35-.1-.2.2-.8.05-1.2-.2-.5-1-.5-1.7-.7-.5-.15-.6-.8-.1-.95.9-.3 3.3-1.7 3.3-2.6 0-.5-1-.75-1.5-1.2-.55-.5 0-1.35.6-1.1.5.2 1 .25 1.4.05 0 0-.05-.8-.05-1.7 0-2.8 1.7-5 4.6-5z"/></svg>
                  </div>
                </div>
                {/* Right col: X + PanelSuite badge */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                  {/* X */}
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: "#000", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 6px 16px rgba(0,0,0,0.5)" }}>
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="#fff"><path d="M18.9 2h3.3l-7.2 8.2L23.5 22h-6.6l-5.2-6.8L5.8 22H2.5l7.7-8.8L1.5 2h6.8l4.7 6.2L18.9 2zm-1.16 18h1.83L7.3 3.9H5.34L17.74 20z"/></svg>
                  </div>
                  {/* PanelSuite label */}
                  <div style={{ background: "rgba(0,0,0,0.45)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 6, padding: "2px 5px" }}>
                    <span style={{ fontSize: 8, fontWeight: 800, color: "#fff", letterSpacing: 0 }}>PanelSuite</span>
                  </div>
                </div>
              </div>
            </div>
            <Dots/>
          </div>

        </div>{/* end track */}
      </div>
    </div>
  );
}

// ─── DESKTOP PROMO — sliding carousel, two premium cards per view ─────────────
function PromoSpotlightCard({ onVisit }: { onVisit?: () => void }) {
  return (
    <div className="relative overflow-hidden group h-full" style={{
      borderRadius: 22, minHeight: 190,
      background: "radial-gradient(ellipse 160% 190% at 92% 45%, #3d1404 0%, #180803 42%, #050302 100%)",
      border: "1px solid rgba(255,255,255,0.07)",
      boxShadow: "0 18px 46px rgba(0,0,0,0.55)",
    }}>
      <div style={{ position:"absolute", inset:0, background:"radial-gradient(ellipse 62% 100% at 84% 50%, rgba(255,105,25,0.34) 0%, transparent 62%)", pointerEvents:"none" }}/>
      <button onClick={onVisit} style={{ position:"absolute", top:16, right:16, zIndex:10, display:"flex", alignItems:"center", gap:5, padding:"8px 15px", borderRadius:99, background:"#fff", color:"#111", fontSize:12, fontWeight:700, border:"none", cursor:"pointer", boxShadow:"0 3px 12px rgba(0,0,0,0.35)", fontFamily:FONT }}
        className="transition-transform group-hover:scale-105">
        Visit store <ArrowRight01Icon size={12} color="#111"/>
      </button>
      <div style={{ display:"flex", alignItems:"center", height:"100%", padding:"26px 24px", position:"relative", zIndex:2 }}>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:"inline-flex", alignItems:"center", gap:5, background:"rgba(250,160,60,0.16)", padding:"5px 11px", borderRadius:6, marginBottom:14 }}>
            <span style={{ fontSize:10, fontWeight:800, color:"#f4a243", letterSpacing:"0.12em" }}>🔶 MERCHANT SPOTLIGHT</span>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:9 }}>
            <span style={{ fontSize:26, fontWeight:800, color:"#fff" }}>Gold</span>
            <span style={{ display:"inline-flex", alignItems:"center", gap:4, background:"#16a34a", color:"#fff", fontSize:10, fontWeight:700, padding:"3px 9px", borderRadius:99 }}>
              <CheckmarkCircle01Icon size={11} color="#fff"/> Verified Merchant
            </span>
          </div>
          <p style={{ fontSize:13, color:"rgba(255,255,255,0.55)", margin:0 }}>566+ Sales &bull; 29% Success Rate</p>
        </div>
        <div style={{ flexShrink:0 }} className="transition-transform duration-500 group-hover:scale-105"><MerchantBag3D size={132}/></div>
      </div>
    </div>
  );
}

function PromoPrinceCard({ onVisit }: { onVisit?: () => void }) {
  return (
    <div className="relative overflow-hidden group h-full" style={{
      borderRadius: 22, minHeight: 190,
      background: "linear-gradient(105deg,#e8460f 0%,#f35b22 50%,#c43c0c 100%)",
      border: "1px solid rgba(255,255,255,0.1)",
      boxShadow: "0 18px 46px rgba(150,50,10,0.4)",
    }}>
      <div style={{ position:"absolute", inset:0, background:"radial-gradient(ellipse 80% 100% at 18% 30%, rgba(255,255,255,0.16) 0%, transparent 60%)", pointerEvents:"none" }}/>
      <button onClick={onVisit} style={{ position:"absolute", top:16, right:16, zIndex:10, display:"flex", alignItems:"center", gap:5, padding:"8px 15px", borderRadius:99, background:"#fff", color:"#111", fontSize:12, fontWeight:700, border:"none", cursor:"pointer", boxShadow:"0 3px 12px rgba(0,0,0,0.25)", fontFamily:FONT }}
        className="transition-transform group-hover:scale-105">
        Visit store <ArrowRight01Icon size={12} color="#111"/>
      </button>
      <div style={{ display:"flex", alignItems:"center", height:"100%", padding:"26px 24px", position:"relative", zIndex:2 }}>
        <img src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&h=80&fit=crop&auto=format"
          alt="Prince" style={{ width:54, height:54, borderRadius:"50%", objectFit:"cover", border:"2px solid rgba(255,255,255,0.5)", flexShrink:0, marginRight:14 }}/>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:7 }}>
            <span style={{ fontSize:24, fontWeight:800, color:"#fff" }}>Prince</span>
            <CheckmarkCircle01Icon size={16} color="#fff"/>
          </div>
          <span style={{ display:"inline-flex", alignItems:"center", gap:4, background:"#c43c0c", color:"#fff", fontSize:10, fontWeight:700, padding:"3px 9px", borderRadius:99, border:"1px solid rgba(255,255,255,0.25)", marginBottom:8 }}>
            🌟 Top rated
          </span>
          <p style={{ fontSize:13, color:"rgba(255,255,255,0.85)", margin:0 }}>7+ Sales &bull; 0% Success Rate</p>
        </div>
      </div>
    </div>
  );
}

function PromoPanelSuiteCard() {
  return (
    <div className="relative overflow-hidden group h-full" style={{
      borderRadius: 22, minHeight: 190,
      background: "linear-gradient(112deg,#1b50c8 0%,#2c66e8 52%,#1540b0 100%)",
      border: "1px solid rgba(255,255,255,0.1)",
      boxShadow: "0 18px 46px rgba(20,50,150,0.4)",
    }}>
      <div style={{ position:"absolute", inset:0, background:"radial-gradient(ellipse 66% 100% at 14% 28%, rgba(255,255,255,0.2) 0%, transparent 58%)", pointerEvents:"none" }}/>
      <div style={{ display:"flex", alignItems:"center", height:"100%", padding:"26px 24px", position:"relative", zIndex:2, gap:16 }}>
        <div style={{ flex:1, minWidth:0 }}>
          <p style={{ fontSize:17, fontWeight:800, color:"#fff", lineHeight:1.32, marginBottom:12 }}>
            Get Snapchat+, Telegram Premium &amp; X Premium instantly on PanelSuite
          </p>
          <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:15, flexWrap:"wrap" }}>
            {["100% secure","100% instant","100% legit"].map(f => (
              <span key={f} style={{ display:"inline-flex", alignItems:"center", gap:4, fontSize:11, fontWeight:600, color:"rgba(255,255,255,0.9)" }}>
                <CheckmarkCircle01Icon size={12} color="#fff"/>{f}
              </span>
            ))}
          </div>
          <button style={{ display:"inline-flex", alignItems:"center", gap:6, background:"#fff", color:"#1b50c8", fontSize:12, fontWeight:700, padding:"8px 17px", borderRadius:99, border:"none", cursor:"pointer", fontFamily:FONT }}
            className="transition-transform group-hover:scale-105">
            Download now <ArrowRight01Icon size={12} color="#1b50c8"/>
          </button>
        </div>
        <div style={{ flexShrink:0, display:"flex", alignItems:"center", gap:10 }} className="transition-transform duration-500 group-hover:scale-105">
          <div style={{ display:"flex", flexDirection:"column", gap:10, marginTop:-6 }}>
            <div style={{ marginLeft:6 }}><BrandIcon brand="telegram" size={50} radius={15}/></div>
            <div style={{ marginLeft:-6 }}><BrandIcon brand="snapchat" size={50} radius={15}/></div>
          </div>
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:8 }}>
            <BrandIcon brand="x" size={50} radius={15}/>
            <div style={{ background:"rgba(0,0,0,0.42)", border:"1px solid rgba(255,255,255,0.22)", borderRadius:7, padding:"3px 8px" }}>
              <span style={{ fontSize:9, fontWeight:800, color:"#fff" }}>PanelSuite</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PromoDesktop({ setPage }: { setPage?: (p: Page) => void }) {
  const cards = [
    <PromoSpotlightCard onVisit={() => openSpotlightStore(setPage, "gold")}/>,
    <PromoPanelSuiteCard/>,
    <PromoPrinceCard onVisit={() => openSpotlightStore(setPage, "prince")}/>,
  ];
  // Number of "pages" when sliding two cards into view at a time.
  const pages = cards.length - 1; // 0..pages-1
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setIdx(p => (p + 1) % pages), 5000);
    return () => clearInterval(t);
  }, [pages]);

  return (
    <div>
      <div style={{ overflow: "hidden" }}>
        <div style={{
          display: "flex",
          gap: 20,
          transition: "transform 0.55s cubic-bezier(0.4,0,0.2,1)",
          // each card is 50% of viewport minus half the gap; slide by one card width per page
          transform: `translateX(calc(-${idx} * (50% + 10px)))`,
          willChange: "transform",
        }}>
          {cards.map((card, i) => (
            <div key={i} style={{ flex: "0 0 calc(50% - 10px)", minWidth: 0 }}>{card}</div>
          ))}
        </div>
      </div>
      {/* Dots */}
      <div className="flex items-center justify-center gap-1.5 pt-4">
        {Array.from({ length: pages }).map((_, i) => (
          <button key={i} onClick={() => setIdx(i)}
            style={{ height: 6, width: i === idx ? 24 : 7, borderRadius: 99, background: i === idx ? P : "rgba(255,255,255,0.32)", transition: "all 0.3s", border: "none", padding: 0, cursor: "pointer" }}/>
        ))}
      </div>
    </div>
  );
}

// ─── DESKTOP FILTER SIDEBAR ────────────────────────────────────────────────────
function DesktopFilterSidebar({ priceMin, priceMax, setPriceMin, setPriceMax, brandFilters, toggleBrand, clearBrands }: {
  priceMin: number; priceMax: number; setPriceMin: (n:number)=>void; setPriceMax: (n:number)=>void;
  brandFilters: string[]; toggleBrand: (brand:string)=>void; clearBrands: ()=>void;
}) {
  const [expandedCat, setExpandedCat] = useState<string | null>(null);
  const toggleCat = (name: string) => setExpandedCat(prev => prev === name ? null : name);

  return (
    <aside className="hidden md:flex flex-col shrink-0 overflow-y-auto" style={{ width: 260, background: MBG, borderRight: `1px solid rgba(255,255,255,0.07)`, scrollbarWidth: "none" }}>
      <div className="px-4 pt-5 pb-24">
        {/* Header — same as mobile */}
        <p className="text-[16px] font-bold text-white mb-1" style={{ fontFamily: FONT }}>Filter</p>
        <p className="text-[13px] font-semibold text-white mb-3" style={{ fontFamily: FONT }}>Account Category</p>

        {/* Categories accordion — identical to mobile FilterPanel */}
        <div>
          {FILTER_CATEGORIES.map(({ name, Icon, items }) => {
            const isOpen = expandedCat === name;
            return (
              <div key={name}>
                <button
                  className="w-full flex items-center justify-between py-3 transition-opacity active:opacity-70"
                  style={{ borderBottom: isOpen ? "none" : "1px solid var(--sb-mbd)" }}
                  onClick={() => toggleCat(name)}
                >
                  <div className="flex items-center gap-2.5 text-gray-200 min-w-0">
                    <span className="shrink-0"><Icon/></span>
                    <span className="text-[13px] font-bold text-left leading-snug truncate">{name}</span>
                  </div>
                  <svg width="11" height="7" viewBox="0 0 11 7" fill="none" className="shrink-0 ml-2 transition-transform" style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}>
                    <path d="M1 1l4.5 4.5L10 1" stroke="#6b7280" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>

                {isOpen && (
                  <div className="pb-1" style={{ borderBottom: "1px solid var(--sb-mbd)" }}>
                    {items.map(item => {
                      const brand = item.brand ?? item.name.toLowerCase().replace(/[^a-z0-9]+/g, "");
                      const active = brandFilters.includes(brand);
                      return (
                        <div key={item.name} className="flex items-center gap-3 py-2.5 cursor-pointer" onClick={() => toggleBrand(brand)}>
                          <FilterCheck checked={active} onToggle={() => toggleBrand(brand)}/>
                          {item.brand ? (
                            <BrandIcon brand={item.brand} size={26} radius={7}/>
                          ) : (
                            <span className="rounded-[7px] flex items-center justify-center shrink-0 text-white font-extrabold text-[10px] uppercase leading-none"
                              style={{ width: 26, height: 26, background: item.bg }}>
                              {item.name.replace(/[^A-Za-z0-9]/g, "").slice(0, 2)}
                            </span>
                          )}
                          <span className="text-[13px] text-gray-200 font-bold">{item.name}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Price range — same as mobile */}
        <p className="text-[14px] font-bold text-white mt-6 mb-5" style={{ fontFamily: FONT }}>Price range</p>
        <PriceRangeControl min={priceMin} max={priceMax} setMin={setPriceMin} setMax={setPriceMax}/>
      </div>
    </aside>
  );
}

/* Public marketplace header (logged-out visitors) — matches the reference:
   brand on the left, a theme toggle and the menu button on the right. No cart,
   notifications, profile or support — those belong to signed-in accounts. */
function PublicMarketHeader({ setPage }: { setPage:(p:Page)=>void }) {
  const { dark, toggle } = useTheme();
  return (
    <header className="sticky top-0 z-50 flex h-[58px] items-center px-4"
      style={{ background: "var(--sb-mbg)", borderBottom: "1px solid var(--sb-mbd)", fontFamily: FONT }}>
      <button onClick={() => setPage("home")} className="flex min-w-0 flex-1 items-center gap-2 text-left">
        <Brand3D size={30}/>
        <span className="truncate text-[20px] font-medium tracking-[-0.02em]" style={{ color: "var(--sb-nav-active)" }}>SimBazaar</span>
      </button>
      <div className="ml-2 flex items-center gap-2.5">
        <button onClick={toggle} aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
          className="grid h-9 w-9 place-items-center transition active:scale-90" style={{ color: "var(--sb-nav-active)" }}>
          {dark
            ? <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5 5l1.4 1.4M17.6 17.6L19 19M19 5l-1.4 1.4M6.4 17.6L5 19"/></svg>
            : <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a7 7 0 1 0 10.5 10.5Z"/></svg>}
        </button>
        <PublicMenuButton setPage={setPage}/>
      </div>
    </header>
  );
}

/* Boxed hamburger — opens the public site drawer (reference design).
   Neutralizes AppMenuButton's default right margin so it sits centered. */
function PublicMenuButton({ setPage }: { setPage:(p:Page)=>void }) {
  return (
    <span className="grid h-9 w-9 place-items-center rounded-lg [&>button]:mr-0 [&>button]:w-auto"
      style={{ border: "1px solid var(--sb-mbd)" }}>
      <AppMenuButton setPage={setPage}/>
    </span>
  );
}

// Signed-in marketplace header. Stays stable whether or not the filter drawer is
// open — the FilterPanel is a full-screen overlay (its own header + close button +
// backdrop), so the underlying app header must NOT morph when filters open.
function MarketTopbar({ setPage }: { setPage:(p:Page)=>void }) {
  return (
    <AppMobileHeader setPage={setPage} menuSlot={<AppMenuButton setPage={setPage}/>}/>
  );
}

/* Live top merchants for the marketplace strip — TanStack Query cached (shared,
   de-duplicated, auto-revalidated); falls back to cache/demo data offline. */
function useLiveTopMerchants() {
  const { data } = useMerchantsQuery();
  const rows = useMemo(() => {
    if (!data || data.length === 0) return readCache<typeof TOP_MERCHANTS>("sb-topmerchants") ?? TOP_MERCHANTS;
    return data.map((m) => ({
      id: (m.merchant_id ?? m.id) as number | string,
      name: m.name,
      rating: Number(m.rating) || 5,
      sales: m.sales >= 1000 ? `${(m.sales / 1000).toFixed(1)}k` : String(m.sales),
      avatar: m.avatar_url || "",
      online: false,
      hot: Boolean(m.hot),
      hasStatus: Boolean(m.has_status),
      statusUnviewed: Boolean(m.status_unviewed),
    }));
  }, [data]);
  useEffect(() => { if (data && data.length > 0) writeCache("sb-topmerchants", rows); }, [data, rows]);
  return rows;
}

/* Live products from the Railway/Supabase backend, TanStack Query cached (shared
   across every marketplace view, de-duplicated, retried, auto-revalidated).
   Falls back to the session cache when the API is briefly unreachable. */
function useLiveProducts(): { products: Product[]; loaded: boolean } {
  // Always show the skeleton for a visible beat on every mount (premium feel).
  const { loaded, finishLoading } = useLoadGate(650);
  const { data, isFetched } = useProductsQuery();
  useEffect(() => { if (isFetched) finishLoading(); }, [isFetched, finishLoading]);
  const products = useMemo<Product[]>(() => {
    if (!data) return readCache<Product[]>("sb-products") ?? [];
    return data.map((r) => ({
      id: r.id,
      title: r.title,
      seller: r.seller,
      badge: r.badge === "flash" ? "flash" as const : "hand" as const,
      rating: Number(r.rating) || 3,
      available: r.available ?? 1,
      price: Number(r.price) || 0,
      category: r.category || "social",
      iconBg: "",
      iconChar: "",
      brand: (r.brand in BRAND_LOGOS ? r.brand : "vpn") as BrandKey,
      previewUrl: r.preview_url ?? undefined,
      description: r.description ?? undefined,
    }));
  }, [data]);
  useEffect(() => { if (products.length > 0) writeCache("sb-products", products); }, [products]);
  return { products, loaded };
}

// ─── MARKETPLACE SUB-VIEWS ────────────────────────────────────────────────────

// Main home view
function MarketMainView({ setView, setPage, filterOpen, setFilterOpen, activeCategory, setActiveCategory, onBuy, priceMin, priceMax, brandFilters }:
  { setView:(v:MktView)=>void; setPage:(p:Page)=>void; filterOpen:boolean; setFilterOpen:(b:boolean)=>void; activeCategory:string; setActiveCategory:(c:string)=>void; onBuy:(p:Product)=>void; priceMin:number; priceMax:number; brandFilters:string[] }) {

  const { products, loaded } = useLiveProducts();
  const topMerchants = useLiveTopMerchants();
  const [search, setSearch] = useState("");
  // Merchant status viewer (opened by tapping a ringed avatar — WhatsApp-style).
  const [statusView, setStatusView] = useState<{ items: ApiStatus[]; name: string; avatar?: string; mid?: string } | null>(null);
  // Merchants whose status the viewer has already opened this session (grey ring at once).
  const [seenStatus, setSeenStatus] = useState<Set<string>>(new Set());
  const q = search.trim().toLowerCase();
  const inPrice = products.filter(p => p.price >= priceMin && p.price <= priceMax);
  const inBrand = brandFilters.length ? inPrice.filter(p => brandFilters.includes(p.brand)) : inPrice;
  const visible = q ? inBrand.filter(p => p.title.toLowerCase().includes(q) || p.seller.toLowerCase().includes(q)) : inBrand;
  const trending = visible.slice(0, 6);
  const others = visible;

  return (
    <div className="pb-24 md:pb-8">
      {/* ── Marketplace hero header (desktop) */}
      <div className="hidden md:block px-6 pt-6 pb-4">
        <h1 className="text-[28px] font-extrabold text-white leading-tight">Marketplace</h1>
        <p className="text-[14px] mt-1" style={{ color: "#9ca3af" }}>All products on the marketplace by our verified sellers</p>
      </div>

      {/* ── Top Merchants */}
      <div className="px-4 md:px-6 pt-4 md:pt-2 pb-2">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5">
            <span style={{color:P}}>✦</span>
            <span className="text-sm font-bold text-white">Top Merchants</span>
          </div>
          <button onClick={()=>setPage("merchants")} className="flex items-center gap-1 text-xs font-semibold hover:underline" style={{color:P}}>
            View all <ArrowRight01Icon size={12}/>
          </button>
        </div>
        <div className="flex gap-5 overflow-x-auto pb-2" style={{scrollbarWidth:"none"}}>
          {topMerchants.map((m, i)=>{
            const mid = String((m as {id?:number|string}).id ?? "");
            const openStore = () => { setStoreMerchant({ id: mid, name: m.name, avatar: m.avatar || undefined, rating: String(m.rating), sales: String(m.sales) }); setPage("store"); };
            const hasStatus = Boolean((m as {hasStatus?:boolean}).hasStatus);
            // Unviewed = server says unseen AND not opened locally this session.
            const unviewed = hasStatus && Boolean((m as {statusUnviewed?:boolean}).statusUnviewed) && !seenStatus.has(mid);
            // Tapping a ringed avatar opens the STATUS (like WhatsApp); no status → the store.
            const tapAvatar = async () => {
              if (!hasStatus) { openStore(); return; }
              const items = await fetchMerchantStatus(mid);
              if (items && items.length) setStatusView({ items, name: m.name, avatar: m.avatar || undefined, mid });
              else openStore();
            };
            return (
              <div key={m.name} className="group flex flex-col items-center gap-1.5 shrink-0">
                <button onClick={tapAvatar} aria-label={hasStatus ? "View status" : "Open storefront"}
                  className="relative grid place-items-center rounded-full transition-transform active:scale-95 group-hover:-translate-y-0.5"
                  style={hasStatus ? { width:62, height:62, padding:3, background: unviewed ? "conic-gradient(from 210deg, #ffb347, #f04e23, #db2777, #f04e23, #ffb347)" : "rgba(255,255,255,0.32)" } : undefined}>
                  <span className="grid place-items-center rounded-full" style={hasStatus ? { padding:2, background:"var(--sb-mbg)" } : undefined}>
                    <img src={m.avatar} alt={m.name} className="w-14 h-14 rounded-full object-cover" style={{border:"1px solid var(--sb-bd)"}}/>
                  </span>
                </button>
                <button onClick={openStore} className="flex flex-col items-center gap-0.5">
                  <span className="text-[12px] font-bold text-white text-center max-w-[76px] truncate leading-tight">
                    {m.name}{(m as {hot?:boolean}).hot && <span className="ml-0.5">🔥</span>}
                  </span>
                  <span className="flex items-center gap-1 text-[11px] leading-none" style={{color:"var(--sb-chip-text)"}}>
                    {m.rating} <StarIcon size={11} color="#f5a623" fill="#f5a623"/> {m.sales} sales
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Search + filter (mobile only — desktop has sidebar) */}
      <div className="md:hidden px-4 py-3 flex gap-2">
        <div className="flex-1 flex items-center gap-2.5 px-4 py-3 rounded-full" style={{background:"var(--sb-chip)"}}>
          <Search01Icon size={17} color="var(--sb-chip-text)"/>
          <input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Search" className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-gray-500" style={{fontFamily:FONT}}/>
        </div>
        <button onClick={()=>setFilterOpen(true)} className="w-12 h-12 rounded-full flex items-center justify-center shrink-0" style={{background:P}}>
          <svg width="18" height="12" viewBox="0 0 18 12" fill="none"><path d="M0 1h18M3 6h12M6 11h6" stroke="#fff" strokeWidth="1.8" strokeLinecap="round"/></svg>
        </button>
      </div>

      {/* ── Desktop search bar */}
      <div className="hidden md:flex px-6 py-3 gap-3 items-center">
        <div className="flex-1 flex items-center gap-2.5 px-4 py-2.5 rounded-xl" style={{background:MCARD2, border:`1px solid ${MBD}`}}>
          <Search01Icon size={16} color="#6b7280"/>
          <input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Search products..." className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-gray-500" style={{fontFamily:FONT}}/>
        </div>
      </div>

      {/* ── Category pills — bare inline icons, no box behind them (per reference) */}
      <div className="px-4 md:px-6 pb-4 flex gap-2 overflow-x-auto" style={{scrollbarWidth:"none"}}>
        {CATEGORIES.map(cat=>(
          <button key={cat.id} onClick={()=>{setActiveCategory(cat.id);setView("listings");}}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-full text-xs font-bold whitespace-nowrap shrink-0 transition-all"
            style={activeCategory===cat.id ? {background:P,color:"#fff"} : {background:"var(--sb-chip)",color:"var(--sb-chip-text)"}}>
            <CategoryGlyph id={cat.id}/>{cat.label}
          </button>
        ))}
      </div>

      {/* ── Promo (mobile carousel / desktop two-card row) */}
      <div className="px-4 pb-4 md:hidden">
        <PromoCarousel onBuy={onBuy} setPage={setPage}/>
      </div>
      <div className="hidden md:block px-6 pb-5">
        <PromoDesktop setPage={setPage}/>
      </div>

      {/* ── Trending Now */}
      <div className="px-4 md:px-6 mb-2">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5">
            <FlameIcon size={16} color={P}/>
            <span className="text-sm font-bold text-white">Trending now</span>
          </div>
          <button onClick={()=>{setActiveCategory("trending");setView("listings");}} className="flex items-center gap-1 text-xs font-semibold" style={{color:P}}>
            View all <ArrowRight01Icon size={12}/>
          </button>
        </div>
        {/* Mobile: horizontal scroll cards */}
        <div className="md:hidden flex gap-3 overflow-x-auto pb-2" style={{scrollbarWidth:"none"}}>
          {loaded
            ? trending.map(p=><ProductCardHorizontal key={p.id} product={p} onBuy={()=>onBuy(p)}/>)
            : Array.from({length:5}).map((_,i)=><ProductCardHorizontalSkeleton key={i}/>)}
        </div>
        {/* Desktop: grid */}
        <div className="hidden md:grid gap-3" style={{gridTemplateColumns:"repeat(auto-fill, minmax(200px, 1fr))"}}>
          {loaded
            ? trending.map(p=><ProductCardHorizontal key={p.id} product={p} onBuy={()=>onBuy(p)}/>)
            : Array.from({length:6}).map((_,i)=><ProductCardHorizontalSkeleton key={i}/>)}
        </div>
      </div>

      {/* ── Other Products */}
      <div className="px-4 md:px-6 pt-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-bold text-white">Other products</span>
          <button onClick={()=>setView("listings")} className="flex items-center gap-1 text-xs font-semibold" style={{color:P}}>
            View all <ArrowRight01Icon size={12}/>
          </button>
        </div>
        {/* Mobile: vertical list */}
        <div className="md:hidden space-y-2.5">
          {loaded
            ? others.map(p=><ProductCardList key={p.id} product={p} onBuy={()=>onBuy(p)}/>)
            : Array.from({length:5}).map((_,i)=><ProductCardListSkeleton key={i}/>)}
        </div>
        {/* Desktop: two-column grid */}
        <div className="hidden md:grid gap-3" style={{gridTemplateColumns:"repeat(2, 1fr)"}}>
          {loaded
            ? others.map(p=><ProductCardList key={p.id} product={p} onBuy={()=>onBuy(p)}/>)
            : Array.from({length:6}).map((_,i)=><ProductCardListSkeleton key={i}/>)}
        </div>
      </div>
      {statusView && (
        <StatusViewer items={statusView.items} sellerName={statusView.name} avatarUrl={statusView.avatar}
          onClose={()=>{ if (statusView.mid) setSeenStatus(prev => new Set(prev).add(statusView.mid!)); setStatusView(null); }}/>
      )}
    </div>
  );
}

// Listings view
function MarketListingsView({ activeCategory, setActiveCategory, setFilterOpen, onBuy, priceMin, priceMax, brandFilters }:
  { activeCategory:string; setActiveCategory:(c:string)=>void; setFilterOpen:(b:boolean)=>void; onBuy:(p:Product)=>void; priceMin:number; priceMax:number; brandFilters:string[] }) {
  const [filterByOpen, setFilterByOpen] = useState(false);
  const [deliveryFilters, setDeliveryFilters] = useState({ instant:false, p2p:false, verified:false, business:false });
  const { products: allProducts, loaded } = useLiveProducts();
  const products = allProducts
    .filter(p => p.price >= priceMin && p.price <= priceMax)
    .filter(p => brandFilters.length === 0 || brandFilters.includes(p.brand));
  const filtered = activeCategory==="trending" ? products : products.filter(p=>p.category===activeCategory||activeCategory==="trending");
  const [lsearch, setLsearch] = useState("");
  const lq = lsearch.trim().toLowerCase();
  const base = filtered.length ? filtered : products;
  const list = lq ? base.filter(p => p.title.toLowerCase().includes(lq) || p.seller.toLowerCase().includes(lq)) : base;

  return (
    <div className="pb-24">
      {/* Search + filter button */}
      <div className="px-4 pt-4 pb-3 flex gap-2">
        <div className="flex-1 flex items-center gap-2.5 px-4 py-3 rounded-full" style={{background:"var(--sb-chip)"}}>
          <Search01Icon size={17} color="var(--sb-chip-text)"/>
          <input value={lsearch} onChange={(e)=>setLsearch(e.target.value)} placeholder="Search" className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-gray-500" style={{fontFamily:FONT}}/>
        </div>
        <button onClick={()=>setFilterOpen(true)} className="w-12 h-12 rounded-full flex items-center justify-center shrink-0" style={{background:P}}>
          <svg width="18" height="12" viewBox="0 0 18 12" fill="none"><path d="M0 1h18M3 6h12M6 11h6" stroke="#fff" strokeWidth="1.8" strokeLinecap="round"/></svg>
        </button>
      </div>

      {/* Category pills */}
      <div className="px-4 pb-3 flex gap-2 overflow-x-auto" style={{scrollbarWidth:"none"}}>
        {CATEGORIES.map(cat=>(
          <button key={cat.id} onClick={()=>setActiveCategory(cat.id)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-full text-xs font-bold whitespace-nowrap shrink-0 transition-all"
            style={activeCategory===cat.id ? {background:P,color:"#fff"} : {background:"var(--sb-chip)",color:"var(--sb-chip-text)"}}>
            <CategoryGlyph id={cat.id}/>{cat.label}
          </button>
        ))}
      </div>

      {/* Results count + Filter By */}
      <div className="px-4 pb-3 flex items-center justify-between relative">
        <span className="text-xs text-gray-400">{loaded ? `${list.length * 800} results found` : "Loading products…"}</span>
        <button onClick={()=>setFilterByOpen(!filterByOpen)}
          className="flex items-center gap-1.5 text-xs font-semibold text-gray-300 px-3 py-1.5 rounded-lg"
          style={{background:MCARD2,border:`1px solid ${MBD}`}}>
          Filter By <ArrowDown01Icon size={13} color="#9ca3af"/>
        </button>

        {/* Filter By dropdown */}
        {filterByOpen&&(
          <div className="absolute right-4 top-10 z-20 p-4 rounded-2xl shadow-2xl" style={{background:"var(--sb-card)", border:`1px solid ${MBD}`, width:230}}>
            <p className="text-xs font-bold text-white mb-3">Delivery &amp; Seller</p>
            <div className="grid grid-cols-2 gap-3">
              {(["instant","p2p","verified","business"] as const).map(key=>(
                <label key={key} className="flex items-center gap-2 cursor-pointer">
                  <div onClick={()=>setDeliveryFilters(f=>({...f,[key]:!f[key]}))}
                    className="w-4 h-4 rounded flex items-center justify-center shrink-0 transition-colors"
                    style={{border:`1.5px solid ${deliveryFilters[key]?P:"var(--sb-bd)"}`,background:deliveryFilters[key]?P:"transparent"}}>
                    {deliveryFilters[key]&&<svg width="9" height="7" viewBox="0 0 9 7" fill="none"><path d="M1 3.5l2.5 2.5L8 1" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/></svg>}
                  </div>
                  <span className="text-xs text-gray-300 capitalize">{key}</span>
                </label>
              ))}
            </div>
            <div className="mt-3 h-0.5 rounded" style={{background:P}}/>
          </div>
        )}
      </div>

      {/* Product list */}
      <div className="px-4 space-y-2.5">
        {loaded
          ? list.map(p=><ProductCardList key={p.id} product={p} onBuy={()=>onBuy(p)}/>)
          : Array.from({length:8}).map((_,i)=><ProductCardListSkeleton key={i}/>)}
      </div>
    </div>
  );
}

// Merchants view
function MarketMerchantsView({ setView, setPage }: { setView:(v:MktView)=>void; setPage:(p:Page)=>void }) {
  const [sort, setSort] = useState("all");
  const [query, setQuery] = useState("");
  // Live merchants only (each carries a real merchant UUID). No demo fallback,
  // so "View store" never opens a name-slug or the wrong storefront.
  type MktMerchant = typeof ALL_MERCHANTS[0] & { merchantId?: string };
  const [liveMerchants, setLiveMerchants] = useState<MktMerchant[]>(() => readCache<MktMerchant[]>("sb-mkt-merchants") ?? []);
  const [loaded, setLoaded] = useState<boolean>(() => readCache<MktMerchant[]>("sb-mkt-merchants") != null);
  useEffect(() => {
    let cancelled = false;
    fetchMerchants().then((api) => {
      if (cancelled) return;
      const mapped: MktMerchant[] = (api ?? []).map((m) => ({
        merchantId: m.merchant_id ?? undefined,
        name: m.name,
        rating: Number(m.rating) || 5,
        sales: m.sales,
        successRate: m.success_rate,
        avatar: m.avatar_url || "",
      }));
      writeCache("sb-mkt-merchants", mapped);
      setLiveMerchants(mapped);
      setLoaded(true);
    });
    return () => { cancelled = true; };
  }, []);
  const sortTabs = [
    { id:"all",    label:"All" },
    { id:"sales",  label:"Most sales 🔥" },
    { id:"rated",  label:"Top rated ⭐" },
    { id:"both",   label:"Most sales & Top rated 👑" },
  ];

  return (
    <div className="pb-24">
      <div className="px-4 pt-4 pb-3">
        <button onClick={()=>setView("main")} className="flex items-center gap-2 mb-4">
          <ArrowLeft01Icon size={18} color="#fff"/>
          <div>
            <p className="text-base font-bold text-white">Top Merchants</p>
            <p className="text-xs text-gray-500">Trusted merchants with proven track record and excellent service</p>
          </div>
        </button>
        {/* Search */}
        <div className="flex items-center gap-2.5 px-4 py-3 rounded-2xl mb-4" style={{background:MCARD2}}>
          <Search01Icon size={17} color="#6b7280"/>
          <input placeholder="Search merchants" value={query} onChange={e=>setQuery(e.target.value)}
            className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-gray-500" style={{fontFamily:FONT}}/>
        </div>
        {/* Sort tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1" style={{scrollbarWidth:"none"}}>
          {sortTabs.map(t=>(
            <button key={t.id} onClick={()=>setSort(t.id)}
              className="px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap shrink-0 transition-all"
              style={sort===t.id ? {background:P,color:"#fff"} : {background:MCARD2,color:"#9ca3af",border:`1px solid ${MBD}`}}>
              {t.label}
            </button>
          ))}
        </div>
      </div>
      {/* Merchant cards */}
      <div className="px-4 space-y-3">
        {!loaded && liveMerchants.length === 0 && Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-[92px] animate-pulse rounded-2xl" style={{ background: MCARD2 }}/>
        ))}
        {loaded && liveMerchants.length === 0 && (
          <p className="py-14 text-center text-sm text-gray-500">No merchants to show yet.</p>
        )}
        {liveMerchants.filter(m=>m.name.toLowerCase().includes(query.toLowerCase())).map(m=>(
          <MerchantRowCard key={m.merchantId ?? m.name} merchant={m} onViewStore={() => {
            setStoreMerchant({ id: m.merchantId, name: m.name, avatar: m.avatar, rating: String(m.rating), sales: m.sales >= 1000 ? `${(m.sales/1000).toFixed(1)}k` : String(m.sales), success: `${m.successRate}%` });
            setPage("store");
          }}/>
        ))}
      </div>
    </div>
  );
}

// ─── MARKETPLACE PAGE (wrapper) ───────────────────────────────────────────────
function MarketplacePage({ setPage }: { setPage:(p:Page)=>void }) {
  const publicVisitor = useAuthed() !== true;
  const [intent] = useState(() => consumeMarketIntent());
  const [view, setViewState] = useState<MktView>(intent?.view ?? "main");
  const [filterOpen, setFilterOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState(intent?.category ?? "trending");
  const [buyProduct, setBuyProduct] = useState<Product|null>(null);
  const [priceMin, setPriceMin] = useState(0);
  const [priceMax, setPriceMax] = useState(1000);
  // Selected service/brand filters (e.g. "facebook") — empty = show everything.
  const [brandFilters, setBrandFilters] = useState<string[]>([]);
  const toggleBrand = (brand: string) => setBrandFilters((prev) => prev.includes(brand) ? prev.filter((b) => b !== brand) : [...prev, brand]);
  const setView = (v: MktView) => {
    const pending = consumeMarketIntent();
    if (pending?.category) setActiveCategory(pending.category);
    setViewState(v);
  };
  // Keep the address bar in sync: /marketplace for the feed,
  // /products?tab=<category> for the products page (matches the reference app).
  useEffect(() => {
    try {
      const url = view === "listings" ? `/products?tab=${activeCategory}` : view === "main" ? "/marketplace" : window.location.pathname;
      if (window.location.pathname + window.location.search !== url) {
        window.history.replaceState({}, "", url);
      }
    } catch { /* ignore */ }
  }, [view, activeCategory]);

  return (
    <div className="min-h-screen flex flex-col" style={{background:MBG, fontFamily:FONT}}>
      {/* Desktop nav — shown only md+ */}
      <DesktopTopNav setPage={setPage} active="marketplace"/>

      <FilterPanel open={filterOpen} onClose={()=>setFilterOpen(false)} priceMin={priceMin} priceMax={priceMax} setPriceMin={setPriceMin} setPriceMax={setPriceMax} brandFilters={brandFilters} toggleBrand={toggleBrand} clearBrands={()=>setBrandFilters([])}/>

      {/* Mobile topbar — hidden on desktop. Public visitors get the simplified
          header (brand + theme toggle + menu); signed-in users get the full app
          header with cart, notifications and profile. */}
      <div className="md:hidden sticky top-0 z-50" style={{background:MBG}}>
        {publicVisitor
          ? <PublicMarketHeader setPage={setPage}/>
          : <MarketTopbar setPage={setPage}/>}
      </div>

      {/* Body: sidebar + main content */}
      <div className="flex flex-1 overflow-hidden">
        <DesktopFilterSidebar priceMin={priceMin} priceMax={priceMax} setPriceMin={setPriceMin} setPriceMax={setPriceMax} brandFilters={brandFilters} toggleBrand={toggleBrand} clearBrands={()=>setBrandFilters([])}/>

        {/* Scrollable main area */}
        <div className="flex-1 overflow-y-auto" style={{scrollbarWidth:"thin", scrollbarColor:`${P} transparent`}}>
          {view==="main"      && <MarketMainView setView={setView} setPage={setPage} filterOpen={filterOpen} setFilterOpen={setFilterOpen} activeCategory={activeCategory} setActiveCategory={setActiveCategory} onBuy={setBuyProduct} priceMin={priceMin} priceMax={priceMax} brandFilters={brandFilters}/>}
          {view==="listings"  && <MarketListingsView activeCategory={activeCategory} setActiveCategory={setActiveCategory} setFilterOpen={setFilterOpen} onBuy={setBuyProduct} priceMin={priceMin} priceMax={priceMax} brandFilters={brandFilters}/>}
          {view==="merchants" && <MarketMerchantsView setView={setView} setPage={setPage}/>}
        </div>
      </div>

      {/* Bottom tab bar — mobile only, and only for signed-in accounts.
          Public visitors browse the marketplace without the app tab bar. */}
      {!publicVisitor && (
        <div className="md:hidden">
          <BottomTabBar active={view === "main" ? "home" : "market"} setPage={setPage} setView={setView}/>
        </div>
      )}

      {buyProduct && <ProductPurchaseSheet product={buyProduct} setPage={setPage} onClose={()=>setBuyProduct(null)}/>}
    </div>
  );
}

// ─── HOME PAGE SECTIONS ───────────────────────────────────────────────────────
const FEATURES = [
  { id:"marketplace", Icon:Store01Icon,          eyebrow:"Marketplace", title:"Verified eSIM Marketplace",       desc:"Buy and sell eSIMs, data plans, virtual numbers, and VPN accounts from verified merchants on SimBazaar.", points:["Thousands of live listings","Every seller identity-verified","Instant digital delivery"] },
  { id:"escrow",      Icon:Shield01Icon,         eyebrow:"Protection",  title:"Secure Escrow Transactions",      desc:"Every purchase is protected by escrow. Funds are only released to the seller once you confirm the eSIM works.", points:["Funds held safely in escrow","Released only on delivery","Full dispute protection"] },
  { id:"chat",        Icon:CustomerService01Icon, eyebrow:"Messaging",   title:"Chat With Sellers Before Buying", desc:"Message sellers directly to verify plan details, ask questions, and confirm delivery before you pay.", points:["Real-time buyer–seller chat","Verify plans before paying","Order-linked conversations"] },
  { id:"reviews",     Icon:StarIcon,             eyebrow:"Reputation",  title:"Buyer Reviews & Seller Ratings",  desc:"View seller ratings, buyer reviews, and transaction history to safely buy from trusted merchants.", points:["Verified buyer reviews","Transparent seller ratings","Public transaction history"] },
];
const STEPS = [
  { num:"01", Icon:Search01Icon,  title:"Browse eSIM Marketplace",           desc:"Search and explore eSIMs, virtual numbers, VPN plans, and data bundles listed by verified sellers on SimBazaar." },
  { num:"02", Icon:Shield01Icon,  title:"Secure Payment & Escrow Protection",desc:"Buy safely using our secure checkout system. Payments are held in escrow until the eSIM is successfully delivered." },
  { num:"03", Icon:FlashIcon,     title:"Receive Your eSIM Instantly",        desc:"Get your eSIM QR code or activation details delivered instantly, or within the seller's stated delivery time." },
];

function MockupMarketplace() {
  const plans=[{flag:"🇺🇸",name:"USA 5G eSIM",by:"TrustSIM",price:"$4.00"},{flag:"🇪🇺",name:"Europe 15GB Bundle",by:"GlobalNet",price:"$8.50"},{flag:"🌏",name:"Asia 30-Day Plan",by:"AsiaSIM",price:"$6.99"}];
  return <div className="mt-7 space-y-2.5">{plans.map(({flag,name,by,price})=><div key={name} className="flex items-center gap-3 p-3 rounded-xl" style={{background:CARD2,border:`1px solid ${BD}`}}><div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0" style={{background:`${P}18`}}>{flag}</div><div className="flex-1 min-w-0"><p className="text-[13px] font-bold text-white truncate">{name}</p><p className="text-[11px] text-gray-400">By {by}</p></div><div className="flex items-center gap-2 shrink-0"><span className="text-[13px] font-bold text-white">{price}</span><span className="text-[11px] font-bold px-3 py-1 rounded-full text-white" style={{background:P}}>Buy</span></div></div>)}</div>;
}
function MockupEscrow() {
  return <div className="mt-7"><div className="relative rounded-2xl p-5" style={{background:CARD2,border:`1px solid ${BD}`}}><div className="absolute -top-3.5 right-4 w-10 h-10 rounded-full flex items-center justify-center" style={{background:P}}><Shield01Icon size={18} color="#fff"/></div><div className="flex gap-1.5 mb-4 flex-wrap">{Array.from({length:6}).map((_,i)=><div key={i} className="w-6 h-6 rounded" style={{background:"rgba(255,255,255,0.1)"}}/>)}</div><div className="space-y-2.5 mb-4"><div className="h-4 rounded-lg" style={{background:"rgba(255,255,255,0.08)",width:"100%"}}/><div className="flex gap-2"><div className="h-4 rounded-lg flex-1" style={{background:"rgba(255,255,255,0.08)"}}/><div className="h-4 rounded-lg w-20" style={{background:"rgba(255,255,255,0.08)"}}/></div></div><button className="w-full py-3 rounded-xl text-sm font-bold text-white" style={{background:P}}>Pay Securely</button></div></div>;
}
function MockupChat() {
  return <div className="mt-7 space-y-3">{[{me:false,text:"Is this eSIM compatible with iPhone 15?"},{me:true,text:"Yes! Works with all iPhone XS and later. Activates in under 60 seconds."},{me:false,text:"Does it support hotspot?"}].map(({me,text},i)=><div key={i} className={`flex items-end gap-2.5 ${me?"flex-row-reverse":""}`}><div className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center" style={{background:P}}><UserIcon size={14} color="#fff"/></div><div className="max-w-[78%] px-4 py-2.5 rounded-2xl text-xs text-white leading-relaxed" style={{background:me?P:CARD2,border:me?"none":`1px solid ${BD}`}}>{text}</div></div>)}</div>;
}
function MockupReviews() {
  return <div className="mt-7 space-y-3">{[{text:"Instant activation, great 5G coverage in Europe!"},{text:"Best eSIM deal I found. Seller replied in minutes."}].map(({text},i)=><div key={i} className="p-4 rounded-xl" style={{background:CARD2,border:`1px solid ${BD}`,marginLeft:i===1?16:0}}><div className="flex items-center gap-2.5 mb-2"><div className="w-7 h-7 rounded-full flex items-center justify-center" style={{background:P}}><UserIcon size={12} color="#fff"/></div><div className="flex gap-0.5">{Array.from({length:5}).map((_,j)=><StarIcon key={j} size={11} color="#f59e0b"/>)}</div></div><div className="space-y-1.5"><div className="h-1.5 rounded-full" style={{background:"rgba(255,255,255,0.1)",width:"80%"}}/><div className="h-1.5 rounded-full" style={{background:"rgba(255,255,255,0.06)",width:"60%"}}/></div><p className="text-[11px] text-gray-400 mt-2 leading-relaxed">{text}</p></div>)}</div>;
}
const FEATURE_MOCKUPS: Record<string,JSX.Element> = { marketplace:<MockupMarketplace/>, escrow:<MockupEscrow/>, chat:<MockupChat/>, reviews:<MockupReviews/> };

function DashboardMockup() {
  const listings=[{flag:"🇺🇸",name:"Strong USA 5G eSIM",seller:"By TrustSIM",price:"$4.00"},{flag:"🇬🇧",name:"UK Unlimited eSIM",seller:"By Empress",price:"$3.50"},{flag:"🌏",name:"1yr Global VPN Plan",seller:"By VolumeSIM",price:"$3.50"}];
  return (
    <div className="w-full rounded-2xl overflow-hidden shadow-2xl" style={{background:"#fff",border:"1px solid rgba(0,0,0,0.12)"}}>
      <div className="flex items-center gap-2 px-4 py-2.5 border-b" style={{background:"#f5f5f5",borderColor:"rgba(0,0,0,0.1)"}}>
        <div className="flex gap-1.5">{["#ff5f57","#febc2e","#28c840"].map(c=><div key={c} className="w-2.5 h-2.5 rounded-full" style={{background:c}}/>)}</div>
        <div className="flex-1 mx-3 h-5 rounded bg-white text-[9px] text-gray-400 flex items-center px-2 border" style={{borderColor:"rgba(0,0,0,0.1)"}}>simbazaar.com/marketplace</div>
        <div className="flex gap-3">{["Home","Market","Orders","Wallet"].map(l=><span key={l} className="text-[9px] text-gray-500 font-medium">{l}</span>)}<span className="text-[9px] font-bold px-2.5 py-1 rounded-full text-white" style={{background:P}}>Sell eSIM</span></div>
      </div>
      <div className="flex" style={{minHeight:210}}>
        <div className="w-32 shrink-0 p-3.5 border-r" style={{background:"#fafafa",borderColor:"rgba(0,0,0,0.07)"}}>
          <p className="text-[8px] font-extrabold text-gray-400 uppercase tracking-wider mb-2">Filter</p>
          {["eSIM Plans","Data Bundles","Virtual Numbers","VPN Access","Gift Cards","Subscriptions"].map(c=><div key={c} className="flex items-center gap-1.5 mb-1.5"><div className="w-1.5 h-1.5 rounded-full shrink-0" style={{background:P}}/><span className="text-[8px] text-gray-500 truncate">{c}</span></div>)}
        </div>
        <div className="flex-1 p-3">
          <div className="flex items-center justify-between mb-2"><p className="text-[9px] font-extrabold text-gray-700">⭐ Top Merchants</p><span className="text-[8px] font-semibold" style={{color:P}}>View all →</span></div>
          <div className="flex gap-3 mb-3 overflow-hidden">{["Abdul","Empress","King","Himark","FuzeLog"].map((n,i)=><div key={n} className="flex flex-col items-center gap-1 shrink-0"><div className="w-8 h-8 rounded-full border-2" style={{border:`2px solid ${P}`,background:`hsl(${i*60},60%,55%)`}}/><span className="text-[7px] text-gray-500 text-center leading-tight">{n}</span></div>)}</div>
          <div className="flex items-center gap-1.5 mb-2"><div className="flex-1 flex items-center gap-1 px-2 py-1 rounded-lg" style={{background:"#f1f1f1"}}><Search01Icon size={8} color="#9ca3af"/><span className="text-[8px] text-gray-400">Search eSIMs…</span></div>{["Trending","eSIMs","VPN","Numbers"].map((t,i)=><span key={t} className="text-[7px] px-2 py-0.5 rounded-full font-semibold shrink-0" style={i===0?{background:P,color:"#fff"}:{background:"#efefef",color:"#555"}}>{t}</span>)}</div>
          <div className="space-y-1.5">{listings.map(({flag,name,seller,price})=><div key={name} className="flex items-center gap-2 p-2 rounded-lg" style={{background:"#fff",border:"1px solid rgba(0,0,0,0.07)"}}><div className="w-7 h-7 rounded-lg shrink-0 flex items-center justify-center text-base" style={{background:`${P}15`}}>{flag}</div><div className="flex-1 min-w-0"><p className="text-[8px] font-bold text-gray-800 truncate">{name}</p><p className="text-[7px] text-gray-400">{seller}</p></div><span className="text-[8px] font-bold text-gray-800 shrink-0">{price}</span><button className="text-[7px] font-bold px-2 py-0.5 rounded-full text-white shrink-0" style={{background:P}}>Buy now</button></div>)}</div>
        </div>
      </div>
    </div>
  );
}

const LANDING_ANCHORS: Record<string, string> = { "Home": "top", "Features": "features", "How it Works": "how-it-works", "Why Us": "why-us" };
function goLandingSection(label: string, setPage: (p: Page) => void) {
  if (label === "Become a Merchant") { setPage("become-merchant"); return; }
  const el = document.getElementById(LANDING_ANCHORS[label] ?? "top");
  if (el) el.scrollIntoView({ behavior: "smooth" });
  else window.scrollTo({ top: 0, behavior: "smooth" });
}

/* Reveals every .sb-reveal element on scroll (fade + rise, once). */
function useScrollReveal() {
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>(".sb-reveal"));
    if (!("IntersectionObserver" in window) || !els.length) { els.forEach(e=>e.classList.add("is-in")); return; }
    const io = new IntersectionObserver((entries)=>{
      entries.forEach((e)=>{ if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); } });
    }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
    els.forEach((e)=>io.observe(e));
    return ()=>io.disconnect();
  }, []);
}

/* Centered eyebrow + title + optional sub, used across landing sections. */
function SectionHead({ eyebrow, title, sub }: { eyebrow:string; title:React.ReactNode; sub?:string }) {
  return (
    <div className="text-center max-w-2xl mx-auto mb-14 sb-reveal">
      <span className="inline-block text-[12px] font-bold uppercase tracking-[0.16em] mb-4" style={{color:P}}>{eyebrow}</span>
      <h2 className="text-[clamp(1.9rem,5vw,3rem)] font-extrabold leading-[1.08] tracking-[-0.02em] text-white" style={{fontFamily:FONT,textWrap:"balance" as any}}>{title}</h2>
      {sub && <p className="mt-5 text-[15px] sm:text-base leading-relaxed text-gray-400">{sub}</p>}
    </div>
  );
}

function Navbar({ open, setOpen, setPage }: { open:boolean; setOpen:(v:boolean)=>void; setPage:(p:Page)=>void }) {
  return (
    <header className="fixed top-0 inset-x-0 z-50" style={{background:"var(--sb-navbar-bg)",backdropFilter:"blur(18px)",WebkitBackdropFilter:"blur(18px)",borderBottom:`1px solid ${BD}`}}>
      <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between gap-4">
        <button onClick={()=>setPage("home")} className="flex items-center gap-2.5 shrink-0">
          <Brand3D size={34}/>
          <span className="text-[17px] font-extrabold text-white tracking-tight" style={{fontFamily:FONT}}>SimBazaar</span>
        </button>
        <nav className="hidden lg:flex items-center gap-1 p-1 rounded-full" style={{background:"var(--sb-nav-active-bg)",border:`1px solid ${BD}`}}>
          {NAV.map(l=><button key={l} onClick={()=>goLandingSection(l, setPage)} className="text-[13px] font-semibold text-gray-400 hover:text-white transition-colors px-4 py-1.5 rounded-full hover:bg-white/[0.06]">{l}</button>)}
        </nav>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={()=>setPage("login")} className="hidden sm:block text-sm font-semibold text-gray-300 hover:text-white transition-colors px-3.5 py-2">Login</button>
          <button onClick={()=>setPage("signup")} className="hidden sm:inline-flex items-center gap-1.5 text-sm font-bold pl-5 pr-4 py-2.5 rounded-full text-white transition-all hover:opacity-90 active:scale-[0.97]" style={{background:P}}>Get started<ArrowRight01Icon size={16} color="#fff"/></button>
          <button onClick={()=>setOpen(!open)} className="w-10 h-10 rounded-full flex items-center justify-center hover:opacity-90 transition-opacity lg:hidden" style={{background:P}}>
            {open?<Cancel01Icon size={18} color="#fff"/>:<Menu01Icon size={18} color="#fff"/>}
          </button>
        </div>
      </div>
      {open&&(
        <div className="px-5 py-5 space-y-1 border-t lg:hidden" style={{background:"var(--sb-navbar-bg)",backdropFilter:"blur(18px)",borderColor:BD}}>
          {NAV.map(l=><button key={l} onClick={()=>{setOpen(false); goLandingSection(l, setPage);}} className="block w-full text-left text-sm font-semibold text-gray-300 hover:text-white transition-colors py-2.5">{l}</button>)}
          <div className="flex gap-3 pt-3">
            <button onClick={()=>{setOpen(false);setPage("login");}} className="flex-1 py-3 rounded-full text-sm font-bold text-white border" style={{borderColor:BD,background:"transparent"}}>Login</button>
            <button onClick={()=>{setOpen(false);setPage("signup");}} className="flex-1 py-3 rounded-full text-sm font-bold text-white" style={{background:P}}>Get started</button>
          </div>
        </div>
      )}
    </header>
  );
}

function Hero({ setPage }: { setPage:(p:Page)=>void }) {
  return (
    <section className="relative pt-32 pb-24 px-5 overflow-hidden" style={{background:BG}}>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[560px]" style={{background:"radial-gradient(ellipse 70% 60% at 50% -8%, var(--sb-hero-glow) 0%, transparent 68%)"}}/>
      <div className="sb-grid-bg pointer-events-none absolute inset-x-0 top-0 h-[560px]"/>
      <div className="max-w-5xl mx-auto relative z-10">
        <div className="flex justify-center mb-7 sb-reveal">
          <span className="inline-flex items-center gap-2 pl-2 pr-4 py-1.5 rounded-full text-[13px] font-semibold text-white border" style={{background:"var(--sb-nav-active-bg)",borderColor:BD}}>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold text-white" style={{background:P}}><span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"/>Live</span>
            Trusted by 2M+ users worldwide
          </span>
        </div>
        <h1 className="text-center text-[clamp(2.4rem,7vw,4.25rem)] font-extrabold text-white leading-[1.05] tracking-[-0.03em] mb-6 max-w-4xl mx-auto sb-reveal" style={{fontFamily:FONT,textWrap:"balance" as any}}>
          The trusted marketplace for <span style={{color:P}}>eSIM &amp; connectivity</span>
        </h1>
        <p className="text-center text-base sm:text-lg text-gray-400 max-w-2xl mx-auto mb-9 leading-relaxed sb-reveal" style={{transitionDelay:"60ms"}}>Buy and sell eSIMs, data plans, virtual numbers, and VPN access through verified merchants — with secure escrow protection on every order.</p>
        <div className="flex flex-col sm:flex-row justify-center items-center gap-3 mb-10 sb-reveal" style={{transitionDelay:"120ms"}}>
          <button onClick={()=>setPage("signup")} className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-full font-bold text-base text-white hover:opacity-90 transition-all active:scale-[0.98]" style={{background:P}}>Get started free<ArrowRight01Icon size={18} color="#fff"/></button>
          <button onClick={()=>setPage("marketplace")} className="w-full sm:w-auto px-7 py-3.5 rounded-full font-bold text-base text-white transition-all hover:bg-white/[0.06] active:scale-[0.98]" style={{border:`1px solid ${BD}`,background:"var(--sb-nav-active-bg)"}}>Browse marketplace</button>
        </div>
        <div className="flex items-center justify-center gap-3 mb-16 sb-reveal" style={{transitionDelay:"160ms"}}>
          <div className="flex -space-x-2.5">{TESTIMONIALS.map((t)=><img key={t.name} src={t.img} alt="" className="w-8 h-8 rounded-full object-cover" style={{border:`2px solid ${BG}`}}/>)}</div>
          <div className="flex flex-col items-start leading-tight">
            <div className="flex gap-0.5">{Array.from({length:5}).map((_,i)=><StarIcon key={i} size={13} color="#f59e0b"/>)}</div>
            <span className="text-[12px] text-gray-400 font-medium">Rated 4.9/5 by verified buyers</span>
          </div>
        </div>
        <div className="relative sb-reveal" style={{transitionDelay:"120ms"}}>
          <div className="pointer-events-none absolute -inset-x-8 -top-6 bottom-0" style={{background:"radial-gradient(ellipse 60% 70% at 50% 0%, var(--sb-hero-glow) 0%, transparent 70%)"}}/>
          <div className="relative max-w-3xl mx-auto overflow-x-auto rounded-2xl" style={{boxShadow:"var(--sb-lshadow-lg)"}}><div style={{minWidth:480}}><DashboardMockup/></div></div>
        </div>
      </div>
    </section>
  );
}

function TrustStrip() {
  const items = ["Escrow-secured","Identity-verified sellers","Instant delivery","24/7 support","Buyer protection"];
  return (
    <section className="px-5 pb-6" style={{background:BG}}>
      <div className="max-w-5xl mx-auto sb-reveal">
        <p className="text-center text-[12px] font-semibold uppercase tracking-[0.16em] text-gray-500 mb-6">Everything you need to trade digital connectivity safely</p>
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-3">
          {items.map((t)=>(
            <span key={t} className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-[13px] font-semibold text-gray-300" style={{background:"var(--sb-lcard)",border:`1px solid ${BD}`}}>
              <CheckmarkCircle01Icon size={15} color={P}/>{t}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function Features() {
  return (
    <section className="py-24 sm:py-28 px-5" style={{background:BG}}>
      <div className="max-w-6xl mx-auto">
        <SectionHead eyebrow="Features" title="Everything you need to trade digital products securely" sub="A complete, escrow-protected marketplace built for buyers and verified sellers of eSIMs and connectivity." />
        <div className="space-y-6">
          {FEATURES.map(({id,Icon,eyebrow,title,desc,points},i)=>(
            <div key={id} className="sb-lcard sb-lift rounded-3xl overflow-hidden sb-reveal">
              <div className={`grid lg:grid-cols-2 gap-8 lg:gap-10 p-7 sm:p-10 items-center ${i%2===1?"lg:[direction:rtl]":""}`}>
                <div className="lg:[direction:ltr]">
                  <div className="inline-flex items-center gap-2.5 mb-5">
                    <span className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0" style={{background:`${P}1a`}}><Icon size={22} color={P}/></span>
                    <span className="text-[12px] font-bold uppercase tracking-[0.14em]" style={{color:P}}>{eyebrow}</span>
                  </div>
                  <h3 className="text-2xl sm:text-[1.7rem] font-bold text-white leading-tight tracking-[-0.01em] mb-3" style={{fontFamily:FONT}}>{title}</h3>
                  <p className="text-gray-400 text-[15px] leading-relaxed max-w-md mb-6">{desc}</p>
                  <ul className="space-y-2.5">
                    {points.map((pt)=>(
                      <li key={pt} className="flex items-center gap-2.5 text-[14px] font-medium text-gray-300"><CheckmarkCircle01Icon size={17} color={P}/>{pt}</li>
                    ))}
                  </ul>
                </div>
                <div className="lg:[direction:ltr] rounded-2xl p-5 sm:p-6" style={{background:BG2,border:`1px solid ${BD}`}}>
                  <div className="-mt-2">{FEATURE_MOCKUPS[id]}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section className="py-24 sm:py-28 px-5" style={{background:BG2}}>
      <div className="max-w-6xl mx-auto">
        <SectionHead eyebrow="How it works" title="Buy or sell in three simple steps" sub="From browsing verified listings to instant delivery — the whole flow is protected end to end." />
        <div className="relative grid sm:grid-cols-3 gap-6 max-w-5xl mx-auto">
          <div className="hidden sm:block absolute top-[46px] left-[16%] right-[16%] h-px" style={{background:`linear-gradient(90deg, transparent, ${BD}, transparent)`}}/>
          {STEPS.map(({num,Icon,title,desc},i)=>(
            <div key={num} className="relative sb-lcard sb-lift rounded-3xl p-7 text-center sb-reveal" style={{transitionDelay:`${i*90}ms`}}>
              <div className="relative z-10 mx-auto w-16 h-16 rounded-2xl flex items-center justify-center mb-6" style={{background:P,boxShadow:`0 12px 26px -10px ${P}`}}><Icon size={28} color="#fff"/></div>
              <span className="inline-block text-[12px] font-bold uppercase tracking-[0.16em] mb-2" style={{color:P}}>Step {num}</span>
              <h3 className="text-lg sm:text-xl font-bold text-white mb-2.5" style={{fontFamily:FONT}}>{title}</h3>
              <p className="text-gray-400 text-[14px] leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function WhyChoose() {
  const icons = [Shield01Icon, LockIcon, UserIcon];
  return (
    <section className="py-24 sm:py-28 px-5" style={{background:BG}}>
      <div className="max-w-6xl mx-auto">
        <SectionHead eyebrow="Why SimBazaar" title="Built for safe, trusted digital trade" sub="Escrow protection, verified sellers, and full transparency on every transaction." />
        <div className="grid sm:grid-cols-3 gap-5 mb-6">
          {WHY.map(({bold,body},i)=>{
            const Icon = icons[i] ?? CheckmarkCircle01Icon;
            return (
              <div key={i} className="sb-lcard sb-lift rounded-3xl p-7 sb-reveal" style={{transitionDelay:`${i*80}ms`}}>
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-5" style={{background:`${P}1a`}}><Icon size={22} color={P}/></div>
                <h3 className="text-lg font-bold text-white mb-2.5" style={{fontFamily:FONT}}>{bold.replace(/:$/,"")}</h3>
                <p className="text-gray-400 text-[14px] leading-relaxed">{body.trim()}</p>
              </div>
            );
          })}
        </div>
        <div className="sb-lcard rounded-3xl px-6 sm:px-10 py-9 sb-reveal">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-y-8">
            {STATS.map(({val,label},i)=>(
              <div key={label} className="text-center sm:text-left px-2" style={{borderLeft:i>0?`1px solid ${BD}`:"none"}}>
                <p className="text-3xl sm:text-[2.75rem] font-extrabold text-white leading-none mb-2" style={{fontFamily:FONT,fontVariantNumeric:"tabular-nums"}}>{val}</p>
                <p className="text-gray-400 text-[13px] font-medium">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Testimonials() {
  const [idx,setIdx]=useState(0);
  const t=TESTIMONIALS[idx];
  return (
    <section className="py-24 sm:py-28 px-5" style={{background:BG2}}>
      <div className="max-w-2xl mx-auto">
        <SectionHead eyebrow="Testimonials" title="Loved by travelers &amp; sellers alike" />
        <div className="sb-reveal">
          <div key={idx} className="sb-lcard rounded-3xl p-7 sm:p-10" style={{animation:"sbPageIn .45s cubic-bezier(.22,1,.36,1) both"}}>
            <div className="text-6xl leading-none font-serif mb-2 select-none" style={{color:P,opacity:0.5}}>&ldquo;</div>
            <p className="text-white text-lg sm:text-xl leading-relaxed font-medium -mt-4 mb-7" style={{fontFamily:FONT,textWrap:"balance" as any}}>{t.quote}</p>
            <div className="flex items-center gap-4">
              <img src={t.img} alt={t.name} className="w-12 h-12 rounded-full object-cover shrink-0" style={{border:`2px solid ${P}`}}/>
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-bold text-white" style={{fontFamily:FONT}}>{t.name}</p>
                <p className="text-[13px] text-gray-500">{t.role}</p>
              </div>
              <StarRow n={t.stars}/>
            </div>
          </div>
          <div className="flex items-center justify-between mt-6">
            <div className="flex gap-2">{TESTIMONIALS.map((_,i)=><button key={i} aria-label={`Testimonial ${i+1}`} onClick={()=>setIdx(i)} className="h-2 rounded-full transition-all duration-300" style={{width:i===idx?28:8,background:i===idx?P:BD}}/>)}</div>
            <div className="flex gap-3">
              {[()=>setIdx((idx-1+TESTIMONIALS.length)%TESTIMONIALS.length), ()=>setIdx((idx+1)%TESTIMONIALS.length)].map((fn,i)=>(
                <button key={i} aria-label={i===0?"Previous":"Next"} onClick={fn} className="w-11 h-11 rounded-full flex items-center justify-center transition-all hover:opacity-85 active:scale-95" style={{background:"var(--sb-lcard)",border:`1px solid ${BD}`}}>
                  {i===0?<ArrowLeft01Icon size={18} color={P}/>:<ArrowRight01Icon size={18} color={P}/>}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function SellSection({ setPage }: { setPage:(p:Page)=>void }) {
  return (
    <section className="py-24 sm:py-28 px-5 overflow-hidden" style={{background:BG2}}>
      <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
        <div className="sb-reveal">
          <span className="inline-block text-[12px] font-bold uppercase tracking-[0.16em] mb-4" style={{color:P}}>For sellers</span>
          <h2 className="text-[clamp(1.9rem,5vw,3.1rem)] font-extrabold text-white leading-[1.08] tracking-[-0.02em] mb-5" style={{fontFamily:FONT,textWrap:"balance" as any}}>Turn connectivity into income on SimBazaar</h2>
          <p className="text-gray-400 text-base sm:text-lg leading-relaxed mb-8">List and sell eSIMs, virtual numbers, VPN services, and data bundles to buyers worldwide — with fast payouts and full escrow protection.</p>
          <div className="flex flex-wrap gap-3"><OBtn onClick={()=>setPage("become-merchant")}>Start selling</OBtn><OBtn outline onClick={()=>setPage("marketplace")}>Explore marketplace</OBtn></div>
          <div className="mt-10 grid grid-cols-2 gap-3">
            {[{Icon:Store01Icon,label:"25K+ Active Listings"},{Icon:CustomerService01Icon,label:"24/7 Seller Support"},{Icon:LockIcon,label:"Escrow Protection"},{Icon:Wallet01Icon,label:"Fast Payouts"}].map(({Icon,label})=>(
              <div key={label} className="sb-lcard flex items-center gap-3 p-4 rounded-2xl">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{background:`${P}1f`}}><Icon size={17} color={P}/></div>
                <span className="text-[13px] font-semibold text-white leading-tight">{label}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex justify-center lg:justify-end sb-reveal" style={{transitionDelay:"100ms"}}>
          <div className="relative w-full max-w-sm lg:w-[360px]">
            <div className="pointer-events-none absolute -inset-6" style={{background:"radial-gradient(circle at 60% 30%, var(--sb-hero-glow) 0%, transparent 70%)"}}/>
            <div className="relative rounded-3xl overflow-hidden" style={{height:"clamp(300px,55vw,440px)",background:CARD,boxShadow:"var(--sb-lshadow-lg)",border:`1px solid ${BD}`}}>
              <img src="https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=680&h=840&fit=crop&auto=format" alt="Seller" className="w-full h-full object-cover"/>
            </div>
            <div className="absolute -bottom-5 left-6 flex items-center gap-3 px-4 py-3 rounded-2xl" style={{background:"var(--sb-navbar-bg)",border:`1px solid ${BD}`,backdropFilter:"blur(12px)",WebkitBackdropFilter:"blur(12px)",boxShadow:"var(--sb-lshadow-lg)"}}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{background:P}}><Wallet01Icon size={18} color="#fff"/></div>
              <div><p className="text-[10px] text-gray-400">Earned this month</p><p className="text-sm font-extrabold text-white" style={{fontVariantNumeric:"tabular-nums"}}>+$1,284.50</p></div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function CTABanner({ setPage }: { setPage:(p:Page)=>void }) {
  return (
    <section className="py-16 sm:py-20 px-5" style={{background:BG}}>
      <div className="max-w-6xl mx-auto sb-reveal">
        <div className="relative rounded-[2rem] overflow-hidden px-8 sm:px-16 py-16 sm:py-20 text-center" style={{background:P,boxShadow:`0 30px 70px -28px ${P}`}}>
          <svg className="pointer-events-none absolute inset-0 w-full h-full opacity-[0.18]" viewBox="0 0 900 340" preserveAspectRatio="xMidYMid slice">
            {Array.from({length:10}).map((_,i)=><path key={i} d={`M0,${60+i*25} C120,${40+i*25} 240,${80+i*25} 360,${55+i*25} S540,${35+i*25} 720,${60+i*25} S870,${45+i*25} 900,${60+i*25}`} fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="1.2"/>)}
            {Array.from({length:7}).map((_,i)=><path key={`b${i}`} d={`M0,${180+i*22} C180,${160+i*22} 360,${200+i*22} 540,${175+i*22} S720,${155+i*22} 900,${180+i*22}`} fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="0.9"/>)}
          </svg>
          <div className="relative z-10">
            <h2 className="text-[clamp(1.9rem,5vw,3rem)] font-extrabold text-white leading-[1.08] tracking-[-0.02em] mb-5 max-w-xl mx-auto" style={{fontFamily:FONT,textWrap:"balance" as any}}>Start trading verified eSIMs today</h2>
            <p className="text-white/85 text-base sm:text-lg leading-relaxed mb-10 max-w-lg mx-auto">Join millions buying and selling eSIMs, virtual numbers, VPN services, and data plans from trusted sellers — securely.</p>
            <button onClick={()=>setPage("signup")} className="inline-flex items-center gap-2 px-8 py-3 rounded-full font-semibold text-[15px] text-black bg-white border-2 border-white transition-all hover:bg-transparent hover:text-white active:scale-[0.99]">Get started free<ArrowRight01Icon size={18}/></button>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer({ setPage }: { setPage:(p:Page)=>void }) {
  return (
    <footer className="pt-16 pb-10 px-5" style={{background:BG,borderTop:`1px solid ${BD}`}}>
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-2.5 mb-4">
          <Brand3D size={36}/>
          <span className="text-lg font-extrabold text-white" style={{fontFamily:FONT}}>SimBazaar</span>
        </div>
        <p className="text-gray-400 text-sm leading-relaxed max-w-sm mb-7">SimBazaar is a global marketplace for eSIMs and digital connectivity. Trade securely with escrow protection, fast delivery, and dedicated customer support.</p>
        <div className="flex gap-3 mb-12">{["IG","X","TG","TT"].map(s=><a key={s} href="#" className="w-11 h-11 rounded-full flex items-center justify-center text-white text-[11px] font-extrabold hover:opacity-80 transition-opacity" style={{background:P}}>{s}</a>)}</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-8 mb-12">
          <div>
            <h4 className="text-white font-bold text-sm mb-5">Quick Links</h4>
            <ul className="space-y-3">{["Home","Features","How it Works","Why Us","Become a Merchant"].map(l=><li key={l}><button onClick={()=>goLandingSection(l, setPage)} className="text-gray-400 text-sm hover:text-white transition-colors">{l}</button></li>)}</ul>
          </div>
          <div>
            <h4 className="text-white font-bold text-sm mb-5">Contact Us</h4>
            <ul className="space-y-3 text-gray-400 text-sm"><li>help@simbazaar.com</li><li>Telegram: @simbazaar</li><li>WhatsApp: +1 800 SIMBAZAAR</li></ul>
          </div>
          <div>
            <h4 className="text-white font-bold text-sm mb-5">Get App</h4>
            <span className="inline-block px-5 py-2 rounded-full text-sm font-bold text-white" style={{background:P}}>Coming Soon</span>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-6" style={{borderTop:`1px solid ${BD}`}}>
          <p className="text-gray-500 text-sm">Copyright © 2025 SimBazaar. All rights reserved!</p>
          <div className="flex gap-5">
            <button onClick={()=>setPage("login")} className="text-gray-400 text-sm hover:text-white transition-colors">Login</button>
            <button onClick={()=>setPage("signup")} className="text-gray-400 text-sm hover:text-white transition-colors">Sign up</button>
            <button onClick={()=>setPage("support")} className="text-gray-400 text-sm hover:text-white transition-colors">Privacy Policy</button>
          </div>
        </div>
      </div>
    </footer>
  );
}

function HomePage({ setPage }: { setPage:(p:Page)=>void }) {
  const [menuOpen,setMenuOpen]=useState(false);
  useScrollReveal();
  return (
    <>
      <Navbar open={menuOpen} setOpen={setMenuOpen} setPage={setPage}/>
      <main>
        <div id="top"><Hero setPage={setPage}/></div>
        <TrustStrip/>
        <div id="features"><Features/></div>
        <div id="how-it-works"><HowItWorks/></div>
        <div id="why-us"><WhyChoose/></div>
        <Testimonials/>
        <SellSection setPage={setPage}/>
        <CTABanner setPage={setPage}/>
      </main>
      <Footer setPage={setPage}/>
    </>
  );
}

// ─── WALLET PAGE ──────────────────────────────────────────────────────────────

// ─── PROFILE PAGE ─────────────────────────────────────────────────────────────

// Animated bar-chart icon used in every stat card
function StatBarIcon({ colors }: { colors: [string, string, string] }) {
  return (
    <svg width="22" height="20" viewBox="0 0 22 20" fill="none">
      <rect x="0"  y="11" width="5" height="9"  rx="1.5" fill={colors[0]}/>
      <rect x="8"  y="6"  width="5" height="14" rx="1.5" fill={colors[1]}/>
      <rect x="16" y="1"  width="5" height="19" rx="1.5" fill={colors[2]}/>
    </svg>
  );
}

// Empty-state robot illustration (Ads / Reviews empty)
function EmptyRobot() {
  return (
    <svg width="110" height="110" viewBox="0 0 110 110" fill="none">
      {/* speech bubble */}
      <rect x="52" y="4" width="44" height="28" rx="8" fill="#2a2a2a"/>
      <circle cx="63" cy="18" r="3" fill="#555"/>
      <circle cx="74" cy="18" r="3" fill="#555"/>
      <circle cx="85" cy="18" r="3" fill="#555"/>
      <path d="M60 32 L55 40 L68 32Z" fill="#2a2a2a"/>
      {/* robot body */}
      <rect x="22" y="48" width="60" height="42" rx="6" fill="#2e2e2e"/>
      {/* robot head */}
      <rect x="30" y="28" width="44" height="24" rx="6" fill="#3a3a3a"/>
      {/* eyes */}
      <rect x="38" y="35" width="10" height="8" rx="3" fill="#555"/>
      <rect x="56" y="35" width="10" height="8" rx="3" fill="#555"/>
      <circle cx="43" cy="39" r="3" fill="#f04e23" opacity="0.8"/>
      <circle cx="61" cy="39" r="3" fill="#f04e23" opacity="0.8"/>
      {/* antenna */}
      <rect x="50" y="20" width="4" height="10" rx="2" fill="#3a3a3a"/>
      <circle cx="52" cy="18" r="4" fill="#3a3a3a"/>
      <circle cx="52" cy="18" r="2" fill="#f04e23" opacity="0.6"/>
      {/* buttons on body */}
      <circle cx="40" cy="65" r="4" fill="#444"/>
      <circle cx="52" cy="65" r="4" fill="#444"/>
      <circle cx="64" cy="65" r="4" fill="#444"/>
      {/* belly panel */}
      <rect x="34" y="74" width="36" height="10" rx="3" fill="#222"/>
      {/* feet */}
      <rect x="30" y="88" width="16" height="8" rx="4" fill="#2e2e2e"/>
      <rect x="58" y="88" width="16" height="8" rx="4" fill="#2e2e2e"/>
    </svg>
  );
}

function ProfilePage({ setPage }: { setPage: (p: Page) => void }) {
  const profile = useProfile();
  const [pdata, setPdata] = useState<{ reviews: ApiReview[]; ads: ApiAd[]; sold: number }>(
    () => readCache("sb-profile-data") ?? { reviews: [], ads: [], sold: 0 },
  );
  const { loaded: reviewsLoaded, finishLoading } = useLoadGate(600);
  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchReceivedReviews(), fetchAds(), fetchPurchases()]).then(([rv, ads, pur]) => {
      if (cancelled) return;
      const data = { reviews: rv ?? [], ads: ads ?? [], sold: pur?.length ?? 0 };
      writeCache("sb-profile-data", data);
      setPdata(data);
      finishLoading();
    }).catch(() => { if (!cancelled) finishLoading(); });
    return () => { cancelled = true; };
  }, []);
  const posReviews = pdata.reviews.filter(r => r.sentiment === "positive").length;
  const negReviews = pdata.reviews.length - posReviews;
  const posPct = pdata.reviews.length ? Math.round((posReviews / pdata.reviews.length) * 100) : 0;
  const negPct = pdata.reviews.length ? 100 - posPct : 0;
  const activeAds = pdata.ads.filter(a => a.status === "active").length;
  const [profileTab, setProfileTab] = useState<"ads" | "reviews">("ads");
  const [copied, setCopied] = useState(false);
  const isSeller = Boolean(profile.is_seller);

  // Seller status/stories — only sellers can post; own statuses shown behind the avatar ring.
  const [myStatus, setMyStatus] = useState<ApiStatus[]>([]);
  const [statusMenu, setStatusMenu] = useState(false);
  const [composer, setComposer] = useState(false);
  const [viewer, setViewer] = useState(false);
  const [myStories, setMyStories] = useState(false);
  // Inline bio editor (sellers).
  const [editingBio, setEditingBio] = useState(false);
  const [bioText, setBioText] = useState(profile.bio ?? "");
  const [savingBio, setSavingBio] = useState(false);
  useEffect(() => { setBioText(profile.bio ?? ""); }, [profile.bio]);
  const saveBio = async () => {
    if (savingBio) return;
    setSavingBio(true);
    const r = await updateProfile({ bio: bioText.trim() });
    setSavingBio(false);
    if (!r.ok) { toast.error(r.error ?? "Could not save bio.", { title: "Bio" }); return; }
    await refreshProfile();
    toast.success("Bio updated.", { title: "Saved" });
    setEditingBio(false);
  };
  const loadStatus = () => { if (isSeller) fetchMyStatus().then((rows) => setMyStatus(rows ?? [])); };
  useEffect(() => { loadStatus(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [isSeller]);
  // Canonical role-based profile URL so navigation + refresh stay consistent
  // (buyers: /account/profile, sellers: /seller/profile) — was always /profile.
  useEffect(() => {
    try {
      const url = isSeller ? "/seller/profile" : "/account/profile";
      if (window.location.pathname !== url) window.history.replaceState({}, "", url);
    } catch { /* ignore */ }
  }, [isSeller]);

  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarErr, setAvatarErr] = useState("");
  const pickAvatar = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/png,image/jpeg,image/webp";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) { setAvatarErr("Use a PNG, JPEG or WebP image."); return; }
      if (file.size > 2 * 1024 * 1024) { setAvatarErr("Image must be under 2 MB."); return; }
      setAvatarErr("");
      setAvatarBusy(true);
      const reader = new FileReader();
      reader.onload = async () => {
        const url = await uploadAvatar(String(reader.result));
        setAvatarBusy(false);
        if (url) { clearProfileCache(); window.location.reload(); }
        else setAvatarErr("Upload failed — please try again.");
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };
  const merchantId = profile.merchant_id ?? "49005e22-98cf-4504-86e8-91a88886646f";
  const merchantLink = `${window.location.host}/seller/${merchantId}`;
  // Premium identity URL: the profile lives at the owner's merchant link
  useEffect(() => {
    try {
      const url = `/seller/${merchantId}`;
      if (window.location.pathname !== url) window.history.replaceState({}, "", url);
    } catch { /* ignore */ }
  }, [merchantId]);
  const openOwnStore = () => {
    setStoreMerchant({ id: merchantId, name: profile.full_name, sales: String(pdata.sold), success: "100%" });
    setPage("store");
  };

  const handleCopy = () => {
    try { navigator.clipboard?.writeText(merchantLink); } catch { /* ignore */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
    toast.success("Merchant link copied to clipboard");
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--sb-mbg)", fontFamily: FONT }}>

      {/* Topbar */}
      <div className="sticky top-0 z-50" style={{ background: "var(--sb-mbg)" }}>
        <AppMobileHeader setPage={setPage} menuSlot={<AppMenuButton setPage={setPage}/>}/>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto pb-24">

        {/* ── Cover photo + avatar ── */}
        <div className="relative mb-14">
          {/* Cover banner */}
          <div className="relative overflow-hidden" style={{ height: 180, borderRadius: "0 0 0 0" }}>
            <img
              src="https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&h=360&fit=crop&auto=format"
              alt="Cover"
              className="w-full h-full object-cover"
            />
            {/* Camera edit button */}
            <button className="absolute bottom-3 right-3 w-9 h-9 rounded-full flex items-center justify-center"
              style={{ background: "rgba(0,0,0,0.55)", border: "1.5px solid rgba(255,255,255,0.2)" }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
            </button>
          </div>

          {/* Avatar — overlaps cover bottom */}
          <div className="absolute left-4" style={{ bottom: -52 }}>
            <div className="relative">
              <StatusRing active={isSeller && myStatus.length > 0} size={100} onClick={()=>{ loadStatus(); setViewer(true); }}>
                <div className="w-[100px] h-[100px] rounded-full flex items-center justify-center overflow-hidden"
                  style={{ background: "#fff", border: "4px solid var(--sb-mbg)" }}>
                  {profile.avatar_url
                    ? <img src={profile.avatar_url} alt="Profile" className="w-full h-full rounded-full object-cover"/>
                    : <CircleUserIcon size={58} color="#1f2937"/>}
                </div>
              </StatusRing>
              {/* Plus — sellers get a menu (photo / status); buyers upload a photo directly */}
              <button onClick={()=> isSeller ? setStatusMenu(v=>!v) : pickAvatar()} disabled={avatarBusy} aria-label={isSeller ? "Add photo or status" : "Upload profile photo"}
                className="absolute bottom-0.5 right-0.5 w-7 h-7 rounded-full flex items-center justify-center transition-transform active:scale-90 disabled:opacity-60 z-10"
                style={{ background: P, border: "2.5px solid var(--sb-mbg)" }}>
                {avatarBusy
                  ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.2-8.56"/></svg>
                  : <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M6 1v10M1 6h10" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
                    </svg>}
              </button>
              {/* Seller plus-menu */}
              {statusMenu && (
                <>
                  <button aria-label="Close" className="fixed inset-0 z-[70] cursor-default" onClick={()=>setStatusMenu(false)}/>
                  <div className="absolute left-0 top-[108px] z-[80] w-52 overflow-hidden rounded-2xl py-1.5 shadow-[0_16px_44px_rgba(0,0,0,.45)]" style={{ background:"var(--sb-mcard)", border:"1px solid var(--sb-mbd)", animation:"sbPageIn .18s ease both" }}>
                    <button onClick={()=>{ setStatusMenu(false); pickAvatar(); }} className="flex w-full items-center gap-3 px-4 py-3 text-left text-[13.5px] font-semibold text-white transition hover:bg-white/[0.06]">
                      <span className="grid h-8 w-8 place-items-center rounded-full" style={{ background:`${P}1f` }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={P} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="9" r="1.6"/><path d="M4 17l5-4 4 3 3-3 4 4"/></svg></span>
                      Upload profile photo
                    </button>
                    <button onClick={()=>{ setStatusMenu(false); setComposer(true); }} className="flex w-full items-center gap-3 px-4 py-3 text-left text-[13.5px] font-semibold text-white transition hover:bg-white/[0.06]">
                      <span className="grid h-8 w-8 place-items-center rounded-full" style={{ background:`${P}1f` }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={P} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" strokeDasharray="3 3"/><path d="M12 8v8M8 12h8"/></svg></span>
                      Add to story
                    </button>
                    <button onClick={()=>{ setStatusMenu(false); setMyStories(true); }} className="flex w-full items-center gap-3 px-4 py-3 text-left text-[13.5px] font-semibold text-white transition hover:bg-white/[0.06]">
                      <span className="grid h-8 w-8 place-items-center rounded-full" style={{ background:`${P}1f` }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={P} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M3 9h18M9 4v16"/></svg></span>
                      My Stories
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
          <StatusComposer open={composer} onClose={()=>setComposer(false)} onPosted={()=>{ loadStatus(); }}/>
          <MyStoriesPage open={myStories} onClose={()=>setMyStories(false)} onNew={()=>{ setMyStories(false); setComposer(true); }} sellerName={profile.full_name || "You"} avatarUrl={profile.avatar_url}/>
          {viewer && myStatus.length > 0 && (
            <StatusViewer items={myStatus} sellerName={profile.full_name || "You"} avatarUrl={profile.avatar_url} isOwner onClose={()=>setViewer(false)} onDeleted={loadStatus}/>
          )}
        </div>

        <div className="px-4">

          {avatarErr && <p className="text-[11px] font-semibold mt-1" style={{ color: "#ff5a37" }}>{avatarErr}</p>}
          {/* Name + location + joined */}
          <div className="mb-4">
            <h1 className="text-xl font-extrabold text-white mb-1">{profile.full_name}</h1>
            <div className="flex items-center gap-4">
              {(() => { const hc = countryByIso(profile.country); return hc ? (
                <span className="flex items-center gap-1.5">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={P} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 10c0 4.4-8 12-8 12s-8-7.6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>
                  </svg>
                  <span className="text-xs font-medium" style={{ color: P }}>{hc.name}</span>
                </span>
              ) : null; })()}
              <span className="flex items-center gap-1.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={P} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
                <span className="text-xs font-medium" style={{ color: P }}>Joined {profile.joined ? new Date(profile.joined).toLocaleDateString("en-GB") : "recently"}</span>
              </span>
            </div>

            {/* Bio — sellers can edit inline; everyone sees it if set */}
            {isSeller ? (
              editingBio ? (
                <div className="mt-3">
                  <textarea value={bioText} onChange={(e)=>setBioText(e.target.value.slice(0,500))} autoFocus rows={3} placeholder="Tell buyers about your store — what you sell, delivery time, trust…"
                    className="w-full resize-none rounded-xl px-3.5 py-2.5 text-[13px] leading-relaxed text-white outline-none placeholder:text-gray-500" style={{ background:"var(--sb-fill)", border:`1px solid ${MBD}` }}/>
                  <div className="mt-2 flex items-center justify-end gap-2">
                    <span className="mr-auto text-[11px]" style={{ color:"var(--sb-chip-text)" }}>{bioText.length}/500</span>
                    <button onClick={()=>{ setEditingBio(false); setBioText(profile.bio ?? ""); }} disabled={savingBio} className="rounded-full px-4 py-1.5 text-[12px] font-bold text-white" style={{ border:`1px solid ${MBD}` }}>Cancel</button>
                    <button onClick={saveBio} disabled={savingBio} className="inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[12px] font-bold text-white transition hover:opacity-90 disabled:opacity-70" style={{ background:P }}>{savingBio && <Spinner size={13}/>}Save</button>
                  </div>
                </div>
              ) : (
                <button onClick={()=>setEditingBio(true)} className="group mt-3 flex w-full items-start gap-2 rounded-xl px-3 py-2.5 text-left transition hover:bg-white/[0.03]" style={{ border:`1px dashed ${MBD}` }}>
                  <span className="flex-1 text-[13px] leading-relaxed" style={{ color: profile.bio ? "var(--sb-nav-active)" : "var(--sb-chip-text)" }}>{profile.bio || "Add a store bio — tell buyers what you sell."}</span>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={P} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0 opacity-70 transition group-hover:opacity-100"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>
                </button>
              )
            ) : profile.bio ? (
              <p className="mt-3 text-[13px] leading-relaxed" style={{ color:"var(--sb-nav-active)" }}>{profile.bio}</p>
            ) : null}
          </div>

          {/* Merchant link card */}
          <div className="flex items-center justify-between px-4 py-3.5 rounded-2xl mb-5"
            style={{ background: "var(--sb-card)", border: `1px solid rgba(240,78,35,0.35)` }}>
            <div className="flex-1 min-w-0 pr-3">
              <p className="text-[10px] font-extrabold tracking-widest mb-1" style={{ color: P }}>MERCHANT LINK</p>
              <button onClick={openOwnStore} className="block w-full text-left text-sm text-gray-300 truncate transition hover:opacity-75" title="Open your storefront">{merchantLink}</button>
            </div>
            <button onClick={handleCopy}
              className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-all active:scale-95"
              style={{ background: copied ? "#16a34a" : P }}>
              {copied
                ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                  </svg>
              }
            </button>
          </div>

          {/* ── 2 × 2 stat cards ── */}
          <div className="grid grid-cols-2 gap-3 mb-5">

            {/* Feedback */}
            <div className="p-4 rounded-2xl" style={{ background: "var(--sb-card)", border: `1px solid ${BD}` }}>
              <div className="w-11 h-11 rounded-full flex items-center justify-center mb-3"
                style={{ background: "rgba(37,99,235,0.25)" }}>
                <StatBarIcon colors={["#3b82f6","#60a5fa","#93c5fd"]}/>
              </div>
              <p className="text-xs text-gray-400 mb-2">Feedback</p>
              <p className="text-3xl font-extrabold text-white mb-0.5">{pdata.reviews.length}</p>
              <p className="text-[11px] text-gray-500 mb-2">Total Reviews</p>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/>
                    <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
                  </svg>
                  <span className="text-[11px] font-semibold text-green-400">{posPct}%</span>
                </div>
                <div className="flex items-center gap-1">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10z"/>
                    <path d="M17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/>
                  </svg>
                  <span className="text-[11px] font-semibold text-red-400">{negPct}%</span>
                </div>
              </div>
            </div>

            {/* Performance */}
            <div className="p-4 rounded-2xl" style={{ background: "var(--sb-card)", border: `1px solid ${BD}` }}>
              <div className="w-11 h-11 rounded-full flex items-center justify-center mb-3"
                style={{ background: "rgba(22,163,74,0.22)" }}>
                <StatBarIcon colors={["#4ade80","#22c55e","#16a34a"]}/>
              </div>
              <p className="text-xs text-gray-400 mb-2">Performance</p>
              <p className="text-3xl font-extrabold text-white mb-0.5">{pdata.sold}</p>
              <p className="text-[11px] text-gray-500 mb-3">Total sold</p>
              {/* thin progress bar */}
              <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
                <div className="h-full rounded-full" style={{ width: (Math.min(pdata.sold * 10, 100)) + "%", background: "#22c55e" }}/>
              </div>
            </div>

            {/* Inventory */}
            <div className="p-4 rounded-2xl" style={{ background: "var(--sb-card)", border: `1px solid ${BD}` }}>
              <div className="w-11 h-11 rounded-full flex items-center justify-center mb-3"
                style={{ background: "rgba(153,27,27,0.35)" }}>
                <StatBarIcon colors={["#f87171","#ef4444","#dc2626"]}/>
              </div>
              <p className="text-xs text-gray-400 mb-2">Inventory</p>
              <p className="text-3xl font-extrabold text-white mb-0.5">{activeAds}</p>
              <p className="text-[11px] text-gray-500">Active Ads</p>
            </div>

            {/* Reliability */}
            <div className="p-4 rounded-2xl" style={{ background: "var(--sb-card)", border: `1px solid ${BD}` }}>
              <div className="w-11 h-11 rounded-full flex items-center justify-center mb-3"
                style={{ background: "rgba(180,83,9,0.3)" }}>
                <StatBarIcon colors={["#fbbf24","#f59e0b","#d97706"]}/>
              </div>
              <p className="text-xs text-gray-400 mb-2">Reliability</p>
              <p className="text-3xl font-extrabold text-white mb-0.5">0</p>
              <p className="text-[11px] text-gray-500 mb-0.5">Cancelled Orders</p>
              <p className="text-[10px]" style={{ color: "#6b7280" }}>Lower is better for trust</p>
            </div>

          </div>

          {/* ── Ads / Reviews tabs ── */}
          <div className="rounded-2xl overflow-hidden" style={{ background: "var(--sb-card)", border: `1px solid ${BD}` }}>

            {/* Tab header */}
            <div className="flex items-center justify-between px-4 pt-4 pb-0">
              <div className="flex items-end gap-5">
                <button onClick={() => setProfileTab("ads")}
                  className="pb-3 text-sm font-bold relative transition-colors"
                  style={{ color: profileTab === "ads" ? "#fff" : "#6b7280" }}>
                  Ads
                  {profileTab === "ads" && (
                    <span className="absolute bottom-0 left-0 right-0 h-[2.5px] rounded-full" style={{ background: P }}/>
                  )}
                </button>
                <button onClick={() => setProfileTab("reviews")}
                  className="pb-3 text-sm font-bold relative transition-colors"
                  style={{ color: profileTab === "reviews" ? P : "#6b7280" }}>
                  Reviews
                  {profileTab === "reviews" && (
                    <span className="absolute bottom-0 left-0 right-0 h-[2.5px] rounded-full" style={{ background: P }}/>
                  )}
                </button>
              </div>
              {profileTab === "reviews" && (
                <button onClick={() => setProfileTab("ads")}
                  className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: P }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={P} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><polyline points="12 8 8 12 12 16"/><line x1="16" y1="12" x2="8" y2="12"/>
                  </svg>
                  Back to Ads
                </button>
              )}
            </div>

            {/* Orange full-width underline */}
            <div className="mx-4" style={{ height: 1, background: "var(--sb-mbd)" }}/>

            {/* Reviews — real reviews this seller received, with the ability to
                respond. Buyers see the response on the storefront. */}
            {profileTab === "reviews" && (
              <div className="px-4 pt-4 pb-3">
                <ReviewsList reviews={pdata.reviews} loaded={reviewsLoaded} palette={THEMED_REVIEW_PALETTE} canRespond={Boolean(profile.is_seller)}/>
              </div>
            )}

            {/* Content */}
            {profileTab === "ads" && !reviewsLoaded && (
              <div className="px-4 py-3 space-y-2.5">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-xl px-3 py-2.5" style={{ border: "1px solid " + BD }}>
                    <Skeleton className="h-9 w-9" rounded="rounded-lg"/>
                    <div className="flex-1 space-y-2"><Skeleton className="h-3 w-3/5"/><Skeleton className="h-2.5 w-1/4"/></div>
                    <Skeleton className="h-4 w-12"/>
                  </div>
                ))}
              </div>
            )}
            {profileTab === "ads" && reviewsLoaded && pdata.ads.length > 0 && (
              <div className="px-4 py-3 space-y-2.5">
                {pdata.ads.map(ad => {
                  const out = (ad.quantity ?? 0) <= 0;
                  const low = (ad.quantity ?? 0) > 0 && (ad.quantity ?? 0) <= 3;
                  const st = ad.status === "active" ? { label:"Active", color:"#4ade80", bg:"rgba(22,163,74,0.14)", dot:"#22c55e" }
                    : ad.status === "pending" ? { label:"Pending", color:"#fbbf24", bg:"rgba(245,158,11,0.14)", dot:"#f59e0b" }
                    : { label: ad.status, color:"#f87171", bg:"rgba(239,68,68,0.14)", dot:"#ef4444" };
                  return (
                    <div key={ad.id} className="flex items-center gap-3.5 rounded-2xl p-4" style={{ background:MCARD, border:`1px solid ${MBD}` }}>
                      <BrandIcon brand={(ad.brand in BRAND_LOGOS ? ad.brand : "vpn") as BrandKey} size={48}/>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-bold text-[14px] leading-snug line-clamp-1">{ad.title}</p>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1.5">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold capitalize" style={{ background:st.bg, color:st.color }}>
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background:st.dot }}/> {st.label}
                          </span>
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold"
                            style={ out ? { background:"rgba(239,68,68,0.14)", color:"#f87171" } : low ? { background:"rgba(245,158,11,0.14)", color:"#fbbf24" } : { background:"rgba(255,255,255,0.06)", color:"#9ca3af" } }>
                            {out ? "Out of stock" : `${ad.quantity} in stock`}
                          </span>
                        </div>
                      </div>
                      <span className="text-white font-extrabold text-[16px] shrink-0" style={{ fontVariantNumeric:"tabular-nums" }}>${Number(ad.price).toFixed(2)}</span>
                    </div>
                  );
                })}
              </div>
            )}
            {profileTab === "ads" && reviewsLoaded && pdata.ads.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 px-6">
                <EmptyRobot/>
                <p className="text-sm text-gray-500 mt-4 text-center">No active ads yet</p>
              </div>
            )}

          </div>

        </div>
      </div>
    </div>
  );
}

// ─── CART PAGE ────────────────────────────────────────────────────────────────

const CART_ITEMS_DATA = [
  {
    id: 1,
    seller: "Preshy girl digitals",
    sellerEmoji: "🌐",
    product: "US 🇺🇸 +1 Google Voice Account",
    description: "USA Strong And Active Google Voice Account, Highly Recommended",
    price: 5.99,
    iconBg: "#166534",
    iconColor: "#4ade80",
    brand: "vpn" as BrandKey,
    sellerAvatar: "" as string,
  },
];

// Elf character SVG (anime-style, peeking from corner)
function ElfCharacter() {
  return (
    <svg width="110" height="115" viewBox="0 0 110 115" fill="none">
      {/* Body/outfit - red */}
      <ellipse cx="68" cy="105" rx="30" ry="18" fill="#dc2626"/>
      <ellipse cx="68" cy="95" rx="22" ry="20" fill="#ef4444"/>
      {/* Collar */}
      <path d="M48 82 Q68 90 88 82" fill="#fca5a5" stroke="#fca5a5" strokeWidth="1"/>
      {/* Head */}
      <circle cx="68" cy="62" r="22" fill="#fde68a"/>
      {/* Ears */}
      <ellipse cx="46" cy="64" rx="5" ry="7" fill="#fde68a"/>
      <ellipse cx="90" cy="64" rx="5" ry="7" fill="#fde68a"/>
      {/* Hat - green pointy */}
      <path d="M52 46 Q68 4 84 46Z" fill="#16a34a"/>
      {/* Hat brim */}
      <ellipse cx="68" cy="46" rx="18" ry="4.5" fill="#15803d"/>
      {/* Hat star/crown decoration */}
      <polygon points="68,8 70,14 76,14 71,18 73,24 68,20 63,24 65,18 60,14 66,14"
        fill="#eab308"/>
      {/* Eyes - anime style (one winking) */}
      <ellipse cx="61" cy="64" rx="3.5" ry="4" fill="#1f2937"/>
      <ellipse cx="75" cy="64" rx="3.5" ry="4" fill="#1f2937"/>
      {/* Eye highlights */}
      <circle cx="62.5" cy="62.5" r="1.2" fill="white"/>
      <circle cx="76.5" cy="62.5" r="1.2" fill="white"/>
      {/* Blush marks */}
      <ellipse cx="57" cy="70" rx="5" ry="3" fill="#fca5a5" opacity="0.7"/>
      <ellipse cx="79" cy="70" rx="5" ry="3" fill="#fca5a5" opacity="0.7"/>
      {/* Smile */}
      <path d="M61 74 Q68 80 75 74" stroke="#92400e" strokeWidth="2" fill="none" strokeLinecap="round"/>
      {/* Sweat drop */}
      <path d="M87 50 Q90 44 93 50 Q93 55 90 55 Q87 55 87 50Z" fill="#93c5fd"/>
      {/* Small hands visible */}
      <circle cx="44" cy="86" r="6" fill="#fde68a"/>
      <circle cx="92" cy="86" r="6" fill="#fde68a"/>
    </svg>
  );
}

// Small round seller avatar for cart rows / modal — shows the seller's real
// profile photo, falling back to a neutral person glyph when there is none.
function CartSellerAvatar({ src, size = 19 }: { src?: string; size?: number }) {
  const [err, setErr] = useState(false);
  const show = src && !err;
  return (
    <span className="inline-flex items-center justify-center rounded-full shrink-0 overflow-hidden"
      style={{ width: size, height: size, background: "var(--sb-chip-tint)" }}>
      {show ? (
        <img src={src} alt="" className="w-full h-full object-cover" onError={() => setErr(true)}/>
      ) : (
        <svg width={Math.round(size * 0.6)} height={Math.round(size * 0.6)} viewBox="0 0 24 24" fill="none" stroke="var(--sb-nav-inactive)" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6 8-6s8 2 8 6"/>
        </svg>
      )}
    </span>
  );
}

function CartPage({ setPage }: { setPage:(p:Page)=>void }) {
  // The account's own cart — no demo fallback; an empty cart shows its own state.
  const [items, setItems] = useState<typeof CART_ITEMS_DATA>(() => readCache<typeof CART_ITEMS_DATA>("sb-cart") ?? []);
  const { loaded, finishLoading } = useLoadGate(550);
  const invalidate = useInvalidate(); // refresh cached marketplace data after a purchase
  useEffect(() => {
    let cancelled = false;
    fetchCart().then((rows) => {
      if (cancelled) return;
      if (rows) {
        const mapped = rows.map((r) => ({
          id: r.id,
          seller: r.seller,
          sellerEmoji: "🌐",
          product: r.title,
          // Ignore the old "Account N" placeholder so a real description shows;
          // fall back to a clear line when a legacy item has none.
          description: (() => {
            const d = (r.description ?? "").trim();
            return (!d || /^account\s*\d+$/i.test(d)) ? `${r.title} — full account details and access code will be available right after purchase.` : d;
          })(),
          price: Number(r.price) || 0,
          iconBg: (r.brand in BRAND_LOGOS ? BRAND_LOGOS[r.brand as BrandKey].bg : "#166534"),
          iconColor: "#ffffff",
          brand: (r.brand in BRAND_LOGOS ? r.brand : "vpn") as BrandKey,
          sellerAvatar: (r.seller_avatar ?? "") as string,
        }));
        writeCache("sb-cart", mapped);
        setItems(mapped);
      }
      finishLoading();
    }).catch(() => { if (!cancelled) finishLoading(); });
    return () => { cancelled = true; };
  }, []);
  const removeItem = (id: number) => {
    const next = items.filter(i => i.id !== id);
    setItems(next);
    writeCache("sb-cart", next);
    removeCartItem(id); // persists — the item stays gone after refresh
  };
  const [cartView, setCartView] = useState<"list"|"checkout">("list");
  const [coupon, setCoupon] = useState("");
  const [showQtyModal, setShowQtyModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<typeof CART_ITEMS_DATA[0]|null>(null);

  // Real wallet balance from the server (0 until it loads).
  const [walletBalance, setWalletBalance] = useState(0);
  useEffect(() => {
    let cancelled = false;
    fetchWalletBalance().then((r) => { if (!cancelled && r) setWalletBalance(r.balance); });
    return () => { cancelled = true; };
  }, []);
  const subtotal = items.reduce((s,i) => s + i.price, 0);
  const serviceCharge = +(subtotal * 0.10).toFixed(2);
  const total = +(subtotal + serviceCharge).toFixed(2);
  const insufficient = walletBalance < total;

  // Real-time purchase of the item shown in the Select Quantity popup. The wallet
  // is charged and the order created server-side (balance re-checked there — the
  // client never decides affordability), then the item leaves the cart and the
  // success popup (with the leave-a-review section) opens.
  const [purchasing, setPurchasing] = useState(false);
  const [successOrder, setSuccessOrder] = useState<ApiPurchase | null>(null);
  const [reviewSentiment, setReviewSentiment] = useState<"positive" | "negative" | null>(null);
  const [reviewText, setReviewText] = useState("");
  const [reviewBusy, setReviewBusy] = useState(false);
  const [reviewDone, setReviewDone] = useState(false);
  useScrollLock(showQtyModal || !!successOrder);
  const purchaseItem = async () => {
    if (!selectedItem || purchasing) return;
    if (!isAuthed()) { setPage("login"); return; }
    setPurchasing(true);
    const item = selectedItem;
    const result = await createPurchase({
      title: item.product,
      glyph: "whatsapp",
      description: item.description,
      product_type: item.brand ? item.brand.charAt(0).toUpperCase() + item.brand.slice(1) : "Account",
      seller: item.seller,
      price: item.price,
    });
    setPurchasing(false);
    if (!result.ok) {
      toast.error(result.error ?? "Payment could not be completed.", { title: result.needsFunds ? "Insufficient balance" : "Purchase failed" });
      return;
    }
    try { sessionStorage.removeItem("sb-purchases"); sessionStorage.removeItem("sb-wallet-tx"); } catch { /* ignore */ }
    removeItem(item.id);              // it's bought — take it out of the cart
    setShowQtyModal(false);
    fetchWalletBalance().then((r) => { if (r) setWalletBalance(r.balance); });
    // Stock + seller sales changed — invalidate the cached marketplace queries so
    // every open view revalidates in real time (TanStack Query refetch).
    invalidate([[...qk.products], [...qk.merchants], [...qk.wallet]]);
    // Open the success popup. Keep the order so "View order details" + the review
    // can reference it (falls back to a minimal record if the API didn't echo it).
    setReviewSentiment(null); setReviewText(""); setReviewDone(false);
    setSuccessOrder(result.order ?? {
      id: "", title: item.product, buyer: "You", glyph: "whatsapp",
      description: item.description, product_type: item.brand ? item.brand.charAt(0).toUpperCase() + item.brand.slice(1) : "Account",
      seller: item.seller, price: item.price, status: "completed", reviewed: false,
      username: null, password: null, note: null, note_time: null, created_at: new Date().toISOString(),
    });
  };

  // Open the trade chat for the just-purchased order.
  const openOrderDetails = () => {
    if (!successOrder) return;
    setCurrentOrder({
      id: successOrder.id,
      buyer: successOrder.buyer ?? "You",
      brand: (selectedItem?.brand ?? "whatsapp") as BrandKey,
      glyph: (["whatsapp","voice","facebook"].includes(String(successOrder.glyph)) ? successOrder.glyph : "whatsapp") as "whatsapp"|"voice"|"facebook",
      title: successOrder.title,
      desc: successOrder.description ?? "",
      cardSubtitle: successOrder.description ?? "",
      seller: successOrder.seller ?? "Seller",
      sellerColor: "#b91c1c",
      price: Number(successOrder.price) || 0,
      time: successOrder.note_time ?? "",
      status: (["pending","completed","cancelled"].includes(String(successOrder.status)) ? successOrder.status : "pending") as "pending"|"completed"|"cancelled",
      createdAt: successOrder.created_at,
      productType: successOrder.product_type ?? "Account",
      username: successOrder.username ?? "",
      password: successOrder.password ?? "",
      note: successOrder.note ?? "",
      noteTime: successOrder.note_time ?? "",
    });
    setSuccessOrder(null);
    setPage("order");
  };

  // Submit the buyer's review for the purchased order (seller resolved server-side).
  const sendReview = async () => {
    if (!successOrder || !reviewSentiment || reviewBusy) return;
    if (!successOrder.id) { toast.error("This order can't be reviewed here — open it from My Purchase.", { title: "Review" }); return; }
    setReviewBusy(true);
    const r = await submitReview({ order_id: successOrder.id, sentiment: reviewSentiment, feedback: reviewText.trim() });
    setReviewBusy(false);
    if (!r.ok) { toast.error(r.error ?? "Could not submit your review.", { title: "Review" }); return; }
    setReviewDone(true);
    toast.success("Thanks — your review is now on the seller's store.", { title: "Review submitted" });
  };

  // Reusable item row used in both views — mirrors the reference exactly:
  // seller (photo + name) on top, then the real brand logo beside the title,
  // one-line description, price, and the view / delete controls on the price row.
  const ItemRow = ({ item }: { item: typeof CART_ITEMS_DATA[0] }) => (
    <div className="px-4 py-3.5">
      {/* Seller — indented to align with the title column (logo 46 + gap 12) */}
      <div className="flex items-center gap-1.5 mb-1.5" style={{ marginLeft: 58 }}>
        <CartSellerAvatar src={item.sellerAvatar} size={19}/>
        <span className="text-[12.5px] truncate" style={{ color: "#9ca3af" }}>{item.seller}</span>
      </div>
      {/* Body */}
      <div className="flex gap-3">
        <BrandIcon brand={(item.brand && item.brand in BRAND_LOGOS ? item.brand : "vpn") as BrandKey} size={46}/>
        <div className="flex-1 min-w-0">
          <h3 className="text-[15px] font-bold text-white leading-tight">{item.product}</h3>
          <p className="text-[12.5px] leading-snug mt-1 line-clamp-1" style={{ color: "#9ca3af" }}>{item.description}</p>
          <div className="flex items-center justify-between mt-2">
            <b className="text-[16px] font-extrabold text-white">$ {item.price.toFixed(2)}</b>
            <div className="flex items-center gap-4 shrink-0">
              <button onClick={() => { setSelectedItem(item); setShowQtyModal(true); }} aria-label="View item"
                className="flex items-center justify-center opacity-70 hover:opacity-100 transition-opacity">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                </svg>
              </button>
              <button onClick={() => removeItem(item.id)} aria-label="Remove item"
                className="flex items-center justify-center opacity-70 hover:opacity-100 transition-opacity">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  /* Select Quantity — centered popup (matches reference). Portaled to <body> so
     `position:fixed` is never broken by an ancestor transform (page-in anim). */
  const QtyModal = (showQtyModal && selectedItem && typeof document !== "undefined") ? createPortal(
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-3"
      style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(2px)", fontFamily: FONT }}
      onClick={() => { if (!purchasing) setShowQtyModal(false); }}>
      {/* Centered pop-up — all four corners rounded, pops in (NOT a slide-up).
          Wide so it isn't cramped; overflow-hidden clips the elf INSIDE the box. */}
      <div onClick={e => e.stopPropagation()}
        className="w-full max-w-[540px] relative overflow-hidden"
        style={{
          background: "var(--sb-cart-card)",
          borderRadius: 22,
          boxShadow: "0 24px 60px rgba(0,0,0,0.45)",
          animation: "sbPopIn .2s cubic-bezier(.22,1,.36,1)",
        }}>
        <div className="px-5 pt-5 relative" style={{ paddingBottom: 26 }}>
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-[21px] font-extrabold text-white">Select Quantity</h3>
            <button onClick={() => setShowQtyModal(false)} aria-label="Close"
              className="w-8 h-8 rounded-full flex items-center justify-center transition-all hover:bg-black/5">
              <Cancel01Icon size={19} color="#9ca3af"/>
            </button>
          </div>

          {/* Product info — tiny logo in a soft round chip, full description */}
          <div className="flex items-start gap-3.5 mb-4">
            <span className="inline-flex items-center justify-center rounded-full shrink-0" style={{ width: 46, height: 46, background: "rgba(240,120,150,0.14)" }}>
              <BrandIcon brand={(selectedItem.brand && selectedItem.brand in BRAND_LOGOS ? selectedItem.brand : "vpn") as BrandKey} size={22}/>
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[16px] font-bold text-white leading-snug mb-1">{selectedItem.product}</p>
              <p className="text-[13px] leading-relaxed mb-2.5" style={{ color: "#9ca3af" }}>{selectedItem.description}</p>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] font-semibold"
                style={{ background: "var(--sb-chip)", color: "var(--sb-chip-text)" }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
                Delivery In <span className="opacity-80">(5 mins)</span>
              </span>
            </div>
          </div>

          {/* Seller */}
          <div className="flex items-center gap-2 mb-4">
            <CartSellerAvatar src={selectedItem.sellerAvatar} size={24}/>
            <span className="text-[14px] font-semibold text-white">{selectedItem.seller}</span>
          </div>

          {/* Price + cart */}
          <div className="flex items-center justify-between mb-4">
            <span className="text-[22px] font-extrabold text-white tabular-nums">$ {selectedItem.price.toFixed(2)}</span>
            <span className="w-9 h-9 flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
              </svg>
            </span>
          </div>

          {/* Purchase button (dry / slim) — real-time purchase */}
          <button onClick={purchaseItem} disabled={purchasing}
            className="w-full py-2.5 rounded-[6px] font-bold text-[13.5px] text-white transition-all hover:opacity-95 active:scale-[0.99] disabled:opacity-70 flex items-center justify-center gap-2"
            style={{ background: "#22a44b" }}>
            {purchasing && <Spinner size={15}/>}
            {purchasing ? "Processing…" : "Purchase"}
          </button>
        </div>
        {/* 3D elf illustration — sits in the box's bottom-right corner, overlapping
            the Purchase button's right end (clipped inside by the card overflow). */}
        <div className="absolute bottom-0 right-1.5 pointer-events-none select-none" style={{ transform: "scale(0.62)", transformOrigin: "bottom right" }}>
          <ElfCharacter/>
        </div>
      </div>
    </div>,
    document.body
  ) : null;

  /* Purchase-success popup — celebration mark, order link, leave-a-review. */
  const SuccessModal = (successOrder && typeof document !== "undefined") ? createPortal(
    <div className="fixed inset-0 z-[95] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(2px)", fontFamily: FONT }}
      onClick={() => setSuccessOrder(null)}>
      <div onClick={e => e.stopPropagation()} className="w-full max-w-[440px] relative"
        style={{ background: "var(--sb-cart-card)", borderRadius: 20, boxShadow: "0 24px 60px rgba(0,0,0,0.45)", animation: "sbPopIn .22s cubic-bezier(.22,1,.36,1)" }}>
        <button onClick={() => setSuccessOrder(null)} aria-label="Close"
          className="absolute right-4 top-4 w-8 h-8 rounded-full flex items-center justify-center transition hover:bg-black/5">
          <Cancel01Icon size={19} color="#9ca3af"/>
        </button>
        <div className="px-6 pt-8 pb-6 flex flex-col items-center text-center">
          {/* Celebration mark on a soft pink disc */}
          <span className="grid place-items-center rounded-full mb-4" style={{ width: 116, height: 116, background: "rgba(240,120,150,0.10)" }}>
            <CelebrationIcon size={82}/>
          </span>
          <h3 className="text-[22px] font-extrabold text-white">Purchase successful</h3>
          <p className="mt-1 text-[15px]" style={{ color: "#9ca3af" }}>Successfully purchased 1 account</p>
          <button onClick={openOrderDetails} className="mt-4 text-[15px] font-bold underline underline-offset-2 transition hover:opacity-80" style={{ color: P }}>
            View order details
          </button>
        </div>

        {/* Leave a review */}
        <div className="px-6 pb-7">
          <p className="text-[14px] font-bold text-white mb-3">Leave a review</p>
          {reviewDone ? (
            <div className="flex items-center gap-2 rounded-xl px-4 py-3 text-[13.5px] font-semibold" style={{ background: "rgba(22,163,74,0.12)", color: "#16a34a" }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
              Review submitted — it&apos;s now on {successOrder.seller ?? "the seller"}&apos;s store.
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <button onClick={() => setReviewSentiment("positive")}
                  className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[14px] font-bold transition active:scale-95"
                  style={reviewSentiment === "positive"
                    ? { background: "#16a34a", color: "#fff", border: "1.5px solid #16a34a" }
                    : { background: "transparent", color: "#16a34a", border: "1.5px solid rgba(22,163,74,0.5)" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 10v11M2 12v7a2 2 0 0 0 2 2h13.5a2 2 0 0 0 2-1.7l1.3-8A2 2 0 0 0 18 9h-5V4a2 2 0 0 0-2-2l-4 8"/></svg>
                  Positive
                </button>
                <button onClick={() => setReviewSentiment("negative")}
                  className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[14px] font-bold transition active:scale-95"
                  style={reviewSentiment === "negative"
                    ? { background: "#e02d2d", color: "#fff", border: "1.5px solid #e02d2d" }
                    : { background: "transparent", color: "#e02d2d", border: "1.5px solid rgba(224,45,45,0.5)" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 14V3M22 12V5a2 2 0 0 0-2-2H6.5a2 2 0 0 0-2 1.7l-1.3 8A2 2 0 0 0 6 15h5v5a2 2 0 0 0 2 2l4-8"/></svg>
                  Negative
                </button>
              </div>
              {reviewSentiment && (
                <div className="mt-3" style={{ animation: "sbPageIn .18s ease both" }}>
                  <textarea value={reviewText} onChange={e => setReviewText(e.target.value.slice(0, 500))} rows={3}
                    placeholder={reviewSentiment === "positive" ? "What did you like about this order?" : "Tell the seller what went wrong…"}
                    className="w-full resize-none rounded-xl px-3.5 py-3 text-[13.5px] text-white outline-none placeholder:text-gray-500"
                    style={{ background: "var(--sb-fill)", border: "1px solid var(--sb-mbd)" }}/>
                  <button onClick={sendReview} disabled={reviewBusy}
                    className="w-full mt-3 py-3 rounded-[8px] text-[14px] font-bold text-white transition active:scale-[0.99] hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2"
                    style={{ background: P }}>
                    {reviewBusy && <Spinner size={15}/>}
                    {reviewBusy ? "Submitting…" : "Submit review"}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  ) : null;

  /* ══════════════ EMPTY STATE ══════════════ */
  if (!loaded && items.length === 0) return (
    <div className="min-h-screen flex flex-col" style={{ background: MBG, fontFamily: FONT }}>
      <div className="sticky top-0 z-50" style={{ background: MBG }}>
        <AppMobileHeader setPage={setPage} cartCount={0} menuSlot={<AppMenuButton setPage={setPage}/>}/>
      </div>
      <div className="flex-1 px-5 pt-6 pb-28 space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-2xl p-4" style={{ background: "var(--sb-mcard)", border: "1px solid var(--sb-mbd)" }}>
            <Skeleton className="h-12 w-12" rounded="rounded-xl"/>
            <div className="flex-1 space-y-2"><Skeleton className="h-3.5 w-3/5"/><Skeleton className="h-3 w-2/5"/></div>
            <Skeleton className="h-5 w-14"/>
          </div>
        ))}
      </div>
    </div>
  );
  // Empty cart — still render the modals so the purchase-success popup shows even
  // when buying the last item empties the cart (otherwise this branch preempts it).
  if (items.length === 0) return (
    <>
    <div className="min-h-screen flex flex-col" style={{ background: MBG, fontFamily: FONT }}>
      <div className="sticky top-0 z-50" style={{ background: MBG }}>
        <AppMobileHeader setPage={setPage} cartCount={0} menuSlot={<AppMenuButton setPage={setPage}/>}/>
      </div>
      <div className="flex-1 px-5 pt-6 pb-28">
        <h1 className="text-[22px] font-extrabold text-white mb-10">Shopping cart</h1>
        <div className="flex flex-col items-center pt-10 gap-5">
          <div className="w-[100px] h-[100px] rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.09)" }}>
            <svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
            </svg>
          </div>
          <p className="text-[13px]" style={{ color: "#9ca3af" }}>Shopping cart is empty</p>
        </div>
      </div>
    </div>
    {QtyModal}
    {SuccessModal}
    </>
  );

  /* ══════════════ LIST VIEW (1266 reference) ══════════════ */
  if (cartView === "list") return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--sb-mbg)", fontFamily: FONT }}>
      {/* Standard topbar */}
      <div className="sticky top-0 z-50" style={{ background: "var(--sb-mbg)" }}>
        <AppMobileHeader setPage={setPage} menuSlot={<AppMenuButton setPage={setPage}/>}/>
        {/* Sub-header: ← + centered title */}
        <div className="flex items-center px-4 relative" style={{ height: 52, background: "var(--sb-mbg)" }}>
          <button onClick={() => setPage("marketplace")}
            className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 z-10"
            style={{ border: "1.5px solid var(--sb-bd)", background: "var(--sb-mbg)" }}>
            <ArrowLeft01Icon size={16} color="var(--sb-nav-active)"/>
          </button>
          <span className="absolute inset-x-0 text-center text-[16px] font-bold text-white pointer-events-none">Shopping cart</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-8">
        {/* Items — flat on the pure background, separated by hairline dividers */}
        {items.map((item, idx) => (
          <div key={item.id}>
            <ItemRow item={item}/>
            {idx < items.length - 1 && <div className="mx-4" style={{ height: 1, background: "var(--sb-mbd)" }}/>}
          </div>
        ))}

        {/* Summary — flat, right-aligned rows with a divider above */}
        <div className="mx-4 mt-1 mb-4" style={{ height: 1, background: "var(--sb-mbd)" }}/>
        <div className="px-4">
          <div className="flex flex-col items-end gap-2">
            <p className="text-[15px] font-bold text-white">Summary</p>
            <div className="flex items-center gap-6">
              <span className="text-[13.5px]" style={{ color: "#9ca3af" }}>Subtotal:</span>
              <span className="text-[14px] font-bold text-white tabular-nums">$ {subtotal.toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-6">
              <span className="text-[13.5px]" style={{ color: "#9ca3af" }}>Service charge (10%):</span>
              <span className="text-[14px] font-bold text-white tabular-nums">$ {serviceCharge.toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-6 pt-0.5">
              <span className="text-[15px] font-bold text-white">Total:</span>
              <span className="text-[16px] font-extrabold text-white tabular-nums">$ {total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Checkout button — slim, flat, rectangular */}
        <div className="px-4 mt-6">
          <button onClick={() => setCartView("checkout")}
            className="w-full py-3 rounded-[6px] font-bold text-[14px] text-white transition-all hover:opacity-95 active:scale-[0.99]"
            style={{ background: P }}>
            Checkout ( {items.length} )
          </button>
        </div>
      </div>
      {QtyModal}
      {SuccessModal}
    </div>
  );

  /* ══════════════ CHECKOUT VIEW (1268 reference) ══════════════ */
  return (
    <div className="min-h-screen flex flex-col" style={{ background: MBG, fontFamily: FONT }}>
      {/* Standard topbar */}
      <div className="sticky top-0 z-50" style={{ background: MBG }}>
        <AppMobileHeader setPage={setPage} menuSlot={<AppMenuButton setPage={setPage}/>}/>
      </div>

      <div className="flex-1 overflow-y-auto pb-28">
        <div className="pt-5">
          <h1 className="text-[22px] font-extrabold text-white mb-4 px-4">Shopping cart</h1>

          {/* Items — flat on the pure background, separated by hairline dividers */}
          {items.map((item, idx) => (
            <div key={item.id}>
              <ItemRow item={item}/>
              {idx < items.length - 1 && <div className="mx-4" style={{ height: 1, background: "var(--sb-mbd)" }}/>}
            </div>
          ))}
          {/* Subtle bottom line below items */}
          <div className="mx-4 mt-1 mb-6" style={{ height: 1, background: "var(--sb-mbd)" }}/>

          <div className="px-4">
          {/* Order Summary section */}
          <h2 className="text-[20px] font-extrabold text-white mb-5">Order Summary</h2>

          <div className="mb-6">
            <p className="text-[14px] font-semibold text-white mb-3">Summary</p>

            {/* Coupon row */}
            <div className="flex gap-2 mb-5">
              <input
                value={coupon} onChange={e => setCoupon(e.target.value)}
                placeholder="Enter coupon code"
                className="flex-1 px-4 py-3 rounded-xl text-[13px] outline-none placeholder:text-gray-400 text-gray-700"
                style={{ background: "#f3f4f6", fontFamily: FONT }}
              />
              <button className="px-5 py-3 rounded-xl text-[13px] font-bold text-white shrink-0 transition-all hover:opacity-90 active:scale-[0.97]"
                style={{ background: "#7c2d12", borderRadius: 12 }}>
                Apply
              </button>
            </div>

            {/* Breakdown */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[13px]" style={{ color: "#9ca3af" }}>Subtotal:</span>
                <span className="text-[13px] font-semibold text-white">$ {subtotal.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[13px]" style={{ color: "#9ca3af" }}>Service charge (10%):</span>
                <span className="text-[13px] font-semibold text-white">$ {serviceCharge.toFixed(2)}</span>
              </div>
            </div>
            <div className="my-4" style={{ height: 1, background: MBD }}/>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[15px] font-extrabold text-white">Total:</span>
              <span className="text-[15px] font-extrabold text-white">$ {total.toFixed(2)}</span>
            </div>
            <div className="my-4" style={{ height: 1, background: MBD }}/>

            {/* Payment method */}
            <div className="flex items-center justify-between mb-5">
              <span className="text-[14px] font-bold text-white">Payment Method:</span>
              <div className="flex items-center gap-1.5">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="5" width="20" height="14" rx="2.5"/><path d="M2 10h20"/>
                </svg>
                <span className="text-[14px] font-bold text-white">My Wallet</span>
              </div>
            </div>

            {/* Pay button — slim, flat, rectangular */}
            <button
              onClick={() => { setSelectedItem(items[0]); setShowQtyModal(true); }}
              className="w-full py-3 rounded-[6px] font-bold text-[14px] text-white transition-all hover:opacity-90 active:scale-[0.99] mb-3"
              style={{ background: insufficient ? "#7c2d12" : P }}>
              Pay {total.toFixed(2)}
            </button>

            {/* Insufficient wallet notice */}
            {insufficient && (
              <p className="text-[12px] leading-relaxed" style={{ color: P }}>
                Your wallet have not enough money for pay.{" "}
                <button onClick={() => setPage("wallet")} className="underline font-semibold" style={{ color: P }}>
                  Fund wallet
                </button>
              </p>
            )}
          </div>
          </div>
        </div>
      </div>

      {QtyModal}
      {SuccessModal}
    </div>
  );
}

// ─── NOTIFICATIONS PAGE ────────────────────────────────────────────────────────

const NOTIF_DATA = [
  { id:1, type:"order", title:"Order Completed", body:`You order for "Strong USA 🇺🇸 WhatsApp " is Completed` },
  { id:2, type:"order", title:"Order Completed", body:`You order for 🇺🇸 Very Strong 💪 Gmail Google voice account ( USA 🇺🇸 texting 💬 , verification and calling 🌙 number) 100% strong 💯 is Completed` },
  { id:3, type:"order", title:"Order Completed", body:`You order for ✅ Strong Foreign Facebook Account + Marketplace " is Completed` },
  { id:4, type:"deposit", title:"Deposit", body:"You deposited 20 into your account" },
];

function NotificationsPage({ setPage }: { setPage:(p:Page)=>void }) {
  const BG_NOTIF = "var(--sb-mbg)";
  // The account's own notifications — cached + de-duplicated via TanStack Query.
  const { loaded, finishLoading } = useLoadGate(550);
  const { data, isFetched } = useNotificationsQuery();
  useEffect(() => { if (isFetched) finishLoading(); }, [isFetched, finishLoading]);
  const notifs = useMemo<typeof NOTIF_DATA>(() => {
    if (!data) return readCache<typeof NOTIF_DATA>("sb-notifs") ?? [];
    return data.map((r) => ({ id: r.id, type: r.kind, title: r.title, body: r.body ?? "" }));
  }, [data]);
  useEffect(() => { if (notifs.length > 0) writeCache("sb-notifs", notifs); }, [notifs]);
  return (
    <div className="min-h-screen flex flex-col" style={{ background: BG_NOTIF, fontFamily: FONT }}>
      {/* Header — back button only, no title */}
      <div className="sticky top-0 z-50 px-4 flex items-center" style={{ height: 56, background: BG_NOTIF }}>
        <button onClick={() => setPage("marketplace")}
          className="w-9 h-9 rounded-full flex items-center justify-center transition-all hover:bg-white/5 active:scale-95"
          style={{ border: "1.5px solid rgba(255,255,255,0.18)" }}>
          <ArrowLeft01Icon size={16} color="var(--sb-nav-active)"/>
        </button>
      </div>

      <div className="flex-1 px-5 pt-3 pb-12">
        {!loaded && (
          <div className="space-y-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-start gap-4 py-5">
                <Skeleton className="h-4 w-4 mt-1 shrink-0" rounded="rounded-full"/>
                <div className="flex-1 space-y-2"><Skeleton className="h-3.5 w-1/2"/><Skeleton className="h-3 w-4/5"/></div>
              </div>
            ))}
          </div>
        )}
        {loaded && notifs.length === 0 && (
          <div className="flex flex-col items-center justify-center px-6 py-24 text-center">
            <span className="grid h-14 w-14 place-items-center rounded-full mb-4" style={{ background: "var(--sb-card)" }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--sb-chip-text)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>
            </span>
            <p className="text-white font-bold text-[15px]">No notifications yet</p>
            <p className="text-[13px] mt-1 max-w-[260px]" style={{ color: "var(--sb-chip-text)" }}>Updates about your orders, wallet and account will appear here.</p>
          </div>
        )}
        {/* Timeline list */}
        <div className="relative">
          {/* Vertical connecting line */}
          {notifs.length > 0 && <div className="absolute left-[8px] top-[18px]" style={{
            width: 2, bottom: 0, background: "rgba(255,255,255,0.1)", borderRadius: 1
          }}/>}

          {notifs.map((n, idx) => (
            <div key={n.id} className="relative">
              <div className="flex items-start gap-4 py-5">
                {/* Orange dot */}
                <div className="shrink-0 mt-1" style={{ position: "relative", zIndex: 1 }}>
                  <div className="w-[18px] h-[18px] rounded-full flex items-center justify-center"
                    style={{ background: P, boxShadow: `0 0 0 3px rgba(240,78,35,0.18)` }}>
                    <div className="w-[8px] h-[8px] rounded-full bg-white opacity-60"/>
                  </div>
                </div>
                {/* Content */}
                <div className="flex-1 min-w-0 pr-2">
                  <p className="text-[14px] font-extrabold text-white mb-1.5">{n.title}</p>
                  <p className="text-[13px] leading-relaxed mb-2.5" style={{ color: "#9ca3af" }}>{n.body}</p>
                  <button className="text-[13px] font-bold underline underline-offset-2 transition-opacity hover:opacity-80" style={{ color: P }}>
                    View
                  </button>
                </div>
              </div>
              {/* Horizontal divider (between items, not after last) */}
              {idx < notifs.length - 1 && (
                <div className="ml-[34px]" style={{ height: 1, background: "var(--sb-mbd)" }}/>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════
// BECOME A MERCHANT — onboarding flow (Make Payment → Add account → Credentials → Review)
// ═══════════════════════════════════════════════════════════════════════════════

type MCred = { previewLink:string; login:string; password:string; email:string; emailPass:string; notes:string };

const MERCHANT_FEE_USD = 49.99;
const NGN_RATE = 1588.0; // display-only conversion
const MERCHANT_FEE_NGN = MERCHANT_FEE_USD * NGN_RATE;

// Maps a marketplace category id → the matching filter-category name (for platform sub-selection)
const CATEGORY_TO_FILTER: Record<string,string> = {
  social:        "Social Media",
  numbers:       "Emails & Messaging Service",
  giftcards:     "Giftcards",
  vpn:           "VPN & PROXYs",
  gaming:        "Gaming",
  subscriptions: "Accounts & Subscriptions",
};

const CRYPTO_OPTIONS = [
  { id:"btc",       name:"BTC",           color:"#f7931a", glyph:"₿" },
  { id:"eth",       name:"ETH",           color:"#627eea", glyph:"Ξ" },
  { id:"ltc",       name:"LTC",           color:"#345d9d", glyph:"Ł" },
  { id:"usdt-trc",  name:"USDT - TRC-20", color:"#26a17b", glyph:"₮" },
  { id:"usdt-bep",  name:"USDT - BEP-20", color:"#26a17b", glyph:"₮" },
  { id:"bnb",       name:"BNB",           color:"#f0b90b", glyph:"B" },
  { id:"trx",       name:"TRX",           color:"#ef0027", glyph:"T" },
  { id:"usdt-erc",  name:"USDT - ERC-20", color:"#26a17b", glyph:"₮" },
];

// Stepper icons (inline, matching the reference)
function StepIcMakePayment({ c }:{ c:string }) {
  return <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2.5"/><path d="M2 10h20"/><path d="M6 15h4"/></svg>;
}
function StepIcAddAccount({ c }:{ c:string }) {
  return <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></svg>;
}
function StepIcCredentials({ c }:{ c:string }) {
  return <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>;
}
function StepIcReview({ c }:{ c:string }) {
  return <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="14" height="16" rx="2"/><path d="M7 8h6M7 12h4"/><circle cx="17.5" cy="16.5" r="3.5"/><path d="M20 19l2 2"/></svg>;
}

const MERCHANT_STEPS = [
  { key:"payment",     label:"Make Payment", Ic: StepIcMakePayment },
  { key:"account",     label:"Add account",  Ic: StepIcAddAccount },
  { key:"credentials", label:"Credentials",  Ic: StepIcCredentials },
  { key:"review",      label:"Review",       Ic: StepIcReview },
] as const;

function MerchantStepper({ step }: { step:number }) {
  return (
    <div className="flex items-center shrink-0">
      {MERCHANT_STEPS.map((s, i) => {
        const done = i < step;
        const active = i === step;
        const on = done || active;
        const color = active ? P : done ? P : "#4b5563";
        return (
          <div key={s.key} className="flex items-center">
            <div className="flex flex-col items-center gap-2" style={{ width: 76 }}>
              <div className="w-11 h-11 rounded-full flex items-center justify-center transition-all"
                style={{ background: on ? "rgba(240,78,35,0.12)" : "rgba(255,255,255,0.04)", border: `1.5px solid ${active ? P : done ? "rgba(240,78,35,0.5)" : "rgba(255,255,255,0.08)"}` }}>
                <s.Ic c={color}/>
              </div>
              <span className="text-[11px] font-semibold text-center leading-tight" style={{ color: active ? P : on ? "#d1d5db" : "#6b7280" }}>{s.label}</span>
            </div>
            {i < MERCHANT_STEPS.length - 1 && (
              <div className="mb-6" style={{ width: 34, height: 2, borderRadius: 2, background: i < step ? P : "transparent", borderTop: i < step ? "none" : "2px dashed rgba(255,255,255,0.18)" }}/>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Reusable dark form field
function MField({ label, children, hint }: { label:string; children:React.ReactNode; hint?:string }) {
  return (
    <div className="mb-4">
      <label className="block text-[13px] font-semibold text-gray-300 mb-2">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-gray-500 mt-1.5">{hint}</p>}
    </div>
  );
}
const M_INPUT = "w-full px-4 py-3 rounded-xl text-[14px] text-white outline-none transition-all";
const mInputStyle = { background: MCARD2, border: `1px solid ${MBD}` } as React.CSSProperties;

// ═══ BECOME-A-MERCHANT — public marketing page (matches reference design) ═══

/* Floating iOS-style app-icon badge (rounded square, brand fill, soft shadow). */
function MerchAppBadge({ bg, size=54, className="", style, children }: { bg:string; size?:number; className?:string; style?:React.CSSProperties; children:React.ReactNode }) {
  return (
    <span className={`sb-float absolute grid place-items-center ${className}`} style={{ width:size, height:size, borderRadius:size*0.26, background:bg, boxShadow:"0 12px 26px -8px rgba(0,0,0,.55)", ...style }}>
      <svg width={size*0.6} height={size*0.6} viewBox="0 0 24 24">{children}</svg>
    </span>
  );
}
const IG_GRADIENT = "linear-gradient(135deg,#feda75 0%,#fa7e1e 28%,#d62976 55%,#962fbf 78%,#4f5bd5 100%)";

/* Hero illustration — circular photo with WhatsApp / Facebook / Instagram icons
   on the ring, a smaller inset circle and the white brand badge. Matches the
   reference become-a-merchant artwork. */
function MerchHeroArt() {
  return (
    <div className="relative mx-auto mt-6" style={{ width:"min(86vw, 360px)", height:"min(86vw, 360px)" }}>
      <div className="pointer-events-none absolute -inset-8" style={{ background:"radial-gradient(circle at 50% 45%, var(--sb-hero-glow) 0%, transparent 68%)" }}/>
      {/* main circle */}
      <div className="absolute inset-0 rounded-full overflow-hidden" style={{ border:`5px solid ${P}`, boxShadow:`0 0 0 2px ${P}55, var(--sb-lshadow-lg)`, background:"#e0a94a" }}>
        <img src="https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=760&h=760&fit=crop&auto=format" alt="Sellers on SimBazaar" className="w-full h-full object-cover"/>
      </div>
      {/* WhatsApp — top center */}
      <MerchAppBadge bg="#25D366" size={58} style={{ top:"-4%", left:"50%", marginLeft:-29, animationDelay:"0s" }}>
        <path fill="#fff" d="M12 2C6.5 2 2 6.5 2 12c0 1.9.5 3.6 1.4 5.2L2 22l4.9-1.3C8.5 21.5 10.2 22 12 22c5.5 0 10-4.5 10-10S17.5 2 12 2zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .3-3.4-.7-2.9-1.2-4.7-4.1-4.8-4.3-.1-.2-1.2-1.6-1.2-3s.7-2.1 1-2.4c.2-.3.5-.3.7-.3h.5c.2 0 .4-.1.7.5.2.6.8 2 .9 2.1.1.1.1.3 0 .5-.1.2-.2.4-.3.5l-.5.5c-.2.2-.3.3-.1.6.2.3.9 1.4 1.9 2.3 1.3 1.1 2.3 1.5 2.6 1.6.3.1.5.1.6-.1.2-.2.7-.9.9-1.2.2-.3.4-.2.6-.1l2 1c.3.1.5.2.5.3.2.2.2.8 0 1.4z"/>
      </MerchAppBadge>
      {/* Facebook — left edge */}
      <MerchAppBadge bg="#1877F2" size={54} style={{ top:"56%", left:"-5%", animationDelay:".9s" }}>
        <path fill="#fff" d="M14 8h2V5h-2c-1.7 0-3 1.3-3 3v2H9v3h2v6h3v-6h2.2l.8-3H14V8.5c0-.3.2-.5.5-.5H14z"/>
      </MerchAppBadge>
      {/* Instagram — right edge (gradient) */}
      <MerchAppBadge bg={IG_GRADIENT} size={54} style={{ top:"52%", right:"-5%", animationDelay:"1.5s" }}>
        <rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="#fff" strokeWidth="2"/><circle cx="12" cy="12" r="4" fill="none" stroke="#fff" strokeWidth="2"/><circle cx="17.3" cy="6.7" r="1.3" fill="#fff"/>
      </MerchAppBadge>
      {/* small inset circle (bottom-right) */}
      <div className="sb-float absolute rounded-full overflow-hidden" style={{ width:"40%", height:"40%", right:"-4%", bottom:"-4%", border:`4px solid ${P}`, boxShadow:"var(--sb-lshadow-lg)", background:"#e0a94a", animationDelay:"1.1s" }}>
        <img src="https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=360&h=360&fit=crop&auto=format" alt="Seller" className="w-full h-full object-cover"/>
      </div>
      {/* white brand badge (bottom center) */}
      <span className="sb-float absolute grid place-items-center rounded-full" style={{ width:56, height:56, left:"42%", bottom:"1%", marginLeft:-28, background:"#fff", border:`3px solid ${P}`, boxShadow:"0 10px 22px -8px rgba(0,0,0,.5)", animationDelay:"1.8s" }}><Brand3D size={32}/></span>
    </div>
  );
}

/* Centered orange pill + big balanced heading, exactly as the reference sections. */
function MerchHead({ pill, title }: { pill:string; title:React.ReactNode }) {
  return (
    <div className="text-center mb-12 sb-reveal">
      <span className="inline-block rounded-full px-5 py-2 text-[14px] font-bold text-white" style={{ background:P }}>{pill}</span>
      <h2 className="mx-auto mt-6 max-w-2xl text-[clamp(1.9rem,6vw,3rem)] font-extrabold leading-[1.08] tracking-[-0.02em] text-white" style={{ fontFamily:FONT, textWrap:"balance" as any }}>{title}</h2>
    </div>
  );
}

/* ── Feature illustrations — rebuilt to match the reference artwork exactly.
   Tones resolve through --sb-illo-* tokens (theme.css) so dark reads like the
   screenshots and light stays clean. ─────────────────────────────────────── */
const ILLO_PANEL: React.CSSProperties = { background:"var(--sb-illo-panel)", minHeight:210 };
function IlloPin({ style }: { style?:React.CSSProperties }) {
  return <svg className="absolute" style={style} width="22" height="28" viewBox="0 0 22 28" fill="none"><path d="M11 0C5 0 0 5 0 11c0 7.7 11 17 11 17s11-9.3 11-17C22 5 17 0 11 0z" fill={P}/><circle cx="11" cy="11" r="3.6" fill="#fff"/></svg>;
}
function IlloLine({ w="100%", h=8 }: { w?:string; h?:number }) {
  return <div style={{ width:w, height:h, borderRadius:99, background:"var(--sb-illo-line)" }}/>;
}
function IlloReach() {
  return (
    <div className="relative overflow-hidden rounded-2xl p-6" style={ILLO_PANEL}>
      {/* faint globe backdrop */}
      <svg className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" width="230" height="230" viewBox="0 0 230 230" fill="none" style={{ opacity:1 }}>
        <circle cx="115" cy="115" r="96" stroke="var(--sb-illo-glow)" strokeWidth="3"/>
        <ellipse cx="115" cy="115" rx="42" ry="96" stroke="var(--sb-illo-glow)" strokeWidth="3"/>
        <path d="M22 92h186M22 138h186" stroke="var(--sb-illo-glow)" strokeWidth="3"/>
      </svg>
      <IlloPin style={{ top:"6%", left:"32%" }}/>
      <IlloPin style={{ top:"52%", left:"58%" }}/>
      <IlloPin style={{ top:"64%", left:"30%" }}/>
      {/* bubble 1 (top-left) */}
      <div className="relative mt-2 flex items-center gap-3 rounded-2xl p-3.5 w-[68%]" style={{ background:"var(--sb-illo-card)" }}>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full" style={{ background:P }}><UserIcon size={16} color="#fff"/></span>
        <div className="flex-1 space-y-2"><IlloLine w="100%"/><IlloLine w="62%"/></div>
      </div>
      {/* bubble 2 (bottom-right) */}
      <div className="relative mt-8 ml-auto flex items-center gap-3 rounded-2xl p-3.5 w-[70%]" style={{ background:"var(--sb-illo-card)" }}>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full" style={{ background:P }}><UserIcon size={16} color="#fff"/></span>
        <div className="flex-1 space-y-2"><IlloLine w="100%"/><IlloLine w="80%"/><IlloLine w="45%"/></div>
      </div>
    </div>
  );
}
function IlloPicIcon() {
  return <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg" style={{ background:"var(--sb-illo-chip)" }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={P} strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="9" r="1.6"/><path d="M4 17l5-4 4 3 3-3 4 4" strokeLinecap="round" strokeLinejoin="round"/></svg></span>;
}
function IlloDollar() {
  return <span className="grid h-7 w-7 place-items-center rounded-lg text-[14px] font-extrabold" style={{ background:"var(--sb-illo-chip)", color:P }}>$</span>;
}
function IlloDots() {
  return <div className="flex gap-1.5">{[0,1,2].map(i=><span key={i} className="h-2 w-2 rounded-full" style={{ background:P }}/>)}</div>;
}
function IlloListing() {
  return (
    <div className="relative rounded-2xl p-6" style={ILLO_PANEL}>
      {/* back card (top-left, larger) */}
      <div className="relative z-10 w-[66%] rounded-xl p-3.5" style={{ background:"var(--sb-illo-card)" }}>
        <div className="mb-3 flex items-center justify-between"><IlloDots/><IlloDollar/></div>
        <div className="flex items-center gap-2.5"><IlloPicIcon/><div className="flex-1 space-y-2"><IlloLine w="100%"/><IlloLine w="60%"/></div></div>
        <div className="mt-3 flex h-7 items-center rounded-lg px-2.5" style={{ background:"var(--sb-illo-panel)" }}><div className="h-2 w-12 rounded-full" style={{ background:P }}/></div>
      </div>
      {/* front card (bottom-right, overlapping) */}
      <div className="relative z-20 -mt-8 ml-auto w-[62%] rounded-xl p-3.5" style={{ background:"var(--sb-illo-card)", boxShadow:"0 12px 26px -14px rgba(0,0,0,.7)" }}>
        <div className="mb-3 flex items-center justify-between"><IlloDots/><IlloDollar/></div>
        <div className="flex items-center gap-2.5"><IlloPicIcon/><div className="flex-1 space-y-2"><IlloLine w="100%"/><IlloLine w="55%"/></div></div>
      </div>
    </div>
  );
}
function IlloEscrow() {
  return (
    <div className="relative rounded-2xl p-6" style={ILLO_PANEL}>
      <div className="relative z-10 w-[76%] rounded-2xl p-4" style={{ background:"var(--sb-illo-card)" }}>
        <LockIcon size={15} color="var(--sb-illo-line)" className="absolute right-4 top-4"/>
        {/* masked digits row */}
        <div className="mb-3 flex h-8 items-center gap-2 rounded-lg px-3" style={{ background:"var(--sb-illo-panel)" }}>
          {Array.from({length:4}).map((_,i)=><span key={i} className="h-2 w-4 rounded-sm" style={{ background:"var(--sb-illo-line)" }}/>)}
        </div>
        {/* two input rows */}
        <div className="mb-4 flex gap-2.5">
          <div className="flex h-8 flex-1 items-center gap-1.5 rounded-lg px-2.5" style={{ background:"var(--sb-illo-panel)" }}><span className="h-2 w-8 rounded-sm" style={{ background:"var(--sb-illo-line)" }}/><span className="h-2 w-4 rounded-sm" style={{ background:"var(--sb-illo-line)" }}/></div>
          <div className="flex h-8 flex-1 items-center gap-1.5 rounded-lg px-2.5" style={{ background:"var(--sb-illo-panel)" }}><span className="h-2 w-6 rounded-sm" style={{ background:"var(--sb-illo-line)" }}/><span className="h-2 w-5 rounded-sm" style={{ background:"var(--sb-illo-line)" }}/></div>
        </div>
        <button className="h-10 w-full rounded-xl text-[13px] font-bold text-white" style={{ background:P }}>Pay</button>
      </div>
      {/* orange gradient shield + check */}
      <svg className="absolute right-4 top-1/2 z-20 -translate-y-1/2 sb-float" width="86" height="100" viewBox="0 0 86 100" fill="none">
        <defs><linearGradient id="mshield" x1="0" y1="0" x2="86" y2="100" gradientUnits="userSpaceOnUse"><stop stopColor="#ff7a4d"/><stop offset="1" stopColor="#e0421c"/></linearGradient></defs>
        <path d="M43 3l38 15v29c0 27-20 42-38 50C25 89 5 74 5 47V18L43 3z" fill="url(#mshield)"/>
        <path d="M43 3v94C25 89 5 74 5 47V18L43 3z" fill="#000" opacity="0.10"/>
        <path d="M29 50l10 10 19-20" stroke="#fff" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      </svg>
    </div>
  );
}
function IlloAnalytics() {
  const bars=[30,46,40,62,54,80,68]; const pts=[[6,76],[21,60],[36,66],[51,42],[66,52],[81,24],[94,34]];
  return (
    <div className="relative rounded-2xl p-6" style={ILLO_PANEL}>
      <span className="absolute right-6 top-5 text-[26px] font-light leading-none" style={{ color:P }}>+</span>
      <span className="absolute left-6 bottom-6 text-[26px] font-light leading-none" style={{ color:P }}>+</span>
      <div className="mx-auto w-[76%] rounded-2xl p-4" style={{ background:"var(--sb-illo-card)" }}>
        <div className="mb-4 flex flex-col items-center gap-1.5"><div className="h-1.5 w-24 rounded-full" style={{ background:P }}/><div className="h-1.5 w-14 rounded-full" style={{ background:P, opacity:.55 }}/></div>
        <div className="relative h-[96px]">
          <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2" style={{ height:"100%" }}>
            {bars.map((h,i)=><div key={i} className="flex-1 rounded-t" style={{ height:`${h}%`, background:"var(--sb-illo-line)" }}/>)}
          </div>
          <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none"><polyline points={pts.map(p=>p.join(",")).join(" ")} fill="none" stroke={P} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/></svg>
        </div>
      </div>
    </div>
  );
}

const MERCH_FEATURES = [
  { title:"Reach Buyers Worldwide",   desc:"List your TikTok accounts, Telegram numbers, email accounts, VPN accounts, and other digital products and connect with buyers from around the world.", Illo:IlloReach },
  { title:"Fast & Easy Listing",      desc:"Create listings quickly by adding account details, pricing, and delivery options. Start selling your digital accounts in minutes.", Illo:IlloListing },
  { title:"Secure Payments & Escrow", desc:"All transactions are protected with secure payments and escrow, ensuring safe trades between buyers and sellers.", Illo:IlloEscrow },
  { title:"Sales Insights & Analytics", desc:"Track orders, revenue, and listing performance with real-time analytics to grow your digital account sales.", Illo:IlloAnalytics },
];
const MERCH_STEPS = [
  { n:"1", title:"Create Your Seller Account", desc:"Sign up for free and create your SimBazaar seller account to start listing digital accounts and online services." },
  { n:"2", title:"List Your Digital Accounts", desc:"Add details for your TikTok accounts, Telegram numbers, email accounts, VPN accounts, and other digital products and set your price." },
  { n:"3", title:"Connect with Buyers", desc:"Communicate directly with buyers, answer questions, and manage orders through the SimBazaar marketplace." },
  { n:"4", title:"Receive Secure Payments", desc:"Complete transactions safely through our secure payment and escrow system and receive payments directly to your wallet." },
];
const MERCH_TESTIMONIALS = [
  { name:"Emperor YRN", img:"https://images.unsplash.com/photo-1531384441138-2736e62e0919?w=760&h=760&fit=crop&auto=format", quote:"SimBazaar has been a game-changer for my business. I've been able to easily list and sell my accounts and services to buyers from around the world. The platform makes it simple to manage listings and communicate with buyers, and I've had great success selling my digital accounts here." },
  { name:"Amara Osei",  img:"https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=760&h=760&fit=crop&auto=format", quote:"Payouts are fast and the escrow system means buyers trust me instantly. I listed my first eSIM plans in minutes and had sales the same day. Best marketplace I've sold on." },
  { name:"David Mensah", img:"https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=760&h=760&fit=crop&auto=format", quote:"The analytics dashboard shows me exactly what's selling. Managing orders and chatting with buyers is effortless, and support is always there when I need them." },
];

function MerchTestimonials() {
  const [idx,setIdx]=useState(0);
  const t=MERCH_TESTIMONIALS[idx];
  return (
    <section className="py-20 sm:py-24 px-5" style={{ background:BG }}>
      <div className="max-w-2xl mx-auto">
        <MerchHead pill="Seller Testimonials" title="What Sellers Are Saying About SimBazaar"/>
        <div className="sb-reveal">
          <div key={idx} className="overflow-hidden rounded-3xl" style={{ animation:"sbPageIn .45s cubic-bezier(.22,1,.36,1) both" }}>
            <div className="h-[300px] w-full overflow-hidden rounded-3xl" style={{ background:"#e9722e" }}>
              <img src={t.img} alt={t.name} className="h-full w-full object-cover"/>
            </div>
            <div className="mt-5 rounded-3xl p-6 sm:p-7 sb-lcard">
              <div className="mb-3 flex gap-1">{Array.from({length:5}).map((_,i)=><StarIcon key={i} size={20} color="#f5a623"/>)}</div>
              <p className="text-white text-[15px] sm:text-base leading-relaxed" style={{ textWrap:"balance" as any }}>&ldquo;{t.quote}&rdquo;</p>
              <p className="mt-5 text-lg font-extrabold text-white" style={{ fontFamily:FONT }}>{t.name}</p>
            </div>
          </div>
          <div className="mt-6 flex gap-3">
            {[()=>setIdx((idx-1+MERCH_TESTIMONIALS.length)%MERCH_TESTIMONIALS.length), ()=>setIdx((idx+1)%MERCH_TESTIMONIALS.length)].map((fn,i)=>(
              <button key={i} aria-label={i===0?"Previous":"Next"} onClick={fn} className="grid h-12 w-12 place-items-center rounded-full text-white transition-all hover:opacity-90 active:scale-95" style={{ background:P }}>
                {i===0?<ArrowLeft01Icon size={20} color="#fff"/>:<ArrowRight01Icon size={20} color="#fff"/>}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function BecomeMerchantPage({ setPage }: { setPage:(p:Page)=>void }) {
  const [menuOpen,setMenuOpen]=useState(false);
  useScrollReveal();
  return (
    <>
      <Navbar open={menuOpen} setOpen={setMenuOpen} setPage={setPage}/>
      <main>
        {/* HERO */}
        <section id="top" className="relative overflow-hidden px-5 pt-28 pb-16" style={{ background:BG }}>
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[520px]" style={{ background:"radial-gradient(ellipse 80% 60% at 50% 4%, var(--sb-hero-glow) 0%, transparent 66%)" }}/>
          <div className="relative mx-auto max-w-3xl text-center">
            <h1 className="text-[clamp(2.3rem,8vw,3.5rem)] font-extrabold leading-[1.05] tracking-[-0.03em] text-white sb-reveal" style={{ fontFamily:FONT, textWrap:"balance" as any }}>Sell your accounts to a global audience on SimBazaar.</h1>
            <p className="mx-auto mt-6 max-w-xl text-[15px] sm:text-lg leading-relaxed text-gray-400 sb-reveal" style={{ transitionDelay:"60ms" }}>With over 200,000+ active users ready to buy across multiple categories, SimBazaar provides a trusted marketplace designed to make selling digital products simple, with smooth transactions and easy payouts. 🚀</p>
            <div className="mt-9 flex justify-center sb-reveal" style={{ transitionDelay:"120ms" }}>
              <button onClick={()=>setPage("merchant")} className="w-full max-w-[440px] rounded-full py-3 text-[15px] font-semibold text-white transition-all hover:opacity-90 active:scale-[0.99]" style={{ background:P }}>Become a Seller</button>
            </div>
            <div className="sb-reveal" style={{ transitionDelay:"140ms" }}><MerchHeroArt/></div>
          </div>
        </section>

        {/* FEATURES */}
        <section id="features" className="px-5 py-20 sm:py-24" style={{ background:BG }}>
          <div className="mx-auto max-w-3xl">
            <MerchHead pill="Features" title="Sell Digital Accounts to Buyers Worldwide"/>
            <div className="space-y-6">
              {MERCH_FEATURES.map(({title,desc,Illo})=>(
                <div key={title} className="sb-lcard sb-lift rounded-3xl p-7 sm:p-8 sb-reveal">
                  <h3 className="text-2xl font-bold text-white tracking-[-0.01em]" style={{ fontFamily:FONT }}>{title}</h3>
                  <p className="mt-3 mb-7 max-w-lg text-[15px] leading-relaxed text-gray-400">{desc}</p>
                  <Illo/>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section id="how-it-works" className="px-5 py-20 sm:py-24" style={{ background:BG2 }}>
          <div className="mx-auto max-w-3xl">
            <MerchHead pill="How It Works" title="Start Selling Digital Accounts in 4 Simple Steps"/>
            <div className="space-y-6">
              {MERCH_STEPS.map(({n,title,desc})=>(
                <div key={n} className="sb-lcard sb-lift rounded-3xl p-7 sm:p-8 sb-reveal">
                  <span className="grid h-14 w-14 place-items-center rounded-2xl text-[22px] font-extrabold text-white" style={{ background:P, boxShadow:`0 12px 26px -10px ${P}` }}>{n}</span>
                  <h3 className="mt-7 text-2xl font-bold text-white tracking-[-0.01em]" style={{ fontFamily:FONT }}>{title}</h3>
                  <p className="mt-3 max-w-lg text-[15px] leading-relaxed text-gray-400">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <MerchTestimonials/>

        {/* CTA */}
        <section className="px-5 pb-20" style={{ background:BG }}>
          <div className="mx-auto max-w-3xl text-center sb-reveal">
            <h2 className="text-[clamp(1.7rem,5vw,2.6rem)] font-extrabold leading-tight tracking-[-0.02em] text-white" style={{ fontFamily:FONT, textWrap:"balance" as any }}>Ready to start selling?</h2>
            <p className="mx-auto mt-4 max-w-md text-[15px] leading-relaxed text-gray-400">Join thousands of verified sellers earning on SimBazaar today.</p>
            <div className="mt-8 flex justify-center">
              <button onClick={()=>setPage("merchant")} className="w-full max-w-[440px] rounded-full py-3 text-[15px] font-semibold text-white transition-all hover:opacity-90 active:scale-[0.99]" style={{ background:P }}>Become a Seller</button>
            </div>
          </div>
        </section>
      </main>
      <Footer setPage={setPage}/>
    </>
  );
}

function MerchantPage({ setPage, paid, onPaid, onSubmit }: { setPage:(p:Page)=>void; paid:boolean; onPaid:()=>Promise<ActivateResult>; onSubmit:(ad:AdListing)=>void }) {
  const [step, setStep] = useState(paid ? 1 : 0); // 0..3 — skip payment if already paid
  const [done, setDone] = useState(false);
  // A verified seller must never see the one-time payment step. `paid` reflects
  // is_seller, which may resolve after mount — as soon as it's true, skip past
  // the payment step to "Add your account".
  useEffect(() => { if (paid) setStep((s) => (s === 0 ? 1 : s)); }, [paid]);
  // Real payment state — the fee is charged server-side from the wallet.
  const [payBusy, setPayBusy] = useState(false);
  const [payErr, setPayErr] = useState("");
  const [needsFunds, setNeedsFunds] = useState(false);
  const payFee = async () => {
    if (payBusy) return;
    setPayBusy(true); setPayErr(""); setNeedsFunds(false);
    const result = await onPaid();
    setPayBusy(false);
    if (result.ok) { goStep(1); return; }
    setPayErr(result.error ?? "Payment could not be completed.");
    setNeedsFunds(Boolean(result.needsFunds));
  };

  // Payment state
  const [method, setMethod] = useState<"bank"|"crypto"|"wallet">("bank");
  const [crypto, setCrypto] = useState<string>("");
  const [cryptoOpen, setCryptoOpen] = useState(false);

  // Account state
  const [acc, setAcc] = useState({ title:"", category:"social", platform:"", price:"", quantity:"1", description:"" });
  const [platformOpen, setPlatformOpen] = useState(false);
  // Credentials state — one entry per unit of quantity
  const blankCred = ():MCred => ({ previewLink:"", login:"", password:"", email:"", emailPass:"", notes:"" });
  const [creds, setCreds] = useState<MCred[]>([blankCred()]);
  const [showPass, setShowPass] = useState<Record<number,boolean>>({});

  const qty = Math.max(1, parseInt(acc.quantity||"1")||1);
  const updateCred = (i:number, patch:Partial<MCred>) => setCreds(prev => prev.map((c,idx)=> idx===i ? {...c, ...patch} : c));
  const credsComplete = creds.every(c => c.login && c.password);

  const payLabel = method === "bank"
    ? `Pay ₦ ${MERCHANT_FEE_NGN.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`
    : `Pay $${MERCHANT_FEE_USD.toFixed(2)}`;

  const selectedCrypto = CRYPTO_OPTIONS.find(c => c.id === crypto);

  const goStep = (n:number) => { setStep(n); window.scrollTo({ top:0, behavior:"smooth" }); };

  // Sync credential entries to the chosen quantity, then advance to Credentials step
  const gotoCredentials = () => {
    setCreds(prev => {
      const next = [...prev];
      while (next.length < qty) next.push(blankCred());
      return next.slice(0, qty);
    });
    goStep(2);
  };

  // Derive the brand for the listing and publish it to My Ads
  const [publishing, setPublishing] = useState(false);
  const submitListing = async () => {
    if (publishing) return;
    setPublishing(true);
    const fc = FILTER_CATEGORIES.find(f => f.name === CATEGORY_TO_FILTER[acc.category]);
    const pItem = fc?.items.find(it => it.name === acc.platform);
    const brand: BrandKey = pItem?.brand ?? (acc.category==="vpn"?"vpn":acc.category==="gaming"?"steam":acc.category==="giftcards"?"giftcard":acc.category==="subscriptions"?"netflix":"whatsapp");
    onSubmit({
      id: Date.now(),
      title: acc.title || `${acc.platform || "New"} account`,
      category: acc.category,
      platform: acc.platform,
      price: parseFloat(acc.price || "0") || 0,
      quantity: qty,
      status: "pending",
      brand,
      description: acc.description.trim(),
    });
    await new Promise(r => setTimeout(r, 500)); // let the in-button spinner read
    setDone(true);
  };

  // ── SUCCESS SCREEN ──
  if (done) {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: MBG, fontFamily: FONT }}>
        <DesktopTopNav setPage={setPage} active="merchant"/>
        <AppMobileHeader className="md:hidden" setPage={setPage}/>
        <div className="flex-1 flex items-center justify-center px-5 py-16">
          <div className="w-full max-w-[440px] text-center">
            <div className="mx-auto mb-6 w-20 h-20 rounded-full flex items-center justify-center" style={{ background:"rgba(22,163,74,0.14)", border:"1.5px solid rgba(22,163,74,0.4)" }}>
              <CheckmarkCircle01Icon size={44} color="#22c55e"/>
            </div>
            <h2 className="text-white mb-2" style={{ fontSize:24, fontWeight:800 }}>Submitted for review!</h2>
            <p className="text-gray-400 text-[14px] leading-relaxed mb-8">Your listing has been submitted and is now pending review. Our team will review it within 24 hours — you can track its status on your My Ads page.</p>
            <button onClick={() => setPage("ads")} className="px-8 py-3.5 rounded-full font-bold text-[15px] text-white transition-all hover:opacity-90" style={{ background:P, boxShadow:"none" }}>
              View My Ads
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: MBG, fontFamily: FONT }}>
      <DesktopTopNav setPage={setPage} active="merchant"/>
      <AppMobileHeader className="md:hidden" setPage={setPage}/>

      {/* Header row */}
      <div className="px-5 md:px-10 pt-7 md:pt-10 pb-2 flex flex-col md:flex-row md:items-start md:justify-between gap-6">
        <div>
          <h1 className="text-white" style={{ fontSize:34, fontWeight:800, letterSpacing:"-0.02em" }}>Become a merchant</h1>
          <p className="text-gray-400 text-[14px] mt-1">A one-time payment is required to complete your merchant registration.</p>
        </div>
        <div className="hidden md:block"><MerchantStepper step={step}/></div>
      </div>

      {/* Mobile compact stepper */}
      <div className="md:hidden px-5 pt-2 pb-1 overflow-x-auto" style={{ scrollbarWidth:"none" }}>
        <MerchantStepper step={step}/>
      </div>

      {/* Main panel */}
      <div className="px-5 md:px-10 py-6 flex-1">
        <div className="mx-auto w-full max-w-[920px] rounded-[26px] px-5 md:px-10 py-8 md:py-12"
          style={{ background: MCARD, border:`1px solid ${MBD}` }}>

          {/* ══ STEP 0 — MAKE PAYMENT ══ */}
          {step === 0 && (
            <div className="max-w-[620px] mx-auto">
              <h2 className="text-white text-center mb-8" style={{ fontSize:26, fontWeight:800 }}>Make A One Time Payment</h2>

              {/* Bank / Card */}
              <div role="button" tabIndex={0} onClick={() => setMethod("bank")} className="w-full text-left rounded-2xl p-5 mb-4 transition-all cursor-pointer"
                style={{ background: MCARD2, border:`1.5px solid ${method==="bank"?P:MBD}` }}>
                <div className="flex items-start gap-3.5">
                  <span className="shrink-0 mt-0.5">
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={P} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="14" rx="2.5"/><path d="M2 9h20"/><path d="M12 13v6M9.5 16.5L12 19l2.5-2.5"/></svg>
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-bold text-[15px] mb-0.5">Bank / Card Payment</p>
                    <p className="text-gray-400 text-[13px] leading-relaxed">Make deposit using either your card or transfer to our local bank</p>
                    {method==="bank" && (
                      <div className="mt-4">
                        <div className="w-full px-4 py-3 rounded-xl text-[14px] text-white flex items-center gap-2" style={mInputStyle}>
                          <span className="font-bold" style={{ color:P }}>₦</span> NGN - Nigerian Naira
                        </div>
                        <p className="text-[13px] text-gray-400 mt-2.5">Amount to pay: <span className="font-bold" style={{ color:P }}>₦ {MERCHANT_FEE_NGN.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</span></p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Crypto */}
              <div role="button" tabIndex={0} onClick={() => setMethod("crypto")} className="w-full text-left rounded-2xl p-5 mb-4 transition-all cursor-pointer"
                style={{ background: MCARD2, border:`1.5px solid ${method==="crypto"?P:MBD}` }}>
                <div className="flex items-start gap-3.5">
                  <span className="shrink-0 mt-0.5">
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={P} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12a8 8 0 0 1 13-6.2M20 12a8 8 0 0 1-13 6.2"/><path d="M17 3v3h-3M7 21v-3h3"/><path d="M12 8v8M14.2 9.5c0-1-1-1.5-2.2-1.5s-2.2.5-2.2 1.6c0 2 4.4 1 4.4 3 0 1.1-1 1.6-2.2 1.6s-2.2-.6-2.2-1.6"/></svg>
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-bold text-[15px] mb-0.5">Crypto Deposit</p>
                    <p className="text-gray-400 text-[13px] leading-relaxed">Fund your wallet with popular cryptocurrencies like USDT, ETH, BNB, SOL and more.</p>
                    {method==="crypto" && (
                      <div className="mt-4 relative" onClick={e=>e.stopPropagation()}>
                        <button onClick={()=>setCryptoOpen(o=>!o)} className="w-full px-4 py-3 rounded-xl text-[14px] flex items-center justify-between" style={mInputStyle}>
                          {selectedCrypto ? (
                            <span className="flex items-center gap-2 text-white">
                              <CoinDot color={selectedCrypto.color} glyph={selectedCrypto.glyph}/> {selectedCrypto.name}
                            </span>
                          ) : <span className="text-gray-400">Select a Crypto</span>}
                          <ArrowDown01Icon size={16} color="#9ca3af"/>
                        </button>
                        {cryptoOpen && (
                          <div className="absolute left-0 right-0 mt-1.5 rounded-xl overflow-hidden z-20 max-h-[260px] overflow-y-auto" style={{ background:"var(--sb-mcard)", border:`1px solid ${MBD}`, boxShadow:"0 16px 40px rgba(0,0,0,0.6)" }}>
                            {CRYPTO_OPTIONS.map(c => (
                              <button key={c.id} onClick={()=>{ setCrypto(c.id); setCryptoOpen(false); }}
                                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left text-white text-[14px] transition-colors hover:bg-white/5">
                                <CoinDot color={c.color} glyph={c.glyph}/> {c.name}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Wallet */}
              <div role="button" tabIndex={0} onClick={() => setMethod("wallet")} className="w-full text-left rounded-2xl p-5 mb-8 transition-all cursor-pointer"
                style={{ background: MCARD2, border:`1.5px solid ${method==="wallet"?P:MBD}` }}>
                <div className="flex items-start gap-3.5">
                  <span className="shrink-0 mt-0.5"><Wallet01Icon size={26} color={P}/></span>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-bold text-[15px] mb-0.5">SimBazaar Wallet</p>
                    <p className="text-gray-400 text-[13px] leading-relaxed">Make payment using your SimBazaar account Balance</p>
                  </div>
                </div>
              </div>

              {payErr && (
                <div className="max-w-[560px] mx-auto mb-4 rounded-xl px-4 py-3 text-[13px] font-medium" style={{ background:"rgba(239,68,68,0.08)", color:"#ef4444" }}>
                  {payErr}
                  {needsFunds && (
                    <button onClick={() => setPage("wallet")} className="ml-1.5 font-bold underline" style={{ color:P }}>Add funds</button>
                  )}
                </div>
              )}
              <div className="flex justify-center">
                <button onClick={payFee} disabled={payBusy} className="flex items-center justify-center gap-2 px-10 py-3.5 rounded-full font-bold text-[15px] text-white transition-all hover:opacity-90 active:scale-95 disabled:opacity-60" style={{ background:P, boxShadow:"none" }}>
                  {payBusy && <Spinner size={17}/>}
                  {payBusy ? "Processing payment…" : payLabel}
                </button>
              </div>
            </div>
          )}

          {/* ══ STEP 1 — ADD ACCOUNT ══ */}
          {step === 1 && (
            <div className="max-w-[560px] mx-auto">
              <h2 className="text-white text-center mb-2" style={{ fontSize:24, fontWeight:800 }}>Add Your Account</h2>
              <p className="text-gray-400 text-[13px] text-center mb-8">Enter the details of the product / account you want to list.</p>

              <MField label="Product Title">
                <input value={acc.title} onChange={e=>setAcc({...acc,title:e.target.value})} placeholder="e.g. USA Verified WhatsApp Number" className={M_INPUT} style={mInputStyle}/>
              </MField>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <MField label="Category">
                  <select value={acc.category} onChange={e=>{setAcc({...acc,category:e.target.value,platform:""}); setPlatformOpen(false);}} className={M_INPUT} style={mInputStyle}>
                    {CATEGORIES.filter(c=>c.id!=="trending").map(c => <option key={c.id} value={c.id} style={{background:"var(--sb-mcard)"}}>{c.label}</option>)}
                  </select>
                </MField>
                <MField label="Price (USD)">
                  <input value={acc.price} onChange={e=>setAcc({...acc,price:e.target.value.replace(/[^0-9.]/g,"")})} placeholder="0.00" inputMode="decimal" className={M_INPUT} style={mInputStyle}/>
                </MField>
              </div>

              {/* Platform sub-selection (from filter categories) */}
              {(() => {
                const filterName = CATEGORY_TO_FILTER[acc.category];
                const filterCat = FILTER_CATEGORIES.find(f => f.name === filterName);
                if (!filterCat) return null;
                const selectedItem = filterCat.items.find(i => i.name === acc.platform);
                const renderTile = (item: typeof filterCat.items[number]) => item.brand ? (
                  <BrandIcon brand={item.brand} size={24} radius={7}/>
                ) : (
                  <span className="rounded-[7px] flex items-center justify-center shrink-0 overflow-hidden text-[11px]" style={{ width:24, height:24, background:item.bg }}>{item.icon}</span>
                );
                return (
                  <MField label="Platform" hint="Select the platform this account belongs to.">
                    <div className="relative">
                      <button type="button" onClick={()=>setPlatformOpen(o=>!o)} className="w-full px-4 py-3 rounded-xl text-[14px] flex items-center justify-between" style={mInputStyle}>
                        {selectedItem ? (
                          <span className="flex items-center gap-2 text-white">{renderTile(selectedItem)} {selectedItem.name}</span>
                        ) : <span className="text-gray-400">Select a platform</span>}
                        <ArrowDown01Icon size={16} color="#9ca3af"/>
                      </button>
                      {platformOpen && (
                        <div className="absolute left-0 right-0 mt-1.5 rounded-xl overflow-hidden z-20 max-h-[260px] overflow-y-auto" style={{ background:"var(--sb-mcard)", border:`1px solid ${MBD}`, boxShadow:"0 16px 40px rgba(0,0,0,0.6)" }}>
                          {filterCat.items.map(item => (
                            <button key={item.name} type="button" onClick={()=>{ setAcc({...acc,platform:item.name}); setPlatformOpen(false); }}
                              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left text-white text-[14px] transition-colors hover:bg-white/5">
                              {renderTile(item)} {item.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </MField>
                );
              })()}
              <MField label="Quantity available">
                <input value={acc.quantity} onChange={e=>setAcc({...acc,quantity:e.target.value.replace(/[^0-9]/g,"")})} placeholder="1" inputMode="numeric" className={M_INPUT} style={mInputStyle}/>
              </MField>
              <MField label="Description" hint="Describe the account condition, region, and any details buyers should know.">
                <textarea value={acc.description} onChange={e=>setAcc({...acc,description:e.target.value})} rows={4} placeholder="Add a detailed description…" className={M_INPUT} style={{...mInputStyle, resize:"vertical"}}/>
              </MField>

              <div className="flex items-center justify-between gap-3 mt-8">
                <button onClick={()=> paid ? setPage("ads") : goStep(0)} className="flex items-center gap-1.5 px-6 py-3 rounded-full font-bold text-[14px] text-gray-300 transition-all hover:text-white" style={{ border:`1px solid ${MBD}` }}>
                  <ArrowLeft01Icon size={16}/> Back
                </button>
                <button onClick={gotoCredentials} disabled={!acc.title||!acc.price} className="flex items-center gap-1.5 px-8 py-3 rounded-full font-bold text-[14px] text-white transition-all hover:opacity-90 active:scale-95 disabled:opacity-40" style={{ background:P }}>
                  Continue <ArrowRight01Icon size={16} color="#fff"/>
                </button>
              </div>
            </div>
          )}

          {/* ══ STEP 2 — CREDENTIALS (one set per quantity) ══ */}
          {step === 2 && (
            <div className="max-w-[560px] mx-auto">
              <h2 className="text-white text-center mb-2" style={{ fontSize:24, fontWeight:800 }}>Account Credentials</h2>
              <p className="text-gray-400 text-[13px] text-center mb-6">
                You're listing <span className="font-bold" style={{ color:P }}>{qty}</span> {qty>1?"accounts":"account"}. Add credentials for {qty>1?"each one":"it"} below — securely stored and only released to the buyer after purchase.
              </p>

              <div className="flex flex-col gap-5">
                {creds.map((c, i) => (
                  <div key={i} className="rounded-2xl p-5" style={{ background:MCARD2, border:`1px solid ${MBD}` }}>
                    {/* Card header */}
                    <div className="flex items-center gap-2.5 mb-4 pb-3 border-b" style={{ borderColor:MBD }}>
                      <span className="w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-extrabold text-white shrink-0" style={{ background:P }}>{i+1}</span>
                      <span className="text-white font-bold text-[14px]">Account #{i+1}</span>
                    </div>

                    <MField label="Account Preview Link" hint="A public link buyers can open to preview this account before purchasing.">
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500">
                          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.5 1.5"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.5-1.5"/></svg>
                        </span>
                        <input value={c.previewLink} onChange={e=>updateCred(i,{previewLink:e.target.value})} placeholder="https://…" className={M_INPUT} style={{...mInputStyle, paddingLeft:40, background:MBG}}/>
                      </div>
                    </MField>

                    <MField label="Login / Username">
                      <input value={c.login} onChange={e=>updateCred(i,{login:e.target.value})} placeholder="Username or phone number" className={M_INPUT} style={{...mInputStyle, background:MBG}}/>
                    </MField>
                    <MField label="Password">
                      <div className="relative">
                        <input type={showPass[i]?"text":"password"} value={c.password} onChange={e=>updateCred(i,{password:e.target.value})} placeholder="••••••••" className={M_INPUT} style={{...mInputStyle, background:MBG, paddingRight:44}}/>
                        <button type="button" onClick={()=>setShowPass(s=>({...s,[i]:!s[i]}))} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white">
                          {showPass[i] ? <ViewOffIcon size={18}/> : <ViewIcon size={18}/>}
                        </button>
                      </div>
                    </MField>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <MField label="Linked Email">
                        <input value={c.email} onChange={e=>updateCred(i,{email:e.target.value})} placeholder="email@example.com" className={M_INPUT} style={{...mInputStyle, background:MBG}}/>
                      </MField>
                      <MField label="Email Password">
                        <input value={c.emailPass} onChange={e=>updateCred(i,{emailPass:e.target.value})} placeholder="••••••••" className={M_INPUT} style={{...mInputStyle, background:MBG}}/>
                      </MField>
                    </div>
                    <MField label="Additional Notes" hint="Optional — recovery codes, 2FA info, or handover instructions.">
                      <textarea value={c.notes} onChange={e=>updateCred(i,{notes:e.target.value})} rows={2} placeholder="Any extra credentials or instructions…" className={M_INPUT} style={{...mInputStyle, background:MBG, resize:"vertical"}}/>
                    </MField>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2 px-4 py-3 rounded-xl mt-5" style={{ background:"rgba(22,163,74,0.08)", border:"1px solid rgba(22,163,74,0.2)" }}>
                <LockIcon size={16} color="#4ade80"/>
                <span className="text-[12px] text-green-400">All credentials are encrypted end-to-end.</span>
              </div>

              <div className="flex items-center justify-between gap-3 mt-8">
                <button onClick={()=>goStep(1)} className="flex items-center gap-1.5 px-6 py-3 rounded-full font-bold text-[14px] text-gray-300 transition-all hover:text-white" style={{ border:`1px solid ${MBD}` }}>
                  <ArrowLeft01Icon size={16}/> Back
                </button>
                <button onClick={()=>goStep(3)} disabled={!credsComplete} className="flex items-center gap-1.5 px-8 py-3 rounded-full font-bold text-[14px] text-white transition-all hover:opacity-90 active:scale-95 disabled:opacity-40" style={{ background:P }}>
                  Preview <ArrowRight01Icon size={16} color="#fff"/>
                </button>
              </div>
            </div>
          )}

          {/* ══ STEP 3 — REVIEW ══ */}
          {step === 3 && (
            <div className="max-w-[620px] mx-auto">
              <h2 className="text-white text-center mb-2" style={{ fontSize:24, fontWeight:800 }}>Review Your Listing</h2>
              <p className="text-gray-400 text-[13px] text-center mb-8">Confirm everything looks right before submitting.</p>

              {/* Listing preview card */}
              <div className="rounded-2xl p-5 mb-5" style={{ background: MCARD2, border:`1px solid ${MBD}` }}>
                <div className="flex items-start gap-3.5 mb-4">
                  {(() => {
                    const fc = FILTER_CATEGORIES.find(f => f.name === CATEGORY_TO_FILTER[acc.category]);
                    const pItem = fc?.items.find(i => i.name === acc.platform);
                    const brand: BrandKey = pItem?.brand ?? (acc.category==="vpn"?"vpn":acc.category==="gaming"?"steam":acc.category==="giftcards"?"giftcard":acc.category==="subscriptions"?"netflix":"whatsapp");
                    return <BrandIcon brand={brand} size={52}/>;
                  })()}
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-bold text-[16px] leading-snug">{acc.title || "Untitled listing"}</p>
                    <p className="text-gray-400 text-[12px] mt-1">{CATEGORIES.find(c=>c.id===acc.category)?.label}{acc.platform && ` • ${acc.platform}`} • {acc.quantity||"1"} available</p>
                  </div>
                  <span className="text-white font-extrabold text-[18px]">${acc.price||"0.00"}</span>
                </div>
                {acc.description && <p className="text-gray-400 text-[13px] leading-relaxed border-t pt-3" style={{ borderColor:MBD }}>{acc.description}</p>}
              </div>

              {/* Summary rows */}
              <ReviewRow label="Payment method" value={method==="bank"?"Bank / Card Payment":method==="crypto"?(selectedCrypto?selectedCrypto.name:"Crypto Deposit"):"SimBazaar Wallet"}/>
              <ReviewRow label="Registration fee" value={method==="bank"?`₦ ${MERCHANT_FEE_NGN.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`:`$${MERCHANT_FEE_USD.toFixed(2)}`}/>
              <ReviewRow label="Platform" value={acc.platform||"—"}/>
              <ReviewRow label="Accounts included" value={`${qty} ${qty>1?"accounts":"account"}`}/>

              {/* Per-account credential summary */}
              <p className="text-white font-bold text-[14px] mt-6 mb-3">Credentials ({qty})</p>
              <div className="flex flex-col gap-3">
                {creds.map((c, i) => (
                  <div key={i} className="rounded-xl p-4" style={{ background:MCARD2, border:`1px solid ${MBD}` }}>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-extrabold text-white shrink-0" style={{ background:P }}>{i+1}</span>
                      <span className="text-white font-bold text-[13px]">Account #{i+1}</span>
                    </div>
                    <div className="flex items-center justify-between py-1.5">
                      <span className="text-gray-400 text-[12px]">Preview link</span>
                      {c.previewLink
                        ? <a href={c.previewLink} target="_blank" rel="noopener noreferrer" className="text-[12px] font-semibold text-right max-w-[62%] truncate hover:underline" style={{ color:P }}>{c.previewLink}</a>
                        : <span className="text-white text-[12px] font-semibold">—</span>}
                    </div>
                    <div className="flex items-center justify-between py-1.5">
                      <span className="text-gray-400 text-[12px]">Login</span>
                      <span className="text-white text-[12px] font-semibold text-right max-w-[62%] truncate">{c.login}</span>
                    </div>
                    <div className="flex items-center justify-between py-1.5">
                      <span className="text-gray-400 text-[12px]">Password</span>
                      <span className="text-white text-[12px] font-semibold">{"•".repeat(Math.max(c.password.length,6))}</span>
                    </div>
                    <div className="flex items-center justify-between py-1.5">
                      <span className="text-gray-400 text-[12px]">Linked email</span>
                      <span className="text-white text-[12px] font-semibold text-right max-w-[62%] truncate">{c.email||"—"}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between gap-3 mt-8">
                <button onClick={()=>goStep(2)} className="flex items-center gap-1.5 px-6 py-3 rounded-full font-bold text-[14px] text-gray-300 transition-all hover:text-white" style={{ border:`1px solid ${MBD}` }}>
                  <ArrowLeft01Icon size={16}/> Back
                </button>
                <button onClick={submitListing} disabled={publishing} className="flex items-center gap-1.5 px-8 py-3 rounded-full font-bold text-[14px] text-white transition-all hover:opacity-90 active:scale-95 disabled:opacity-70" style={{ background:P, boxShadow:"none" }}>
                  {publishing ? <><Spinner size={16}/> Submitting…</> : <>Submit listing <CheckmarkCircle01Icon size={16} color="#fff"/></>}
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

function CoinDot({ color, glyph }: { color:string; glyph:string }) {
  return <span className="inline-flex items-center justify-center rounded-full text-white shrink-0" style={{ width:22, height:22, background:color, fontSize:12, fontWeight:800 }}>{glyph}</span>;
}
function ReviewRow({ label, value }: { label:string; value:string }) {
  return (
    <div className="flex items-center justify-between py-3 border-b" style={{ borderColor:MBD }}>
      <span className="text-gray-400 text-[13px]">{label}</span>
      <span className="text-white text-[13px] font-semibold text-right max-w-[60%] truncate">{value}</span>
    </div>
  );
}
// ═══════════════════════════════════════════════════════════════════════════════
// MY ADS — seller's listed products + status tracking
// ═══════════════════════════════════════════════════════════════════════════════
type AdStatus = "active" | "pending" | "denied" | "removed";
interface AdListing {
  id: number;
  title: string;
  category: string;
  platform: string;
  price: number;
  quantity: number;
  status: AdStatus;
  brand: BrandKey;
  description?: string;
}

const SEED_ADS: AdListing[] = [
  { id:101, title:"USA Verified WhatsApp Number",  category:"social",        platform:"Whatsapp",  price:3.90, quantity:5, status:"active",  brand:"whatsapp" },
  { id:102, title:"HIGH QUALITY INSTAGRAM ACCOUNT", category:"social",        platform:"Instagram", price:5.00, quantity:2, status:"active",  brand:"instagram" },
  { id:103, title:"1 Month Premium Netflix Shared", category:"subscriptions", platform:"Netflix",   price:3.99, quantity:8, status:"pending", brand:"netflix" },
  { id:104, title:"Valid USA Telegram Number",      category:"numbers",       platform:"Telegram",  price:3.99, quantity:3, status:"pending", brand:"telegram" },
  { id:105, title:"1 Year Active PIA VPN",          category:"vpn",           platform:"Pia",       price:2.98, quantity:1, status:"denied",  brand:"pia" },
  { id:106, title:"Steam Gift Card $5",             category:"giftcards",     platform:"Steam",     price:4.20, quantity:0, status:"removed", brand:"steam" },
];

const AD_STATUS_META: Record<AdStatus, { label:string; color:string; bg:string; dot:string }> = {
  active:  { label:"Active",  color:"#4ade80", bg:"rgba(22,163,74,0.14)",  dot:"#22c55e" },
  pending: { label:"Pending", color:"#fbbf24", bg:"rgba(245,158,11,0.14)", dot:"#f59e0b" },
  denied:  { label:"Denied",  color:"#f87171", bg:"rgba(239,68,68,0.14)",  dot:"#ef4444" },
  removed: { label:"Removed", color:"#9ca3af", bg:"rgba(255,255,255,0.06)",dot:"#6b7280" },
};

const AD_TABS: { key:AdStatus|"all"; label:string }[] = [
  { key:"all",     label:"All" },
  { key:"active",  label:"Active" },
  { key:"pending", label:"Pending" },
  { key:"denied",  label:"Denied" },
  { key:"removed", label:"Removed" },
];

// Megaphone empty-state illustration — shared with the My Purchase / My Orders
// empty states so every empty screen uses the exact same artwork.
function AdsMegaphone() {
  return <div className="mb-6"><EmptyMegaphone/></div>;
}

type StockCred = { login:string; password:string; email:string; emailPass:string; previewLink:string; notes:string };
const blankStockCred = (): StockCred => ({ login:"", password:"", email:"", emailPass:"", previewLink:"", notes:"" });

function AdCard({ ad, onChanged }: { ad:AdListing; onChanged:()=>void }) {
  const s = AD_STATUS_META[ad.status];
  const [menuOpen, setMenuOpen] = useState(false);
  const [mode, setMode] = useState<"none"|"stock"|"delete">("none");
  const [creds, setCreds] = useState<StockCred[]>([blankStockCred()]);
  const [busy, setBusy] = useState(false);
  useScrollLock(mode !== "none");
  const outOfStock = ad.quantity <= 0;
  const lowStock = ad.quantity > 0 && ad.quantity <= 3;

  const updateCred = (i:number, patch:Partial<StockCred>) => setCreds(prev => prev.map((c,idx)=> idx===i ? {...c, ...patch} : c));
  const submitStock = async () => {
    const clean = creds.map(c => ({ login:c.login.trim(), password:c.password.trim(), email:c.email.trim(), emailPass:c.emailPass.trim(), previewLink:c.previewLink.trim(), notes:c.notes.trim() }));
    if (clean.some(c => !c.login || !c.password)) { toast.error("Each account needs a login/username and a password.", { title: "Add stock" }); return; }
    setBusy(true);
    const r = await addAdStock(ad.id, clean);
    setBusy(false);
    if (!r.ok) { toast.error(r.error ?? "Could not add stock.", { title: "Add stock" }); return; }
    toast.success(`Added ${clean.length} account${clean.length>1?"s":""} to "${ad.title}".`, { title: "Stock updated" });
    setMode("none"); setCreds([blankStockCred()]); onChanged();
  };
  const submitDelete = async () => {
    setBusy(true);
    const r = await deleteAd(ad.id);
    setBusy(false);
    if (!r.ok) { toast.error(r.error ?? "Could not delete ad.", { title: "Delete ad" }); return; }
    toast.success("Ad deleted.", { title: "Deleted" });
    setMode("none"); onChanged();
  };

  return (
    <div className="relative rounded-2xl p-4 flex items-center gap-3.5 transition-all hover:border-white/20" style={{ background:MCARD, border:`1px solid ${MBD}` }}>
      <BrandIcon brand={ad.brand} size={52}/>
      <div className="flex-1 min-w-0">
        <p className="text-white font-bold text-[14px] leading-snug line-clamp-1">{ad.title}</p>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1.5">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold" style={{ background:s.bg, color:s.color }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background:s.dot }}/> {s.label}
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold"
            style={ outOfStock ? { background:"rgba(239,68,68,0.14)", color:"#f87171" } : lowStock ? { background:"rgba(245,158,11,0.14)", color:"#fbbf24" } : { background:"rgba(255,255,255,0.06)", color:"#9ca3af" } }>
            {outOfStock ? "Out of stock" : `${ad.quantity} in stock`}
          </span>
          <span className="text-[11px] text-gray-500">{ad.platform || ad.category}</span>
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className="text-white font-extrabold text-[16px]" style={{ fontVariantNumeric:"tabular-nums" }}>${ad.price.toFixed(2)}</span>
        <button onClick={()=>setMenuOpen(v=>!v)} aria-label="Ad options" className="grid h-8 w-8 place-items-center text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-white/[0.06]">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="19" r="1.6"/></svg>
        </button>
      </div>

      {/* Three-dots dropdown */}
      {menuOpen && (
        <>
          <button aria-label="Close menu" className="fixed inset-0 z-[70] cursor-default" onClick={()=>setMenuOpen(false)}/>
          <div className="absolute right-3 top-12 z-[80] w-44 overflow-hidden rounded-xl py-1 shadow-[0_16px_40px_rgba(0,0,0,.4)]" style={{ background:"var(--sb-mcard)", border:`1px solid ${MBD}` }}>
            <button onClick={()=>{ setMenuOpen(false); setMode("stock"); setCreds([blankStockCred()]); }} className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-[13px] font-semibold text-white transition hover:bg-white/[0.06]">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={P} strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>Add stock
            </button>
            <button onClick={()=>{ setMenuOpen(false); setMode("delete"); }} className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-[13px] font-semibold text-[#f87171] transition hover:bg-white/[0.06]">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg>Delete permanently
            </button>
          </div>
        </>
      )}

      {/* Add-stock / delete modal (centered, portalled to escape any transformed ancestor) */}
      {mode !== "none" && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-5" style={{ background:"rgba(0,0,0,0.55)", backdropFilter:"blur(2px)" }} onClick={()=>!busy && setMode("none")}>
          <div className={`${mode === "stock" ? "w-[440px]" : "w-[360px]"} flex max-h-[88vh] max-w-full flex-col rounded-2xl`} style={{ background:"var(--sb-mcard)", border:`1px solid ${MBD}`, fontFamily:FONT, animation:"sbPopIn .25s cubic-bezier(.2,.9,.3,1.1) both" }} onClick={(e)=>e.stopPropagation()}>
            {mode === "stock" ? (
              <>
                <div className="px-5 pt-5">
                  <h3 className="text-[17px] font-extrabold text-white">Add stock — account details</h3>
                  <p className="mt-1 text-[13px] text-gray-400">Each account you add is one unit of stock, auto-delivered to the buyer. <span className="text-gray-300">{ad.quantity} in stock now.</span></p>
                </div>
                <div className="mt-3 flex-1 space-y-3 overflow-y-auto px-5" style={{ scrollbarWidth:"thin" }}>
                  {creds.map((c, i) => (
                    <div key={i} className="rounded-2xl p-3.5" style={{ background:MBG, border:`1px solid ${MBD}` }}>
                      <div className="mb-2.5 flex items-center justify-between">
                        <span className="text-[12px] font-bold uppercase tracking-wider" style={{ color:P }}>Account {i+1}</span>
                        {creds.length > 1 && <button onClick={()=>setCreds(prev => prev.filter((_,idx)=>idx!==i))} className="text-[11px] font-bold text-[#f87171] hover:opacity-80">Remove</button>}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input value={c.login} onChange={e=>updateCred(i,{login:e.target.value})} placeholder="Login / username *" className="h-10 rounded-lg px-3 text-[13px] text-white outline-none placeholder:text-gray-500" style={{ background:"var(--sb-fill)", border:`1px solid ${MBD}` }}/>
                        <input value={c.password} onChange={e=>updateCred(i,{password:e.target.value})} placeholder="Password *" className="h-10 rounded-lg px-3 text-[13px] text-white outline-none placeholder:text-gray-500" style={{ background:"var(--sb-fill)", border:`1px solid ${MBD}` }}/>
                        <input value={c.email} onChange={e=>updateCred(i,{email:e.target.value})} placeholder="Email (optional)" className="h-10 rounded-lg px-3 text-[13px] text-white outline-none placeholder:text-gray-500" style={{ background:"var(--sb-fill)", border:`1px solid ${MBD}` }}/>
                        <input value={c.emailPass} onChange={e=>updateCred(i,{emailPass:e.target.value})} placeholder="Email password (optional)" className="h-10 rounded-lg px-3 text-[13px] text-white outline-none placeholder:text-gray-500" style={{ background:"var(--sb-fill)", border:`1px solid ${MBD}` }}/>
                        <input value={c.previewLink} onChange={e=>updateCred(i,{previewLink:e.target.value})} placeholder="Preview link (optional)" className="col-span-2 h-10 rounded-lg px-3 text-[13px] text-white outline-none placeholder:text-gray-500" style={{ background:"var(--sb-fill)", border:`1px solid ${MBD}` }}/>
                        <input value={c.notes} onChange={e=>updateCred(i,{notes:e.target.value})} placeholder="Notes / instructions (optional)" className="col-span-2 h-10 rounded-lg px-3 text-[13px] text-white outline-none placeholder:text-gray-500" style={{ background:"var(--sb-fill)", border:`1px solid ${MBD}` }}/>
                      </div>
                    </div>
                  ))}
                  <button onClick={()=>setCreds(prev => [...prev, blankStockCred()])} className="flex w-full items-center justify-center gap-1.5 rounded-2xl py-2.5 text-[13px] font-bold transition hover:bg-white/[0.04]" style={{ border:`1px dashed ${MBD}`, color:P }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={P} strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>Add another account
                  </button>
                </div>
                <div className="flex gap-3 p-5 pt-4">
                  <button onClick={()=>setMode("none")} disabled={busy} className="flex-1 h-11 rounded-full text-[14px] font-bold text-white transition hover:bg-white/[0.06]" style={{ border:`1px solid ${MBD}` }}>Cancel</button>
                  <button onClick={submitStock} disabled={busy} className="flex-1 h-11 rounded-full text-[14px] font-bold text-white transition hover:opacity-90 disabled:opacity-70 inline-flex items-center justify-center gap-2" style={{ background:P }}>{busy && <Spinner size={16}/>}Add {creds.length} to stock</button>
                </div>
              </>
            ) : (
              <div className="p-5">
                <h3 className="text-[17px] font-extrabold text-white">Delete this ad?</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-gray-400">&ldquo;{ad.title}&rdquo; will be permanently removed from the marketplace and your storefront. This cannot be undone.</p>
                <div className="mt-5 flex gap-3">
                  <button onClick={()=>setMode("none")} disabled={busy} className="flex-1 h-11 rounded-full text-[14px] font-bold text-white transition hover:bg-white/[0.06]" style={{ border:`1px solid ${MBD}` }}>Cancel</button>
                  <button onClick={submitDelete} disabled={busy} className="flex-1 h-11 rounded-full text-[14px] font-bold text-white transition hover:opacity-90 disabled:opacity-70 inline-flex items-center justify-center gap-2" style={{ background:"#dc2626" }}>{busy && <Spinner size={16}/>}Delete</button>
                </div>
              </div>
            )}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

function MyAdsPage({ setPage, ads, seller, loaded, onChanged }: { setPage:(p:Page)=>void; ads:AdListing[]; seller:boolean; loaded?:boolean; onChanged:()=>void }) {
  if (!seller) {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: MBG, fontFamily: FONT }}>
        <DesktopTopNav setPage={setPage} active="ads"/>
        <AppMobileHeader className="md:hidden" setPage={setPage}/>
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <span className="w-16 h-16 rounded-full flex items-center justify-center mb-5" style={{ background: "rgba(240,78,35,0.12)" }}>
            <Store01Icon size={30} color={P}/>
          </span>
          <h1 className="text-[22px] font-extrabold text-white mb-2">Sellers only</h1>
          <p className="text-[14px] max-w-sm leading-relaxed mb-6" style={{ color: "var(--sb-chip-text)" }}>
            Ads are available to verified sellers. Complete the one-time merchant registration to start listing your accounts.
          </p>
          <button onClick={() => setPage("merchant")} className="px-8 py-3 rounded-full font-bold text-[14px] text-white transition-all hover:opacity-90 active:scale-95" style={{ background: P }}>
            Become a Merchant
          </button>
        </div>
      </div>
    );
  }
  return <MyAdsPageInner setPage={setPage} ads={ads} loaded={loaded !== false} onChanged={onChanged}/>;
}

function MyAdsPageInner({ setPage, ads, loaded, onChanged }: { setPage:(p:Page)=>void; ads:AdListing[]; loaded:boolean; onChanged:()=>void }) {
  const [tab, setTab] = useState<AdStatus|"all">("all");
  const filtered = tab === "all" ? ads : ads.filter(a => a.status === tab);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: MBG, fontFamily: FONT }}>
      <DesktopTopNav setPage={setPage} active="ads"/>
      <AppMobileHeader className="md:hidden" setPage={setPage}/>

      {/* Header */}
      <div className="px-5 md:px-10 pt-7 md:pt-10 pb-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-white" style={{ fontSize:34, fontWeight:800, letterSpacing:"-0.02em" }}>My Ads</h1>
          <p className="text-gray-400 text-[14px] mt-1">All of your product ads shows here</p>
        </div>
        <button onClick={()=>setPage("merchant")} title="Add product"
          className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 text-white transition-all hover:opacity-90 active:scale-95" style={{ background:P }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
        </button>
      </div>

      {/* Panel */}
      <div className="px-5 md:px-10 pb-10 flex-1">
        <div className="rounded-[26px] overflow-hidden" style={{ background:MCARD, border:`1px solid ${MBD}`, minHeight:520 }}>
          {/* Tabs — horizontally scrollable so all 5 filters are reachable on any width */}
          <div className="flex items-stretch overflow-x-auto" style={{ borderBottom:`1px solid ${MBD}`, scrollbarWidth:"none", WebkitOverflowScrolling:"touch" }}>
            {AD_TABS.map(t => {
              const active = tab === t.key;
              const count = t.key === "all" ? ads.length : ads.filter(a=>a.status===t.key).length;
              return (
                <button key={t.key} onClick={()=>setTab(t.key)}
                  className="relative flex shrink-0 items-center justify-center gap-1.5 px-6 py-4 text-[14px] font-semibold whitespace-nowrap transition-colors"
                  style={{ color: active ? P : "#9ca3af" }}>
                  {t.label}{count>0 && <span className="text-[11px]" style={{ color: active ? P : "#6b7280" }}>({count})</span>}
                  {active && <span className="absolute left-1/2 -translate-x-1/2 bottom-0 h-[2.5px] rounded-full" style={{ background:P, width:"70%" }}/>}
                </button>
              );
            })}
          </div>

          {/* Body */}
          {!loaded ? (
            <div className="p-4 md:p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-2xl p-4 flex items-center gap-3.5" style={{ background:MCARD, border:`1px solid ${MBD}` }}>
                  <Skeleton className="h-[52px] w-[52px]" rounded="rounded-xl"/>
                  <div className="flex-1 space-y-2"><Skeleton className="h-3.5 w-4/5"/><Skeleton className="h-3 w-2/5"/><Skeleton className="h-5 w-20" rounded="rounded-full"/></div>
                  <Skeleton className="h-4 w-14"/>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center px-6 py-20">
              <AdsMegaphone/>
              <h2 className="text-white mb-2" style={{ fontSize:24, fontWeight:800 }}>No Ads</h2>
              <p className="text-gray-400 text-[14px] mb-7">Add products for customers to buy from you</p>
              <button onClick={()=>setPage("merchant")} className="px-9 py-3.5 rounded-full font-bold text-[15px] text-white transition-all hover:opacity-90 active:scale-95" style={{ background:P, boxShadow:"none" }}>
                Start selling
              </button>
            </div>
          ) : (
            <div className="p-4 md:p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              {filtered.map(ad => <AdCard key={ad.id} ad={ad} onChanged={onChanged}/>)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* Pending marketplace view — lets the bottom nav open the Products page
   (listings view) from anywhere, and lets /products deep-links restore it. */
let _marketIntent: { view: MktView; category?: string } | null = null;
export function setMarketIntent(i: { view: MktView; category?: string } | null) { _marketIntent = i; }
function consumeMarketIntent() { const i = _marketIntent; _marketIntent = null; return i; }

/* ── Auth gating: which pages a signed-out visitor may open. Everything else
   redirects to the login page and returns them there after signing in. ────── */
const PUBLIC_PAGES: ReadonlySet<Page> = new Set<Page>(["home", "login", "signup", "marketplace", "merchants", "store", "become-merchant"]);
let _postLoginPage: Page | null = null;
export function setPostLoginPage(p: Page | null) { _postLoginPage = p; }
function finishAuth(setPage: (p: Page) => void, dest?: Page) {
  try { sessionStorage.clear(); } catch { /* ignore */ }
  setAuthedState(true);
  clearProfileCache();
  refreshProfile(); // load the just-signed-in account's real identity everywhere
  const target = dest ?? _postLoginPage ?? "marketplace";
  _postLoginPage = null;
  setPage(target);
}

/* ── URL routing: every page has a real path so reloads and the browser
   back/forward buttons keep the user where they were. ─────────────────── */
const PAGE_PATHS: Record<Page, string> = {
  home: "/", login: "/auth/sign-in", signup: "/auth/sign-up",
  "signup-success": "/auth/sign-up-success", marketplace: "/marketplace",
  wallet: "/wallet", "user-profile": "/profile", cart: "/cart",
  notifications: "/notifications", support: "/support", merchant: "/account/sell-your-account",
  "become-merchant": "/become-a-merchant",
  ads: "/seller/ads", purchase: "/my-purchase", order: "/order-details",
  referral: "/referral", settings: "/settings", merchants: "/top-merchants",
  store: "/store", admin: "/admin",
};
// Signed-in pages that show the persistent bottom tab bar (mobile). Excludes
// the marketplace (renders its own), the public/auth pages, the order chat
// (has its own bottom composer) and the merchant onboarding wizard.
const BOTTOM_NAV_PAGES: ReadonlySet<Page> = new Set<Page>([
  "wallet", "purchase", "ads", "cart", "notifications", "user-profile",
  "support", "referral", "settings", "merchants", "store",
]);

const pathToPage = (path: string): Page => {
  // Legacy auth links keep working
  if (path === "/login") return "login";
  if (path === "/signup") return "signup";
  if (path === "/account/wallet" || path === "/seller/wallet") return "wallet";
  if (path === "/account/settings" || path === "/seller/settings" || path === "/settings") return "settings";
  if (path === "/account/profile" || path === "/seller/profile" || path === "/profile") return "user-profile";
  if (path === "/seller/my-orders") return "purchase";
  if (path === "/seller/ads" || path === "/ads") return "ads"; // /ads kept as a legacy alias
  if (path.startsWith("/order-details") || path.startsWith("/seller/order-details")) return "order";
  if (path.startsWith("/seller/")) {
    // Your own merchant link opens your profile; other ids open their storefront
    const key = decodeURIComponent(path.split("/")[2] ?? "");
    const cached = readCache<{ merchant_id?: string }>("sb-profile");
    if (key && cached?.merchant_id && key === cached.merchant_id) return "user-profile";
    return "store";
  }
  if (path === "/products") {
    const tab = new URLSearchParams(window.location.search).get("tab") ?? undefined;
    setMarketIntent({ view: "listings", category: tab });
    return "marketplace";
  }
  const found = (Object.entries(PAGE_PATHS) as [Page, string][]).find(([, p]) => p === path);
  return found ? found[0] : "home";
};

export default function App() {
  const [page,setPageState]=useState<Page>(() => {
    try {
      // Every real page owns its own URL, so a refresh lands on the right page
      // via the path. The bare root "/" is always the landing page — this is the
      // marketing entry point that every visitor should see there.
      if (window.location.pathname !== "/") return pathToPage(window.location.pathname);
      return "home";
    } catch { return "home"; }
  });
  const setPage = (p: Page) => {
    setPageState(p);
    try {
      // The profile page owns a role-based URL — push it directly so the profile
      // icon never lands the user on the generic /profile.
      let url: string = PAGE_PATHS[p];
      if (p === "user-profile") {
        const prof = readCache<{ is_seller?: boolean }>("sb-profile");
        url = prof?.is_seller ? "/seller/profile" : "/account/profile";
      }
      window.history.pushState({ page: p }, "", url);
      window.scrollTo(0, 0);
    } catch { /* ignore */ }
  };
  useEffect(() => {
    const onPop = () => setPageState(pathToPage(window.location.pathname));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  // Remember the current page and keep the URL in sync (covers restored pages)
  useEffect(() => {
    try {
      window.localStorage.setItem("sb-page", page);
      // The marketplace, storefronts and wallet own their own URLs
      if (page !== "marketplace" && page !== "store" && page !== "wallet" && page !== "purchase" && page !== "order" && page !== "user-profile" && page !== "settings" && window.location.pathname !== PAGE_PATHS[page]) {
        window.history.replaceState({ page }, "", PAGE_PATHS[page]);
      }
    } catch { /* ignore */ }
  }, [page]);
  // Auth gate — signed-out visitors only reach the public pages; any protected
  // page redirects to login and returns them there after they sign in.
  const authed = useAuthed();
  useEffect(() => {
    if (authed === false && !PUBLIC_PAGES.has(page)) {
      _postLoginPage = page;
      setPageState("login");
      try { window.history.replaceState({ page: "login" }, "", PAGE_PATHS.login); } catch { /* ignore */ }
    }
  }, [authed, page]);
  // Shared merchant state — persists whether the seller has paid the one-time fee
  const appProfile = useProfile();
  // Seed from the cached profile so a returning seller is treated as paid on the
  // very first render (no flash of the payment step), then keep it in sync.
  const [merchantPaid, setMerchantPaid] = useState<boolean>(() => Boolean(appProfile.is_seller));
  useEffect(() => { if (appProfile.is_seller) setMerchantPaid(true); }, [appProfile.is_seller]);
  // Real seller activation — charges the merchant fee from the wallet on the
  // server. Only flips to seller when the server confirms; surfaces the error
  // (e.g. insufficient funds) otherwise. Never grants access for free.
  const confirmSellerPayment = async (): Promise<ActivateResult> => {
    const result = await activateSeller();
    if (result.ok) {
      setMerchantPaid(true);
      await refreshProfile(); // pull the now-verified is_seller so the UI updates at once
    }
    return result;
  };
  // A seller's own live ads — no demo seed. New sellers see a real empty state.
  const [myAds, setMyAds] = useState<AdListing[]>(() => readCache<AdListing[]>("sb-ads") ?? []);
  const { loaded: myAdsLoaded, finishLoading: finishAds } = useLoadGate(600);
  // Re-fetch the seller's live ads — called on mount and after any add-stock /
  // delete mutation so the My Ads list always reflects the real database.
  const loadAds = () => fetchAds().then((rows) => {
    if (rows) {
      const mapped: AdListing[] = rows.map((r) => ({
        id: r.id,
        title: r.title,
        category: r.category,
        platform: r.brand.charAt(0).toUpperCase() + r.brand.slice(1),
        price: Number(r.price) || 0,
        quantity: r.quantity,
        status: (["active","pending","denied","removed"].includes(r.status) ? r.status : "pending") as AdStatus,
        brand: (r.brand in BRAND_LOGOS ? r.brand : "vpn") as BrandKey,
        description: (r as { description?: string }).description ?? "",
      }));
      writeCache("sb-ads", mapped);
      setMyAds(mapped);
    }
  });
  useEffect(() => {
    let cancelled = false;
    loadAds().then(() => { if (!cancelled) finishAds(); }).catch(() => { if (!cancelled) finishAds(); });
    return () => { cancelled = true; };
  }, []);
  const addAd = (ad:AdListing) => {
    setMyAds(prev => { const next = [ad, ...prev]; writeCache("sb-ads", next); return next; });
    createAd({ title: ad.title, brand: ad.brand, category: ad.category, price: ad.price, quantity: ad.quantity, description: ad.description ?? "" });
  };
  // App-wide theme — persisted, applied via the `theme-light` class on <html>
  const [dark, setDark] = useState(() => {
    try { return window.localStorage.getItem("sb-theme") !== "light"; } catch { return true; }
  });
  useEffect(() => {
    document.documentElement.classList.toggle("theme-light", !dark);
    try { window.localStorage.setItem("sb-theme", dark ? "dark" : "light"); } catch {}
  }, [dark]);
  if (!PUBLIC_PAGES.has(page) && authed !== true) {
    return (
      <ThemeContext.Provider value={{ dark, toggle: () => setDark(v => !v) }}>
        <div className="min-h-screen grid place-items-center" style={{ background: "var(--sb-mbg)", fontFamily: FONT }}>
          <span className="h-8 w-8 animate-spin rounded-full border-2 border-white/15" style={{ borderTopColor: P }}/>
        </div>
      </ThemeContext.Provider>
    );
  }
  return (
    <ThemeContext.Provider value={{ dark, toggle: () => setDark(v => !v) }}>
    <ToastHost/>
    <div className="min-h-screen" style={{background:BG,fontFamily:FONT}}>
      {page==="home"          && <HomePage         setPage={setPage}/>}
      {page==="login"         && <LoginPage         setPage={setPage}/>}
      {page==="signup"        && <SignupPage        setPage={setPage}/>}
      {page==="signup-success" && <SignupSuccessPage setPage={setPage}/>}
      {page==="marketplace"   && <MarketplacePage   setPage={setPage}/>}
      {page==="wallet"        && <WalletPage        setPage={setPage}/>}
      {page==="user-profile"  && <ProfilePage       setPage={setPage}/> }
      {page==="settings"      && <AccountSettingsPage setPage={setPage}/>}
      {page==="cart"          && <CartPage          setPage={setPage}/>}
      {page==="notifications" && <NotificationsPage setPage={setPage}/>}
      {page==="support"       && <SupportCenterPage setPage={setPage}/>}
      {page==="purchase"      && <MyPurchasePage    setPage={setPage}/>}
      {page==="order"         && <OrderDetailsPage  setPage={setPage}/>}
      {page==="referral"      && <ReferralPage      setPage={setPage}/>}
      {page==="merchants"     && <TopMerchantsPage  setPage={setPage}/>}
      {page==="store"         && <SellerStorePage   setPage={setPage}/>}
      {page==="admin"         && <AdminPage         setPage={setPage}/>}
      {page==="ads"           && <MyAdsPage         setPage={setPage} ads={myAds} seller={merchantPaid} loaded={myAdsLoaded} onChanged={loadAds}/>}
      {page==="become-merchant" && <BecomeMerchantPage setPage={setPage}/>}
      {page==="merchant"      && <MerchantPage      setPage={setPage} paid={merchantPaid} onPaid={confirmSellerPayment} onSubmit={addAd}/>}
      {/* Persistent bottom tab bar — shown on every signed-in app page for a
          consistent navigation (marketplace renders its own so Home/Market
          reflect its view). Hidden on the landing/auth pages, the order chat
          (its own composer sits at the bottom) and the merchant wizard.
          The active tab always matches the current page — a page that isn't a
          tab root highlights nothing, so no tab looks "stuck" active. */}
      {BOTTOM_NAV_PAGES.has(page) && (
        <div className="md:hidden">
          <div style={{ height:"calc(64px + env(safe-area-inset-bottom,0px))" }}/>
          <BottomTabBar active={page==="wallet" ? "wallet" : page==="ads" ? "ads" : page==="purchase" ? "purchase" : "none"} setPage={setPage}/>
        </div>
      )}
    </div>
    </ThemeContext.Provider>
  );
}
