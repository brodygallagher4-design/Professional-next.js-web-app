"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  ArrowDown01Icon, Calendar03Icon, LockIcon, Notification01Icon, UserIcon, ViewIcon, ViewOffIcon,
} from "hugeicons-react";

/* fi-rr-picture — image frame with a sun and mountain. */
function PictureIcon({ size = 17 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="3.2"/>
      <circle cx="8.5" cy="8.5" r="1.7"/>
      <path d="M21 15.5 16 10.5 5 21"/>
    </svg>
  );
}
import { DesktopTopNav, FONT, P, AppMobileHeader, useProfile, refreshProfile, ProfileAvatar, Spinner, useScrollLock } from "../shared";
import { updateProfile, uploadAvatar, fetchStates, fetchCities, type ApiState } from "../lib/api";
import { COUNTRIES, countryByIso } from "../lib/countries";
import { toast } from "../toast";
import type { Page } from "../shared";

type SettingsTab = "profile" | "security" | "notifications";

// Theme-aware input — readable in both light and dark mode.
function Field({ label, hint, value, onChange, type = "text", placeholder, disabled = false }:
  { label?: string; hint?: string; value?: string; onChange?: (v: string) => void; type?: string; placeholder: string; disabled?: boolean }) {
  const [show, setShow] = useState(false);
  const isPassword = type === "password";
  return (
    <label className="block">
      {label && <span className="mb-1.5 block text-[14px] font-semibold" style={{ color: "var(--sb-nav-active)" }}>{label}{label.includes("Password") && <span style={{ color: P }}> *</span>}</span>}
      <div className="relative">
        <input disabled={disabled} value={value} onChange={(e) => onChange?.(e.target.value)}
          type={isPassword && !show ? "password" : "text"} placeholder={placeholder}
          className="h-12 w-full rounded-xl px-4 text-[14px] outline-none transition placeholder:text-[#90a0b5]"
          style={{ background: disabled ? "var(--sb-chip)" : "var(--sb-fill)", border: "1px solid var(--sb-mbd)", color: "var(--sb-nav-active)", opacity: disabled ? 0.65 : 1, cursor: disabled ? "not-allowed" : "text", fontFamily: FONT }}
          onFocus={(e) => { if (!disabled) e.currentTarget.style.borderColor = P; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = "var(--sb-mbd)"; }}/>
        {isPassword && <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? "Hide password" : "Show password"} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "var(--sb-chip-text)" }}>
          {show ? <ViewOffIcon size={19} /> : <ViewIcon size={19} />}
        </button>}
      </div>
      {hint && <span className="mt-1 block text-[11px]" style={{ color: "var(--sb-chip-text)" }}>{hint}</span>}
    </label>
  );
}

function SelectField({ value, onChange, placeholder, options }:
  { value: string; onChange: (v: string) => void; placeholder: string; options: { value: string; label: string }[] }) {
  return (
    <div className="relative">
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full appearance-none rounded-lg px-3 pr-9 text-[14px] font-medium outline-none transition"
        style={{ background: "var(--sb-fill)", border: "1px solid var(--sb-mbd)", color: value ? "var(--sb-nav-active)" : "var(--sb-chip-text)", fontFamily: FONT }}>
        <option value="">{placeholder}</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ArrowDown01Icon size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "var(--sb-chip-text)" }}/>
    </div>
  );
}

/* ── Premium date-of-birth picker ─────────────────────────────────────────── */
const DOB_MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DOB_WD = ["Su","Mo","Tu","We","Th","Fr","Sa"];
const pad2 = (n: number) => String(n).padStart(2, "0");
function parseDob(s: string): { d: number; m: number; y: number } | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec((s ?? "").trim());
  if (!m) return null;
  const d = +m[1], mo = +m[2] - 1, y = +m[3];
  if (mo < 0 || mo > 11 || d < 1 || d > 31 || y < 1900) return null;
  return { d, m: mo, y };
}
function Chevron({ dir }: { dir: "l" | "r" }) {
  return <svg width="9" height="13" viewBox="0 0 9 13" fill="none" style={{ transform: dir === "r" ? "rotate(180deg)" : undefined }}><path d="M7 1.5 2 6.5l5 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}
function DobField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  useScrollLock(open); // lock the page behind the centered calendar modal
  const parsed = parseDob(value);
  const thisYear = new Date().getFullYear();
  const [viewM, setViewM] = useState(parsed?.m ?? 0);
  const [viewY, setViewY] = useState(parsed?.y ?? 2000);
  useEffect(() => {
    const p = parseDob(value);
    if (p) { setViewM(p.m); setViewY(p.y); }
  }, [value]);

  const years: number[] = [];
  for (let y = thisYear; y >= 1940; y -= 1) years.push(y);
  const firstDay = new Date(viewY, viewM, 1).getDay();
  const daysInMonth = new Date(viewY, viewM + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  const pick = (day: number) => { onChange(`${pad2(day)}/${pad2(viewM + 1)}/${viewY}`); setOpen(false); };
  const prevM = () => { if (viewM === 0) { setViewM(11); setViewY((y) => y - 1); } else setViewM((m) => m - 1); };
  const nextM = () => { if (viewM === 11) { setViewM(0); setViewY((y) => y + 1); } else setViewM((m) => m + 1); };
  const selHex = "#f04e23";

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)}
        className="flex h-11 w-full items-center justify-between rounded-lg px-3 text-[14px] font-medium outline-none transition"
        style={{ background: "var(--sb-fill)", border: `1px solid ${open ? P : "var(--sb-mbd)"}`, color: value ? "var(--sb-nav-active)" : "#90a0b5", fontFamily: FONT }}>
        <span>{value || "Date of birth (DD/MM/YYYY)"}</span>
        <Calendar03Icon size={16} style={{ color: open ? P : "var(--sb-chip-text)" }}/>
      </button>
      {open && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-5" style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(2px)" }} onClick={() => setOpen(false)}>
          <div className="w-[320px] max-w-full rounded-2xl p-4 shadow-[0_24px_60px_rgba(0,0,0,.45)]"
            style={{ background: "var(--sb-mcard)", border: "1px solid var(--sb-mbd)", animation: "sbPopIn .25s cubic-bezier(.2,.9,.3,1.1) both", fontFamily: FONT }} onClick={(e) => e.stopPropagation()}>
            {/* Title */}
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[14px] font-bold" style={{ color: "var(--sb-nav-active)" }}>Date of birth</span>
              <button type="button" aria-label="Close" onClick={() => setOpen(false)} className="grid h-7 w-7 place-items-center rounded-full transition hover:bg-white/[0.06]" style={{ color: "var(--sb-chip-text)" }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
            </div>
            {/* Month / year header */}
            <div className="mb-3 flex items-center gap-1.5">
              <button type="button" onClick={prevM} aria-label="Previous month" className="grid h-8 w-8 shrink-0 place-items-center rounded-full transition hover:bg-white/[0.06]" style={{ color: "var(--sb-nav-active)" }}><Chevron dir="l"/></button>
              <select value={viewM} onChange={(e) => setViewM(+e.target.value)} className="h-9 min-w-0 flex-1 appearance-none rounded-lg px-2 text-center text-[13px] font-bold outline-none cursor-pointer" style={{ background: "var(--sb-fill)", border: "1px solid var(--sb-mbd)", color: "var(--sb-nav-active)", fontFamily: FONT }}>
                {DOB_MONTHS.map((m, i) => <option key={m} value={i} style={{ background: "var(--sb-mcard)", color: "var(--sb-nav-active)" }}>{m}</option>)}
              </select>
              <select value={viewY} onChange={(e) => setViewY(+e.target.value)} className="h-9 w-[74px] shrink-0 appearance-none rounded-lg px-1 text-center text-[13px] font-bold outline-none cursor-pointer" style={{ background: "var(--sb-fill)", border: "1px solid var(--sb-mbd)", color: "var(--sb-nav-active)", fontFamily: FONT }}>
                {years.map((y) => <option key={y} value={y} style={{ background: "var(--sb-mcard)", color: "var(--sb-nav-active)" }}>{y}</option>)}
              </select>
              <button type="button" onClick={nextM} aria-label="Next month" className="grid h-8 w-8 shrink-0 place-items-center rounded-full transition hover:bg-white/[0.06]" style={{ color: "var(--sb-nav-active)" }}><Chevron dir="r"/></button>
            </div>
            {/* Weekday labels */}
            <div className="mb-1 grid grid-cols-7">{DOB_WD.map((w) => <span key={w} className="flex aspect-square items-center justify-center text-[11px] font-bold" style={{ color: "var(--sb-chip-text)" }}>{w}</span>)}</div>
            {/* Day grid */}
            <div className="grid grid-cols-7 gap-y-0.5">
              {cells.map((d, i) => {
                if (d === null) return <span key={i} className="aspect-square"/>;
                const isSel = !!parsed && parsed.d === d && parsed.m === viewM && parsed.y === viewY;
                return (
                  <button type="button" key={i} onClick={() => pick(d)}
                    className="mx-auto flex aspect-square w-[34px] items-center justify-center rounded-full text-[13px] font-semibold transition"
                    style={isSel ? { background: selHex, color: "#fff" } : { color: "var(--sb-nav-active)" }}
                    onMouseEnter={(e) => { if (!isSel) e.currentTarget.style.background = "var(--sb-chip)"; }}
                    onMouseLeave={(e) => { if (!isSel) e.currentTarget.style.background = "transparent"; }}>
                    {d}
                  </button>
                );
              })}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

function SectionIntro({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="pt-1"><h2 className="text-[15px] font-bold" style={{ color: "var(--sb-nav-active)" }}>{title}</h2><p className="mt-1 max-w-[240px] text-[13px] leading-5" style={{ color: "var(--sb-chip-text)" }}>{children}</p></div>;
}

function ProfileSettings() {
  const profile = useProfile();
  const country = countryByIso(profile.country);
  const [avatarBusy, setAvatarBusy] = useState(false);
  // Editable additional information — seeded from the real profile, saved live.
  const [iso, setIso] = useState(profile.country ?? "");
  const [state, setState] = useState(profile.state ?? "");        // stored as the state NAME
  const [stateCode, setStateCode] = useState("");                  // ISO code (for city lookup)
  const [city, setCity] = useState(profile.city ?? "");
  const [address, setAddress] = useState(profile.address ?? "");
  const [dob, setDob] = useState(profile.dob ?? "");
  const [saving, setSaving] = useState(false);
  // Cascading geo options: states for the chosen country, cities for the chosen state.
  const [states, setStates] = useState<ApiState[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  useEffect(() => {
    // Re-seed once the real profile resolves.
    setIso(profile.country ?? ""); setState(profile.state ?? ""); setCity(profile.city ?? "");
    setAddress(profile.address ?? ""); setDob(profile.dob ?? "");
  }, [profile.country, profile.state, profile.city, profile.address, profile.dob]);

  // Load the states for the selected country; map a saved state name back to its code.
  useEffect(() => {
    let cancelled = false;
    if (!iso) { setStates([]); return; }
    fetchStates(iso).then((rows) => {
      if (cancelled) return;
      const list = rows ?? [];
      setStates(list);
      const match = list.find((s) => s.name === state);
      setStateCode(match ? match.code : "");
    }).catch(() => { if (!cancelled) setStates([]); });
    return () => { cancelled = true; };
  }, [iso, state]);

  // Load the cities once a state code is known.
  useEffect(() => {
    let cancelled = false;
    if (!iso || !stateCode) { setCities([]); return; }
    fetchCities(iso, stateCode).then((rows) => { if (!cancelled) setCities(rows ?? []); }).catch(() => { if (!cancelled) setCities([]); });
    return () => { cancelled = true; };
  }, [iso, stateCode]);

  // User actions — reset the dependent fields so the cascade stays consistent.
  const onCountry = (v: string) => { setIso(v); setState(""); setStateCode(""); setCity(""); };
  const onState = (code: string) => {
    setStateCode(code);
    setState(states.find((s) => s.code === code)?.name ?? "");
    setCity("");
  };

  const pickAvatar = () => {
    const input = document.createElement("input");
    input.type = "file"; input.accept = "image/png,image/jpeg,image/webp";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) { toast.error("Image must be under 2 MB.", { title: "Too large" }); return; }
      setAvatarBusy(true);
      const reader = new FileReader();
      reader.onload = async () => {
        const url = await uploadAvatar(String(reader.result));
        setAvatarBusy(false);
        if (url) { await refreshProfile(); toast.success("Profile photo updated"); }
        else toast.error("Upload failed — please try again.");
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    const result = await updateProfile({ country: iso, state, city, address, dob });
    setSaving(false);
    if (!result.ok) { toast.error(result.error ?? "Could not save.", { title: "Not saved" }); return; }
    await refreshProfile();
    toast.success("Your information was saved", { title: "Saved" });
  };

  return (
    <div className="divide-y" style={{ borderColor: "var(--sb-mbd)" }}>
      <section className="grid grid-cols-1 gap-7 py-10 lg:grid-cols-[minmax(230px,1fr)_minmax(460px,560px)] lg:gap-14">
        <SectionIntro title="Personal Information">Make adjustments to your personal information and save them.</SectionIntro>
        <div className="space-y-3">
          <Field placeholder="Full name" value={profile.full_name} disabled />
          <p className="-mt-2 text-[11px]" style={{ color: P }}>You can update your name after 4 days</p>
          <Field placeholder="Email address" value={profile.email} disabled />
          {/* Real phone number entered at signup */}
          <div className="flex h-12 items-center gap-3 rounded-xl px-4 text-[14px]" style={{ background: "var(--sb-chip)", border: "1px solid var(--sb-mbd)", color: "var(--sb-nav-active)", opacity: 0.9 }}>
            {country && <span className="text-base leading-none">{country.flag}</span>}
            <span className="font-medium">{profile.phone || "No phone number on file"}</span>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-7 py-10 lg:grid-cols-[minmax(230px,1fr)_minmax(460px,560px)] lg:gap-14">
        <SectionIntro title="Avatar">Select a nice picture of yourself.</SectionIntro>
        {/* Avatar and the upload dropzone side by side */}
        <div className="flex items-center gap-4 sm:gap-5">
          {/* Same avatar as the profile page */}
          <div className="grid h-[76px] w-[76px] shrink-0 place-items-center overflow-hidden rounded-full" style={{ background: "var(--sb-fill)", border: "3px solid var(--sb-mcard)", boxShadow: "0 0 0 1px var(--sb-mbd)" }}>
            <ProfileAvatar size={70} color="var(--sb-chip-text)"/>
          </div>
          <button onClick={pickAvatar} disabled={avatarBusy}
            className="group flex min-h-[104px] flex-1 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed px-4 text-center transition hover:border-[#f04e23]/70 disabled:opacity-70"
            style={{ borderColor: "var(--sb-mbd)", background: "var(--sb-fill)" }}>
            <span className="grid h-9 w-9 place-items-center rounded-full transition-transform group-hover:scale-105" style={{ background: "rgba(240,78,35,0.14)", color: P }}>
              {avatarBusy ? <Spinner size={16} color={P}/> : <PictureIcon size={17}/>}
            </span>
            <span className="text-[12.5px] font-semibold" style={{ color: "var(--sb-nav-active)" }}>{avatarBusy ? "Uploading…" : "Click to replace photo"}</span>
            <span className="text-[11px]" style={{ color: "var(--sb-chip-text)" }}>PNG, JPG or WebP · max 2 MB</span>
          </button>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-7 py-10 lg:grid-cols-[minmax(230px,1fr)_minmax(460px,560px)] lg:gap-14">
        <SectionIntro title="Additional Information">Verify your identity — this is saved to your account.</SectionIntro>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 max-sm:grid-cols-1">
            <SelectField value={iso} onChange={onCountry} placeholder="Country of residence" options={COUNTRIES.map((c) => ({ value: c.iso, label: `${c.flag} ${c.name}` }))}/>
            <SelectField value={stateCode} onChange={onState}
              placeholder={!iso ? "Select a country first" : states.length ? "State / Region" : "No regions listed"}
              options={states.map((s) => ({ value: s.code, label: s.name }))}/>
          </div>
          <SelectField value={city} onChange={setCity}
            placeholder={!stateCode ? "Select a state / region first" : cities.length ? "City" : "No cities listed"}
            options={cities.map((c) => ({ value: c, label: c }))}/>
          <Field label="User address" value={address} onChange={setAddress} placeholder="Type your address here" />
          <DobField value={dob} onChange={setDob} />
        </div>
      </section>
      <div className="flex justify-end pt-6">
        <button onClick={save} disabled={saving} className="flex items-center gap-2 rounded-full px-8 py-3 text-[14px] font-bold text-white shadow-[0_10px_22px_rgba(240,78,35,.2)] transition hover:opacity-90 active:scale-95 disabled:opacity-70" style={{ background: P }}>
          {saving && <Spinner size={16}/>}{saving ? "Saving…" : "Save & Proceed"}
        </button>
      </div>
    </div>
  );
}

function SecuritySettings() {
  const [pin, setPin] = useState(["", "", "", ""]);
  const inputStyle = { background: "var(--sb-fill)", border: "1px solid var(--sb-mbd)", color: "var(--sb-nav-active)", fontFamily: FONT } as const;
  return <div className="divide-y" style={{ borderColor: "var(--sb-mbd)" }}>
    <section className="grid grid-cols-1 gap-7 py-10 lg:grid-cols-[minmax(230px,1fr)_minmax(460px,520px)] lg:gap-14">
      <SectionIntro title="Password">Please enter your current password to change your password.</SectionIntro>
      <div className="space-y-3">
        <Field label="Current Password" type="password" placeholder="Type your Current Password here" />
        <Field label="New Password" type="password" placeholder="Type your Password" />
        <ul className="-mt-2 list-disc space-y-1 pl-5 text-[11px]" style={{ color: "var(--sb-chip-text)" }}><li>Minimum length of 6–30 characters</li><li>Must include letters and at least one number</li></ul>
        <Field label="Confirm password" type="password" placeholder="Type your Confirm password" />
        <div className="flex justify-end gap-4 pt-1">
          <button onClick={() => toast.info("Password changes are coming soon.")} className="rounded-lg border px-8 py-2.5 text-[14px] font-semibold transition" style={{ borderColor: P, color: P }}>Cancel</button>
          <button onClick={() => toast.info("Password changes are coming soon.")} className="rounded-full px-8 py-3 text-[14px] font-bold text-white transition hover:opacity-90 active:scale-95" style={{ background: P }}>Update password</button>
        </div>
      </div>
    </section>
    <section className="grid grid-cols-1 gap-7 py-8 lg:grid-cols-[minmax(230px,1fr)_minmax(460px,520px)] lg:gap-14">
      <SectionIntro title="Withdrawal PIN">Set your withdrawal pin</SectionIntro>
      <div>
        <p className="mb-4 text-[14px] font-medium" style={{ color: "var(--sb-nav-active)" }}>Create Withdrawal pin</p>
        <div className="flex gap-4">{pin.map((value, i) => <input key={i} inputMode="numeric" maxLength={1} value={value} onChange={(e) => setPin((old) => old.map((n, index) => index === i ? e.target.value.replace(/\D/g, "") : n))} className="h-14 w-14 rounded text-center text-lg font-bold outline-none transition focus:ring-2" style={{ ...inputStyle, borderColor: "transparent", background: "var(--sb-chip)" }} placeholder="-" />)}</div>
        <div className="mt-3 flex justify-end"><button onClick={() => toast.info("Withdrawal PIN is coming soon.")} className="rounded-full px-8 py-3 text-[14px] font-bold text-white transition hover:opacity-90 active:scale-95" style={{ background: P }}>Create Pin</button></div>
      </div>
    </section>
  </div>;
}

function NotificationsSettings() {
  const [checks, setChecks] = useState([false, false, false, false]);
  const rows = [["Add Account Email Notification", "Get notified when a new account is added to the platform"], ["Messages SMS Notification", "Get notified when you get new messages"], ["Messages Email Notification", "Get notified when you get new messages"], ["Review Email Notification", "Be notified when your account gets a review"]];
  return <section className="grid grid-cols-1 gap-7 py-10 lg:grid-cols-[minmax(230px,1fr)_minmax(480px,560px)] lg:gap-14"><SectionIntro title="Notifications">Get notified on activities within SimBazaar</SectionIntro><div className="space-y-4">{rows.map(([title, subtitle], i) => <label key={title} className="flex cursor-pointer items-start gap-4"><input type="checkbox" checked={checks[i]} onChange={() => setChecks((old) => old.map((value, index) => index === i ? !value : value))} className="mt-1 h-5 w-5 rounded-sm accent-[#f04e23]" /><span><span className="block text-[14px] font-semibold" style={{ color: "var(--sb-nav-active)" }}>{title}</span><span className="mt-1 block text-[13px]" style={{ color: "var(--sb-chip-text)" }}>{subtitle}</span></span></label>)}</div></section>;
}

export function AccountSettingsPage({ setPage }: { setPage: (page: Page) => void }) {
  const [tab, setTab] = useState<SettingsTab>("profile");
  const seller = Boolean(useProfile().is_seller);
  // Premium role-based URL: buyers get /account/settings, sellers /seller/settings.
  useEffect(() => {
    try {
      const url = seller ? "/seller/settings" : "/account/settings";
      if (window.location.pathname !== url) window.history.replaceState({}, "", url);
    } catch { /* ignore */ }
  }, [seller]);

  const tabs: { id: SettingsTab; label: string }[] = [
    { id: "profile", label: "Profile" },
    { id: "security", label: "Security" },
    { id: "notifications", label: "Notifications" },
  ];
  return <div className="min-h-screen" style={{ background: "var(--sb-mbg)", fontFamily: FONT }}>
    <DesktopTopNav setPage={setPage} active="settings" />
    <AppMobileHeader className="md:hidden" setPage={setPage}/>
    <main className="mx-auto w-full max-w-[1600px] px-5 pb-24 pt-11 md:px-10 lg:px-[9.4%]" style={{ animation: "sbPageIn .42s cubic-bezier(.22,1,.36,1) both" }}>
      <h1 className="mb-6 text-[30px] font-bold tracking-[-.035em] md:text-[36px]" style={{ color: "var(--sb-nav-active)" }}>Account settings</h1>
      <div className="min-h-[690px] rounded-2xl px-6 py-5 md:px-12 md:py-7" style={{ background: "var(--sb-mcard)", border: "1px solid var(--sb-mbd)" }}>
        <div className="grid grid-cols-3 border-b" style={{ borderColor: "var(--sb-mbd)" }}>{tabs.map((item) => <button key={item.id} onClick={() => setTab(item.id)} className="relative flex items-center justify-center pb-3 text-[14px] font-semibold transition" style={{ color: tab === item.id ? P : "var(--sb-chip-text)" }}><span>{item.label}</span>{tab === item.id && <span className="absolute inset-x-0 bottom-[-1px] h-0.5" style={{ background: P }} />}</button>)}</div>
        {tab === "profile" && <ProfileSettings />}
        {tab === "security" && <SecuritySettings />}
        {tab === "notifications" && <NotificationsSettings />}
      </div>
    </main>
  </div>;
}
