"use client";

import { useState, useEffect, useMemo } from "react";
import QRCodeSVG from "react-qr-code";
import { ArrowDown01Icon, ArrowLeft01Icon, ArrowRight01Icon, BankIcon, Calendar03Icon, Cancel01Icon, CancelCircleIcon, CheckmarkCircle02Icon, Clock01Icon, Copy01Icon, CustomerSupportIcon, DiscountTag01Icon, Download01Icon, HashtagIcon, Upload01Icon, ViewIcon, ViewOffIcon, Wallet01Icon } from "hugeicons-react";
import { DesktopTopNav, FONT, AppMobileHeader, P, MBG, useProfile, useScrollLock, Skeleton, useLoadGate } from "../shared";
import { fetchWalletTransactions, startDeposit, createCryptoWallet, reconcileDeposits, readCache, writeCache, type ApiWalletTx, type CryptoWallet } from "../lib/api";
import { useWalletBalanceQuery, useCryptoWalletsQuery, useInvalidate, qk } from "../lib/query";
import { CRYPTO_ASSETS } from "@/server/schemas";
import { toast } from "../toast";
import type { Page } from "../shared";

type Tab = "deposit" | "withdrawal" | "security";

async function copyText(value: string) {
  try { if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(value); return true; } } catch { /* fallback */ }
  try { const node = document.createElement("textarea"); node.value = value; node.style.cssText = "position:fixed;opacity:0"; document.body.appendChild(node); node.select(); const copied = document.execCommand("copy"); node.remove(); return copied; } catch { return false; }
}

/* Unified wallet ledger entry (deposits + withdrawals from the database) */
interface WTx { id: number | string; kind: "deposit" | "withdrawal"; amount: string; means: string; status: string; txid: string; date: string; }

const formatTxDate = (iso: string) =>
  new Date(iso).toLocaleString([], { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" });

const mapTx = (r: ApiWalletTx): WTx => ({
  id: r.id,
  kind: r.kind,
  amount: Number(r.amount).toFixed(2),
  means: r.means,
  status: r.status,
  // The real, copyable transaction id: the Korapay charge reference, falling back
  // to any stored txid, then the row id. Never a placeholder.
  txid: r.reference || r.txid || `SB-${r.id}`,
  date: formatTxDate(r.created_at),
});

/* Wallet-with-money mark (thin outline wallet + banknote + coin) */
function WalletMoneyIcon({ size = 22, color = "#ff5a37" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 7.5 15.2 4a1.6 1.6 0 0 1 2.1.9l.9 2.4"/>
      <rect x="2.5" y="7.5" width="19" height="13" rx="3"/>
      <path d="M21.5 12h-4a2.2 2.2 0 0 0 0 4.4h4"/>
      <circle cx="17.8" cy="14.2" r="0.4" fill={color}/>
      <path d="M7 11.5h4M7 16.5h2.5"/>
    </svg>
  );
}

function ProtectedShield({ size = 28 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 28 28" aria-label="Funds protected"><circle cx="14" cy="14" r="14" fill="#0dcc68"/><path d="M14 5.5 21 8v5.4c0 4.6-3 7.6-7 9.2-4-1.6-7-4.6-7-9.2V8l7-2.5Z" fill="#087e40"/><path d="m10.5 13.8 2.25 2.25 4.75-5" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}

/* Orange half-filled security shield — matches the "Secured and Trusted" mark in
   the reference (bright shield, darker left half, white check). */
function SecureShield({ size = 22 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-label="Secured"><path d="M12 2.4 20 5.4v6.1c0 5.2-3.4 8.6-8 10.2-4.6-1.6-8-5-8-10.2V5.4L12 2.4Z" fill="#ff6a3d"/><path d="M12 2.4 4 5.4v6.1c0 5.2 3.4 8.6 8 10.2V2.4Z" fill="#d1451f"/><path d="m8.2 12 2.6 2.6 5-5.2" fill="none" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}

/* Premium 3D wallet — matches the reference: glossy orange wallet with a card
   peeking out the top and a white "$" coin/clasp on the front. */
function WalletIllustration() {
  return (
    <svg className="h-24 w-24 sm:h-28 sm:w-28" viewBox="0 0 120 120" fill="none" role="img" aria-label="Wallet illustration">
      <defs>
        <linearGradient id="wBody" x1="18" y1="30" x2="104" y2="104" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffb658"/><stop offset=".5" stopColor="#ff7d31"/><stop offset="1" stopColor="#e04a16"/>
        </linearGradient>
        <linearGradient id="wCard" x1="34" y1="12" x2="92" y2="46" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fff2cc"/><stop offset="1" stopColor="#ffd067"/>
        </linearGradient>
        <linearGradient id="wPocket" x1="18" y1="54" x2="104" y2="100" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ff8f42"/><stop offset="1" stopColor="#d5450f"/>
        </linearGradient>
        <filter id="wShadow" x="-25%" y="-15%" width="150%" height="150%" filterUnits="objectBoundingBox">
          <feDropShadow dx="0" dy="8" stdDeviation="6" floodColor="#8f2c0c" floodOpacity=".38"/>
        </filter>
      </defs>
      <g filter="url(#wShadow)">
        {/* card peeking out the top */}
        <rect x="32" y="12" width="54" height="34" rx="6" transform="rotate(-4 59 29)" fill="url(#wCard)"/>
        {/* wallet body */}
        <rect x="18" y="30" width="84" height="68" rx="15" fill="url(#wBody)"/>
        {/* front pocket panel */}
        <path d="M18 58h84v25a15 15 0 0 1-15 15H33a15 15 0 0 1-15-15V58Z" fill="url(#wPocket)"/>
        {/* soft top-edge highlight on the pocket */}
        <rect x="18" y="55.5" width="84" height="5" rx="2.5" fill="#ffffff" opacity=".14"/>
        {/* right-side strap/clasp */}
        <rect x="90" y="66" width="14" height="18" rx="6" fill="#e6520f"/>
        {/* white $ coin */}
        <circle cx="86" cy="75" r="12.5" fill="#fff"/>
        <circle cx="86" cy="75" r="12.5" fill="none" stroke="#ffd9b8" strokeWidth="1"/>
        <text x="86" y="80.5" textAnchor="middle" fontSize="15" fontWeight="800" fill="#f0641f" fontFamily="system-ui, sans-serif">$</text>
      </g>
    </svg>
  );
}

function TransactionRow({ tx, onOpen }: { tx: WTx; onOpen: () => void }) {
  const isDeposit = tx.kind === "deposit";
  const statusColor = tx.status === "Completed" ? "#0bcc57" : tx.status === "Pending" ? "#f5a623" : "#ff4053";
  return <div role="button" tabIndex={0} onClick={onOpen} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); } }} className="grid min-w-0 cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-[#263448] px-3 py-3 transition hover:border-[#3a4d68] sm:px-4 sm:py-2.5" style={{ background: "var(--sb-fill)" }}>
    <span className={`flex h-9 w-9 items-center justify-center rounded-full ${isDeposit ? "bg-[#143b25] text-[#00c96b]" : "bg-[#461719] text-[#fc553b]"}`}>
      {isDeposit ? <Download01Icon size={18}/> : <Upload01Icon size={18}/>}
    </span>
    <div className="min-w-0">
      <p className="text-[13px] font-bold text-white">{isDeposit ? "Deposit" : "Withdrawal"}</p>
      <p className="mt-0.5 text-[11px] text-[#8fa9c8]">{tx.means}</p>
      <button type="button" onClick={async (e) => { e.stopPropagation(); if (await copyText(tx.txid)) toast.success("Transaction ID copied", { title: "Copied" }); else toast.error("Couldn't copy — try again.", { title: "Copy" }); }} title="Copy transaction ID" className="mt-1 flex max-w-full items-center gap-1.5 text-[10px] text-[#557090] transition hover:text-[#9db8d8]">
        <span className="truncate">TXID: {tx.txid.length > 16 ? `${tx.txid.slice(0, 13)}…` : tx.txid}</span><Copy01Icon size={13} className="shrink-0"/>
      </button>
    </div>
    <div className="flex items-center gap-2">
      <div className="min-w-[100px] text-right sm:min-w-[150px]">
        <p className={`text-[15px] font-bold ${isDeposit ? "text-[#00d66c]" : "text-[#ff7a5c]"}`}>{isDeposit ? "+" : "-"}${tx.amount}</p>
        <p className="mt-1 text-[10px] font-semibold" style={{ color: statusColor }}>
          <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full" style={{ background: statusColor }}/>{tx.status}
        </p>
        <p className="mt-1 hidden text-[9px] text-[#5d7598] sm:block">{tx.date}</p>
      </div>
      <ArrowDown01Icon size={16} className="-rotate-90 shrink-0 text-[#5d7598]"/>
    </div>
  </div>;
}

/* Small filled-orange info dot with a white "i" — the note marker in the crypto
   panels (matches the reference). */
function InfoDot({ size = 24 }: { size?: number }) {
  return <span className="flex shrink-0 items-center justify-center rounded-full font-bold text-white" style={{ width: size, height: size, background: P, fontSize: size * 0.62, lineHeight: 1 }}>i</span>;
}

/* Real brand logos for each coin (inline SVG — CSP-safe, no external requests).
   Keyed on the base currency; USDT/USDC variants share their token logo. */
const COIN_LOGOS: Record<string, React.ReactNode> = {
  BTC: <><circle cx="16" cy="16" r="16" fill="#f7931a"/><path fill="#fff" d="M23.19 14.02c.31-2.1-1.28-3.22-3.47-3.98l.71-2.84-1.73-.43-.69 2.77c-.45-.12-.92-.22-1.38-.33l.69-2.78L15.6 6l-.71 2.84c-.38-.09-.75-.17-1.1-.26v-.01l-2.39-.6-.46 1.85s1.28.3 1.26.31c.7.18.83.64.8 1l-.8 3.24c.05.01.11.03.18.06l-.19-.05-1.13 4.53c-.09.21-.3.53-.79.41.02.03-1.26-.31-1.26-.31l-.86 1.98 2.25.56c.42.1.83.22 1.23.32l-.71 2.87 1.72.43.71-2.84c.47.13.93.25 1.38.36l-.71 2.83 1.73.43.72-2.87c2.95.56 5.16.33 6.09-2.33.75-2.15-.04-3.39-1.59-4.19 1.13-.26 1.98-1 2.21-2.54zm-3.95 5.54c-.53 2.15-4.15.99-5.32.7l.95-3.81c1.17.29 4.93.87 4.37 3.11zm.54-5.57c-.49 1.95-3.5.96-4.47.72l.86-3.45c.98.24 4.12.7 3.61 2.73z"/></>,
  ETH: <><circle cx="16" cy="16" r="16" fill="#627eea"/><g fill="#fff"><path fillOpacity=".6" d="M16.5 4v8.87l7.5 3.35z"/><path d="M16.5 4 9 16.22l7.5-3.35z"/><path fillOpacity=".6" d="M16.5 21.97V28L24 17.62z"/><path d="M16.5 28v-6.03L9 17.62z"/><path fillOpacity=".2" d="m16.5 20.57 7.5-4.35-7.5-3.35z"/><path fillOpacity=".6" d="m9 16.22 7.5 4.35v-7.7z"/></g></>,
  LTC: <><circle cx="16" cy="16" r="16" fill="#345d9d"/><path fill="#fff" d="M10.43 19.21 9 19.77l.63-2.44 1.44-.55L13.45 8h3.98l-1.87 7.62 1.41-.55-.59 2.34-1.42.55-.8 3.3h7.58l-.7 2.74H9.57z"/></>,
  USDT: <><circle cx="16" cy="16" r="16" fill="#26a17b"/><path fill="#fff" d="M17.92 17.38c-.11.01-.68.04-1.94.04-1.01 0-1.72-.03-1.97-.04-3.89-.17-6.79-.85-6.79-1.66s2.9-1.48 6.79-1.66v2.65c.25.01.98.06 1.99.06 1.2 0 1.81-.05 1.92-.06v-2.64c3.88.17 6.78.85 6.78 1.65s-2.9 1.49-6.78 1.66m0-3.59v-2.37h5.42V7.82H8.6v3.61h5.41v2.36c-4.4.2-7.71 1.07-7.71 2.12s3.31 1.91 7.71 2.12v7.58h3.91v-7.58c4.39-.2 7.69-1.07 7.69-2.12s-3.3-1.91-7.69-2.12"/></>,
  BNB: <><circle cx="16" cy="16" r="16" fill="#f3ba2f"/><path fill="#fff" d="M12.12 14.4 16 10.52l3.89 3.89 2.26-2.26L16 6l-6.14 6.14zM6 16l2.26-2.26L10.52 16l-2.26 2.26zm6.12 1.6L16 21.48l3.89-3.89 2.26 2.26L16 26l-6.14-6.14zM21.48 16l2.26-2.26L26 16l-2.26 2.26zm-3.19 0L16 18.29l-1.7-1.69-.19-.2-.4-.4L16 13.71l2.29 2.29z"/></>,
  TRX: <><circle cx="16" cy="16" r="16" fill="#ef0027"/><path fill="#fff" d="M21.93 9.91 7.5 7.26l7.6 19.11 10-12.17zm-.23 1.09 1.87 2.52-5.1.92zm-5.08 3.2-5.53-4.59 8.99 1.66zm-.31.72-.87 7.16-4.9-12.31zm.81.18 5.58-1.01-6.38 7.76z"/></>,
  USDC: <><circle cx="16" cy="16" r="16" fill="#2775ca"/><path fill="#fff" d="M20.5 18.5c0-2.4-1.5-3.2-4.4-3.6-2.1-.3-2.5-.8-2.5-1.8s.7-1.6 2.1-1.6c1.3 0 2 .4 2.3 1.5.1.2.3.4.5.4h1.1c.3 0 .5-.2.5-.5v-.1c-.3-1.4-1.4-2.5-2.9-2.6V9c0-.3-.2-.5-.6-.6h-1c-.3 0-.5.2-.6.6v1.1c-2.1.3-3.4 1.7-3.4 3.5 0 2.3 1.4 3.1 4.3 3.5 2 .4 2.6.8 2.6 1.9s-1 1.9-2.3 1.9c-1.8 0-2.4-.8-2.6-1.8-.1-.3-.3-.4-.5-.4h-1.2c-.3 0-.5.2-.5.5v.1c.3 1.6 1.3 2.7 3.6 3v1.1c0 .3.2.5.6.6h1c.3 0 .5-.2.6-.6v-1.1c2.1-.4 3.5-1.8 3.5-3.7"/><path fill="#fff" d="M13 24.6c-3.5-1.3-5.3-5.2-4-8.7.7-1.9 2.1-3.3 4-4 .2-.1.3-.3.3-.6v-1c0-.2-.1-.4-.3-.5h-.4c-4.3 1.4-6.7 6-5.3 10.3.8 2.5 2.8 4.5 5.3 5.3.2.1.5 0 .5-.3v-.1c0-.3-.1-.4-.1-.6zm6.4-14.7c-.2.1-.5 0-.5.3v.1c0 .3.1.4.1.6 3.5 1.3 5.3 5.2 4 8.7-.7 1.9-2.1 3.3-4 4-.2.1-.3.3-.3.6v1c0 .2.1.4.3.5h.4c4.3-1.4 6.7-6 5.3-10.3-.8-2.5-2.8-4.5-5.3-5.3"/></>,
};
function CoinBadge({ asset, size = 28 }: { asset: { currency: string; color: string; symbol: string }; size?: number }) {
  const logo = COIN_LOGOS[asset.currency];
  if (logo) return <svg width={size} height={size} viewBox="0 0 32 32" className="shrink-0" role="img" aria-label={asset.currency}>{logo}</svg>;
  return <span className="flex shrink-0 items-center justify-center rounded-full font-black text-white" style={{ width: size, height: size, background: asset.color, fontSize: size * 0.5 }}>{asset.symbol}</span>;
}

/* Reusable "Before you deposit" safety note. */
function DepositWarning({ currency }: { currency: string }) {
  return <div className="mt-4 rounded-2xl border px-4 py-4" style={{ background: "rgba(240,78,35,0.08)", borderColor: "rgba(240,78,35,0.45)" }}>
    <div className="flex gap-3"><InfoDot size={24}/><div><h4 className="text-[13.5px] font-bold">Before you deposit</h4>
      <ul className="mt-2 list-disc space-y-1.5 pl-4 text-[12px] leading-[1.5]" style={{ color: "var(--sb-chip-text)" }}>
        <li>Deposits below ~8 USD may not be processed.</li>
        <li>Send only <b style={{ color: "#e7d4ce" }}>{currency}</b> to this address.</li>
        <li>Make sure you use the correct network. Incorrect network may lead to loss of funds.</li>
      </ul></div></div>
  </div>;
}

/* Crypto deposit tab: generate per-asset static wallets (Heleket), then show a
   QR + address to deposit to. States: loading → empty → currency picker →
   wallet list with the selected asset's address. */
function CryptoDeposit({ active }: { active: boolean }) {
  const invalidate = useInvalidate();
  const { data, isLoading } = useCryptoWalletsQuery(active);
  const wallets = useMemo<CryptoWallet[]>(() => data?.wallets ?? [], [data]);
  const [mode, setMode] = useState<"list" | "picker">("list");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pickAsset, setPickAsset] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => { if (wallets.length && !wallets.some((w) => w.asset === selectedId)) setSelectedId(wallets[0].asset); }, [wallets, selectedId]);

  const shown = wallets.find((w) => w.asset === selectedId) ?? wallets[0];
  const createdIds = new Set(wallets.map((w) => w.asset));
  const available = CRYPTO_ASSETS.filter((a) => !createdIds.has(a.id));
  const pickMeta = CRYPTO_ASSETS.find((a) => a.id === pickAsset);

  const create = async () => {
    if (!pickAsset || creating) return;
    setCreating(true);
    const r = await createCryptoWallet(pickAsset);
    setCreating(false);
    if (!r.ok || !r.wallet) { toast.error(r.error ?? "Could not create the wallet.", { title: "Crypto wallet" }); return; }
    await invalidate([[...qk.cryptoWallets]]);
    toast.success("Static wallet created successfully", { title: "Crypto" });
    setSelectedId(r.wallet.asset); setPickAsset(null); setMode("list");
  };

  const copyAddress = async () => {
    if (!shown) return;
    if (await copyText(shown.address)) toast.success("Address copied", { title: "Copied" });
    else toast.error("Couldn't copy — try again.", { title: "Copy" });
  };

  if (isLoading) return <div className="mt-5 space-y-3"><Skeleton className="h-4 w-40"/><div className="flex gap-2.5">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-[50px] w-28" rounded="rounded-2xl"/>)}</div><Skeleton className="mt-2 h-44 w-full" rounded="rounded-2xl"/><Skeleton className="h-[52px] w-full" rounded="rounded-2xl"/></div>;

  // ── Currency picker (create a wallet) ──
  if (mode === "picker") {
    return <>
      <div className="mt-5 flex items-center justify-between">
        <h3 className="text-[16px] font-bold">{wallets.length ? "Add a static wallet" : "Create your first static wallet"}</h3>
        {wallets.length > 0 && <button onClick={() => { setMode("list"); setPickAsset(null); }} className="text-[12.5px] font-semibold" style={{ color: "var(--sb-chip-text)" }}>Back</button>}
      </div>
      <div className="mt-3 flex gap-3 rounded-2xl border px-4 py-3.5" style={{ background: "rgba(240,78,35,0.08)", borderColor: "rgba(240,78,35,0.45)" }}>
        <InfoDot size={24}/><div><h4 className="text-[13.5px] font-bold">Choose a currency</h4><p className="mt-1 text-[12.5px] leading-[1.5]" style={{ color: "var(--sb-chip-text)" }}>Select a cryptocurrency below, then tap <b style={{ color: "#e7d4ce" }}>Create Wallet</b> to add it to your list.</p></div>
      </div>
      {available.length === 0 ? <p className="mt-5 text-center text-[13px]" style={{ color: "var(--sb-chip-text)" }}>You&apos;ve created every available wallet.</p> :
        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3">{available.map((a) => <button key={a.id} onClick={() => setPickAsset(a.id)} className="flex h-[52px] items-center gap-2 rounded-2xl border px-2.5 text-left transition" style={pickAsset === a.id ? { borderColor: P, background: "rgba(240,78,35,0.10)" } : { background: "var(--sb-chip)", borderColor: "var(--sb-bd)" }}><CoinBadge asset={a}/><b className="truncate text-[12.5px]">{a.label}</b></button>)}</div>}
      <button onClick={create} disabled={!pickAsset || creating} className="mt-5 inline-flex h-[52px] w-full items-center justify-center gap-2.5 rounded-full text-[15px] font-bold transition hover:opacity-90 active:scale-[.99] disabled:cursor-not-allowed disabled:opacity-55" style={{ background: P, color: "#fff" }}>
        {creating && <svg className="animate-spin" width="17" height="17" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="#fff" strokeOpacity=".3" strokeWidth="2.6"/><path d="M21 12a9 9 0 0 0-9-9" stroke="#fff" strokeWidth="2.6" strokeLinecap="round"/></svg>}
        {creating ? "Creating wallet…" : pickMeta ? `Create ${pickMeta.label} Wallet` : "Select a currency first"}
      </button>
    </>;
  }

  // ── Empty state ──
  if (wallets.length === 0) {
    return <>
      <h3 className="mt-5 text-[15px] font-bold">My static wallets</h3>
      <div className="mt-3 rounded-2xl border p-5" style={{ background: "var(--sb-chip)", borderColor: "var(--sb-bd)" }}>
        <h4 className="text-[17px] font-bold">No static wallets yet</h4>
        <p className="mt-2 text-[13px] leading-[1.55]" style={{ color: "var(--sb-chip-text)" }}>Create a static wallet to start receiving crypto payments. Each coin gets its own unique deposit address that credits your balance automatically.</p>
        <button onClick={() => { setPickAsset(null); setMode("picker"); }} className="mt-4 h-[52px] w-full rounded-full text-[15px] font-bold transition hover:opacity-90 active:scale-[.99]" style={{ background: P, color: "#fff" }}>Create Wallet</button>
      </div>
    </>;
  }

  // ── Wallet list + selected address ──
  const meta = CRYPTO_ASSETS.find((a) => a.id === shown?.asset);
  return <>
    <h3 className="mt-5 text-[15px] font-bold">My static wallets</h3>
    <div className="mt-3 flex flex-wrap gap-2.5">{wallets.map((w) => { const m = CRYPTO_ASSETS.find((a) => a.id === w.asset)!; return <button key={w.id} onClick={() => setSelectedId(w.asset)} className="flex h-[50px] items-center gap-2 rounded-2xl border px-3 transition" style={shown?.asset === w.asset ? { borderColor: P, background: "rgba(240,78,35,0.10)" } : { background: "var(--sb-chip)", borderColor: "var(--sb-bd)" }}><CoinBadge asset={m} size={26}/><b className="text-[13.5px]">{m.label}</b></button>; })}</div>
    {shown && <>
      <div className="mt-4 rounded-2xl p-5" style={{ background: "#0b0c0f", border: "1px solid var(--sb-bd)" }}>
        <div className="mx-auto w-fit rounded-xl bg-white p-3"><QRCodeSVG value={shown.address} size={158} bgColor="#ffffff" fgColor="#0b0c0f"/></div>
      </div>
      <div className="mt-4 flex min-w-0 items-center gap-2 rounded-2xl px-4 py-3" style={{ background: "var(--sb-chip)" }}>
        <span className="min-w-0 flex-1 truncate text-[13px]">{shown.address}</span>
        <button onClick={copyAddress} aria-label="Copy address" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition hover:opacity-90 active:scale-95" style={{ background: P }}><Copy01Icon size={18} color="#fff"/></button>
      </div>
      <DepositWarning currency={meta?.currency ?? shown.currency}/>
    </>}
    <button onClick={() => { setPickAsset(null); setMode("picker"); }} className="mt-5 h-[52px] w-full rounded-2xl border border-dashed text-[14px] font-bold transition hover:opacity-90" style={{ borderColor: "rgba(240,78,35,0.6)", color: P }}>+ Add new wallet</button>
  </>;
}

/* Full transaction-details page — opened from a history row. Premium, organized
   layout: hero (amount + status), itemised breakdown, status timeline, and a
   support action. Uses the app's hugeicons set for a consistent icon language. */
function TransactionDetailPage({ tx, onBack, setPage }: { tx: WTx; onBack: () => void; setPage: (page: Page) => void }) {
  const isDeposit = tx.kind === "deposit";
  const done = tx.status === "Completed";
  const failed = tx.status === "Failed";
  const sc = done ? "#0bcc57" : tx.status === "Pending" ? "#f5a623" : "#ff4053";
  const copyTxid = async () => { if (await copyText(tx.txid)) toast.success("Transaction ID copied", { title: "Copied" }); else toast.error("Couldn't copy — try again.", { title: "Copy" }); };
  const StatusIco = ({ size = 17 }: { size?: number }) => done ? <CheckmarkCircle02Icon size={size}/> : failed ? <CancelCircleIcon size={size}/> : <Clock01Icon size={size}/>;
  const StatusPill = () => <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-bold" style={{ background: `${sc}22`, color: sc }}><StatusIco size={14}/>{tx.status}</span>;
  const rows: { label: string; icon: React.ReactNode; value: React.ReactNode }[] = [
    { label: "Type", icon: <DiscountTag01Icon size={17}/>, value: isDeposit ? "Deposit" : "Withdrawal" },
    { label: "Payment method", icon: <Wallet01Icon size={17}/>, value: tx.means },
    { label: "Status", icon: <StatusIco/>, value: <StatusPill/> },
    { label: "Date & time", icon: <Calendar03Icon size={17}/>, value: tx.date },
    { label: "Transaction ID", icon: <HashtagIcon size={17}/>, value: (
      <button onClick={copyTxid} className="inline-flex max-w-[150px] items-center gap-1.5 transition hover:opacity-80 sm:max-w-[240px]" title="Copy transaction ID">
        <span className="truncate font-mono text-[12.5px]">{tx.txid}</span><Copy01Icon size={14} className="shrink-0" style={{ color: P }}/>
      </button>
    ) },
  ];
  // 3-step status journey. States: done (green) · active (orange, in progress) ·
  // pending (grey, not reached) · failed (red).
  type StepState = "done" | "active" | "pending" | "failed";
  const timeline: { title: string; desc: string; state: StepState }[] = [
    { title: "Initiated", desc: `${isDeposit ? "Deposit" : "Withdrawal"} request created`, state: "done" },
    { title: "Processing", desc: "Confirming with the payment provider", state: done ? "done" : failed ? "failed" : "active" },
    { title: failed ? "Failed" : "Completed", desc: failed ? "This transaction could not be processed" : done ? (isDeposit ? "Funds credited to your wallet" : "Funds sent successfully") : "Awaiting final confirmation", state: done ? "done" : failed ? "pending" : "pending" },
  ];
  const stepColor = (s: StepState) => s === "done" ? "#0bcc57" : s === "active" ? "#f5a623" : s === "failed" ? "#ff4053" : "var(--sb-chip-text)";
  return <div className="min-h-screen overflow-x-clip text-white" style={{ background: MBG, fontFamily: FONT }}>
    <DesktopTopNav setPage={setPage} active="wallet"/>
    <AppMobileHeader className="md:hidden" setPage={setPage}/>
    <main className="mx-auto w-full max-w-[600px] px-4 pb-28 pt-6 sm:px-6 md:pt-8">
      <button onClick={onBack} className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold transition hover:opacity-80" style={{ color: "var(--sb-chip-text)" }}>
        <ArrowLeft01Icon size={18}/>Back to wallet
      </button>
      <h1 className="mt-4 text-[22px] font-bold tracking-[-.03em]">Transaction Details</h1>

      <section className="mt-5 rounded-3xl border p-7 text-center" style={{ background: "var(--sb-card)", borderColor: "var(--sb-bd)" }}>
        <span className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${isDeposit ? "bg-[#143b25] text-[#00c96b]" : "bg-[#461719] text-[#fc553b]"}`}>
          {isDeposit ? <Download01Icon size={30}/> : <Upload01Icon size={30}/>}
        </span>
        <p className="mt-4 text-[34px] font-bold tracking-[-.03em]" style={{ color: isDeposit ? "#00d66c" : "#ff7a5c" }}>{isDeposit ? "+" : "-"}${tx.amount}</p>
        <p className="mt-1 text-[13px]" style={{ color: "var(--sb-chip-text)" }}>{isDeposit ? "Deposit to wallet" : "Withdrawal from wallet"}</p>
        <div className="mt-3 flex justify-center"><StatusPill/></div>
      </section>

      <section className="mt-4 overflow-hidden rounded-3xl border" style={{ background: "var(--sb-card)", borderColor: "var(--sb-bd)" }}>
        {rows.map((r, i) => <div key={r.label} className="flex items-center justify-between gap-3 px-4 py-3.5" style={i ? { borderTop: "1px solid var(--sb-bd)" } : undefined}>
          <span className="flex items-center gap-2.5 text-[13px]" style={{ color: "var(--sb-chip-text)" }}>{r.icon}{r.label}</span>
          <span className="text-right text-[13.5px] font-semibold">{r.value}</span>
        </div>)}
      </section>

      <section className="mt-4 rounded-3xl border p-5" style={{ background: "var(--sb-card)", borderColor: "var(--sb-bd)" }}>
        <h3 className="text-[13px] font-bold" style={{ color: "var(--sb-chip-text)" }}>Status timeline</h3>
        <ol className="mt-3.5">
          {timeline.map((step, i) => { const col = stepColor(step.state); const last = i === timeline.length - 1; return <li key={step.title} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span className="flex h-6 w-6 items-center justify-center rounded-full" style={{ background: step.state === "pending" ? "var(--sb-chip)" : `${col === "var(--sb-chip-text)" ? "#8892a0" : col}22`, color: col }}>
                {step.state === "done" ? <CheckmarkCircle02Icon size={16}/> : step.state === "failed" ? <CancelCircleIcon size={16}/> : step.state === "active" ? <Clock01Icon size={16}/> : <span className="h-2 w-2 rounded-full" style={{ background: "currentColor" }}/>}
              </span>
              {!last && <span className="my-1 w-px flex-1" style={{ background: "var(--sb-bd)" }}/>}
            </div>
            <div className={last ? "" : "pb-4"}>
              <p className="text-[13.5px] font-semibold" style={step.state === "pending" ? { color: "var(--sb-chip-text)" } : undefined}>{step.title}</p>
              <p className="mt-0.5 text-[11.5px]" style={{ color: "var(--sb-chip-text)" }}>{step.desc}</p>
            </div>
          </li>; })}
        </ol>
      </section>

      <button onClick={() => setPage("support")} className="mt-4 flex w-full items-center justify-between rounded-2xl border px-4 py-4 text-left transition hover:opacity-90" style={{ background: "var(--sb-card)", borderColor: "var(--sb-bd)" }}>
        <span className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-full" style={{ background: "rgba(240,78,35,0.12)", color: P }}><CustomerSupportIcon size={19}/></span><span><span className="block text-[13.5px] font-semibold">Report a problem</span><span className="block text-[11.5px]" style={{ color: "var(--sb-chip-text)" }}>Get help with this transaction</span></span></span>
        <ArrowRight01Icon size={18} style={{ color: "var(--sb-chip-text)" }}/>
      </button>

      <div className="mt-4 flex items-start gap-3 rounded-2xl border px-4 py-3.5" style={{ background: "rgba(13,204,104,0.08)", borderColor: "rgba(13,204,104,0.4)" }}>
        <span className="mt-0.5 shrink-0"><ProtectedShield size={20}/></span>
        <p className="text-[12px] leading-[1.5]" style={{ color: "var(--sb-chip-text)" }}>This transaction is secured and recorded on your account. Keep your Transaction ID for any support enquiry.</p>
      </div>
    </main>
  </div>;
}

export function WalletPage({ setPage }: { setPage: (page: Page) => void }) {
  const [tab, setTab] = useState<Tab>("deposit");
  const [showAllTx, setShowAllTx] = useState(false);
  const seller = Boolean(useProfile().is_seller);
  const [withdrawing, setWithdrawing] = useState(false);
  const [wAmount, setWAmount] = useState("");
  // The account's own live ledger — no demo fallback. A new wallet is empty.
  const [ledger, setLedger] = useState<WTx[]>(() => readCache<WTx[]>("sb-wallet-tx") ?? []);
  // Real balance from the server (authoritative — includes sales and purchases),
  // served through TanStack Query so it's cached + shared with the rest of the app.
  const { data: balData, isFetched: balFetched } = useWalletBalanceQuery();
  const balance = useMemo(() => balData ?? readCache<number>("sb-wallet-balance") ?? 0, [balData]);
  useEffect(() => { if (balData != null) writeCache("sb-wallet-balance", balData); }, [balData]);
  // Loading gate — always show a visible skeleton beat, then the real data.
  const { loaded: txLoaded, finishLoading: finishTx } = useLoadGate(600);
  const { loaded: balLoaded, finishLoading: finishBal } = useLoadGate(600);
  useEffect(() => { if (balFetched) finishBal(); }, [balFetched, finishBal]);
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const rows = await fetchWalletTransactions().catch(() => null);
      if (cancelled) return;
      if (rows) { const mapped = rows.map(mapTx); writeCache("sb-wallet-tx", mapped); setLedger(mapped); }
    };
    (async () => {
      await load();          // show current history fast
      finishTx();
      // Then reconcile pending deposits with Korapay and refresh if any changed,
      // so statuses reflect the real payment outcome instead of a stuck "Pending".
      try { const r = await reconcileDeposits(); if (!cancelled && r.updated > 0) await load(); } catch { /* best-effort */ }
    })();
    return () => { cancelled = true; };
  }, []);
  // Deposits/withdrawals are disabled until the payment provider is integrated.
  const [comingSoon, setComingSoon] = useState("");
  // Selected history row → opens the full transaction-details page.
  const [detailTx, setDetailTx] = useState<WTx | null>(null);
  // Capture ?tx= from the URL once at first render (before the role-based URL
  // effect normalises the path) so a refresh can restore the details view.
  const [pendingTxId, setPendingTxId] = useState<string | null>(() => {
    try { return typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("tx") : null; } catch { return null; }
  });
  // Premium role-based URL: buyers get /account/wallet, sellers /seller/wallet
  useEffect(() => {
    try {
      const base = seller ? "/seller/wallet" : "/account/wallet";
      const url = detailTx ? `${base}?tx=${encodeURIComponent(String(detailTx.id))}` : base;
      if (window.location.pathname + window.location.search !== url) window.history.replaceState({}, "", url);
    } catch { /* ignore */ }
  }, [seller, detailTx]);
  // Restore the details view from ?tx= after a refresh — once the fetch has
  // settled (txLoaded), whether or not the ledger has any rows. Gating on
  // `txLoaded` (not `ledger.length`) means an unknown/empty id resolves too,
  // so we never get stuck on the loading screen.
  useEffect(() => {
    if (!pendingTxId || !txLoaded) return;
    const found = ledger.find((t) => String(t.id) === pendingTxId);
    if (found) setDetailTx(found);
    setPendingTxId(null);
  }, [txLoaded, ledger, pendingTxId]);
  const deposits = ledger.filter(t => t.kind === "deposit");
  const withdrawalsList = ledger.filter(t => t.kind === "withdrawal");
  const totalDeposited = deposits.filter(t => t.status === "Completed").reduce((s, t) => s + Number(t.amount), 0);
  const totalWithdrawn = withdrawalsList.filter(t => t.status === "Completed").reduce((s, t) => s + Number(t.amount), 0);
  // Withdrawals don't process yet — the payout provider isn't connected.
  const requestWithdrawal = () => {
    setWithdrawing(false);
    setWAmount("");
    setComingSoon("Withdrawals aren't available yet — payout processing is being set up. You'll be able to withdraw as soon as it's live.");
  };
  const [showBalance, setShowBalance] = useState(true);
  const [funding, setFunding] = useState(false);
  // Lock background scroll whenever any wallet modal is open.
  useScrollLock(withdrawing || funding || Boolean(comingSoon));
  const [fundTab, setFundTab] = useState<"local" | "crypto">("local");
  const [currency, setCurrency] = useState("NGN");
  const [amount, setAmount] = useState("");
  const [notice, setNotice] = useState(false);
  const [depositing, setDepositing] = useState(false);
  // Brief skeleton on modal open so the popup resolves like a premium surface.
  const [fundReady, setFundReady] = useState(false);
  useEffect(() => {
    if (!funding) { setFundReady(false); return; }
    const t = setTimeout(() => setFundReady(true), 600);
    return () => clearTimeout(t);
  }, [funding]);
  const invalidate = useInvalidate();
  // Kick off a Korapay deposit: validate the USD amount, get the hosted checkout
  // URL from our server, and redirect. The wallet is credited only by the webhook.
  const beginDeposit = async () => {
    const usd = Number.parseFloat(amount);
    if (!Number.isFinite(usd) || usd < 1) { toast.error("Enter an amount of at least $1.", { title: "Deposit" }); return; }
    if (usd > 10000) { toast.error("Maximum deposit is $10,000.", { title: "Deposit" }); return; }
    setDepositing(true);
    const r = await startDeposit(usd, currency);
    setDepositing(false);
    if (!r.ok || !r.checkout_url) { toast.error(r.error ?? "Could not start the deposit.", { title: "Deposit" }); return; }
    window.location.href = r.checkout_url; // Korapay hosted checkout
  };
  // Returning from Korapay's checkout → confirm the balance in the background.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (new URLSearchParams(window.location.search).get("deposit") === "processing") {
      toast.success("We're confirming your payment — your balance updates the moment it clears.", { title: "Deposit received" });
      invalidate([[...qk.wallet]]);
      window.history.replaceState({}, "", "/wallet");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const tabItems: { id: Tab; label: string }[] = [{ id: "deposit", label: "Deposit History" }, { id: "withdrawal", label: "Withdrawal History" }, { id: "security", label: "Security" }];
  const exchangeRates: Record<string, { symbol: string; rate: number }> = { NGN: { symbol: "₦", rate: 1588 }, GHS: { symbol: "GH₵", rate: 15.4 }, KES: { symbol: "KSh", rate: 129 }, ZAR: { symbol: "R", rate: 18.2 }, XOF: { symbol: "CFA", rate: 603 } };
  const parsedAmount = Number.parseFloat(amount);
  // Live local-currency estimate (amount + 5% markup). The server re-computes this
  // with Korapay's live rate at checkout — this is a close on-screen preview.
  const converted = Number.isFinite(parsedAmount) ? parsedAmount * 1.05 * exchangeRates[currency].rate : 0;
  const rateLabel = `≈ ${exchangeRates[currency].symbol}${converted.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  if (detailTx) return <TransactionDetailPage tx={detailTx} onBack={() => setDetailTx(null)} setPage={setPage}/>;
  // Restoring a details view from ?tx= after a refresh — show a brief loader
  // instead of flashing the wallet page before the transaction resolves.
  if (pendingTxId) return <div className="flex min-h-screen flex-col overflow-x-clip text-white" style={{ background: MBG, fontFamily: FONT }}>
    <DesktopTopNav setPage={setPage} active="wallet"/>
    <AppMobileHeader className="md:hidden" setPage={setPage}/>
    <div className="flex flex-1 items-center justify-center">
      <svg className="animate-spin" width="26" height="26" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".2" strokeWidth="2.6"/><path d="M21 12a9 9 0 0 0-9-9" stroke={P} strokeWidth="2.6" strokeLinecap="round"/></svg>
    </div>
  </div>;
  return <div className="min-h-screen overflow-x-clip text-white" style={{ background: MBG, fontFamily: FONT }}>
    <DesktopTopNav setPage={setPage} active="wallet" />
    <AppMobileHeader className="md:hidden" setPage={setPage}/>
    <main className="mx-auto w-full max-w-[760px] px-4 pb-28 pt-7 sm:px-6 md:px-8 md:pt-9">
      <header><h1 className="text-[26px] font-bold tracking-[-.04em] sm:text-[30px]">Wallet</h1><p className="mt-1 text-[13px] text-[#9cc3ed]">Manage your balance and transactions securely</p></header>
      <section className="relative mt-6 min-h-[158px] overflow-hidden rounded-[20px] bg-[linear-gradient(105deg,#ff4f2b_0%,#ff6340_53%,#ee7768_100%)] px-7 py-6 shadow-[0_18px_40px_rgba(240,78,35,.16)] sm:px-7"><div className="absolute inset-0 bg-[radial-gradient(ellipse_75%_100%_at_18%_45%,rgba(255,255,255,.14),transparent_66%)]"/><div className="relative z-10"><p className="text-[12px] font-medium text-white">Account balance</p><div className="mt-2 flex items-center gap-2">{!balLoaded ? <Skeleton className="h-[30px] w-32" style={{ background: "rgba(255,255,255,.35)" }}/> : <span className="text-[26px] font-bold tracking-[-.035em]">{showBalance ? `$${balance.toFixed(2)}` : "$••••"}</span>}<button onClick={() => setShowBalance((value) => !value)} aria-label="Toggle balance visibility" className="rounded p-1 text-white/90 hover:bg-white/10">{showBalance ? <ViewIcon size={17}/> : <ViewOffIcon size={17}/>}</button></div><div className="mt-4 flex items-center gap-2.5"><button onClick={() => setFunding(true)} className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2.5 text-[13px] font-semibold text-[#f04e23] transition hover:bg-[#fff5f2] active:scale-95"><Download01Icon size={16}/>Deposit</button>{seller && <button onClick={() => setWithdrawing(true)} className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2.5 text-[13px] font-semibold text-[#f04e23] transition hover:bg-[#fff5f2] active:scale-95"><Upload01Icon size={16}/>Withdraw</button>}</div></div><div className="pointer-events-none absolute right-4 top-1/2 z-10 -translate-y-1/2 sm:right-6"><WalletIllustration /></div></section>
      <section className="mt-5 flex items-start gap-3 rounded-[18px] bg-[#173b25] px-5 py-3"><span className="mt-0.5 shrink-0"><ProtectedShield /></span><div><h2 className="text-[14px] font-bold">Funds Protected</h2><p className="mt-1 text-[11px] text-white">Merchant earnings are held securely and released only after successful transaction completion.</p></div></section>
      <section className="mt-5 grid grid-cols-2 rounded-[18px] px-3 py-3 sm:px-4" style={{ background: "var(--sb-fill)" }}><div className="flex min-w-0 items-center gap-4 border-r border-[#28374b] px-1 py-1 sm:px-2"><span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#123e28] text-[#00cd69]"><Download01Icon size={22}/></span><div><p className="text-[12px] font-semibold">Total Deposit</p><p className="text-[15px] font-bold">${totalDeposited.toFixed(2)}</p><p className="text-[11px] text-[#a9c0db]">All time</p></div></div><div className="flex min-w-0 items-center gap-4 px-3 py-1 sm:px-5"><span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#461719] text-[#fc553b]"><Upload01Icon size={22}/></span><div><p className="text-[12px] font-semibold">Total Withdrawal</p><p className="text-[15px] font-bold">${totalWithdrawn.toFixed(2)}</p><p className="text-[11px] text-[#a9c0db]">All time</p></div></div></section>
      <section className="mt-6"><div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><span className="sb-glow" aria-hidden="true"/><div className="relative flex gap-5 border-b border-[#263448]">{tabItems.map((item) => <button onClick={() => setTab(item.id)} key={item.id} className={`relative pb-3 text-[13px] font-semibold ${tab === item.id ? "text-[#f04e23]" : "text-white"}`}>{item.label}{tab === item.id && <span className="absolute inset-x-0 bottom-[-1px] h-px bg-[#f04e23]"/>}</button>)}</div><button onClick={() => setNotice(true)} className="relative hidden rounded-lg bg-[#f04e23] px-5 py-2.5 text-[13px] font-bold transition hover:bg-[#ff623a] active:scale-95 sm:block sm:self-auto">Report Transaction</button></div>{tab === "security" ? <div className="mt-4 rounded-2xl border border-[#263448] p-7 text-center" style={{ background: "var(--sb-fill)" }}><ProtectedShield size={34}/><h3 className="mt-3 text-[16px] font-bold">Wallet security</h3><p className="mx-auto mt-2 max-w-sm text-[13px] leading-5 text-[#91a7c5]">Your wallet is protected with secured transaction processing and merchant escrow safeguards.</p></div> : !txLoaded ? <div className="mt-4 space-y-2.5">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="flex items-center gap-3 rounded-2xl px-4 py-3.5" style={{ background: "var(--sb-fill)" }}><Skeleton className="h-10 w-10" rounded="rounded-full"/><div className="flex-1 space-y-2"><Skeleton className="h-3 w-2/5"/><Skeleton className="h-2.5 w-1/4"/></div><Skeleton className="h-4 w-16"/></div>)}</div> : <div className="mt-4 space-y-2.5">{(tab === "withdrawal" ? withdrawalsList : deposits).slice(0, showAllTx ? undefined : 4).map((tx) => <TransactionRow key={tx.id} tx={tx} onOpen={() => setDetailTx(tx)}/>)}</div>}<button onClick={() => setShowAllTx(v => !v)} className="mx-auto mt-5 flex items-center gap-1 text-[12px] font-semibold text-[#f04e23]">{showAllTx ? "Show less" : "View all transaction"} <ArrowDown01Icon size={14} className={showAllTx ? "rotate-180" : ""}/></button></section>
    </main>
    <button onClick={() => setPage("support")} aria-label="Open support" className="fixed bottom-6 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#f04e23] text-white shadow-[0_12px_28px_rgba(0,0,0,.35)] transition hover:scale-105 active:scale-95">?</button>
    {withdrawing && seller && (
      <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4 backdrop-blur-[2px]" onClick={() => setWithdrawing(false)}>
        <div onClick={(e) => e.stopPropagation()} className="w-full max-w-[440px] rounded-[24px] p-6" style={{ background: "var(--sb-card)", border: "1px solid var(--sb-bd)" }}>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3.5">
              <span className="flex h-11 w-11 items-center justify-center rounded-lg" style={{ background: "rgba(240,78,35,0.12)", color: P }}><Upload01Icon size={24}/></span>
              <div>
                <h2 className="text-[20px] font-bold tracking-[-.02em]">Withdraw Funds</h2>
                <p className="mt-0.5 text-[13px]" style={{ color: "var(--sb-chip-text)" }}>Transfer your earnings to your bank</p>
              </div>
            </div>
            <button onClick={() => setWithdrawing(false)} aria-label="Close" className="rounded-full p-1 text-white transition hover:rotate-90 duration-200"><Cancel01Icon size={20}/></button>
          </div>
          <label className="mt-5 block text-[14px] font-bold">Amount
            <div className="mt-2 flex flex-col items-center rounded-[18px] py-4" style={{ background: "var(--sb-chip)" }}>
              <div className="flex items-center gap-2">
                <span className="text-[20px]" style={{ color: "var(--sb-chip-text)" }}>$</span>
                <input value={wAmount} onChange={(e) => setWAmount(e.target.value)} inputMode="decimal" placeholder="0" className="w-32 bg-transparent text-center text-[36px] font-bold tracking-[-.04em] outline-none placeholder:text-gray-500"/>
              </div>
              <span className="text-[12px] font-medium" style={{ color: "var(--sb-chip-text)" }}>Available: ${balance.toFixed(2)}</span>
            </div>
          </label>
          <button onClick={requestWithdrawal} disabled={!parseFloat(wAmount)} className="mt-5 h-13 w-full rounded-full py-3.5 text-[14px] font-bold text-white transition hover:opacity-90 active:scale-[.98] disabled:opacity-50" style={{ background: P }}>Request Withdrawal</button>
          <p className="mt-2.5 text-center text-[11px]" style={{ color: "var(--sb-chip-text)" }}>Withdrawals are reviewed and processed within 24 hours</p>
        </div>
      </div>
    )}
    {funding && <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 px-2.5 py-4 backdrop-blur-[2px] sm:p-6"><div className="max-h-[92vh] w-full max-w-[600px] overflow-y-auto rounded-[24px] p-5 shadow-[0_28px_90px_rgba(0,0,0,.55)] sm:p-7" style={{ background: "var(--sb-card)", border: "1px solid var(--sb-bd)", maxHeight: "92dvh" }}><div className="flex items-start justify-between"><div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: "rgba(240,78,35,0.12)", color: P }}><WalletMoneyIcon size={24}/></span><div><h2 className="text-[20px] font-bold tracking-[-.03em]">Add Funds</h2><p className="mt-0.5 text-[13px]" style={{ color: "var(--sb-chip-text)" }}>Fund your wallet securely</p></div></div><button onClick={() => setFunding(false)} className="rounded-full p-1.5 transition duration-200 hover:rotate-90" style={{ color: "var(--sb-chip-text)" }}><Cancel01Icon size={22}/></button></div><div className="mt-5 grid grid-cols-2 rounded-[16px] p-1.5" style={{ background: "var(--sb-chip)" }}><button onClick={() => setFundTab("local")} className={`flex h-11 items-center justify-center gap-2 rounded-[12px] text-[14px] font-bold transition ${fundTab === "local" ? "text-white shadow-[0_2px_8px_rgba(0,0,0,.35)]" : ""}`} style={fundTab === "local" ? { background: "var(--sb-card)" } : { color: "var(--sb-chip-text)" }}><BankIcon size={20}/>Local</button><button onClick={() => setFundTab("crypto")} className={`flex h-11 items-center justify-center gap-2 rounded-[12px] text-[14px] font-bold transition ${fundTab === "crypto" ? "text-white shadow-[0_2px_8px_rgba(0,0,0,.35)]" : ""}`} style={fundTab === "crypto" ? { background: "var(--sb-card)" } : { color: "var(--sb-chip-text)" }}><span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-[13px] font-black text-black">₿</span>Crypto</button></div>{!fundReady ? <div className="mt-5 space-y-3"><Skeleton className="h-4 w-32"/><div className="grid grid-cols-3 gap-2.5">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-[54px]" rounded="rounded-2xl"/>)}</div><Skeleton className="mt-3 h-4 w-20"/><Skeleton className="mx-auto h-11 w-44"/><Skeleton className="mt-3 h-[70px] w-full" rounded="rounded-2xl"/><Skeleton className="h-[52px] w-full" rounded="rounded-full"/></div> : fundTab === "local" ? <><div className="mt-5 flex items-center justify-between"><h3 className="text-[15px] font-bold">Select currency</h3><span className="text-[12.5px]" style={{ color: "var(--sb-chip-text)" }}>One currency per deposit</span></div><div className="mt-3 grid grid-cols-3 gap-2.5">{[["🇳🇬", "NGN"],["🇬🇭", "GHS"],["🇰🇪", "KES"],["🇿🇦", "ZAR"],["🇨🇮", "XOF"]].map(([flag, code]) => <button key={code} onClick={() => setCurrency(code)} className={`flex h-[54px] items-center justify-center gap-2 rounded-2xl border transition ${currency === code ? "border-[#f04e23]" : ""}`} style={currency === code ? { background: "rgba(240,78,35,0.10)" } : { background: "var(--sb-chip)", borderColor: "var(--sb-bd)" }}><span className="flex h-6 w-6 items-center justify-center overflow-hidden rounded-full text-[15px] leading-none">{flag}</span><b className="text-[14.5px]">{code}</b></button>)}</div><h3 className="mt-6 text-[15px] font-bold">Amount</h3><div className="mt-3 flex flex-col items-center gap-1 py-1"><div className="flex items-center gap-3"><span className="text-[26px] font-medium" style={{ color: "var(--sb-chip-text)" }}>$</span><input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" placeholder="0" onFocus={(event) => event.currentTarget.select()} className="w-40 bg-transparent text-center text-[32px] font-bold tracking-[-.03em] outline-none placeholder:text-[#8b97a6]"/></div><span className="text-[13px] font-semibold" style={{ color: "var(--sb-chip-text)" }}>{rateLabel}</span></div><div className="mt-3 border-t" style={{ borderColor: "var(--sb-bd)" }}/><div className="mt-5 flex items-start gap-3 rounded-2xl border px-4 py-3.5" style={{ background: "rgba(240,78,35,0.08)", borderColor: "rgba(240,78,35,0.45)" }}><span className="mt-0.5 shrink-0"><SecureShield size={22}/></span><div><h4 className="text-[14px] font-bold">Secured and Trusted</h4><p className="mt-1 text-[12.5px] leading-[1.5]" style={{ color: "var(--sb-chip-text)" }}>Your funds are protected with a bank level security and processed through a licensed payment partner</p></div></div><button onClick={beginDeposit} disabled={depositing} className="mt-5 inline-flex h-[52px] w-full items-center justify-center gap-2.5 rounded-full text-[15px] font-bold transition hover:opacity-90 active:scale-[.99] disabled:opacity-60" style={{ background: P, color: "#fff" }}>{depositing && <svg className="animate-spin" width="17" height="17" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="#fff" strokeOpacity=".3" strokeWidth="2.6"/><path d="M21 12a9 9 0 0 0-9-9" stroke="#fff" strokeWidth="2.6" strokeLinecap="round"/></svg>}{depositing ? "Starting payment…" : "Continue to payment"}</button><p className="mt-3 flex items-center justify-center gap-1.5 text-center text-[11.5px]" style={{ color: "var(--sb-chip-text)" }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none"><rect x="5" y="11" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="2"/></svg>You will be redirected to a secure service provider</p></> : <CryptoDeposit active={fundTab === "crypto"}/>}</div></div>}
    {notice && <div role="status" className="fixed bottom-24 left-1/2 z-[100] -translate-x-1/2 rounded-full bg-[#1d2939] px-5 py-3 text-[13px] font-semibold shadow-2xl">Our support team has been notified.<button onClick={() => setNotice(false)} className="ml-3 text-[#f04e23]">Close</button></div>}
    {comingSoon && (
      <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/65 p-4 backdrop-blur-[2px]" onClick={() => setComingSoon("")}>
        <div onClick={(e) => e.stopPropagation()} className="w-full max-w-[400px] rounded-[22px] p-6 text-center" style={{ background: "var(--sb-card)", border: "1px solid var(--sb-bd)" }}>
          <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full" style={{ background: "rgba(240,78,35,0.12)", color: P }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
          </span>
          <h3 className="text-[17px] font-bold">Coming soon</h3>
          <p className="mx-auto mt-2 max-w-[320px] text-[13px] leading-5" style={{ color: "var(--sb-chip-text)" }}>{comingSoon}</p>
          <button onClick={() => setComingSoon("")} className="mt-5 h-11 w-full rounded-full text-[14px] font-bold text-white transition hover:opacity-90 active:scale-[.98]" style={{ background: P }}>Got it</button>
        </div>
      </div>
    )}
  </div>;
}
