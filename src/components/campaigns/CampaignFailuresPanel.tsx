"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  onCreateFollowUp,
  autoRetry,
}: {
  campaignId: string;
  runId?: string | null;
  /** Bump to force a refetch (e.g. after the parent runs a retry). */
  reloadToken?: number;
  /** Parent's retry handler; when omitted the retry action is hidden. */
  onRetry?: () => void | Promise<void>;
  canRetry?: boolean;
  /** Creates a draft follow-up campaign for the failed contacts (retryable-only
   *  by default; `includeAll` stages permanent failures too). */
  onCreateFollowUp?: (includeAll?: boolean) => void | Promise<void>;
  /** Auto-retry state for the shown run (campaign setting + run bookkeeping). */
  autoRetry?: {
    setting: "MANUAL" | "AUTO_RETRY" | null;
    run: {
      failureRound: number;
      nextRetryAt: string | null;
      failureHandledAt: string | null;
    } | null;
  };
}) {
  const [data, setData] = useState<CampaignFailures | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [creatingFollowUp, setCreatingFollowUp] = useState(false);
  /** Run id we last auto-expanded for — auto-expand once per run, then respect the user's collapse. */
  const autoExpandedForRef = useRef<string | null>(null);

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

  // Eager-load so the collapsed header can show real counts (a campaign with
  // 200 failures must not look identical to one with none); refetch on run
  // change / parent reload.
  useEffect(() => {
    void load();
  }, [load, reloadToken]);

  // Surface failures unprompted: expand once per run when there are any.
  useEffect(() => {
    if (!data || data.counts.total === 0) return;
    if (autoExpandedForRef.current === data.runId) return;
    autoExpandedForRef.current = data.runId;
    setOpen(true);
  }, [data]);

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

  const handleFollowUp = useCallback(
    async (includeAll?: boolean) => {
      if (!onCreateFollowUp) return;
      setCreatingFollowUp(true);
      try {
        await onCreateFollowUp(includeAll);
      } finally {
        setCreatingFollowUp(false);
      }
    },
    [onCreateFollowUp],
  );

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
          {counts && counts.manualRetryable > 0 ? (
            <span className="ml-2 font-normal text-base-content/60">
              — {counts.manualRetryable} retryable
            </span>
          ) : counts && total > 0 ? (
            <span className="ml-2 font-normal text-base-content/60">
              — all permanent
            </span>
          ) : null}
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
            <p className="text-sm text-base-content/60">
              No failures in this run.
              {(autoRetry?.run?.failureRound ?? 0) > 0
                ? ` Auto-retry recovered them after ${autoRetry!.run!.failureRound} round${autoRetry!.run!.failureRound === 1 ? "" : "s"}. 🎉`
                : " 🎉"}
            </p>
          ) : (
            <>
              {(() => {
                // "What's happening" line for auto-retry, from run bookkeeping
                // (ground truth) + the campaign's setting.
                const run = autoRetry?.run;
                const nextAt = run?.nextRetryAt ? new Date(run.nextRetryAt) : null;
                if (nextAt && nextAt.getTime() > Date.now()) {
                  return (
                    <p className="rounded-box border border-info/30 bg-info/5 px-3 py-2 text-xs">
                      ⏱ <span className="font-medium">Auto-retry scheduled:</span>{" "}
                      round {(run!.failureRound ?? 0) + 1} at{" "}
                      {nextAt.toLocaleString()}. Only temporary failures (rate
                      limits, frequency caps) will be re-attempted — permanent
                      ones are skipped.
                    </p>
                  );
                }
                if (run && run.failureRound > 0) {
                  return (
                    <p className="rounded-box border border-base-300 bg-base-200/40 px-3 py-2 text-xs">
                      <span className="font-medium">
                        Auto-retry ran {run.failureRound} round
                        {run.failureRound === 1 ? "" : "s"}
                      </span>{" "}
                      and these recipients still failed. You can retry manually
                      or create a follow-up campaign below.
                    </p>
                  );
                }
                if (
                  autoRetry?.setting === "AUTO_RETRY" &&
                  run &&
                  !run.failureHandledAt
                ) {
                  return (
                    <p className="rounded-box border border-base-300 bg-base-200/40 px-3 py-2 text-xs">
                      <span className="font-medium">Auto-retry is on:</span>{" "}
                      failures are evaluated ~30 minutes after the run finishes
                      (letting delivery receipts settle), then temporary ones
                      are re-attempted on a schedule.
                    </p>
                  );
                }
                return null;
              })()}
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
                    disabled={retrying || creatingFollowUp}
                  >
                    <span aria-hidden>↻</span> Retry {counts!.manualRetryable}{" "}
                    retryable
                  </button>
                ) : null}
                {onCreateFollowUp && counts!.manualRetryable > 0 ? (
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost gap-1"
                    onClick={() => void handleFollowUp()}
                    disabled={retrying || creatingFollowUp}
                    title="Creates a DRAFT campaign with the same message, targeting only these retryable failed contacts. You can edit it before starting — nothing is sent until you start it."
                  >
                    {creatingFollowUp ? (
                      <span className="loading loading-spinner loading-xs" />
                    ) : (
                      <span aria-hidden>⎘</span>
                    )}{" "}
                    Follow-up campaign ({counts!.manualRetryable})
                  </button>
                ) : null}
                {onCreateFollowUp &&
                counts!.manualRetryable === 0 &&
                total > 0 ? (
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost gap-1"
                    onClick={() => void handleFollowUp(true)}
                    disabled={creatingFollowUp}
                    title="Every failure here is permanent (invalid number, opted out, template rejected) — resending as-is will fail again. This stages them into a DRAFT campaign anyway, e.g. to send after fixing the contacts or with a different template. Nothing is sent until you start it."
                  >
                    {creatingFollowUp ? (
                      <span className="loading loading-spinner loading-xs" />
                    ) : (
                      <span aria-hidden>⎘</span>
                    )}{" "}
                    Stage anyway ({total} permanent)
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
