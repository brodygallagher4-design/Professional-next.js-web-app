"use client";

import {
  P, MBG, MCARD, MBD, FONT,
  DesktopTopNav, AppMobileHeader,
} from "../shared";
import type { Page } from "../shared";

type ChannelKey = "whatsapp" | "telegram" | "email";

const CHANNELS: { key: ChannelKey; name: string; handle: string }[] = [
  { key: "whatsapp", name: "Whatsapp", handle: "+234 907 148 2332" },
  { key: "telegram", name: "Telegram", handle: "@simbazaar_support" },
  { key: "email",    name: "Email",    handle: "support@simbazaar.com" },
];

// Circular, full-colour brand marks matching the reference support screen.
function ChannelIcon({ channel, size = 72 }: { channel: ChannelKey; size?: number }) {
  const g = Math.round(size * 0.5);
  if (channel === "whatsapp") {
    return (
      <span className="grid place-items-center rounded-full" style={{ width: size, height: size, background: "#2f7d3a", boxShadow: "inset 0 0 0 5px rgba(120,190,130,.32)" }}>
        <svg width={g} height={g} viewBox="0 0 24 24" fill="#fff"><path d="M12 2a10 10 0 0 0-8.6 15l-1.3 4.7 4.8-1.3A10 10 0 1 0 12 2Zm5.8 14.2c-.2.7-1.4 1.3-1.9 1.3-.5.1-1.1.1-1.8-.1-.4-.1-1-.3-1.7-.6-3-1.3-4.9-4.3-5-4.5-.2-.2-1.3-1.7-1.3-3.2 0-1.5.8-2.3 1.1-2.6.3-.3.6-.4.8-.4h.6c.2 0 .4 0 .7.5l.9 2.1c.1.2.1.3 0 .5l-.5.7c-.2.2-.3.4-.1.7.2.3.9 1.4 1.9 2.3 1.3 1.1 2.3 1.5 2.6 1.6.3.1.5.1.7-.1l.9-1c.2-.3.4-.2.7-.1l2 1c.3.1.5.2.5.4.1.1.1.7-.2 1.3Z"/></svg>
      </span>
    );
  }
  if (channel === "telegram") {
    return (
      <span className="grid place-items-center rounded-full" style={{ width: size, height: size, background: "#2b6fb0" }}>
        <svg width={g} height={g} viewBox="0 0 24 24" fill="#fff"><path d="M21.9 4.6 18.6 20c-.2 1.1-.9 1.3-1.8.8l-4.9-3.6-2.4 2.3c-.3.3-.5.5-1 .5l.4-5 9.1-8.2c.4-.4-.1-.6-.6-.2L6.6 13 1.8 11.5c-1-.3-1.1-1 .2-1.5L20.5 2.8c.9-.3 1.6.2 1.4 1.8Z"/></svg>
      </span>
    );
  }
  // Gmail – full-colour "M" on a dark circle
  return (
    <span className="grid place-items-center rounded-full" style={{ width: size, height: size, background: "#3a2320" }}>
      <svg width={g} height={g} viewBox="0 0 24 24"><path fill="#4285F4" d="M3 6.5 12 13l9-6.5V18a1.5 1.5 0 0 1-1.5 1.5H18V9.7L12 14 6 9.7v9.8H4.5A1.5 1.5 0 0 1 3 18Z"/><path fill="#34A853" d="M3 18V9.7L6 12v7.5H4.5A1.5 1.5 0 0 1 3 18Z"/><path fill="#FBBC05" d="M18 18V9.7L21 7.5V18a1.5 1.5 0 0 1-1.5 1.5H18Z"/><path fill="#EA4335" d="M3 6.5 6 4.5 12 9l6-4.5 3 2L12 13Z"/><path fill="#C5221F" d="M3 6.5V18a1.5 1.5 0 0 0 1.5 1.5H6V9.7Z" opacity="0"/></svg>
    </span>
  );
}

const REACH: { title: string; body: string; icon: React.ReactNode }[] = [
  { title: "Response Time", body: "Our team typically replies within a few minutes to a few hours depending on volume.", icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={P} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 14"/></svg> },
  { title: "What to Include", body: "Share your registered email, order details, and a clear description of your issue to help us resolve it faster.", icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={P} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m4 20 4.1-1 10.5-10.5a2.2 2.2 0 0 0-3.1-3.1L5 15.9 4 20Z"/><path d="m13.7 7.2 3.1 3.1"/></svg> },
  { title: "Safe & Secure", body: "Never share your password with anyone, including our support team. We will never ask for it.", icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={P} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-3.7 8-10V5l-8-3-8 3v7c0 6.3 8 10 8 10Z"/></svg> },
];

function SupportOrb() {
  return <div aria-hidden="true" className="relative h-[106px] w-[145px] shrink-0 overflow-hidden">
    <div className="absolute right-3 top-0 h-[82px] w-[82px] rounded-full border-[5px] border-[#a4a9b4] bg-[#121720] shadow-[inset_0_0_0_3px_#343b48]"/>
    <div className="absolute right-0 top-[25px] h-[62px] w-[62px] rounded-full bg-[#f04e23] shadow-[inset_-7px_-6px_0_rgba(128,22,6,.24)]"/>
    <div className="absolute right-[40px] top-[41px] h-[48px] w-[70px] rounded-[50%] bg-white shadow-[0_8px_13px_rgba(0,0,0,.28)] before:absolute before:-bottom-3 before:left-2 before:h-6 before:w-6 before:rotate-45 before:bg-white"/>
    <span className="absolute right-[50px] top-[55px] text-[20px] font-black tracking-[.18em] text-[#f04e23]">•••</span>
    <span className="absolute right-[112px] top-7 h-3 w-3 rounded-full bg-[#ff7c20] shadow-[0_0_12px_rgba(255,124,32,.8)]"/>
    <span className="absolute bottom-3 right-[8px] h-2 w-2 rounded-full bg-[#4f9cf9]"/>
    <span className="absolute bottom-5 right-[118px] h-4 w-4 rounded-full bg-[#a6dd52]"/>
  </div>;
}

export function SupportCenterPage({ setPage }: { setPage: (p: Page) => void }) {
  return (
    <div className="min-h-screen bg-[#030303]" style={{ fontFamily: FONT }}>
      <DesktopTopNav setPage={setPage} active="support"/>
      <AppMobileHeader className="md:hidden" setPage={setPage}/>

      <main className="mx-auto w-full max-w-[1180px] px-5 pb-16 pt-6 md:px-10 md:pt-10">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-[29px] font-bold leading-tight tracking-[-.035em] text-white md:text-[36px]">Support Center</h1>
            <p className="mt-3 max-w-[650px] text-[15px] leading-6 text-[#969ba7]">Need help? Our team is ready to assist you. Choose your preferred channel below.</p>
          </div>
          <div className="-mt-2 md:hidden"><SupportOrb/></div>
        </div>

        <div className="mt-8 flex items-start gap-3 rounded-[20px] border border-[#823a37] bg-[#421817] px-5 py-4 text-[15px] leading-7 text-[#f2adb0] md:mt-7">
          <svg className="mt-1 shrink-0" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#efb3b4" strokeWidth="1.9" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
          <span>Please use one channel only per issue. Do not send the same message across WhatsApp, Telegram, and email simultaneously.</span>
        </div>

        <section className="mt-8">
          <div className="mb-5 flex items-center justify-between gap-3">
            <h2 className="text-[22px] font-bold tracking-[-.025em] text-white">Contact channels</h2>
            <span className="hidden items-center gap-3 rounded-full bg-[#052611] px-5 py-2 text-[13px] font-medium text-[#37d56e] sm:flex"><span className="h-2.5 w-2.5 rounded-full bg-[#1de15d] shadow-[0_0_8px_#1de15d]"/>Fast response usually in minutes</span>
          </div>
          <div className="grid grid-cols-3 gap-3.5 md:max-w-[780px] md:gap-5">
            {CHANNELS.map((channel) => <button key={channel.name} onClick={() => {
              const url = channel.key === "email" ? `mailto:${channel.handle}`
                : channel.key === "whatsapp" ? `https://wa.me/${channel.handle.replace(/[^0-9]/g, "")}`
                : `https://t.me/${channel.handle.replace("@", "")}`;
              window.open(url, "_blank", "noopener");
            }} className="group flex aspect-[.92] min-h-[160px] flex-col items-center justify-center rounded-[25px] border border-[#223044] bg-[#101722] px-2 transition duration-200 hover:-translate-y-1 hover:border-white/25 active:scale-[.98] md:min-h-[210px]">
              <span className="mb-6 transition-transform duration-300 group-hover:scale-110"><ChannelIcon channel={channel.key} size={72}/></span>
              <span className="text-[17px] font-medium text-white md:text-[20px]">{channel.name}</span>
            </button>)}
          </div>
        </section>

        <section className="mt-10 max-w-[920px]">
          <h2 className="mb-5 text-[22px] font-bold tracking-[-.025em] text-white">Before you reach out</h2>
          <div className="space-y-4">
            {REACH.map((item) => <article key={item.title} className="flex items-start gap-4 rounded-[25px] border border-[#223044] bg-[#101722] p-6 md:p-7">
              <div className="grid h-[58px] w-[58px] shrink-0 place-items-center rounded-full bg-[#2d171d]">{item.icon}</div>
              <div className="pt-0.5"><h3 className="text-[20px] font-semibold tracking-[-.025em] text-white">{item.title}</h3><p className="mt-2 text-[15px] leading-7 text-[#a1a7b3] md:text-[16px]">{item.body}</p></div>
            </article>)}
          </div>
        </section>
      </main>
    </div>
  );
}
