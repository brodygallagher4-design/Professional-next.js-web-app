"use client";

import { useState } from "react";
import { Copy01Icon, CreditCardIcon, LinkSquare01Icon, MoneyBag02Icon, UserGroupIcon, Wallet01Icon } from "hugeicons-react";
import { DesktopTopNav, FONT, AppMobileHeader } from "../shared";
import type { Page } from "../shared";

type RecordFilter = "Pending" | "Completed" | "Cancel";
const inviteLink = "app.simbazaar.com/auth/sign-up?referralId=49005e22-98cf-4504-8c54-a2e1";

async function copyText(value: string) {
  try { if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(value); return true; } } catch { /* fallback */ }
  try { const node = document.createElement("textarea"); node.value = value; node.style.cssText = "position:fixed;opacity:0"; document.body.appendChild(node); node.select(); const copied = document.execCommand("copy"); node.remove(); return copied; } catch { return false; }
}

function ReferralGift() {
  return <svg className="h-28 w-28 sm:h-32 sm:w-32" viewBox="0 0 126 126" role="img" aria-label="Gift reward"><defs><filter id="gift-shadow" x="-20%" y="-20%" width="140%" height="145%"><feDropShadow dx="0" dy="6" stdDeviation="4" floodColor="#000" floodOpacity=".32"/></filter></defs><g filter="url(#gift-shadow)"><path d="M33 45h60v49c0 6-5 11-11 11H44c-6 0-11-5-11-11V45Z" fill="#cc2d2a"/><path d="M63 45h30v49c0 6-5 11-11 11H63V45Z" fill="#e33731"/><rect x="27" y="38" width="72" height="26" rx="7" fill="#e33b32"/><rect x="60" y="38" width="7" height="67" rx="2" fill="#ffbd12"/><path d="M62 40C45 38 36 29 39 21c3-8 17-5 23 4l3 15Z" fill="none" stroke="#ffbc0e" strokeWidth="6" strokeLinecap="round"/><path d="M64 40c17-2 26-11 23-19-3-8-17-5-23 4l-3 15Z" fill="none" stroke="#ffbc0e" strokeWidth="6" strokeLinecap="round"/></g></svg>;
}

function Step({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return <div className="relative z-10 flex min-w-0 items-center gap-4 text-left lg:flex-1 lg:flex-col lg:items-center lg:gap-0 lg:text-center"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#fff5f2] text-[#343a44] shadow-[0_2px_8px_rgba(0,0,0,.18)] lg:mb-4">{icon}</span><p className="max-w-[230px] text-[14px] font-semibold leading-5 text-white lg:mx-auto lg:leading-6">{children}</p></div>;
}

export function ReferralPage({ setPage }: { setPage: (page: Page) => void }) {
  const [copied, setCopied] = useState(false);
  const [filter, setFilter] = useState<RecordFilter>("Pending");
  const copy = async () => { if (await copyText(inviteLink)) { setCopied(true); window.setTimeout(() => setCopied(false), 1800); } };
  const share = async () => { try { if (navigator.share) await navigator.share({ title: "Join SimBazaar", url: `https://${inviteLink}` }); else await copy(); } catch { /* dismissed */ } };
  const filters: RecordFilter[] = ["Pending", "Completed", "Cancel"];

  return <div className="min-h-screen bg-[var(--sb-mbg)] text-white" style={{ fontFamily: FONT }}>
    <DesktopTopNav setPage={setPage} active="referral" />
    <AppMobileHeader className="md:hidden" setPage={setPage}/>
    <main className="mx-auto w-full max-w-[1600px] px-4 pb-28 pt-7 sm:px-6 md:px-10 md:pt-10 lg:px-[9.4%]" style={{ animation: "sbPageIn .42s cubic-bezier(.22,1,.36,1) both" }}>
      <header className="mb-5"><h1 className="text-[28px] font-bold leading-none tracking-[-.04em] md:text-[36px]">Referral</h1><p className="mt-2 text-[13px] text-[var(--sb-chip-text)]">Earn more when you invite friends to SimBazaar</p></header>
      <div className="min-w-0 overflow-hidden rounded-lg bg-[var(--sb-mcard)] shadow-[0_20px_60px_rgba(0,0,0,.2)] lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.04fr)] lg:rounded-sm">
        <section className="min-w-0 border-b border-[var(--sb-mbd)] px-5 py-10 sm:px-8 sm:py-12 lg:flex lg:min-h-[650px] lg:items-center lg:border-b-0 lg:border-r lg:px-10 xl:px-16">
          <div className="mx-auto flex w-full max-w-[700px] flex-col items-center text-center">
            <div className="mb-3 transition-transform duration-500 hover:-translate-y-1"><ReferralGift /></div>
            <h2 className="text-[24px] font-bold leading-tight tracking-[-.03em] sm:text-[29px]">Receive $0 reward instantly</h2>
            <p className="mt-2 max-w-[620px] text-[13px] leading-5 text-[var(--sb-chip-text)]">When your friend registers, funds wallet with minimum of <b className="text-white">$0</b> and purchases at least <b className="text-white">one account</b>, you get rewarded instantly.</p>
            <h3 className="mt-8 text-[15px] font-bold">How to use invitation code</h3>
            <div className="mt-5 flex w-full flex-col gap-5 lg:relative lg:flex-row lg:items-start lg:justify-between lg:gap-4"><span className="pointer-events-none absolute left-[15%] right-[15%] top-6 hidden border-t-2 border-dotted border-[#f04e23] lg:block"/><Step icon={<LinkSquare01Icon size={22} strokeWidth={1.6} />}>Share invitation link/code with friends</Step><Step icon={<CreditCardIcon size={22} strokeWidth={1.6} />}>Let friends sign up and fund wallet with minimum of $0</Step><Step icon={<MoneyBag02Icon size={22} strokeWidth={1.6} />}>Receive $0 reward instantly</Step></div>
            <div className="mt-9 flex w-full min-w-0 items-center gap-2 rounded-2xl border border-[var(--sb-mbd)] bg-[var(--sb-fill)] px-4 py-3 text-left sm:rounded-full sm:py-1.5 sm:pr-2"><div className="min-w-0 flex-1"><span className="block text-[11px] text-[var(--sb-chip-text)] sm:inline sm:pr-4 sm:text-[12px]">Your Referral link:</span><span className="mt-1 block truncate text-[13px] font-bold sm:mt-0 sm:inline sm:text-[14px]">{inviteLink}</span></div><button onClick={copy} aria-label="Copy referral link" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white transition hover:bg-white/10 active:scale-90">{copied ? <span className="text-[14px] font-bold text-[#f04e23]">✓</span> : <Copy01Icon size={20}/>}</button></div>
            <button onClick={share} className="mt-5 w-full rounded-full bg-[#f04e23] px-8 py-3 text-[14px] font-bold text-white shadow-[0_12px_24px_rgba(240,78,35,.18)] transition hover:bg-[#ff6038] active:scale-95 sm:w-auto sm:min-w-[240px]">{copied ? "Invitation link copied" : "Share Invitation link"}</button>
          </div>
        </section>
        <section className="min-w-0 bg-[var(--sb-mbg)] px-4 py-5 sm:px-6 sm:py-6 lg:m-6 lg:min-h-[598px] lg:rounded-xl lg:border lg:border-[var(--sb-mbd)]">
          <h2 className="text-[18px] font-semibold tracking-[-.02em] sm:text-[19px]">Referral Record</h2>
          <div className="mt-4 grid grid-cols-2 gap-3 rounded-lg bg-[var(--sb-mbg)] px-4 py-5 sm:gap-5 sm:px-6 sm:py-7"><div className="min-w-0"><p className="flex items-center gap-2 text-[13px] font-semibold sm:text-[14px]"><Wallet01Icon size={17}/>Total Earned</p><p className="mt-2 text-[16px] font-bold">$ 0</p></div><div className="min-w-0"><p className="flex items-center gap-2 text-[13px] font-semibold sm:text-[14px]"><UserGroupIcon size={17}/>Invitees</p><p className="mt-2 text-[16px] font-bold">0</p></div></div>
          <div className="mt-4 min-h-[260px] rounded-lg bg-[var(--sb-mbg)] px-4 pt-5 sm:min-h-[390px] sm:px-6"><div className="grid grid-cols-3 border-b border-[var(--sb-mbd)]">{filters.map((item) => <button key={item} onClick={() => setFilter(item)} className={`relative pb-3 text-[13px] font-medium sm:text-[14px] ${filter === item ? "text-[#f04e23]" : "text-[var(--sb-chip-text)]"}`}>{item}{filter === item && <span className="absolute inset-x-0 bottom-[-1px] h-0.5 bg-[#f04e23]"/>}</button>)}</div><div className="flex h-[180px] items-center justify-center sm:h-[310px]"><p className="text-[13px] text-[var(--sb-chip-text)]">No {filter.toLowerCase()} referrals yet.</p></div></div>
        </section>
      </div>
    </main>
    <button onClick={() => setPage("support")} aria-label="Open support" className="fixed bottom-6 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#f04e23] text-xl font-bold text-white shadow-[0_12px_28px_rgba(0,0,0,.35)] transition hover:scale-105 active:scale-95">?</button>
  </div>;
}
