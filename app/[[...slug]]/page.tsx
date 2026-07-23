"use client";

import dynamic from "next/dynamic";
import { QueryProvider } from "@/app/lib/query";

// The whole app is a client-rendered SPA with its own history-based routing.
// Load it client-only (ssr: false) so its window/localStorage access on first
// render behaves exactly as before — Next.js serves the shell, the SPA takes over.
const App = dynamic(() => import("@/app/App"), {
  ssr: false,
  loading: () => (
    <div style={{ minHeight: "100vh", background: "var(--sb-mbg, #000)" }} />
  ),
});

export default function CatchAllPage() {
  return (
    <QueryProvider>
      <App />
    </QueryProvider>
  );
}
