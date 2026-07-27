/**
 * Render an ISO 3166-1 alpha-2 country code as "🇮🇳 India".
 *
 * The flag is built from regional-indicator code points, and the name from
 * `Intl.DisplayNames` — so no country table or extra dependency is needed.
 * Returns null for missing/malformed codes so callers can show a dash.
 */
export function formatCountry(code: string | null | undefined): string | null {
  if (!code || !/^[A-Za-z]{2}$/.test(code)) return null;
  const cc = code.toUpperCase();
  const flag = String.fromCodePoint(
    ...[...cc].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65),
  );
  try {
    const name = new Intl.DisplayNames(undefined, { type: "region" }).of(cc);
    return name ? `${flag} ${name}` : `${flag} ${cc}`;
  } catch {
    return `${flag} ${cc}`;
  }
}

export function formatRelativeTime(input: string): string {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return "";
  const diffSec = Math.round((date.getTime() - Date.now()) / 1000);
  const abs = Math.abs(diffSec);
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  if (abs < 60) return formatter.format(diffSec, "second");
  if (abs < 3600) return formatter.format(Math.round(diffSec / 60), "minute");
  if (abs < 86400) return formatter.format(Math.round(diffSec / 3600), "hour");
  return formatter.format(Math.round(diffSec / 86400), "day");
}
