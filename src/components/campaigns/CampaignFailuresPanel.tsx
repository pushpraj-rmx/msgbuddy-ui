"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  campaignsApi,
  type CampaignFailures,
  type CampaignFailedRecipient,
  type CampaignFailureClass,
} from "@/lib/api";

/** Per-class presentation: badge label/colour + a plain-language "what to do". */
const CLASS_BADGE: Record<
  CampaignFailureClass,
  { label: string; cls: string; blurb: string }
> = {
  TRANSIENT: {
    label: "Will retry",
    cls: "border-info/40 bg-info/10 text-info",
    blurb:
      "A temporary problem (rate limit, transport). Retrying is worth it.",
  },
  UNKNOWN: {
    label: "Unclassified",
    cls: "border-base-300 bg-base-200 text-base-content/70",
    blurb:
      "We couldn't classify this failure. A manual retry is allowed — it's your call.",
  },
  TIME_GATED: {
    label: "Retry later",
    cls: "border-warning/40 bg-warning/10 text-warning",
    blurb:
      "Blocked by a time window (e.g. marketing frequency cap). Retrying now will likely fail again — better to wait.",
  },
  PERMANENT: {
    label: "Permanent",
    cls: "border-error/40 bg-error/10 text-error",
    blurb:
      "Won't be retried — the send would fail again (invalid number, opted out, template rejected). Fix the contact or template, or remove them.",
  },
};

/** Actionable (retryable) groups first, permanent last. */
const CLASS_ORDER: Record<CampaignFailureClass, number> = {
  TRANSIENT: 0,
  UNKNOWN: 1,
  TIME_GATED: 2,
  PERMANENT: 3,
};

function toCsv(recipients: CampaignFailedRecipient[]): string {
  const header = [
    "name",
    "phone",
    "stage",
    "reason",
    "class",
    "attempts",
    "retryable",
  ];
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = recipients.map((r) =>
    [
      r.name ?? "",
      r.phone ?? "",
      r.failureStage,
      r.reason,
      r.failureClass,
      r.attempts,
      r.manualRetryable ? "yes" : "no",
    ]
      .map(esc)
      .join(","),
  );
  return [header.join(","), ...rows].join("\n");
}

/**
 * Drill-down of a run's failed recipients — unified across send + delivery
 * failures, grouped by reason, each badged with its retry disposition so the
 * user can see *what happened* and *what to do*. Retrying re-attempts only the
 * non-permanent ones (the backend skips permanent failures).
 */
export function CampaignFailuresPanel({
  campaignId,
  runId,
  reloadToken = 0,
  onRetry,
  canRetry = false,
}: {
  campaignId: string;
  runId?: string | null;
  /** Bump to force a refetch (e.g. after the parent runs a retry). */
  reloadToken?: number;
  /** Parent's retry handler; when omitted the retry action is hidden. */
  onRetry?: () => void | Promise<void>;
  canRetry?: boolean;
}) {
  const [data, setData] = useState<CampaignFailures | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await campaignsApi.failures(campaignId, runId ?? undefined));
    } catch {
      setError("Couldn't load failures.");
    } finally {
      setLoading(false);
    }
  }, [campaignId, runId]);

  // Load lazily on first expand, and refetch on run change / parent reload.
  useEffect(() => {
    if (open) void load();
  }, [open, load, reloadToken]);

  const grouped = useMemo(() => {
    const map = new Map<
      string,
      { reason: string; failureClass: CampaignFailureClass; items: CampaignFailedRecipient[] }
    >();
    for (const r of data?.recipients ?? []) {
      const key = `${r.failureClass}::${r.reason}`;
      const g =
        map.get(key) ?? { reason: r.reason, failureClass: r.failureClass, items: [] };
      g.items.push(r);
      map.set(key, g);
    }
    return [...map.values()].sort(
      (a, b) =>
        CLASS_ORDER[a.failureClass] - CLASS_ORDER[b.failureClass] ||
        b.items.length - a.items.length,
    );
  }, [data]);

  const counts = data?.counts;
  const total = counts?.total ?? 0;

  const handleExport = useCallback(() => {
    if (!data?.recipients?.length) return;
    const blob = new Blob([toCsv(data.recipients)], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `campaign-failures-${data.runId}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, [data]);

  const handleRetry = useCallback(async () => {
    if (!onRetry) return;
    setRetrying(true);
    try {
      await onRetry();
      await load();
    } finally {
      setRetrying(false);
    }
  }, [onRetry, load]);

  return (
    <div className="card bg-base-100 border border-base-300 p-4">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 text-left"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className="text-sm font-medium">
          Failed recipients{data ? ` (${total})` : ""}
        </span>
        <span className="text-xs text-base-content/60">{open ? "Hide" : "View"}</span>
      </button>

      {open ? (
        <div className="mt-3 space-y-3">
          {loading ? (
            <div className="skeleton h-24 rounded-box" />
          ) : error ? (
            <div className="rounded-box border border-error/30 border-l-2 border-l-error bg-base-200 px-3 py-2 text-sm">
              {error}{" "}
              <button type="button" className="link" onClick={() => void load()}>
                Try again
              </button>
            </div>
          ) : total === 0 ? (
            <p className="text-sm text-base-content/60">No failures in this run. 🎉</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-2 text-xs">
                {counts!.manualRetryable > 0 ? (
                  <span className="rounded border border-info/40 bg-info/10 px-2 py-1 text-info">
                    {counts!.manualRetryable} worth retrying
                  </span>
                ) : null}
                {counts!.timeGated > 0 ? (
                  <span className="rounded border border-warning/40 bg-warning/10 px-2 py-1 text-warning">
                    {counts!.timeGated} time-gated
                  </span>
                ) : null}
                {counts!.permanent > 0 ? (
                  <span className="rounded border border-error/40 bg-error/10 px-2 py-1 text-error">
                    {counts!.permanent} permanent
                  </span>
                ) : null}
              </div>

              <p className="text-xs text-base-content/60">
                Retrying re-attempts only the non-permanent recipients — permanent
                failures (invalid number, opted out, template rejected) are skipped
                because they&apos;d fail again. Time-gated ones may still be
                rejected until their window passes.
              </p>

              <div className="flex flex-wrap gap-2">
                {onRetry && canRetry && counts!.manualRetryable > 0 ? (
                  <button
                    type="button"
                    className="btn btn-sm btn-secondary btn-outline gap-1"
                    onClick={() => void handleRetry()}
                    disabled={retrying}
                  >
                    <span aria-hidden>↻</span> Retry {counts!.manualRetryable}{" "}
                    retryable
                  </button>
                ) : null}
                <button
                  type="button"
                  className="btn btn-sm btn-ghost gap-1"
                  onClick={handleExport}
                >
                  <span aria-hidden>⭳</span> Export CSV
                </button>
              </div>

              <div className="max-h-72 overflow-auto rounded-box border border-base-300">
                <ul className="divide-y divide-base-300">
                  {grouped.map((g) => {
                    const badge = CLASS_BADGE[g.failureClass];
                    return (
                      <li key={`${g.failureClass}-${g.reason}`} className="p-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm">{g.reason}</span>
                          <span
                            className={`shrink-0 rounded border px-2 py-0.5 text-[0.6875rem] ${badge.cls}`}
                            title={badge.blurb}
                          >
                            {badge.label} · {g.items.length}
                          </span>
                        </div>
                        <ul className="mt-1 space-y-0.5 text-xs text-base-content/60">
                          {g.items.slice(0, 8).map((r) => (
                            <li
                              key={r.contactId + (r.messageId ?? "")}
                              className="flex items-center gap-2"
                            >
                              <span className="tabular-nums">{r.phone ?? "—"}</span>
                              {r.name ? (
                                <span className="truncate">{r.name}</span>
                              ) : null}
                              <span className="ml-auto shrink-0 text-[0.625rem] uppercase tracking-wide text-base-content/40">
                                {r.failureStage === "send"
                                  ? "not sent"
                                  : "not delivered"}
                              </span>
                            </li>
                          ))}
                          {g.items.length > 8 ? (
                            <li className="text-base-content/40">
                              +{g.items.length - 8} more — export CSV for the full
                              list
                            </li>
                          ) : null}
                        </ul>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
