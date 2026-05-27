"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getApiError } from "@/lib/api-error";
import { analyticsApi, campaignsApi } from "@/lib/api";
import {
  campaignOutcomeLine,
  campaignRunSummaryLine,
  campaignStatusTone,
  completionPercent,
  formatCampaignListTitle,
  mergeReportWithProgress,
  parseReportMetrics,
  statusDotClasses,
} from "@/lib/campaignUi";
import { useMediaQuery, LG_MEDIA_QUERY } from "@/hooks/useMediaQuery";
import { useRightPanel } from "@/components/right-panel/useRightPanel";
import {
  parseWorkspaceSseEvent,
  isCampaignRunProgress,
  isCampaignRunStarted,
  isCampaignRunCompleted,
  isCampaignRunPaused,
  isCampaignRunResumed,
  isCampaignRunCancelled,
} from "@/lib/sseEvents";
import { CampaignDetailView } from "./CampaignDetailView";
import { CampaignMetaSidebar } from "./CampaignMetaSidebar";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

export type Campaign = {
  id: string;
  name: string;
  status: string;
  channel: string;
  channelTemplateVersionId?: string;
  channelTemplateVersion?: import("@/lib/types").ChannelTemplateVersion | null;
  /** Backend: header media, staticVariables, carouselCardMediaIds */
  templateBindings?: Record<string, unknown> | null;
  scheduledAt?: string | null;
  timezone?: string;
  throttlePerMin?: number;
  updatedAt?: string;
  runs?: { totalJobs?: number; completedJobs?: number; failedJobs?: number; skippedJobs?: number; successRate?: number }[];
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

export function CampaignsClient({
  initialCampaigns,
  workspaceId,
}: {
  initialCampaigns: Campaign[];
  workspaceId: string;
}) {
  const searchParams = useSearchParams();
  const [campaigns, setCampaigns] = useState<Campaign[]>(initialCampaigns);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<"cancel" | "drainQueue" | "rename" | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [progress, setProgress] = useState<CampaignProgress | null>(null);
  const [progressLoading, setProgressLoading] = useState(false);
  const [report, setReport] = useState<Record<string, unknown> | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [showRawReport, setShowRawReport] = useState(false);
  const [runs, setRuns] = useState<CampaignRun[]>([]);
  const [runsLoading, setRunsLoading] = useState(false);
  const [runJobs, setRunJobs] = useState<CampaignRunJob[]>([]);
  const [runJobsLoading, setRunJobsLoading] = useState(false);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  const selectedCampaign = useMemo(
    () => campaigns.find((campaign) => campaign.id === selectedId) ?? null,
    [campaigns, selectedId]
  );

  const selectedIdRef = useRef<string | null>(null);
  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

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

  const refresh = useCallback(async () => {
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
  }, []);

  // Honour ?id= deep-link from inbox "View campaign →" links.
  useEffect(() => {
    const id = searchParams.get("id");
    if (id && campaigns.some((c) => c.id === id)) {
      setSelectedId(id);
    }
  }, [campaigns, searchParams]);

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
      )) as CampaignRunJob[];
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

  // SSE: live campaign progress updates
  useEffect(() => {
    if (!workspaceId) return;
    let cancelled = false;
    let source: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let retries = 0;

    const connect = () => {
      if (cancelled) return;
      source = new EventSource(`/api/sse/workspace/${workspaceId}`);
      source.onopen = () => { retries = 0; };
      source.onmessage = (event) => {
        const ev = parseWorkspaceSseEvent(event.data);
        if (!ev) return;

        const campaignId = typeof ev.data.campaignId === "string" ? ev.data.campaignId : null;

        if (isCampaignRunProgress(ev.type) && campaignId) {
          // Skip events for non-selected campaigns — otherwise an active
          // campaign's progress overwrites the stats of an old campaign the
          // user is currently viewing.
          if (campaignId !== selectedIdRef.current) return;
          setProgress((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              totalJobs: typeof ev.data.totalJobs === "number" ? ev.data.totalJobs : prev.totalJobs,
              completedJobs: typeof ev.data.completedJobs === "number" ? ev.data.completedJobs : prev.completedJobs,
              failedJobs: typeof ev.data.failedJobs === "number" ? ev.data.failedJobs : prev.failedJobs,
              progressPercent:
                typeof ev.data.totalJobs === "number" && ev.data.totalJobs > 0
                  ? Math.round(
                      (((ev.data.completedJobs as number) +
                        (ev.data.failedJobs as number) +
                        (ev.data.skippedJobs as number)) /
                        ev.data.totalJobs) *
                        100
                    )
                  : prev.progressPercent,
            };
          });
          return;
        }

        if (
          isCampaignRunStarted(ev.type) ||
          isCampaignRunCompleted(ev.type) ||
          isCampaignRunPaused(ev.type) ||
          isCampaignRunResumed(ev.type) ||
          isCampaignRunCancelled(ev.type)
        ) {
          // State change — re-fetch everything for accuracy
          void loadProgress();
          void loadRuns();
          void refresh();
          return;
        }
      };
      source.onerror = () => {
        source?.close();
        if (!cancelled) {
          const delay = Math.min(1000 * 2 ** retries, 30000);
          retries++;
          retryTimer = setTimeout(connect, delay);
        }
      };
    };

    connect();
    return () => {
      cancelled = true;
      source?.close();
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [workspaceId, loadProgress, loadRuns, refresh]);

  const handleAction = useCallback(
    async (
      action:
        | "start"
        | "pause"
        | "resume"
        | "cancel"
        | "drainQueue"
        | "duplicate"
        | "delete"
    ) => {
      if (!selectedCampaign) return;
      if (action === "cancel" || action === "drainQueue") {
        setConfirmAction(action);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        if (action === "start") await campaignsApi.start(selectedCampaign.id);
        if (action === "pause") await campaignsApi.pause(selectedCampaign.id);
        if (action === "resume") await campaignsApi.resume(selectedCampaign.id);
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
    },
    [selectedCampaign, refresh, loadProgress, fetchReport, loadRuns, loadRunJobs]
  );

  const handleRetryFailed = useCallback(async () => {
    if (!selectedCampaign) return;
    setLoading(true);
    setError(null);
    try {
      const result = await campaignsApi.retryFailed(
        selectedCampaign.id,
        selectedRunId ?? undefined,
      );
      if (result.retriedCount === 0) {
        window.alert("No failed jobs to retry in this run.");
      } else {
        window.alert(
          `Re-queued ${result.retriedCount} failed job${result.retriedCount === 1 ? "" : "s"}.`,
        );
      }
      await refresh();
      await loadProgress();
      await fetchReport();
      await loadRuns();
      await loadRunJobs();
    } catch (err: unknown) {
      setError(getApiError(err) || "Failed to retry failed jobs.");
    } finally {
      setLoading(false);
    }
  }, [
    selectedCampaign,
    selectedRunId,
    refresh,
    loadProgress,
    fetchReport,
    loadRuns,
    loadRunJobs,
  ]);

  /**
   * Recover CampaignJob rows stranded in PROCESSING. Hits the backend
   * recover-stuck endpoint, surfaces the count, refreshes UI state.
   */
  const handleRecoverStuck = useCallback(async () => {
    if (!selectedCampaign) return;
    setLoading(true);
    setError(null);
    try {
      const result = await campaignsApi.recoverStuck(selectedCampaign.id);
      if (result.recoveredCount === 0) {
        window.alert(
          "No stuck jobs found. If the run still isn't completing, check the worker logs for stalled jobs.",
        );
      } else {
        window.alert(
          `Recovered ${result.recoveredCount} stuck job${result.recoveredCount === 1 ? "" : "s"} and re-queued ${result.enqueuedCount} for delivery.`,
        );
      }
      await refresh();
      await loadProgress();
      await fetchReport();
      await loadRuns();
      await loadRunJobs();
    } catch (err: unknown) {
      setError(getApiError(err) || "Failed to recover stuck jobs.");
    } finally {
      setLoading(false);
    }
  }, [
    selectedCampaign,
    refresh,
    loadProgress,
    fetchReport,
    loadRuns,
    loadRunJobs,
  ]);

  const handleSaveSchedule = useCallback(
    async (payload: { scheduledAt: string | null; timezone: string }) => {
      if (!selectedCampaign) return;
      setLoading(true);
      setError(null);
      try {
        await campaignsApi.update(selectedCampaign.id, {
          scheduledAt: payload.scheduledAt,
          timezone: payload.timezone || "UTC",
        });
        await refresh();
      } catch (err: unknown) {
        setError(getApiError(err) || "Failed to update schedule.");
      } finally {
        setLoading(false);
      }
    },
    [selectedCampaign, refresh]
  );

  const handleRename = useCallback(() => {
    if (!selectedCampaign) return;
    setConfirmAction("rename");
  }, [selectedCampaign]);

  const handleConfirmAction = useCallback(async (promptValue?: string) => {
    if (!selectedCampaign || !confirmAction) return;
    setConfirmBusy(true);
    setError(null);
    try {
      if (confirmAction === "cancel") {
        await campaignsApi.cancel(selectedCampaign.id);
        await refresh();
        await loadProgress();
      } else if (confirmAction === "drainQueue") {
        const r = await campaignsApi.drainQueue(selectedCampaign.id);
        window.alert(`Removed ${r.removedFromQueue} job(s) from the queue.`);
      } else if (confirmAction === "rename") {
        const nextName = promptValue?.trim();
        if (nextName && nextName !== selectedCampaign.name) {
          await campaignsApi.update(selectedCampaign.id, { name: nextName });
          await refresh();
        }
      }
      setConfirmAction(null);
    } catch (err: unknown) {
      setError(getApiError(err) || "Action failed.");
    } finally {
      setConfirmBusy(false);
    }
  }, [selectedCampaign, confirmAction, refresh, loadProgress]);

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

  const { setContent: setRightPanelContent, clearContent: clearRightPanelContent } =
    useRightPanel();
  const isLgUp = useMediaQuery(LG_MEDIA_QUERY);

  const campaignDetailPanel = useMemo(() => {
    if (!selectedCampaign) return null;
    return (
      <CampaignDetailView
        selectedCampaign={selectedCampaign}
        tone={tone}
        outcomeLine={outcomeLine}
        channelLabel={channelLabel}
        statusLabel={statusLabel}
        mergedMetrics={mergedMetrics}
        progress={progress}
        progressLoading={progressLoading}
        completionPct={completionPct}
        progressBarPercent={progressBarPercent}
        progressBarCaption={progressBarCaption}
        loading={loading}
        handleAction={handleAction}
        handleRetryFailed={handleRetryFailed}
        handleRecoverStuck={handleRecoverStuck}
        onSaveSchedule={handleSaveSchedule}
        handleRename={handleRename}
        loadProgress={loadProgress}
        runs={runs}
        runsLoading={runsLoading}
        runJobs={runJobs}
        runJobsLoading={runJobsLoading}
        selectedRunId={selectedRunId}
        setSelectedRunId={setSelectedRunId}
        loadRuns={loadRuns}
        loadRunJobs={loadRunJobs}
        reportLoading={reportLoading}
        reportError={reportError}
        fetchReport={fetchReport}
        hasSummaryCards={hasSummaryCards}
        reportMetrics={reportMetrics}
        showRawReport={showRawReport}
        setShowRawReport={setShowRawReport}
        onCampaignStarted={async () => {
          await refresh();
          await loadProgress();
          await fetchReport();
          await loadRuns();
          await loadRunJobs();
        }}
      />
    );
  }, [
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
    handleRecoverStuck,
    handleSaveSchedule,
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
    refresh,
  ]);

  const campaignMetaPanel = useMemo(() => {
    if (!selectedCampaign) return null;
    return (
      <CampaignMetaSidebar
        status={statusLabel}
        channel={channelLabel}
        tone={tone}
        runs={runs}
        mergedMetrics={mergedMetrics}
        templateVersion={selectedCampaign.channelTemplateVersion}
      />
    );
  }, [selectedCampaign, statusLabel, channelLabel, tone, runs, mergedMetrics]);

  useEffect(() => {
    if (!selectedCampaign) {
      clearRightPanelContent("campaigns");
      return;
    }
    setRightPanelContent({
      source: "campaigns",
      title: formatCampaignListTitle(selectedCampaign.name),
      openAfter: true,
      content: campaignMetaPanel,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps -- only open panel on new campaign selection
  }, [selectedId, clearRightPanelContent, setRightPanelContent]);

  // Update panel content silently when data changes (progress, runs, etc.)
  useEffect(() => {
    if (!selectedCampaign) return;
    setRightPanelContent({
      source: "campaigns",
      title: formatCampaignListTitle(selectedCampaign.name),
      content: campaignMetaPanel,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps -- silent update, no openAfter
  }, [campaignMetaPanel, setRightPanelContent]);

  useEffect(() => {
    return () => clearRightPanelContent("campaigns");
  }, [clearRightPanelContent]);

  return (
    <div className="flex h-full min-h-0 gap-0">
      <aside className="flex w-64 shrink-0 flex-col gap-5 overflow-y-auto border-r border-base-300 pr-4 lg:w-72 lg:pr-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold tracking-tight text-base-content">
            Campaigns
          </h2>
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={refresh}
            >
              Refresh
            </button>
            <Link href="/campaigns/new" className="btn btn-primary btn-sm">
              New campaign
            </Link>
          </div>
        </div>

        {error ? (
          <div role="alert" className="rounded-box border border-error/30 border-l-2 border-l-error bg-base-200 px-3 py-2 text-sm">
            <span>{error}</span>
          </div>
        ) : null}

        <div className="flex flex-col gap-2">
          {campaigns.map((campaign) => {
            const active = campaign.id === selectedId;
            const rowTone = campaignStatusTone(campaign.status);
            const latestRun = campaign.runs?.[0];
            const summaryLine = campaignRunSummaryLine(rowTone, latestRun);
            return (
              <button
                key={campaign.id}
                type="button"
                onClick={() => setSelectedId(campaign.id)}
                className={`group flex w-full flex-col gap-2 rounded-box border px-3 py-3 text-left transition-all ${
                  active
                    ? "border-base-300 bg-base-200 ring-1 ring-base-300"
                    : "border-base-300 bg-base-100 hover:bg-base-200"
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
                    {summaryLine ? (
                      <p className="mt-0.5 text-xs tabular-nums text-base-content/55">
                        {summaryLine}
                      </p>
                    ) : null}
                    {rowTone === "running" && latestRun?.totalJobs ? (
                      <div className="mt-2 h-1 w-full overflow-hidden rounded-sm bg-base-300">
                        <div
                          className="h-full bg-primary transition-[width] duration-300"
                          style={{ width: `${Math.min(100, Math.round(((latestRun.completedJobs ?? 0) / (latestRun.totalJobs ?? 1)) * 100))}%` }}
                        />
                      </div>
                    ) : null}
                    {campaign.status === "DRAFT" ? (
                      <Link
                        href={`/campaigns/${encodeURIComponent(campaign.id)}/edit`}
                        onClick={(e) => e.stopPropagation()}
                        className="mt-1.5 inline-block text-xs text-primary hover:underline"
                        title="Resume editing this draft"
                      >
                        Continue editing →
                      </Link>
                    ) : null}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {!campaigns.length ? (
          <p className="text-sm text-base-content/65">No campaigns yet.</p>
        ) : null}
      </aside>

      {/* Main content: campaign detail */}
      <div className="min-w-0 flex-1 overflow-y-auto pl-4 lg:pl-6">
        {selectedCampaign ? (
          campaignDetailPanel
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-base-content/50">
            Select a campaign to view details
          </div>
        )}
      </div>
      <ConfirmDialog
        open={confirmAction === "cancel"}
        title="Stop campaign"
        description="Remaining sends will be skipped and the campaign will be marked cancelled. Already-delivered messages are not affected."
        confirmLabel="Stop campaign"
        tone="danger"
        loading={confirmBusy}
        onConfirm={() => handleConfirmAction()}
        onClose={() => setConfirmAction(null)}
      />
      <ConfirmDialog
        open={confirmAction === "drainQueue"}
        title="Drain queue"
        description="Clear stuck jobs from the send queue. This only removes jobs in Redis and does not update campaign status. Use 'Stop campaign' to end the run."
        confirmLabel="Drain queue"
        tone="warning"
        loading={confirmBusy}
        onConfirm={() => handleConfirmAction()}
        onClose={() => setConfirmAction(null)}
      />
      <ConfirmDialog
        open={confirmAction === "rename"}
        title="Rename campaign"
        description="Enter a new name for this campaign."
        confirmLabel="Save"
        tone="primary"
        loading={confirmBusy}
        promptLabel="Campaign name"
        promptPlaceholder={selectedCampaign?.name}
        onConfirm={handleConfirmAction}
        onClose={() => setConfirmAction(null)}
      />
    </div>
  );
}
