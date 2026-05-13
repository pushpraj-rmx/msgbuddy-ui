import type { ReactNode } from "react";

/**
 * Operator KPI card. Used by Dashboard, Analytics, Billing, Campaign reports.
 * Mono tabular numerals, uppercase mono label, subtle grain overlay.
 */

type KpiCardProps = {
  label: string;
  value: string | number;
  hint?: ReactNode;
  /** Optional delta pill (e.g. "+12.4%"). Rendered in the label row. */
  delta?: string;
  /** Whether the delta is positive (green) or negative (red). */
  deltaDirection?: "up" | "down";
  className?: string;
};

export function KpiCard({
  label,
  value,
  hint,
  delta,
  deltaDirection = "up",
  className,
}: KpiCardProps) {
  return (
    <div className={`op-grain rounded-box border border-base-300 bg-base-200${className ? ` ${className}` : ""}`}>
      <div className="relative flex flex-col gap-3 p-4 sm:p-5">
        <div className="flex items-center justify-between">
          <span className="op-label">{label}</span>
          {delta ? (
            <span
              className={`font-mono-op rounded-[3px] border px-1.5 py-[1px] text-[10px] tabular-nums ${
                deltaDirection === "down"
                  ? "border-error/40 text-error"
                  : "border-primary/40 text-primary"
              }`}
            >
              {delta}
            </span>
          ) : null}
        </div>
        <div className="font-mono-op text-[32px] font-semibold leading-none tracking-[-0.02em] tabular-nums">
          {value}
        </div>
        {hint ? (
          <div className="text-[11px] text-base-content/55">{hint}</div>
        ) : null}
      </div>
    </div>
  );
}
