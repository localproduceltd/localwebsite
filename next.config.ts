import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
      {
        protocol: "https",
        hostname: "*.supabase.in",
      },
      {
        protocol: "https",
        hostname: "static.wixstatic.com",
      },
    ],
    minimumCacheTTL: 60 * 60 * 24 * 365,
  },
  async headers() {
    return [
      {
        // Public pages - explicitly allow indexing
        source: "/(home|suppliers|products|map)",
        headers: [
          { key: "X-Robots-Tag", value: "index, follow" },
        ],
      },
      {
        // Individual supplier pages
        source: "/suppliers/:id",
        headers: [
          { key: "X-Robots-Tag", value: "index, follow" },
        ],
      },
      {
        // Private pages - noindex
        source: "/(admin|api|account|cart|sign-in|sign-up|checkout|orders|supplier-portal|auth-redirect)(.*)",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
    ];
  },
};

export default nextConfig;
