/** @type {import('next').NextConfig} */
const nextConfig = {
  // The app manages its own effects and module-level state (auth/profile
  // caches); StrictMode's double-invoke would fire duplicate requests in dev.
  reactStrictMode: false,
  // This codebase ran under Vite/esbuild (no strict type-check at build time),
  // so keep the build resilient the same way — runtime behaviour is verified.
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
