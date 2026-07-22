"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from "react";
import { FileText, X as XIcon } from "lucide-react";
import { templatesApi, channelTemplatesApi } from "@/lib/api";
import type { ChannelTemplateVersion, Template } from "@/lib/types";
import { getWaCategory } from "@/lib/templateCategory";
import {
  carouselCardFileAccept,
  isMediaHeaderType,
  uploadWhatsAppAttachmentIdAndPrepareWhatsApp,
} from "@/lib/whatsappTemplateMedia";
import { extractApiErrorMessage } from "@/lib/messageApiErrors";
import { TemplateValueField } from "@/components/templates/TemplateValueField";
import { variableKeyLabel, variableInputKind } from "@/lib/template-variables";
import {
  WhatsAppTemplatePreview,
  type WhatsAppTemplatePreviewProps,
} from "@/components/templates/WhatsAppTemplatePreview";
import { TemplatePickerModal } from "@/components/inbox/TemplatePickerModal";

type TemplateVariableRow = {
  id: string;
  key: string;
  value: string;
};

function newTemplateVariableRow(): TemplateVariableRow {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    key: "",
    value: "",
  };
}

export interface TemplateComposerHandle {
  /** The template send payload, or null when the picker isn't ready to send. */
  getSendPayload(): {
    channelTemplateVersionId: string;
    templateVariables: Record<string, string> | undefined;
  } | null;
  reset(): void;
}

interface Props {
  /** = useTemplateSend; when false, don't load/render the heavy body. */
  active: boolean;
  contactId: string | null;
  /** Parent only mounts for WHATSAPP; still guarded here. */
  channel: string | null;
  workspaceId: string;
  /** = templateOnlyMode; outside the 24h window, so the composer leads into the picker. */
  templateOnly: boolean;
  /** Fires when the "can send a template" predicate flips. */
  onReadyChange: (ready: boolean) => void;
  /**
   * Parent's send handler (InboxClient.handleSend). The modal's Send button
   * calls this so the modal drives the SAME send as the parent's Send button —
   * the payload still comes from this component's `getSendPayload()` ref.
   */
  onSend?: () => void;
  /** Parent send-in-flight flag — disables the modal's Send while a send runs. */
  sending?: boolean;
}

export const TemplateComposer = forwardRef<TemplateComposerHandle, Props>(
  function TemplateComposer(
    {
      active,
      contactId,
      channel,
      workspaceId,
      templateOnly,
      onReadyChange,
      onSend,
      sending,
    },
    ref
  ) {
    const [templatesLoading, setTemplatesLoading] = useState(false);
    /** True after a template list request finishes (even if the list is empty). Stops fetch loops when `templateOptions` stays []. */
    const [templateListFetched, setTemplateListFetched] = useState(false);
    const [templatesError, setTemplatesError] = useState<string | null>(null);
    const [templateOptions, setTemplateOptions] = useState<Template[]>([]);
    const [selectedTemplateId, setSelectedTemplateId] = useState("");
    // The chosen Template object. The modal's tabs (Recent/Utility/Marketing/
    // Starred) can surface templates that aren't in this composer's own list
    // fetch, so we keep the picked Template here; the version/media effects
    // resolve the WhatsApp channel template from it (falling back to the list).
    const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(
      null
    );
    /** Whether the template-picker modal is open. */
    const [pickerOpen, setPickerOpen] = useState(false);
    const [selectedTemplateVersion, setSelectedTemplateVersion] = useState<{
      id: string;
      version: number;
      status: string;
    } | null>(null);
    const [templateVersionLoading, setTemplateVersionLoading] = useState(false);
    const [templateVariables, setTemplateVariables] = useState<
      TemplateVariableRow[]
    >([]);
    // Text placeholder keys the selected template requires (from GET .../state).
    // Drives auto-populated variable inputs so the agent isn't left guessing.
    const [requiredVariableKeys, setRequiredVariableKeys] = useState<string[]>([]);
    const [inboxTemplateVersionDetail, setInboxTemplateVersionDetail] =
      useState<ChannelTemplateVersion | null>(null);
    const [inboxTemplateVersionDetailLoading, setInboxTemplateVersionDetailLoading] =
      useState(false);
    const [templateHeaderMediaId, setTemplateHeaderMediaId] = useState<
      string | null
    >(null);
    const [templateCarouselMediaIds, setTemplateCarouselMediaIds] = useState<
      string[]
    >([]);
    const [templateBindingUploadBusy, setTemplateBindingUploadBusy] =
      useState(false);
    const [templateBindingError, setTemplateBindingError] = useState<
      string | null
    >(null);

    // Prefer the Template picked in the modal; fall back to the composer's own
    // list fetch so the original resolution path still works.
    const selectedTemplateObj = useMemo(() => {
      if (selectedTemplate && selectedTemplate.id === selectedTemplateId) {
        return selectedTemplate;
      }
      return templateOptions.find((t) => t.id === selectedTemplateId) ?? null;
    }, [selectedTemplate, selectedTemplateId, templateOptions]);

    const waChannelTemplateId = useMemo(() => {
      if (!selectedTemplateId) return null;
      const wa = (selectedTemplateObj?.channelTemplates ?? []).find(
        (ct) => ct.channel === "WHATSAPP"
      );
      return wa?.id ?? null;
    }, [selectedTemplateId, selectedTemplateObj]);

    const needsTemplateHeaderMedia = useMemo(
      () =>
        inboxTemplateVersionDetail != null &&
        isMediaHeaderType(inboxTemplateVersionDetail.headerType),
      [inboxTemplateVersionDetail]
    );

    const templateCarouselCardCount = useMemo(() => {
      if (inboxTemplateVersionDetail?.layoutType !== "CAROUSEL") return 0;
      const cards = inboxTemplateVersionDetail.carouselCards;
      return Array.isArray(cards) ? cards.length : 0;
    }, [inboxTemplateVersionDetail]);

    const templateMediaBindingsReady = useMemo(() => {
      if (!active || !selectedTemplateVersion?.id) return true;
      if (inboxTemplateVersionDetailLoading) return false;
      if (!inboxTemplateVersionDetail) return false;
      if (needsTemplateHeaderMedia && !templateHeaderMediaId?.trim()) {
        return false;
      }
      if (templateCarouselCardCount > 0) {
        if (templateCarouselMediaIds.length < templateCarouselCardCount) {
          return false;
        }
        for (let i = 0; i < templateCarouselCardCount; i++) {
          if (!templateCarouselMediaIds[i]?.trim()) return false;
        }
      }
      return true;
    }, [
      active,
      selectedTemplateVersion?.id,
      inboxTemplateVersionDetailLoading,
      inboxTemplateVersionDetail,
      needsTemplateHeaderMedia,
      templateHeaderMediaId,
      templateCarouselCardCount,
      templateCarouselMediaIds,
    ]);

    const templateVariablesPayload = useMemo(() => {
      const entries = templateVariables
        .map((row) => ({
          key: row.key.trim(),
          value: row.value.trim(),
        }))
        .filter((row) => row.key && row.value);
      const fromRows: Record<string, string> = entries.length
        ? Object.fromEntries(entries.map((row) => [row.key, row.value]))
        : {};
      const merged: Record<string, string> = { ...fromRows };

      if (
        inboxTemplateVersionDetail &&
        isMediaHeaderType(inboxTemplateVersionDetail.headerType) &&
        templateHeaderMediaId?.trim()
      ) {
        const ht = inboxTemplateVersionDetail.headerType;
        const id = templateHeaderMediaId.trim();
        if (ht === "IMAGE") merged.header_image = id;
        else if (ht === "VIDEO") merged.header_video = id;
        else if (ht === "DOCUMENT") merged.header_document = id;
      }

      if (
        inboxTemplateVersionDetail?.layoutType === "CAROUSEL" &&
        Array.isArray(inboxTemplateVersionDetail.carouselCards)
      ) {
        const cards = inboxTemplateVersionDetail.carouselCards as unknown[];
        cards.forEach((card, idx) => {
          const mid = templateCarouselMediaIds[idx]?.trim();
          if (!mid) return;
          const fmt = String(
            (card as { headerFormat?: string })?.headerFormat ?? "IMAGE"
          ).toUpperCase();
          const suffix =
            fmt === "VIDEO" ? "video" : fmt === "DOCUMENT" ? "document" : "image";
          merged[`card_${idx + 1}_header_${suffix}`] = mid;
        });
      }

      if (Object.keys(merged).length === 0) return undefined;
      return merged;
    }, [
      templateVariables,
      inboxTemplateVersionDetail,
      templateHeaderMediaId,
      templateCarouselMediaIds,
    ]);

    const templateVarsAreValid = useMemo(() => {
      if (!active) return true;
      if (!templateVariables.length) return true;
      return templateVariables.every(
        (row) => row.key.trim().length > 0 && row.value.trim().length > 0
      );
    }, [templateVariables, active]);

    const loadTemplateOptions = useCallback(async () => {
      setTemplatesLoading(true);
      setTemplatesError(null);
      try {
        const res = await templatesApi.list({
          isActive: true,
          hasWhatsAppSendableVersion: true,
          limit: 50,
          sortBy: "updatedAt",
          sortOrder: "desc",
        });

        setTemplateOptions(res.items ?? []);
      } catch (error: unknown) {
        setTemplatesError(
          extractApiErrorMessage(error) || "Failed to load templates."
        );
      } finally {
        setTemplatesLoading(false);
        setTemplateListFetched(true);
      }
    }, []);

    const updateTemplateVariableRow = useCallback(
      (id: string, patch: Partial<Pick<TemplateVariableRow, "key" | "value">>) => {
        setTemplateVariables((rows) =>
          rows.map((row) => (row.id === id ? { ...row, ...patch } : row))
        );
      },
      []
    );

    const addTemplateVariableRow = useCallback(() => {
      setTemplateVariables((rows) => [...rows, newTemplateVariableRow()]);
    }, []);

    const removeTemplateVariableRow = useCallback((id: string) => {
      setTemplateVariables((rows) => {
        return rows.filter((row) => row.id !== id);
      });
    }, []);

    const reset = useCallback(() => {
      setSelectedTemplateId("");
      setSelectedTemplate(null);
      setSelectedTemplateVersion(null);
      setTemplateVariables([]);
      setTemplatesError(null);
      setPickerOpen(false);
    }, []);

    /** Select a template from the modal — stores the object + id so the version
     * effect can resolve it even when it's not in the composer's own list. */
    const handleSelectTemplate = useCallback((tpl: Template) => {
      setSelectedTemplate(tpl);
      setSelectedTemplateId(tpl.id);
    }, []);

    // Reload the workspace-scoped template list when the workspace changes.
    useEffect(() => {
      setTemplateListFetched(false);
    }, [workspaceId]);

    useEffect(() => {
      if (!active || channel !== "WHATSAPP") {
        setTemplateListFetched(false);
        return;
      }
      if (templatesLoading || templateListFetched) return;
      void loadTemplateOptions();
    }, [
      active,
      channel,
      templatesLoading,
      templateListFetched,
      loadTemplateOptions,
    ]);

    useEffect(() => {
      if (!selectedTemplateId) {
        setSelectedTemplateVersion(null);
        return;
      }
      let cancelled = false;
      setTemplateVersionLoading(true);
      const wa = (selectedTemplateObj?.channelTemplates ?? []).find(
        (ct) => ct.channel === "WHATSAPP"
      );
      if (!wa?.id) {
        setSelectedTemplateVersion(null);
        setRequiredVariableKeys([]);
        setTemplateVersionLoading(false);
        return;
      }

      void channelTemplatesApi
        .state(wa.id)
        .then((state) => {
          if (cancelled) return;
          setRequiredVariableKeys(state.requiredVariableKeys ?? []);
          const v = state.latestSendableVersion;
          if (!v) {
            setSelectedTemplateVersion(null);
            return;
          }
          setSelectedTemplateVersion({ id: v.id, version: v.version, status: v.status });
        })
        .catch(() => {
          if (cancelled) return;
          setSelectedTemplateVersion(null);
          setRequiredVariableKeys([]);
        })
        .finally(() => {
          if (cancelled) return;
          setTemplateVersionLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, [selectedTemplateId, selectedTemplateObj]);

    useEffect(() => {
      setTemplateHeaderMediaId(null);
      setTemplateCarouselMediaIds([]);
      setTemplateBindingError(null);
      setInboxTemplateVersionDetail(null);
    }, [selectedTemplateId, selectedTemplateVersion?.id]);

    // Auto-populate the variable inputs from the template's required text keys, so
    // the agent sees exactly which values to fill instead of guessing. Preserves
    // anything already typed (by key). Media slots have their own uploaders.
    useEffect(() => {
      if (!active) return;
      setTemplateVariables((prev) => {
        const byKey = new Map(prev.map((r) => [r.key, r.value]));
        return requiredVariableKeys.map((k) => ({
          id: `req-${k}`,
          key: k,
          value: byKey.get(k) ?? "",
        }));
      });
    }, [requiredVariableKeys, active]);

    useEffect(() => {
      if (
        !active ||
        !waChannelTemplateId ||
        !selectedTemplateVersion?.id
      ) {
        setInboxTemplateVersionDetail(null);
        setInboxTemplateVersionDetailLoading(false);
        return;
      }
      let cancelled = false;
      setInboxTemplateVersionDetailLoading(true);
      void channelTemplatesApi
        .listVersions(waChannelTemplateId)
        .then((versions) => {
          if (cancelled) return;
          const v = versions.find((x) => x.id === selectedTemplateVersion.id);
          setInboxTemplateVersionDetail(v ?? null);
        })
        .catch(() => {
          if (cancelled) return;
          setInboxTemplateVersionDetail(null);
        })
        .finally(() => {
          if (!cancelled) setInboxTemplateVersionDetailLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, [active, waChannelTemplateId, selectedTemplateVersion?.id]);

    useEffect(() => {
      const cards = inboxTemplateVersionDetail?.carouselCards;
      if (
        inboxTemplateVersionDetail?.layoutType === "CAROUSEL" &&
        Array.isArray(cards)
      ) {
        const n = cards.length;
        setTemplateCarouselMediaIds((prev) => {
          if (prev.length === n) return prev;
          return Array.from({ length: n }, (_, i) => prev[i] ?? "");
        });
      } else {
        setTemplateCarouselMediaIds([]);
      }
    }, [inboxTemplateVersionDetail]);

    // Reset the picker when the conversation/contact changes.
    useEffect(() => {
      reset();
    }, [contactId, reset]);

    const ready =
      active &&
      !!selectedTemplateId &&
      !!selectedTemplateVersion?.id &&
      selectedTemplateVersion?.status === "PROVIDER_APPROVED" &&
      templateVarsAreValid &&
      templateMediaBindingsReady &&
      !templateBindingUploadBusy;

    // Surface readiness to the parent whenever the predicate flips.
    useEffect(() => {
      onReadyChange(ready);
    }, [ready, onReadyChange]);

    // Ensure the parent doesn't hold a stale "ready" when we unmount.
    useEffect(() => {
      return () => onReadyChange(false);
    }, [onReadyChange]);

    const getSendPayload = useCallback((): {
      channelTemplateVersionId: string;
      templateVariables: Record<string, string> | undefined;
    } | null => {
      if (!ready) return null;
      const versionId = selectedTemplateVersion?.id;
      if (!versionId) return null;
      return {
        channelTemplateVersionId: versionId,
        templateVariables: templateVariablesPayload,
      };
    }, [ready, selectedTemplateVersion, templateVariablesPayload]);

    useImperativeHandle(
      ref,
      () => ({ getSendPayload, reset }),
      [getSendPayload, reset]
    );

    // WhatsApp category of the selected template (for the preview badge).
    const selectedCategory = useMemo(() => {
      const c = getWaCategory(selectedTemplateObj?.channelTemplates);
      return c === "MARKETING" || c === "UTILITY" || c === "AUTHENTICATION"
        ? c
        : null;
    }, [selectedTemplateObj]);

    // Live-preview substitutions keyed by variable token, so the bubble
    // re-renders as the agent types values.
    const previewSampleValues = useMemo(() => {
      const out: Record<string, string> = {};
      for (const row of templateVariables) {
        const k = row.key.trim();
        if (k) out[k] = row.value;
      }
      return out;
    }, [templateVariables]);

    const previewButtons = useMemo<WhatsAppTemplatePreviewProps["buttons"]>(
      () =>
        Array.isArray(inboxTemplateVersionDetail?.buttons)
          ? (inboxTemplateVersionDetail?.buttons as WhatsAppTemplatePreviewProps["buttons"])
          : null,
      [inboxTemplateVersionDetail]
    );

    const previewCards = useMemo<WhatsAppTemplatePreviewProps["carouselCards"]>(
      () =>
        Array.isArray(inboxTemplateVersionDetail?.carouselCards)
          ? (inboxTemplateVersionDetail?.carouselCards as WhatsAppTemplatePreviewProps["carouselCards"])
          : null,
      [inboxTemplateVersionDetail]
    );

    if (!active || channel !== "WHATSAPP") return null;

    const detailPane = !selectedTemplateId ? (
      <div className="flex h-full min-h-40 items-center justify-center rounded-box border border-dashed border-base-300 p-6 text-center text-sm text-base-content/50">
        Pick a template on the left to preview it and fill in its values.
      </div>
    ) : (
      <div className="space-y-3">
        <p className="text-xs text-base-content/60">
          {templateVersionLoading
            ? "Loading latest approved version…"
            : selectedTemplateVersion
              ? `Version ${selectedTemplateVersion.version} · ${
                  selectedTemplateVersion.status === "PROVIDER_APPROVED"
                    ? "Approved"
                    : selectedTemplateVersion.status
                }`
              : "No approved version available for this template."}
        </p>
        {inboxTemplateVersionDetailLoading ? (
          <div className="flex items-center gap-2 text-sm text-base-content/70">
            <span className="loading loading-spinner loading-sm" />
            Loading template details…
          </div>
        ) : inboxTemplateVersionDetail ? (
          <WhatsAppTemplatePreview
            headerType={inboxTemplateVersionDetail.headerType}
            headerContent={inboxTemplateVersionDetail.headerContent}
            headerPreviewUrl={inboxTemplateVersionDetail.headerPreviewUrl}
            body={inboxTemplateVersionDetail.body ?? ""}
            footer={inboxTemplateVersionDetail.footer}
            buttons={previewButtons}
            layoutType={inboxTemplateVersionDetail.layoutType}
            carouselCards={previewCards}
            category={selectedCategory}
            language={inboxTemplateVersionDetail.language}
            limitedTimeOffer={inboxTemplateVersionDetail.limitedTimeOffer}
            sampleValues={previewSampleValues}
            className="w-full space-y-2 rounded-box border border-base-300 border-l-2 border-l-success bg-base-100 p-3"
          />
        ) : selectedTemplateVersion?.id ? (
          <div
            role="alert"
            className="rounded-box border border-warning/30 border-l-2 border-l-warning bg-base-200 px-3 py-2 text-sm"
          >
            Could not load template details. Try re-selecting the template.
          </div>
        ) : null}
          {selectedTemplateVersion?.id && inboxTemplateVersionDetail ? (
            <div className="space-y-2">
                  {needsTemplateHeaderMedia &&
                    inboxTemplateVersionDetail.headerType ? (
                    <div className="rounded-none bg-base-200/40 p-3">
                      <p className="text-sm font-medium text-base-content">
                        Header media (
                        {inboxTemplateVersionDetail.headerType})
                      </p>
                      <p className="mt-1 text-xs text-base-content/60">
                        WhatsApp requires media for this template
                        header. Upload a file; it is prepared for this
                        send only.
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <input
                          type="file"
                          className="file-input file-input-bordered file-input-sm w-full max-w-xs"
                          accept={
                            inboxTemplateVersionDetail.headerType ===
                              "VIDEO"
                              ? "video/mp4,video/3gpp"
                              : inboxTemplateVersionDetail.headerType ===
                                "DOCUMENT"
                                ? "application/pdf,application/*"
                                : "image/jpeg,image/png,image/webp,image/gif"
                          }
                          disabled={templateBindingUploadBusy}
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            e.target.value = "";
                            if (!file) return;
                            setTemplateBindingError(null);
                            setTemplateBindingUploadBusy(true);
                            try {
                              const id =
                                await uploadWhatsAppAttachmentIdAndPrepareWhatsApp(
                                  file
                                );
                              setTemplateHeaderMediaId(id);
                            } catch (err: unknown) {
                              setTemplateBindingError(
                                extractApiErrorMessage(err) ||
                                "Upload failed. Try a smaller file or supported format."
                              );
                            } finally {
                              setTemplateBindingUploadBusy(false);
                            }
                          }}
                        />
                        {templateHeaderMediaId ? (
                          <span className="op-tag op-tag-ok">Ready</span>
                        ) : (
                          <span className="op-tag op-tag-warn">Required</span>
                        )}
                      </div>
                    </div>
                  ) : null}

                  {templateCarouselCardCount > 0 ? (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-base-content">
                        Carousel cards ({templateCarouselCardCount})
                      </p>
                      <p className="text-xs text-base-content/60">
                        Each card needs header media for WhatsApp.
                      </p>
                      {Array.from(
                        { length: templateCarouselCardCount },
                        (_, idx) => {
                          const card = (
                            inboxTemplateVersionDetail
                              .carouselCards as unknown[]
                          )?.[idx];
                          return (
                            <div
                              key={idx}
                              className="rounded-none bg-base-100 p-3"
                            >
                              <p className="text-xs font-medium text-base-content/80">
                                Card {idx + 1}
                              </p>
                              <input
                                type="file"
                                className="file-input file-input-bordered file-input-sm mt-2 w-full max-w-xs"
                                accept={carouselCardFileAccept(card)}
                                disabled={templateBindingUploadBusy}
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  e.target.value = "";
                                  if (!file) return;
                                  setTemplateBindingError(null);
                                  setTemplateBindingUploadBusy(true);
                                  try {
                                    const id =
                                      await uploadWhatsAppAttachmentIdAndPrepareWhatsApp(
                                        file
                                      );
                                    setTemplateCarouselMediaIds(
                                      (prev) => {
                                        const next = [...prev];
                                        next[idx] = id;
                                        return next;
                                      }
                                    );
                                  } catch (err: unknown) {
                                    setTemplateBindingError(
                                      extractApiErrorMessage(err) ||
                                      "Upload failed for this card."
                                    );
                                  } finally {
                                    setTemplateBindingUploadBusy(
                                      false
                                    );
                                  }
                                }}
                              />
                              {templateCarouselMediaIds[idx] ? (
                                <span className="mt-1 inline-block text-xs text-success">
                                  Uploaded
                                </span>
                              ) : null}
                            </div>
                          );
                        }
                      )}
                    </div>
                  ) : null}

                  {templateBindingError ? (
                    <div
                      role="alert"
                      className="rounded-box border border-error/30 border-l-2 border-l-error bg-base-200 px-3 py-2 text-sm"
                    >
                      {templateBindingError}
                    </div>
                  ) : null}
            </div>
          ) : null}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs text-base-content/65">
                Template variables
                {requiredVariableKeys.length > 0 ? (
                  <span className="ml-1 text-base-content/45">
                    · {requiredVariableKeys.length} required
                  </span>
                ) : null}
              </p>
              <button
                type="button"
                className="btn btn-ghost btn-xs"
                onClick={addTemplateVariableRow}
              >
                Add variable
              </button>
            </div>
            {templateVariables.length === 0 ? (
              <p className="text-xs text-base-content/45">
                This template has no variables to fill.
              </p>
            ) : (
              templateVariables.map((row) => {
                const isRequired = requiredVariableKeys.includes(
                  row.key
                );
                return (
                  <div
                    key={row.id}
                    className="flex items-center gap-2"
                  >
                    {isRequired ? (
                      <span
                        className="w-1/3 truncate text-xs text-base-content/70"
                        title={row.key}
                      >
                        {variableKeyLabel(row.key)}
                      </span>
                    ) : (
                      <input
                        type="text"
                        className="input input-bordered input-sm w-1/3"
                        placeholder="key"
                        value={row.key}
                        onChange={(event) =>
                          updateTemplateVariableRow(row.id, {
                            key: event.target.value,
                          })
                        }
                      />
                    )}
                    <TemplateValueField
                      kind={variableInputKind(row.key)}
                      className="flex-1"
                      value={row.value}
                      placeholder={
                        isRequired
                          ? `value for ${variableKeyLabel(row.key)}`
                          : "value"
                      }
                      onChange={(next) =>
                        updateTemplateVariableRow(row.id, {
                          value: next,
                        })
                      }
                    />
                    {!isRequired ? (
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs"
                        onClick={() =>
                          removeTemplateVariableRow(row.id)
                        }
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        </div>
    );

    return (
      <div className="space-y-2">
        {templatesError ? (
          <div
            role="alert"
            className="rounded-box border border-warning/30 border-l-2 border-l-warning bg-base-200 px-3 py-2 text-sm"
          >
            {templatesError}
          </div>
        ) : null}

        {!selectedTemplateId ? (
          <button
            type="button"
            className="btn btn-primary btn-sm w-full justify-center gap-2"
            onClick={() => setPickerOpen(true)}
          >
            <FileText className="h-4 w-4" />
            Use a template
          </button>
        ) : (
          <div className="flex items-center justify-between gap-2 rounded-box border border-base-300 bg-base-100 px-3 py-2">
            <div className="flex min-w-0 items-center gap-2">
              <FileText className="h-4 w-4 shrink-0 text-primary" />
              <div className="min-w-0">
                <p className="text-[0.625rem] uppercase tracking-wide text-base-content/50">
                  Template
                </p>
                <p className="truncate text-sm font-medium text-base-content">
                  {selectedTemplateObj?.name ?? "Selected template"}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                className="btn btn-ghost btn-xs"
                onClick={() => setPickerOpen(true)}
              >
                Change
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-xs btn-square"
                aria-label="Clear template"
                onClick={reset}
              >
                <XIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {templateOnly ? (
          <p className="text-[0.625rem] text-base-content/50">
            Outside the 24-hour window — only approved templates can be sent.
          </p>
        ) : null}

        <TemplatePickerModal
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
          workspaceId={workspaceId}
          selectedTemplateId={selectedTemplateId}
          onSelectTemplate={handleSelectTemplate}
          ready={ready}
          sending={sending}
          onSend={onSend}
        >
          {detailPane}
        </TemplatePickerModal>
      </div>
    );
  }
);
