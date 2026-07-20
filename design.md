# SimBazaar — Design System & Build Guidelines

## Core Principle — Premium Fintech-SaaS UI/UX on Every Page

**Every page and feature page on SimBazaar — buyer panel, seller panel, marketing,
auth, and all future pages — MUST be built and designed to a premium fintech-SaaS
standard: modern, minimal, and clean, matching the quality of Linear, Vercel, and
professional P2P social-media / digital-account sales platforms (e.g. acctbazaar).**
This is a hard rule, not a preference. A page is not "done" until its UI/UX meets
this bar. Do not ship a page that looks basic, cluttered, boxy, or AI-generated.

What "premium fintech-SaaS" means here, concretely — apply to **every** page:

- **Clean card-based layout.** Group content into elevated cards using the shared
  `.sb-lcard` surface (theme-aware background, hairline border, subtle shadow,
  rounded corners). Add `.sb-lift` to interactive cards for a smooth hover rise.
- **Generous spacing & rhythm.** Breathing room between sections (`py-24`+ on
  marketing, comfortable padding on app pages), a consistent vertical rhythm, and
  a max-width container so content never sprawls edge-to-edge.
- **Rounded corners & soft shadows.** Use `rounded-2xl`/`rounded-3xl` and the
  theme-aware shadow tokens (`--sb-lshadow` / `--sb-lshadow-lg`) — never harsh
  1px black borders or flat grey boxes.
- **Smooth, tasteful animation.** Scroll-reveal (`.sb-reveal` + `useScrollReveal()`),
  `sbPageIn` on page open, in-button spinners, hover micro-interactions. Motion is
  subtle and purposeful, and always respects `prefers-reduced-motion`.
- **Strong typography hierarchy.** Plus Jakarta Sans, `tracking-[-0.02em]` and
  `textWrap:"balance"` on headings, relaxed body leading, uppercase eyebrows with
  letter-spacing, `fontVariantNumeric:"tabular-nums"` on numbers/money/stats.
- **Restrained accent use.** The orange `#f04e23` is used sparingly — CTAs, icon
  chips, eyebrows, one accent phrase — never as large washes or gradients.
- **Fully theme-aware.** Flawless in both the **shining-dark** default and the
  **pure-white** light mode. Never hardcode a dark hex for text — use
  `text-white`/`text-gray-400` so the light-mode remap layer flips it correctly.
- **Fully responsive.** Grids collapse gracefully to a single column on mobile;
  the page body never scrolls sideways (wide content scrolls inside its own
  `overflow-x-auto` container).
- **No AI-generated look.** No generic grey/gradient washes, no boxy unstyled
  forms, no default spacing. Real content, considered layout, deliberate palette.

Reuse the primitives documented under **"Landing / Marketing Surface"** below
(`.sb-lcard`, `.sb-lift`, `.sb-reveal`, `useScrollReveal()`, `<SectionHead/>`) on
new pages so the whole product feels like one cohesive, premium platform. When
building or editing any page, audit it against this checklist before considering
it complete.

## Core Principle — Everything Works in Real Time (No Demos)

**SimBazaar is a live marketplace. Every feature must read from and write to the
database (Supabase) for the currently signed-in account. Never ship placeholder,
seeded, or demo data as if it were real.** This is a hard rule, not a preference.

- **Per-account data only.** Purchases, orders, wallet transactions, cart items,
  notifications, ads and reviews belong to one account. Every API read is scoped
  to the logged-in user (`buyer_email` / `seller_email` / `owner_email` /
  `author_email`); a user must never see another account's data.
- **Empty means empty.** When an account has no data, show a real empty state —
  never fall back to demo rows. Do not use the `?? DEMO_ARRAY` fallback pattern
  for per-user lists, and never keep demo data when the API returns `[]`
  (the `if (!rows || rows.length === 0) return;` anti-pattern hides real emptiness).
- **No fake numbers.** Balances, counts, stats and dates come from the database,
  never hardcoded constants.
- **Money and privileges are earned, never granted for free.** Becoming a seller
  charges a real one-time merchant fee from the wallet balance (server-side);
  insufficient balance blocks activation. No one-click free upgrades.
- **Server is the source of truth.** All validation, ownership checks and
  money movements are enforced on the server — the client cannot bypass them.

Demo/seed constants may remain in the code **only** as public-catalogue seeds
(products/merchants shown to everyone) or as type references — never as a stand-in
for a signed-in account's private data.

## Core Principle — Skeleton Loaders While Data Loads

**Every page/section that loads data from the server MUST show a skeleton loader
placeholder while loading — never a blank space, a bare spinner in a list, or a
flash of demo data.** This is how professional platforms feel instant and
polished; it is required on both the buyer and seller panels.

- **Use the shared `Skeleton` component** from `src/app/shared.tsx`. It renders a
  theme-aware shimmering block and respects `prefers-reduced-motion`. Compose
  page-specific skeletons from it that **mirror the real content's shape**
  (same card size, same rows) — e.g. `ProductCardListSkeleton`,
  `ProductCardHorizontalSkeleton`, and the order-row skeletons.
- **Drive it from a `loaded` flag.** Data hooks return `{ data, loaded }`;
  initialise `data` from the session cache (instant on repeat visits) or empty,
  and set `loaded` true once the fetch resolves. Show skeletons only while
  `!loaded && data.length === 0`; a cached page paints instantly with no skeleton.
- **Never use a demo array as the loading state.** Replace the
  `useState(() => cache ?? DEMO)` pattern with `useState(() => cache ?? [])` plus
  a skeleton — a demo flash is worse than a skeleton.
- **Match the count** roughly to what the section usually shows (3–8 rows/cards).
- **Marketplace exception (by design):** skeletons cover the "Trending now" and
  everything below (the product lists). The promo carousel and the Top Merchants
  strip keep their existing/real loading — do **not** add skeletons there.

**Required coverage — every data page shows a skeleton on a cold (uncached) visit:**
Marketplace (Trending + lists), My Orders, **Wallet** (balance + transaction
list), **Notifications** (timeline rows), **Cart** (item cards), **Profile**
(ads/reviews tabs), **My Ads** (ad cards), and the **seller storefront** (listings).
Each uses the `const [loaded] = useState(() => readCache(key) != null)` gate: it is
`true` when cached (paints instantly, no skeleton) and `false` on a fresh visit
(shows the skeleton until the fetch resolves, including on error via `.catch`).
When adding any new page that fetches data, wire the same gate + a shape-matched
skeleton before shipping — this is mandatory, not optional.

## Core Principle — Every Modal Locks the Page Behind It

**Every pop-up and slide-up (modals, sheets, drawers, dropdown overlays) MUST
lock background scrolling while it is open.** Without this, mobile devices scroll
the page underneath the overlay — an unprofessional bug. This is mandatory for
every new overlay; do not ship one without it.

- **Always use the shared `useScrollLock(open)` hook** from `src/app/shared.tsx`.
  Never hand-roll a lock with only `document.body.style.overflow = "hidden"` —
  mobile Safari ignores it and keeps scrolling.
- The hook uses the `position: fixed` technique (fixes mobile Safari), preserves
  and restores the exact scroll position on close, and reference-counts so
  stacked overlays only release the page when the last one closes.
- **Call it unconditionally at the top of the component** (Rules of Hooks):
  - Overlay that mounts only when open (rendered as `{open && <Modal/>}`):
    call `useScrollLock(true)` at the top of the modal component.
  - Overlay controlled by a prop/state on an always-mounted component
    (`<Panel open={x}/>`, or an inline `{state && <div/>}`): call
    `useScrollLock(state)` — and place it **before any early `return`** and
    **after all the state it references is declared** (avoid TDZ).
  - Multiple overlays in one component: OR the flags —
    `useScrollLock(a || b || Boolean(c))`.
- The overlay's **own content still scrolls internally** (give the panel its own
  `max-h-[…] overflow-y-auto`); only the page *behind* is frozen.
- Applies to every overlay type: the Buy Now slide-up sheet, wallet
  deposit/withdraw/coming-soon modals, filter panel, cart quantity modal, order
  preview / seller order modals, review modal, the side navigation drawer, and
  the country picker. Any new one must follow the same rule.

## Tech Stack — Next.js (App Router)

**This project runs on Next.js 14.2.35 and MUST stay on Next.js.** Do not
reintroduce Vite or a separate Express server — the whole app (pages *and* API)
is served by Next.js so it deploys as a single Next.js app (e.g. Vercel).

| Layer | Choice |
|---|---|
| Framework / web server | **Next.js 14.2.35 (App Router)** — serves the UI and all `/api/*` routes |
| UI library | React 18.3.1 |
| Language | TypeScript |
| Styling | Tailwind CSS v4 via `@tailwindcss/postcss` (`postcss.config.mjs`) |
| Database | Supabase (`@supabase/supabase-js`, service-role key server-side only) |
| Icons | hugeicons-react v0.4.0 |
| Fonts | Plus Jakarta Sans (Google Fonts) |
| Scripts | `next dev`, `next build`, `next start` |

### Project structure (how new pages/features MUST be built)

```
app/
  layout.tsx              # root layout: <html>/<body>, global CSS, metadata, viewport, zoom-lock
  [[...slug]]/page.tsx    # renders the client SPA (dynamic import, ssr:false) — do NOT add sibling page routes
  api/<name>/route.ts     # every backend endpoint is a Next.js Route Handler (GET/POST/DELETE)
src/
  app/                    # the React SPA: App.tsx, shared.tsx, components/, lib/  (client code)
  server/api.ts           # shared server helpers (Supabase, sessions, guards) — imported ONLY by app/api/*
  styles/                 # index.css → fonts.css + tailwind.css + theme.css
```

- **The UI is one client-rendered SPA.** All screens live in `src/app` and are
  reached through the app's own history-based routing (`PAGE_PATHS`, `pushState`,
  `popstate`). `app/[[...slug]]/page.tsx` is a catch-all that renders `<App/>`
  client-only so every path (and every browser refresh) loads the same shell and
  the SPA shows the right page. **New screens are added inside `src/app`, not as
  new Next.js file routes.** Keep `"use client"` at the top of interactive files.
- **Every backend endpoint is a Route Handler** at `app/api/<path>/route.ts`
  exporting `GET`/`POST`/`DELETE`. Each starts with `export const dynamic = "force-dynamic"`,
  reuses the shared helpers in `src/server/api.ts` (Supabase client, `getSessionEmail`,
  `notify`, `walletBalance`, rate limiting, per-user ownership), checks auth with
  `getSessionEmail()` (returns `unauthorized()` when absent), and returns
  `NextResponse.json` via the `json()` helper. Sessions are opaque tokens in an
  httpOnly cookie set with `setSessionCookie`. The client calls these with plain
  same-origin `fetch("/api/…")` — no CORS, no separate API server.
- **Secrets** (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`) come from env
  (`.env` / `.env.local` locally, project env vars on the host) and are used
  **only** inside `src/server/api.ts` and `app/api/*` — never `NEXT_PUBLIC_`,
  never imported by client components.

---

## Color Palette

All colors are hardcoded as JS constants in component files. **Do not rely on CSS variables** — they are managed externally and may revert.

```ts
const P      = "#f04e23";               // Primary orange — CTAs, badges, icons, highlights
const BG     = "#111111";               // Page background
const BG2    = "#0d0d0d";               // Alternate section background (subtle contrast)
const CARD   = "#1c1c1c";               // Card surface
const CARD2  = "#242424";               // Elevated / inner card surface
const BD     = "rgba(255,255,255,0.09)";// Border
const MUTED  = "#9ca3af";               // Muted text (Tailwind gray-400)
```

**Never use teal (`#00c896`) or the default theme tokens** — this project uses the orange palette exclusively.

---

## Typography

- **Font family:** `Plus Jakarta Sans` — import in `src/styles/fonts.css`
- **Apply via:** `style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}`
- **Heading weights:** `font-extrabold` (800) for hero/section titles, `font-bold` (700) for card titles
- **Body:** `font-medium` (500) for UI labels, `font-normal` (400) for descriptive copy
- **Fluid sizing:** use `clamp()` for section headings, e.g. `text-[clamp(1.8rem,5vw,3rem)]`

---

## Component Patterns

### Orange Pill Badge (section label)
```tsx
<span className="inline-block px-5 py-2 rounded-full text-sm font-bold text-white" style={{ background: P }}>
  Features
</span>
```

### Buttons — slim, long, flat pill (REQUIRED standard)

**Every button on the app MUST be thin & long: a slim, fully-rounded pill —
never fat, never with a big glow/drop shadow.** This is a hard rule (matches the
reference "Go to Marketplace" button). A "fat and open" button (tall `py-4`+
padding, chunky orange glow shadow, or a boxy `rounded-2xl`) looks unprofessional
and is not allowed.

Rules:
- **Height is slim:** use `py-3` (or `h-[46px]`), never `py-4` or taller.
- **Shape is a pill:** `rounded-full` always — never `rounded-lg`/`rounded-2xl`
  on a text button.
- **Flat fill:** solid `background: P` (or white on orange sections). **No
  `boxShadow` glow** (no `0 16px 34px ${P}` etc.) and **no gradient fill**.
- **Long:** page-level primary CTAs are full-width — `w-full` (optionally
  `max-w-[440px]` and centered so they don't stretch absurdly wide). Inline
  buttons stay auto-width but keep the same slim height + pill + flat rules.
- **Weight/size:** `font-semibold text-[15px] text-white`, centered.
- **Interaction:** `transition-all hover:opacity-90 active:scale-[0.99]`.

```tsx
// Primary page CTA — thin & long
<button className="w-full py-3 rounded-full font-semibold text-[15px] text-white transition-all hover:opacity-90 active:scale-[0.99]" style={{ background: P }}>
  Go to Marketplace
</button>

// Inline primary (auto-width, same slim pill)
<button className="px-7 py-3 rounded-full font-semibold text-[15px] text-white transition-all hover:opacity-90 active:scale-[0.99]" style={{ background: P }}>
  Get started
</button>
```

**Only exception:** the marketplace **"Buy now"** buttons keep their existing
compact style — do not apply the full-width rule to them.

### Outlined Button (ghost)
```tsx
<button className="px-7 py-3 rounded-full font-semibold text-[15px] text-white transition-all hover:opacity-90 active:scale-[0.99]"
  style={{ border: `1px solid ${BD}`, background: "transparent" }}>
  Learn More
</button>
```

### Card
```tsx
<div className="rounded-2xl p-7" style={{ background: CARD, border: `1px solid ${BD}` }}>
  ...
</div>
```

### Orange Icon Box (How It Works step)
```tsx
<div className="w-[68px] h-[68px] rounded-2xl flex items-center justify-center" style={{ background: P }}>
  <SomeIcon size={30} color="#fff" />
</div>
```

### Orange Social Circle (Footer)
```tsx
<a href="#" className="w-11 h-11 rounded-full flex items-center justify-center text-white text-xs font-extrabold"
  style={{ background: P }}>
  IG
</a>
```

---

## Page Sections (required order)

1. **Navbar** — fixed, blur backdrop, orange circle hamburger, dotted-bg profile button
2. **Hero** — orange radial glow, trust badge pill, bold headline, `DashboardMockup` browser chrome preview
3. **Features** — 4 dark cards, each with an embedded inline UI mockup component
4. **How It Works** — 3 numbered steps: white pill → orange icon box → title + description
5. **Why Choose** — orange checkmark bullets, stats row (divider-separated)
6. **Testimonials** — `useState` carousel, Unsplash photos, star ratings, orange arrow buttons
7. **Sell Section** — 2-col grid: copy + benefit mini-cards left, person photo + floating earnings badge right
8. **CTA Banner** — solid orange `background: P`, SVG wavy topographic lines overlay, white outlined button
9. **Footer** — brand logo, description, orange social circles, Quick Links, Contact Us, Get App

---

## Layout Rules

- **Max content width:** `max-w-6xl mx-auto` with `px-5` horizontal padding
- **Section vertical rhythm:** `py-24` standard, `py-16` for tight sections
- **Grid breakpoints:** `lg:grid-cols-2` for two-column splits (desktop), single column on mobile
- **Responsive text:** `text-sm sm:text-base` for body, `text-xl sm:text-2xl` for card headings

---

## Responsive Behavior

| Breakpoint | Behavior |
|---|---|
| `< lg` | Navbar collapses to hamburger drawer; grids stack vertically |
| `sm` | Section font sizes step up one level |
| `lg+` | Full side-by-side layouts; desktop nav links visible |

---

## Imagery

- Use **Unsplash** URLs for person photos (testimonials, sell section hero)
- Format: `https://images.unsplash.com/photo-{id}?w={w}&h={h}&fit=crop&auto=format`
- Testimonial avatars: `w=96&h=96`
- Sell section hero: `w=680&h=840`

---

## Icon Usage (hugeicons-react)

Import only the icons used per file:

```tsx
import { Shield01Icon, FlashIcon, Search01Icon, CheckmarkCircle01Icon } from "hugeicons-react";
```

**Verified icon names** (use exactly as listed — casing matters):

| Use case | Icon name |
|---|---|
| Security / escrow | `Shield01Icon` |
| Fast / instant | `FlashIcon` |
| Search | `Search01Icon` |
| Checkmark | `CheckmarkCircle01Icon` |
| User / avatar | `UserIcon` |
| Messages | `Message01Icon` |
| Wallet / earnings | `Wallet01Icon` |
| Lock | `LockIcon` |
| Support | `CustomerService01Icon` |
| SIM card | `Simcard01Icon` |
| Shopping / logo | `ShoppingBag01Icon` |
| Store / merchant | `Store01Icon` |
| Menu open | `Menu01Icon` |
| Menu close | `Cancel01Icon` |
| Arrow right | `ArrowRight01Icon` |
| Arrow left | `ArrowLeft01Icon` |
| Star | `StarIcon` |

---

## Anti-Patterns (do not do these)

- Do **not** use `bg-primary`, `text-primary`, or any Tailwind CSS variable token — they resolve to the old teal palette
- Do **not** import icons that are not in the verified list above without testing first
- Do **not** add a CSS reset (`* { margin: 0; padding: 0 }`) — Tailwind's base layer already handles this
- Do **not** use `framer-motion` — use `motion/react` if animation is needed
- Do **not** create multi-file component structure — keep all sections in `src/app/App.tsx` as named functions

---

## Aesthetic Reference

The design language mirrors **cctbazaar.com**, elevated to a modern fintech-SaaS
standard (Linear / Vercel calibre): clean card-based layout, generous spacing,
rounded corners, subtle theme-aware shadows, smooth scroll animations, and a
fully responsive grid.
- Dark backgrounds with warm orange accents
- Bold, heavy typography with tight line-height on headings
- Cards with subtle borders and elevated inner surfaces
- Pill-shaped tags, buttons, and step indicators
- Browser-chrome product mockups embedded inside feature cards
- Orange → white gradient arrow navigation for carousels
- Wavy SVG topographic patterns on CTA banners

## Landing / Marketing Surface (fintech-SaaS pattern)

The public landing page (`HomePage` in `src/app/App.tsx`) uses a reusable design
system. Reuse these primitives for any new marketing/landing section so the whole
page stays consistent and works in **both** shining-dark and pure-white themes.

**Theme-aware tokens** (defined in `src/styles/theme.css`, flip per `.theme-light`):
- `--sb-lcard` — elevated card background (dark `#151517` / light `#fff`)
- `--sb-lcard-bd` / `--sb-lcard-bd-hover` — hairline card border, brightens on hover
- `--sb-lshadow` / `--sb-lshadow-lg` — subtle resting shadow / large lift+hover shadow
- `--sb-hero-glow` — radial orange glow behind the hero + mockups
- `--sb-grid-line` — faint background grid line color

**CSS utility classes** (all in `theme.css`):
- `.sb-lcard` — elevated, rounded, bordered, shadowed surface (the standard card)
- `.sb-lift` — hover: rise 5px + large shadow + border brighten (add to interactive cards)
- `.sb-reveal` — starts hidden/offset; `useScrollReveal()` adds `.is-in` on scroll to
  fade + rise once (stagger siblings with inline `style={{transitionDelay:"Nms"}}`)
- `.sb-grid-bg` — masked faint grid backdrop (hero only)
- All animations respect `prefers-reduced-motion`.

**React primitives** (in `App.tsx`):
- `useScrollReveal()` — call once at the top of a page; observes every `.sb-reveal`.
- `<SectionHead eyebrow title sub />` — centered uppercase eyebrow + balanced H2 + sub.

**Section order:** Navbar → Hero (glow + grid + trust avatars + mockup) → TrustStrip →
Features (alternating 2-col rows) → HowItWorks (stepped cards + connecting line) →
WhyChoose (benefit grid + stat band) → Testimonials (carousel) → SellSection →
CTABanner → Footer.

**Rules:** headings use `tracking-[-0.02em]` + `textWrap:"balance"`; accent `#f04e23`
is used sparingly (CTAs, icon chips, one gradient accent word, eyebrows); numeric
stats use `fontVariantNumeric:"tabular-nums"`; never hardcode a dark hex for text —
use `text-white`/`text-gray-400` (the light-mode remap layer handles the flip).
