"use client";

import { useState, useEffect, useCallback } from "react";
import { P, MBG, MCARD, MBD, FONT, DesktopTopNav, AppMobileHeader, useProfile } from "../shared";
import type { Page } from "../shared";
import { fetchAdminOverview, adminRemoveAd, adminResolveOrder, type AdminOverview } from "../lib/api";
import { toast } from "../toast";

const money = (n: number) => `$${n.toFixed(2)}`;
const fmtDate = (iso?: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso); if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};
const STATUS_TINT: Record<string, { c: string; b: string }> = {
  completed: { c: "#16a34a", b: "rgba(34,197,94,0.13)" },
  pending:   { c: "#d97706", b: "rgba(217,119,6,0.14)" },
  processing:{ c: "#d97706", b: "rgba(217,119,6,0.14)" },
  cancelled: { c: "#e02d2d", b: "rgba(224,45,45,0.13)" },
  active:    { c: "#16a34a", b: "rgba(34,197,94,0.13)" },
  removed:   { c: "#e02d2d", b: "rgba(224,45,45,0.13)" },
};
function Pill({ status }: { status: string }) {
  const t = STATUS_TINT[status.toLowerCase()] ?? { c: "var(--sb-chip-text)", b: "var(--sb-chip)" };
  return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11.5px] font-semibold capitalize" style={{ background: t.b, color: t.c }}><span className="w-1.5 h-1.5 rounded-full" style={{ background: t.c }}/>{status}</span>;
}
function StatCard({ label, value, sub, tint }: { label: string; value: string; sub?: string; tint: string }) {
  return (
    <div className="rounded-2xl px-4 py-4" style={{ background: MCARD, border: `1px solid ${MBD}` }}>
      <div className="flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full" style={{ background: tint }}/>
        <p className="text-[12.5px]" style={{ color: "var(--sb-chip-text)" }}>{label}</p>
      </div>
      <p className="text-[24px] font-extrabold text-white mt-1.5 tabular-nums leading-none">{value}</p>
      {sub && <p className="text-[11.5px] mt-1.5" style={{ color: "var(--sb-chip-text)" }}>{sub}</p>}
    </div>
  );
}

export function AdminPage({ setPage }: { setPage: (p: Page) => void }) {
  const profile = useProfile();
  const isAdmin = Boolean(profile.is_admin);
  const [data, setData] = useState<AdminOverview | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState<"orders" | "ads" | "users">("orders");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    fetchAdminOverview().then((r) => { setData(r); setLoaded(true); }).catch(() => setLoaded(true));
  }, []);
  useEffect(() => { if (isAdmin) load(); else setLoaded(true); }, [isAdmin, load]);

  const removeAd = async (id: number) => {
    setBusy(`ad-${id}`);
    const r = await adminRemoveAd(id);
    setBusy(null);
    if (!r.ok) { toast.error(r.error ?? "Could not remove listing.", { title: "Admin" }); return; }
    toast.success("Listing removed.", { title: "Admin" });
    load();
  };
  const resolveOrder = async (id: string) => {
    setBusy(`ord-${id}`);
    const r = await adminResolveOrder(id);
    setBusy(null);
    if (!r.ok) { toast.error(r.error ?? "Could not refund order.", { title: "Admin" }); return; }
    toast.success("Order refunded to the buyer.", { title: "Admin" });
    load();
  };

  // Not an admin → clear denial screen (server also enforces this on every call).
  if (loaded && !isAdmin) {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: MBG, fontFamily: FONT }}>
        <DesktopTopNav setPage={setPage} active="marketplace"/>
        <AppMobileHeader className="md:hidden" setPage={setPage}/>
        <div className="flex-1 grid place-items-center px-6 text-center">
          <div className="flex flex-col items-center">
            <span className="grid h-14 w-14 place-items-center rounded-full mb-4" style={{ background: "var(--sb-card)" }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--sb-chip-text)" strokeWidth="1.7"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>
            </span>
            <p className="text-white font-bold text-[16px]">Admin access required</p>
            <p className="text-[13px] mt-1 max-w-[300px]" style={{ color: "var(--sb-chip-text)" }}>This area is restricted to platform administrators.</p>
            <button onClick={() => setPage("marketplace")} className="mt-5 px-6 py-2.5 rounded-full text-[13px] font-bold text-white" style={{ background: P }}>Back to marketplace</button>
          </div>
        </div>
      </div>
    );
  }

  const s = data?.stats;
  const tabs: { key: typeof tab; label: string; n: number }[] = [
    { key: "orders", label: "Orders", n: data?.orders.length ?? 0 },
    { key: "ads", label: "Listings", n: data?.ads.length ?? 0 },
    { key: "users", label: "Users", n: data?.users.length ?? 0 },
  ];

  return (
    <div className="min-h-screen flex flex-col" style={{ background: MBG, fontFamily: FONT }}>
      <DesktopTopNav setPage={setPage} active="marketplace"/>
      <AppMobileHeader className="md:hidden" setPage={setPage}/>

      <div className="w-full max-w-[1280px] mx-auto px-5 md:px-8 pt-7 md:pt-10 pb-16 flex-1">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl" style={{ background: "rgba(240,78,35,0.12)" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={P} strokeWidth="1.9"><path d="M12 22s8-3.6 8-10V5.4L12 2 4 5.4V12c0 6.4 8 10 8 10Z"/><path d="m9 11.7 2.1 2.1L15.3 9.5"/></svg>
          </span>
          <div>
            <h1 className="text-white" style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em" }}>Admin</h1>
            <p className="text-[13px]" style={{ color: "var(--sb-chip-text)" }}>Platform overview, moderation and dispute resolution</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
          <StatCard label="GMV (completed)" value={s ? money(s.gmv) : "—"} sub={s ? `${money(s.fees)} platform fees` : ""} tint="#22c55e"/>
          <StatCard label="Orders" value={s ? String(s.orders) : "—"} sub={s ? `${s.pending} in escrow · ${s.cancelled} refunded` : ""} tint="#f04e23"/>
          <StatCard label="Users" value={s ? String(s.users) : "—"} sub={s ? `${s.sellers} sellers` : ""} tint="#3b82f6"/>
          <StatCard label="Listings" value={s ? String(s.ads) : "—"} sub={s ? `${s.activeAds} active` : ""} tint="#a855f7"/>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 mt-7 border-b" style={{ borderColor: MBD }}>
          {tabs.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)} className="relative pb-3 px-1 text-[14px] font-bold transition-colors"
              style={{ color: tab === t.key ? P : "var(--sb-chip-text)" }}>
              {t.label} <span className="text-[12px] opacity-70">({t.n})</span>
              {tab === t.key && <span className="absolute inset-x-0 bottom-0 h-[2.5px] rounded-full" style={{ background: P }}/>}
            </button>
          ))}
        </div>

        {!loaded ? (
          <div className="space-y-2 mt-5">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-14 rounded-xl" style={{ background: "var(--sb-fill)" }}/>)}</div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            {tab === "orders" && (
              <table className="w-full text-left" style={{ minWidth: 720 }}>
                <thead><tr className="text-[12px]" style={{ color: "var(--sb-chip-text)" }}>
                  <th className="py-2.5 pr-3 font-semibold">Order</th><th className="py-2.5 pr-3 font-semibold">Buyer</th><th className="py-2.5 pr-3 font-semibold">Seller</th><th className="py-2.5 pr-3 font-semibold">Price</th><th className="py-2.5 pr-3 font-semibold">Status</th><th className="py-2.5 pr-3 font-semibold">Date</th><th className="py-2.5 font-semibold text-right">Action</th>
                </tr></thead>
                <tbody>
                  {(data?.orders ?? []).map((o) => (
                    <tr key={o.id} className="text-[13px] text-white" style={{ borderTop: `1px solid ${MBD}` }}>
                      <td className="py-3 pr-3 max-w-[200px] truncate font-semibold">{o.title}</td>
                      <td className="py-3 pr-3" style={{ color: "var(--sb-chip-text)" }}>{o.buyer ?? "—"}</td>
                      <td className="py-3 pr-3" style={{ color: "var(--sb-chip-text)" }}>{o.seller ?? "—"}</td>
                      <td className="py-3 pr-3 tabular-nums font-bold">{money(Number(o.price) || 0)}</td>
                      <td className="py-3 pr-3"><Pill status={o.status}/></td>
                      <td className="py-3 pr-3 whitespace-nowrap" style={{ color: "var(--sb-chip-text)" }}>{fmtDate(o.created_at)}</td>
                      <td className="py-3 text-right">
                        {["pending", "processing"].includes(o.status.toLowerCase())
                          ? <button onClick={() => resolveOrder(o.id)} disabled={busy === `ord-${o.id}`} className="px-3 py-1.5 rounded-full text-[12px] font-bold transition disabled:opacity-50" style={{ background: "transparent", color: "#e02d2d", border: "1.5px solid #e02d2d" }}>{busy === `ord-${o.id}` ? "…" : "Refund"}</button>
                          : <span className="text-[12px]" style={{ color: "var(--sb-chip-text)" }}>—</span>}
                      </td>
                    </tr>
                  ))}
                  {(data?.orders ?? []).length === 0 && <tr><td colSpan={7} className="py-8 text-center text-[13px]" style={{ color: "var(--sb-chip-text)" }}>No orders yet.</td></tr>}
                </tbody>
              </table>
            )}
            {tab === "ads" && (
              <table className="w-full text-left" style={{ minWidth: 640 }}>
                <thead><tr className="text-[12px]" style={{ color: "var(--sb-chip-text)" }}>
                  <th className="py-2.5 pr-3 font-semibold">Listing</th><th className="py-2.5 pr-3 font-semibold">Seller</th><th className="py-2.5 pr-3 font-semibold">Price</th><th className="py-2.5 pr-3 font-semibold">Stock</th><th className="py-2.5 pr-3 font-semibold">Status</th><th className="py-2.5 font-semibold text-right">Action</th>
                </tr></thead>
                <tbody>
                  {(data?.ads ?? []).map((a) => (
                    <tr key={a.id} className="text-[13px] text-white" style={{ borderTop: `1px solid ${MBD}` }}>
                      <td className="py-3 pr-3 max-w-[220px] truncate font-semibold">{a.title}</td>
                      <td className="py-3 pr-3 max-w-[160px] truncate" style={{ color: "var(--sb-chip-text)" }}>{a.owner_email ?? "—"}</td>
                      <td className="py-3 pr-3 tabular-nums font-bold">{money(Number(a.price) || 0)}</td>
                      <td className="py-3 pr-3 tabular-nums" style={{ color: "var(--sb-chip-text)" }}>{a.quantity}</td>
                      <td className="py-3 pr-3"><Pill status={a.status}/></td>
                      <td className="py-3 text-right">
                        {a.status !== "removed"
                          ? <button onClick={() => removeAd(a.id)} disabled={busy === `ad-${a.id}`} className="px-3 py-1.5 rounded-full text-[12px] font-bold transition disabled:opacity-50" style={{ background: "transparent", color: "#e02d2d", border: "1.5px solid #e02d2d" }}>{busy === `ad-${a.id}` ? "…" : "Remove"}</button>
                          : <span className="text-[12px]" style={{ color: "var(--sb-chip-text)" }}>Removed</span>}
                      </td>
                    </tr>
                  ))}
                  {(data?.ads ?? []).length === 0 && <tr><td colSpan={6} className="py-8 text-center text-[13px]" style={{ color: "var(--sb-chip-text)" }}>No listings yet.</td></tr>}
                </tbody>
              </table>
            )}
            {tab === "users" && (
              <table className="w-full text-left" style={{ minWidth: 560 }}>
                <thead><tr className="text-[12px]" style={{ color: "var(--sb-chip-text)" }}>
                  <th className="py-2.5 pr-3 font-semibold">Name</th><th className="py-2.5 pr-3 font-semibold">Email</th><th className="py-2.5 pr-3 font-semibold">Role</th><th className="py-2.5 pr-3 font-semibold">Country</th><th className="py-2.5 font-semibold">Joined</th>
                </tr></thead>
                <tbody>
                  {(data?.users ?? []).map((u) => (
                    <tr key={u.email} className="text-[13px] text-white" style={{ borderTop: `1px solid ${MBD}` }}>
                      <td className="py-3 pr-3 font-semibold">{u.full_name}</td>
                      <td className="py-3 pr-3 max-w-[200px] truncate" style={{ color: "var(--sb-chip-text)" }}>{u.email}</td>
                      <td className="py-3 pr-3">{u.is_seller ? <Pill status="active"/> : <span className="text-[12px]" style={{ color: "var(--sb-chip-text)" }}>Buyer</span>}</td>
                      <td className="py-3 pr-3" style={{ color: "var(--sb-chip-text)" }}>{u.country ?? "—"}</td>
                      <td className="py-3 whitespace-nowrap" style={{ color: "var(--sb-chip-text)" }}>{fmtDate(u.joined)}</td>
                    </tr>
                  ))}
                  {(data?.users ?? []).length === 0 && <tr><td colSpan={5} className="py-8 text-center text-[13px]" style={{ color: "var(--sb-chip-text)" }}>No users yet.</td></tr>}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
