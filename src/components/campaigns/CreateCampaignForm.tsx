"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getApiError } from "@/lib/api-error";
import { campaignsApi, contactsApi, channelTemplatesApi, segmentsApi } from "@/lib/api";
import type { ChannelTemplateVersion, Segment } from "@/lib/types";
import {
  isMediaHeaderType,
  uploadMediaRowIdAndPrepareWhatsApp,
} from "@/lib/whatsappTemplateMedia";
import { InfoTip } from "@/components/ui/InfoTip";
import { WhatsAppTemplatePreviewFromVersion } from "@/components/templates/WhatsAppTemplatePreview";
import { useRightPanel } from "@/components/right-panel/RightPanelProvider";

export type CampaignCreateTemplate = {
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

/** Matches API CampaignAudienceType. SEGMENT uses a saved segment's `query` as `audienceQuery`. */
const AUDIENCE_TYPES = ["ALL", "SPECIFIC", "SEGMENT"] as const;

const WIZARD_STEPS = [
  {
    short: "Template",
    title: "Choose a message",
    description: "Pick a WhatsApp template with a live approved version.",
  },
  {
    short: "Media",
    title: "Template media",
    description:
      "Upload header or carousel assets when your template requires them.",
  },
  {
    short: "Audience",
    title: "Who receives this",
    description:
      "All contacts, hand-picked contacts, or a saved segment (People → Segments).",
  },
  {
    short: "Review",
    title: "Review & send",
    description:
      "Final check before sending. Resolved audience, message preview, and delivery settings.",
  },
] as const;

export function CreateCampaignForm({
  templates,
}: {
  templates: CampaignCreateTemplate[];
}) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [audienceType, setAudienceType] =
    useState<(typeof AUDIENCE_TYPES)[number]>("ALL");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactsLoaded, setContactsLoaded] = useState(false);
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [channelTemplateVersionId, setChannelTemplateVersionId] = useState("");
  const [channelWaTemplateId, setChannelWaTemplateId] = useState<string | null>(
    null
  );
  const [versionDetail, setVersionDetail] = useState<ChannelTemplateVersion | null>(
    null
  );
  const [versionDetailLoading, setVersionDetailLoading] = useState(false);
  const [headerMediaId, setHeaderMediaId] = useState<string | null>(null);
  const [headerPreviewUrl, setHeaderPreviewUrl] = useState<string | null>(null);
  const [carouselCardMediaIds, setCarouselCardMediaIds] = useState<string[]>(
    []
  );
  const [carouselCardPreviewUrls, setCarouselCardPreviewUrls] = useState<
    string[]
  >([]);
  const [bindingUploadBusy, setBindingUploadBusy] = useState(false);
  const [bindingFieldError, setBindingFieldError] = useState<string | null>(
    null
  );
  const [chunkSize, setChunkSize] = useState<string>("");
  const [throttlePerMin, setThrottlePerMin] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Review-step audience preview state — fetched on entering step 4.
  const [preview, setPreview] = useState<{
    audienceCount: number;
    sample: Array<{ id: string; name: string | null; phone: string }>;
    excludedBlocked: number;
    excludedOptedOut: number;
  } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const [segments, setSegments] = useState<Segment[]>([]);
  const [segmentsLoading, setSegmentsLoading] = useState(false);
  const [segmentsLoadError, setSegmentsLoadError] = useState<string | null>(null);
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(
    null
  );

  const { setContent: setRightPanel, clearContent: clearRightPanel } = useRightPanel();

  const canUseSelectedTemplate =
    !!templateId && channelTemplateVersionId.trim().length > 0;

  // Push template preview into the app's right panel
  useEffect(() => {
    if (!versionDetail) {
      clearRightPanel("campaign-preview");
      return;
    }

    const previewVersion =
      headerPreviewUrl || carouselCardPreviewUrls.length > 0
        ? {
            ...versionDetail,
            ...(headerPreviewUrl ? { headerPreviewUrl } : {}),
            ...(carouselCardPreviewUrls.length > 0 &&
            Array.isArray(versionDetail.carouselCards)
              ? {
                  carouselCards: (
                    versionDetail.carouselCards as Array<Record<string, unknown>>
                  ).map((card, i) => ({
                    ...card,
                    ...(carouselCardPreviewUrls[i]
                      ? { headerPreviewUrl: carouselCardPreviewUrls[i] }
                      : {}),
                  })),
                }
              : {}),
          }
        : versionDetail;

    setRightPanel({
      title: "Template preview",
      source: "campaign-preview",
      content: <WhatsAppTemplatePreviewFromVersion version={previewVersion} />,
      openAfter: true,
    });
  }, [versionDetail, headerPreviewUrl, carouselCardPreviewUrls, setRightPanel, clearRightPanel]);

  // Clear right panel on unmount
  useEffect(() => {
    return () => clearRightPanel("campaign-preview");
  }, [clearRightPanel]);

  useEffect(() => {
    let cancelled = false;
    void contactsApi.list({}).then((data) => {
      if (!cancelled) {
        setContacts(data.contacts ?? []);
        setContactsLoaded(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setSegmentsLoading(true);
    setSegmentsLoadError(null);
    void segmentsApi
      .list()
      .then((items) => {
        if (!cancelled) setSegments(Array.isArray(items) ? items : []);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setSegments([]);
          setSegmentsLoadError(
            getApiError(err) || "Could not load segments."
          );
        }
      })
      .finally(() => {
        if (!cancelled) setSegmentsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (audienceType !== "SEGMENT") {
      setSelectedSegmentId(null);
    }
  }, [audienceType]);

  useEffect(() => {
    if (!templateId) {
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
  }, [templateId, templates]);

  useEffect(() => {
    if (!channelWaTemplateId || !channelTemplateVersionId.trim()) {
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
  }, [channelWaTemplateId, channelTemplateVersionId]);

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

  /** Audience-preview fetch — runs when entering step 4 OR when the audience
   *  config changes while on step 4. Server-side resolution gives the user
   *  the actual sendable count (post blocked/opted-out exclusions). */
  useEffect(() => {
    if (step !== 4) return;
    let cancelled = false;
    setPreview(null);
    setPreviewError(null);
    setPreviewLoading(true);

    const audienceQuery =
      audienceType === "SEGMENT"
        ? (segments.find((s) => s.id === selectedSegmentId)?.query as
            | Record<string, unknown>
            | undefined) ?? undefined
        : undefined;
    const contactIds =
      audienceType === "SPECIFIC" ? selectedContacts : undefined;

    void campaignsApi
      .preview({ audienceType, contactIds, audienceQuery })
      .then((data) => {
        if (cancelled) return;
        setPreview(data);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setPreviewError(getApiError(err));
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [step, audienceType, selectedSegmentId, selectedContacts, segments]);

  const createCampaign = async () => {
    if (!templateId || !channelTemplateVersionId.trim()) {
      setError("Pick a message and provide a channelTemplateVersionId.");
      return;
    }
    if (audienceType === "SPECIFIC" && selectedContacts.length === 0) {
      setError("Select at least one contact, or choose audience \u201cAll contacts\u201d.");
      return;
    }
    if (audienceType === "SEGMENT") {
      const seg = segments.find((s) => s.id === selectedSegmentId);
      if (!seg?.query || typeof seg.query !== "object") {
        setError("Choose a saved segment, or create one under People → Segments.");
        return;
      }
    }
    if (!bindingsStepReady) {
      setError("Upload required template media (header or carousel cards) before creating.");
      return;
    }
    const parsedChunkSize = chunkSize.trim() ? Number(chunkSize) : undefined;
    const parsedThrottlePerMin = throttlePerMin.trim() ? Number(throttlePerMin) : undefined;
    if (parsedChunkSize !== undefined && (isNaN(parsedChunkSize) || parsedChunkSize < 10)) {
      setError("Chunk size must be at least 10.");
      return;
    }
    if (parsedThrottlePerMin !== undefined && (isNaN(parsedThrottlePerMin) || parsedThrottlePerMin < 1)) {
      setError("Throttle (messages/min) must be at least 1.");
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
      const segment =
        audienceType === "SEGMENT"
          ? segments.find((s) => s.id === selectedSegmentId)
          : undefined;
      const audienceQuery =
        audienceType === "SEGMENT" && segment?.query
          ? (segment.query as Record<string, unknown>)
          : undefined;

      const created = (await campaignsApi.create({
        name: friendlyName,
        channel: "WHATSAPP",
        channelTemplateVersionId: channelTemplateVersionId.trim(),
        ...(Object.keys(templateBindings).length > 0 && {
          templateBindings,
        }),
        audienceType,
        contactIds:
          audienceType === "SPECIFIC" ? selectedContacts : undefined,
        ...(audienceQuery != null ? { audienceQuery } : {}),
        ...(parsedChunkSize !== undefined ? { chunkSize: parsedChunkSize } : {}),
        ...(parsedThrottlePerMin !== undefined ? { throttlePerMin: parsedThrottlePerMin } : {}),
      })) as { id: string };
      router.push(`/campaigns?id=${encodeURIComponent(created.id)}`);
      router.refresh();
    } catch (err: unknown) {
      setError(getApiError(err) || "Failed to create campaign.");
    } finally {
      setLoading(false);
    }
  };

  const stepIndex = step - 1;
  const currentMeta = WIZARD_STEPS[stepIndex] ?? WIZARD_STEPS[0];

  return (
    <div className="mx-auto max-w-2xl">
      {error ? (
        <div role="alert" className="mb-4 rounded-box border border-error/30 border-l-2 border-l-error bg-base-200 px-3 py-2 text-sm">
          <span>{error}</span>
        </div>
      ) : null}

      <div className="flex min-h-[min(32rem,70vh)] flex-col card bg-base-100 border border-base-300 shadow-sm">
        {/* Single view: stepper + one content region (no full "screen" swaps). */}
        <div className="border-b border-base-300 px-3 py-4 sm:px-6">
          <ul className="steps steps-horizontal w-full overflow-x-auto pb-1">
            {WIZARD_STEPS.map((s, i) => (
              <li
                key={s.short}
                className={`step text-[0.65rem] sm:text-sm ${step >= i + 1 ? "step-primary" : ""}`}
              >
                {s.short}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-1 gap-6 px-4 py-5 sm:px-6">
          <div className="flex min-w-0 flex-1 flex-col">
          <header className="mb-4 shrink-0">
            <p className="op-label">
              Step {step} of {WIZARD_STEPS.length}
            </p>
            <h2 className="mt-1 text-lg font-semibold text-base-content">
              {currentMeta.title}
            </h2>
            <p className="mt-1 text-sm text-base-content/65">
              {currentMeta.description}
            </p>
          </header>

          <div
            className="min-h-[240px] flex-1 space-y-4"
            role="region"
            aria-live="polite"
            aria-label={currentMeta.title}
          >
          {step === 1 && (
            <div className="space-y-2">
              <select
                className="select select-bordered w-full"
                value={templateId || ""}
                onChange={(event) => setTemplateId(event.target.value || null)}
                disabled={templates.length === 0}
              >
                <option value="">
                  {templates.length === 0
                    ? "No approved WhatsApp templates"
                    : "Select a message"}
                </option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
              {templates.length === 0 && (
                <p className="text-sm text-base-content/60">
                  Only templates with a live WhatsApp-approved version appear
                  here. Submit & approve a version under Templates, then try
                  again.
                </p>
              )}
              {templateId && !canUseSelectedTemplate && (
                <div role="alert" className="rounded-box border border-warning/30 border-l-2 border-l-warning bg-base-200 px-3 py-2 text-sm">
                  <span>
                    No approved WhatsApp version available yet.
                  </span>
                </div>
              )}
            </div>
          )}
          {step === 2 && (
            <div className="space-y-3">
              {versionDetailLoading ? (
                <div className="flex items-center gap-2 text-sm text-base-content/70">
                  <span className="loading loading-spinner loading-sm" />
                  Loading template details…
                </div>
              ) : !versionDetail ? (
                <div role="alert" className="rounded-box border border-warning/30 border-l-2 border-l-warning bg-base-200 px-3 py-2 text-sm">
                  <span>
                    Could not load template version. Go back and re-select a
                    message.
                  </span>
                </div>
              ) : (
                <>
                  {needsHeaderMedia ? (
                    <div className="card bg-base-100 border border-base-300 p-3">
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
                              setHeaderPreviewUrl(URL.createObjectURL(file));
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
                          <span className="op-tag op-tag-ok">Ready</span>
                        ) : (
                          <span className="op-tag op-tag-warn">Required</span>
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
                            className="card bg-base-100 border border-base-300 p-3"
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
                                  setCarouselCardPreviewUrls((prev) => {
                                    const next = [...prev];
                                    next[idx] = URL.createObjectURL(file);
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

                  {bindingFieldError ? (
                    <div role="alert" className="rounded-box border border-error/30 border-l-2 border-l-error bg-base-200 px-3 py-2 text-sm">
                      {bindingFieldError}
                    </div>
                  ) : null}
                </>
              )}
            </div>
          )}
          {step === 3 && (
            <div className="space-y-3">
              <label className="label py-0">
                <span className="label-text text-sm font-medium">
                  Audience
                </span>
              </label>
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
                        : "Saved segment (filter)"}
                  </option>
                ))}
              </select>
              <p className="text-xs text-base-content/60">
                Saved segments are filters you manage from the{" "}
                <Link href="/people/contacts" className="link link-primary">
                  Contacts page
                </Link>
                . To use one, pick{" "}
                <span className="font-medium text-base-content/80">
                  Saved segment (filter)
                </span>{" "}
                above—then choose it in the list below.
              </p>
              {!segmentsLoading &&
              !segmentsLoadError &&
              segments.length > 0 &&
              audienceType !== "SEGMENT" ? (
                <div
                  role="status"
                  className="rounded-box border border-base-300 bg-base-200/50 px-3 py-2 text-xs text-base-content/75"
                >
                  {segments.length} saved segment
                  {segments.length === 1 ? "" : "s"} available — switch audience
                  to &quot;Saved segment (filter)&quot; to pick one.
                </div>
              ) : null}
              {audienceType === "SPECIFIC" && (
                <div className="max-h-48 overflow-y-auto card bg-base-100 border border-base-300 p-2">
                  {!contactsLoaded ? (
                    <p className="text-sm text-base-content/60">
                      Loading contacts…
                    </p>
                  ) : (
                    contacts.map((contact) => (
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
                    ))
                  )}
                </div>
              )}
              {audienceType === "SEGMENT" ? (
                <div className="space-y-2">
                  {segmentsLoading ? (
                    <p className="text-sm text-base-content/60">
                      Loading segments…
                    </p>
                  ) : segmentsLoadError ? (
                    <div role="alert" className="rounded-box border border-warning/30 border-l-2 border-l-warning bg-base-200 px-3 py-2 text-sm">
                      {segmentsLoadError}
                    </div>
                  ) : segments.length === 0 ? (
                    <p className="text-sm text-base-content/70">
                      No saved segments yet.{" "}
                      <Link
                        href="/people/contacts"
                        className="link link-primary"
                      >
                        Create a segment
                      </Link>{" "}
                      from the Contacts page, then return here.
                    </p>
                  ) : (
                    <>
                      <label className="label">
                        <span className="label-text text-sm">Segment</span>
                      </label>
                      <select
                        className="select select-bordered w-full"
                        value={selectedSegmentId ?? ""}
                        onChange={(e) =>
                          setSelectedSegmentId(e.target.value || null)
                        }
                      >
                        <option value="">Select a segment</option>
                        {segments.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                            {typeof s.contactCount === "number"
                              ? ` (~${s.contactCount} contacts)`
                              : ""}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-base-content/55">
                        Uses the segment&apos;s filter at create time. Manage
                        segments from the{" "}
                        <Link
                          href="/people/contacts"
                          className="link link-primary"
                        >
                          Contacts page
                        </Link>
                        .
                      </p>
                    </>
                  )}
                </div>
              ) : null}
            </div>
          )}

          {/* Advanced delivery settings (visible on step 3) */}
          {step === 3 && (
            <div className="mt-4 space-y-3 rounded-box border border-base-300 bg-base-200/30 p-4">
              <p className="text-sm font-medium text-base-content/70 flex items-center gap-1.5">
                Advanced delivery settings (optional)
                <InfoTip tip="Controls how fast messages are sent. Chunk size = messages per batch. Throttle = max messages per minute. Leave blank for safe defaults." />
              </p>
              <div className="grid grid-cols-2 gap-4">
                <label className="form-control">
                  <span className="label-text text-xs">Chunk size (min 10)</span>
                  <input
                    type="number"
                    className="input input-bordered input-sm"
                    placeholder="100"
                    min={10}
                    value={chunkSize}
                    onChange={(e) => setChunkSize(e.target.value)}
                  />
                </label>
                <label className="form-control">
                  <span className="label-text text-xs">Throttle (msgs/min, min 1)</span>
                  <input
                    type="number"
                    className="input input-bordered input-sm"
                    placeholder="60"
                    min={1}
                    value={throttlePerMin}
                    onChange={(e) => setThrottlePerMin(e.target.value)}
                  />
                </label>
              </div>
              <p className="text-xs text-base-content/50">
                Leave blank to use defaults (chunk: 100, throttle: 60/min).
              </p>
            </div>
          )}

          {/* ── Step 4 — Review & send ── */}
          {step === 4 && (
            <div className="space-y-4">
              {/* Audience */}
              <ReviewSection
                title="Audience"
                onEdit={() => setStep(3)}
              >
                {previewLoading ? (
                  <div className="flex items-center gap-2 text-[0.8125rem] text-base-content/55">
                    <span className="loading loading-spinner loading-xs" />
                    Resolving audience…
                  </div>
                ) : previewError ? (
                  <div role="alert" className="rounded-box border border-error/30 border-l-2 border-l-error bg-base-200 px-3 py-2">
                    <span className="op-label mb-1 block text-error">error</span>
                    <p className="text-[0.8125rem]">{previewError}</p>
                  </div>
                ) : preview ? (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-baseline gap-3">
                      <span className="font-mono-op text-[1.625rem] font-semibold tabular-nums">
                        {preview.audienceCount.toLocaleString()}
                      </span>
                      <span className="op-label">contacts will receive this</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-[0.71875rem]">
                      <span className="rounded-[3px] border border-base-300 bg-base-100 px-1.5 py-[1px] font-mono-op tracking-[0.04em] uppercase text-base-content/65">
                        {audienceType.toLowerCase()}
                      </span>
                      {audienceType === "SEGMENT" && selectedSegmentId ? (
                        <span className="text-base-content/60">
                          segment ·{" "}
                          <span className="text-base-content">
                            {segments.find((s) => s.id === selectedSegmentId)?.name ??
                              selectedSegmentId}
                          </span>
                        </span>
                      ) : null}
                      {(preview.excludedBlocked > 0 || preview.excludedOptedOut > 0) && (
                        <span className="text-warning">
                          {preview.excludedBlocked > 0
                            ? `${preview.excludedBlocked} blocked`
                            : null}
                          {preview.excludedBlocked > 0 && preview.excludedOptedOut > 0
                            ? " · "
                            : null}
                          {preview.excludedOptedOut > 0
                            ? `${preview.excludedOptedOut} opted out`
                            : null}
                          {" · skipped"}
                        </span>
                      )}
                    </div>
                    {preview.audienceCount === 0 ? (
                      <div role="alert" className="rounded-box border border-warning/30 border-l-2 border-l-warning bg-base-200 px-3 py-2">
                        <span className="op-label mb-1 block text-warning">empty audience</span>
                        <p className="text-[0.8125rem]">
                          No sendable contacts match this configuration. Go back and pick a different audience.
                        </p>
                      </div>
                    ) : (
                      <div className="rounded-box border border-base-300 bg-base-200">
                        <div className="border-b border-base-300 px-3 py-2">
                          <span className="op-label">
                            sample · first {preview.sample.length}
                          </span>
                        </div>
                        <ul className="divide-y divide-base-300/50">
                          {preview.sample.map((c) => (
                            <li key={c.id} className="flex items-center justify-between gap-3 px-3 py-2 text-[0.78125rem]">
                              <span className="truncate font-medium">
                                {c.name || "Unnamed"}
                              </span>
                              <span className="font-mono-op tabular-nums text-base-content/60">
                                {c.phone}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ) : null}
              </ReviewSection>

              {/* Message */}
              <ReviewSection
                title="Message"
                onEdit={() => setStep(1)}
              >
                {versionDetail ? (
                  <div className="space-y-3">
                    <div className="rounded-box border border-base-300 bg-base-100 p-3">
                      <WhatsAppTemplatePreviewFromVersion
                        version={
                          headerPreviewUrl || carouselCardPreviewUrls.length > 0
                            ? {
                                ...versionDetail,
                                ...(headerPreviewUrl ? { headerPreviewUrl } : {}),
                                ...(carouselCardPreviewUrls.length > 0 &&
                                Array.isArray(versionDetail.carouselCards)
                                  ? {
                                      carouselCards: versionDetail.carouselCards.map(
                                        (c, i) => ({
                                          ...c,
                                          ...(carouselCardPreviewUrls[i]
                                            ? { headerPreviewUrl: carouselCardPreviewUrls[i] }
                                            : {}),
                                        }),
                                      ),
                                    }
                                  : {}),
                              }
                            : versionDetail
                        }
                      />
                    </div>
                    <p className="text-[0.6875rem] text-base-content/50">
                      Variable placeholders ({"{{1}}"}, etc.) are filled by WhatsApp at send time using each contact&apos;s data + the template bindings configured for this campaign.
                    </p>
                  </div>
                ) : (
                  <div className="text-[0.8125rem] text-base-content/55">
                    Loading template preview…
                  </div>
                )}
              </ReviewSection>

              {/* Delivery */}
              <ReviewSection
                title="Delivery"
                onEdit={() => setStep(3)}
              >
                {(() => {
                  const cs = chunkSize.trim() ? Number(chunkSize) : 100;
                  const tp = throttlePerMin.trim() ? Number(throttlePerMin) : 60;
                  const count = preview?.audienceCount ?? 0;
                  const minutes = tp > 0 ? Math.ceil(count / tp) : 0;
                  const eta =
                    count === 0
                      ? "—"
                      : minutes < 1
                        ? "< 1 min"
                        : minutes < 60
                          ? `~${minutes} min`
                          : `~${(minutes / 60).toFixed(1)} hr`;
                  return (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 text-[0.8125rem]">
                      <div>
                        <span className="op-label block">Chunk size</span>
                        <span className="font-mono-op mt-0.5 block tabular-nums text-base-content">
                          {cs.toLocaleString()}
                          <span className="ml-1 text-base-content/45">msgs/batch</span>
                        </span>
                      </div>
                      <div>
                        <span className="op-label block">Throttle</span>
                        <span className="font-mono-op mt-0.5 block tabular-nums text-base-content">
                          {tp.toLocaleString()}
                          <span className="ml-1 text-base-content/45">msgs/min</span>
                        </span>
                      </div>
                      <div>
                        <span className="op-label block">Estimated duration</span>
                        <span className="font-mono-op mt-0.5 block tabular-nums text-primary">
                          {eta}
                        </span>
                      </div>
                    </div>
                  );
                })()}
              </ReviewSection>
            </div>
          )}
          </div>
          </div>
        </div>

        <div className="mt-auto flex flex-wrap items-center justify-end gap-2 border-t border-base-300 px-4 py-4 sm:px-6">
          <Link href="/campaigns" className="btn btn-ghost">
            Cancel
          </Link>
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
                (step === 1 &&
                  (!templateId || !canUseSelectedTemplate)) ||
                (step === 2 && !bindingsStepReady)
              }
            >
              Next
            </button>
          )}
          {step === 3 && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setStep(4)}
              disabled={
                (audienceType === "SPECIFIC" &&
                  selectedContacts.length === 0) ||
                (audienceType === "SEGMENT" &&
                  (!selectedSegmentId ||
                    segmentsLoading ||
                    segments.length === 0))
              }
            >
              Review →
            </button>
          )}
          {step === 4 && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={createCampaign}
              disabled={
                loading ||
                previewLoading ||
                !!previewError ||
                preview?.audienceCount === 0 ||
                (audienceType === "SPECIFIC" &&
                  selectedContacts.length === 0) ||
                (audienceType === "SEGMENT" &&
                  (!selectedSegmentId ||
                    segmentsLoading ||
                    segments.length === 0))
              }
            >
              {loading ? (
                <>
                  <span className="loading loading-spinner loading-xs" />
                  Sending…
                </>
              ) : (
                `Send campaign${preview?.audienceCount ? ` · ${preview.audienceCount.toLocaleString()}` : ""}`
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ReviewSection({
  title,
  onEdit,
  children,
}: {
  title: string;
  onEdit: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-box border border-base-300 bg-base-200">
      <div className="flex items-center justify-between gap-2 border-b border-base-300 px-4 py-2.5 sm:px-5">
        <h3 className="text-[0.8125rem] font-semibold tracking-[-0.01em]">{title}</h3>
        <button
          type="button"
          className="font-mono-op text-[0.625rem] tracking-[0.08em] uppercase text-base-content/55 transition-colors hover:text-primary"
          onClick={onEdit}
        >
          Edit
        </button>
      </div>
      <div className="px-4 py-3 sm:px-5">{children}</div>
    </div>
  );
}
