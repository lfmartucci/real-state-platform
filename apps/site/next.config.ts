import type { NextConfig } from "next";

// Sem cacheComponents/partialPrefetching: o app usa o modelo unstable_cache + revalidateTag,
// documentado em node_modules/next/dist/docs/01-app/02-guides/caching-without-cache-components.md.
const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
      { source: "/admin/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
    ];
  },
};

export default nextConfig;
