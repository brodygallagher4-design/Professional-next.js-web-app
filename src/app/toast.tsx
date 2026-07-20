"use client";

// Premium toast notifications — top-left, stacked, theme-aware, with a spring
// entrance, an exit animation, a countdown progress bar and hover-to-pause.
// A module-level emitter lets any component (or api helper) fire a toast via
// `toast.success(...)` without prop-drilling or a context wrapper.

import { useState, useEffect, useRef } from "react";
import { P, FONT } from "./shared";

export type ToastKind = "success" | "error" | "info" | "warning";
export interface ToastItem {
  id: number;
  kind: ToastKind;
  title?: string;
  message: string;
  duration: number;
  leaving?: boolean;
}
export interface ToastOptions { title?: string; duration?: number }

type Listener = (toasts: ToastItem[]) => void;
let _toasts: ToastItem[] = [];
const _listeners = new Set<Listener>();
let _seq = 0;
const MAX_VISIBLE = 4;
const EXIT_MS = 260;

const emit = () => { for (const l of _listeners) l(_toasts); };

function push(kind: ToastKind, message: string, opts?: ToastOptions): number {
  const id = ++_seq;
  const duration = opts?.duration ?? 4200;
  _toasts = [{ id, kind, title: opts?.title, message: String(message), duration }, ..._toasts].slice(0, MAX_VISIBLE);
  emit();
  return id;
}

export function dismissToast(id: number): void {
  // Mark leaving so the card can play its exit animation, then remove it.
  if (!_toasts.some((t) => t.id === id && !t.leaving)) return;
  _toasts = _toasts.map((t) => (t.id === id ? { ...t, leaving: true } : t));
  emit();
  setTimeout(() => { _toasts = _toasts.filter((t) => t.id !== id); emit(); }, EXIT_MS);
}

export const toast = {
  success: (message: string, opts?: ToastOptions) => push("success", message, opts),
  error: (message: string, opts?: ToastOptions) => push("error", message, opts),
  info: (message: string, opts?: ToastOptions) => push("info", message, opts),
  warning: (message: string, opts?: ToastOptions) => push("warning", message, opts),
};

const KIND_META: Record<ToastKind, { accent: string; tint: string; icon: React.ReactNode }> = {
  success: {
    accent: "#16a34a", tint: "rgba(22,163,74,0.14)",
    icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>,
  },
  error: {
    accent: "#ef4444", tint: "rgba(239,68,68,0.14)",
    icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>,
  },
  info: {
    accent: P, tint: "rgba(240,78,35,0.14)",
    icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={P} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>,
  },
  warning: {
    accent: "#f59e0b", tint: "rgba(245,158,11,0.14)",
    icon: <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.3 3.3 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.3a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/></svg>,
  },
};

function ToastCard({ item }: { item: ToastItem }) {
  const meta = KIND_META[item.kind];
  const [paused, setPaused] = useState(false);
  const remaining = useRef(item.duration);
  const startedAt = useRef(Date.now());

  // Auto-dismiss with hover-to-pause: the remaining time is preserved across
  // pauses so hovering never loses the user's place.
  useEffect(() => {
    if (item.leaving || paused || item.duration <= 0) return;
    startedAt.current = Date.now();
    const timer = setTimeout(() => dismissToast(item.id), remaining.current);
    return () => {
      clearTimeout(timer);
      remaining.current = Math.max(0, remaining.current - (Date.now() - startedAt.current));
    };
  }, [paused, item.leaving, item.id, item.duration]);

  return (
    <div
      role="status"
      aria-live="polite"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className="pointer-events-auto relative w-[380px] max-w-[calc(100vw-24px)] overflow-hidden rounded-2xl"
      style={{
        background: "var(--sb-mcard)",
        border: "1px solid var(--sb-mbd)",
        boxShadow: "var(--sb-lshadow-lg)",
        fontFamily: FONT,
        animation: `${item.leaving ? "sbToastOut" : "sbToastIn"} ${item.leaving ? EXIT_MS : 320}ms cubic-bezier(.22,1,.36,1) both`,
      }}
    >
      <div className="flex items-center gap-3 py-3.5 pl-4 pr-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl" style={{ background: meta.tint }}>
          {meta.icon}
        </span>
        <div className="min-w-0 flex-1">
          {item.title && <p className="text-[14px] font-bold leading-tight tracking-[-0.01em]" style={{ color: "var(--sb-nav-active)" }}>{item.title}</p>}
          <p className={`text-[13px] leading-snug ${item.title ? "mt-0.5" : ""}`} style={{ color: item.title ? "var(--sb-chip-text)" : "var(--sb-nav-active)", fontWeight: item.title ? 400 : 600 }}>{item.message}</p>
        </div>
        <button onClick={() => dismissToast(item.id)} aria-label="Dismiss" className="shrink-0 grid h-7 w-7 place-items-center rounded-full opacity-50 transition-all hover:opacity-100 hover:bg-white/5 active:scale-90" style={{ color: "var(--sb-chip-text)" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </button>
      </div>
      {/* Slim countdown progress bar (pauses with the timer) */}
      {item.duration > 0 && !item.leaving && (
        <span
          className="absolute bottom-0 left-0 h-[2.5px] w-full origin-left rounded-full"
          style={{ background: meta.accent, opacity: 0.9, animation: `sbToastBar ${item.duration}ms linear forwards`, animationPlayState: paused ? "paused" : "running" }}
        />
      )}
    </div>
  );
}

// Rendered once near the app root. Sits top-center, above all page content —
// the position professional platforms use for global notifications.
export function ToastHost() {
  const [items, setItems] = useState<ToastItem[]>(_toasts);
  useEffect(() => {
    const listener: Listener = (next) => setItems([...next]);
    _listeners.add(listener);
    setItems([..._toasts]);
    return () => { _listeners.delete(listener); };
  }, []);
  return (
    <div className="pointer-events-none fixed left-1/2 top-4 z-[200] flex -translate-x-1/2 flex-col items-center gap-2.5 sm:top-5">
      {items.map((item) => <ToastCard key={item.id} item={item} />)}
    </div>
  );
}
