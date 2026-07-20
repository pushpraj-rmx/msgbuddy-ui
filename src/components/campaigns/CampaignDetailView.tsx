"use client";

import type { Dispatch, SetStateAction } from "react";
import { useEffect, useState } from "react";
import type { ChannelTemplateVersion } from "@/lib/types";
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
  statusHeroClasses,
} from "@/lib/campaignUi";
import { CampaignReport } from "./CampaignReport";
import { CampaignFailuresPanel } from "./CampaignFailuresPanel";
import { ActivityFeed } from "@/components/activity/ActivityFeed";
import { CampaignReviewDialog } from "./CampaignReviewDialog";
import { StatusTag } from "@/components/ui/StatusTag";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

export type Campaign = {
  id: string;
  name: string;
  status: string;
  channel: string;
  channelTemplateVersionId?: string;
  channelTemplateVersion?: ChannelTemplateVersion | null;
  templateBindings?: Record<string, unknown> | null;
  scheduledAt?: string | null;
  timezone?: string;
  throttlePerMin?: number;
  /** null = inherit the workspace default. */
  failureHandling?: "MANUAL" | "AUTO_RETRY" | null;
};

type CampaignProgress = {
  progressPercent?: number;
  completedJobs?: number;
  totalJobs?: number;
  pendingJobs?: number;
  processingJobs?: number;
  failedJobs?: number;
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
  /** Auto-retry bookkeeping (campaign-retry-policy). */
  failureRound?: number;
  failureHandledAt?: string | null;
  nextRetryAt?: string | null;
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

/**
 * "Throttled at X/min — last send scheduled in ~Tm" hint. Returned only when
 * the run is actively delivering and there's a backlog the throttle will pace
 * out. Solves the "looks paused" UX: a campaign with throttle 60/min and 900
 * pending recipients has its last job delayed 15 min in BullMQ's `delayed`
 * set, which dashboards render as an empty/idle queue.
 */
function throttleHint(
  throttlePerMin: number | undefined,
  pendingJobs: number | undefined,
): string | null {
  if (!throttlePerMin || throttlePerMin <= 0) return null;
  if (!pendingJobs || pendingJobs <= 0) return null;
  const minutes = pendingJobs / throttlePerMin;
  let window: string;
  if (minutes < 1) {
    window = "<1m";
  } else if (minutes < 60) {
    window = `~${Math.ceil(minutes)}m`;
  } else {
    const h = Math.floor(minutes / 60);
    const m = Math.ceil(minutes - h * 60);
    window = m > 0 ? `~${h}h ${m}m` : `~${h}h`;
  }
  return `Throttled at ${throttlePerMin}/min · last send scheduled ${window} from start`;
}

function isoToDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const z = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`;
}

function formatReportValue(value: unknown): string {
  if (value === null || value === undefined) return "\u2014";
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

function formatLabel(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/^./, (s) => s.toUpperCase());
}

function isRunsArray(v: unknown): v is Record<string, unknown>[] {
  if (!Array.isArray(v) || v.length === 0) return false;
  const first = v[0];
  return (
    first &&
    typeof first === "object" &&
    ("runId" in first || "runNumber" in first || "totalJobs" in first)
  );
}

function RunsTable({ runs }: { runs: Record<string, unknown>[] }) {
  return (
    <div className="overflow-x-auto rounded-box border border-base-300">
      <table className="table table-xs">
        <thead>
          <tr className="border-base-300">
            <th>Run</th>
            <th>Status</th>
            <th className="text-right">Total</th>
            <th className="text-right" title="Messages accepted by WhatsApp for delivery. Delivery is confirmed separately — see the report's Delivered/Read.">Sent</th>
            <th className="text-right" title="Failed to send — WhatsApp never accepted the message (e.g. invalid number, template error). Distinct from 'failed to deliver' in the report.">Failed to send</th>
            <th className="text-right" title="Excluded before sending — opted out, blocked, or outside the messaging window.">Skipped</th>
            <th className="text-right">Rate</th>
            <th className="text-right">Duration</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run, i) => {
            const status = String(run.status ?? "\u2014");
            const statusOpTone: "success" | "danger" | "running" | "neutral" =
              status === "COMPLETED"
                ? "success"
                : status === "FAILED"
                  ? "danger"
                  : status === "RUNNING"
                    ? "running"
                    : "neutral";
            const dur =
              typeof run.durationMinutes === "number"
                ? run.durationMinutes < 1
                  ? "<1m"
                  : `${Math.round(run.durationMinutes)}m`
                : "\u2014";
            const rate =
              typeof run.successRate === "number"
                ? `${Math.round(run.successRate)}%`
                : "\u2014";
            return (
              <tr key={String(run.runId ?? i)} className="border-base-300">
                <td className="font-medium">
                  #{String(run.runNumber ?? i + 1)}
                </td>
                <td>
                  <StatusTag tone={statusOpTone}>{status}</StatusTag>
                </td>
                <td className="text-right tabular-nums">
                  {typeof run.totalJobs === "number"
                    ? run.totalJobs.toLocaleString()
                    : "\u2014"}
                </td>
                <td className="text-right tabular-nums">
                  {typeof run.completedJobs === "number"
                    ? run.completedJobs.toLocaleString()
                    : "\u2014"}
                </td>
                <td className="text-right tabular-nums">
                  {typeof run.failedJobs === "number"
                    ? run.failedJobs.toLocaleString()
                    : "\u2014"}
                </td>
                <td className="text-right tabular-nums">
                  {typeof run.skippedJobs === "number"
                    ? run.skippedJobs.toLocaleString()
                    : "\u2014"}
                </td>
                <td className="text-right tabular-nums">{rate}</td>
                <td className="text-right tabular-nums">{dur}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function TechnicalDetails({
  extras,
}: {
  extras: Record<string, unknown>;
}) {
  const runs = extras.runs;
  const scalarEntries: [string, unknown][] = [];
  const objectEntries: [string, unknown][] = [];

  for (const [key, val] of Object.entries(extras)) {
    if (key === "runs") continue;
    if (
      val === null ||
      val === undefined ||
      (typeof val === "string" && val.trim() === "")
    )
      continue;
    if (typeof val === "object" && !Array.isArray(val)) {
      objectEntries.push([key, val]);
    } else if (Array.isArray(val)) {
      objectEntries.push([key, val]);
    } else {
      scalarEntries.push([key, val]);
    }
  }

  return (
    <div className="space-y-4">
      {scalarEntries.length > 0 ? (
        <div className="overflow-x-auto rounded-box border border-base-300">
          <table className="table table-xs">
            <tbody>
              {scalarEntries.map(([key, val]) => (
                <tr key={key} className="border-base-300">
                  <td className="w-40 text-xs font-medium text-base-content/60">
                    {formatLabel(key)}
                  </td>
                  <td className="text-sm tabular-nums">
                    {formatReportValue(val)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {isRunsArray(runs) ? (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-base-content/50">
            Per-run breakdown
          </p>
          <RunsTable runs={runs} />
        </div>
      ) : null}

      {objectEntries.map(([key, val]) => (
        <div key={key}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-base-content/50">
            {formatLabel(key)}
          </p>
          <pre className="max-h-48 overflow-auto rounded-box border border-base-300 bg-base-100 p-3 font-mono text-xs leading-relaxed text-base-content/80">
            {formatReportValue(val)}
          </pre>
        </div>
      ))}
    </div>
  );
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
    <div className="card bg-base-100 border border-base-300 px-4 py-3">
      <p className="op-label">
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
  /**
   * Bulk-retry every FAILED job in the currently-selected run. Calls the
   * counter-reconciling endpoint, then refreshes progress + runs + report.
   */
  handleRetryFailed: () => void | Promise<void>;
  handleCreateFollowUp: (includeAll?: boolean) => void | Promise<void>;
  /**
   * Recover CampaignJob rows stranded in PROCESSING — the failure mode
   * where the DB and BullMQ have drifted and pause/resume can't unstick the
   * run. Visible to operators only when there's evidence of the bug
   * (active run with non-trivial processingJobs but stalled progress).
   */
  handleRecoverStuck: () => void | Promise<void>;
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
  failuresReloadToken: number;
  workspaceId?: string;
  meUserId?: string;
  loadRuns: () => void;
  loadRunJobs: () => void;
  reportLoading: boolean;
  reportError: string | null;
  fetchReport: () => void;
  hasSummaryCards: boolean;
  reportMetrics: ReturnType<typeof parseReportMetrics>;
  showRawReport: boolean;
  setShowRawReport: Dispatch<SetStateAction<boolean>>;
  /** Called when the review dialog successfully starts the campaign — parent should refresh list/progress/report. */
  onCampaignStarted: () => void | Promise<void>;
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
  handleRetryFailed,
  handleCreateFollowUp,
  handleRecoverStuck,
  onSaveSchedule,
  handleRename,
  loadProgress,
  runs,
  runsLoading,
  runJobs,
  runJobsLoading,
  selectedRunId,
  setSelectedRunId,
  failuresReloadToken,
  workspaceId,
  meUserId,
  loadRuns,
  loadRunJobs,
  reportLoading,
  reportError,
  fetchReport,
  hasSummaryCards,
  reportMetrics,
  showRawReport,
  setShowRawReport,
  onCampaignStarted,
}: CampaignDetailViewProps) {
  const statusNorm = normalizeStatus(selectedCampaign.status);
  const canEditSchedule =
    statusNorm === "DRAFT" || statusNorm === "SCHEDULED";

  const [activeTab, setActiveTab] = useState<"overview" | "report">("overview");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  /** "preview" — Preview button; "confirm-start" — Start button gated by confirm. */
  const [reviewMode, setReviewMode] = useState<
    "preview" | "confirm-start" | null
  >(null);
  const [planAt, setPlanAt] = useState(() =>
    isoToDatetimeLocalValue(selectedCampaign.scheduledAt)
  );
  const [planTz, setPlanTz] = useState(
    () => selectedCampaign.timezone ?? "UTC"
  );

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- syncs derived state when selected campaign changes; component doesn't remount */
    setPlanAt(isoToDatetimeLocalValue(selectedCampaign.scheduledAt));
    setPlanTz(selectedCampaign.timezone ?? "UTC");
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [
    selectedCampaign.id,
    selectedCampaign.scheduledAt,
    selectedCampaign.timezone,
  ]);

  return (
    <>
          <div className="flex flex-col gap-6">
            {/* Tabs */}
            <div role="tablist" className="tabs tabs-bordered">
              <button
                type="button"
                role="tab"
                className={`tab ${activeTab === "overview" ? "tab-active" : ""}`}
                onClick={() => setActiveTab("overview")}
              >
                Overview
              </button>
              <button
                type="button"
                role="tab"
                className={`tab ${activeTab === "report" ? "tab-active" : ""}`}
                onClick={() => setActiveTab("report")}
              >
                Report
              </button>
            </div>

            {activeTab === "report" ? (
              <CampaignReport campaignId={selectedCampaign.id} />
            ) : (
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
                      <StatusTag
                        tone={
                          tone === "success" ? "success" :
                          tone === "running" ? "running" :
                          tone === "warning" ? "warning" :
                          tone === "danger"  ? "danger"  : "neutral"
                        }
                      >
                        {statusLabel}
                      </StatusTag>
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
                  <div className="mt-6 max-w-2xl">
                    <p className="mb-2 text-sm font-medium text-base-content/80">
                      {progressBarCaption}
                    </p>
                    <div className="h-2 w-full overflow-hidden rounded-sm bg-base-300">
                      <div
                        className="h-full bg-primary transition-[width] duration-300"
                        style={{ width: `${Math.min(100, Math.max(0, progressBarPercent))}%` }}
                      />
                    </div>
                    <div className="font-mono-op mt-1.5 text-[0.625rem] tracking-[0.04em] text-base-content/45 tabular-nums">
                      {Math.round(progressBarPercent)}%
                    </div>
                  </div>
                ) : null}

                {tone === "running"
                  ? (() => {
                      const hint = throttleHint(
                        selectedCampaign.throttlePerMin,
                        progress?.pendingJobs,
                      );
                      return hint ? (
                        <p className="mt-3 text-xs text-base-content/65">
                          {hint}. Sends look idle while jobs wait their turn —
                          this isn&apos;t a pause.
                        </p>
                      ) : null;
                    })()
                  : null}
              </div>


              {canEditSchedule ? (
                <div className="card bg-base-100 border border-base-300 px-4 py-4">
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
                      onClick={() => setReviewMode("confirm-start")}
                      disabled={loading}
                    >
                      <span aria-hidden>▶</span> Start
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="btn btn-ghost gap-1"
                    onClick={() => setReviewMode("preview")}
                    disabled={loading}
                    title="Preview audience + message without starting"
                  >
                    Preview
                  </button>
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
                  {(mergedMetrics.failed ?? 0) > 0 &&
                  !showResume(selectedCampaign.status) ? (
                    <button
                      type="button"
                      className="btn btn-secondary btn-outline gap-1"
                      onClick={() => void handleRetryFailed()}
                      disabled={loading}
                      title={`Re-attempts this run's failures — both failed to send (never accepted) and failed to deliver (accepted, then a receipt reported failure). Permanent failures (invalid number, opted out, template rejected) are skipped because they'd fail again. See "Failed recipients" below for the breakdown.`}
                    >
                      <span aria-hidden>↻</span> Retry failed (
                      {mergedMetrics.failed})
                    </button>
                  ) : null}
                  {(mergedMetrics.failed ?? 0) > 0 ? (
                    <button
                      type="button"
                      className="btn btn-outline gap-1"
                      onClick={() => void handleCreateFollowUp()}
                      disabled={loading}
                      title="Stage the failed contacts into a new DRAFT campaign with the same message — edit the audience/message freely, nothing is sent until you start it. Permanent failures are left out (see the Failed recipients panel to include them)."
                    >
                      <span aria-hidden>⎘</span> Follow-up campaign
                    </button>
                  ) : null}
                  {tone === "running" && (progress?.processingJobs ?? 0) > 0 ? (
                    <button
                      type="button"
                      className="btn btn-warning btn-outline gap-1"
                      onClick={() => void handleRecoverStuck()}
                      disabled={loading}
                      title="Reset jobs stranded in PROCESSING (worker crash, Redis eviction) back to PENDING and re-queue them. Use when progress is stalled but the run won't complete."
                    >
                      <span aria-hidden>⚠</span> Recover stuck (
                      {progress?.processingJobs})
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
                    onClick={() => setShowDeleteConfirm(true)}
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

              {(progress?.totalJobs ?? 0) > 0 || runs.length > 0 ? (
                <CampaignFailuresPanel
                  campaignId={selectedCampaign.id}
                  runId={selectedRunId}
                  reloadToken={failuresReloadToken}
                  onRetry={handleRetryFailed}
                  canRetry={!showResume(selectedCampaign.status)}
                  onCreateFollowUp={handleCreateFollowUp}
                  autoRetry={{
                    setting: selectedCampaign.failureHandling ?? null,
                    run: (() => {
                      const r =
                        runs.find((x) => x.id === selectedRunId) ?? runs[0];
                      return r
                        ? {
                            failureRound: r.failureRound ?? 0,
                            nextRetryAt: r.nextRetryAt ?? null,
                            failureHandledAt: r.failureHandledAt ?? null,
                          }
                        : null;
                    })(),
                  }}
                />
              ) : null}

              {(progress?.totalJobs ?? 0) > 0 || runs.length > 0 ? (
                <div className="card bg-base-100 border border-base-300 p-4">
                  <p className="mb-2 text-sm font-medium">Activity</p>
                  <ActivityFeed
                    resource="campaign"
                    resourceId={selectedCampaign.id}
                    workspaceId={workspaceId}
                    meUserId={meUserId}
                    pageSize={15}
                    compact
                    reloadToken={failuresReloadToken}
                  />
                </div>
              ) : null}

              {showStopCampaign(selectedCampaign.status) ||
              showDrainQueue(selectedCampaign.status) ? (
                <div className="w-full space-y-3 rounded-box border border-warning/25 bg-warning/5 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-base-content/60">
                    Cancel or clear queue
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {showStopCampaign(selectedCampaign.status) ? (
                      <div className="flex flex-col gap-2 card bg-base-100 border border-base-300 p-4">
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
                      <div className="flex flex-col gap-2 card bg-base-100 border border-base-300 p-4">
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
                <div className="card bg-base-100 border border-base-300 p-2">
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

                <div className="card bg-base-100 border border-base-300 p-3">
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
                            const opTone: "danger" | "warning" | "neutral" | "success" =
                              status === "FAILED"
                                ? "danger"
                                : status === "SKIPPED"
                                  ? isPolicyBlocked
                                    ? "warning"
                                    : "neutral"
                                  : status === "COMPLETED"
                                    ? "success"
                                    : "neutral";

                            return (
                              <tr key={j.id} className="align-top">
                                <td>
                                  <StatusTag tone={opTone}>{status}</StatusTag>
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
                <div role="alert" className="rounded-box border border-warning/30 border-l-2 border-l-warning bg-base-200 px-4 py-3">
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
                    <div className="card bg-base-100 border border-base-300 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
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
                          Copy JSON
                        </button>
                      </div>
                      {showRawReport ? (
                        <div className="mt-3">
                          <TechnicalDetails extras={reportMetrics.extras} />
                        </div>
                      ) : null}
                    </div>
                  ) : null}
              </>
            </section>
          </>
            )}
          </div>
      <ConfirmDialog
        open={showDeleteConfirm}
        title="Delete campaign"
        description={`Permanently delete "${selectedCampaign.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        tone="danger"
        loading={loading}
        onConfirm={() => { void handleAction("delete"); setShowDeleteConfirm(false); }}
        onClose={() => setShowDeleteConfirm(false)}
      />
      {reviewMode ? (
        <CampaignReviewDialog
          campaignId={selectedCampaign.id}
          campaignName={selectedCampaign.name}
          mode={reviewMode}
          onClose={() => setReviewMode(null)}
          onStarted={() => {
            void onCampaignStarted();
          }}
        />
      ) : null}
    </>
  );
}

