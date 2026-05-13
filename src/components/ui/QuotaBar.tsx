/**
 * Operator quota bar. Replaces DaisyUI `progress progress-primary` across the app.
 *
 * Threshold colors:
 *   < 70%   → primary (signal green / emerald)
 *   70–84%  → warning
 *   ≥ 85%   → error
 */

type QuotaBarProps = {
  current: number;
  max: number;
  /** Optional label row above the bar. */
  label?: string;
  /** Show a mono percent footer below the bar. */
  showFooterPct?: boolean;
  /** Optional mono meta string (e.g. "resets 2026-05-01"). */
  footerMeta?: string;
  /** Formatter for current/max values in the label row. Defaults to toLocaleString. */
  formatValue?: (n: number) => string;
  className?: string;
};

const defaultFormat = (n: number) => n.toLocaleString();

export function QuotaBar({
  current,
  max,
  label,
  showFooterPct = true,
  footerMeta,
  formatValue = defaultFormat,
  className,
}: QuotaBarProps) {
  const safeMax = max > 0 ? max : 1;
  const pct = Math.min(100, Math.max(0, Math.round((current / safeMax) * 100)));
  const barColor =
    pct >= 85 ? "bg-error" : pct >= 70 ? "bg-warning" : "bg-primary";

  return (
    <div className={className}>
      {label ? (
        <div className="mb-2 flex items-baseline justify-between text-[12px]">
          <span className="font-medium text-base-content">{label}</span>
          <span className="font-mono-op tabular-nums text-base-content/60">
            <span className="text-base-content">{formatValue(current)}</span>
            {" "}/{" "}
            {formatValue(max)}
          </span>
        </div>
      ) : null}
      <div
        className="h-1.5 w-full overflow-hidden rounded-sm bg-base-300"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={`h-full ${barColor} transition-[width] duration-300`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {(showFooterPct || footerMeta) ? (
        <div className="font-mono-op mt-1.5 text-[10px] tracking-[0.04em] text-base-content/45">
          {showFooterPct ? `${pct}%` : null}
          {showFooterPct && footerMeta ? " · " : null}
          {footerMeta}
        </div>
      ) : null}
    </div>
  );
}
