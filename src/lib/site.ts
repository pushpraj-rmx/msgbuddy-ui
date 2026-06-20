/**
 * Public URL of this Next.js app (no trailing slash).
 * Set in production: `NEXT_PUBLIC_APP_URL=https://app.msgbuddy.com`
 */
export function getAppOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (raw) return raw.replace(/\/$/, "");
  return "https://app.msgbuddy.com";
}

/**
 * `GET /v2/channel-templates/:id/state` may return legacy `action.href` values that pointed
 * at REST paths (`/v2/channel-templates/...`). Those break when used as `<a href>` on the app
 * host. Normalize to the Next.js route.
 */
export function channelTemplateRequirementHref(href: string): string {
  const m = href.match(/^\/v2\/channel-templates\/([^/]+)(?:\/versions)?\/?$/);
  if (m) return `/channel-templates/${m[1]}`;
  return href;
}
