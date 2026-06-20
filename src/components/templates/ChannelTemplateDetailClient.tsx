"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useChannelTemplateState,
  channelTemplateKeys,
  useChannelTemplateVersions,
  useChannelTemplateVersion,
  useCreateChannelTemplateVersion,
  useActivateChannelTemplateVersion,
  useSubmitChannelTemplateVersion,
  useApproveChannelTemplateVersion,
  useRejectChannelTemplateVersion,
  useArchiveChannelTemplateVersion,
  useSyncChannelTemplateVersion,
  useRefreshChannelTemplateProviderState,
  useUpdateChannelTemplate,
  useTemplate,
  useUpdateTemplate,
} from "@/hooks/use-templates";
import type {
  ChannelTemplateVersion,
  ChannelTemplateVersionPayload,
  TemplateQualityRating,
  TemplateVersionStatus,
} from "@/lib/types";
import { normalizeQualityRating } from "@/lib/types";
import { channelTemplateRequirementHref } from "@/lib/site";
import {
  parseWorkspaceSseEvent,
  isChannelTemplateStatusChanged,
  isChannelTemplateCategoryPending,
  isChannelTemplateQualityChanged,
  isWhatsAppAccountRestriction,
} from "@/lib/sseEvents";
import {
  ChannelTemplateVersionEditor,
  type ChannelTemplateVersionEditorHandle,
} from "./ChannelTemplateVersionEditor";
import { resolveMediaUrlForUi } from "@/lib/mediaUrls";
import { getApiError } from "@/lib/api-error";
import { StatusTag } from "@/components/ui/StatusTag";


function statusLabel(status: TemplateVersionStatus): string {
  switch (status) {
    case "DRAFT": return "Draft";
    case "PENDING": return "Internal review";
    case "APPROVED": return "Approved internally";
    case "REJECTED": return "Rejected internally";
    case "PROVIDER_PENDING": return "Awaiting Meta approval";
    case "PROVIDER_APPROVED": return "Live on WhatsApp";
    case "PROVIDER_REJECTED": return "Rejected by Meta";
    case "PROVIDER_PAUSED": return "Paused by Meta";
    case "PROVIDER_DISABLED": return "Disabled by Meta";
    case "PROVIDER_IN_APPEAL": return "Appeal in review with Meta";
    default: return status;
  }
}

function statusBadge(status: TemplateVersionStatus) {
  const tone: "success" | "warning" | "info" | "danger" | "neutral" =
    status === "PROVIDER_APPROVED"
      ? "success"
      : status === "PENDING" || status === "PROVIDER_PENDING" || status === "PROVIDER_IN_APPEAL"
        ? "warning"
        : status === "APPROVED"
          ? "info"
          : status === "REJECTED" || status === "PROVIDER_REJECTED" || status === "PROVIDER_DISABLED"
            ? "danger"
            : status === "PROVIDER_PAUSED"
              ? "warning"
              : "neutral";
  return <StatusTag tone={tone}>{statusLabel(status)}</StatusTag>;
}

function qualityLabel(q: TemplateQualityRating): string {
  switch (q) {
    case "GREEN": return "High quality";
    case "YELLOW": return "Medium quality";
    case "RED": return "Low quality";
    case "UNKNOWN": return "Quality pending";
  }
}

function QualityBadge({
  qualityScore,
  lastQualityCheckAt,
}: {
  qualityScore?: string | null;
  lastQualityCheckAt?: string | null;
}) {
  // Meta only reports quality once a template has been live and received some traffic.
  // Don't render anything if we've never fetched it.
  if (qualityScore == null && lastQualityCheckAt == null) return null;
  const rating = normalizeQualityRating(qualityScore);
  const tone: "success" | "warning" | "danger" | "neutral" =
    rating === "GREEN"
      ? "success"
      : rating === "YELLOW"
        ? "warning"
        : rating === "RED"
          ? "danger"
          : "neutral";
  return (
    <span
      title={
        lastQualityCheckAt
          ? `Meta quality · checked ${new Date(lastQualityCheckAt).toLocaleString()}`
          : "Meta quality rating"
      }
    >
      <StatusTag tone={tone}>Quality · {qualityLabel(rating)}</StatusTag>
    </span>
  );
}

const WA_STEPS: { key: TemplateVersionStatus | string; label: string }[] = [
  { key: "DRAFT", label: "Draft" },
  { key: "PENDING", label: "Internal review" },
  { key: "APPROVED", label: "Approved" },
  { key: "PROVIDER_PENDING", label: "Meta review" },
  { key: "PROVIDER_APPROVED", label: "Live" },
];

function waStepIndex(status: TemplateVersionStatus): { index: number; failed: boolean } {
  switch (status) {
    case "DRAFT": return { index: 0, failed: false };
    case "PENDING": return { index: 1, failed: false };
    case "APPROVED": return { index: 2, failed: false };
    case "PROVIDER_PENDING": return { index: 3, failed: false };
    case "PROVIDER_APPROVED": return { index: 4, failed: false };
    case "REJECTED": return { index: 1, failed: true };
    case "PROVIDER_REJECTED": return { index: 3, failed: true };
    default: return { index: 0, failed: false };
  }
}

function VersionWorkflowStepper({ status }: { status: TemplateVersionStatus }) {
  const { index: current, failed } = waStepIndex(status);
  return (
    <div className="flex items-center gap-0 text-xs w-full overflow-x-auto pb-1">
      {WA_STEPS.map((step, i) => {
        const done = i < current;
        const active = i === current;
        const isFailed = active && failed;
        return (
          <div key={step.key} className="flex items-center min-w-0">
            <div className="flex flex-col items-center gap-0.5 min-w-[56px]">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs transition-colors ${
                  isFailed
                    ? "bg-error text-error-content"
                    : done
                      ? "bg-success text-success-content"
                      : active
                        ? "bg-primary text-primary-content"
                        : "bg-base-300 text-base-content/40"
                }`}
              >
                {isFailed ? "✕" : done ? "✓" : i + 1}
              </div>
              <span
                className={`text-center leading-tight ${
                  isFailed
                    ? "text-error font-medium"
                    : active
                      ? "text-primary font-medium"
                      : done
                        ? "text-success"
                        : "text-base-content/40"
                }`}
              >
                {step.label}
              </span>
            </div>
            {i < WA_STEPS.length - 1 && (
              <div
                className={`h-0.5 flex-1 min-w-[12px] mx-1 rounded transition-colors ${
                  i < current ? "bg-success" : "bg-base-300"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function previewText(s: string | null | undefined, max = 160) {
  if (s == null || !String(s).trim()) return "—";
  const t = String(s).trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

/** URL or data-URL suitable for <img src> */
function isRenderableHeaderImageUrl(s: string | null | undefined): boolean {
  if (!s || typeof s !== "string") return false;
  const t = s.trim();
  if (t.startsWith("http://") || t.startsWith("https://")) return true;
  if (t.startsWith("data:image/")) return true;
  return false;
}

function VersionCardHeaderStrip({
  headerType,
  headerContent,
  headerPreviewUrl,
}: {
  headerType: string | null | undefined;
  headerContent: string | null | undefined;
  headerPreviewUrl?: string | null | undefined;
}) {
  const [imgError, setImgError] = useState(false);

  if (!headerType || headerType === "NONE") return null;

  const hc = headerContent?.trim() ?? "";
  const proxied = resolveMediaUrlForUi(headerPreviewUrl ?? undefined);
  const directUrl = isRenderableHeaderImageUrl(hc) ? hc : undefined;
  const imageSrc = proxied ?? directUrl;
  const canShowImg =
    headerType === "IMAGE" && imageSrc && !imgError;

  return (
    <div className="relative -mx-3 -mt-3 mb-2 overflow-hidden rounded-t-xl border-b border-base-200 bg-gradient-to-br from-base-200/90 to-base-300/40 aspect-[16/10] min-h-[72px] max-h-[140px]">
      {canShowImg ? (
// eslint-disable-next-line @next/next/no-img-element -- dynamic user content, dimensions unknown
        <img
          src={imageSrc}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
          onError={() => setImgError(true)}
        />
      ) : headerType === "IMAGE" ? (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1 px-2 text-center text-xs text-base-content/60">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-8 w-8 opacity-50"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="1.5"
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3A1.5 1.5 0 0 0 1.5 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z"
            />
          </svg>
          <span className="line-clamp-2">{hc ? previewText(hc, 80) : "Image header"}</span>
        </div>
      ) : headerType === "VIDEO" && proxied ? (
        <video
          src={proxied}
          className="h-full w-full object-cover"
          controls
          muted
          playsInline
          preload="metadata"
        />
      ) : headerType === "VIDEO" ? (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-xs text-base-content/60">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 opacity-60" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path d="M8 5v14l11-7z" />
          </svg>
          <span className="line-clamp-2">{hc ? previewText(hc, 60) : "Video header"}</span>
        </div>
      ) : headerType === "DOCUMENT" ? (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-xs text-base-content/60">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
          </svg>
          <span className="line-clamp-2">{hc ? previewText(hc, 60) : "Document"}</span>
        </div>
      ) : (
        <div className="flex h-full w-full items-center justify-center px-3 text-center text-xs text-base-content/60 line-clamp-3">
          {hc ? previewText(hc, 120) : headerType}
        </div>
      )}
    </div>
  );
}

function VersionCompareModal({
  open,
  onClose,
  a,
  b,
}: {
  open: boolean;
  onClose: () => void;
  a: ChannelTemplateVersion;
  b: ChannelTemplateVersion;
}) {
  if (!open) return null;

  const [older, newer] = [a, b].sort((x, y) => x.version - y.version);

  const col = (v: ChannelTemplateVersion, label: string) => (
    <div className="card bg-base-100 border border-base-300 p-3 min-w-0">
      <div className="text-sm font-semibold mb-2">{label}</div>
      <dl className="space-y-2 text-sm">
        <div>
          <dt className="text-xs uppercase text-base-content/50">Status</dt>
          <dd>{statusBadge(v.status)}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase text-base-content/50">Language</dt>
          <dd className="font-mono">{v.language ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase text-base-content/50">Header</dt>
          <dd className="whitespace-pre-wrap break-words">
            {v.headerType && v.headerType !== "NONE"
              ? `${v.headerType}${v.headerContent ? `: ${v.headerContent}` : ""}`
              : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase text-base-content/50">Body</dt>
          <dd className="whitespace-pre-wrap break-words font-mono text-xs bg-base-200 rounded p-2 max-h-48 overflow-y-auto">
            {v.body ?? "—"}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase text-base-content/50">Footer</dt>
          <dd className="whitespace-pre-wrap break-words">{v.footer ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase text-base-content/50">Layout</dt>
          <dd className="font-mono">{v.layoutType ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase text-base-content/50">Buttons</dt>
          <dd className="flex flex-wrap gap-1 mt-1">
            {Array.isArray(v.buttons) && v.buttons.length > 0
              ? (v.buttons as Array<{ type?: string; text?: string; url?: string }>).map((btn, i) => (
                  <span key={i} className="badge badge-outline badge-sm gap-1">
                    {btn.type === "QUICK_REPLY" ? "↩" : btn.type === "URL" ? "🔗" : "📞"}
                    {btn.text ?? btn.type ?? "button"}
                  </span>
                ))
              : <span className="text-base-content/50">—</span>}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase text-base-content/50">Variables</dt>
          <dd className="flex flex-wrap gap-1 mt-1">
            {Array.isArray(v.variables) && v.variables.length > 0
              ? (v.variables as Array<{ key?: string; name?: string }>).map((vr, i) => (
                  <span key={i} className="op-tag">{vr.key ?? vr.name ?? String(vr)}</span>
                ))
              : <span className="text-base-content/50">—</span>}
          </dd>
        </div>
      </dl>
    </div>
  );

  return (
    <dialog open className="modal modal-middle">
      <div className="modal-box max-w-5xl w-full max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-semibold">Compare versions</h3>
        <p className="text-sm text-base-content/60 mt-1">
          v{older.version} (older) · v{newer.version} (newer)
        </p>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          {col(older, `v${older.version}`)}
          {col(newer, `v${newer.version}`)}
        </div>
        <div className="modal-action">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop" onSubmit={onClose}>
        <button type="submit">close</button>
      </form>
    </dialog>
  );
}

export function ChannelTemplateDetailClient({
  channelTemplateId,
  workspaceId,
}: {
  channelTemplateId: string;
  workspaceId: string;
}) {
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const [pickedForCompare, setPickedForCompare] = useState<number[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [syncFeedback, setSyncFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const queryClient = useQueryClient();

  const stateQuery = useChannelTemplateState(channelTemplateId, {
    refetchInterval: 10_000,
  });
  const state = stateQuery.data;

  const versionsQuery = useChannelTemplateVersions(channelTemplateId, {
    refetchInterval: 10_000,
    enabled: !!state,
  });
  const versions = useMemo(() => versionsQuery.data ?? [], [versionsQuery.data]);

  const active = state?.activeVersion ?? null;
  const latest = state?.latestVersion ?? null;
  const latestSendable = state?.latestSendableVersion ?? null;

  const defaultSelected =
    selectedVersion ??
    active?.version ??
    latest?.version ??
    (versions.length > 0 ? versions[0]!.version : null);

  const versionQuery = useChannelTemplateVersion(
    channelTemplateId,
    defaultSelected,
    { enabled: defaultSelected != null }
  );
  const version = versionQuery.data ?? null;

  const createMutation = useCreateChannelTemplateVersion();
  const activateMutation = useActivateChannelTemplateVersion();
  const submitMutation = useSubmitChannelTemplateVersion();
  const approveMutation = useApproveChannelTemplateVersion();
  const rejectMutation = useRejectChannelTemplateVersion();
  const archiveMutation = useArchiveChannelTemplateVersion();
  const syncMutation = useSyncChannelTemplateVersion();
  const refreshProviderMutation = useRefreshChannelTemplateProviderState();
  const updateChannelTemplateMutation = useUpdateChannelTemplate();

  // Inline template name + description (template-level), so the whole template can be built on
  // this one screen — no separate create step.
  const templateId = state?.templateId ?? null;
  const templateQuery = useTemplate(templateId);
  const updateTemplateMutation = useUpdateTemplate();
  const loadedTpl = templateQuery.data;
  const [tplName, setTplName] = useState("");
  const [tplDescription, setTplDescription] = useState("");
  useEffect(() => {
    if (loadedTpl) {
      setTplName(loadedTpl.name ?? "");
      setTplDescription(loadedTpl.description ?? "");
    }
    // Depend on the values, not the object identity, so a background refetch doesn't clobber
    // what the user is currently typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadedTpl?.id, loadedTpl?.name, loadedTpl?.description]);
  const saveTemplateName = useCallback(() => {
    const next = tplName.trim();
    if (!templateId || !next || next === (loadedTpl?.name ?? "")) return;
    updateTemplateMutation.mutate({ id: templateId, data: { name: next } });
  }, [templateId, tplName, loadedTpl?.name, updateTemplateMutation]);
  const saveTemplateDescription = useCallback(() => {
    const next = tplDescription.trim();
    if (!templateId || next === (loadedTpl?.description ?? "")) return;
    updateTemplateMutation.mutate({ id: templateId, data: { description: next } });
  }, [templateId, tplDescription, loadedTpl?.description, updateTemplateMutation]);

  const editorRef = useRef<ChannelTemplateVersionEditorHandle | null>(null);

  // Clear any submit error when the visible version changes — stale message would
  // otherwise persist when the user clicks a different version in the list.
  useEffect(() => {
    setSubmitError(null);
  }, [defaultSelected]);

  const anyMutationPending =
    activateMutation.isPending ||
    submitMutation.isPending ||
    approveMutation.isPending ||
    rejectMutation.isPending ||
    archiveMutation.isPending ||
    syncMutation.isPending ||
    refreshProviderMutation.isPending;

  useEffect(() => {
    let cancelled = false;
    let source: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let retries = 0;

    const connect = () => {
      if (cancelled) return;
      source = new EventSource(`/api/sse/workspace/${workspaceId}`);
      source.onopen = () => {
        retries = 0;
      };
      source.onmessage = (event) => {
        const ev = parseWorkspaceSseEvent(event.data);
        if (!ev) return;
        if (isChannelTemplateStatusChanged(ev.type)) {
          const id = ev.data.channelTemplateId as string | undefined;
          if (id === channelTemplateId) {
            void queryClient.invalidateQueries({
              queryKey: channelTemplateKeys.state(channelTemplateId),
            });
            void queryClient.invalidateQueries({
              queryKey: channelTemplateKeys.versions(channelTemplateId),
            });
          }
        }
        if (isChannelTemplateCategoryPending(ev.type)) {
          const id = ev.data.channelTemplateId as string | undefined;
          if (id === channelTemplateId) {
            void queryClient.invalidateQueries({
              queryKey: channelTemplateKeys.state(channelTemplateId),
            });
          }
        }
        if (isChannelTemplateQualityChanged(ev.type)) {
          const id = ev.data.channelTemplateId as string | undefined;
          if (id === channelTemplateId) {
            void queryClient.invalidateQueries({
              queryKey: channelTemplateKeys.state(channelTemplateId),
            });
          }
        }
        if (isWhatsAppAccountRestriction(ev.type)) {
          void queryClient.invalidateQueries({
            queryKey: channelTemplateKeys.state(channelTemplateId),
          });
        }
      };
      source.onerror = () => {
        source?.close();
        source = null;
        if (cancelled) return;
        retries += 1;
        const delay = Math.min(30_000, 3000 * 2 ** Math.min(retries - 1, 4));
        retryTimer = setTimeout(connect, delay);
      };
    };

    connect();

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      source?.close();
    };
  }, [channelTemplateId, queryClient, workspaceId]);

  const canActivate = version != null && version.status === "PROVIDER_APPROVED" && !version.archivedAt;

  /** Meta-linked template: can pull status/category without sending a new version. */
  const stateChannel = state?.channel;
  const stateProviderTemplateId = state?.providerTemplateId;
  const canRefreshFromMeta = useMemo(
    () => stateChannel === "WHATSAPP" && Boolean(stateProviderTemplateId?.trim()),
    [stateChannel, stateProviderTemplateId]
  );

  const canSyncToProvider = useMemo(() => {
    if (!version || state?.channel !== "WHATSAPP") return false;
    return (
      version.status === "APPROVED" ||
      version.status === "PROVIDER_PENDING" ||
      version.status === "PROVIDER_APPROVED"
    );
  }, [version, state?.channel]);

  const syncToProviderLabel = useMemo(() => {
    if (!version || state?.channel !== "WHATSAPP") return "Send for approval";
    if (version.status === "PROVIDER_APPROVED") return "Get current state";
    return "Send for approval";
  }, [version, state?.channel]);

  const syncToProviderTitle = useMemo(() => {
    if (!version || state?.channel !== "WHATSAPP") {
      return "Only WhatsApp supports provider sync.";
    }
    if (
      version.status === "APPROVED" ||
      version.status === "PROVIDER_PENDING" ||
      version.status === "PROVIDER_APPROVED"
    ) {
      if (version.status === "PROVIDER_APPROVED") {
        return "Fetch the current template state from Meta (status, quality, category).";
      }
      if (version.status === "PROVIDER_PENDING") {
        return "Send this version to Meta again (updates content while under review).";
      }
      return "Send this approved version to Meta for WhatsApp review. Requires templates.sync permission.";
    }
    return "Submit & approve this version locally first, then send it to Meta.";
  }, [version, state?.channel]);

  // Bind state.category to a local so the React Compiler's inferred dep matches
  // our manual dep array (otherwise mixing `state?.category` and `state.category`
  // reads makes it widen the dep to `state`, breaking memoization preservation).
  const currentCategory = state?.category;
  const handleAutoSwitchCategoryToMarketing = useCallback(() => {
    if (currentCategory !== "UTILITY") return;
    updateChannelTemplateMutation.mutate({
      id: channelTemplateId,
      category: "MARKETING",
    });
  }, [currentCategory, channelTemplateId, updateChannelTemplateMutation]);

  const onCreate = useCallback(() => {
    const payload: ChannelTemplateVersionPayload =
      version
        ? {
            // Clone the currently selected version as a starting point. (Auth templates have an
            // empty body, so we key off `version` existing — not `version.body` — and carry
            // authConfig, otherwise the OTP setup would be lost.)
            body: version.body ?? "",
            headerType: version.headerType ?? "NONE",
            headerContent: version.headerContent ?? null,
            footer: version.footer ?? null,
            language: version.language ?? "en",
            parameterFormat: version.parameterFormat ?? "POSITIONAL",
            layoutType: version.layoutType ?? "STANDARD",
            buttons: (version.buttons as unknown[] | null) ?? null,
            variables: (version.variables as unknown[] | null) ?? null,
            carouselCards: (version.carouselCards as unknown[] | null) ?? null,
            allowCategoryChange: version.allowCategoryChange !== false,
            authConfig: version.authConfig ?? null,
          }
        : {
            // First version default.
            body: "Hello {{1}}",
            headerType: "NONE",
            language: "en",
            parameterFormat: "POSITIONAL",
            allowCategoryChange: true,
          };
    createMutation.mutate(
      { id: channelTemplateId, data: payload },
      {
        onSuccess: (v) => {
          setCreateOpen(false);
          setSelectedVersion(v.version);
        },
      }
    );
  }, [createMutation, channelTemplateId, version]);

  const onActivate = useCallback(() => {
    if (!version) return;
    activateMutation.mutate({ id: channelTemplateId, version: version.version });
  }, [activateMutation, channelTemplateId, version]);

  const onSubmitAndApprove = useCallback(async () => {
    if (!version) return;
    setSubmitError(null);
    // Persist any unsaved local edits first. submitForApproval on the server
    // takes no body — without this, in-flight keystrokes would be silently
    // dropped and the version locked on PENDING → APPROVED.
    const saved = await editorRef.current?.save();
    if (saved === false) return; // save error already shown in the editor
    submitMutation.mutate(
      { id: channelTemplateId, version: version.version },
      {
        onSuccess: () => {
          approveMutation.mutate(
            { id: channelTemplateId, version: version.version },
            {
              onError: (err) => setSubmitError(getApiError(err)),
            },
          );
        },
        onError: (err) => setSubmitError(getApiError(err)),
      }
    );
  }, [submitMutation, approveMutation, channelTemplateId, version]);

  const onApprove = useCallback(() => {
    if (!version) return;
    setSubmitError(null);
    approveMutation.mutate(
      { id: channelTemplateId, version: version.version },
      { onError: (err) => setSubmitError(getApiError(err)) },
    );
  }, [approveMutation, channelTemplateId, version]);

  const onReject = useCallback(() => {
    if (!version || !rejectReason.trim()) return;
    rejectMutation.mutate(
      { id: channelTemplateId, version: version.version, reason: rejectReason.trim() },
      { onSuccess: () => { setRejectOpen(false); setRejectReason(""); } }
    );
  }, [rejectMutation, channelTemplateId, version, rejectReason]);

  const onArchive = useCallback(() => {
    if (!version) return;
    archiveMutation.mutate({ id: channelTemplateId, version: version.version });
  }, [archiveMutation, channelTemplateId, version]);

  const onSyncToProvider = useCallback(() => {
    if (!version) return;
    setSyncFeedback(null);
    if (version.status === "PROVIDER_APPROVED") {
      refreshProviderMutation.mutate(
        { id: channelTemplateId },
        {
          onSuccess: (data) => {
            if (!data.success) {
              setSyncFeedback({ type: "error", message: data.error ?? "Refresh failed." });
            } else {
              setSyncFeedback({ type: "success", message: "Fetched current state from Meta." });
            }
          },
          onError: (err) => setSyncFeedback({ type: "error", message: getApiError(err) }),
        }
      );
      return;
    }

    syncMutation.mutate(
      { id: channelTemplateId, version: version.version },
      {
        onSuccess: (data) => {
          if (!data.success) {
            setSyncFeedback({ type: "error", message: data.error ?? "Send failed." });
          } else {
            setSyncFeedback({
              type: "success",
              message: "Sent to Meta for WhatsApp review. Status updates when WhatsApp finishes review.",
            });
          }
        },
        onError: (err) => setSyncFeedback({ type: "error", message: getApiError(err) }),
      }
    );
  }, [channelTemplateId, refreshProviderMutation, syncMutation, version]);

  const onRefreshFromMeta = useCallback(() => {
    setSyncFeedback(null);
    refreshProviderMutation.mutate(
      { id: channelTemplateId },
      {
        onSuccess: (data) => {
          if (!data.success) {
            setSyncFeedback({ type: "error", message: data.error ?? "Refresh failed." });
          } else {
            setSyncFeedback({ type: "success", message: "Fetched current state from Meta." });
          }
        },
        onError: (err) => setSyncFeedback({ type: "error", message: getApiError(err) }),
      }
    );
  }, [channelTemplateId, refreshProviderMutation]);

  const toggleComparePick = useCallback((v: number) => {
    setPickedForCompare((prev) => {
      if (prev.includes(v)) return prev.filter((x) => x !== v);
      if (prev.length >= 2) return prev;
      return [...prev, v];
    });
  }, []);

  const sortedVersionCards = useMemo(
    () => versions.slice().sort((a, b) => b.version - a.version),
    [versions]
  );

  const comparePair = useMemo(() => {
    if (pickedForCompare.length !== 2) return null;
    const va = sortedVersionCards.find((v) => v.version === pickedForCompare[0]);
    const vb = sortedVersionCards.find((v) => v.version === pickedForCompare[1]);
    if (!va || !vb) return null;
    return { a: va, b: vb };
  }, [pickedForCompare, sortedVersionCards]);

  if (stateQuery.isLoading || !state) {
    return (
      <div className="flex justify-center py-12">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  if (stateQuery.isError) {
    return (
      <div role="alert" className="rounded-box border border-error/30 border-l-2 border-l-error bg-base-200 px-4 py-3">
        <span>{getApiError(stateQuery.error)}</span>
      </div>
    );
  }


  return (
    <div className="space-y-4">
      {templateId && (
        <div className="card bg-base-100 border border-base-300 p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="form-control w-full">
              <span className="label-text text-xs">Template name</span>
              <input
                type="text"
                className="input input-bordered input-sm w-full"
                value={tplName}
                onChange={(e) => setTplName(e.target.value)}
                onBlur={saveTemplateName}
                placeholder="Untitled template"
              />
            </label>
            <label className="form-control w-full">
              <span className="label-text text-xs">Description</span>
              <input
                type="text"
                className="input input-bordered input-sm w-full"
                value={tplDescription}
                onChange={(e) => setTplDescription(e.target.value)}
                onBlur={saveTemplateDescription}
                placeholder="Optional — internal reference only"
              />
            </label>
          </div>
        </div>
      )}

      {state.whatsappUtilityRestriction && (
        <div role="alert" className="rounded-box border border-warning/30 border-l-2 border-l-warning bg-base-200 px-4 py-3">
          <span>
            WhatsApp account notice
            {state.whatsappUtilityRestriction.level != null &&
            state.whatsappUtilityRestriction.level !== ""
              ? `: ${state.whatsappUtilityRestriction.level}`
              : ""}
            . Meta may flag utility template misuse; review policy and template categories.
          </span>
        </div>
      )}

      {state.whatsappPhoneQuality?.rating === "FLAGGED" && (
        <div role="alert" className="rounded-box border border-error/30 border-l-2 border-l-error bg-base-200 px-4 py-3">
          <span className="op-label mb-1 block text-error">phone number flagged</span>
          <p className="text-[0.8125rem] text-base-content">
            WhatsApp has flagged
            {state.whatsappPhoneQuality.displayPhoneNumber ? (
              <> phone number <strong>{state.whatsappPhoneQuality.displayPhoneNumber}</strong></>
            ) : (
              <> your WhatsApp phone number</>
            )}{" "}
            due to multiple low-quality templates. If quality doesn&apos;t recover within 7 days, the messaging tier
            will drop, lowering how many users you can message per day.
            {state.whatsappPhoneQuality.flaggedAt && (() => {
              const flaggedAt = new Date(state.whatsappPhoneQuality.flaggedAt);
              // eslint-disable-next-line react-hooks/purity -- render-time relative day counter; day-resolution staleness is fine
              const daysIn = Math.floor((Date.now() - flaggedAt.getTime()) / 86_400_000);
              const daysLeft = Math.max(0, 7 - daysIn);
              return (
                <span className="font-mono-op ml-1.5 text-[0.6875rem] text-base-content/55">
                  flagged {daysIn}d ago · ~{daysLeft}d until tier downgrade
                </span>
              );
            })()}
          </p>
          <p className="mt-1.5 text-[0.75rem] text-base-content/60">
            Address low-quality templates (see RED warnings) and pause campaigns with poor read-rates.
            Quality scores recover automatically as positive feedback accumulates.
          </p>
        </div>
      )}

      {state.categoryPendingChange && (
        <div role="alert" className="rounded-box border border-warning/30 border-l-2 border-l-warning bg-base-200 px-4 py-3">
          <span className="op-label mb-1 block text-warning">category change required</span>
          <p className="text-[0.8125rem] text-base-content">
            Meta detected this template should be <strong>{state.categoryPendingChange.correctCategory}</strong> instead
            of <strong>{state.categoryPendingChange.currentCategory}</strong>.
            {state.categoryPendingChange.fetchedAt && (
              <span className="font-mono-op ml-1.5 text-[0.6875rem] text-base-content/50">
                checked {new Date(state.categoryPendingChange.fetchedAt).toLocaleString()}
              </span>
            )}
          </p>
          <p className="mt-1.5 text-[0.75rem] text-base-content/60">
            Update the category in template settings to match Meta&apos;s classification, or your template may be paused.
          </p>
        </div>
      )}

      {/* Meta quality rating — RED is a "may be paused" signal worth surfacing. */}
      {normalizeQualityRating(state.qualityScore) === "RED" && (
        <div role="alert" className="rounded-box border border-warning/30 border-l-2 border-l-warning bg-base-200 px-4 py-3">
          <span className="op-label mb-1 block text-warning">low quality</span>
          <p className="text-[0.8125rem] text-base-content">
            Meta has rated this template <strong>Low quality</strong>. Continued negative feedback or low read-rates
            <em> may </em>cause Meta to pause this template (3 hours on first pause, 6 hours on the second; a third
            pause disables it permanently). A RED rating without policy violations no longer forces an automatic
            tier downgrade.
            {state.lastQualityCheckAt && (
              <span className="font-mono-op ml-1.5 text-[0.6875rem] text-base-content/50">
                checked {new Date(state.lastQualityCheckAt).toLocaleString()}
              </span>
            )}
          </p>
          <p className="mt-1.5 text-[0.75rem] text-base-content/60">
            Reduce send frequency to recipients with low engagement, or revise the content to address the feedback.
            Seven consecutive days at Medium or High returns the template to Approved automatically.
          </p>
        </div>
      )}

      <div className="card bg-base-100 border border-base-300 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="op-tag">{state.channel}</span>
            <select
              className="select select-bordered select-xs"
              value={state.category ?? "UTILITY"}
              onChange={(e) =>
                updateChannelTemplateMutation.mutate({
                  id: channelTemplateId,
                  category: e.target.value as "UTILITY" | "MARKETING" | "AUTHENTICATION",
                })
              }
              disabled={updateChannelTemplateMutation.isPending}
            >
              <option value="UTILITY">Utility</option>
              <option value="MARKETING">Marketing</option>
              <option value="AUTHENTICATION">Authentication</option>
            </select>
            {state.isSendable ? (
              <span className="op-tag op-tag-ok">Sendable</span>
            ) : (
              <span className="op-tag op-tag-warn">Not sendable</span>
            )}
            <QualityBadge
              qualityScore={state.qualityScore}
              lastQualityCheckAt={state.lastQualityCheckAt}
            />
            {state.providerTemplateName && (
              <span
                className="font-mono-op text-[0.6875rem] text-base-content/50"
                title="The exact name this template is registered under with Meta. Sends address it by this name, so renaming the display title is safe."
              >
                registered as {state.providerTemplateName}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {state.channel === "WHATSAPP" && (
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={onRefreshFromMeta}
                disabled={!canRefreshFromMeta || refreshProviderMutation.isPending}
                title={
                  canRefreshFromMeta
                    ? "Fetch status, quality, and category from Meta (no resubmit)."
                    : "Not linked to Meta yet (missing providerTemplateId). Send for approval once to link, or we’ll auto-link when Meta already has it."
                }
              >
                {refreshProviderMutation.isPending ? (
                  <>
                    <span className="loading loading-spinner loading-sm" />
                    Fetching…
                  </>
                ) : (
                  "Get current state from Meta"
                )}
              </button>
            )}
            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                createMutation.reset();
                setCreateOpen(true);
              }}
            >
              Create version
            </button>
          </div>
        </div>

        {syncFeedback && (
          <div
            role="status"
            className={
              syncFeedback.type === "success"
                ? "mt-3 rounded-box border border-success/30 border-l-2 border-l-success bg-base-200 px-3 py-2 text-sm"
                : "mt-3 rounded-box border border-error/30 border-l-2 border-l-error bg-base-200 px-3 py-2 text-sm"
            }
          >
            <span>{syncFeedback.message}</span>
          </div>
        )}

        {state.missingRequirements.length > 0 && (
          <div className="mt-3 space-y-2">
            {state.missingRequirements.map((r) => {
              // Hide the draft notice entirely — the version status tag is sufficient.
              if (r.code === "NO_SENDABLE_VERSION" && latest?.status === "DRAFT") return null;

              const isMetaPendingNotice =
                r.code === "NO_SENDABLE_VERSION" &&
                typeof r.message === "string" &&
                r.message.toLowerCase().includes("waiting for meta approval");

              return (
                <div
                  key={r.code}
                  className="rounded-box border border-warning/30 border-l-2 border-l-warning bg-base-200 px-4 py-3"
                >
                  {isMetaPendingNotice ? (
                    <div className="flex items-center gap-2">
                      <span className="text-sm">Pending Meta review</span>
                      <span
                        className="tooltip tooltip-right"
                        data-tip={r.message}
                      >
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs"
                          aria-label="Why pending?"
                          onClick={() => {
                            // Mobile-friendly: clicking shows native tooltip via title fallback.
                          }}
                          title={r.message}
                        >
                          ⏳
                        </button>
                      </span>
                    </div>
                  ) : (
                    <span>{r.message}</span>
                  )}
                  {r.action && (
                    <a
                      className="btn btn-sm"
                      href={channelTemplateRequirementHref(r.action.href)}
                      title={r.action.type}
                    >
                      {r.action.label}
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Selected version actions + editor */}
      {versionQuery.isLoading ? (
        <div className="flex justify-center py-6">
          <span className="loading loading-spinner loading-md" />
        </div>
      ) : versionQuery.isError ? (
        <div role="alert" className="rounded-box border border-error/30 border-l-2 border-l-error bg-base-200 px-4 py-3">
          <span>{getApiError(versionQuery.error)}</span>
        </div>
      ) : version ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="op-tag op-tag-info">v{version.version}</span>
            {statusBadge(version.status)}
            {version.isActive && <span className="op-tag op-tag-ok">Active</span>}
            {version.isLocked && !version.archivedAt && <span className="op-tag" title="Content is locked and cannot be edited">🔒 Locked</span>}
            {version.archivedAt && <span className="op-tag">Archived</span>}
          </div>
          {version.status === "PROVIDER_PENDING" && (
            <div
              role="status"
              className="rounded-box border border-info/30 border-l-2 border-l-info bg-base-200 px-4 py-3"
            >
              <span className="op-label mb-1 block text-info">in review</span>
              <p className="text-[0.8125rem] text-base-content">
                Meta typically reviews templates within minutes, but can take up to 24 hours.
                You&apos;ll see status updates here automatically — no need to refresh.
              </p>
            </div>
          )}
          {state?.channel === "WHATSAPP" && !version.archivedAt && (
            <VersionWorkflowStepper status={version.status} />
          )}

          {/* Instant structural rejection (sync error from Meta API) */}
          {version.syncError && version.status !== "PROVIDER_REJECTED" && (
            <div role="alert" className="rounded-box border border-error/30 border-l-2 border-l-error bg-base-200 px-4 py-3">
              <span className="op-label mb-1 block text-error">sync error — structural</span>
              <p className="text-[0.8125rem] text-base-content">{version.syncError}</p>
              <p className="mt-1.5 text-[0.75rem] text-base-content/55">
                Meta rejected the template format instantly. The template was NOT registered on Meta&apos;s side.
                Edit the content below to fix the issue, then re-submit and sync.
              </p>
            </div>
          )}

          {/* Async content rejection (Meta reviewed and rejected via webhook) */}
          {version.status === "PROVIDER_REJECTED" && (
            <div role="alert" className="rounded-box border border-error/30 border-l-2 border-l-error bg-base-200 px-4 py-3">
              <span className="op-label mb-1 block text-error">rejected by meta — content review</span>
              <p className="text-[0.8125rem] text-base-content">
                {version.providerRejectionReason || version.syncError || "Meta rejected this template after content review."}
              </p>
              <p className="mt-1.5 text-[0.75rem] text-base-content/55">
                This template name is now registered on Meta&apos;s side as rejected.
                You cannot reuse the same name — create a new template with a different name, or create a new version and resubmit.
              </p>
            </div>
          )}

          <ChannelTemplateVersionEditor
            ref={editorRef}
            channelTemplateId={channelTemplateId}
            version={version}
            channelCategory={state?.category ?? null}
            onAutoSwitchCategoryToMarketing={handleAutoSwitchCategoryToMarketing}
            onCopyAsNewDraft={() => {
              createMutation.reset();
              setCreateOpen(true);
            }}
          />

          {submitError && (
            <div role="alert" className="rounded-box border border-error/30 border-l-2 border-l-error bg-base-200 px-4 py-3">
              <span className="op-label mb-1 block text-error">submit blocked — fix and retry</span>
              <span className="text-sm">{submitError}</span>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <button
              className="btn btn-outline btn-sm"
              onClick={() => void onSubmitAndApprove()}
              disabled={
                anyMutationPending ||
                version.status !== "DRAFT" ||
                version.isLocked
              }
            >
              Submit & approve
            </button>
            <button
              className="btn btn-outline btn-sm"
              onClick={onApprove}
              disabled={anyMutationPending || version.status !== "PENDING"}
            >
              Approve
            </button>
            <button
              className="btn btn-outline btn-sm"
              onClick={() => setRejectOpen(true)}
              disabled={anyMutationPending || version.status !== "PENDING"}
            >
              Reject
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={onActivate}
              disabled={anyMutationPending || !canActivate}
            >
              Activate
            </button>
            <div className="tooltip tooltip-bottom" data-tip={
              version.archivedAt ? "Already archived"
              : version.isActive ? "Deactivate before archiving"
              : "Archive this version (keeps audit trail)"
            }>
              <button
                className="btn btn-ghost btn-sm text-error"
                onClick={onArchive}
                disabled={anyMutationPending || !!version.archivedAt || version.isActive}
              >
                Archive
              </button>
            </div>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={onSyncToProvider}
              disabled={anyMutationPending || !canSyncToProvider}
              title={syncToProviderTitle}
            >
              {syncMutation.isPending || refreshProviderMutation.isPending ? (
                <>
                  <span className="loading loading-spinner loading-sm" />
                  Syncing…
                </>
              ) : (
                syncToProviderLabel
              )}
            </button>
          </div>
        </div>
      ) : (
        <div className="text-base-content/60">No version selected.</div>
      )}

      {/* Version history */}
      <div className="card bg-base-100 border border-base-300 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-lg font-semibold">Version history</div>
            <div className="text-sm text-base-content/60">
              Click a card to edit or act on that version. Check two cards and open side-by-side
              comparison.
            </div>
          </div>
        </div>

        {versionsQuery.isLoading ? (
          <div className="flex justify-center py-8 mt-4">
            <span className="loading loading-spinner loading-md" />
          </div>
        ) : sortedVersionCards.length === 0 ? (
          <div className="mt-4 text-sm text-base-content/60">No versions yet.</div>
        ) : (
          <>
            {pickedForCompare.length > 0 && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 card bg-base-100 border border-base-300 px-3 py-2">
                <span className="text-sm">
                  {pickedForCompare.length === 2
                    ? `Ready: v${pickedForCompare[0]} & v${pickedForCompare[1]}`
                    : `Pick one more version (${pickedForCompare.length}/2)`}
                </span>
                <div className="flex items-center gap-2">
                  {pickedForCompare.length === 2 && (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => setCompareOpen(true)}
                    >
                      Compare
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setPickedForCompare([])}
                  >
                    Clear selection
                  </button>
                </div>
              </div>
            )}

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {sortedVersionCards.map((v) => {
                const isSelected = defaultSelected === v.version;
                const tagBits: string[] = [];
                if (v.isActive) tagBits.push("Active");
                if (v.version === latest?.version) tagBits.push("Latest");
                if (v.version === latestSendable?.version) tagBits.push("Sendable");
                if (v.archivedAt) tagBits.push("Archived");
                return (
                  <div
                    key={v.id}
                    className={`flex flex-col overflow-hidden rounded-box border bg-base-100 p-3 text-left transition-colors ${
                      isSelected
                        ? "border-primary border-l-2"
                        : "border-base-300 hover:border-base-content/20"
                    }`}
                  >
                    <button
                      type="button"
                      className="w-full min-w-0 text-left"
                      onClick={() => setSelectedVersion(v.version)}
                    >
                      <VersionCardHeaderStrip
                        headerType={v.headerType}
                        headerContent={v.headerContent}
                        headerPreviewUrl={v.headerPreviewUrl}
                      />
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="op-tag op-tag-info">v{v.version}</span>
                        {statusBadge(v.status)}
                        {v.isActive && <span className="op-tag op-tag-ok">Active</span>}
                        {v.isLocked && !v.archivedAt && <span className="op-tag" title="Content is locked and cannot be edited">🔒 Locked</span>}
                        {v.archivedAt && <span className="op-tag">Archived</span>}
                      </div>
                      {tagBits.length > 0 && (
                        <div className="mt-1 text-xs text-base-content/50">
                          {tagBits.join(" · ")}
                        </div>
                      )}
                      <p className="mt-2 text-sm text-base-content/80 line-clamp-4 whitespace-pre-wrap break-words">
                        {previewText(v.body)}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-base-content/50">
                        {v.language && <span>lang: {v.language}</span>}
                        {v.headerType && v.headerType !== "NONE" && (
                          <span>header: {v.headerType}</span>
                        )}
                        {v.createdAt && (
                          <span>
                            {new Date(v.createdAt).toLocaleString(undefined, {
                              dateStyle: "short",
                              timeStyle: "short",
                            })}
                          </span>
                        )}
                      </div>
                      {(v.syncError || (v.status === "PROVIDER_REJECTED" && v.providerRejectionReason)) && (
                        <div className="mt-1 rounded-md border border-error/20 bg-error/5 px-2 py-1">
                          <p className="text-[0.6875rem] text-error line-clamp-2" title={v.providerRejectionReason || v.syncError || ""}>
                            {v.status === "PROVIDER_REJECTED"
                              ? `Rejected: ${v.providerRejectionReason || v.syncError || "Content review failed"}`
                              : `Error: ${v.syncError}`}
                          </p>
                        </div>
                      )}
                    </button>
                    <label className="mt-3 flex cursor-pointer items-center gap-2 border-t border-base-200 pt-2 text-xs text-base-content/70">
                      <input
                        type="checkbox"
                        className="checkbox checkbox-xs"
                        checked={pickedForCompare.includes(v.version)}
                        onChange={() => toggleComparePick(v.version)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      Select for compare
                    </label>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {createOpen && (
        <dialog open className="modal modal-middle">
          <div className="modal-box">
            <h3 className="text-lg font-semibold">Create version</h3>
            <p className="text-sm text-base-content/60 mt-1">
              Creates a draft version. You can edit body, header, and footer below.
            </p>
            {createMutation.isError && (
              <div role="alert" className="mt-3 rounded-box border border-error/30 border-l-2 border-l-error bg-base-200 px-3 py-2 text-sm">
                <span>{getApiError(createMutation.error)}</span>
              </div>
            )}
            <div className="modal-action">
              <button className="btn btn-ghost" onClick={() => setCreateOpen(false)} disabled={createMutation.isPending}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={onCreate} disabled={createMutation.isPending}>
                {createMutation.isPending ? (
                  <>
                    <span className="loading loading-spinner loading-sm" />
                    Creating…
                  </>
                ) : (
                  "Create"
                )}
              </button>
            </div>
          </div>
          <form method="dialog" className="modal-backdrop" onSubmit={() => setCreateOpen(false)}>
            <button type="submit">close</button>
          </form>
        </dialog>
      )}

      {rejectOpen && (
        <dialog open className="modal modal-middle">
          <div className="modal-box">
            <h3 className="text-lg font-semibold">Reject version</h3>
            <label className="label">
              <span className="label-text">Reason</span>
            </label>
            <input
              className="input input-bordered w-full"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Why is this being rejected?"
            />
            <div className="modal-action">
              <button className="btn btn-ghost" onClick={() => { setRejectOpen(false); setRejectReason(""); }}>
                Cancel
              </button>
              <button className="btn btn-error" onClick={onReject} disabled={!rejectReason.trim() || rejectMutation.isPending}>
                Reject
              </button>
            </div>
          </div>
          <form method="dialog" className="modal-backdrop" onSubmit={() => setRejectOpen(false)}>
            <button type="submit">close</button>
          </form>
        </dialog>
      )}

      {comparePair && (
        <VersionCompareModal
          open={compareOpen}
          onClose={() => setCompareOpen(false)}
          a={comparePair.a}
          b={comparePair.b}
        />
      )}
    </div>
  );
}

