"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLatestApprovedVersion } from "@/hooks/use-templates";
import { analyticsApi, campaignsApi, contactsApi } from "@/lib/api";
import {
  campaignOutcomeLine,
  campaignStatusTone,
  completionPercent,
  formatCampaignHeroTitle,
  formatCampaignListTitle,
  mergeReportWithProgress,
  parseReportMetrics,
  showCancel,
  showPause,
  showResume,
  showStart,
  statusBadgeClasses,
  statusDotClasses,
  statusHeroClasses,
} from "@/lib/campaignUi";

export type Campaign = {
  id: string;
  name: string;
  status: string;
  channel: string;
  templateId?: string;
  templateVersion?: number;
};

export type Template = {
  id: string;
  name: string;
  channel: string;
};

type Contact = {
  id: string;
  name?: string;
  phone: string;
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

const AUDIENCE_TYPES = ["ALL", "CONTACTS", "QUERY"] as const;

function getApiError(err: unknown): string {
  return (err as { response?: { data?: { message?: string } } })?.response
    ?.data?.message ?? "Something went wrong.";
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
    <div className="rounded-box border border-base-300/60 bg-base-100 px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-base-content/55">
        {label}
      </p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${valueClass}`}>
        {value}
      </p>
    </div>
  );
}

export function CampaignsClient({
  initialCampaigns,
  templates,
}: {
  initialCampaigns: Campaign[];
  templates: Template[];
}) {
  const [campaigns, setCampaigns] = useState<Campaign[]>(initialCampaigns);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialCampaigns[0]?.id ?? null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<CampaignProgress | null>(null);
  const [progressLoading, setProgressLoading] = useState(false);
  const [report, setReport] = useState<Record<string, unknown> | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [showRawReport, setShowRawReport] = useState(false);
  const [runs, setRuns] = useState<CampaignRun[]>([]);
  const [runsLoading, setRunsLoading] = useState(false);
  const [runJobs, setRunJobs] = useState<Record<string, unknown>[]>([]);
  const [runJobsLoading, setRunJobsLoading] = useState(false);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  const [step, setStep] = useState(1);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [audienceType, setAudienceType] =
    useState<(typeof AUDIENCE_TYPES)[number]>("ALL");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [scheduledAt, setScheduledAt] = useState("");
  const [timezone, setTimezone] = useState("UTC");

  const selectedCampaign = useMemo(
    () => campaigns.find((campaign) => campaign.id === selectedId) ?? null,
    [campaigns, selectedId]
  );

  const reportMetrics = useMemo(() => parseReportMetrics(report), [report]);
  const mergedMetrics = useMemo(
    () => mergeReportWithProgress(reportMetrics, progress),
    [reportMetrics, progress]
  );
  const completionPct = useMemo(
    () => completionPercent(mergedMetrics),
    [mergedMetrics]
  );
  const tone = selectedCampaign
    ? campaignStatusTone(selectedCampaign.status)
    : "neutral";

  const { data: latestApproved, isLoading: latestApprovedLoading } =
    useLatestApprovedVersion(templateId, { enabled: !!templateId && wizardOpen });
  const canUseSelectedTemplate = !!latestApproved?.version;

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = (await campaignsApi.list()) as Campaign[];
      setCampaigns(data);
      setSelectedId((current) => current ?? data[0]?.id ?? null);
    } catch (err: unknown) {
      setError(getApiError(err) || "Failed to load campaigns.");
    } finally {
      setLoading(false);
    }
  };

  const openWizard = async () => {
    setWizardOpen(true);
    setStep(1);
    setSelectedContacts([]);
    if (!contacts.length) {
      const data = await contactsApi.list({});
      setContacts(data.contacts ?? []);
    }
  };

  const createCampaign = async () => {
    if (!templateId || !latestApproved?.version) {
      setError("Template must be provider-approved before use in campaigns.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const friendlyName = `Campaign · ${new Date().toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })}`;
      await campaignsApi.create({
        name: friendlyName,
        channel: templates.find((tpl) => tpl.id === templateId)?.channel,
        templateId,
        templateVersion: latestApproved.version,
        audienceType,
        contactIds: audienceType === "CONTACTS" ? selectedContacts : undefined,
        scheduledAt: scheduledAt || undefined,
        timezone,
      });
      await refresh();
      setWizardOpen(false);
    } catch (err: unknown) {
      setError(getApiError(err) || "Failed to create campaign.");
    } finally {
      setLoading(false);
    }
  };

  const loadProgress = useCallback(async () => {
    if (!selectedCampaign) return;
    setProgressLoading(true);
    try {
      const data = await campaignsApi.progress(selectedCampaign.id);
      setProgress(data);
    } catch {
      setProgress(null);
    } finally {
      setProgressLoading(false);
    }
  }, [selectedCampaign]);

  useEffect(() => {
    if (!selectedCampaign) {
      setProgress(null);
      return;
    }
    void loadProgress();
  }, [selectedCampaign, loadProgress]);

  const fetchReport = useCallback(async () => {
    if (!selectedCampaign) return;
    setReportLoading(true);
    setReportError(null);
    try {
      const data = await analyticsApi.campaignReport(selectedCampaign.id);
      if (data && typeof data === "object" && !Array.isArray(data)) {
        setReport(data as Record<string, unknown>);
      } else {
        setReport({ value: data });
      }
    } catch (err: unknown) {
      setReportError(getApiError(err) || "Failed to load campaign report.");
      setReport(null);
    } finally {
      setReportLoading(false);
    }
  }, [selectedCampaign]);

  const loadRuns = useCallback(async () => {
    if (!selectedCampaign) {
      setRuns([]);
      setSelectedRunId(null);
      return;
    }
    setRunsLoading(true);
    try {
      const data = (await campaignsApi.runs(selectedCampaign.id)) as CampaignRun[];
      setRuns(Array.isArray(data) ? data : []);
      setSelectedRunId((prev) => prev ?? data?.[0]?.id ?? null);
    } catch {
      setRuns([]);
      setSelectedRunId(null);
    } finally {
      setRunsLoading(false);
    }
  }, [selectedCampaign]);

  const loadRunJobs = useCallback(async () => {
    if (!selectedCampaign || !selectedRunId) {
      setRunJobs([]);
      return;
    }
    setRunJobsLoading(true);
    try {
      const data = (await campaignsApi.runJobs(
        selectedCampaign.id,
        selectedRunId
      )) as Record<string, unknown>[];
      setRunJobs(Array.isArray(data) ? data : []);
    } catch {
      setRunJobs([]);
    } finally {
      setRunJobsLoading(false);
    }
  }, [selectedCampaign, selectedRunId]);

  useEffect(() => {
    void fetchReport();
  }, [fetchReport]);

  useEffect(() => {
    void loadRuns();
  }, [loadRuns]);

  useEffect(() => {
    void loadRunJobs();
  }, [loadRunJobs]);

  const handleAction = async (
    action: "start" | "pause" | "resume" | "cancel" | "duplicate" | "delete"
  ) => {
    if (!selectedCampaign) return;
    setLoading(true);
    setError(null);
    try {
      if (action === "start") await campaignsApi.start(selectedCampaign.id);
      if (action === "pause") await campaignsApi.pause(selectedCampaign.id);
      if (action === "resume") await campaignsApi.resume(selectedCampaign.id);
      if (action === "cancel") await campaignsApi.cancel(selectedCampaign.id);
      if (action === "duplicate") await campaignsApi.duplicate(selectedCampaign.id);
      if (action === "delete") await campaignsApi.remove(selectedCampaign.id);
      await refresh();
      await loadProgress();
      await fetchReport();
      await loadRuns();
      await loadRunJobs();
    } catch (err: unknown) {
      setError(getApiError(err) || "Campaign action failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleRename = async () => {
    if (!selectedCampaign) return;
    const nextName = window.prompt("Campaign name", selectedCampaign.name)?.trim();
    if (!nextName || nextName === selectedCampaign.name) return;
    setLoading(true);
    setError(null);
    try {
      await campaignsApi.update(selectedCampaign.id, { name: nextName });
      await refresh();
    } catch (err: unknown) {
      setError(getApiError(err) || "Failed to update campaign.");
    } finally {
      setLoading(false);
    }
  };

  const progressBarPercent = useMemo(() => {
    const p = completionPercent(mergedMetrics);
    if (p != null) return p;
    if (progress?.progressPercent != null) return progress.progressPercent;
    if (
      mergedMetrics.totalJobs &&
      mergedMetrics.totalJobs > 0 &&
      mergedMetrics.completed != null
    ) {
      return Math.min(
        100,
        Math.round(
          (mergedMetrics.completed / mergedMetrics.totalJobs) * 100
        )
      );
    }
    return null;
  }, [mergedMetrics, progress]);

  const outcomeLine = selectedCampaign
    ? campaignOutcomeLine(tone, mergedMetrics, progress)
    : null;

  const progressBarCaption = useMemo(() => {
    if (progressBarPercent == null) return null;
    const total = mergedMetrics.totalJobs ?? progress?.totalJobs;
    const done = mergedMetrics.completed ?? progress?.completedJobs;
    if (total != null && done != null) {
      return `Progress: ${progressBarPercent}% (${done} / ${total} jobs)`;
    }
    return `Progress: ${progressBarPercent}%`;
  }, [progressBarPercent, mergedMetrics, progress]);

  const hasSummaryCards = useMemo(() => {
    return (
      mergedMetrics.totalJobs != null ||
      mergedMetrics.completed != null ||
      mergedMetrics.failed != null ||
      mergedMetrics.delivered != null ||
      mergedMetrics.read != null ||
      mergedMetrics.messagesSent != null ||
      completionPct != null
    );
  }, [mergedMetrics, completionPct]);

  const statusLabel = selectedCampaign?.status ?? "";
  const channelLabel = selectedCampaign?.channel ?? "";

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(280px,340px)_1fr] lg:gap-10">
      {/* Control panel */}
      <aside className="flex flex-col gap-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold tracking-tight text-base-content">
            Campaigns
          </h2>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={refresh}
          >
            Refresh
          </button>
        </div>

        {error ? (
          <div role="alert" className="alert alert-error text-sm">
            <span>{error}</span>
          </div>
        ) : null}

        <div className="flex flex-col gap-2">
          {campaigns.map((campaign) => {
            const active = campaign.id === selectedId;
            const rowTone = campaignStatusTone(campaign.status);
            return (
              <button
                key={campaign.id}
                type="button"
                onClick={() => setSelectedId(campaign.id)}
                className={`group flex w-full flex-col gap-2 rounded-box border px-3 py-3 text-left transition-all ${
                  active
                    ? "border-primary/45 bg-primary/[0.08] shadow-sm ring-1 ring-primary/20"
                    : "border-base-300/55 bg-base-100 hover:border-base-300 hover:bg-base-200/90 hover:shadow-sm"
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <span
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${statusDotClasses(rowTone)}`}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <span className="text-sm font-semibold leading-snug text-base-content">
                      {formatCampaignListTitle(campaign.name)}
                    </span>
                    <p className="mt-1 text-xs text-base-content/70">
                      {campaign.channel} · {campaign.status}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {!campaigns.length ? (
          <p className="text-sm text-base-content/65">No campaigns yet.</p>
        ) : null}

        <button
          type="button"
          className="btn btn-primary w-full"
          onClick={openWizard}
        >
          New campaign
        </button>
      </aside>

      {/* Focused view */}
      <main className="flex min-w-0 flex-col gap-10">
        {!selectedCampaign ? (
          <div className="rounded-box border border-dashed border-base-300 bg-base-100/50 px-6 py-16 text-center">
            <p className="text-lg font-medium text-base-content">
              Select a campaign
            </p>
            <p className="mt-2 text-sm text-base-content/65">
              Choose one on the left to see status, actions, and delivery metrics.
            </p>
          </div>
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
                  {showCancel(selectedCampaign.status) ? (
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
                            className={`w-full rounded-lg border px-3 py-2 text-left ${
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
                    <pre className="max-h-72 overflow-auto rounded-lg border border-base-300 p-3 text-xs">
                      {JSON.stringify(runJobs, null, 2)}
                    </pre>
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
                    <div className="rounded-box border border-base-300/40 bg-base-200/30 p-4">
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
                        <pre className="mt-3 max-h-64 overflow-auto rounded-box border border-base-300/60 bg-base-100 p-3 font-mono text-xs leading-relaxed text-base-content/90">
                          {formatReportValue(reportMetrics.extras)}
                        </pre>
                      ) : null}
                    </div>
                  ) : null}
              </>
            </section>
          </>
        )}
      </main>

      {wizardOpen && (
        <dialog open className="modal modal-middle">
          <div className="modal-box">
            <h3 className="text-lg font-semibold">Create campaign</h3>
            <div className="mt-4 space-y-4">
              {step === 1 && (
                <div className="space-y-2">
                  <p className="text-sm text-base-content/60">
                    Step 1: Choose a template (provider-approved only)
                  </p>
                  <select
                    className="select select-bordered w-full"
                    value={templateId || ""}
                    onChange={(event) => setTemplateId(event.target.value || null)}
                  >
                    <option value="">Select a template</option>
                    {templates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name}
                      </option>
                    ))}
                  </select>
                  {templateId && latestApprovedLoading && (
                    <p className="text-sm text-base-content/60">
                      Checking approved version…
                    </p>
                  )}
                  {templateId && !latestApprovedLoading && !canUseSelectedTemplate && (
                    <div role="alert" className="alert alert-warning alert-soft text-sm">
                      <span>
                        This template has no provider-approved version. Approve
                        and sync a version in Templates first.
                      </span>
                    </div>
                  )}
                  {templateId && canUseSelectedTemplate && (
                    <p className="text-sm text-success">
                      Using version {latestApproved?.version} (provider-approved).
                    </p>
                  )}
                </div>
              )}
              {step === 2 && (
                <div className="space-y-2">
                  <p className="text-sm text-base-content/60">
                    Step 2: Choose an audience
                  </p>
                  <select
                    className="select select-bordered w-full"
                    value={audienceType}
                    onChange={(event) =>
                      setAudienceType(
                        event.target.value as (typeof AUDIENCE_TYPES)[number]
                      )
                    }
                  >
                    {AUDIENCE_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                  {audienceType === "CONTACTS" && (
                    <div className="max-h-48 overflow-y-auto rounded-xl border border-base-300 bg-base-100 p-2">
                      {contacts.map((contact) => (
                        <label
                          key={contact.id}
                          className="flex items-center gap-2 py-1 text-sm"
                        >
                          <input
                            type="checkbox"
                            className="checkbox checkbox-sm"
                            checked={selectedContacts.includes(contact.id)}
                            onChange={(event) => {
                              setSelectedContacts((prev) =>
                                event.target.checked
                                  ? [...prev, contact.id]
                                  : prev.filter((id) => id !== contact.id)
                              );
                            }}
                          />
                          <span>
                            {contact.name || contact.phone} ({contact.phone})
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {step === 3 && (
                <div className="space-y-2">
                  <p className="text-sm text-base-content/60">
                    Step 3: Schedule
                  </p>
                  <input
                    type="datetime-local"
                    className="input input-bordered w-full"
                    value={scheduledAt}
                    onChange={(event) => setScheduledAt(event.target.value)}
                  />
                  <input
                    type="text"
                    className="input input-bordered w-full"
                    value={timezone}
                    onChange={(event) => setTimezone(event.target.value)}
                    placeholder="Timezone (e.g. America/New_York)"
                  />
                </div>
              )}
            </div>
            <div className="modal-action">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setWizardOpen(false)}
              >
                Cancel
              </button>
              {step > 1 && (
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setStep((prev) => prev - 1)}
                >
                  Back
                </button>
              )}
              {step < 3 && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setStep((prev) => prev + 1)}
                  disabled={
                    step === 1 &&
                    (!templateId || !canUseSelectedTemplate || latestApprovedLoading)
                  }
                >
                  Next
                </button>
              )}
              {step === 3 && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={createCampaign}
                >
                  Create
                </button>
              )}
            </div>
          </div>
        </dialog>
      )}
    </div>
  );
}
