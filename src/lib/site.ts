/**
 * Public URL of this Next.js app (no trailing slash).
 * Set in production: `NEXT_PUBLIC_APP_URL=https://app.msgbuddy.com`
 */
export function getAppOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (raw) return raw.replace(/\/$/, "");
  return "https://app.msgbuddy.com";
}
