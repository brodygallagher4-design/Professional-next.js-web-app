import type { Metadata, Viewport } from "next";
import "../src/styles/index.css";

export const metadata: Metadata = {
  title: "SimBazaar — Marketplace for eSIM & Connectivity",
  description:
    "A professional P2P marketplace to buy and sell eSIMs, virtual numbers, VPN and social accounts through verified merchants with secure escrow.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

// Lock the page scale like a native app (block pinch + double-tap zoom) without
// affecting normal scrolling. Runs before hydration.
const zoomLock = `
document.addEventListener("gesturestart", function (e) { e.preventDefault(); }, { passive: false });
document.addEventListener("gesturechange", function (e) { e.preventDefault(); }, { passive: false });
var lastTouchEnd = 0;
document.addEventListener("touchend", function (e) {
  var now = Date.now();
  if (now - lastTouchEnd <= 300 && e.touches.length === 0) { e.preventDefault(); }
  lastTouchEnd = now;
}, { passive: false });
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <script dangerouslySetInnerHTML={{ __html: zoomLock }} />
      </body>
    </html>
  );
}
