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

/** Matches API CampaignAudienceType. SEGMENT uses a saved segment’s `query` as `audienceQuery`. */
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
  const [carouselCardMediaIds, setCarouselCardMediaIds] = useState<string[]>(
    []
  );
  const [bindingUploadBusy, setBindingUploadBusy] = useState(false);
  const [bindingFieldError, setBindingFieldError] = useState<string | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [segmentsLoading, setSegmentsLoading] = useState(false);
  const [segmentsLoadError, setSegmentsLoadError] = useState<string | null>(null);
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(
    null
  );

  const canUseSelectedTemplate =
    !!templateId && channelTemplateVersionId.trim().length > 0;

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
        <div role="alert" className="alert alert-error mb-4 text-sm">
          <span>{error}</span>
        </div>
      ) : null}

      <div className="flex min-h-[min(32rem,70vh)] flex-col rounded-box border border-base-300 bg-base-100 shadow-sm">
        {/* Single view: stepper + one content region (no full “screen” swaps). */}
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

        <div className="flex flex-1 flex-col px-4 py-5 sm:px-6">
          <header className="mb-4 shrink-0">
            <p className="text-xs font-medium uppercase tracking-wide text-base-content/50">
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
                  here. Submit and approve a version under Templates, then try
                  again.
                </p>
              )}
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
                Saved segments are filters you manage under{" "}
                <Link href="/people/segments" className="link link-primary">
                  People → Segments
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
                <div className="max-h-48 overflow-y-auto rounded-box border border-base-300 bg-base-100 p-2">
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
                    <div role="alert" className="alert alert-warning alert-soft text-sm">
                      {segmentsLoadError}
                    </div>
                  ) : segments.length === 0 ? (
                    <p className="text-sm text-base-content/70">
                      No saved segments yet.{" "}
                      <Link
                        href="/people/segments"
                        className="link link-primary"
                      >
                        Create a segment
                      </Link>{" "}
                      under People, then return here.
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
                        segments in{" "}
                        <Link
                          href="/people/segments"
                          className="link link-primary"
                        >
                          People → Segments
                        </Link>
                        .
                      </p>
                    </>
                  )}
                </div>
              ) : null}
            </div>
          )}
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
              onClick={createCampaign}
              disabled={
                loading ||
                (audienceType === "SPECIFIC" &&
                  selectedContacts.length === 0) ||
                (audienceType === "SEGMENT" &&
                  (!selectedSegmentId ||
                    segmentsLoading ||
                    segments.length === 0))
              }
            >
              Create
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
