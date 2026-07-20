"use client";

// Real-time seller reviews — shared by the storefront (read-only, responses
// visible) and the seller's own profile (with a "Respond" action). Matches the
// reference: avatar + "Anonymous" + exact date & time, feedback text, and a
// green/red sentiment badge, with All / Positive / Negative filters.

import { useState } from "react";
import { P, FONT, Spinner } from "../shared";
import { respondToReview, type ApiReview } from "../lib/api";
import { toast } from "../toast";

// "16 July 2024 at 03:38:36" — exactly as the reference shows.
export function formatReviewDateTime(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  return `${date} at ${time}`;
}

function AnonAvatar({ color }: { color: string }) {
  return (
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full" style={{ border: `1.5px solid ${color}` }}>
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="9" r="3.2"/><path d="M5.5 20c1-3.2 3.6-5 6.5-5s5.5 1.8 6.5 5"/>
      </svg>
    </span>
  );
}

function SentimentBadge({ positive }: { positive: boolean }) {
  const color = positive ? "#16a34a" : "#ef4444";
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-[12.5px] font-semibold" style={{ color, border: `1px solid ${color}` }}>
      {positive
        ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/><path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>
        : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10z"/><path d="M17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/></svg>}
      {positive ? "Positive" : "Negative"}
    </span>
  );
}

export interface ReviewPalette {
  text: string; sub: string; border: string; chipBg: string; chipActive: string; responseBg: string;
}
export const DARK_REVIEW_PALETTE: ReviewPalette = {
  text: "#ffffff", sub: "#8a97a8", border: "#232b38", chipBg: "#161d28", chipActive: "rgba(240,78,35,0.14)", responseBg: "#0d1219",
};
export const THEMED_REVIEW_PALETTE: ReviewPalette = {
  text: "var(--sb-nav-active)", sub: "var(--sb-chip-text)", border: "var(--sb-mbd)", chipBg: "var(--sb-chip)", chipActive: "rgba(240,78,35,0.14)", responseBg: "var(--sb-fill)",
};

type Filter = "all" | "positive" | "negative";

function ReviewRow({ review, palette, canRespond, onResponded }:
  { review: ApiReview; palette: ReviewPalette; canRespond: boolean; onResponded: (id: number, text: string) => void }) {
  const positive = review.sentiment !== "negative";
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (busy || !text.trim()) return;
    setBusy(true);
    const r = await respondToReview(review.id, text.trim());
    setBusy(false);
    if (!r.ok) { toast.error(r.error ?? "Could not post your response."); return; }
    onResponded(review.id, text.trim());
    setOpen(false); setText("");
    toast.success("Your response was posted");
  };
  return (
    <div className="py-4" style={{ borderBottom: `1px solid ${palette.border}` }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <AnonAvatar color={palette.sub}/>
          <div className="min-w-0">
            <p className="text-[14px] font-bold leading-tight" style={{ color: palette.text }}>Anonymous</p>
            <p className="mt-0.5 text-[12px]" style={{ color: palette.sub }}>{formatReviewDateTime(review.created_at)}</p>
          </div>
        </div>
        <SentimentBadge positive={positive}/>
      </div>
      {review.feedback && <p className="mt-2 pl-[46px] text-[13.5px] leading-relaxed" style={{ color: palette.text }}>{review.feedback}</p>}

      {/* Seller's response — visible to everyone once posted */}
      {review.response && (
        <div className="mt-2.5 ml-[46px] rounded-xl px-3.5 py-2.5" style={{ background: palette.responseBg, border: `1px solid ${palette.border}` }}>
          <p className="flex items-center gap-1.5 text-[11px] font-bold" style={{ color: P }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={P} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 17l-5-5 5-5"/><path d="M4 12h11a5 5 0 0 1 5 5v2"/></svg>
            SELLER RESPONSE
            {review.response_at && <span className="font-medium" style={{ color: palette.sub }}>· {formatReviewDateTime(review.response_at)}</span>}
          </p>
          <p className="mt-1 text-[13px] leading-relaxed" style={{ color: palette.text }}>{review.response}</p>
        </div>
      )}

      {/* Seller respond action (own profile only, and only once) */}
      {canRespond && !review.response && (
        <div className="mt-2.5 ml-[46px]">
          {open ? (
            <div>
              <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder="Write a professional response…"
                className="w-full rounded-lg px-3 py-2 text-[13px] outline-none resize-none"
                style={{ background: palette.responseBg, border: `1px solid ${palette.border}`, color: palette.text, fontFamily: FONT }}/>
              <div className="mt-2 flex gap-2">
                <button onClick={submit} disabled={busy || !text.trim()} className="flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[12.5px] font-bold text-white transition hover:opacity-90 disabled:opacity-60" style={{ background: P }}>
                  {busy && <Spinner size={14}/>}{busy ? "Posting…" : "Post response"}
                </button>
                <button onClick={() => { setOpen(false); setText(""); }} className="rounded-full px-4 py-1.5 text-[12.5px] font-semibold" style={{ color: palette.sub }}>Cancel</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 text-[12.5px] font-bold" style={{ color: P }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={P} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              Respond
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function ReviewsList({ reviews, loaded, palette, canRespond = false }:
  { reviews: ApiReview[]; loaded: boolean; palette: ReviewPalette; canRespond?: boolean }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [local, setLocal] = useState<Record<number, { response: string; response_at: string }>>({});
  const merged = reviews.map((r) => local[r.id] ? { ...r, ...local[r.id] } : r);
  const positives = merged.filter((r) => r.sentiment !== "negative");
  const negatives = merged.filter((r) => r.sentiment === "negative");
  const shown = filter === "all" ? merged : filter === "positive" ? positives : negatives;
  const onResponded = (id: number, text: string) => setLocal((m) => ({ ...m, [id]: { response: text, response_at: new Date().toISOString() } }));

  const pills: { id: Filter; label: string; count: number }[] = [
    { id: "all", label: "All", count: merged.length },
    { id: "positive", label: "Positive", count: positives.length },
    { id: "negative", label: "Negative", count: negatives.length },
  ];

  return (
    <div style={{ fontFamily: FONT }}>
      {/* Filter pills */}
      <div className="flex flex-wrap gap-2">
        {pills.map((p) => (
          <button key={p.id} onClick={() => setFilter(p.id)}
            className="rounded-full px-4 py-2 text-[13px] font-bold transition"
            style={filter === p.id
              ? { background: palette.chipActive, color: P }
              : { background: palette.chipBg, color: palette.sub }}>
            {p.label} ({p.count})
          </button>
        ))}
      </div>

      {!loaded && reviews.length === 0 && (
        <div className="flex justify-center py-12"><Spinner size={26} color={P}/></div>
      )}
      {loaded && shown.length === 0 && (
        <p className="py-12 text-center text-[13.5px]" style={{ color: palette.sub }}>
          {filter === "all" ? "No reviews yet." : `No ${filter} reviews yet.`}
        </p>
      )}
      <div className="mt-1">
        {shown.map((r) => (
          <ReviewRow key={r.id} review={r} palette={palette} canRespond={canRespond} onResponded={onResponded}/>
        ))}
      </div>
    </div>
  );
}
