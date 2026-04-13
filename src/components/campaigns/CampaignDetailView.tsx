"use client";

import type { Dispatch, SetStateAction } from "react";
import { useEffect, useState } from "react";
import {
  type CampaignStatusTone,
  formatCampaignHeroTitle,
  mergeReportWithProgress,
  normalizeStatus,
  parseReportMetrics,
  showDrainQueue,
  showPause,
  showResume,
  showStart,
  showStopCampaign,
  statusBadgeClasses,
  statusHeroClasses,
} from "@/lib/campaignUi";

export type Campaign = {
  id: string;
  name: string;
  status: string;
  channel: string;
  channelTemplateVersionId?: string;
  templateBindings?: Record<string, unknown> | null;
  scheduledAt?: string | null;
  timezone?: string;
};

type CampaignProgress = {
  progressPercent?: number;
  completedJobs?: number;
  totalJobs?: number;
  status?: string;
  runNumber?: number;
};

type CampaignRun = {
  id: string;
  status?: string;
  createdAt?: string;
  startedAt?: string;
  endedAt?: string;
  totalJobs?: number;
  completedJobs?: number;
  failedJobs?: number;
};

type CampaignRunJob = {
  id: string;
  campaignRunId: string;
  contactId: string;
  chunkIndex?: number;
  status?: string;
  idempotencyKey?: string;
  messageId?: string | null;
  attempts?: number;
  lastError?: string | null;
  lastAttemptAt?: string | null;
  scheduledAt?: string | null;
  processedAt?: string | null;
  createdAt?: string | null;
};

function isoToDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const z = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`;
}

function formatReportValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function MetricCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: "default" | "success" | "warning" | "error";
}) {
  const valueClass =
    accent === "success"
      ? "text-success"
      : accent === "warning"
        ? "text-warning"
        : accent === "error"
          ? "text-error"
          : "text-base-content";
  return (
    <div className="rounded-box border border-base-300 bg-base-100 px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-base-content/55">
        {label}
      </p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${valueClass}`}>
        {value}
      </p>
    </div>
  );
}

export type CampaignDetailViewProps = {
  selectedCampaign: Campaign;
  tone: CampaignStatusTone;
  outcomeLine: string | null;
  channelLabel: string;
  statusLabel: string;
  mergedMetrics: ReturnType<typeof mergeReportWithProgress>;
  progress: CampaignProgress | null;
  progressLoading: boolean;
  completionPct: number | null;
  progressBarPercent: number | null;
  progressBarCaption: string | null;
  loading: boolean;
  handleAction: (
    action:
      | "start"
      | "pause"
      | "resume"
      | "cancel"
      | "drainQueue"
      | "duplicate"
      | "delete"
  ) => void | Promise<void>;
  onSaveSchedule: (payload: {
    scheduledAt: string | null;
    timezone: string;
  }) => void | Promise<void>;
  handleRename: () => void;
  loadProgress: () => void;
  runs: CampaignRun[];
  runsLoading: boolean;
  runJobs: CampaignRunJob[];
  runJobsLoading: boolean;
  selectedRunId: string | null;
  setSelectedRunId: (id: string | null) => void;
  loadRuns: () => void;
  loadRunJobs: () => void;
  reportLoading: boolean;
  reportError: string | null;
  fetchReport: () => void;
  hasSummaryCards: boolean;
  reportMetrics: ReturnType<typeof parseReportMetrics>;
  showRawReport: boolean;
  setShowRawReport: Dispatch<SetStateAction<boolean>>;
};

export function CampaignDetailView({
  selectedCampaign,
  tone,
  outcomeLine,
  channelLabel,
  statusLabel,
  mergedMetrics,
  progress,
  progressLoading,
  completionPct,
  progressBarPercent,
  progressBarCaption,
  loading,
  handleAction,
  onSaveSchedule,
  handleRename,
  loadProgress,
  runs,
  runsLoading,
  runJobs,
  runJobsLoading,
  selectedRunId,
  setSelectedRunId,
  loadRuns,
  loadRunJobs,
  reportLoading,
  reportError,
  fetchReport,
  hasSummaryCards,
  reportMetrics,
  showRawReport,
  setShowRawReport,
}: CampaignDetailViewProps) {
  const statusNorm = normalizeStatus(selectedCampaign.status);
  const canEditSchedule =
    statusNorm === "DRAFT" || statusNorm === "SCHEDULED";

  const [planAt, setPlanAt] = useState(() =>
    isoToDatetimeLocalValue(selectedCampaign.scheduledAt)
  );
  const [planTz, setPlanTz] = useState(
    () => selectedCampaign.timezone ?? "UTC"
  );

  useEffect(() => {
    setPlanAt(isoToDatetimeLocalValue(selectedCampaign.scheduledAt));
    setPlanTz(selectedCampaign.timezone ?? "UTC");
  }, [
    selectedCampaign.id,
    selectedCampaign.scheduledAt,
    selectedCampaign.timezone,
  ]);

  return (

          <>
            {/* Header + status hero */}
            <section className="flex flex-col gap-8">
              <header className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-base-content/45">
                  Campaign · {channelLabel}
                </p>
                <h1 className="text-3xl font-bold leading-tight tracking-tight text-base-content md:text-4xl">
                  {formatCampaignHeroTitle(selectedCampaign.name, 120)}
                </h1>
                {outcomeLine ? (
                  <p className="max-w-2xl text-lg font-medium leading-snug text-base-content/90">
                    {outcomeLine}
                  </p>
                ) : null}
              </header>

              <div className={`px-5 py-6 md:px-7 md:py-7 ${statusHeroClasses(tone)}`}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`badge ${statusBadgeClasses(tone)} gap-1 border-0 px-3 text-sm`}
                      >
                        {statusLabel}
                      </span>
                      {tone === "running" || progressLoading ? (
                        <span className="loading loading-spinner loading-md text-info" />
                      ) : null}
                    </div>
                    {(completionPct != null ||
                      (mergedMetrics.completed != null &&
                        mergedMetrics.totalJobs != null)) && (
                      <p className="text-base font-semibold text-base-content">
                        {completionPct != null ? (
                          <span className="text-success">{completionPct}%</span>
                        ) : null}
                        {completionPct != null &&
                        mergedMetrics.completed != null &&
                        mergedMetrics.totalJobs != null
                          ? " · "
                          : null}
                        {mergedMetrics.completed != null &&
                        mergedMetrics.totalJobs != null ? (
                          <span className="text-base-content/85">
                            {mergedMetrics.completed} / {mergedMetrics.totalJobs}{" "}
                            delivered
                          </span>
                        ) : null}
                      </p>
                    )}
                    {tone === "running" && progress ? (
                      <p className="text-sm text-base-content/75">
                        Run #{progress.runNumber ?? "—"}
                      </p>
                    ) : null}
                  </div>
                </div>

                {progressBarPercent != null && progressBarCaption ? (
                  <div className="mt-6">
                    <p className="mb-2 text-sm font-medium text-base-content/80">
                      {progressBarCaption}
                    </p>
                    <progress
                      className="progress progress-primary h-5 w-full max-w-2xl"
                      value={progressBarPercent}
                      max={100}
                    />
                  </div>
                ) : null}
              </div>

              {selectedCampaign.templateBindings &&
              typeof selectedCampaign.templateBindings === "object" ? (
                <div className="rounded-box border border-base-300 bg-base-100 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-base-content/50">
                    Template setup
                  </p>
                  <pre className="mt-2 max-h-40 overflow-auto rounded-box border border-base-300 bg-base-100 p-3 font-mono text-xs text-base-content/80">
                    {JSON.stringify(selectedCampaign.templateBindings, null, 2)}
                  </pre>
                </div>
              ) : null}

              {canEditSchedule ? (
                <div className="rounded-box border border-base-300 bg-base-100 px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-base-content/50">
                    Planned send
                  </p>
                  <p className="mt-1 text-xs text-base-content/60">
                    Set a future time to mark the campaign as scheduled. Sending
                    still starts when you press Start (there is no automatic send
                    at this time).
                  </p>
                  <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
                    <label className="form-control w-full min-w-0 sm:max-w-xs">
                      <span className="label-text text-xs text-base-content/70">
                        Date &amp; time
                      </span>
                      <input
                        type="datetime-local"
                        className="input input-bordered input-sm w-full"
                        value={planAt}
                        onChange={(e) => setPlanAt(e.target.value)}
                        disabled={loading}
                      />
                    </label>
                    <label className="form-control w-full min-w-0 sm:max-w-xs">
                      <span className="label-text text-xs text-base-content/70">
                        Timezone
                      </span>
                      <input
                        type="text"
                        className="input input-bordered input-sm w-full"
                        value={planTz}
                        onChange={(e) => setPlanTz(e.target.value)}
                        placeholder="e.g. America/New_York"
                        disabled={loading}
                      />
                    </label>
                    <div className="flex flex-wrap gap-2 pb-0.5">
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        disabled={loading || !planAt.trim()}
                        onClick={() =>
                          void onSaveSchedule({
                            scheduledAt: new Date(planAt).toISOString(),
                            timezone: planTz.trim() || "UTC",
                          })
                        }
                      >
                        Save plan
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        disabled={
                          loading ||
                          !selectedCampaign.scheduledAt
                        }
                        onClick={() =>
                          void onSaveSchedule({
                            scheduledAt: null,
                            timezone: planTz.trim() || "UTC",
                          })
                        }
                      >
                        Clear plan
                      </button>
                    </div>
                  </div>
                  {selectedCampaign.scheduledAt ? (
                    <p className="mt-2 text-xs text-base-content/55">
                      Stored:{" "}
                      {new Date(selectedCampaign.scheduledAt).toLocaleString(
                        undefined,
                        { timeZone: planTz || "UTC" }
                      )}{" "}
                      ({planTz || "UTC"})
                    </p>
                  ) : null}
                </div>
              ) : null}

              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  {showStart(selectedCampaign.status) ? (
                    <button
                      type="button"
                      className="btn btn-primary gap-1"
                      onClick={() => void handleAction("start")}
                      disabled={loading}
                    >
                      <span aria-hidden>▶</span> Start
                    </button>
                  ) : null}
                  {showResume(selectedCampaign.status) ? (
                    <button
                      type="button"
                      className="btn btn-secondary btn-outline gap-1"
                      onClick={() => void handleAction("resume")}
                      disabled={loading}
                    >
                      <span aria-hidden>↻</span> Resume
                    </button>
                  ) : null}
                  {showPause(selectedCampaign.status) ? (
                    <button
                      type="button"
                      className="btn btn-outline gap-1"
                      onClick={() => void handleAction("pause")}
                      disabled={loading}
                    >
                      <span aria-hidden>⏸</span> Pause
                    </button>
                  ) : null}
                  {showStopCampaign(selectedCampaign.status) ? (
                    <button
                      type="button"
                      className="btn btn-outline btn-error gap-1"
                      onClick={() => void handleAction("cancel")}
                      disabled={loading}
                    >
                      <span aria-hidden>✕</span> Cancel
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="btn btn-ghost gap-1"
                    onClick={() => void handleAction("duplicate")}
                    disabled={loading}
                  >
                    <span aria-hidden>⧉</span> Duplicate
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost gap-1"
                    onClick={() => void handleRename()}
                    disabled={loading}
                  >
                    <span aria-hidden>✎</span> Rename
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-error gap-1"
                    onClick={() => {
                      if (
                        window.confirm(
                          `Delete campaign "${selectedCampaign.name}"?`
                        )
                      ) {
                        void handleAction("delete");
                      }
                    }}
                    disabled={loading}
                  >
                    <span aria-hidden>🗑</span> Delete
                  </button>
                  {loading ? (
                    <span className="loading loading-spinner loading-sm" />
                  ) : null}
                </div>
                <button
                  type="button"
                  className="btn btn-outline btn-sm gap-1.5 sm:shrink-0"
                  onClick={() => void loadProgress()}
                  disabled={progressLoading}
                  aria-label="Sync latest progress from server"
                >
                  {progressLoading ? (
                    <span className="loading loading-spinner loading-xs" />
                  ) : (
                    <span aria-hidden className="text-base">
                      ↻
                    </span>
                  )}
                  Sync state
                </button>
              </div>

              {showStopCampaign(selectedCampaign.status) ||
              showDrainQueue(selectedCampaign.status) ? (
                <div className="w-full space-y-3 rounded-box border border-warning/25 bg-warning/5 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-base-content/60">
                    Cancel or clear queue
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {showStopCampaign(selectedCampaign.status) ? (
                      <div className="flex flex-col gap-2 rounded-box border border-base-300 bg-base-100 p-4">
                        <p className="text-sm font-semibold text-base-content">
                          Cancel campaign
                        </p>
                        <p className="text-xs leading-relaxed text-base-content/65">
                          Ends the active run, skips remaining recipients, and marks the
                          campaign as cancelled. Same as the Cancel button above.
                        </p>
                        <button
                          type="button"
                          className="btn btn-error btn-outline btn-sm mt-auto w-full sm:w-auto"
                          onClick={() => void handleAction("cancel")}
                          disabled={loading}
                        >
                          Cancel campaign
                        </button>
                      </div>
                    ) : null}
                    {showDrainQueue(selectedCampaign.status) ? (
                      <div className="flex flex-col gap-2 rounded-box border border-base-300 bg-base-100 p-4">
                        <p className="text-sm font-semibold text-base-content">
                          Clear send queue
                        </p>
                        <p className="text-xs leading-relaxed text-base-content/65">
                          Removes stuck jobs from the Redis send queue only. Does not
                          change the database — use after errors or if jobs are stuck
                          after a stop.
                        </p>
                        <button
                          type="button"
                          className="btn btn-outline btn-sm mt-auto w-full sm:w-auto"
                          onClick={() => void handleAction("drainQueue")}
                          disabled={loading}
                        >
                          Clear queue
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </section>

            <div className="divider my-0" />

            <section className="space-y-4">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold tracking-tight text-base-content">
                    Runs & jobs
                  </h2>
                  <p className="mt-1.5 text-sm text-base-content/70">
                    Operational visibility for each campaign run.
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    void loadRuns();
                    void loadRunJobs();
                  }}
                  disabled={runsLoading || runJobsLoading}
                >
                  Refresh
                </button>
              </div>

              <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
                <div className="rounded-box border border-base-300 bg-base-100 p-2">
                  {runsLoading ? (
                    <div className="flex justify-center py-4">
                      <span className="loading loading-spinner loading-sm" />
                    </div>
                  ) : runs.length ? (
                    <ul className="space-y-1">
                      {runs.map((run) => (
                        <li key={run.id}>
                          <button
                            type="button"
                            className={`w-full rounded-box border px-3 py-2 text-left ${
                              selectedRunId === run.id
                                ? "border-primary/40 bg-primary/10"
                                : "border-base-300 bg-base-100 hover:bg-base-200"
                            }`}
                            onClick={() => setSelectedRunId(run.id)}
                          >
                            <p className="text-sm font-medium">Run {run.id}</p>
                            <p className="text-xs text-base-content/65">
                              {run.status || "unknown"}
                            </p>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="p-3 text-sm text-base-content/65">No runs yet.</p>
                  )}
                </div>

                <div className="rounded-box border border-base-300 bg-base-100 p-3">
                  <h3 className="mb-2 text-sm font-medium">Run jobs</h3>
                  {runJobsLoading ? (
                    <div className="flex justify-center py-4">
                      <span className="loading loading-spinner loading-sm" />
                    </div>
                  ) : runJobs.length ? (
                    <div className="max-h-72 overflow-auto rounded-box border border-base-300">
                      <table className="table table-xs">
                        <thead>
                          <tr>
                            <th>Status</th>
                            <th>Contact</th>
                            <th className="w-[55%]">Reason</th>
                          </tr>
                        </thead>
                        <tbody>
                          {runJobs.map((j) => {
                            const status = (j.status || "unknown").toUpperCase();
                            const isPolicyBlocked =
                              (j.lastError || "").includes("Cannot send MARKETING template") ||
                              (j.lastError || "").includes("Meta policy");
                            const tone =
                              status === "FAILED"
                                ? "badge-error"
                                : status === "SKIPPED"
                                  ? isPolicyBlocked
                                    ? "badge-warning"
                                    : "badge-neutral"
                                  : status === "COMPLETED"
                                    ? "badge-success"
                                    : "badge-ghost";

                            return (
                              <tr key={j.id} className="align-top">
                                <td>
                                  <span className={`badge badge-sm ${tone}`}>
                                    {status}
                                  </span>
                                </td>
                                <td className="font-mono text-xs">
                                  {j.contactId}
                                </td>
                                <td className="text-xs text-base-content/80">
                                  {j.lastError ? (
                                    <span>{j.lastError}</span>
                                  ) : (
                                    <span className="text-base-content/50">—</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-sm text-base-content/65">
                      No jobs available for this run.
                    </p>
                  )}
                </div>
              </div>
            </section>

            <div className="divider my-0" />

            {/* Report — structured metrics */}
            <section className="flex flex-col gap-5">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold tracking-tight text-base-content">
                    Results &amp; delivery
                  </h2>
                  <p className="mt-1.5 text-sm text-base-content/70">
                    Per-send outcomes and volume for this campaign.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {reportLoading ? (
                    <span className="loading loading-spinner loading-sm" />
                  ) : null}
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => void fetchReport()}
                    disabled={reportLoading}
                  >
                    Refresh
                  </button>
                </div>
              </div>

              {reportError ? (
                <div role="alert" className="alert alert-warning">
                  <span>{reportError}</span>
                </div>
              ) : null}

              <>
                  {hasSummaryCards ? (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {mergedMetrics.totalJobs != null ? (
                        <MetricCard
                          label="Total jobs"
                          value={mergedMetrics.totalJobs}
                        />
                      ) : null}
                      {mergedMetrics.completed != null ? (
                        <MetricCard
                          label="Completed"
                          value={mergedMetrics.completed}
                          accent="success"
                        />
                      ) : null}
                      {mergedMetrics.failed != null ? (
                        <MetricCard
                          label="Failed"
                          value={mergedMetrics.failed}
                          accent={
                            mergedMetrics.failed > 0 ? "error" : "default"
                          }
                        />
                      ) : null}
                      {mergedMetrics.delivered != null ? (
                        <MetricCard
                          label="Delivered"
                          value={mergedMetrics.delivered}
                          accent="success"
                        />
                      ) : null}
                      {mergedMetrics.read != null ? (
                        <MetricCard label="Read" value={mergedMetrics.read} />
                      ) : null}
                      {mergedMetrics.messagesSent != null ? (
                        <MetricCard
                          label="Messages sent"
                          value={mergedMetrics.messagesSent}
                        />
                      ) : null}
                      {completionPct != null ? (
                        <MetricCard
                          label="Success rate"
                          value={`${completionPct}%`}
                          accent="success"
                        />
                      ) : null}
                    </div>
                  ) : !reportLoading ? (
                    <p className="text-sm text-base-content/70">
                      Totals will fill in as sends complete — use{" "}
                      <span className="font-medium">Sync state</span> for the
                      latest run.
                    </p>
                  ) : null}

                  {Object.keys(reportMetrics.extras).length > 0 ? (
                    <div className="rounded-box border border-base-300 bg-base-100 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => setShowRawReport((v) => !v)}
                        >
                          {showRawReport ? "Hide" : "View"} technical details
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => {
                            void navigator.clipboard.writeText(
                              formatReportValue(reportMetrics.extras)
                            );
                          }}
                        >
                          Copy
                        </button>
                      </div>
                      {showRawReport ? (
                        <pre className="mt-3 max-h-64 overflow-auto rounded-box border border-base-300 bg-base-100 p-3 font-mono text-xs leading-relaxed text-base-content/80">
                          {formatReportValue(reportMetrics.extras)}
                        </pre>
                      ) : null}
                    </div>
                  ) : null}
              </>
            </section>
          </>

  );
}

