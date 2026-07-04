/**
 * Shared helpers for WhatsApp template send-time variable keys.
 *
 * The backend advertises the keys a send must supply via
 * `GET /channel-templates/:id/state → requiredVariableKeys`. Most are free text
 * ({{1}}, {{name}}, header/button/carousel placeholders), but a few reserved
 * keys carry a specific value shape that deserves a purpose-built input:
 *
 *   - `offer_expiration`     → Unix epoch **milliseconds** (LTO countdown)
 *   - `location_latitude`    → decimal degrees
 *   - `location_longitude`   → decimal degrees
 *   - `location_name`        → text
 *   - `location_address`     → text
 *   - `button_<n>_coupon`    → coupon code (≤20 chars)
 *
 * Keep the reserved-key names in lock-step with the backend
 * (`templates.service.ts` getAllowed/listUnresolved).
 */

export type VariableInputKind =
  | "text"
  | "coupon"
  | "latitude"
  | "longitude"
  | "datetime";

/** Friendly label for a template placeholder key (e.g. "button_1_code" → "Button 1 · {{code}}"). */
export function variableKeyLabel(key: string): string {
  if (key === "offer_expiration") return "Offer expires at";
  const loc = key.match(/^location_(latitude|longitude|name|address)$/);
  if (loc) {
    const part = loc[1].charAt(0).toUpperCase() + loc[1].slice(1);
    return `Location · ${part}`;
  }
  const card = key.match(/^card_(\d+)_(.+)$/);
  if (card) return `Card ${card[1]} · ${variableKeyLabel(card[2])}`;
  const coupon = key.match(/^button_(\d+)_coupon$/);
  if (coupon) return `Button ${coupon[1]} · Coupon code`;
  const btn = key.match(/^button_(\d+)_(.+)$/);
  if (btn) return `Button ${btn[1]} · {{${btn[2]}}}`;
  const hdr = key.match(/^header_(.+)$/);
  if (hdr) return `Header · {{${hdr[1]}}}`;
  return `{{${key}}}`;
}

/** The typed input a reserved send key deserves; everything else is plain text. */
export function variableInputKind(key: string): VariableInputKind {
  if (key === "offer_expiration") return "datetime";
  if (key === "location_latitude") return "latitude";
  if (key === "location_longitude") return "longitude";
  if (/^button_\d+_coupon$/.test(key)) return "coupon";
  return "text";
}

/** Two-digit zero-pad. */
function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Render a Unix-ms string as a `datetime-local` input value (`YYYY-MM-DDTHH:mm`)
 * in the browser's local timezone. Returns "" for empty/invalid input.
 */
export function unixMsToDatetimeLocal(ms: string): string {
  const n = Number((ms ?? "").trim());
  if (!Number.isFinite(n) || n <= 0) return "";
  const d = new Date(n);
  if (Number.isNaN(d.getTime())) return "";
  return (
    `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}` +
    `T${pad2(d.getHours())}:${pad2(d.getMinutes())}`
  );
}

/**
 * Convert a `datetime-local` value (interpreted as local time) to a Unix-ms
 * string for the send payload. Returns "" for empty/invalid input.
 */
export function datetimeLocalToUnixMs(local: string): string {
  const t = (local ?? "").trim();
  if (!t) return "";
  const ms = new Date(t).getTime();
  return Number.isNaN(ms) ? "" : String(ms);
}
