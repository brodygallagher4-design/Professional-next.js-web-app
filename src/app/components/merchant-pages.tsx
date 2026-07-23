"use client";

import { useState, useEffect } from "react";
import {
  ArrowLeft01Icon, ArrowRight01Icon, Copy01Icon, Location01Icon, Clock01Icon,
  Search01Icon, StarIcon, UserIcon, FavouriteIcon, ThumbsUpIcon, ThumbsDownIcon,
  Camera01Icon, PlayCircleIcon, CheckmarkBadge01Icon,
} from "hugeicons-react";
import { DesktopTopNav, FONT, AppMobileHeader, setStoreMerchant, getStoreMerchant, sellerSlug, VerifiedBadge, BrandIcon, BRAND_LOGOS } from "../shared";
import type { BrandKey } from "../shared";
import { fetchProfile, fetchSellerReviews, fetchStorefront, fetchMerchantStatus, type ApiReview, type ApiStoreAd, type ApiStatus } from "../lib/api";
import { fetchMerchants, readCache, writeCache } from "../lib/api";
import { StatusRing, StatusViewer } from "./status";
import { countryByIso } from "../lib/countries";
import { ReviewsList, DARK_REVIEW_PALETTE } from "./reviews";
import type { Page, StoreMerchant } from "../shared";

// ─── DATA ───────────────────────────────────────────────────────────────────────
// A live merchant card (all fields resolved from the database).
interface MerchantCard {
  id?: number | string; // the merchant UUID
  name: string;
  rating: string;
  sales: string;
  success: string;
  avatar: string;
  ring: boolean;
  location?: string;
  joined?: string;
  bio?: string;
}

// ─── SMALL BUILDING BLOCKS ────────────────────────────────────────────────────────
// Both use the shared premium verified seal so every badge matches.
function VerifiedStarBadge() { return <VerifiedBadge size={18} />; }
function VerifiedShield({ size = 20 }: { size?: number }) { return <VerifiedBadge size={size} />; }

// Dark circular tile holding the green WhatsApp glyph (matches product rows)

// Circular bar-chart stat glyph
function StatGlyph({ color }: { color: string }) {
  return (
    <span className="flex h-11 w-11 items-center justify-center rounded-full" style={{ background: `${color}26` }}>
      <svg width="20" height="20" viewBox="0 0 24 24">
        <rect x="4"  y="11" width="3.4" height="9"  rx="1.2" fill={color} />
        <rect x="10.3" y="6" width="3.4" height="14" rx="1.2" fill={color} />
        <rect x="16.6" y="9" width="3.4" height="11" rx="1.2" fill={color} />
      </svg>
    </span>
  );
}

// ─── TOP MERCHANTS ────────────────────────────────────────────────────────────────
export function TopMerchantsPage({ setPage }: { setPage: (page: Page) => void }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  // Live merchants only — no demo fallback, so every "View store" carries a real
  // merchant UUID and can never open a name-slug (or the wrong) storefront.
  const [list, setList] = useState<MerchantCard[]>(() => readCache<MerchantCard[]>("sb-merchants-page") ?? []);
  const [loaded, setLoaded] = useState<boolean>(() => readCache<MerchantCard[]>("sb-merchants-page") != null);
  useEffect(() => {
    let cancelled = false;
    fetchMerchants().then((api) => {
      if (cancelled) return;
      const mapped: MerchantCard[] = (api ?? []).map((m) => ({
        id: (m.merchant_id ?? m.id) as number | string,
        name: m.name,
        rating: String(m.rating),
        sales: m.sales >= 1000 ? `${(m.sales / 1000).toFixed(1)}k` : String(m.sales),
        success: `${m.success_rate}%`,
        avatar: m.avatar_url || "",
        ring: Boolean(m.hot),
        location: m.location ?? undefined,
        joined: m.joined ? new Date(m.joined).toLocaleDateString("en-GB") : undefined,
        bio: m.bio ?? undefined,
      }));
      writeCache("sb-merchants-page", mapped);
      setList(mapped);
      setLoaded(true);
    });
    return () => { cancelled = true; };
  }, []);
  const tabs = [
    { key: "All",   label: "All",   icon: null },
    { key: "sales", label: "Most sales", icon: "🔥" },
    { key: "rated", label: "Top rated",  icon: "⭐" },
    { key: "both",  label: "Most sales & Top rated", icon: "👑" },
  ];
  const shown = list.filter((m) => m.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="min-h-screen bg-[#050506] text-white" style={{ fontFamily: FONT }}>
      <DesktopTopNav setPage={setPage} active="marketplace" />
      <AppMobileHeader className="md:hidden" setPage={setPage}/>

      <main className="mx-auto max-w-[1080px] px-4 pb-28 pt-8 sm:px-7">
        {/* Header */}
        <div className="flex gap-3">
          <button onClick={() => setPage("marketplace")} className="mt-1 text-white transition hover:opacity-70">
            <ArrowLeft01Icon size={26} />
          </button>
          <div>
            <h1 className="text-[30px] font-bold tracking-[-.03em] leading-tight">Top Merchants</h1>
            <p className="mt-1 text-[14px] text-[#8a97a8]">Trusted merchants with proven track record and excellent service</p>
          </div>
        </div>

        {/* Search */}
        <div className="mt-7 flex h-14 items-center gap-3 rounded-full border border-[#232b38] bg-[#0e141d] px-5">
          <Search01Icon size={20} className="text-[#5f6b7c]" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search merchants"
            className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-[#8b97a6]" />
        </div>

        {/* Filter pills */}
        <div className="mt-4 flex gap-2.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {tabs.map((t) => (
            <button key={t.key} onClick={() => setFilter(t.key)}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2.5 text-[13px] font-semibold transition ${filter === t.key ? "bg-[#f04e23] text-white" : "bg-[#161d28] text-[#aab7c6] hover:bg-[#1c2532]"}`}>
              {t.label}{t.icon && <span>{t.icon}</span>}
            </button>
          ))}
        </div>

        {/* Loading skeletons — shown only on the very first visit before the
            live merchants arrive (repeat visits paint instantly from cache). */}
        {!loaded && list.length === 0 && (
          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-[150px] animate-pulse rounded-[18px] border border-[#20293a] bg-[#0a0f16]"/>
            ))}
          </div>
        )}
        {loaded && list.length === 0 && (
          <p className="mt-16 text-center text-[14px] text-[#8a97a8]">No merchants to show yet.</p>
        )}

        {/* Merchant cards */}
        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {shown.map((m) => (
            <article key={String(m.id ?? m.name)} className="rounded-[18px] border border-[#20293a] bg-[#070a10] p-5 transition hover:border-[#3a4658]">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={`flex h-14 w-14 items-center justify-center overflow-hidden rounded-full ${m.ring ? "ring-2 ring-[#f04e23]" : ""}`}>
                    {m.avatar
                      ? <img src={m.avatar} alt={m.name} className="h-full w-full object-cover" />
                      : <span className="flex h-full w-full items-center justify-center bg-white text-[#1c1c1c]"><UserIcon size={30} /></span>}
                  </div>
                  <div>
                    <h2 className="text-[16px] font-bold leading-tight">{m.name}</h2>
                    <div className="mt-1.5"><VerifiedStarBadge /></div>
                  </div>
                </div>
                <span className="flex items-center gap-1 text-[14px] font-bold">
                  <StarIcon size={15} className="fill-[#ffca12] text-[#ffca12]" />{m.rating}
                </span>
              </div>

              <div className="mt-5 flex items-end justify-between">
                <div className="flex items-center gap-4">
                  <div>
                    <b className="block text-[17px] leading-none">{m.sales}</b>
                    <span className="text-[11px] text-[#8a97a8]">Sales</span>
                  </div>
                  <span className="h-8 w-px bg-[#232b38]" />
                  <div>
                    <b className="block text-[17px] leading-none">{m.success}</b>
                    <span className="text-[11px] text-[#8a97a8]">Success Rate</span>
                  </div>
                </div>
                <button onClick={() => {
                    setStoreMerchant({ id: m.id, name: m.name, avatar: m.avatar || undefined, rating: m.rating, sales: m.sales, success: m.success, location: m.location, joined: m.joined, bio: m.bio });
                    setPage("store");
                  }}
                  className="flex items-center gap-1 rounded-full bg-[#3a1a0f] px-4 py-2.5 text-[13px] font-semibold text-[#ff6141] transition hover:bg-[#4d2314]">
                  View store <ArrowRight01Icon size={15} />
                </button>
              </div>
            </article>
          ))}
        </div>
      </main>

      <button onClick={() => setPage("support")}
        className="fixed bottom-6 right-5 flex h-14 w-14 items-center justify-center rounded-full bg-[#f04e23] text-2xl font-bold shadow-[0_8px_24px_rgba(240,78,35,.5)] transition hover:scale-105">?</button>
    </div>
  );
}

// ─── SELLER STORE ───────────────────────────────────────────────────────────────
export function SellerStorePage({ setPage }: { setPage: (page: Page) => void }) {
  const [copied, setCopied] = useState(false);
  const [liked, setLiked] = useState<number[]>([]);
  // The merchant selected via any "View store" button; a /seller/<uuid> deep
  // link resolves the merchant from the database when opened directly.
  const [selected, setSelected] = useState<StoreMerchant | null>(() => getStoreMerchant());
  const [resolveFailed, setResolveFailed] = useState(false);
  const [storeAds, setStoreAds] = useState<ApiStoreAd[]>([]);
  const [adsLoaded, setAdsLoaded] = useState(false);
  // Cold deep-link load: resolve the seller from the URL (/seller/<key>) against
  // the real database — works for any activated seller, not just seeded merchants.
  useEffect(() => {
    if (selected) return; // never re-resolve an already-loaded seller
    const path = window.location.pathname;
    if (!path.startsWith("/seller/")) { setResolveFailed(true); return; }
    const key = decodeURIComponent(path.split("/")[2] ?? "");
    if (!key) { setResolveFailed(true); return; }
    let cancelled = false;
    fetchStorefront(key).then((res) => {
      if (cancelled) return;
      if (!res || (res as { error?: string }).error || !res.name) { setResolveFailed(true); return; }
      setSelected({
        id: res.merchant_id ?? res.id, name: res.name, avatar: res.avatar_url || undefined,
        rating: String(res.rating),
        sales: res.sales >= 1000 ? (res.sales / 1000).toFixed(1) + "k" : String(res.sales),
        success: res.success_rate + "%",
        location: res.location ? (countryByIso(res.location)?.name ?? res.location) : undefined,
        joined: res.joined ? new Date(res.joined).toLocaleDateString("en-GB") : undefined,
        bio: res.bio ?? undefined,
      });
      setStoreAds(res.ads ?? []);
      setAdsLoaded(true);
    }).catch(() => { if (!cancelled) setResolveFailed(true); });
    return () => { cancelled = true; };
  }, [selected]);
  // When the seller was chosen in-app (top merchants / "view store"), the in-memory
  // object lacks bio/location/joined — fetch the authoritative storefront and merge
  // it in so the real data always shows (never the placeholder fallback).
  useEffect(() => {
    if (!selected || adsLoaded) return;
    const key = selected.id ? String(selected.id) : "";
    if (!key) { setAdsLoaded(true); return; }
    let cancelled = false;
    fetchStorefront(key).then((res) => {
      if (cancelled) { return; }
      if (res && res.name) {
        setSelected((prev) => prev ? {
          ...prev,
          avatar: res.avatar_url || prev.avatar,
          rating: res.rating != null ? String(res.rating) : prev.rating,
          sales: res.sales >= 1000 ? (res.sales / 1000).toFixed(1) + "k" : String(res.sales),
          success: res.success_rate != null ? res.success_rate + "%" : prev.success,
          location: res.location ? (countryByIso(res.location)?.name ?? res.location) : prev.location,
          joined: res.joined ? new Date(res.joined).toLocaleDateString("en-GB") : prev.joined,
          bio: res.bio ?? prev.bio,
        } : prev);
      }
      setStoreAds(res?.ads ?? []);
      setAdsLoaded(true);
    }).catch(() => { if (!cancelled) setAdsLoaded(true); });
    return () => { cancelled = true; };
  }, [selected, adsLoaded]);
  // Premium storefront URL: /seller/<merchant uuid>. Only sync once the seller
  // is resolved so a refresh never rewrites the link to a different store.
  useEffect(() => {
    if (!selected) return;
    try {
      const url = "/seller/" + sellerSlug({ id: selected.id, name: selected.name });
      if (window.location.pathname !== url) window.history.replaceState({}, "", url);
    } catch { /* ignore */ }
  }, [selected]);

  // Real reviews this seller has received (public, read-only on the storefront).
  const [storeTab, setStoreTab] = useState<"ads" | "reviews">("ads");
  const [reviews, setReviews] = useState<ApiReview[]>([]);
  const [reviewsLoaded, setReviewsLoaded] = useState(false);
  const merchantKey = selected?.id ? String(selected.id) : "";
  const [sellerStatus, setSellerStatus] = useState<ApiStatus[]>([]);
  const [statusViewer, setStatusViewer] = useState(false);
  useEffect(() => {
    if (!merchantKey) return;
    let cancelled = false;
    fetchSellerReviews(merchantKey).then((rows) => {
      if (cancelled) return;
      setReviews(rows ?? []);
      setReviewsLoaded(true);
    });
    fetchMerchantStatus(merchantKey).then((rows) => { if (!cancelled) setSellerStatus(rows ?? []); });
    return () => { cancelled = true; };
  }, [merchantKey]);
  const positiveCount = reviews.filter((r) => r.sentiment !== "negative").length;
  const reviewPct = reviews.length ? Math.round((positiveCount / reviews.length) * 100) : 0;

  // No default-seller fallback: while the deep link resolves show a loader, and
  // if the store can't be found show a clear message — never another seller.
  if (!selected) {
    return (
      <div className="min-h-screen bg-[#050506] text-white" style={{ fontFamily: FONT }}>
        <DesktopTopNav setPage={setPage} active="marketplace" />
        <AppMobileHeader className="md:hidden" setPage={setPage}/>
        <div className="grid min-h-[70vh] place-items-center px-6 text-center">
          {resolveFailed ? (
            <div className="flex flex-col items-center">
              <span className="mb-4 grid h-14 w-14 place-items-center rounded-full bg-[#141a24]">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#8a97a8" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/></svg>
              </span>
              <p className="text-[16px] font-bold">Store not found</p>
              <p className="mt-1 max-w-[300px] text-[13px] text-[#8a97a8]">This storefront doesn&apos;t exist or is no longer available.</p>
              <button onClick={() => setPage("merchants")} className="mt-5 rounded-full px-6 py-2.5 text-[13px] font-bold text-white transition hover:opacity-90" style={{ background: "#f04e23" }}>Back to Top Merchants</button>
            </div>
          ) : (
            <span className="h-8 w-8 animate-spin rounded-full border-2 border-white/15" style={{ borderTopColor: "#f04e23" }}/>
          )}
        </div>
      </div>
    );
  }

  // Real identity only — optional fields get neutral fallbacks, never another
  // seller's data.
  const seller: StoreMerchant = {
    ...selected,
    location: selected.location ?? "Not specified",
    joined: selected.joined ?? "recently",
    bio: selected.bio ?? "",   // the seller's real bio only — no fake placeholder
  };
  const nameWords = seller.name.trim().split(/\s+/);
  const bannerTop = nameWords[0].toUpperCase();
  const bannerRest = nameWords.slice(1).join(" ").toUpperCase();
  const link = `${typeof window !== "undefined" ? window.location.host : "app.simbazaar.com"}/seller/${sellerSlug({ id: selected?.id, name: seller.name })}`;
  const copy = async () => { try { await navigator.clipboard.writeText(link); } catch {} setCopied(true); setTimeout(() => setCopied(false), 1400); };

  const stats: { title: string; value: string; label: string; color: string; kind?: string }[] = [
    { title: "Feedback",    value: String(reviews.length),  label: "Total Reviews",   color: "#2f7bff", kind: "feedback" },
    { title: "Performance", value: seller.sales ?? "0",  label: "Total sold",      color: "#22c55e", kind: "bar" },
    { title: "Inventory",   value: String(storeAds.length), label: "Active Ads",      color: "#f04e23" },
    { title: "Reliability", value: "0",   label: "Cancelled Orders",color: "#f5a623", kind: "trust" },
  ];

  const leftFeat  = [["whatsapp", "WHATSAPP"], ["facebook", "FACEBOOK"], ["instagram", "INSTAGRAM"], ["x", "X (TWITTER)"]] as const;
  const rightFeat = ["USA NUMBERS", "ALL COUNTRY", "HIGH QUALITY", "INSTANT"];

  return (
    <div className="min-h-screen bg-[#050506] text-white" style={{ fontFamily: FONT }}>
      <DesktopTopNav setPage={setPage} active="marketplace" />
      <AppMobileHeader className="md:hidden" setPage={setPage}/>

      <main className="mx-auto max-w-[1080px] px-4 pb-28 pt-6 sm:px-7">
        {/* Banner */}
        <section className="relative overflow-hidden rounded-[20px] border border-[#1c2431]"
          style={{ background: "radial-gradient(ellipse at 50% -10%, #1c2b22, #0a0d0b 70%)" }}>
          <div className="absolute inset-0 opacity-[.12] [background-image:repeating-linear-gradient(115deg,transparent_0_18px,#fff_18px_19px)]" />
          <div className="relative flex items-center justify-between gap-2 px-4 py-6 sm:px-8 sm:py-8">
            {/* left brand column */}
            <div className="hidden flex-col gap-3 sm:flex">
              {leftFeat.map(([brand, name]) => (
                <div key={name} className="flex items-center gap-2">
                  <MiniBrand brand={brand} />
                  <div className="leading-none">
                    <p className="text-[10px] font-bold tracking-wide">{name}</p>
                    <p className="mt-0.5 text-[8px] font-semibold text-[#8bd45a]">ALL VERSION</p>
                  </div>
                </div>
              ))}
            </div>

            {/* center title */}
            <div className="flex-1 text-center">
              <p className="text-[9px] font-bold tracking-[.15em] text-[#c7d0da]">ALL COUNTRY WHATSAPP NUMBERS 📲</p>
              <p className="text-[8px] font-semibold tracking-[.2em] text-[#8bd45a]">ANY KIND OF VERSION</p>
              <h2 className="mt-1 text-[26px] font-black italic leading-[0.85] tracking-tight text-white sm:text-[40px]">{bannerTop}
                {bannerRest && <span className="block text-[30px] text-[#7ed321] sm:text-[46px] [text-shadow:0_2px_0_#3d6b12]">{bannerRest}</span>}
              </h2>
              <span className="mt-2 inline-block rounded-full border border-white/40 px-3 py-1 text-[8px] font-bold tracking-wide sm:text-[10px]">PREORDER &amp; ALL COUNTRIES AVAILABLE</span>
            </div>

            {/* right feature column */}
            <div className="hidden flex-col gap-3 text-right sm:flex">
              {rightFeat.map((f) => (
                <div key={f} className="flex items-center justify-end gap-2">
                  <div className="leading-none">
                    <p className="text-[10px] font-bold tracking-wide">{f}</p>
                    <p className="mt-0.5 text-[8px] font-semibold text-[#8bd45a]">AVAILABLE</p>
                  </div>
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#7ed321]/20 text-[11px]">✓</span>
                </div>
              ))}
            </div>
          </div>
          <button className="absolute bottom-3 right-3 flex h-10 w-10 items-center justify-center rounded-full bg-[#12233a]/80 text-[#7fb2e6] backdrop-blur transition hover:bg-[#173049]">
            <Camera01Icon size={18} />
          </button>
        </section>

        {/* Avatar — with a story ring when the seller has an active status */}
        <div className="relative -mt-8 ml-6 w-fit">
          <StatusRing active={sellerStatus.length > 0} size={96} onClick={()=>setStatusViewer(true)}>
            <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-[6px] border-[#050506] bg-[#111] shadow-xl ring-2 ring-[#7ed321]/40">
              {seller.avatar
                ? <img src={seller.avatar} alt={seller.name} className="h-full w-full object-cover" />
                : <span className="flex h-full w-full items-center justify-center bg-white text-[34px] font-extrabold text-[#1c1c1c]">{seller.name.charAt(0).toUpperCase()}</span>}
            </div>
          </StatusRing>
        </div>
        {statusViewer && sellerStatus.length > 0 && (
          <StatusViewer items={sellerStatus} sellerName={seller.name} avatarUrl={seller.avatar} onClose={()=>setStatusViewer(false)}/>
        )}

        {/* Identity */}
        <div className="mt-4 flex items-center gap-2">
          <h1 className="text-[27px] font-bold tracking-[-.03em]">{seller.name}</h1>
          <VerifiedShield size={22} />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-4 text-[13px] text-[#9aa7b6]">
          <span className="flex items-center gap-1"><Location01Icon size={15} className="text-[#f04e23]" />{seller.location}</span>
          <span className="flex items-center gap-1"><Clock01Icon size={15} className="text-[#f04e23]" />Joined {seller.joined}</span>
        </div>
        {seller.bio && <p className="mt-4 max-w-2xl text-[14px] leading-relaxed text-[#8a97a8]">{seller.bio}</p>}

        {/* Merchant link */}
        <div className="mt-4 flex items-center gap-3 rounded-[16px] border border-[#5a2c1a] bg-[#2c150c] px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold tracking-wide text-[#ff6141]">MERCHANT LINK</p>
            <p className="mt-1 truncate text-[14px] font-medium">{link}</p>
          </div>
          <button onClick={copy} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f04e23] transition hover:bg-[#ff6141]">
            {copied ? <span className="text-[15px] font-bold">✓</span> : <Copy01Icon size={18} />}
          </button>
        </div>

        {/* Stats grid — the Feedback card opens the Reviews section */}
        <section className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {stats.map((s) => {
            const isFeedback = s.kind === "feedback";
            const Wrap = isFeedback ? "button" : "div";
            return (
              <Wrap key={s.title} {...(isFeedback ? { onClick: () => { setStoreTab("reviews"); document.getElementById("store-listings")?.scrollIntoView({ behavior: "smooth" }); } } : {})}
                className={`rounded-[16px] border border-[#1c2431] bg-[#070a10] p-4 text-left transition ${isFeedback ? "hover:border-[#f04e23] cursor-pointer" : ""}`}>
                <StatGlyph color={s.color} />
                <p className="mt-3 text-[13px] text-[#9aa7b6]">{s.title}</p>
                <b className="mt-1 block text-[34px] leading-none tracking-tight">{s.value}</b>
                <p className="mt-1 text-[12px] text-[#9aa7b6]">{s.label}</p>
                {isFeedback && (
                  <div className="mt-3 flex items-center gap-4 text-[12px] font-semibold">
                    <span className="flex items-center gap-1 text-[#22c55e]"><ThumbsUpIcon size={14} />{reviewPct}%</span>
                    <span className="flex items-center gap-1 text-[#ef4444]"><ThumbsDownIcon size={14} />{reviews.length ? 100 - reviewPct : 0}%</span>
                  </div>
                )}
                {s.kind === "bar" && <span className="mt-4 block h-1.5 rounded-full bg-[#22c55e]" />}
                {s.kind === "trust" && <p className="mt-1 text-[10px] text-[#6c7789]">Lower is better for trust</p>}
              </Wrap>
            );
          })}
        </section>

        {/* Ads / Reviews */}
        <section id="store-listings" className="mt-7 rounded-[18px] border border-[#1c2431] bg-[#070a10] p-4 sm:p-5">
          <div className="flex items-center justify-between border-b border-[#232b38]">
            <div className="flex items-end gap-6">
              <button onClick={() => setStoreTab("ads")} className="relative pb-3 text-[14px] font-bold transition-colors" style={{ color: storeTab === "ads" ? "#f04e23" : "#8a97a8" }}>
                Ads{storeTab === "ads" && <span className="absolute inset-x-0 bottom-0 h-[2.5px] rounded-full bg-[#f04e23]"/>}
              </button>
              <button onClick={() => setStoreTab("reviews")} className="relative pb-3 text-[14px] font-bold transition-colors" style={{ color: storeTab === "reviews" ? "#f04e23" : "#8a97a8" }}>
                Reviews{storeTab === "reviews" && <span className="absolute inset-x-0 bottom-0 h-[2.5px] rounded-full bg-[#f04e23]"/>}
              </button>
            </div>
            {storeTab === "reviews" && (
              <button onClick={() => setStoreTab("ads")} className="flex items-center gap-1.5 pb-3 text-[13px] font-semibold text-[#f04e23]">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#f04e23" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 5 5v4"/></svg>
                Back to Ads
              </button>
            )}
          </div>

          {storeTab === "reviews" && (
            <div className="mt-5">
              <ReviewsList reviews={reviews} loaded={reviewsLoaded} palette={DARK_REVIEW_PALETTE}/>
            </div>
          )}

          {storeTab === "ads" && (
          <div className="mt-5 space-y-4">
            {!adsLoaded ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-[104px] animate-pulse rounded-[16px] border border-[#232b38] bg-[#04070c]"/>
              ))
            ) : storeAds.length === 0 ? (
              <div className="grid place-items-center py-14 text-center">
                <span className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-[#141a24]"><Search01Icon size={22} className="text-[#8a97a8]"/></span>
                <p className="text-[14px] font-bold">No listings yet</p>
                <p className="mt-1 text-[12px] text-[#8a97a8]">This seller hasn&apos;t published any ads yet.</p>
              </div>
            ) : storeAds.map((p, i) => (
              <article key={p.id ?? i} className="flex gap-3 rounded-[16px] border border-[#232b38] bg-[#04070c] p-4 transition hover:border-[#3a4658]">
                <BrandIcon brand={(p.brand && p.brand in BRAND_LOGOS ? p.brand : "vpn") as BrandKey} size={40} />
                <div className="min-w-0 flex-1">
                  <h3 className="text-[14px] font-bold uppercase leading-tight">{p.title}</h3>
                  <p className="mt-1 line-clamp-1 text-[12px] text-[#8a97a8] capitalize">{p.category} · {p.quantity} in stock</p>
                  <div className="mt-2 flex items-center gap-1.5">
                    <span className="text-[12px] text-[#c2cdda]">{seller.name}</span>
                    <VerifiedShield size={14} />
                  </div>
                </div>
                <div className="flex flex-col items-end justify-between">
                  <div className="flex items-center gap-2">
                    <b className="text-[15px]">${Number(p.price).toFixed(2)}</b>
                    <button onClick={() => setLiked((o) => o.includes(i) ? o.filter((x) => x !== i) : [...o, i])} className="transition hover:scale-110">
                      <FavouriteIcon size={20} className={liked.includes(i) ? "fill-[#f04e23] text-[#f04e23]" : "text-white"} />
                    </button>
                  </div>
                  <button onClick={() => setPage("marketplace")} className="rounded-full bg-[#f04e23] px-5 py-2 text-[13px] font-bold transition hover:bg-[#ff6141]">Buy now</button>
                </div>
              </article>
            ))}
          </div>
          )}
        </section>
      </main>

      <button onClick={() => setPage("support")}
        className="fixed bottom-6 right-5 flex h-14 w-14 items-center justify-center rounded-full bg-[#f04e23] text-2xl font-bold shadow-[0_8px_24px_rgba(240,78,35,.5)] transition hover:scale-105">?</button>
    </div>
  );
}

// small brand glyph for the banner left column
function MiniBrand({ brand }: { brand: "whatsapp" | "facebook" | "instagram" | "x" }) {
  const map: Record<string, { bg: string; svg: React.ReactNode }> = {
    whatsapp:  { bg: "#25D366", svg: <path fill="#fff" d="M12 2C6.5 2 2 6.5 2 12c0 1.9.5 3.6 1.4 5.2L2 22l4.9-1.3C8.5 21.5 10.2 22 12 22c5.5 0 10-4.5 10-10S17.5 2 12 2zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .3-3.4-.7-2.9-1.2-4.7-4.1-4.8-4.3-.1-.2-1.2-1.6-1.2-3s.7-2.1 1-2.4c.2-.3.5-.3.7-.3h.5c.2 0 .4-.1.7.5.2.6.8 2 .9 2.1.1.1.1.3 0 .5-.4.9-1 1-.5 1.7.9 1.4 2 2 2.6 2.2.3.1.5.1.6-.1l.9-1.2c.2-.3.4-.2.6-.1l2 1c.3.2.3.8.1 1.4z" /> },
    facebook:  { bg: "#1877F2", svg: <path fill="#fff" d="M14 8h2V5h-2c-1.7 0-3 1.3-3 3v2H9v3h2v6h3v-6h2.2l.8-3H14V8.5c0-.3.2-.5.5-.5H14z" /> },
    instagram: { bg: "#E1306C", svg: <><rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="#fff" strokeWidth="2" /><circle cx="12" cy="12" r="4" fill="none" stroke="#fff" strokeWidth="2" /><circle cx="17.5" cy="6.5" r="1.3" fill="#fff" /></> },
    x:         { bg: "#000", svg: <path fill="#fff" d="M17.5 3h2.9l-6.4 7.3L21.5 21h-5.8l-4.5-5.9L5.9 21H3l6.8-7.8L2.8 3h5.9l4.1 5.4L17.5 3z" /> },
  };
  const b = map[brand];
  return (
    <span className="flex h-6 w-6 items-center justify-center rounded-md" style={{ background: b.bg }}>
      <svg width="15" height="15" viewBox="0 0 24 24">{b.svg}</svg>
    </span>
  );
}
