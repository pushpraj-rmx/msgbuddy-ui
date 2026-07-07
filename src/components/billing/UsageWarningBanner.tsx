"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { usageApi } from "@/lib/api";

type UsageWithLimits = {
  limitsEnforced?: boolean;
  limits?: {
    messages?: {
      current?: number;
      limit?: number;
      percentUsed?: number;
    };
  };
};

/**
 * Topbar nudge that surfaces the monthly OUTBOUND-MESSAGE quota when an
 * agent / admin is approaching or has crossed it. Sits just under the
 * TrialBanner in `AppLayout`.
 *
 * Policy: we WARN, never block. So the only thing this banner can do is
 * make the threshold visible and push toward Upgrade. See the
 * `quotas-warn-never-block` memory for the full rationale.
 *
 * Thresholds match what most BSPs surface:
 *   - <80%   silent (no banner)
 *   - 80-99% yellow / "approaching"
 *   - >=100% red / "exceeded" (sends keep going through; billing follows)
 *
 * Intentionally does NOT surface contacts or storage — per the same memory,
 * contact upload is unlimited / unwarned, and storage already 403s at
 * upload time so a banner would be noise.
 */
export function UsageWarningBanner() {
  const [data, setData] = useState<UsageWithLimits | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = (await usageApi.limits()) as UsageWithLimits;
        if (!cancelled) setData(res);
      } catch {
        // Non-fatal: a missing quota signal is better than a broken topbar.
      }
    };
    void load();
    // Refresh every 5 minutes so a long-lived session crosses the threshold
    // without needing a manual reload. Cheap query; aggregated counters.
    const id = window.setInterval(load, 5 * 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  if (dismissed) return null;
  // Enforcement off → everyone is unlimited, so there is no quota to warn about.
  if (data && data.limitsEnforced === false) return null;
  const m = data?.limits?.messages;
  const limit = m?.limit ?? 0;
  const current = m?.current ?? 0;
  if (!limit) return null;
  const pct = m?.percentUsed ?? Math.round((current / limit) * 100);
  if (pct < 80) return null;

  const exceeded = pct >= 100;

  return (
    <div
      className={`flex items-center justify-between gap-3 border-b px-4 py-2 text-[0.8125rem] ${
        exceeded
          ? "border-error/40 bg-error/10 text-base-content"
          : "border-warning/40 bg-warning/10 text-base-content"
      }`}
    >
      <div className="flex items-center gap-2.5">
        <span
          className={`op-label ${exceeded ? "text-error" : "text-warning"}`}
        >
          {exceeded ? "usage · over plan" : "usage · approaching"}
        </span>
        <p className="text-base-content/85">
          <span className="font-mono-op font-semibold tabular-nums">
            {current.toLocaleString()}
          </span>{" "}
          <span className="text-base-content/55">
            / {limit.toLocaleString()} messages this month
          </span>{" "}
          <span
            className={`font-mono-op font-semibold tabular-nums ${exceeded ? "text-error" : "text-warning"}`}
          >
            ({pct}%)
          </span>{" "}
          {exceeded ? (
            <span className="text-base-content/60">
              Sends keep going through — overage will be billed on your next
              invoice.
            </span>
          ) : (
            <span className="text-base-content/60">
              Heads up — upgrade to keep room before month-end.
            </span>
          )}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Link
          href="/billing#plans"
          className={`btn btn-xs ${exceeded ? "btn-error" : "btn-warning"}`}
        >
          {exceeded ? "Upgrade plan" : "Upgrade"}
        </Link>
        <button
          type="button"
          className="btn btn-ghost btn-xs btn-square"
          aria-label="Dismiss"
          onClick={() => setDismissed(true)}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
