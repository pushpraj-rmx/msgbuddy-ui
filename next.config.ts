import type { NextConfig } from "next";

// Inject a unique build ID into the bundle so the client can detect new deployments.
process.env.NEXT_PUBLIC_BUILD_ID =
  process.env.NEXT_PUBLIC_BUILD_ID ?? Date.now().toString();

const nextConfig: NextConfig = {
  // Dev cross-origin requests (e.g. local Next hitting remote API). Production UI: app.msgbuddy.com
  allowedDevOrigins: [
    "app.msgbuddy.com",
    "msgbuddy.com",
    "api.msgbuddy.com",
    "msgbuddy.nationalmarketingprojects.com",
  ],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "picsum.photos",
      },
    ],
  },
};

export default nextConfig;
