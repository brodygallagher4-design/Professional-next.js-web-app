"use client";

// ─── TanStack Query integration ────────────────────────────────────────────
// Central caching / data-fetching layer. Gives the whole app request
// de-duplication (many components asking for the same data → one network call),
// a shared cache, background revalidation, retries with exponential backoff, and
// resilient behaviour under high traffic (bursts collapse into a single request).

import { QueryClient, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import type { ReactNode } from "react";
import {
  fetchProducts, fetchMerchants, fetchPurchases, fetchNotifications, fetchWalletBalance, fetchCart,
  addCartItem, removeCartItem,
  type ApiProduct, type ApiMerchant, type ApiPurchase, type ApiNotification, type ApiCartItem,
} from "./api";

// A single client for the whole client-rendered SPA. Created lazily so it exists
// exactly once per browser session (never re-created on re-render or HMR).
let _client: QueryClient | undefined;
export function getQueryClient(): QueryClient {
  if (!_client) {
    _client = new QueryClient({
      defaultOptions: {
        queries: {
          // Data stays "fresh" for 30s: repeat reads inside that window are served
          // from cache instantly with zero network — the core high-traffic win.
          staleTime: 30_000,
          gcTime: 5 * 60_000,          // keep unused cache for 5 minutes
          // Retry transient failures (network blips, 5xx) with exponential backoff
          // so a brief outage self-heals instead of surfacing an error.
          retry: (count, err) => {
            const status = (err as { status?: number } | undefined)?.status;
            if (status && status >= 400 && status < 500) return false; // don't retry client errors
            return count < 2;
          },
          retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 15_000),
          refetchOnWindowFocus: true,  // revalidate on focus (gated by staleTime, so it's cheap)
          refetchOnReconnect: true,
          networkMode: "online",
        },
        mutations: { retry: 1, networkMode: "online" },
      },
    });
  }
  return _client;
}

// Persist the whole query cache to localStorage so a returning visitor sees data
// instantly on cold start (paint from cache, revalidate in the background) — the
// biggest perceived-speed win. Falls back to a no-op on the server.
let _persister: ReturnType<typeof createSyncStoragePersister> | undefined;
function getPersister() {
  if (!_persister) {
    _persister = createSyncStoragePersister({
      storage: typeof window !== "undefined" ? window.localStorage : undefined,
      key: "sb-rq-cache",
      throttleTime: 1000,
    });
  }
  return _persister;
}

export function QueryProvider({ children }: { children: ReactNode }) {
  return (
    <PersistQueryClientProvider
      client={getQueryClient()}
      persistOptions={{
        persister: getPersister(),
        maxAge: 1000 * 60 * 60 * 24,           // keep restored cache up to 24h
        buster: "sb-v1",                        // bump to invalidate all persisted cache
        dehydrateOptions: { shouldDehydrateQuery: (q) => q.state.status === "success" },
      }}>
      {children}
      {process.env.NODE_ENV !== "production" && <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />}
    </PersistQueryClientProvider>
  );
}

// Typed query-key factory — a single source of truth so invalidation never
// mis-targets a cache entry.
export const qk = {
  products: ["products"] as const,
  merchants: ["merchants"] as const,
  purchases: (role: "buyer" | "seller") => ["purchases", role] as const,
  notifications: ["notifications"] as const,
  wallet: ["wallet", "balance"] as const,
  cart: ["cart"] as const,
};

// The lib/api readers resolve to `null` on failure; throw instead so React Query
// can retry and expose a real error state (empty results are `[]`, never null).
const need = <T,>(v: T | null, what: string): T => {
  if (v == null) throw new Error(`Could not load ${what}.`);
  return v;
};

export const useProductsQuery = () =>
  useQuery<ApiProduct[]>({ queryKey: qk.products, queryFn: async () => need(await fetchProducts(), "products") });

export const useMerchantsQuery = () =>
  useQuery<ApiMerchant[]>({ queryKey: qk.merchants, queryFn: async () => need(await fetchMerchants(), "merchants") });

export const usePurchasesQuery = (role: "buyer" | "seller") =>
  useQuery<ApiPurchase[]>({ queryKey: qk.purchases(role), queryFn: async () => need(await fetchPurchases(role), "orders") });

export const useNotificationsQuery = () =>
  useQuery<ApiNotification[]>({ queryKey: qk.notifications, queryFn: async () => need(await fetchNotifications(), "notifications"), staleTime: 15_000 });

export const useWalletBalanceQuery = () =>
  useQuery<number>({ queryKey: qk.wallet, queryFn: async () => need(await fetchWalletBalance(), "wallet")?.balance ?? 0, staleTime: 10_000 });

export const useCartQuery = () =>
  useQuery<ApiCartItem[]>({ queryKey: qk.cart, queryFn: async () => need(await fetchCart(), "cart"), staleTime: 10_000 });

// Invalidate related caches after a mutation so every screen reflects the change
// in real time (e.g. after a purchase: refresh cart, purchases, wallet).
export function useInvalidate() {
  const client = useQueryClient();
  return (keys: readonly unknown[][]) => Promise.all(keys.map((key) => client.invalidateQueries({ queryKey: key })));
}

// ── Mutations ────────────────────────────────────────────────────────────────
// Idiomatic TanStack mutations: the cache updates optimistically, rolls back on
// error, and revalidates on settle — the pattern professional apps use so the UI
// feels instant while staying correct.
export function useAddToCart() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (item: Parameters<typeof addCartItem>[0]) => addCartItem(item),
    onSuccess: () => client.invalidateQueries({ queryKey: qk.cart }),
  });
}
export function useRemoveFromCart() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => removeCartItem(id),
    onMutate: async (id: number) => {
      await client.cancelQueries({ queryKey: qk.cart });
      const prev = client.getQueryData<ApiCartItem[]>(qk.cart);
      client.setQueryData<ApiCartItem[]>(qk.cart, (old) => (old ?? []).filter((i) => i.id !== id));
      return { prev };
    },
    onError: (_e, _id, ctx) => { if (ctx?.prev) client.setQueryData(qk.cart, ctx.prev); },
    onSettled: () => client.invalidateQueries({ queryKey: qk.cart }),
  });
}

export { useMutation };
