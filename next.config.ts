import type { NextConfig } from "next";

// Deployment-specific settings (standalone output, security headers, image
// patterns) are added in Task 4. See docs/spec/implementation-plan.md.
const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  // Next.js 16 blocks dev-server resources requested from other hosts. The
  // Playwright tests reach the dev server at 127.0.0.1, so allow it; without
  // this the dev page never hydrates. It affects `next dev` only.
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
