"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { P, FONT, useScrollLock } from "../shared";
import { postStatus, deleteStatus, reactStatus, viewStatus, fetchMyStatus, type ApiStatus } from "../lib/api";
import { toast } from "../toast";

const STATUS_BGS = ["#f04e23", "#111827", "#1d4ed8", "#059669", "#7c3aed", "#db2777", "#0891b2", "#b45309"];
const REACTIONS = ["👍", "❤️", "🔥", "😮", "😂", "😍", "👏", "😢"];
const STORY_MS = 5000; // image / text auto-advance duration

/* ─── Gradient story ring around an avatar; click opens the viewer. ──────── */
export function StatusRing({ active, onClick, size, children }: { active: boolean; onClick?: () => void; size: number; children: React.ReactNode }) {
  if (!active) return <>{children}</>;
  return (
    <button type="button" onClick={onClick} aria-label="View status" className="relative grid place-items-center rounded-full transition-transform active:scale-95"
      style={{ width: size + 8, height: size + 8, padding: 3, background: "conic-gradient(from 210deg, #ffb347, #f04e23, #db2777, #f04e23, #ffb347)" }}>
      <span className="grid place-items-center rounded-full" style={{ width: size + 2, height: size + 2, background: "var(--sb-mbg)" }}>
        {children}
      </span>
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   STORY EDITOR — a full-page canvas composer (background + movable text/image
   layers, styling, layer order) that rasterises to a single image on publish.
   ═══════════════════════════════════════════════════════════════════════════ */

const REF_W = 360; // logical design width; text sizes are stored in this space
const RASTER_W = 900, RASTER_H = 1600; // published image resolution (9:16)

type BgFill = { kind: "solid"; color: string } | { kind: "grad"; from: string; to: string; angle: number };
type TextEl = { id: string; type: "text"; xPct: number; yPct: number; rot: number; text: string; font: string; size: number; color: string; variant: "plain" | "bg" | "border" };
type ImgEl = { id: string; type: "image"; xPct: number; yPct: number; rot: number; src: string; wPct: number; ar: number };
type El = TextEl | ImgEl;

const SOLIDS = ["#f04e23", "#7c3aed", "#2563eb", "#3b82f6", "#059669", "#db2777", "#eab308", "#0f172a", "#000000", "#ffffff"];
const GRADS: { from: string; to: string; angle: number }[] = [
  { from: "#ff8a7a", to: "#f0504f", angle: 160 },
  { from: "#7b5cff", to: "#3a1fd8", angle: 160 },
  { from: "#2dd4bf", to: "#0e7490", angle: 160 },
  { from: "#fbbf6b", to: "#f0684f", angle: 160 },
  { from: "#6d28d9", to: "#1e1b4b", angle: 160 },
  { from: "#3f4657", to: "#0b0b0d", angle: 160 },
];
const FONTS = [
  { label: "Satoshi", css: FONT },
  { label: "Classic", css: "Georgia, 'Times New Roman', serif" },
  { label: "Mono", css: "'Courier New', ui-monospace, monospace" },
  { label: "Impact", css: "Impact, 'Arial Black', system-ui, sans-serif" },
  { label: "Rounded", css: "'Trebuchet MS', system-ui, sans-serif" },
];
const TEXT_COLORS = ["#ffffff", "#000000", "#f04e23", "#db2777", "#eab308", "#22c55e", "#2563eb", "#7c3aed"];
const EMOJIS = ["😀", "😂", "😍", "🥳", "😎", "🤑", "🔥", "✨", "⭐", "💯", "👍", "👏", "🙌", "💪", "🎉", "🎁", "❤️", "💜", "💰", "💵", "💎", "🛒", "🏷️", "✅", "⚡", "🚀", "📢", "🤝", "👑", "🥇", "😮", "😭"];

const bgCss = (b: BgFill) => (b.kind === "solid" ? b.color : `linear-gradient(${b.angle}deg, ${b.from}, ${b.to})`);
const uid = () => Math.random().toString(36).slice(2, 9);
const isDark = (hex: string) => {
  const h = hex.replace("#", ""); if (h.length < 6) return true;
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) < 150;
};

export function StatusComposer({ open, onClose, onPosted }: { open: boolean; onClose: () => void; onPosted: () => void }) {
  const [bg, setBg] = useState<BgFill>({ kind: "grad", ...GRADS[0] });
  const [els, setEls] = useState<El[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [panel, setPanel] = useState<"none" | "bg" | "text" | "emoji">("none");
  const [busy, setBusy] = useState(false);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [stageW, setStageW] = useState(REF_W);
  // Full-screen text entry — keeps the input above the mobile keyboard so typing
  // actually works (a bottom-sheet textarea gets covered by the keyboard).
  const [editing, setEditing] = useState<{ id: string; isNew: boolean } | null>(null);
  const [draft, setDraft] = useState("");
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  useScrollLock(open);

  // Reset when closed.
  useEffect(() => {
    if (!open) { setBg({ kind: "grad", ...GRADS[0] }); setEls([]); setSel(null); setPanel("none"); setBusy(false); setEditing(null); setDraft(""); }
  }, [open]);

  // Reliably focus the text field when the editor opens (mobile needs the .focus()).
  useEffect(() => {
    if (!editing) return;
    const t = setTimeout(() => { taRef.current?.focus(); }, 60);
    return () => clearTimeout(t);
  }, [editing]);

  // Measure the stage so preview text sizes track the published raster exactly.
  useEffect(() => {
    if (!open) return;
    const measure = () => { if (stageRef.current) setStageW(stageRef.current.clientWidth); };
    measure();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    if (ro && stageRef.current) ro.observe(stageRef.current);
    window.addEventListener("resize", measure);
    return () => { ro?.disconnect(); window.removeEventListener("resize", measure); };
  }, [open]);

  const scaleP = stageW / REF_W; // preview scale relative to design space
  const selEl = els.find((e) => e.id === sel) ?? null;
  const patch = (id: string, p: Partial<TextEl> & Partial<ImgEl>) => setEls((prev) => prev.map((e) => (e.id === id ? { ...e, ...p } as El : e)));

  // ── Add elements ──────────────────────────────────────────────────────────
  const addText = () => {
    const id = uid();
    setEls((prev) => [...prev, { id, type: "text", xPct: 50, yPct: 45, rot: 0, text: "", font: FONTS[0].css, size: 28, color: "#ffffff", variant: "plain" }]);
    setSel(id); setPanel("none");
    setDraft(""); setEditing({ id, isNew: true });
  };
  // Emoji sticker → a text element (rasterises natively, scales/rotates like text).
  const addEmoji = (emo: string) => {
    const id = uid();
    setEls((prev) => [...prev, { id, type: "text", xPct: 50, yPct: 45, rot: 0, text: emo, font: FONTS[0].css, size: 46, color: "#ffffff", variant: "plain" }]);
    setSel(id); setPanel("none");
  };
  // Open the full-screen editor to change an existing text element's content.
  const editText = (el: TextEl) => { setSel(el.id); setPanel("none"); setDraft(el.text); setEditing({ id: el.id, isNew: false }); };
  const commitText = () => {
    if (!editing) return;
    const t = draft.replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, "").slice(0, 200);
    if (!t.trim()) setEls((prev) => prev.filter((e) => e.id !== editing.id));
    else patch(editing.id, { text: t });
    setEditing(null); setDraft("");
  };
  const cancelText = () => {
    if (editing?.isNew) setEls((prev) => prev.filter((e) => e.id !== editing.id));
    setEditing(null); setDraft("");
  };
  const addImage = () => {
    const input = document.createElement("input");
    input.type = "file"; input.accept = "image/png,image/jpeg,image/webp";
    input.onchange = () => {
      const file = input.files?.[0]; if (!file) return;
      if (file.size > 4 * 1024 * 1024) { toast.error("Image must be under 4 MB.", { title: "Too large" }); return; }
      const reader = new FileReader();
      reader.onload = () => {
        const src = String(reader.result);
        const probe = new Image();
        probe.onload = () => {
          const id = uid();
          setEls((prev) => [...prev, { id, type: "image", xPct: 50, yPct: 50, rot: 0, src, wPct: 62, ar: probe.width / probe.height || 1 }]);
          setSel(id); setPanel("none");
        };
        probe.src = src;
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const removeSel = () => { if (!sel) return; setEls((prev) => prev.filter((e) => e.id !== sel)); setSel(null); setPanel("none"); };
  const layer = (dir: -1 | 1) => {
    if (!sel) return;
    setEls((prev) => {
      const i = prev.findIndex((e) => e.id === sel); if (i < 0) return prev;
      const j = i + dir; if (j < 0 || j >= prev.length) return prev;
      const next = [...prev]; [next[i], next[j]] = [next[j], next[i]]; return next;
    });
  };

  // ── Gestures: one finger drags · two fingers pinch-scale + rotate ───────────
  type Gesture = { id: string; pts: Map<number, { x: number; y: number }>; ox: number; oy: number; sx: number; sy: number; baseDist: number; baseAng: number; baseSize: number; baseW: number; baseRot: number };
  const gest = useRef<Gesture | null>(null);
  const setTwoFingerBase = (g: Gesture) => {
    const pv = [...g.pts.values()]; if (pv.length < 2) return;
    const [a, b] = pv;
    g.baseDist = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    g.baseAng = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
    const el = els.find((e) => e.id === g.id);
    g.baseSize = el?.type === "text" ? el.size : 0;
    g.baseW = el?.type === "image" ? el.wPct : 0;
    g.baseRot = el?.rot ?? 0;
  };
  const onElPointerDown = (e: React.PointerEvent, el: El) => {
    e.stopPropagation();
    setSel(el.id);
    if (!gest.current || gest.current.id !== el.id) {
      gest.current = { id: el.id, pts: new Map(), ox: el.xPct, oy: el.yPct, sx: e.clientX, sy: e.clientY, baseDist: 0, baseAng: 0, baseSize: 0, baseW: 0, baseRot: 0 };
    }
    gest.current.pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (gest.current.pts.size === 2) setTwoFingerBase(gest.current);
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onStagePointerMove = (e: React.PointerEvent) => {
    const g = gest.current; if (!g || !g.pts.has(e.pointerId)) return;
    g.pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const rect = stageRef.current?.getBoundingClientRect(); if (!rect) return;
    if (g.pts.size >= 2) {
      const [a, b] = [...g.pts.values()];
      const dist = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const ang = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
      const scale = dist / (g.baseDist || 1);
      const rot = Math.round(g.baseRot + (ang - g.baseAng));
      const el = els.find((x) => x.id === g.id);
      if (el?.type === "text") patch(g.id, { size: Math.max(12, Math.min(120, Math.round(g.baseSize * scale))), rot });
      else if (el?.type === "image") patch(g.id, { wPct: Math.max(12, Math.min(100, g.baseW * scale)), rot });
    } else {
      const dx = ((e.clientX - g.sx) / rect.width) * 100;
      const dy = ((e.clientY - g.sy) / rect.height) * 100;
      patch(g.id, { xPct: Math.max(2, Math.min(98, g.ox + dx)), yPct: Math.max(3, Math.min(97, g.oy + dy)) });
    }
  };
  const onStagePointerUp = (e: React.PointerEvent) => {
    const g = gest.current; if (!g) return;
    g.pts.delete(e.pointerId);
    if (g.pts.size === 0) { gest.current = null; return; }
    // Dropped 2→1: rebase the drag origin to the remaining finger so it doesn't jump.
    const el = els.find((x) => x.id === g.id);
    const [p] = [...g.pts.values()];
    g.sx = p.x; g.sy = p.y; g.ox = el?.xPct ?? g.ox; g.oy = el?.yPct ?? g.oy;
  };

  // ── Publish: rasterise stage → JPEG → post as an image status ──────────────
  const gradientLine = (angleDeg: number, W: number, H: number) => {
    const a = (angleDeg * Math.PI) / 180;
    const dx = Math.sin(a), dy = -Math.cos(a);
    const cx = W / 2, cy = H / 2;
    const half = (Math.abs(W * dx) + Math.abs(H * dy)) / 2;
    return { x0: cx - dx * half, y0: cy - dy * half, x1: cx + dx * half, y1: cy + dy * half };
  };
  const loadImg = (src: string) => new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
  const wrapLines = (ctx: CanvasRenderingContext2D, text: string, maxW: number) => {
    const out: string[] = [];
    for (const raw of text.split("\n")) {
      const words = raw.split(" "); let line = "";
      for (const w of words) {
        const test = line ? line + " " + w : w;
        if (ctx.measureText(test).width > maxW && line) { out.push(line); line = w; } else line = test;
      }
      out.push(line);
    }
    return out;
  };

  const publish = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = RASTER_W; canvas.height = RASTER_H;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("no ctx");
      // background
      if (bg.kind === "solid") { ctx.fillStyle = bg.color; }
      else { const l = gradientLine(bg.angle, RASTER_W, RASTER_H); const g = ctx.createLinearGradient(l.x0, l.y0, l.x1, l.y1); g.addColorStop(0, bg.from); g.addColorStop(1, bg.to); ctx.fillStyle = g; }
      ctx.fillRect(0, 0, RASTER_W, RASTER_H);
      const sR = RASTER_W / REF_W;
      for (const el of els) {
        ctx.save();
        ctx.translate((el.xPct / 100) * RASTER_W, (el.yPct / 100) * RASTER_H);
        ctx.rotate((el.rot * Math.PI) / 180);
        if (el.type === "image") {
          const img = await loadImg(el.src);
          const w = (el.wPct / 100) * RASTER_W; const h = w / (el.ar || 1);
          ctx.drawImage(img, -w / 2, -h / 2, w, h);
        } else {
          const fs = el.size * sR;
          ctx.font = `700 ${fs}px ${el.font}`;
          ctx.textAlign = "center"; ctx.textBaseline = "middle";
          const lines = wrapLines(ctx, el.text || " ", RASTER_W * 0.84);
          const lh = fs * 1.24;
          const totalH = lh * lines.length;
          lines.forEach((ln, i) => {
            const y = -totalH / 2 + lh / 2 + i * lh;
            if (el.variant === "bg") {
              const tw = ctx.measureText(ln).width; const padX = fs * 0.34, padY = fs * 0.16;
              ctx.fillStyle = el.color;
              const rx = -tw / 2 - padX, ry = y - fs / 2 - padY, rw = tw + padX * 2, rh = fs + padY * 2, r = fs * 0.22;
              ctx.beginPath();
              ctx.moveTo(rx + r, ry); ctx.arcTo(rx + rw, ry, rx + rw, ry + rh, r); ctx.arcTo(rx + rw, ry + rh, rx, ry + rh, r);
              ctx.arcTo(rx, ry + rh, rx, ry, r); ctx.arcTo(rx, ry, rx + rw, ry, r); ctx.closePath(); ctx.fill();
              ctx.fillStyle = isDark(el.color) ? "#ffffff" : "#111111";
              ctx.fillText(ln, 0, y);
            } else if (el.variant === "border") {
              ctx.lineWidth = Math.max(2, fs * 0.09); ctx.strokeStyle = isDark(el.color) ? "#ffffff" : "#111111";
              ctx.lineJoin = "round"; ctx.strokeText(ln, 0, y);
              ctx.fillStyle = el.color; ctx.fillText(ln, 0, y);
            } else {
              ctx.fillStyle = el.color; ctx.fillText(ln, 0, y);
            }
          });
        }
        ctx.restore();
      }
      const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
      const r = await postStatus({ kind: "image", media: dataUrl });
      setBusy(false);
      if (!r.ok) { toast.error(r.error ?? "Could not publish your story.", { title: "Story" }); return; }
      toast.success("Story published — live to buyers for 24 hours.", { title: "Story live" });
      onPosted(); onClose();
    } catch {
      setBusy(false);
      toast.error("Could not build your story image. Try again.", { title: "Story" });
    }
  };

  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[120] flex flex-col" style={{ background: "var(--sb-mbg)", fontFamily: FONT, animation: "sbPageIn .22s cubic-bezier(.22,1,.36,1) both" }}>
      {/* Full-screen text entry — sits above the keyboard so typing always works */}
      {editing && (() => {
        const el = els.find((e) => e.id === editing.id);
        const font = el?.type === "text" ? el.font : FONTS[0].css;
        const color = el?.type === "text" ? el.color : "#ffffff";
        return (
          <div className="absolute inset-0 z-30 flex flex-col" style={{ background: bgCss(bg) }}>
            <div className="flex items-center justify-between px-4 py-3">
              <button onClick={cancelText} className="rounded-full px-4 py-1.5 text-[14px] font-semibold text-white/90 transition hover:bg-white/10">Cancel</button>
              <button onClick={commitText} className="rounded-full px-6 py-2 text-[14px] font-bold text-white shadow-[0_6px_18px_rgba(0,0,0,.3)] transition active:scale-95" style={{ background: P }}>Done</button>
            </div>
            <div className="flex flex-1 items-start justify-center px-6 pt-[9vh]">
              <textarea ref={taRef} value={draft} onChange={(e) => setDraft(e.target.value.slice(0, 200))} maxLength={200} rows={3}
                placeholder="Type something…" className="w-full resize-none bg-transparent text-center outline-none placeholder:text-white/45"
                style={{ fontFamily: font, color, fontSize: 32, fontWeight: 700, lineHeight: 1.25, textShadow: "0 1px 10px rgba(0,0,0,.22)" }}/>
            </div>
            <div className="flex flex-wrap justify-center gap-2.5 px-4 pb-8 pt-2">
              {TEXT_COLORS.map((c) => (
                <button key={c} onClick={() => patch(editing.id, { color: c })} aria-label="Text colour" className="h-8 w-8 rounded-full transition-transform active:scale-90"
                  style={{ background: c, border: c === "#ffffff" ? "1px solid rgba(0,0,0,.15)" : "none", outline: color === c ? "2px solid #fff" : "none", outlineOffset: 2 }}/>
              ))}
            </div>
          </div>
        );
      })()}
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <button onClick={onClose} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full text-white transition hover:bg-white/10">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
        <h3 className="text-[15px] font-extrabold text-white">Add to your story</h3>
        <button onClick={publish} disabled={busy} className="inline-flex items-center gap-1.5 rounded-[8px] px-5 py-2 text-[13.5px] font-bold text-white transition hover:opacity-90 active:scale-95 disabled:opacity-60" style={{ background: P }}>
          {busy && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="animate-spin"><circle cx="12" cy="12" r="9" stroke="#fff" strokeOpacity=".3" strokeWidth="2.6"/><path d="M21 12a9 9 0 0 0-9-9" stroke="#fff" strokeWidth="2.6" strokeLinecap="round"/></svg>}
          Publish
        </button>
      </div>

      {/* Stage */}
      <div className="flex flex-1 items-center justify-center overflow-hidden px-4 pb-2">
        <div ref={stageRef} onPointerDown={() => { setSel(null); setPanel("none"); }} onPointerMove={onStagePointerMove} onPointerUp={onStagePointerUp} onPointerLeave={onStagePointerUp}
          className="relative overflow-hidden rounded-[22px] shadow-[0_20px_60px_rgba(0,0,0,.5)] touch-none select-none"
          style={{ width: "min(100%, 400px)", aspectRatio: "9 / 16", background: bgCss(bg) }}>
          {els.length === 0 && (
            <div className="pointer-events-none absolute inset-0 grid place-items-center px-8 text-center">
              <div>
                <p className="text-[17px] font-bold text-white/95">Add images or text to start your story</p>
                <p className="mt-1 text-[13px] text-white/70">Use the tools below</p>
              </div>
            </div>
          )}
          {els.map((el) => {
            const selected = el.id === sel;
            const common: React.CSSProperties = {
              position: "absolute", left: `${el.xPct}%`, top: `${el.yPct}%`,
              transform: `translate(-50%, -50%) rotate(${el.rot}deg)`, cursor: "grab", touchAction: "none",
              outline: selected ? `2px dashed ${P}` : "none", outlineOffset: 4,
            };
            if (el.type === "image") {
              return <img key={el.id} src={el.src} alt="" draggable={false} onPointerDown={(e) => onElPointerDown(e, el)}
                style={{ ...common, width: `${el.wPct}%`, borderRadius: 10 }}/>;
            }
            const fs = el.size * scaleP;
            const tStyle: React.CSSProperties = { fontFamily: el.font, fontSize: fs, fontWeight: 700, lineHeight: 1.24, whiteSpace: "pre-wrap", textAlign: "center", maxWidth: stageW * 0.84 };
            if (el.variant === "plain") { tStyle.color = el.color; }
            else if (el.variant === "bg") { tStyle.background = el.color; tStyle.color = isDark(el.color) ? "#fff" : "#111"; tStyle.padding = `${fs * 0.16}px ${fs * 0.34}px`; tStyle.borderRadius = fs * 0.22; }
            else { tStyle.color = el.color; tStyle.WebkitTextStroke = `${Math.max(1, fs * 0.045)}px ${isDark(el.color) ? "#fff" : "#111"}`; }
            return (
              <div key={el.id} onPointerDown={(e) => onElPointerDown(e, el)} onDoubleClick={() => editText(el)} style={common}>
                <span style={tStyle}>{el.text || " "}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Background panel ── */}
      {panel === "bg" && (
        <Sheet title="Background" onClose={() => setPanel("none")}>
          <p className="mb-2 text-[12px] font-semibold sb-muted">Solid colors</p>
          <div className="mb-4 flex flex-wrap gap-2.5">
            {SOLIDS.map((c) => (
              <button key={c} onClick={() => setBg({ kind: "solid", color: c })} aria-label="Background colour" className="h-9 w-9 rounded-full transition-transform active:scale-90"
                style={{ background: c, border: c === "#ffffff" ? "1px solid rgba(0,0,0,.15)" : "none", outline: bg.kind === "solid" && bg.color === c ? `2px solid ${P}` : "none", outlineOffset: 2 }}/>
            ))}
          </div>
          <p className="mb-2 text-[12px] font-semibold sb-muted">Gradients</p>
          <div className="flex flex-wrap gap-2.5">
            {GRADS.map((g, i) => (
              <button key={i} onClick={() => setBg({ kind: "grad", ...g })} aria-label="Gradient" className="h-9 w-9 rounded-[10px] transition-transform active:scale-90"
                style={{ background: `linear-gradient(${g.angle}deg, ${g.from}, ${g.to})`, outline: bg.kind === "grad" && bg.from === g.from && bg.to === g.to ? `2px solid ${P}` : "none", outlineOffset: 2 }}/>
            ))}
          </div>
        </Sheet>
      )}

      {/* ── Sticker (emoji) panel ── */}
      {panel === "emoji" && (
        <Sheet title="Stickers" onClose={() => setPanel("none")}>
          <div className="grid grid-cols-8 gap-1.5">
            {EMOJIS.map((emo) => (
              <button key={emo} onClick={() => addEmoji(emo)} aria-label="Add sticker" className="grid h-10 place-items-center rounded-lg text-[24px] leading-none transition hover:bg-white/10 active:scale-90">{emo}</button>
            ))}
          </div>
        </Sheet>
      )}

      {/* ── Text style panel ── */}
      {panel === "text" && selEl?.type === "text" && (
        <Sheet title="Text style" onClose={() => setPanel("none")}>
          <button onClick={() => editText(selEl)} className="mb-3 flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-left transition hover:opacity-90" style={{ background: "var(--sb-fill)", border: "1px solid var(--sb-mbd)" }}>
            <span className="min-w-0 flex-1 truncate text-[14px] text-white">{selEl.text || "Tap to type your text"}</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={P} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="ml-2 shrink-0"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>
          </button>
          <label className="mb-1 block text-[12px] font-semibold sb-muted">Font</label>
          <select value={selEl.font} onChange={(e) => patch(selEl.id, { font: e.target.value })} className="mb-3 w-full rounded-xl px-3.5 py-2.5 text-[14px] text-white outline-none" style={{ background: "var(--sb-fill)", border: "1px solid var(--sb-mbd)" }}>
            {FONTS.map((f) => <option key={f.label} value={f.css} style={{ background: "var(--sb-mcard)" }}>{f.label}</option>)}
          </select>
          <SliderRow label="Size" value={`${selEl.size}px`}>
            <input type="range" min={14} max={64} value={selEl.size} onChange={(e) => patch(selEl.id, { size: Number(e.target.value) })} className="sb-range w-full"/>
          </SliderRow>
          <SliderRow label="Rotation" value={`${selEl.rot}°`}>
            <input type="range" min={-45} max={45} value={selEl.rot} onChange={(e) => patch(selEl.id, { rot: Number(e.target.value) })} className="sb-range w-full"/>
          </SliderRow>
          <label className="mb-1.5 mt-1 block text-[12px] font-semibold sb-muted">Style</label>
          <div className="mb-3 grid grid-cols-3 gap-1.5 rounded-xl p-1" style={{ background: "var(--sb-fill)" }}>
            {(["plain", "bg", "border"] as const).map((v) => (
              <button key={v} onClick={() => patch(selEl.id, { variant: v })} className="h-9 rounded-lg text-[13px] font-bold capitalize transition" style={selEl.variant === v ? { background: P, color: "#fff" } : { color: "#9ca3af" }}>
                {v === "bg" ? "Background" : v === "border" ? "Border" : "Plain"}
              </button>
            ))}
          </div>
          <label className="mb-1.5 block text-[12px] font-semibold sb-muted">Text color</label>
          <div className="flex flex-wrap gap-2.5">
            {TEXT_COLORS.map((c) => (
              <button key={c} onClick={() => patch(selEl.id, { color: c })} aria-label="Text colour" className="h-8 w-8 rounded-full transition-transform active:scale-90"
                style={{ background: c, border: c === "#ffffff" ? "1px solid rgba(0,0,0,.15)" : "none", outline: selEl.color === c ? `2px solid ${P}` : "none", outlineOffset: 2 }}/>
            ))}
          </div>
        </Sheet>
      )}

      {/* ── Bottom toolbar ── */}
      <div className="flex items-center gap-2 px-3 pb-4 pt-2">
        <ToolBtn active={panel === "bg"} onClick={() => setPanel((p) => (p === "bg" ? "none" : "bg"))} label="Background">
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2 2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
        </ToolBtn>
        <ToolBtn onClick={addImage} label="Add image">
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="9" r="1.6"/><path d="M4 17l5-4 4 3 3-3 4 4"/></svg>
        </ToolBtn>
        <ToolBtn onClick={addText} label="Add text">
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7V5h16v2M9 19h6M12 5v14"/></svg>
        </ToolBtn>
        <ToolBtn active={panel === "emoji"} onClick={() => setPanel((p) => (p === "emoji" ? "none" : "emoji"))} label="Stickers">
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8.5 14.5a4.5 4.5 0 0 0 7 0"/><path d="M9 9.5h.01M15 9.5h.01"/></svg>
        </ToolBtn>

        <span className="mx-0.5 h-7 w-px shrink-0" style={{ background: "var(--sb-mbd)" }}/>

        <ToolBtn disabled={!sel} onClick={() => layer(1)} label="Bring forward">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
        </ToolBtn>
        <ToolBtn disabled={!sel} onClick={() => layer(-1)} label="Send back">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12l7 7 7-7"/></svg>
        </ToolBtn>
        <ToolBtn disabled={!selEl || selEl.type !== "text"} onClick={() => { if (selEl?.type === "text") editText(selEl); }} label="Edit text">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>
        </ToolBtn>
        <ToolBtn disabled={!selEl || selEl.type !== "text"} onClick={() => setPanel("text")} label="Text style">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><circle cx="13.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="12" r="2.5"/><circle cx="8.5" cy="7.5" r="2.5"/><circle cx="6.5" cy="13" r="2.5"/><path d="M12 22a10 10 0 1 1 0-20c4.5 0 8 2.5 8 6 0 2-1.5 3-3 3h-2c-1 0-1.5.7-1.5 1.5S13 17 13 18a2 2 0 0 1-1 4z"/></svg>
        </ToolBtn>
        <ToolBtn disabled={!sel} onClick={removeSel} label="Delete">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg>
        </ToolBtn>
      </div>
      <p className="pb-3 text-center text-[11px] sb-muted">Drag to move · pinch to resize &amp; rotate · double-tap text to edit · stories expire after 24 hours.</p>
    </div>,
    document.body,
  );
}

/* Bottom sheet used by the editor panels. */
function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="mx-3 mb-2 rounded-2xl p-4" style={{ background: "var(--sb-mcard)", border: "1px solid var(--sb-mbd)", animation: "sbPageIn .18s ease both" }}>
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-[15px] font-bold text-white">{title}</h4>
        <button onClick={onClose} aria-label="Close panel" className="grid h-7 w-7 place-items-center rounded-full sb-muted transition hover:bg-white/10">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      </div>
      {children}
    </div>
  );
}
function SliderRow({ label, value, children }: { label: string; value: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <div className="mb-1 flex items-center justify-between text-[12px] font-semibold sb-muted"><span>{label}</span><span className="tabular-nums text-white/80">{value}</span></div>
      {children}
    </div>
  );
}
function ToolBtn({ children, onClick, label, active, disabled }: { children: React.ReactNode; onClick: () => void; label: string; active?: boolean; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} aria-label={label} title={label}
      className="grid h-11 w-11 shrink-0 place-items-center rounded-[12px] transition active:scale-95 disabled:opacity-30"
      style={active ? { background: P, color: "#fff" } : { background: "var(--sb-fill)", color: "var(--sb-nav-active)" }}>
      {children}
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MY STORIES — full-page manager: premium grid of the seller's live stories.
   ═══════════════════════════════════════════════════════════════════════════ */
const timeAgo = (iso: string) => {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

export function MyStoriesPage({ open, onClose, onNew, sellerName, avatarUrl }: { open: boolean; onClose: () => void; onNew: () => void; sellerName: string; avatarUrl?: string | null }) {
  const [items, setItems] = useState<ApiStatus[] | null>(null);
  const [viewAt, setViewAt] = useState<number | null>(null);
  useScrollLock(open);

  const load = useCallback(() => { fetchMyStatus().then((rows) => setItems(rows ?? [])); }, []);
  useEffect(() => { if (open) { setItems(null); load(); } }, [open, load]);

  if (!open || typeof document === "undefined") return null;
  const stories = items ?? [];
  const totalViews = stories.reduce((n, s) => n + (s.viewers?.length ?? 0), 0);

  return createPortal(
    <>
      <div className="fixed inset-0 z-[115] flex flex-col" style={{ background: "var(--sb-mbg)", fontFamily: FONT, animation: "sbPageIn .22s cubic-bezier(.22,1,.36,1) both" }}>
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3.5" style={{ borderBottom: "1px solid var(--sb-mbd)" }}>
          <button onClick={onClose} aria-label="Back" className="grid h-9 w-9 place-items-center rounded-full text-white transition hover:bg-white/[0.06]">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
          <h3 className="flex-1 text-[17px] font-extrabold text-white">My Stories</h3>
          <button onClick={onNew} className="inline-flex items-center gap-1.5 rounded-[8px] px-4 py-2 text-[13px] font-bold text-white transition hover:opacity-90 active:scale-95" style={{ background: P }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
            New
          </button>
        </div>

        {/* Stats strip */}
        {stories.length > 0 && (
          <div className="flex items-center gap-6 px-5 py-3" style={{ borderBottom: "1px solid var(--sb-mbd)" }}>
            <Stat n={stories.length} label={stories.length === 1 ? "Active story" : "Active stories"}/>
            <span className="h-8 w-px" style={{ background: "var(--sb-mbd)" }}/>
            <Stat n={totalViews} label={totalViews === 1 ? "Total view" : "Total views"}/>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4">
          {items === null ? (
            <div className="grid grid-cols-3 gap-3">
              {Array.from({ length: 6 }).map((_, i) => <div key={i} className="rounded-2xl" style={{ aspectRatio: "9 / 16", background: "var(--sb-fill)" }}/>)}
            </div>
          ) : stories.length === 0 ? (
            <div className="grid flex-1 place-items-center py-16 text-center">
              <div className="flex flex-col items-center">
                <button onClick={onNew} className="grid h-24 w-24 place-items-center rounded-full transition active:scale-95" style={{ background: `${P}1a` }}>
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={P} strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
                </button>
                <p className="mt-6 text-[17px] font-extrabold text-white">You haven&apos;t posted any stories yet</p>
                <p className="mt-1.5 text-[13.5px]" style={{ color: "var(--sb-chip-text)" }}>Share a moment that lasts 24 hours.</p>
                <button onClick={onNew} className="mt-6 rounded-[8px] px-6 py-2.5 text-[14px] font-bold text-white transition hover:opacity-90 active:scale-95" style={{ background: P }}>Create your first story</button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {stories.map((s, i) => (
                <button key={s.id} onClick={() => setViewAt(i)} className="group relative overflow-hidden rounded-2xl text-left transition active:scale-[0.98]"
                  style={{ aspectRatio: "9 / 16", background: s.kind === "text" ? (s.bg ?? "#f04e23") : "#000", border: "1px solid var(--sb-mbd)" }}>
                  {s.kind === "image" && s.media_url && <img src={s.media_url} alt="" className="absolute inset-0 h-full w-full object-cover"/>}
                  {s.kind === "video" && s.media_url && <video src={s.media_url} muted playsInline className="absolute inset-0 h-full w-full object-cover"/>}
                  {s.kind === "text" && <span className="absolute inset-0 grid place-items-center px-2 text-center text-[12px] font-bold leading-snug text-white">{(s.caption ?? "").slice(0, 60)}</span>}
                  {s.kind === "video" && (
                    <span className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-black/45 text-white">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                    </span>
                  )}
                  <span className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-black/75 to-transparent px-2 pb-1.5 pt-6 text-[10.5px] font-semibold text-white">
                    <span className="truncate">{timeAgo(s.created_at)}</span>
                    <span className="inline-flex items-center gap-0.5 shrink-0">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>
                      {s.viewers?.length ?? 0}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      {viewAt !== null && stories.length > 0 && (
        <StatusViewer items={stories} startIndex={viewAt} sellerName={sellerName || "You"} avatarUrl={avatarUrl} isOwner
          onClose={() => setViewAt(null)} onDeleted={load}/>
      )}
    </>,
    document.body,
  );
}
function Stat({ n, label }: { n: number; label: string }) {
  return <div><p className="text-[20px] font-extrabold text-white tabular-nums leading-none">{n}</p><p className="mt-1 text-[12px]" style={{ color: "var(--sb-chip-text)" }}>{label}</p></div>;
}

/* ─── Full-screen story viewer — progress bars (video-synced), reactions. ── */
export function StatusViewer({ items, sellerName, avatarUrl, isOwner, startIndex, onClose, onDeleted }: {
  items: ApiStatus[]; sellerName: string; avatarUrl?: string | null; isOwner?: boolean; startIndex?: number; onClose: () => void; onDeleted?: () => void;
}) {
  const [idx, setIdx] = useState(startIndex ?? 0);
  const [paused, setPaused] = useState(false);
  const [vidProg, setVidProg] = useState(0);          // 0..1 real video progress
  const [reacted, setReacted] = useState<Record<number, string>>({});
  useScrollLock(true);
  const cur = items[idx];

  const next = () => setIdx((i) => { if (i + 1 >= items.length) { onClose(); return i; } return i + 1; });
  const prev = () => setIdx((i) => Math.max(0, i - 1));

  useEffect(() => { setVidProg(0); }, [idx]);
  // Mark the status as seen (buyers only) so the seller gets a "viewed" count.
  useEffect(() => { if (cur && !isOwner) viewStatus(cur.id); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [idx]);
  // Auto-advance for image/text; videos advance on their own `ended`.
  useEffect(() => {
    if (!cur || paused || cur.kind === "video") return;
    const t = setTimeout(next, STORY_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, paused, cur]);

  const react = async (emoji: string) => {
    if (!cur) return;
    setReacted((r) => ({ ...r, [cur.id]: emoji }));
    const ok = await reactStatus(cur.id, emoji);
    if (!ok) toast.error("Could not send reaction.");
  };
  const remove = async () => {
    if (!cur) return;
    if (!(await deleteStatus(cur.id))) { toast.error("Could not delete status."); return; }
    toast.success("Status deleted.");
    onDeleted?.();
    if (items.length <= 1) onClose(); else setIdx((i) => Math.min(i, items.length - 2));
  };

  if (!cur || typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[130] flex flex-col" style={{ background: "#000", fontFamily: FONT, animation: "sbPageIn .2s ease both" }}>
      {/* progress bars */}
      <div className="flex gap-1 px-3 pt-3">
        {items.map((_, i) => {
          const isVideo = items[i].kind === "video";
          const fill = i < idx ? "100%" : i === idx ? (isVideo ? `${vidProg * 100}%` : undefined) : "0%";
          return (
            <div key={i} className="h-[3px] flex-1 overflow-hidden rounded-full" style={{ background: "rgba(255,255,255,0.3)" }}>
              <div style={{ height: "100%", background: "#fff", width: fill,
                animation: i === idx && !isVideo ? `sbStoryBar ${STORY_MS}ms linear forwards` : undefined,
                animationPlayState: paused ? "paused" : "running",
                transition: isVideo ? "width .1s linear" : undefined }}/>
            </div>
          );
        })}
      </div>
      {/* header */}
      <div className="relative z-10 flex items-center gap-2.5 px-4 py-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-white/10">
          {avatarUrl ? <img src={avatarUrl} alt="" className="h-full w-full object-cover"/> : <span className="text-[13px] font-bold text-white">{sellerName.slice(0, 1).toUpperCase()}</span>}
        </span>
        <span className="flex-1 truncate text-[14px] font-bold text-white">{sellerName}</span>
        {isOwner && (
          <button onClick={remove} aria-label="Delete status" className="grid h-8 w-8 place-items-center rounded-full text-white/90 transition hover:bg-white/10">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/></svg>
          </button>
        )}
        <button onClick={onClose} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-full text-white/90 transition hover:bg-white/10">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      </div>
      {/* content */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden">
        {cur.kind === "text" ? (
          <div className="grid h-full w-full place-items-center px-8 text-center" style={{ background: cur.bg ?? "#f04e23" }}>
            <p className="text-[26px] font-bold leading-snug" style={{ color: "#fff", textWrap: "balance" as never }}>{cur.caption}</p>
          </div>
        ) : cur.kind === "video" ? (
          <video key={cur.id} src={cur.media_url ?? ""} className="max-h-full max-w-full" autoPlay playsInline
            onEnded={next} onTimeUpdate={(e) => { const v = e.currentTarget; if (v.duration) setVidProg(v.currentTime / v.duration); }}/>
        ) : (
          <img src={cur.media_url ?? ""} alt="" className="max-h-full max-w-full object-contain"/>
        )}
        {/* tap zones (below the reaction bar) */}
        <button aria-label="Previous" className="absolute inset-y-0 left-0 w-1/3" onClick={prev} onPointerDown={() => setPaused(true)} onPointerUp={() => setPaused(false)}/>
        <button aria-label="Next" className="absolute bottom-20 right-0 top-0 w-2/3" onClick={next} onPointerDown={() => setPaused(true)} onPointerUp={() => setPaused(false)}/>
        {cur.kind !== "text" && cur.caption && (
          <p className="pointer-events-none absolute inset-x-0 bottom-16 bg-gradient-to-t from-black/70 to-transparent px-5 pb-8 pt-10 text-center text-[15px] font-semibold text-white">{cur.caption}</p>
        )}
      </div>

      {/* footer: reactions (viewers) or reaction summary (owner) */}
      <div className="relative z-10 px-4 pb-6 pt-2">
        {isOwner ? (
          <OwnerReactions reactions={cur.reactions ?? []} viewers={cur.viewers ?? []}/>
        ) : (
          <div className="flex items-center justify-center gap-1.5">
            {REACTIONS.map((e) => (
              <button key={e} onClick={() => react(e)} className="grid h-11 w-11 place-items-center rounded-full text-[22px] transition-transform hover:scale-125 active:scale-95"
                style={reacted[cur.id] === e ? { background: "rgba(255,255,255,0.16)", transform: "scale(1.15)" } : undefined}>
                {e}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

/* Seller-only summary — who viewed and who reacted to the current status. */
function OwnerReactions({ reactions, viewers }: { reactions: { emoji: string; name: string }[]; viewers: string[] }) {
  const counts = new Map<string, number>();
  for (const r of reactions) counts.set(r.emoji, (counts.get(r.emoji) ?? 0) + 1);
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex items-center gap-1.5 text-[13px] font-semibold text-white/70">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>
        {viewers.length === 0 ? "No views yet" : `Seen by ${viewers.length}`}
      </div>
      {counts.size > 0 && (
        <div className="flex items-center gap-2">
          {[...counts.entries()].map(([emoji, n]) => (
            <span key={emoji} className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-[15px] font-bold text-white">{emoji}<span className="text-[13px]">{n}</span></span>
          ))}
        </div>
      )}
      {viewers.length > 0 && <p className="max-w-full truncate text-[12px] text-white/60">{viewers.join(" · ")}</p>}
    </div>
  );
}
