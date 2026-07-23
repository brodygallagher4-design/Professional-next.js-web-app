"use client";

import { useState, useEffect, useMemo } from "react";
import {
  P, MBG, MCARD, MCARD2, MBD, FONT,
  DesktopTopNav, AppMobileHeader, setCurrentOrder, useProfile, EmptyMegaphone, Spinner, useScrollLock, Skeleton, useOrderCountdown,
} from "../shared";
import type { Page, BrandKey } from "../shared";
import { readCache, writeCache, submitReview } from "../lib/api";
import { usePurchasesQuery } from "../lib/query";
import { toast } from "../toast";

// Safe clipboard copy — falls back to execCommand when the Clipboard API is
// blocked by the iframe permissions policy (never throws).
function safeCopy(text: string) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).catch(() => legacyCopy(text));
      return;
    }
  } catch { /* fall through */ }
  legacyCopy(text);
}
function legacyCopy(text: string) {
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
  } catch { /* ignore */ }
}

export interface Purchase {
  id: string;
  buyer?: string;
  brand: BrandKey;
  glyph: "whatsapp" | "voice" | "facebook";
  title: string;
  desc: string;
  cardSubtitle: string;
  seller: string;
  sellerColor: string;
  price: number;
  time: string;
  status: "completed" | "processing" | "pending" | "cancelled";
  createdAt?: string;
  delivered?: boolean;
  reviewed?: boolean;
  productType: string;
  username: string;
  password: string;
  note: string;
  noteTime: string;
}

/* Bare product glyphs — the brand mark alone, no background tile (per reference) */
function ProductGlyph({ kind, size = 40 }: { kind: Purchase["glyph"]; size?: number }) {
  if (kind === "whatsapp") return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <path fill="#25D366" d="M12 2C6.5 2 2 6.5 2 12c0 1.9.5 3.6 1.4 5.2L2 22l4.9-1.3C8.5 21.5 10.2 22 12 22c5.5 0 10-4.5 10-10S17.5 2 12 2z"/>
      <path fill="#fff" d="M17.3 16.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .3-3.4-.7-2.9-1.2-4.7-4.1-4.8-4.3-.1-.2-1.2-1.6-1.2-3s.7-2.1 1-2.4c.2-.3.5-.3.7-.3h.5c.2 0 .4-.1.7.5.2.6.8 2 .9 2.1.1.1.1.3 0 .5-.1.2-.2.4-.3.5l-.5.5c-.2.2-.3.3-.1.6.2.3.9 1.4 1.9 2.3 1.3 1.1 2.3 1.5 2.6 1.6.3.1.5.1.6-.1.2-.2.7-.9.9-1.2.2-.3.4-.2.6-.1l2 1c.3.1.5.2.5.3.2.2.2.8 0 1.4z"/>
    </svg>);
  if (kind === "voice") return (
    <svg width={size * 0.9} height={size * 0.9} viewBox="0 0 24 24">
      <path fill="#16a34a" d="M6.6 3.2 8.9 5.5c.5.5.6 1.3.2 1.9L7.9 9.2a1.5 1.5 0 0 0 .2 1.9l4.8 4.8c.5.5 1.3.6 1.9.2l1.8-1.2c.6-.4 1.4-.3 1.9.2l2.3 2.3c.6.6.6 1.6 0 2.2l-1.5 1.5c-.8.8-2 1.1-3.1.8-6-1.9-10.8-6.7-12.7-12.7-.3-1.1 0-2.3.8-3.1l1.5-1.5c.6-.6 1.6-.6 2.2 0Z"/>
    </svg>);
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" fill="#1877F2"/>
      <path fill="#fff" d="M13.4 20v-6.2h2.1l.3-2.4h-2.4V9.9c0-.7.2-1.2 1.2-1.2h1.3V6.6c-.2 0-1-.1-1.9-.1-1.9 0-3.1 1.1-3.1 3.2v1.7H8.8v2.4h2.1V20h2.5z"/>
    </svg>);
}

export const PURCHASES: Purchase[] = [
  {
    id: "f94b227e-0e7d-4186-88d2-51493ac30499",
    brand: "whatsapp",
    glyph: "whatsapp",
    title: "Strong USA 🇺🇸 WhatsApp",
    reviewed: true,
    desc: "Strong active usa WhatsApp number for verification code",
    cardSubtitle: "Using active usa WhatsApp number for verification code",
    seller: "Owolabi Adeola",
    sellerColor: "#b91c1c",
    price: 3.0,
    time: "Saturday, October 12th, 10:23 AM",
    status: "completed",
    productType: "WhatsApp",
    username: "+1 747495 75491",
    password: "747495 75491",
    note: "Dm me on WhatsApp for verification +234 907 148 2332",
    noteTime: "Friday, October 8th, 6:52 PM",
  },
  {
    id: "a13c9f22-77bd-4c01-9f4e-2210ba9931aa",
    brand: "gmail",
    glyph: "voice",
    title: "🇺🇸Very Strong 💪 Gmail Google voice account (...",
    desc: "USA is texting 💬, verification and calling 📞 number 100% strong 💖",
    cardSubtitle: "USA is texting, verification and calling 100% strong",
    seller: "Log seller",
    sellerColor: "#6d28d9",
    price: 6.0,
    time: "Tuesday, October 8th, 8:21 AM",
    status: "completed",
    productType: "GoogleVoice",
    username: "tsysiaoashsiaoo@gmail.com",
    password: "Aassdd3344eessd",
    note: "DM me on WhatsApp if any issue occur and I’ll respond as soon as possible: +2348075944417 Thanks 🙏 for your trust ❤️",
    noteTime: "Monday, October 7th, 7:07 PM",
  },
  {
    id: "77e2a0c4-9931-4f0b-b1d2-88ce41a02b71",
    brand: "facebook",
    glyph: "facebook",
    title: "✅ Strong Foreign Facebook Account +...",
    desc: "All Features Are Working and No Restrictions",
    cardSubtitle: "Foreign Facebook account with Marketplace enabled",
    seller: "Barry White",
    sellerColor: "#0369a1",
    price: 7.9,
    time: "Tuesday, October 8th, 8:09 AM",
    status: "completed",
    productType: "Facebook",
    username: "barry.white.fb@outlook.com",
    password: "Fb!marketplace90",
    note: "Marketplace access is fully enabled on this profile.",
    noteTime: "Tuesday, October 8th, 8:09 AM",
  },
];

/* Live purchases from the backend — falls back to the built-in demo orders. */
const GLYPH_BRAND: Record<Purchase["glyph"], BrandKey> = { whatsapp: "whatsapp", voice: "gmail", facebook: "facebook" };

function formatOrderTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString([], { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" });
}

/* Live orders for the signed-in account only. `role` selects the buyer's
   purchases or the seller's incoming orders. No demo fallback — an account with
   no orders shows a real empty state, never someone else's data. */
export function usePurchases(role: "buyer" | "seller" = "buyer"): { items: Purchase[]; loaded: boolean } {
  const cacheKey = `sb-purchases-${role}`;
  const { data, isFetched } = usePurchasesQuery(role);
  const items = useMemo<Purchase[]>(() => {
    if (!data) return readCache<Purchase[]>(cacheKey) ?? [];
    return data.map((r) => ({
      id: r.id,
      buyer: r.buyer ?? undefined,
      brand: GLYPH_BRAND[r.glyph as "whatsapp" | "voice" | "facebook"] ?? "whatsapp",
      glyph: (r.glyph ?? "whatsapp") as "whatsapp" | "voice" | "facebook",
      title: r.title,
      desc: r.description ?? "",
      cardSubtitle: r.description ?? "",
      seller: r.seller ?? "Seller",
      sellerColor: "#6d28d9",
      price: Number(r.price) || 0,
      time: formatOrderTime(r.created_at ?? ""),
      status: (["pending","completed","cancelled","processing"].includes(String(r.status)) ? r.status : "completed") as Purchase["status"],
      createdAt: r.created_at,
      delivered: Boolean(r.delivered),
      reviewed: Boolean(r.reviewed),
      productType: r.product_type ?? "Account",
      username: r.username ?? "",
      password: r.password ?? "",
      note: r.note ?? "",
      noteTime: r.note_time ?? "",
    }));
  }, [data, cacheKey]);
  useEffect(() => { if (data) writeCache(cacheKey, items); }, [data, items, cacheKey]);
  return { items, loaded: isFetched || readCache<Purchase[]>(cacheKey) != null };
}

/* Bar-chart stat icon — the exact same mark used on the profile page, so the
   My Orders stats match the profile stats precisely. */
function StatBarIcon({ colors }: { colors: [string, string, string] }) {
  return (
    <svg width="22" height="20" viewBox="0 0 22 20" fill="none">
      <rect x="0"  y="11" width="5" height="9"  rx="1.5" fill={colors[0]}/>
      <rect x="8"  y="6"  width="5" height="14" rx="1.5" fill={colors[1]}/>
      <rect x="16" y="1"  width="5" height="19" rx="1.5" fill={colors[2]}/>
    </svg>
  );
}
// One seller-dashboard stat card — identical layout to the profile page cards.
function SellerStatCard({ label, value, sub, tint, colors }:
  { label: string; value: string; sub: string; tint: string; colors: [string, string, string] }) {
  return (
    <div className="p-4 rounded-2xl" style={{ background: "var(--sb-card)", border: `1px solid ${MBD}` }}>
      <div className="w-11 h-11 rounded-full flex items-center justify-center mb-3" style={{ background: tint }}>
        <StatBarIcon colors={colors}/>
      </div>
      <p className="text-xs text-gray-400 mb-2">{label}</p>
      <p className="text-3xl font-extrabold text-white mb-0.5">{value}</p>
      <p className="text-[11px] text-gray-500">{sub}</p>
    </div>
  );
}

/* ── tiny building blocks ─────────────────────────────────────────────── */

function CopyValue({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <span className="text-[15px] font-medium text-white truncate">{value}</span>
      <button onClick={() => { safeCopy(value); setCopied(true); setTimeout(() => setCopied(false), 1400); }}
        className="text-gray-500 hover:text-white transition-colors">
        {copied
          ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>}
      </button>
    </div>
  );
}

function DeliveryChip() {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold" style={{ background: "var(--sb-chip)", color: "var(--sb-chip-text)" }}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 3v5h-7z"/><circle cx="5.5" cy="18.5" r="2"/><circle cx="18.5" cy="18.5" r="2"/></svg>
      Delivery In
    </span>
  );
}

/* ── purchase row (inside one shared panel) ──────────────────────────────── */

function PurchaseRow({ item, first, onPreview, onReview, onSeeTrade, sellerView = false }: {
  item: Purchase; first: boolean; onPreview: () => void; onReview: () => void; onSeeTrade: () => void; sellerView?: boolean;
}) {
  const { hasDeadline, expired, mmss } = useOrderCountdown(item.createdAt);
  const isPending = item.status === "pending" || item.status === "processing";
  const isCancelled = item.status === "cancelled";
  return (
    <div className="px-5 md:px-6 py-5 md:py-6" style={{ borderTop: first ? "none" : `1px solid ${MBD}` }}>
      <div className="flex gap-4">
        {/* Bare product mark — no background tile */}
        <div className="w-11 shrink-0 flex items-center justify-center">
          <ProductGlyph kind={item.glyph}/>
        </div>

        {/* Title / desc / delivery / seller */}
        <div className="flex-1 min-w-0">
          <p className="text-white font-bold text-[15px] leading-snug truncate">{item.title}</p>
          <p className="text-gray-400 text-[13px] mt-1 line-clamp-1">{item.desc}</p>
          <div className="mt-3"><DeliveryChip/></div>
          <div className="flex items-center gap-2.5 mt-2.5">
            <span className="w-6 h-6 rounded-full shrink-0" style={{ background: "var(--sb-chip)" }}/>
            <div className="leading-tight">
              <p className="text-white text-[13px] font-semibold">{item.seller}</p>
              <p className="text-[12px] mt-0.5" style={{ color: "var(--sb-chip-text)" }}>Offline</p>
            </div>
          </div>
        </div>

        {/* Status + date (+ live escrow countdown while pending) */}
        <div className="flex flex-col items-end gap-2 shrink-0 max-w-[180px] text-right">
          {isPending && hasDeadline && !expired && (
            <div className="leading-tight">
              <p className="text-[11.5px]" style={{ color: "var(--sb-chip-text)" }}>Time left</p>
              <p className="text-[15px] font-extrabold tabular-nums" style={{ color: "#16a34a" }}>{mmss}</p>
            </div>
          )}
          {(() => {
            const meta = isCancelled
              ? { label: "Cancelled", color: "#e02d2d", bg: "rgba(224,45,45,0.12)" }
              : isPending
                ? (expired ? { label: "Action needed", color: "#d97706", bg: "rgba(217,119,6,0.14)" } : { label: "Pending", color: "#d97706", bg: "rgba(217,119,6,0.14)" })
                : { label: "Completed", color: "#22c55e", bg: "rgba(34,197,94,0.12)" };
            return (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-semibold" style={{ background: meta.bg, color: meta.color }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: meta.color }}/> {meta.label}
              </span>
            );
          })()}
          <span className="text-[13px] leading-snug" style={{ color: "var(--sb-chip-text)" }}>{item.time}</span>
        </div>
      </div>

      {/* Price + actions */}
      <div className="flex items-center justify-between mt-4">
        <span className="font-extrabold text-[16px]" style={{ color: sellerView ? "#00d66c" : undefined }}>
          <span className={sellerView ? "" : "text-white"}>{sellerView ? "+" : ""}$ {item.price.toFixed(2)}</span>
          {sellerView && <span className="ml-1.5 text-[10px] font-semibold align-middle" style={{ color: "var(--sb-chip-text)" }}>earned</span>}
        </span>
        <div className="flex items-center gap-4">
          {!item.reviewed && (
            <button title="Leave a review" onClick={onReview} className="transition-colors hover:opacity-70" style={{ color: "var(--sb-chip-text)" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="3.2"/><path d="M3.5 20c.6-3.2 2.8-5 5.5-5 1 0 1.9.2 2.7.7"/><path d="M15 14h6M15 17.5h4"/></svg>
            </button>
          )}
          <button title="Preview account details" onClick={onPreview} className="transition-colors hover:opacity-70" style={{ color: "var(--sb-chip-text)" }}>
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
          <button onClick={onSeeTrade} className="flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-bold text-white transition-all hover:opacity-90 active:scale-95" style={{ background: P }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="14" rx="2.5"/><path d="M7.5 9.5h9M7.5 13h5"/></svg>
            See Trade
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Order Preview modal ─────────────────────────────────────────────────── */

export function OrderPreviewModal({ item, onClose, onSeeTrade }: { item: Purchase; onClose: () => void; onSeeTrade: () => void }) {
  useScrollLock(true);
  const { hasDeadline, expired, hms } = useOrderCountdown(item.createdAt);
  const isPending = item.status === "pending" || item.status === "processing";
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(2px)", fontFamily: FONT }} onClick={onClose}>
      <div className="w-full max-w-[560px] max-h-[92vh] overflow-y-auto rounded-[18px] shadow-2xl animate-[popIn_.22s_cubic-bezier(.2,.9,.3,1.3)]" style={{ background: "var(--sb-card)", border: `1px solid ${MBD}` }} onClick={(e) => e.stopPropagation()}>
        {/* Header — eye badge + titles + plain X */}
        <div className="flex items-start justify-between px-5 pt-5 pb-3">
          <div className="flex items-start gap-3.5">
            <span className="w-11 h-11 rounded-full flex items-center justify-center shrink-0" style={{ background: "rgba(240,78,35,0.12)" }}>
              <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke={P} strokeWidth="1.8"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </span>
            <div>
              <h3 className="text-white" style={{ fontSize: 19, fontWeight: 800, letterSpacing: "-0.01em" }}>Order Preview</h3>
              <p className="text-gray-400 text-[13px] mt-0.5">Review account details before proceeding</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1 text-white transition-transform hover:rotate-90 duration-200 shrink-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>

        {/* Product — bordered circular badge with bare glyph, no box behind block */}
        <div className="flex items-start gap-3.5 px-5 pt-1.5">
          <span className="w-12 h-12 rounded-full flex items-center justify-center shrink-0" style={{ background: "var(--sb-card)", border: `1px solid ${MBD}` }}>
            <ProductGlyph kind={item.glyph} size={26}/>
          </span>
          <div className="min-w-0">
            <p className="text-white font-bold text-[15px] leading-snug truncate">{item.title}</p>
            <p className="text-gray-400 text-[13px] mt-0.5 leading-snug line-clamp-2">{item.desc}</p>
            <div className="flex items-center gap-2.5 mt-1.5">
              <span className="text-[13px]" style={{ color: "var(--sb-chip-text)" }}>{item.productType}</span>
              <span className="px-2.5 py-0.5 rounded-md text-[12px] font-semibold" style={{ background: "rgba(34,197,94,0.14)", color: "#16a34a" }}>Active</span>
            </div>
          </div>
        </div>

        {/* Account Credentials card — header inside the card */}
        <div className="mx-5 mt-4 rounded-[14px] overflow-hidden" style={{ border: `1px solid ${MBD}` }}>
          <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: `1px solid ${MBD}` }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="text-white"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>
            <span className="text-white text-[14px] font-bold">Account Credentials</span>
          </div>
          <div className="flex items-center justify-between gap-3 px-4 py-3.5" style={{ borderBottom: `1px solid ${MBD}` }}>
            <span className="text-[14px] shrink-0" style={{ color: "var(--sb-chip-text)" }}>Username</span>
            <CopyValue value={item.username}/>
          </div>
          <div className="flex items-center justify-between gap-3 px-4 py-3.5">
            <span className="text-[14px] shrink-0" style={{ color: "var(--sb-chip-text)" }}>Password</span>
            <CopyValue value={item.password}/>
          </div>
        </div>

        {/* Additional Information card */}
        <div className="mx-5 mt-4 rounded-[14px] overflow-hidden" style={{ border: `1px solid ${MBD}` }}>
          <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: `1px solid ${MBD}` }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="text-white"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/></svg>
            <span className="text-white text-[14px] font-bold">Additional Information</span>
          </div>
          <div className="px-4 py-3.5">
            <p className="text-[13px] mb-1.5" style={{ color: "var(--sb-chip-text)" }}>Note from seller</p>
            <p className="text-white text-[14px] leading-relaxed">{item.note}</p>
          </div>
          <div className="flex items-center justify-between gap-3 px-4 py-3" style={{ borderTop: `1px solid ${MBD}` }}>
            <span className="text-[13px]" style={{ color: "var(--sb-chip-text)" }}>Account created</span>
            <span className="text-white text-[14px] font-semibold text-right">{item.noteTime}</span>
          </div>
        </div>

        {/* Important warning — live escrow window */}
        <div className="mx-5 mt-4 rounded-[12px] px-4 py-3.5 flex items-start gap-3" style={{ background: "var(--sb-note-bg)" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#e58f2a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/></svg>
          <div className="text-[13px] leading-relaxed">
            <p className="text-white font-bold text-[14px] mb-0.5">Important</p>
            <p style={{ color: "var(--sb-note-text)" }}>
              {item.status === "cancelled"
                ? "This order was cancelled and refunded to your wallet."
                : item.status === "completed"
                  ? "This order is complete — the funds have been released to the seller."
                  : isPending && hasDeadline && !expired
                    ? <>You have <span className="font-bold tabular-nums" style={{ color: P }}>{hms}</span> to log in and confirm this account. If it&apos;s invalid, you can cancel for a refund once the timer reaches 00:00.</>
                    : "The confirmation window has ended — you can cancel this order for a refund, or report a problem from the trade page."}
            </p>
          </div>
        </div>

        {/* Actions — centered pill pair */}
        <div className="flex items-center justify-center gap-3 px-5 py-5">
          <button onClick={onClose} className="px-7 py-2.5 rounded-full font-semibold text-[14px] transition-all hover:opacity-80 active:scale-95" style={{ background: "var(--sb-chip)", color: "var(--sb-nav-active)" }}>Close</button>
          <button onClick={onSeeTrade} className="px-7 py-2.5 rounded-full font-semibold text-[14px] text-white transition-all hover:opacity-90 active:scale-95" style={{ background: "#f4805e" }}>See Trade</button>
        </div>
      </div>
    </div>
  );
}

/* ── Seller order modal — compact sale summary with earnings & status ────── */
export function SellerOrderModal({ item, onClose, onOpenChat }: { item: Purchase; onClose: () => void; onOpenChat: () => void }) {
  useScrollLock(true);
  const [copied, setCopied] = useState(false);
  const fee = +(item.price * 0.10).toFixed(2);
  const payout = +(item.price - fee).toFixed(2);
  const sold = item.status === "completed";
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(2px)", fontFamily: FONT }} onClick={onClose}>
      <div className="w-full max-w-[460px] rounded-[18px] shadow-2xl animate-[popIn_.22s_cubic-bezier(.2,.9,.3,1.3)]" style={{ background: "var(--sb-card)", border: `1px solid ${MBD}` }} onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-5 pb-3">
          <div className="flex items-start gap-3">
            <span className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: "rgba(240,78,35,0.12)" }}>
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={P} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16v4a2 2 0 0 1 0 4v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-4a2 2 0 0 1 0-4V4Z"/><path d="M4 8h16M9 13h6"/></svg>
            </span>
            <div>
              <h3 className="text-white" style={{ fontSize: 17, fontWeight: 800 }}>Order Details</h3>
              <p className="text-gray-400 text-[12.5px] mt-0.5">Sale summary for this order</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1 text-white transition-transform hover:rotate-90 duration-200 shrink-0">
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>

        {/* Product + status */}
        <div className="flex items-center gap-3 px-5">
          <span className="w-11 h-11 rounded-full flex items-center justify-center shrink-0" style={{ border: `1px solid ${MBD}` }}>
            <ProductGlyph kind={item.glyph} size={24}/>
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-[14px] leading-snug truncate">{item.title}</p>
            <p className="text-[12px] mt-0.5" style={{ color: "var(--sb-chip-text)" }}>{item.productType}</p>
          </div>
          <span className="px-2.5 py-1 rounded-full text-[11.5px] font-bold shrink-0" style={sold
            ? { background: "rgba(34,197,94,0.14)", color: "#16a34a" }
            : { background: "rgba(245,158,11,0.14)", color: "#f59e0b" }}>
            {sold ? "Sold ✓" : "Processing"}
          </span>
        </div>

        {/* Compact facts grid */}
        <div className="grid grid-cols-2 gap-2.5 px-5 mt-4">
          <div className="rounded-[12px] px-3 py-2.5" style={{ background: "var(--sb-chip)" }}>
            <p className="text-[10.5px] font-bold" style={{ color: "var(--sb-chip-text)" }}>ORDER ID</p>
            <button onClick={() => { try { navigator.clipboard?.writeText(item.id); } catch { /* ignore */ } setCopied(true); setTimeout(() => setCopied(false), 1200); }}
              className="flex items-center gap-1.5 mt-1 text-white text-[12.5px] font-semibold transition hover:opacity-70">
              {item.id.slice(0, 8)}…
              {copied
                ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.4" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>}
            </button>
          </div>
          <div className="rounded-[12px] px-3 py-2.5" style={{ background: "var(--sb-chip)" }}>
            <p className="text-[10.5px] font-bold" style={{ color: "var(--sb-chip-text)" }}>PAYMENT</p>
            <p className="mt-1 text-[12.5px] font-semibold" style={{ color: sold ? "#16a34a" : "#f59e0b" }}>{sold ? "Paid — escrow released" : "Held in escrow"}</p>
          </div>
          <div className="rounded-[12px] px-3 py-2.5" style={{ background: "var(--sb-chip)" }}>
            <p className="text-[10.5px] font-bold" style={{ color: "var(--sb-chip-text)" }}>SOLD ON</p>
            <p className="mt-1 text-white text-[12.5px] font-semibold truncate">{item.time}</p>
          </div>
          <div className="rounded-[12px] px-3 py-2.5" style={{ background: "var(--sb-chip)" }}>
            <p className="text-[10.5px] font-bold" style={{ color: "var(--sb-chip-text)" }}>DELIVERY</p>
            <p className="mt-1 text-white text-[12.5px] font-semibold">{sold ? "Delivered to buyer" : "Awaiting delivery"}</p>
          </div>
        </div>

        {/* Earnings */}
        <div className="mx-5 mt-3.5 rounded-[14px] px-4 py-3" style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)" }}>
          <div className="flex items-center justify-between text-[12.5px]"><span style={{ color: "var(--sb-chip-text)" }}>Sale price</span><span className="text-white font-semibold">$ {item.price.toFixed(2)}</span></div>
          <div className="flex items-center justify-between text-[12.5px] mt-1"><span style={{ color: "var(--sb-chip-text)" }}>Platform fee (10%)</span><span className="text-white font-semibold">− $ {fee.toFixed(2)}</span></div>
          <div className="flex items-center justify-between text-[13.5px] mt-2 pt-2" style={{ borderTop: "1px solid rgba(34,197,94,0.25)" }}>
            <span className="font-bold text-white">Net payout</span><span className="font-extrabold" style={{ color: "#16a34a" }}>+ $ {payout.toFixed(2)}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-center gap-3 px-5 py-4">
          <button onClick={onClose} className="px-6 py-2.5 rounded-full font-semibold text-[13.5px] transition-all hover:opacity-80 active:scale-95" style={{ background: "var(--sb-chip)", color: "var(--sb-nav-active)" }}>Close</button>
          <button onClick={onOpenChat} className="px-6 py-2.5 rounded-full font-semibold text-[13.5px] text-white transition-all hover:opacity-90 active:scale-95" style={{ background: P }}>Open Trade Chat</button>
        </div>
      </div>
    </div>
  );
}

/* ── Review modal ────────────────────────────────────────────────────────── */

function ReviewModal({ order, onClose }: { order: Purchase; onClose: () => void }) {
  useScrollLock(true);
  const [sentiment, setSentiment] = useState<"positive" | "negative">("positive");
  const [feedback, setFeedback] = useState("");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState("");
  const send = async () => {
    if (sending) return;
    setSending(true); setErr("");
    const result = await submitReview({ order_id: order.id, sentiment, feedback: feedback.trim() });
    setSending(false);
    if (!result.ok) {
      const msg = result.error ?? "Could not submit your review.";
      setErr(msg);
      toast.error(msg, { title: "Review not submitted" });
      return;
    }
    try { sessionStorage.removeItem("sb-profile-data"); } catch { /* ignore */ }
    toast.success(`Your ${sentiment} review for ${order.seller} was submitted`, { title: "Review submitted" });
    onClose();
  };
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(2px)", fontFamily: FONT }} onClick={onClose}>
      <div className="w-full max-w-[540px] rounded-[18px] shadow-2xl animate-[popIn_.22s_cubic-bezier(.2,.9,.3,1.3)]" style={{ background: "var(--sb-card)", border: `1px solid ${MBD}` }} onClick={(e) => e.stopPropagation()}>
        {/* X on its own row, heading below — matching the reference */}
        <div className="flex justify-end px-5 pt-4">
          <button onClick={onClose} aria-label="Close" className="p-1 text-white transition-transform hover:rotate-90 duration-200">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <h3 className="text-white px-5" style={{ fontSize: 16, fontWeight: 700 }}>Leave a review</h3>
        <p className="px-5 mt-0.5 text-[12.5px]" style={{ color: "var(--sb-chip-text)" }}>How was your experience with <span className="font-semibold text-white">{order.seller}</span>?</p>

        {/* Sentiment pills — selected is solid, unselected is outlined in its color */}
        <div className="px-5 pt-3 flex items-center gap-3">
          <button onClick={() => setSentiment("positive")}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[14px] font-semibold transition-all active:scale-95"
            style={sentiment === "positive"
              ? { background: "#56b352", color: "#fff" }
              : { background: "transparent", color: "#56b352", border: "1.5px solid #56b352" }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>
            Positive
          </button>
          <button onClick={() => setSentiment("negative")}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[14px] font-semibold transition-all active:scale-95"
            style={sentiment === "negative"
              ? { background: "#e02d2d", color: "#fff" }
              : { background: "transparent", color: "#e02d2d", border: "1.5px solid #e02d2d" }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/></svg>
            Negative
          </button>
        </div>

        {/* Feedback */}
        <p className="text-white text-[15px] px-5 pt-4">Leave feedback</p>
        <div className="px-5 pt-2">
          <textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} rows={6}
            className="w-full rounded-[10px] px-4 py-3 text-[14px] text-white outline-none resize-none transition-colors focus:border-gray-400"
            style={{ background: "var(--sb-card)", border: "1.5px solid var(--sb-bd)" }}/>
        </div>

        {/* Full-width Send — persists the review */}
        <div className="px-5 pt-2 pb-5">
          {err && <p className="mb-2.5 rounded-lg px-3.5 py-2.5 text-[12.5px] font-medium" style={{ color: "#ef4444", background: "rgba(239,68,68,0.10)" }}>{err}</p>}
          <button onClick={send} disabled={sending} className="flex w-full items-center justify-center gap-2 py-3 rounded-full font-semibold text-[15px] text-white transition-all hover:opacity-90 active:scale-[0.99] disabled:opacity-70" style={{ background: "#f26744" }}>{sending && <Spinner size={17}/>}{sending ? "Sending…" : "Send"}</button>
        </div>
      </div>
    </div>
  );
}

/* ── page ────────────────────────────────────────────────────────────────── */

export function MyPurchasePage({ setPage }: { setPage: (p: Page) => void }) {
  const seller = Boolean(useProfile().is_seller);
  const { items: purchases, loaded } = usePurchases(seller ? "seller" : "buyer");
  const [preview, setPreview] = useState<Purchase | null>(null);
  const [salePreview, setSalePreview] = useState<Purchase | null>(null);
  const [review, setReview] = useState<Purchase | null>(null);
  // Seller dashboard state (buyers never see these controls)
  const [orderSearch, setOrderSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "completed" | "processing">("all");
  // Premium role URL: sellers manage sales at /seller/my-orders
  useEffect(() => {
    try {
      const url = seller ? "/seller/my-orders" : "/my-purchase";
      if (window.location.pathname !== url) window.history.replaceState({}, "", url);
    } catch { /* ignore */ }
  }, [seller]);
  const q = orderSearch.trim().toLowerCase();
  const visibleOrders = purchases
    .filter(o => statusFilter === "all" || o.status === statusFilter)
    .filter(o => !q || o.title.toLowerCase().includes(q) || o.seller.toLowerCase().includes(q));
  // Escrow-aware earnings: sellers only "earn" once an order is confirmed
  // (completed); pending orders' payouts are shown as held in escrow.
  const isPend = (s: Purchase["status"]) => s === "pending" || s === "processing";
  const completedCount = purchases.filter(o => o.status === "completed").length;
  const pendingCount = purchases.filter(o => isPend(o.status)).length;
  const earned = +purchases.filter(o => o.status === "completed").reduce((sum, o) => sum + o.price * 0.9, 0).toFixed(2);
  const inEscrow = +purchases.filter(o => isPend(o.status)).reduce((sum, o) => sum + o.price * 0.9, 0).toFixed(2);
  const listForRender = seller ? visibleOrders : purchases;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: MBG, fontFamily: FONT }}>
      <DesktopTopNav setPage={setPage} active="purchase"/>
      <AppMobileHeader className="md:hidden" setPage={setPage}/>

      <div className="w-full max-w-[1440px] mx-auto px-5 md:px-8 pt-7 md:pt-10 pb-14 flex-1">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-white" style={{ fontSize: 32, fontWeight: 800, letterSpacing: "-0.02em" }}>{seller ? "My Orders" : "My Purchase"}</h1>
            <p className="text-gray-500 text-[13.5px] mt-1">{seller ? "Every sale on your listings shows here" : "All of your product Purchase shows here"}</p>
          </div>
          <button className="px-5 py-2.5 rounded-full font-bold text-[13px] text-white shrink-0 transition-all hover:opacity-90 active:scale-95" style={{ background: "#e0402a", boxShadow: "0 6px 18px rgba(224,64,42,0.4)" }}>
            Report Product
          </button>
        </div>

        {/* Refund policy banner */}
        <div className="rounded-xl px-4 py-3.5 mt-5 text-[13px] leading-relaxed" style={{ background: "var(--sb-note-bg)", color: "var(--sb-note-text)" }}>
          Customers are not eligible for a refund on any social media product that is not returned within 24 hours of purchase if it is found to be defective. Please report any defective product immediately after purchase to ensure prompt assistance.
        </div>

        {/* ── Seller dashboard: live stats, search and status filters ── */}
        {seller && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
              <SellerStatCard label="Earned" value={`$${earned.toFixed(2)}`} sub="Released, net of fees" tint="rgba(22,163,74,0.22)" colors={["#4ade80","#22c55e","#16a34a"]}/>
              <SellerStatCard label="In Escrow" value={`$${inEscrow.toFixed(2)}`} sub="Held until confirmed" tint="rgba(180,83,9,0.3)" colors={["#fbbf24","#f59e0b","#d97706"]}/>
              <SellerStatCard label="Completed" value={String(completedCount)} sub="Confirmed & paid" tint="rgba(16,185,129,0.22)" colors={["#34d399","#10b981","#059669"]}/>
              <SellerStatCard label="Pending" value={String(pendingCount)} sub="Awaiting confirmation" tint="rgba(37,99,235,0.25)" colors={["#3b82f6","#60a5fa","#93c5fd"]}/>
            </div>
            <div className="flex flex-col sm:flex-row gap-2.5 mt-4">
              <div className="flex-1 flex items-center gap-2.5 px-4 py-2.5 rounded-full" style={{ background: "var(--sb-chip)" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={{ color: "var(--sb-chip-text)" }}><circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/></svg>
                <input value={orderSearch} onChange={(e) => setOrderSearch(e.target.value)} placeholder="Search orders"
                  className="flex-1 bg-transparent text-[13px] text-white outline-none placeholder:text-gray-500 min-w-0"/>
              </div>
              <div className="flex gap-2">
                {(["all", "completed", "processing"] as const).map(f => (
                  <button key={f} onClick={() => setStatusFilter(f)}
                    className="px-4 py-2 rounded-full text-[12px] font-bold capitalize transition-all active:scale-95"
                    style={statusFilter === f ? { background: P, color: "#fff" } : { background: "var(--sb-chip)", color: "var(--sb-chip-text)" }}>
                    {f}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Unified list panel */}
        <div className="rounded-[20px] overflow-y-auto mt-6 md:max-h-[612px]" style={{ background: MCARD, border: `1px solid ${MBD}` }}>
          {listForRender.map((item, i) => (
            <PurchaseRow key={item.id} item={item} first={i === 0} sellerView={seller}
              onPreview={() => (seller ? setSalePreview(item) : setPreview(item))}
              onReview={() => setReview(item)}
              onSeeTrade={() => { setCurrentOrder(item); setPage("order"); }}/>
          ))}
          {/* Still loading the account's real orders — skeleton rows */}
          {!loaded && listForRender.length === 0 && (
            <div>
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-4" style={{ borderTop: i === 0 ? "none" : `1px solid ${MBD}` }}>
                  <Skeleton className="h-11 w-11" rounded="rounded-full"/>
                  <div className="flex-1 min-w-0 space-y-2">
                    <Skeleton className="h-3.5 w-1/2"/>
                    <Skeleton className="h-3 w-1/3"/>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <Skeleton className="h-4 w-14"/>
                    <Skeleton className="h-6 w-20" rounded="rounded-full"/>
                  </div>
                </div>
              ))}
            </div>
          )}
          {/* Seller searched/filtered to nothing */}
          {loaded && seller && purchases.length > 0 && listForRender.length === 0 && (
            <p className="text-center text-[13px] py-12" style={{ color: "var(--sb-chip-text)" }}>No orders match your search.</p>
          )}
          {/* Genuinely empty — this account has no orders yet */}
          {loaded && purchases.length === 0 && (
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
              <div className="mb-5"><EmptyMegaphone/></div>
              <p className="text-white font-bold text-[18px]">{seller ? "No orders yet" : "No purchases yet"}</p>
              <p className="text-[13px] mt-1.5 max-w-[280px]" style={{ color: "var(--sb-chip-text)" }}>
                {seller ? "Sales on your listings will appear here as buyers order." : "Browse the marketplace and your orders will show up here."}
              </p>
              {!seller && (
                <button onClick={() => setPage("marketplace")} className="mt-5 px-6 py-2.5 rounded-full text-[13px] font-bold text-white transition-all hover:opacity-90 active:scale-95" style={{ background: P }}>
                  Browse marketplace
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {preview && <OrderPreviewModal item={preview} onClose={() => setPreview(null)} onSeeTrade={() => { setPreview(null); setPage("order"); }}/>}
      {salePreview && <SellerOrderModal item={salePreview} onClose={() => setSalePreview(null)} onOpenChat={() => { setCurrentOrder(salePreview); setSalePreview(null); setPage("order"); }}/>}
      {review && <ReviewModal order={review} onClose={() => setReview(null)}/>}

      <style>{`@keyframes popIn{from{opacity:0;transform:scale(.95) translateY(10px)}to{opacity:1;transform:scale(1) translateY(0)}}`}</style>
    </div>
  );
}
