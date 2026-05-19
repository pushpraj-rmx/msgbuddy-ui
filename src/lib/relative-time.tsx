/**
 * Operator-flavoured relative-time helpers + the last-used dot indicator.
 *
 * Same dependency surface as the rest of `lib/` (no React imports at module
 * scope outside the dot component, no Tailwind config coupling) so server
 * components can pull these without hauling in client-only context.
 */

/** Compact "12s / 4m / 3h / 2d / 6w / 8mo / 2y" — null passes through. */
export function relativeShort(
  iso: string | null | undefined,
  now: number,
): string | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  const diff = Math.max(0, now - then);
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  const w = Math.floor(d / 7);
  if (w < 4) return `${w}w ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  const y = Math.floor(d / 365);
  return `${y}y ago`;
}

/** ISO timestamp → "2026-05-19 14:23:04 UTC" for hover-title tooltips. */
export function absoluteUTC(iso: string | null | undefined): string | undefined {
  if (!iso) return undefined;
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return undefined;
  return t.toISOString().replace("T", " ").replace(/\.\d+Z$/, " UTC");
}

/**
 * Six-pixel dot with a freshness gradient + relative timestamp.
 * Lets a workspace with multiple keys / endpoints see at a glance which one
 * is hot in production right now without diving into per-row logs.
 *
 * Colours: <1h ago bright signal-green · <24h dim green · >24h grey ·
 * never → em-dash placeholder (no dot).
 */
export function LastUsedDot({
  lastUsedAt,
  now,
}: {
  lastUsedAt: string | null | undefined;
  now: number;
}) {
  if (!lastUsedAt) {
    return <span className="font-mono-op text-base-content/30">—</span>;
  }
  const then = new Date(lastUsedAt).getTime();
  const ageMs = now - then;
  const hour = 3600_000;
  const day = 24 * hour;
  let bg: string;
  let opacity = 1;
  if (ageMs < hour) {
    bg = "var(--op-accent)";
  } else if (ageMs < day) {
    bg = "var(--op-accent)";
    opacity = 0.5;
  } else {
    bg = "var(--op-ink-dim)";
    opacity = 0.65;
  }
  return (
    <span
      className="font-mono-op inline-flex items-center gap-2 text-[0.75rem] tabular-nums"
      title={absoluteUTC(lastUsedAt)}
    >
      <span
        aria-hidden="true"
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: bg,
          opacity,
          flexShrink: 0,
        }}
      />
      <span className="text-base-content/80">
        {relativeShort(lastUsedAt, now)}
      </span>
    </span>
  );
}
