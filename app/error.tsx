"use client";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#000", color: "#fff", fontFamily: "system-ui, sans-serif", padding: 24, textAlign: "center" }}>
      <div style={{ maxWidth: 380 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>Something went wrong</h2>
        <p style={{ marginTop: 8, fontSize: 13, opacity: 0.65 }}>{error?.message || "An unexpected error occurred while loading the app."}</p>
        <button onClick={reset} style={{ marginTop: 18, padding: "10px 24px", borderRadius: 999, background: "#f04e23", color: "#fff", border: "none", fontWeight: 700, cursor: "pointer" }}>
          Try again
        </button>
      </div>
    </div>
  );
}
