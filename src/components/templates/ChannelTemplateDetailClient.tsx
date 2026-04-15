"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
} from "@/hooks/use-templates";
import type {
  ChannelTemplateVersion,
  ChannelTemplateVersionPayload,
  TemplateVersionStatus,
} from "@/lib/types";
import { channelTemplateRequirementHref } from "@/lib/site";
import {
  parseWorkspaceSseEvent,
  isChannelTemplateCategoryPending,
  isWhatsAppAccountRestriction,
} from "@/lib/sseEvents";
import { ChannelTemplateVersionEditor } from "./ChannelTemplateVersionEditor";
import { resolveMediaUrlForUi } from "@/lib/mediaUrls";
import { getApiError } from "@/lib/api-error";

function statusLabel(status: TemplateVersionStatus): string {
  switch (status) {
    case "DRAFT": return "Draft";
    case "PENDING": return "Pending review";
    case "APPROVED": return "Approved";
    case "REJECTED": return "Rejected";
    case "PROVIDER_PENDING": return "Under Meta review";
    case "PROVIDER_APPROVED": return "Live on WhatsApp";
    case "PROVIDER_REJECTED": return "Rejected by Meta";
    case "PROVIDER_PAUSED": return "Paused by Meta";
    case "PROVIDER_DISABLED": return "Disabled by Meta";
    default: return status;
  }
}

function statusBadge(status: TemplateVersionStatus) {
  const cls =
    status === "PROVIDER_APPROVED"
      ? "badge-success"
      : status === "DRAFT"
        ? "badge-ghost"
        : status === "PENDING" || status === "PROVIDER_PENDING"
          ? "badge-warning"
          : status === "APPROVED"
            ? "badge-info"
            : status === "REJECTED" || status === "PROVIDER_REJECTED"
              ? "badge-error"
              : "badge-ghost";
  return <span className={`badge badge-sm ${cls}`}>{statusLabel(status)}</span>;
}

const WA_STEPS: { key: TemplateVersionStatus | string; label: string }[] = [
  { key: "DRAFT", label: "Draft" },
  { key: "PENDING", label: "Pending review" },
  { key: "APPROVED", label: "Approved locally" },
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

function jsonOrDash(value: unknown): string {
  if (value == null) return "—";
  if (typeof value === "string") return value || "—";
  try {
    const s = JSON.stringify(value, null, 2);
    return s.length > 4000 ? `${s.slice(0, 4000)}…` : s;
  } catch {
    return "—";
  }
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
    <div className="rounded-box border border-base-300 bg-base-100 p-3 min-w-0">
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
                  <span key={i} className="badge badge-ghost badge-sm font-mono">
                    {vr.key ?? vr.name ?? String(vr)}
                  </span>
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

  const queryClient = useQueryClient();

  const stateQuery = useChannelTemplateState(channelTemplateId, {
    refetchInterval: 10_000,
  });
  const state = stateQuery.data;

  const versionsQuery = useChannelTemplateVersions(channelTemplateId, {
    refetchInterval: 10_000,
    enabled: !!state,
  });
  const versions = versionsQuery.data ?? [];

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
        if (isChannelTemplateCategoryPending(ev.type)) {
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
  const canRefreshFromMeta = useMemo(
    () => state?.channel === "WHATSAPP" && Boolean(state.providerTemplateId?.trim()),
    [state?.channel, state?.providerTemplateId]
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

  const onCreate = useCallback(() => {
    const payload: ChannelTemplateVersionPayload =
      version?.body
        ? {
            // Clone currently selected version as a starting point.
            body: version.body,
            headerType: (version.headerType ?? "NONE") as any,
            headerContent: version.headerContent ?? null,
            footer: version.footer ?? null,
            language: version.language ?? "en",
            parameterFormat: version.parameterFormat ?? "POSITIONAL",
            layoutType: (version.layoutType ?? "STANDARD") as any,
            buttons: (version.buttons as any) ?? null,
            variables: (version.variables as any) ?? null,
            carouselCards: (version.carouselCards as any) ?? null,
            allowCategoryChange: version.allowCategoryChange !== false,
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

  const onSubmitAndApprove = useCallback(() => {
    if (!version) return;
    submitMutation.mutate(
      { id: channelTemplateId, version: version.version },
      {
        onSuccess: () => {
          approveMutation.mutate({ id: channelTemplateId, version: version.version });
        },
      }
    );
  }, [submitMutation, approveMutation, channelTemplateId, version]);

  const onApprove = useCallback(() => {
    if (!version) return;
    approveMutation.mutate({ id: channelTemplateId, version: version.version });
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
      <div role="alert" className="alert alert-error">
        <span>{getApiError(stateQuery.error)}</span>
      </div>
    );
  }


  return (
    <div className="space-y-4">
      {state.whatsappUtilityRestriction && (
        <div role="alert" className="alert alert-warning">
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

      {state.categoryPendingChange && (
        <div role="alert" className="alert alert-info">
          <span>
            Upcoming category change: Meta will move this template from{" "}
            <strong>{state.categoryPendingChange.currentCategory}</strong> to{" "}
            <strong>{state.categoryPendingChange.correctCategory}</strong>
            {state.categoryPendingChange.fetchedAt && (
              <>
                {" "}
                (checked {new Date(state.categoryPendingChange.fetchedAt).toLocaleString()})
              </>
            )}
            .
          </span>
        </div>
      )}

      <div className="rounded-box border border-base-300 bg-base-100 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="badge badge-ghost">{state.channel}</span>
            {state.category && <span className="badge badge-outline">{state.category}</span>}
            {state.isSendable ? (
              <span className="badge badge-success">Sendable</span>
            ) : (
              <span className="badge badge-warning">Not sendable</span>
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
                ? "alert alert-success text-sm mt-3"
                : "alert alert-error text-sm mt-3"
            }
          >
            <span>{syncFeedback.message}</span>
          </div>
        )}

        {state.missingRequirements.length > 0 && (
          <div className="mt-3 space-y-2">
            {state.missingRequirements.map((r) => {
              const isDraftNoSend =
                r.code === "NO_SENDABLE_VERSION" && latest?.status === "DRAFT";

              const isMetaPendingNotice =
                r.code === "NO_SENDABLE_VERSION" &&
                typeof r.message === "string" &&
                r.message.toLowerCase().includes("waiting for meta approval");

              return (
                <div
                  key={r.code}
                  className={isDraftNoSend ? "alert alert-info" : "alert alert-warning"}
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

      <div className="rounded-box border border-base-300 bg-base-100 p-4">
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
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-box border border-base-300 bg-base-100 px-3 py-2">
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
                    className={`flex flex-col overflow-hidden rounded-box border border-base-300 bg-base-100 p-3 text-left ${
                      isSelected
                        ? "border-primary ring-2 ring-primary/25 shadow-md"
                        : "border-base-300/70 hover:border-primary/30"
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
                        <span className="badge badge-primary badge-sm">v{v.version}</span>
                        {statusBadge(v.status)}
                        {v.isActive && (
                          <span className="badge badge-success badge-sm">Active</span>
                        )}
                        {v.archivedAt && (
                          <span className="badge badge-ghost badge-sm">Archived</span>
                        )}
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
                      {v.syncError && (
                        <p className="mt-1 text-xs text-error line-clamp-2" title={v.syncError}>
                          {v.syncError}
                        </p>
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

        <div className="mt-4">
          {versionQuery.isLoading ? (
            <div className="flex justify-center py-6">
              <span className="loading loading-spinner loading-md" />
            </div>
          ) : versionQuery.isError ? (
            <div role="alert" className="alert alert-error">
              <span>{getApiError(versionQuery.error)}</span>
            </div>
          ) : version ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="badge badge-primary">v{version.version}</span>
                {statusBadge(version.status)}
                {version.isActive && <span className="badge badge-success">Active</span>}
                {version.archivedAt && <span className="badge badge-ghost">Archived</span>}
              </div>
              {state?.channel === "WHATSAPP" && !version.archivedAt && (
                <VersionWorkflowStepper status={version.status} />
              )}

              {version.syncError && (
                <div role="alert" className="alert alert-error">
                  <span>{version.syncError}</span>
                </div>
              )}

              <ChannelTemplateVersionEditor
                channelTemplateId={channelTemplateId}
                version={version}
                channelCategory={state?.category ?? null}
                onAutoSwitchCategoryToMarketing={() => {
                  if (!state?.category) return;
                  if (state.category !== "UTILITY") return;
                  updateChannelTemplateMutation.mutate({
                    id: channelTemplateId,
                    category: "MARKETING",
                  });
                }}
                onCopyAsNewDraft={() => {
                  // Uses the already-selected version as the clone source.
                  createMutation.reset();
                  setCreateOpen(true);
                }}
              />

              <div className="flex flex-wrap items-center gap-2">
                <button
                  className="btn btn-outline btn-sm"
                  onClick={onSubmitAndApprove}
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
                <button
                  className="btn btn-ghost btn-sm text-error"
                  onClick={onArchive}
                  disabled={anyMutationPending || !!version.archivedAt}
                >
                  Archive
                </button>
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
        </div>
      </div>

      {createOpen && (
        <dialog open className="modal modal-middle">
          <div className="modal-box">
            <h3 className="text-lg font-semibold">Create version</h3>
            <p className="text-sm text-base-content/60 mt-1">
              Creates a draft version. You can edit body, header, and footer below.
            </p>
            {createMutation.isError && (
              <div role="alert" className="alert alert-error mt-3 text-sm">
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

