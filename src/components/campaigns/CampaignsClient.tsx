"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  analyticsApi,
  campaignsApi,
  contactsApi,
  channelTemplatesApi,
} from "@/lib/api";
import type { ChannelTemplateVersion } from "@/lib/types";
import {
  campaignOutcomeLine,
  campaignStatusTone,
  completionPercent,
  formatCampaignListTitle,
  mergeReportWithProgress,
  parseReportMetrics,
  showCancel,
  showPause,
  showResume,
  showStart,
  statusDotClasses,
} from "@/lib/campaignUi";
import {
  isMediaHeaderType,
  uploadMediaRowIdAndPrepareWhatsApp,
} from "@/lib/whatsappTemplateMedia";
import { useRightPanel } from "@/components/right-panel/useRightPanel";
import { CampaignDetailView } from "./CampaignDetailView";

export type Campaign = {
  id: string;
  name: string;
  status: string;
  channel: string;
  channelTemplateVersionId?: string;
  /** Backend: header media, staticVariables, carouselCardMediaIds */
  templateBindings?: Record<string, unknown> | null;
};

export type Template = {
  id: string;
  name: string;
  channelTemplates?: Array<{
    id: string;
    channel: string;
    deletedAt?: string | null;
  }>;
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

/** Matches API CampaignAudienceType (SEGMENT needs audienceQuery — use API for now). */
const AUDIENCE_TYPES = ["ALL", "SPECIFIC", "SEGMENT"] as const;

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
  const [runJobs, setRunJobs] = useState<CampaignRunJob[]>([]);
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
  const [channelTemplateVersionId, setChannelTemplateVersionId] = useState("");
  const [channelWaTemplateId, setChannelWaTemplateId] = useState<string | null>(
    null
  );
  const [versionDetail, setVersionDetail] = useState<ChannelTemplateVersion | null>(
    null
  );
  const [versionDetailLoading, setVersionDetailLoading] = useState(false);
  const [headerMediaId, setHeaderMediaId] = useState<string | null>(null);
  const [carouselCardMediaIds, setCarouselCardMediaIds] = useState<string[]>(
    []
  );
  const [staticVariablesText, setStaticVariablesText] = useState("{}");
  const [bindingUploadBusy, setBindingUploadBusy] = useState(false);
  const [bindingFieldError, setBindingFieldError] = useState<string | null>(
    null
  );

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

  const canUseSelectedTemplate =
    !!templateId && channelTemplateVersionId.trim().length > 0;

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

  const openWizard = async () => {
    setWizardOpen(true);
    setStep(1);
    setSelectedContacts([]);
    setChannelTemplateVersionId("");
    setChannelWaTemplateId(null);
    setVersionDetail(null);
    setHeaderMediaId(null);
    setCarouselCardMediaIds([]);
    setStaticVariablesText("{}");
    setBindingFieldError(null);
    if (!contacts.length) {
      const data = await contactsApi.list({});
      setContacts(data.contacts ?? []);
    }
  };

  useEffect(() => {
    if (!wizardOpen || !templateId) {
      setChannelWaTemplateId(null);
      return;
    }
    const tpl = templates.find((t) => t.id === templateId) ?? null;
    const wa = (tpl?.channelTemplates ?? []).find(
      (ct) => ct.channel === "WHATSAPP" && !ct.deletedAt
    );
    setChannelWaTemplateId(wa?.id ?? null);
    if (!wa?.id) {
      setChannelTemplateVersionId("");
      return;
    }
    let cancelled = false;
    void channelTemplatesApi
      .state(wa.id)
      .then((state) => {
        if (cancelled) return;
        const v = state.activeVersion ?? state.latestSendableVersion;
        setChannelTemplateVersionId(v?.id ?? "");
      })
      .catch(() => {
        if (cancelled) return;
        setChannelTemplateVersionId("");
      });
    return () => {
      cancelled = true;
    };
  }, [wizardOpen, templateId, templates]);

  useEffect(() => {
    if (
      !wizardOpen ||
      !channelWaTemplateId ||
      !channelTemplateVersionId.trim()
    ) {
      setVersionDetail(null);
      return;
    }
    let cancelled = false;
    setVersionDetailLoading(true);
    void channelTemplatesApi
      .listVersions(channelWaTemplateId)
      .then((versions) => {
        if (cancelled) return;
        const v = versions.find((x) => x.id === channelTemplateVersionId);
        setVersionDetail(v ?? null);
      })
      .catch(() => {
        if (cancelled) return;
        setVersionDetail(null);
      })
      .finally(() => {
        if (!cancelled) setVersionDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [wizardOpen, channelWaTemplateId, channelTemplateVersionId]);

  useEffect(() => {
    const cards = versionDetail?.carouselCards;
    if (versionDetail?.layoutType === "CAROUSEL" && Array.isArray(cards)) {
      const n = cards.length;
      setCarouselCardMediaIds((prev) => {
        if (prev.length === n) return prev;
        return Array.from({ length: n }, (_, i) => prev[i] ?? "");
      });
    } else {
      setCarouselCardMediaIds([]);
    }
  }, [versionDetail]);

  const needsHeaderMedia =
    versionDetail != null && isMediaHeaderType(versionDetail.headerType);
  const carouselCardCount =
    versionDetail?.layoutType === "CAROUSEL" &&
    Array.isArray(versionDetail.carouselCards)
      ? versionDetail.carouselCards.length
      : 0;
  const bindingsStepReady =
    !versionDetailLoading &&
    versionDetail != null &&
    (!needsHeaderMedia || !!headerMediaId?.trim()) &&
    (carouselCardCount === 0 ||
      (carouselCardMediaIds.length >= carouselCardCount &&
        carouselCardMediaIds
          .slice(0, carouselCardCount)
          .every((id) => String(id ?? "").trim().length > 0)));

  const createCampaign = async () => {
    if (!templateId || !channelTemplateVersionId.trim()) {
      setError("Pick a message and provide a channelTemplateVersionId.");
      return;
    }
    if (audienceType === "SPECIFIC" && selectedContacts.length === 0) {
      setError("Select at least one contact, or choose audience “All contacts”.");
      return;
    }
    if (audienceType === "SEGMENT") {
      setError(
        "Segment campaigns need an audience query. Create via API or choose “All contacts” / “Selected contacts”."
      );
      return;
    }
    let staticVariables: Record<string, string> | undefined;
    const trimmedStatic = staticVariablesText.trim();
    if (trimmedStatic && trimmedStatic !== "{}") {
      try {
        const parsed = JSON.parse(trimmedStatic) as unknown;
        if (
          typeof parsed !== "object" ||
          parsed === null ||
          Array.isArray(parsed)
        ) {
          setError("Static variables must be a JSON object, e.g. {\"code\":\"SAVE\"}.");
          return;
        }
        staticVariables = Object.fromEntries(
          Object.entries(parsed as Record<string, unknown>).filter(
            ([, v]) => typeof v === "string"
          ) as [string, string][]
        );
      } catch {
        setError("Static variables must be valid JSON.");
        return;
      }
    }
    if (!bindingsStepReady) {
      setError("Upload required template media (header or carousel cards) before creating.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const friendlyName = `Campaign · ${new Date().toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })}`;
      const templateBindings: Record<string, unknown> = {};
      if (headerMediaId?.trim()) templateBindings.headerMediaId = headerMediaId.trim();
      if (carouselCardCount > 0) {
        templateBindings.carouselCardMediaIds = carouselCardMediaIds
          .slice(0, carouselCardCount)
          .map((id) => id.trim());
      }
      if (staticVariables && Object.keys(staticVariables).length > 0) {
        templateBindings.staticVariables = staticVariables;
      }
      await campaignsApi.create({
        name: friendlyName,
        channel: "WHATSAPP",
        channelTemplateVersionId: channelTemplateVersionId.trim(),
        ...(Object.keys(templateBindings).length > 0 && {
          templateBindings,
        }),
        audienceType,
        contactIds:
          audienceType === "SPECIFIC" ? selectedContacts : undefined,
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
    },
    [selectedCampaign, refresh, loadProgress, fetchReport, loadRuns, loadRunJobs]
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

  useEffect(() => {
    if (!selectedCampaign) {
      clearRightPanelContent("campaigns");
      return;
    }
    setRightPanelContent({
      source: "campaigns",
      title: formatCampaignListTitle(selectedCampaign.name),
      openAfter: true,
      content: campaignDetailPanel,
    });
  }, [
    selectedCampaign,
    campaignDetailPanel,
    clearRightPanelContent,
    setRightPanelContent,
  ]);

  useEffect(() => {
    return () => clearRightPanelContent("campaigns");
  }, [clearRightPanelContent]);

  return (
    <div className="flex max-w-md flex-col gap-6 lg:max-w-[min(100%,420px)]">
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

        <button
          type="button"
          className="btn btn-primary w-full"
          onClick={openWizard}
        >
          New campaign
        </button>
      </aside>


      {wizardOpen && (
        <dialog open className="modal modal-middle">
          <div className="modal-box">
            <h3 className="text-lg font-semibold">Create campaign</h3>
            <div className="mt-4 space-y-4">
              {step === 1 && (
                <div className="space-y-2">
                  <p className="text-sm text-base-content/60">
                    Step 1: Choose a message (WhatsApp)
                  </p>
                  <select
                    className="select select-bordered w-full"
                    value={templateId || ""}
                    onChange={(event) => setTemplateId(event.target.value || null)}
                  >
                    <option value="">Select a message</option>
                    {templates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name}
                      </option>
                    ))}
                  </select>
                  {templateId && !canUseSelectedTemplate && (
                    <div role="alert" className="alert alert-warning alert-soft text-sm">
                      <span>
                        No approved WhatsApp version available yet.
                      </span>
                    </div>
                  )}
                </div>
              )}
              {step === 2 && (
                <div className="space-y-3">
                  <p className="text-sm text-base-content/60">
                    Step 2: Template media & variables
                  </p>
                  {versionDetailLoading ? (
                    <div className="flex items-center gap-2 text-sm text-base-content/70">
                      <span className="loading loading-spinner loading-sm" />
                      Loading template details…
                    </div>
                  ) : !versionDetail ? (
                    <div role="alert" className="alert alert-warning alert-soft text-sm">
                      <span>
                        Could not load template version. Go back and re-select a
                        message.
                      </span>
                    </div>
                  ) : (
                    <>
                      {needsHeaderMedia ? (
                        <div className="rounded-box border border-base-300 bg-base-100 p-3">
                          <p className="text-sm font-medium text-base-content">
                            Header media ({versionDetail.headerType})
                          </p>
                          <p className="mt-1 text-xs text-base-content/60">
                            Upload an image, video, or document. It is sent to
                            WhatsApp and linked to this campaign for every
                            recipient.
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <input
                              type="file"
                              className="file-input file-input-bordered file-input-sm w-full max-w-xs"
                              accept={
                                versionDetail.headerType === "VIDEO"
                                  ? "video/mp4,video/3gpp"
                                  : versionDetail.headerType === "DOCUMENT"
                                    ? "application/pdf,application/*"
                                    : "image/jpeg,image/png,image/webp,image/gif"
                              }
                              disabled={bindingUploadBusy}
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                e.target.value = "";
                                if (!file) return;
                                setBindingFieldError(null);
                                setBindingUploadBusy(true);
                                try {
                                  const id =
                                    await uploadMediaRowIdAndPrepareWhatsApp(
                                      file
                                    );
                                  setHeaderMediaId(id);
                                } catch (err: unknown) {
                                  setBindingFieldError(
                                    getApiError(err) ||
                                      "Upload failed. Try a smaller file or supported format."
                                  );
                                } finally {
                                  setBindingUploadBusy(false);
                                }
                              }}
                            />
                            {headerMediaId ? (
                              <span className="badge badge-success badge-outline">
                                Ready
                              </span>
                            ) : (
                              <span className="text-xs text-warning">
                                Required
                              </span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-base-content/55">
                          This template has no media header (text or none only).
                        </p>
                      )}

                      {carouselCardCount > 0 ? (
                        <div className="space-y-2">
                          <p className="text-sm font-medium text-base-content">
                            Carousel cards ({carouselCardCount})
                          </p>
                          <p className="text-xs text-base-content/60">
                            Each card needs header media uploaded for WhatsApp.
                          </p>
                          {Array.from(
                            { length: carouselCardCount },
                            (_, idx) => (
                              <div
                                key={idx}
                                className="rounded-box border border-base-300 bg-base-100 p-3"
                              >
                                <p className="text-xs font-medium text-base-content/80">
                                  Card {idx + 1}
                                </p>
                                <input
                                  type="file"
                                  className="file-input file-input-bordered file-input-sm mt-2 w-full max-w-xs"
                                  accept="image/jpeg,image/png,image/webp,video/mp4,video/3gpp"
                                  disabled={bindingUploadBusy}
                                  onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    e.target.value = "";
                                    if (!file) return;
                                    setBindingFieldError(null);
                                    setBindingUploadBusy(true);
                                    try {
                                      const id =
                                        await uploadMediaRowIdAndPrepareWhatsApp(
                                          file
                                        );
                                      setCarouselCardMediaIds((prev) => {
                                        const next = [...prev];
                                        next[idx] = id;
                                        return next;
                                      });
                                    } catch (err: unknown) {
                                      setBindingFieldError(
                                        getApiError(err) ||
                                          "Upload failed for this card."
                                      );
                                    } finally {
                                      setBindingUploadBusy(false);
                                    }
                                  }}
                                />
                                {carouselCardMediaIds[idx] ? (
                                  <span className="mt-1 inline-block text-xs text-success">
                                    Uploaded
                                  </span>
                                ) : null}
                              </div>
                            )
                          )}
                        </div>
                      ) : null}

                      <div className="space-y-1">
                        <label className="text-sm font-medium text-base-content">
                          Static variables (optional JSON)
                        </label>
                        <textarea
                          className="textarea textarea-bordered w-full font-mono text-xs"
                          rows={4}
                          placeholder='{"promo_code":"SUMMER"}'
                          value={staticVariablesText}
                          onChange={(e) => setStaticVariablesText(e.target.value)}
                        />
                        <p className="text-xs text-base-content/55">
                          Keys must match this template&apos;s placeholders (body,
                          header text, buttons, carousel). The server only applies
                          keys the template uses; extras are ignored. Same value for
                          every recipient; contact data overrides when both set.
                          String values only.
                        </p>
                      </div>

                      {bindingFieldError ? (
                        <div role="alert" className="alert alert-error text-sm">
                          {bindingFieldError}
                        </div>
                      ) : null}
                    </>
                  )}
                </div>
              )}
              {step === 3 && (
                <div className="space-y-2">
                  <p className="text-sm text-base-content/60">
                    Step 3: Choose an audience
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
                        {type === "ALL"
                          ? "All contacts"
                          : type === "SPECIFIC"
                            ? "Selected contacts"
                            : "Segment (API only)"}
                      </option>
                    ))}
                  </select>
                  {audienceType === "SPECIFIC" && (
                    <div className="max-h-48 overflow-y-auto rounded-box border border-base-300 bg-base-100 p-2">
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
                  {audienceType === "SEGMENT" ? (
                    <p className="text-xs text-warning">
                      Segment audiences require a saved query. Create this
                      campaign with the API or pick another audience.
                    </p>
                  ) : null}
                </div>
              )}
              {step === 4 && (
                <div className="space-y-2">
                  <p className="text-sm text-base-content/60">
                    Step 4: Schedule
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
              {step < 4 && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setStep((prev) => prev + 1)}
                  disabled={
                    (step === 1 &&
                      (!templateId || !canUseSelectedTemplate)) ||
                    (step === 2 && !bindingsStepReady) ||
                    (step === 3 &&
                      audienceType === "SPECIFIC" &&
                      selectedContacts.length === 0) ||
                    (step === 3 && audienceType === "SEGMENT")
                  }
                >
                  Next
                </button>
              )}
              {step === 4 && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={createCampaign}
                  disabled={loading}
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
