import type { NextConfig } from "next";

// Security headers (HSTS, CSP and the rest) are sent by Apache on Nexus Core 01
// (infrastructure/apache); the application sets its own from Task 21.
const nextConfig: NextConfig = {
  // Self-hosting: `deploy.sh` runs `.next/standalone/server.js` under systemd.
  output: "standalone",
  poweredByHeader: false,
  reactStrictMode: true,
  // Next.js 16 blocks dev-server resources requested from other hosts. The
  // Playwright tests reach the dev server at 127.0.0.1, so allow it; without
  // this the dev page never hydrates. It affects `next dev` only.
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
