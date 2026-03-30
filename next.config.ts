import type { NextConfig } from "next";

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
