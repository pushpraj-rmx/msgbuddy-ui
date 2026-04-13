"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getApiError } from "@/lib/api-error";
import { analyticsApi, campaignsApi } from "@/lib/api";
import {
  campaignOutcomeLine,
  campaignStatusTone,
  completionPercent,
  formatCampaignListTitle,
  mergeReportWithProgress,
  parseReportMetrics,
  statusDotClasses,
} from "@/lib/campaignUi";
import { useMediaQuery, XL_MEDIA_QUERY } from "@/hooks/useMediaQuery";
import { useRightPanel } from "@/components/right-panel/useRightPanel";
import { CampaignDetailView } from "./CampaignDetailView";
import { CampaignMetaSidebar } from "./CampaignMetaSidebar";

export type Campaign = {
  id: string;
  name: string;
  status: string;
  channel: string;
  channelTemplateVersionId?: string;
  /** Backend: header media, staticVariables, carouselCardMediaIds */
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

export function CampaignsClient({
  initialCampaigns,
}: {
  initialCampaigns: Campaign[];
}) {
  const searchParams = useSearchParams();
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
  const [runJobs, setRunJobs] = useState<CampaignRunJob[]>([]);
  const [runJobsLoading, setRunJobsLoading] = useState(false);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

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
      if (action === "cancel") {
        const ok = window.confirm(
          "Stop this campaign? Remaining sends will be skipped and the campaign will be marked cancelled."
        );
        if (!ok) return;
      }
      if (action === "drainQueue") {
        const ok = window.confirm(
          "Clear stuck jobs from the send queue? This only removes jobs in Redis and does not update campaign status. Use “Stop campaign” to end the run in the database."
        );
        if (!ok) return;
      }
      setLoading(true);
      setError(null);
      try {
        if (action === "start") await campaignsApi.start(selectedCampaign.id);
        if (action === "pause") await campaignsApi.pause(selectedCampaign.id);
        if (action === "resume") await campaignsApi.resume(selectedCampaign.id);
        if (action === "cancel") await campaignsApi.cancel(selectedCampaign.id);
        if (action === "drainQueue") {
          const r = await campaignsApi.drainQueue(selectedCampaign.id);
          window.alert(
            `Removed ${r.removedFromQueue} job(s) from the queue.`
          );
        }
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

  const handleRename = useCallback(async () => {
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
  }, [selectedCampaign, refresh]);

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
  const isXlUp = useMediaQuery(XL_MEDIA_QUERY);

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
      openAfter: isXlUp,
      content: campaignMetaPanel,
    });
  }, [
    selectedCampaign,
    campaignMetaPanel,
    clearRightPanelContent,
    setRightPanelContent,
    isXlUp,
  ]);

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
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {!campaigns.length ? (
          <p className="text-sm text-base-content/65">No campaigns yet.</p>
        ) : null}

        <Link href="/campaigns/new" className="btn btn-primary w-full">
          New campaign
        </Link>
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
    </div>
  );
}
