import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pure client-side app - no server-side rendering needed
  // API calls go directly to the MsgBuddy backend (v2.msgbuddy.com)
  allowedDevOrigins: ["v2.msgbuddy.com", "ui.msgbuddy.com", "msgbuddy.nationalmarketingprojects.com"],
};

export default nextConfig;
