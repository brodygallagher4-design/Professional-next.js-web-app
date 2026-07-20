"use client";

import { useState, useEffect, useRef } from "react";
import {
  P, MBG, MCARD, MBD, FONT,
  DesktopTopNav, AppMobileHeader, getCurrentOrder, useProfile,
} from "../shared";
import type { Page } from "../shared";
import { OrderPreviewModal, SellerOrderModal, type Purchase } from "./purchase-page";
import { fetchOrderMessages, sendOrderMessage, fetchPurchases } from "../lib/api";

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

interface Msg { id: number; text: string; time: string; mine: boolean; }



/* Bare product marks — the brand logo alone, no background tile */
function VoiceGlyph({ kind = "voice", size = 38 }: { kind?: Purchase["glyph"]; size?: number }) {
  if (kind === "whatsapp") return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <path fill="#25D366" d="M12 2C6.5 2 2 6.5 2 12c0 1.9.5 3.6 1.4 5.2L2 22l4.9-1.3C8.5 21.5 10.2 22 12 22c5.5 0 10-4.5 10-10S17.5 2 12 2z"/>
      <path fill="#fff" d="M17.3 16.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .3-3.4-.7-2.9-1.2-4.7-4.1-4.8-4.3-.1-.2-1.2-1.6-1.2-3s.7-2.1 1-2.4c.2-.3.5-.3.7-.3h.5c.2 0 .4-.1.7.5.2.6.8 2 .9 2.1.1.1.1.3 0 .5-.1.2-.2.4-.3.5l-.5.5c-.2.2-.3.3-.1.6.2.3.9 1.4 1.9 2.3 1.3 1.1 2.3 1.5 2.6 1.6.3.1.5.1.6-.1.2-.2.7-.9.9-1.2.2-.3.4-.2.6-.1l2 1c.3.1.5.2.5.3.2.2.2.8 0 1.4z"/>
    </svg>);
  if (kind === "facebook") return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" fill="#1877F2"/>
      <path fill="#fff" d="M13.4 20v-6.2h2.1l.3-2.4h-2.4V9.9c0-.7.2-1.2 1.2-1.2h1.3V6.6c-.2 0-1-.1-1.9-.1-1.9 0-3.1 1.1-3.1 3.2v1.7H8.8v2.4h2.1V20h2.5z"/>
    </svg>);
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <path fill="#16a34a" d="M6.6 3.2 8.9 5.5c.5.5.6 1.3.2 1.9L7.9 9.2a1.5 1.5 0 0 0 .2 1.9l4.8 4.8c.5.5 1.3.6 1.9.2l1.8-1.2c.6-.4 1.4-.3 1.9.2l2.3 2.3c.6.6.6 1.6 0 2.2l-1.5 1.5c-.8.8-2 1.1-3.1.8-6-1.9-10.8-6.7-12.7-12.7-.3-1.1 0-2.3.8-3.1l1.5-1.5c.6-.6 1.6-.6 2.2 0Z"/>
    </svg>);
}

/* Circled-person avatar shown beside each sent message (per reference) */
function MsgAvatar() {
  return (
    <span className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: "var(--sb-card)", border: "1.5px solid var(--sb-bd)" }}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-white"><circle cx="12" cy="8" r="3.6"/><path d="M5 20c.8-3.4 3.5-5.4 7-5.4s6.2 2 7 5.4"/></svg>
    </span>
  );
}

export function OrderDetailsPage({ setPage }: { setPage: (p: Page) => void }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [chatLoaded, setChatLoaded] = useState(false);
  const [draft, setDraft] = useState("");
  const [copied, setCopied] = useState(false);
  const [showLogins, setShowLogins] = useState(false);
  // The order opened from My Purchase; /order-details/<id> deep links resolve
  // the order from the database when the page is opened directly.
  const [resolvedOrder, setResolvedOrder] = useState<Purchase | null>(() => getCurrentOrder<Purchase>());
  const [resolveFailed, setResolveFailed] = useState(false);
  // Sellers chat with the buyer (real name from the order); buyers with the seller.
  const isSeller = Boolean(useProfile().is_seller);
  useEffect(() => {
    if (resolvedOrder) return;
    const parts = window.location.pathname.split("/").filter(Boolean);
    const urlId = decodeURIComponent(parts[parts.length - 1] ?? "");
    if (!urlId || urlId === "order-details") { setResolveFailed(true); return; }
    let cancelled = false;
    // Look in both the buyer's and the seller's orders; only the order's own
    // buyer or seller is authorized to see it, so nothing else can resolve.
    Promise.all([fetchPurchases("buyer"), fetchPurchases("seller")]).then(([bought, sold]) => {
      if (cancelled) return;
      const hit = [...(bought ?? []), ...(sold ?? [])].find((r) => r.id === urlId);
      if (hit) setResolvedOrder({
        id: hit.id, buyer: hit.buyer ?? undefined, brand: "gmail", glyph: hit.glyph,
        title: hit.title, desc: hit.description ?? "", cardSubtitle: hit.description ?? "",
        seller: hit.seller, sellerColor: "#6d28d9", price: Number(hit.price) || 0,
        time: "", status: hit.status === "processing" ? "processing" : "completed",
        productType: hit.product_type, username: hit.username ?? "", password: hit.password ?? "",
        note: hit.note ?? "", noteTime: hit.note_time ?? "",
      });
      else setResolveFailed(true);
    });
    return () => { cancelled = true; };
  }, [resolvedOrder]);
  const order = resolvedOrder;
  const counterpartName = order ? (isSeller ? (order.buyer || "Customer") : order.seller) : "";
  const counterpartRole = isSeller ? "Buyer" : "Seller";
  // Premium role URL: /seller/order-details/<id> vs /order-details/<id>
  useEffect(() => {
    if (!order) return;
    try {
      const url = (isSeller ? "/seller" : "") + "/order-details/" + encodeURIComponent(order.id);
      if (window.location.pathname !== url) window.history.replaceState({}, "", url);
    } catch { /* ignore */ }
  }, [isSeller, order]);
  // Real conversation date (from the first stored message; today when empty)
  const [chatDate, setChatDate] = useState(() =>
    new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }));
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [msgs.length]);

  // Load the persisted conversation for this order from the database.
  useEffect(() => {
    if (!order) return;
    let cancelled = false;
    setMsgs([]);
    setChatLoaded(false);
    fetchOrderMessages(order.id).then((rows) => {
      if (cancelled) return;
      setChatLoaded(true);
      if (!rows) return;
      if (rows.length > 0) {
        setChatDate(new Date(rows[0].created_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }));
      }
      setMsgs(rows.map((r) => ({
        id: r.id,
        text: r.text,
        time: new Date(r.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        mine: r.mine,
      })));
    });
    return () => { cancelled = true; };
  }, [order]);

  const send = () => {
    const text = draft.trim();
    if (!text || !order) return;
    setMsgs((prev) => [...prev, { id: Date.now(), text, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), mine: true }]);
    setDraft("");
    sendOrderMessage(order.id, text); // persist to the database (no-op when offline)
  };

  // No demo fallback: while the deep-linked order resolves show a spinner, and
  // if it can't be found (or isn't this account's order) show a clear message.
  if (!order) {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: MBG, fontFamily: FONT }}>
        <DesktopTopNav setPage={setPage} active="purchase"/>
        <AppMobileHeader className="md:hidden" setPage={setPage}/>
        <div className="flex-1 grid place-items-center px-6 text-center">
          {resolveFailed ? (
            <div className="flex flex-col items-center">
              <span className="grid h-14 w-14 place-items-center rounded-full mb-4" style={{ background: "var(--sb-card)" }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--sb-chip-text)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/></svg>
              </span>
              <p className="text-white font-bold text-[16px]">Order not found</p>
              <p className="text-[13px] mt-1 max-w-[300px]" style={{ color: "var(--sb-chip-text)" }}>This order doesn&apos;t exist or doesn&apos;t belong to your account.</p>
              <button onClick={() => setPage("purchase")} className="mt-5 px-6 py-2.5 rounded-full text-[13px] font-bold text-white transition-all hover:opacity-90 active:scale-95" style={{ background: P }}>Back to orders</button>
            </div>
          ) : (
            <span className="h-7 w-7 animate-spin rounded-full border-2 border-white/15" style={{ borderTopColor: P }}/>
          )}
        </div>
      </div>
    );
  }

  const orderId = order.id;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: MBG, fontFamily: FONT }}>
      <DesktopTopNav setPage={setPage} active="purchase"/>
      <AppMobileHeader className="md:hidden" setPage={setPage}/>

      <div className="flex-1 w-full max-w-[1000px] mx-auto flex flex-col px-4 md:px-6 pt-5 pb-4">
        {/* ── Seller header */}
        <div className="flex items-start gap-2.5">
          <button onClick={() => setPage("purchase")} aria-label="Back" className="mt-2.5 shrink-0 text-white transition hover:opacity-60">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
          <span className="w-11 h-11 rounded-full shrink-0" style={{ background: "var(--sb-chip)", border: "1px solid var(--sb-bd)" }}/>
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-[16px] leading-tight">{counterpartName}</p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold" style={{ background: "rgba(240,78,35,0.10)", color: P }}>{counterpartRole}</span>
              <span className="flex items-center gap-1 text-[12px]" style={{ color: "#16a34a" }}><span className="w-1.5 h-1.5 rounded-full" style={{ background: "#22c55e" }}/> Active</span>
              <span className="text-[12px]" style={{ color: "var(--sb-chip-text)" }}>Offline</span>
            </div>
            <p className="text-[12px] mt-1.5" style={{ color: "var(--sb-chip-text)" }}>Waiting For Action</p>
          </div>
          <button onClick={() => setPage("support")} className="px-4 py-1.5 rounded-full font-bold text-[13px] text-white shrink-0 transition-all hover:opacity-90 active:scale-95" style={{ background: "#e02d2d" }}>Report</button>
        </div>

        {/* ── Escrow banner */}
        <div className="rounded-[14px] px-4 py-3.5 flex items-start gap-3 mt-4" style={{ background: "rgba(240,78,35,0.07)" }}>
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-white shrink-0 mt-0.5"><path d="M12 22s8-3.6 8-10V5.4L12 2 4 5.4V12c0 6.4 8 10 8 10Z"/><path d="m9 11.7 2.1 2.1L15.3 9.5"/></svg>
          <div>
            <p className="text-white font-bold text-[14px]">Escrow Protection</p>
            <p className="text-[13px] mt-0.5" style={{ color: "var(--sb-chip-text)" }}>Funds are securely held in escrow until the order is completed.</p>
          </div>
        </div>

        {/* ── Order card */}
        <div className="rounded-[16px] px-4 py-4 flex items-start gap-3 mt-4 shadow-sm" style={{ background: MCARD, border: `1px solid ${MBD}` }}>
          <div className="w-10 shrink-0 flex justify-center pt-1"><VoiceGlyph kind={order.glyph}/></div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-[14.5px] leading-snug truncate">{order.title}</p>
            <div className="flex items-center gap-2.5 mt-1.5 flex-wrap">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11.5px] font-semibold" style={{ background: "rgba(34,197,94,0.13)", color: "#16a34a" }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg> Completed
              </span>
              <span className="text-white font-extrabold text-[14px]">$ {order.price.toFixed(2)}</span>
              <span className="flex items-center gap-1 text-[11.5px]" style={{ color: "var(--sb-chip-text)" }}><span className="w-1 h-1 rounded-full" style={{ background: "var(--sb-chip-text)" }}/> {order.productType}</span>
            </div>
            <button onClick={() => { safeCopy(orderId); setCopied(true); setTimeout(() => setCopied(false), 1400); }}
              className="flex items-center gap-1.5 mt-2 text-white transition hover:opacity-70">
              <span className="text-[13.5px] font-semibold">Order ID: {orderId.slice(0, 12)}…</span>
              {copied
                ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.4" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>}
            </button>
          </div>
          <div className="flex flex-col items-end gap-2.5 shrink-0 max-w-[92px] text-right">
            <button onClick={() => setShowLogins(true)} className="flex items-center gap-0.5 px-3 py-2 rounded-[12px] text-[13px] font-semibold leading-tight transition hover:opacity-80 active:scale-95" style={{ background: "rgba(240,78,35,0.10)", color: P }}>
              {isSeller ? "View Order" : "View Logins"} <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
            </button>
            <span className="text-[13px] font-semibold leading-snug" style={{ color: "#e02d2d" }}>Time expired</span>
          </div>
        </div>

        {/* ── Chat */}
        <div className="flex-1 flex flex-col gap-1 mt-5 min-h-[220px] overflow-y-auto pr-1" style={{ scrollbarWidth: "thin", scrollbarColor: `${P} transparent` }}>
          <div className="flex justify-center mb-3">
            <span className="px-3.5 py-1.5 rounded-full text-[12px] font-medium" style={{ background: "var(--sb-chip)", color: "var(--sb-nav-active)" }}>{chatDate}</span>
          </div>
          {chatLoaded && msgs.length === 0 && (
            <div className="flex-1 flex flex-col items-center justify-center py-10 text-center">
              <span className="w-12 h-12 rounded-full flex items-center justify-center mb-3" style={{ background: "var(--sb-chip)" }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" style={{ color: "var(--sb-chip-text)" }}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              </span>
              <p className="text-[13px]" style={{ color: "var(--sb-chip-text)" }}>No messages yet — start the conversation below.</p>
            </div>
          )}
          {msgs.map((m) => (
            <div key={m.id} className="flex items-start justify-end gap-2.5 mb-2.5">
              <div className="max-w-[70%] flex flex-col items-end">
                <div className="rounded-[10px] px-4 py-2.5 text-[14px] text-white animate-[msgIn_.18s_ease-out]" style={{ background: P }}>{m.text}</div>
                <div className="flex items-center gap-1 mt-1.5">
                  <span className="text-[11.5px]" style={{ color: "var(--sb-chip-text)" }}>{m.time}</span>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={P} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m2 12.5 4.2 4.2L14.4 8.5"/><path d="m9.5 12.5 4.2 4.2L21.9 8.5"/></svg>
                </div>
              </div>
              <MsgAvatar/>
            </div>
          ))}
          <div ref={chatEndRef}/>
        </div>

        {/* ── Input */}
        <div className="rounded-[16px] px-3 pt-2.5 pb-2 mt-3" style={{ background: MCARD, border: `1px solid ${MBD}` }}>
          <div className="flex items-center gap-2.5">
            <button aria-label="Attach a file" className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition hover:opacity-70" style={{ background: "var(--sb-chip)", color: "var(--sb-chip-text)" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
            </button>
            <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Type a message"
              className="flex-1 rounded-[12px] px-4 py-2.5 text-[14px] text-white outline-none placeholder:text-gray-500 min-w-0"
              style={{ background: "var(--sb-chip)" }}/>
            <button onClick={send} aria-label="Send message" className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-all hover:opacity-90 active:scale-95" style={{ background: "#f6a284" }}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            </button>
          </div>
          <p className="flex items-center justify-center gap-1 text-[10.5px] mt-2" style={{ color: "var(--sb-chip-text)" }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>
            Use the chat to discuss order only. Any payment outside the platform is not allowed.
          </p>
        </div>
      </div>

      {showLogins && (isSeller
        ? <SellerOrderModal item={order} onClose={() => setShowLogins(false)} onOpenChat={() => setShowLogins(false)}/>
        : <OrderPreviewModal item={order} onClose={() => setShowLogins(false)} onSeeTrade={() => setShowLogins(false)}/>)}

      <style>{`@keyframes msgIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}@keyframes popIn{from{opacity:0;transform:scale(.95) translateY(10px)}to{opacity:1;transform:scale(1) translateY(0)}}`}</style>
    </div>
  );
}
