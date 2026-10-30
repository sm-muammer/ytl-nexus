import type { NextConfig } from "next";

// Deployment-specific settings (standalone output, security headers, image
// patterns) are added in Task 3 and Task 4. See docs/spec/implementation-plan.md.
const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
};

export default nextConfig;
