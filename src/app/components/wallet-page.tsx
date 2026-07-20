"use client";

import { useState, useEffect } from "react";
import { Alert01Icon, ArrowDown01Icon, BankIcon, Cancel01Icon, Copy01Icon, Download01Icon, Shield01Icon, Upload01Icon, ViewIcon, ViewOffIcon } from "hugeicons-react";
import { DesktopTopNav, FONT, AppMobileHeader, P, MBG, useProfile, useScrollLock, Skeleton, useLoadGate } from "../shared";
import { fetchWalletTransactions, fetchWalletBalance, readCache, writeCache, type ApiWalletTx } from "../lib/api";
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
  txid: r.txid + "...",
  date: formatTxDate(r.created_at),
});

const FALLBACK_LEDGER: WTx[] = [
  { id: "f1", kind: "deposit", amount: "10.00", means: "From bank", status: "Failed", txid: "ad0b6efc...", date: "Sunday, October 26th, 3:48 AM" },
  { id: "f2", kind: "deposit", amount: "20.00", means: "From bank", status: "Completed", txid: "3f3a7339...", date: "Tuesday, October 8th, 7:59 AM" },
  { id: "f3", kind: "withdrawal", amount: "15.00", means: "To bank", status: "Completed", txid: "wd4e1b9b...", date: "Monday, October 7th, 11:30 AM" },
];

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

function TransactionRow({ tx }: { tx: WTx }) {
  const isDeposit = tx.kind === "deposit";
  const statusColor = tx.status === "Completed" ? "#0bcc57" : tx.status === "Pending" ? "#f5a623" : "#ff4053";
  return <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-[#263448] px-3 py-3 sm:px-4 sm:py-2.5" style={{ background: "var(--sb-fill)" }}>
    <span className={`flex h-9 w-9 items-center justify-center rounded-full ${isDeposit ? "bg-[#143b25] text-[#00c96b]" : "bg-[#461719] text-[#fc553b]"}`}>
      {isDeposit ? <Download01Icon size={18}/> : <Upload01Icon size={18}/>}
    </span>
    <div className="min-w-0">
      <p className="text-[13px] font-bold text-white">{isDeposit ? "Deposit" : "Withdrawal"}</p>
      <p className="mt-0.5 text-[11px] text-[#8fa9c8]">{tx.means}</p>
      <p className="mt-1 flex items-center gap-1.5 truncate text-[10px] text-[#557090]">TXID: {tx.txid}<Copy01Icon size={13} className="shrink-0"/></p>
    </div>
    <div className="min-w-[118px] text-right sm:min-w-[165px]">
      <p className={`text-[15px] font-bold ${isDeposit ? "text-[#00d66c]" : "text-[#ff7a5c]"}`}>{isDeposit ? "+" : "-"}${tx.amount}</p>
      <p className="mt-1 text-[10px] font-semibold" style={{ color: statusColor }}>
        <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full" style={{ background: statusColor }}/>{tx.status}
      </p>
      <p className="mt-1 hidden text-[9px] text-[#5d7598] sm:block">{tx.date}</p>
    </div>
  </div>;
}

function QRCode() {
  const size = 29;
  const finder = (x: number, y: number) => <g key={`${x}-${y}`}><rect x={x} y={y} width="7" height="7" fill="#fff"/><rect x={x + 1} y={y + 1} width="5" height="5" fill="#000"/><rect x={x + 2} y={y + 2} width="3" height="3" fill="#fff"/></g>;
  const cells: React.ReactNode[] = [];
  for (let y = 0; y < size; y += 1) for (let x = 0; x < size; x += 1) {
    const inFinder = (x < 8 && y < 8) || (x > 20 && y < 8) || (x < 8 && y > 20);
    if (!inFinder && ((x * 13 + y * 7 + x * y * 3) % 11 < 5 || (x + y) % 9 === 0)) cells.push(<rect key={`${x}:${y}`} x={x} y={y} width="1" height="1" fill="#fff"/>);
  }
  return <svg viewBox="0 0 29 29" className="h-36 w-36 bg-black p-1" shapeRendering="crispEdges"><rect width="29" height="29" fill="#000"/>{cells}{finder(0, 0)}{finder(22, 0)}{finder(0, 22)}</svg>;
}

function CoinChip({ symbol, color, active, onClick }: { symbol: string; color: string; active?: boolean; onClick?: () => void }) {
  return <button onClick={onClick} className={`flex h-[60px] items-center gap-2 rounded-2xl border px-3 text-left transition ${active ? "border-[#f04e23] bg-[#391813]" : "border-[#1e2b3f] bg-black hover:border-[#34465f]"}`}><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[15px] font-extrabold text-white" style={{ background: color }}>{symbol === "USDT" ? "₮" : symbol === "USDC" ? "$" : symbol === "BTC" ? "₿" : symbol === "ETH" ? "♦" : symbol === "LTC" ? "Ł" : symbol === "BNB" ? "◆" : "▾"}</span><span className="text-[13px] font-bold text-white">{symbol}</span></button>;
}

export function WalletPage({ setPage }: { setPage: (page: Page) => void }) {
  const [tab, setTab] = useState<Tab>("deposit");
  const [showAllTx, setShowAllTx] = useState(false);
  const seller = Boolean(useProfile().is_seller);
  const [withdrawing, setWithdrawing] = useState(false);
  const [wAmount, setWAmount] = useState("");
  // The account's own live ledger — no demo fallback. A new wallet is empty.
  const [ledger, setLedger] = useState<WTx[]>(() => readCache<WTx[]>("sb-wallet-tx") ?? []);
  // Real balance from the server (authoritative — includes sales and purchases).
  const [balance, setBalance] = useState<number>(() => readCache<number>("sb-wallet-balance") ?? 0);
  // Loading gate — always show a visible skeleton beat, then the real data.
  const { loaded: txLoaded, finishLoading: finishTx } = useLoadGate(600);
  const { loaded: balLoaded, finishLoading: finishBal } = useLoadGate(600);
  useEffect(() => {
    let cancelled = false;
    fetchWalletTransactions().then((rows) => {
      if (cancelled) return;
      if (rows) { const mapped = rows.map(mapTx); writeCache("sb-wallet-tx", mapped); setLedger(mapped); }
      finishTx();
    }).catch(() => { if (!cancelled) finishTx(); });
    fetchWalletBalance().then((r) => {
      if (cancelled) return;
      if (r) { writeCache("sb-wallet-balance", r.balance); setBalance(r.balance); }
      finishBal();
    }).catch(() => { if (!cancelled) finishBal(); });
    return () => { cancelled = true; };
  }, []);
  // Deposits/withdrawals are disabled until the payment provider is integrated.
  const [comingSoon, setComingSoon] = useState("");
  // Premium role-based URL: buyers get /account/wallet, sellers /seller/wallet
  useEffect(() => {
    try {
      const url = seller ? "/seller/wallet" : "/account/wallet";
      if (window.location.pathname !== url) window.history.replaceState({}, "", url);
    } catch { /* ignore */ }
  }, [seller]);
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
  const [coin, setCoin] = useState("USDT");
  const [amount, setAmount] = useState("");
  const [notice, setNotice] = useState(false);
  const tabItems: { id: Tab; label: string }[] = [{ id: "deposit", label: "Deposit History" }, { id: "withdrawal", label: "Withdrawal History" }, { id: "security", label: "Security" }];
  const exchangeRates: Record<string, { symbol: string; rate: number }> = { NGN: { symbol: "₦", rate: 1588 }, GHS: { symbol: "GH₵", rate: 15.4 }, KES: { symbol: "KSh", rate: 129 }, ZAR: { symbol: "R", rate: 18.2 }, XAF: { symbol: "FCFA", rate: 603 }, XOF: { symbol: "CFA", rate: 603 } };
  const parsedAmount = Number.parseFloat(amount);
  const converted = Number.isFinite(parsedAmount) ? parsedAmount * exchangeRates[currency].rate : 0;
  const rateLabel = `≈ ${exchangeRates[currency].symbol}${converted.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  return <div className="min-h-screen text-white" style={{ background: MBG, fontFamily: FONT }}>
    <DesktopTopNav setPage={setPage} active="wallet" />
    <AppMobileHeader className="md:hidden" setPage={setPage}/>
    <main className="mx-auto w-full max-w-[1040px] px-4 pb-28 pt-7 sm:px-6 md:px-8 md:pt-10">
      <header><h1 className="text-[30px] font-bold tracking-[-.04em] sm:text-[36px]">Wallet</h1><p className="mt-1 text-[13px] text-[#9cc3ed]">Manage your balance and transactions securely</p></header>
      <section className="relative mt-6 min-h-[158px] overflow-hidden rounded-[20px] bg-[linear-gradient(105deg,#ff4f2b_0%,#ff6340_53%,#ee7768_100%)] px-7 py-6 shadow-[0_18px_40px_rgba(240,78,35,.16)] sm:px-7"><div className="absolute inset-0 bg-[radial-gradient(ellipse_75%_100%_at_18%_45%,rgba(255,255,255,.14),transparent_66%)]"/><div className="relative z-10"><p className="text-[12px] font-medium text-white">Account balance</p><div className="mt-2 flex items-center gap-2">{!balLoaded ? <Skeleton className="h-[30px] w-32" style={{ background: "rgba(255,255,255,.35)" }}/> : <span className="text-[26px] font-bold tracking-[-.035em]">{showBalance ? `$${balance.toFixed(2)}` : "$••••"}</span>}<button onClick={() => setShowBalance((value) => !value)} aria-label="Toggle balance visibility" className="rounded p-1 text-white/90 hover:bg-white/10">{showBalance ? <ViewIcon size={17}/> : <ViewOffIcon size={17}/>}</button></div><div className="mt-4 flex items-center gap-2.5"><button onClick={() => setFunding(true)} className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2.5 text-[13px] font-semibold text-[#f04e23] transition hover:bg-[#fff5f2] active:scale-95"><Download01Icon size={16}/>Deposit</button>{seller && <button onClick={() => setWithdrawing(true)} className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2.5 text-[13px] font-semibold text-[#f04e23] transition hover:bg-[#fff5f2] active:scale-95"><Upload01Icon size={16}/>Withdraw</button>}</div></div><div className="pointer-events-none absolute right-4 top-1/2 z-10 -translate-y-1/2 sm:right-6"><WalletIllustration /></div></section>
      <section className="mt-5 flex items-start gap-3 rounded-[18px] bg-[#173b25] px-5 py-3"><span className="mt-0.5 shrink-0"><ProtectedShield /></span><div><h2 className="text-[14px] font-bold">Funds Protected</h2><p className="mt-1 text-[11px] text-white">Merchant earnings are held securely and released only after successful transaction completion.</p></div></section>
      <section className="mt-5 grid grid-cols-2 rounded-[18px] px-3 py-3 sm:px-4" style={{ background: "var(--sb-fill)" }}><div className="flex min-w-0 items-center gap-4 border-r border-[#28374b] px-1 py-1 sm:px-2"><span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#123e28] text-[#00cd69]"><Download01Icon size={22}/></span><div><p className="text-[12px] font-semibold">Total Deposit</p><p className="text-[15px] font-bold">${totalDeposited.toFixed(2)}</p><p className="text-[11px] text-[#a9c0db]">All time</p></div></div><div className="flex min-w-0 items-center gap-4 px-3 py-1 sm:px-5"><span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#461719] text-[#fc553b]"><Upload01Icon size={22}/></span><div><p className="text-[12px] font-semibold">Total Withdrawal</p><p className="text-[15px] font-bold">${totalWithdrawn.toFixed(2)}</p><p className="text-[11px] text-[#a9c0db]">All time</p></div></div></section>
      <section className="mt-6"><div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><span className="sb-glow" aria-hidden="true"/><div className="relative flex gap-5 border-b border-[#263448]">{tabItems.map((item) => <button onClick={() => setTab(item.id)} key={item.id} className={`relative pb-3 text-[13px] font-semibold ${tab === item.id ? "text-[#f04e23]" : "text-white"}`}>{item.label}{tab === item.id && <span className="absolute inset-x-0 bottom-[-1px] h-px bg-[#f04e23]"/>}</button>)}</div><button onClick={() => setNotice(true)} className="relative hidden rounded-lg bg-[#f04e23] px-5 py-2.5 text-[13px] font-bold transition hover:bg-[#ff623a] active:scale-95 sm:block sm:self-auto">Report Transaction</button></div>{tab === "security" ? <div className="mt-4 rounded-2xl border border-[#263448] p-7 text-center" style={{ background: "var(--sb-fill)" }}><ProtectedShield size={34}/><h3 className="mt-3 text-[16px] font-bold">Wallet security</h3><p className="mx-auto mt-2 max-w-sm text-[13px] leading-5 text-[#91a7c5]">Your wallet is protected with secured transaction processing and merchant escrow safeguards.</p></div> : !txLoaded ? <div className="mt-4 space-y-2.5">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="flex items-center gap-3 rounded-2xl px-4 py-3.5" style={{ background: "var(--sb-fill)" }}><Skeleton className="h-10 w-10" rounded="rounded-full"/><div className="flex-1 space-y-2"><Skeleton className="h-3 w-2/5"/><Skeleton className="h-2.5 w-1/4"/></div><Skeleton className="h-4 w-16"/></div>)}</div> : <div className="mt-4 space-y-2.5">{(tab === "withdrawal" ? withdrawalsList : deposits).slice(0, showAllTx ? undefined : 4).map((tx) => <TransactionRow key={tx.id} tx={tx}/>)}</div>}<button onClick={() => setShowAllTx(v => !v)} className="mx-auto mt-5 flex items-center gap-1 text-[12px] font-semibold text-[#f04e23]">{showAllTx ? "Show less" : "View all transaction"} <ArrowDown01Icon size={14} className={showAllTx ? "rotate-180" : ""}/></button></section>
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
    {funding && <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/75 p-4 backdrop-blur-[3px] sm:p-5"><div className="max-h-[80vh] w-full max-w-[500px] overflow-y-auto rounded-[24px] border border-[#142037] bg-[#07101f] p-4 shadow-[0_28px_90px_rgba(0,0,0,.55)] sm:p-5"><div className="flex items-start justify-between"><div className="flex items-center gap-4"><span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#4a1814] text-[#ff5a37]"><WalletMoneyIcon size={22}/></span><div><h2 className="text-[19px] font-bold tracking-[-.03em]">Add Funds</h2><p className="mt-0.5 text-[14px] text-[#a5b3c6]">Fund your wallet securely</p></div></div><button onClick={() => setFunding(false)} className="rounded-full p-1 text-white transition hover:bg-white/10"><Cancel01Icon size={21}/></button></div><div className="mt-4 grid grid-cols-2 rounded-[18px] bg-[#142034] p-1.5"><button onClick={() => setFundTab("local")} className={`flex h-11 items-center justify-center gap-2 rounded-[14px] text-[14px] font-bold transition ${fundTab === "local" ? "bg-black text-white" : "text-[#9ca9bc]"}`}><BankIcon size={23}/>Local</button><button onClick={() => setFundTab("crypto")} className={`flex h-11 items-center justify-center gap-2 rounded-[14px] text-[14px] font-bold transition ${fundTab === "crypto" ? "bg-black text-white" : "text-[#9ca9bc]"}`}><span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-[15px] font-black text-black">₿</span>Crypto</button></div>{fundTab === "local" ? <><div className="mt-3.5 flex items-center justify-between"><h3 className="text-[14px] font-bold">Select currency</h3><span className="text-[12px] text-[#acb9c9]">One currency per deposit</span></div><div className="mt-3 grid grid-cols-3 gap-2">{[["🇳🇬", "NGN", "Nigerian Naira"],["🇬🇭", "GHS", "Ghana Cedis"],["🇰🇪", "KES", "Kenya Shilling"],["🇿🇦", "ZAR", "South African Rand"],["🇨🇲", "XAF", "CFA Franc (BEAC)"],["🇨🇲", "XOF", "CFA Franc (BCEAO)"]].map(([flag, code, note]) => <button key={code} onClick={() => setCurrency(code)} className={`flex h-[50px] items-center gap-2 rounded-xl border px-2.5 text-left transition ${currency === code ? "border-[#f04e23] bg-[#391813]" : "border-[#1e2b3f] bg-black"}`}><span className="text-[22px]">{flag}</span><span><b className="block text-[14px]">{code}</b><small className="block text-[8px] text-[#9eabc0]">{note}</small></span></button>)}</div><label className="mt-3.5 block text-[14px] font-bold">Amount<div className="mt-2 flex flex-col items-center rounded-[16px] bg-[#08111e] py-2"><div className="flex items-center gap-2"><span className="text-[21px] text-[#9ca9bc]">$</span><input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" placeholder="0" onFocus={(event) => event.currentTarget.select()} className="w-32 bg-transparent text-center text-[28px] font-bold tracking-[-.04em] outline-none placeholder:text-[#71819a]"/></div><span className="text-[13px] font-medium text-[#c9d2df]">{rateLabel}</span></div></label><div className="mt-3 border-t border-[#263448]"/><div className="mt-3 flex gap-3 rounded-xl border border-[#f04e23] bg-[#4a1a17] px-4 py-2.5"><Shield01Icon size={27} className="shrink-0 text-[#ff5a37]"/><div><h4 className="text-[13px] font-bold">Secured and Trusted</h4><p className="mt-1 text-[11px] leading-4 text-white">Your funds are protected with a bank level security and processed through a licensed payment partner</p></div></div><button onClick={() => {
                setFunding(false);
                setAmount("");
                setComingSoon("Deposits aren't available yet — our secure payment provider is being connected. You'll be able to fund your wallet as soon as it's live.");
              }} className="mt-3 h-12 w-full rounded-full bg-[#ff542f] text-[14px] font-bold transition hover:bg-[#ff6a4a] active:scale-[.98]">Continue to payment</button><p className="mt-2 text-center text-[10px] text-white/80">♙ You will be redirected to a secure service provider</p></> : <><h3 className="mt-5 text-[15px] font-bold">My static wallets</h3><div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">{[["USDT", "#e62929"],["USDC", "#2775ca"],["BTC", "#f7931a"],["ETH", "#627eea"],["LTC", "#345dbe"],["BNB", "#f3ba2f"],["TRX", "#ef0027"]].map(([symbol, color]) => <CoinChip key={symbol} symbol={symbol} color={color} active={coin === symbol} onClick={() => setCoin(symbol)}/>)}</div><div className="mt-5 rounded-2xl border border-[#243149] bg-black p-4"><label className="block text-[13px] font-bold">Select Network<select className="mt-2 h-10 w-full rounded-md border border-[#34435b] bg-[#0c1627] px-3 text-[13px] outline-none"><option>TRC 20</option><option>ERC 20</option></select></label><div className="my-5 flex justify-center"><QRCode /></div><div className="flex min-w-0 items-center gap-2 rounded-xl bg-[#142034] px-3 py-3"><span className="min-w-0 flex-1 truncate text-[12px]">TBC1KZwjJ6dkhfZdgagnxfiAq2aPaevyUM</span><button onClick={() => copyText("TBC1KZwjJ6dkhfZdgagnxfiAq2aPaevyUM")} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#ff5a37]"><Copy01Icon size={17}/></button></div><div className="mt-4 rounded-xl border border-[#ff4e2e] bg-[#451a18] px-4 py-4"><div className="flex gap-3"><Alert01Icon size={22} className="shrink-0 text-[#ff5a37]"/><div><h4 className="text-[12px] font-bold">Before you deposit</h4><ul className="mt-2 list-disc space-y-1 pl-4 text-[11px] leading-4"><li>Deposits below ~8 USD may not be processed.</li><li>Send only {coin} to this address.</li><li>Make sure you use the correct network. Incorrect network may lead to loss of funds.</li></ul></div></div></div></div></>}</div></div>}
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
