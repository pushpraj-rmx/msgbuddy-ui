"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { getApiError } from "@/lib/api-error";
import { campaignsApi, contactsApi, channelTemplatesApi, customFieldsApi, segmentsApi, usageApi } from "@/lib/api";
import type { ChannelTemplateVersion, Segment } from "@/lib/types";
import {
  isMediaHeaderType,
  uploadMediaRowIdAndPrepareWhatsApp,
} from "@/lib/whatsappTemplateMedia";
import { InfoTip } from "@/components/ui/InfoTip";
import { WhatsAppTemplatePreviewFromVersion } from "@/components/templates/WhatsAppTemplatePreview";
import { TemplateValueField } from "@/components/templates/TemplateValueField";
import { variableKeyLabel, variableInputKind } from "@/lib/template-variables";
import { getWaCategory } from "@/lib/templateCategory";
import { useRightPanel } from "@/components/right-panel/RightPanelProvider";

export type CampaignCreateTemplate = {
  id: string;
  name: string;
  channelTemplates?: Array<{
    id: string;
    channel: string;
    deletedAt?: string | null;
    category?: string | null;
  }>;
};

type Contact = {
  id: string;
  name?: string;
  phone: string;
};

/** Matches API CampaignAudienceType. SEGMENT uses a saved segment's `query` as `audienceQuery`. */
const AUDIENCE_TYPES = ["ALL", "SPECIFIC", "SEGMENT"] as const;

/**
 * Mirrors the backend's MAX_CAMPAIGN_AUDIENCE_SIZE (campaigns.service.ts). The
 * server rejects starts above this; we surface it in the wizard so the user
 * isn't surprised at Start time.
 */
const MAX_CAMPAIGN_AUDIENCE_SIZE = 500_000;

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

/**
 * Subset of GET /campaigns/:id fields the wizard hydrates from. Optional everything
 * because a freshly-bootstrapped draft has almost no state yet.
 */
export type CampaignDraftSeed = {
  id: string;
  name?: string;
  description?: string | null;
  channelTemplateVersionId?: string | null;
  channelTemplateVersion?: {
    id: string;
    channelTemplate?: {
      id: string;
      templateId?: string | null;
    } | null;
  } | null;
  templateBindings?: Record<string, unknown> | null;
  audienceType?: "ALL" | "SPECIFIC" | "SEGMENT";
  audienceQuery?: Record<string, unknown> | null;
  contactIds?: string[];
  chunkSize?: number | null;
  throttlePerMin?: number | null;
};

export function CreateCampaignForm({
  templates,
  campaignId,
  initialCampaign,
}: {
  templates: CampaignCreateTemplate[];
  /** The draft Campaign row this wizard operates on. Always required — the new-campaign route bootstraps a draft and redirects here. */
  campaignId: string;
  initialCampaign?: CampaignDraftSeed;
}) {
  const router = useRouter();
  // Campaigns may only use MARKETING templates (Meta rules); hide UTILITY/AUTH.
  const visibleTemplates = useMemo(
    () => templates.filter((t) => getWaCategory(t.channelTemplates) === "MARKETING"),
    [templates],
  );
  const [step, setStep] = useState(1);
  const [name, setName] = useState<string>(initialCampaign?.name ?? "");
  const [description, setDescription] = useState<string>(
    initialCampaign?.description ?? "",
  );
  const [templateId, setTemplateId] = useState<string | null>(
    initialCampaign?.channelTemplateVersion?.channelTemplate?.templateId ?? null,
  );
  const [audienceType, setAudienceType] = useState<
    (typeof AUDIENCE_TYPES)[number]
  >(initialCampaign?.audienceType ?? "ALL");
  // Picker fetch state — replaces the old "load every contact upfront" model
  // which would freeze the browser on workspaces with 10K+ contacts. We now
  // fetch a paged + searchable view that scales to any audience size.
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactsLoaded, setContactsLoaded] = useState(false);
  const [contactsCursor, setContactsCursor] = useState<string | null>(null);
  const [contactsHasMore, setContactsHasMore] = useState(false);
  const [contactsLoadingMore, setContactsLoadingMore] = useState(false);
  const [contactsSearch, setContactsSearch] = useState("");
  /** Display rows for already-selected contacts that don't appear in the current page (so the user can still untick them). */
  const [selectedContactDetails, setSelectedContactDetails] = useState<
    Record<string, Contact>
  >({});
  const [selectedContacts, setSelectedContacts] = useState<string[]>(
    initialCampaign?.contactIds ?? [],
  );
  const [channelTemplateVersionId, setChannelTemplateVersionId] = useState(
    initialCampaign?.channelTemplateVersionId ?? "",
  );
  const [channelWaTemplateId, setChannelWaTemplateId] = useState<string | null>(
    initialCampaign?.channelTemplateVersion?.channelTemplate?.id ?? null,
  );
  const [versionDetail, setVersionDetail] = useState<ChannelTemplateVersion | null>(
    null
  );
  const [versionDetailLoading, setVersionDetailLoading] = useState(false);
  const [headerMediaId, setHeaderMediaId] = useState<string | null>(
    typeof initialCampaign?.templateBindings?.headerMediaId === "string"
      ? (initialCampaign.templateBindings.headerMediaId as string)
      : null,
  );
  const [headerPreviewUrl, setHeaderPreviewUrl] = useState<string | null>(null);
  const [carouselCardMediaIds, setCarouselCardMediaIds] = useState<string[]>(
    Array.isArray(initialCampaign?.templateBindings?.carouselCardMediaIds)
      ? (initialCampaign!.templateBindings!.carouselCardMediaIds as string[])
      : [],
  );
  const [carouselCardPreviewUrls, setCarouselCardPreviewUrls] = useState<
    string[]
  >([]);
  const [bindingUploadBusy, setBindingUploadBusy] = useState(false);
  const [bindingFieldError, setBindingFieldError] = useState<string | null>(
    null
  );
  // Per-placeholder binding: a contact field (filled per recipient) or a fixed value.
  const [variableBindings, setVariableBindings] = useState<
    Record<string, { mode: "field" | "static"; value: string }>
  >(() => {
    const out: Record<string, { mode: "field" | "static"; value: string }> = {};
    const b = initialCampaign?.templateBindings as
      | Record<string, unknown>
      | undefined;
    const fm = (b?.variableFieldMappings ?? {}) as Record<string, unknown>;
    const sv = (b?.staticVariables ?? {}) as Record<string, unknown>;
    for (const [k, v] of Object.entries(fm))
      if (typeof v === "string") out[k] = { mode: "field", value: v };
    for (const [k, v] of Object.entries(sv))
      if (typeof v === "string" && !(k in out))
        out[k] = { mode: "static", value: v };
    return out;
  });
  /** Placeholder keys the selected version requires (from channel-template state). */
  const [requiredVarKeys, setRequiredVarKeys] = useState<string[]>([]);
  /** Workspace contact fields offered as mapping targets. */
  const [contactFields, setContactFields] = useState<
    Array<{ name: string; label: string }>
  >([]);
  const [chunkSize, setChunkSize] = useState<string>(
    initialCampaign?.chunkSize != null ? String(initialCampaign.chunkSize) : "",
  );
  const [throttlePerMin, setThrottlePerMin] = useState<string>(
    initialCampaign?.throttlePerMin != null
      ? String(initialCampaign.throttlePerMin)
      : "",
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  /** Saved segment id if hydrating from an existing draft with audienceType=SEGMENT. */
  const initialSegmentId =
    initialCampaign?.audienceType === "SEGMENT" &&
    initialCampaign.audienceQuery &&
    typeof (initialCampaign.audienceQuery as Record<string, unknown>)
      .segmentId === "string"
      ? ((initialCampaign.audienceQuery as Record<string, unknown>)
          .segmentId as string)
      : null;

  // Review-step audience preview state — fetched on entering step 4.
  const [preview, setPreview] = useState<{
    audienceCount: number;
    sample: Array<{ id: string; name: string | null; phone: string }>;
    excludedBlocked: number;
    excludedOptedOut: number;
    /** MARKETING-only — contacts inside Meta's 24h cap window who'd be skipped at send time. */
    excludedFrequencyCapped?: number;
  } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  /** Message-quota probe for the review step — warns if audience > remaining quota. */
  const [quota, setQuota] = useState<{
    allowed: boolean;
    current: number;
    limit: number;
    reason?: string | null;
  } | null>(null);

  const [segments, setSegments] = useState<Segment[]>([]);
  const [segmentsLoading, setSegmentsLoading] = useState(false);
  const [segmentsLoadError, setSegmentsLoadError] = useState<string | null>(null);
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(
    initialSegmentId,
  );

  const { setContent: setRightPanel, clearContent: clearRightPanel } = useRightPanel();

  const canUseSelectedTemplate =
    !!templateId && channelTemplateVersionId.trim().length > 0;

  /** O(1) selected-contact lookup — array.includes was O(n²) per render at 5K+ contacts. */
  const selectedContactsSet = useMemo(
    () => new Set(selectedContacts),
    [selectedContacts],
  );

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

  // Debounced search-driven contact fetch. Only fires when the user is on the
  // audience step AND has chosen SPECIFIC — no point pre-fetching otherwise.
  useEffect(() => {
    if (step !== 3 || audienceType !== "SPECIFIC") return;
    const handle = window.setTimeout(() => {
      let cancelled = false;
      setContactsLoaded(false);
      void contactsApi
        .list({ search: contactsSearch.trim() || undefined, limit: 50 })
        .then((data) => {
          if (cancelled) return;
          setContacts(data.contacts ?? []);
          setContactsCursor(data.nextCursor ?? null);
          setContactsHasMore(!!data.nextCursor);
          setContactsLoaded(true);
        })
        .catch(() => {
          if (cancelled) return;
          setContacts([]);
          setContactsCursor(null);
          setContactsHasMore(false);
          setContactsLoaded(true);
        });
      return () => {
        cancelled = true;
      };
    }, 200);
    return () => window.clearTimeout(handle);
  }, [step, audienceType, contactsSearch]);

  // Hydrate display details for any already-selected contacts that aren't in
  // the current page (so the user can still see and untick them).
  useEffect(() => {
    for (const c of contacts) {
      if (
        selectedContacts.includes(c.id) &&
        !selectedContactDetails[c.id]
      ) {
        setSelectedContactDetails((prev) => ({ ...prev, [c.id]: c }));
      }
    }
  }, [contacts, selectedContacts, selectedContactDetails]);

  const loadMoreContacts = async () => {
    if (!contactsCursor || contactsLoadingMore) return;
    setContactsLoadingMore(true);
    try {
      const data = await contactsApi.list({
        search: contactsSearch.trim() || undefined,
        limit: 50,
        cursor: contactsCursor,
      });
      setContacts((prev) => [...prev, ...(data.contacts ?? [])]);
      setContactsCursor(data.nextCursor ?? null);
      setContactsHasMore(!!data.nextCursor);
    } finally {
      setContactsLoadingMore(false);
    }
  };

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

  // Every required placeholder must be bound to a contact field or a non-empty fixed value.
  const variablesReady = requiredVarKeys.every((k) => {
    const b = variableBindings[k];
    if (!b) return false;
    return b.value.trim().length > 0;
  });

  // Load workspace contact fields once — they are the mapping targets for variables.
  useEffect(() => {
    let cancelled = false;
    customFieldsApi
      .list()
      .then((fields) => {
        if (!cancelled)
          setContactFields(fields.map((f) => ({ name: f.name, label: f.label })));
      })
      .catch(() => {
        if (!cancelled) setContactFields([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Which placeholders the chosen version needs (computed server-side from its content).
  useEffect(() => {
    if (!channelWaTemplateId) {
      setRequiredVarKeys([]);
      return;
    }
    let cancelled = false;
    channelTemplatesApi
      .state(channelWaTemplateId)
      .then((st) => {
        if (!cancelled) setRequiredVarKeys(st.requiredVariableKeys ?? []);
      })
      .catch(() => {
        if (!cancelled) setRequiredVarKeys([]);
      });
    return () => {
      cancelled = true;
    };
  }, [channelWaTemplateId]);

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
    // For MARKETING templates, telling the backend the category surfaces
    // `excludedFrequencyCapped` — contacts inside Meta's 24h marketing cap
    // who'd be silently skipped at send time. Without this hint the count is
    // always 0 and the user is surprised mid-run.
    const templateCategory = versionDetail?.channelTemplate?.category as
      | "MARKETING"
      | "UTILITY"
      | "AUTHENTICATION"
      | undefined;

    void campaignsApi
      .preview({ audienceType, contactIds, audienceQuery, templateCategory })
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
  }, [step, audienceType, selectedSegmentId, selectedContacts, segments, versionDetail]);

  // Quota probe — fires on review step so we can warn before the user hits Save.
  useEffect(() => {
    if (step !== 4) return;
    let cancelled = false;
    const audienceCount = preview?.audienceCount ?? 0;
    if (audienceCount <= 0) {
      setQuota(null);
      return;
    }
    void usageApi
      .checkMessages(audienceCount)
      .then((data) => {
        if (cancelled) return;
        const d = data as {
          allowed: boolean;
          current: number;
          limit: number;
          reason?: string | null;
        };
        setQuota(d);
      })
      .catch(() => {
        if (cancelled) return;
        setQuota(null);
      });
    return () => {
      cancelled = true;
    };
  }, [step, preview?.audienceCount]);

  /**
   * Build the PUT payload from current state. Backend silently relaxes
   * binding validation on DRAFT updates so incomplete state is allowed
   * mid-wizard.
   */
  const buildDraftPayload = (): Record<string, unknown> => {
    const templateBindings: Record<string, unknown> = {};
    if (headerMediaId?.trim()) {
      templateBindings.headerMediaId = headerMediaId.trim();
    }
    if (carouselCardCount > 0) {
      templateBindings.carouselCardMediaIds = carouselCardMediaIds
        .slice(0, carouselCardCount)
        .map((id) => id.trim());
    }
    // Split per-placeholder bindings into fixed values vs per-recipient contact-field maps.
    const staticVariables: Record<string, string> = {};
    const variableFieldMappings: Record<string, string> = {};
    for (const [key, b] of Object.entries(variableBindings)) {
      if (b.mode === "field" && b.value.trim()) {
        variableFieldMappings[key] = b.value.trim();
      } else if (b.mode === "static" && b.value.trim()) {
        staticVariables[key] = b.value;
      }
    }
    if (Object.keys(staticVariables).length > 0) {
      templateBindings.staticVariables = staticVariables;
    }
    if (Object.keys(variableFieldMappings).length > 0) {
      templateBindings.variableFieldMappings = variableFieldMappings;
    }

    let audienceQuery: Record<string, unknown> | null | undefined;
    if (audienceType === "SEGMENT" && selectedSegmentId) {
      const segment = segments.find((s) => s.id === selectedSegmentId);
      if (segment?.query && typeof segment.query === "object") {
        // segmentId is embedded so hydration can re-select the segment when
        // the user resumes this draft later.
        audienceQuery = {
          ...(segment.query as Record<string, unknown>),
          segmentId: selectedSegmentId,
        };
      }
    } else if (audienceType !== "SEGMENT") {
      audienceQuery = null;
    }

    const parsedChunkSize = chunkSize.trim() ? Number(chunkSize) : undefined;
    const parsedThrottlePerMin = throttlePerMin.trim()
      ? Number(throttlePerMin)
      : undefined;

    return {
      ...(name.trim() ? { name: name.trim() } : {}),
      description,
      ...(channelTemplateVersionId.trim()
        ? { channelTemplateVersionId: channelTemplateVersionId.trim() }
        : {}),
      ...(Object.keys(templateBindings).length > 0
        ? { templateBindings }
        : {}),
      audienceType,
      ...(audienceQuery !== undefined ? { audienceQuery } : {}),
      ...(audienceType === "SPECIFIC"
        ? { contactIds: selectedContacts }
        : {}),
      ...(parsedChunkSize !== undefined && !isNaN(parsedChunkSize)
        ? { chunkSize: parsedChunkSize }
        : {}),
      ...(parsedThrottlePerMin !== undefined && !isNaN(parsedThrottlePerMin)
        ? { throttlePerMin: parsedThrottlePerMin }
        : {}),
    };
  };

  /** Persist current state. Throws on failure so callers decide whether to navigate. */
  const saveDraft = async (): Promise<void> => {
    if (savingDraft) return;
    setSavingDraft(true);
    setError(null);
    try {
      await campaignsApi.update(campaignId, buildDraftPayload());
      setLastSavedAt(new Date());
    } catch (err: unknown) {
      setError(getApiError(err) || "Failed to save draft.");
      throw err;
    } finally {
      setSavingDraft(false);
    }
  };

  /** Save current state and return to the campaigns list. Draft stays in DRAFT. */
  const saveAndExit = async () => {
    try {
      await saveDraft();
    } catch {
      return;
    }
    router.push("/campaigns");
    router.refresh();
  };

  /**
   * Final step: save draft and land on the campaign detail page where the
   * existing Start button opens the review-and-confirm dialog before actually
   * sending. We do NOT call /campaigns/:id/start here.
   */
  const finishDraft = async () => {
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
    if (!variablesReady) {
      setError("Bind every template variable to a contact field or a fixed value before creating.");
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
    try {
      await saveDraft();
      router.push(`/campaigns?id=${encodeURIComponent(campaignId)}`);
      router.refresh();
    } catch {
      // saveDraft already populated `error` state
    } finally {
      setLoading(false);
    }
  };

  /** Step transitions auto-save. Stay on current step if save fails. */
  const goNext = async (nextStep: number) => {
    try {
      await saveDraft();
      setStep(nextStep);
    } catch {
      // error is shown in the alert; user can retry
    }
  };
  /** Back is best-effort save — user shouldn't be trapped if save fails. */
  const goBack = async (prevStep: number) => {
    try {
      await saveDraft();
    } catch {
      // ignore
    }
    setStep(prevStep);
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
        {/* Always-visible campaign name; persists to the draft on blur. */}
        <div className="border-b border-base-300 px-4 py-3 sm:px-6">
          <label className="block">
            <span className="op-label mb-1 block">Campaign name</span>
            <input
              type="text"
              className="input input-bordered input-sm w-full font-medium"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => {
                if (name.trim() !== (initialCampaign?.name ?? "").trim()) {
                  void saveDraft();
                }
              }}
              placeholder="e.g. Holiday Promo 2026 — first wave"
              maxLength={120}
            />
          </label>
        </div>

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
            <div className="space-y-4">
              <label className="block">
                <span className="op-label mb-1 block">Template</span>
                <select
                  className="select select-bordered w-full"
                  value={templateId || ""}
                  onChange={(event) => setTemplateId(event.target.value || null)}
                  disabled={visibleTemplates.length === 0}
                >
                  <option value="">
                    {visibleTemplates.length === 0
                      ? "No approved Marketing templates"
                      : "Select a message"}
                  </option>
                  {visibleTemplates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
              </label>
              {visibleTemplates.length === 0 && (
                <p className="text-sm text-base-content/60">
                  Campaigns use <strong>Marketing</strong> templates with a live
                  WhatsApp-approved version. Create/approve one under Templates,
                  then try again.
                </p>
              )}
              {templateId && !canUseSelectedTemplate && (
                <div role="alert" className="rounded-box border border-warning/30 border-l-2 border-l-warning bg-base-200 px-3 py-2 text-sm">
                  <span>
                    No approved WhatsApp version available yet.
                  </span>
                </div>
              )}

              <label className="block">
                <span className="op-label mb-1 block">
                  Description <span className="text-base-content/45">(optional)</span>
                </span>
                <textarea
                  className="textarea textarea-bordered w-full"
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  onBlur={() => {
                    if (
                      description !==
                      (initialCampaign?.description ?? "")
                    ) {
                      void saveDraft();
                    }
                  }}
                  placeholder="Notes for your team — not sent to recipients."
                  maxLength={500}
                />
              </label>
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

                  {requiredVarKeys.length > 0 ? (
                    <div className="card bg-base-100 border border-base-300 p-3">
                      <p className="text-sm font-medium text-base-content">
                        Personalize variables
                      </p>
                      <p className="mt-1 text-xs text-base-content/60">
                        Bind each placeholder to a contact field (filled per
                        recipient) or a fixed value. Recipients missing a mapped
                        field are skipped at send time.
                      </p>
                      <div className="mt-2 space-y-2">
                        {requiredVarKeys.map((key) => {
                          const b =
                            variableBindings[key] ??
                            ({ mode: "field", value: "" } as const);
                          const ready = b.value.trim().length > 0;
                          return (
                            <div
                              key={key}
                              className="flex flex-wrap items-center gap-2"
                            >
                              <code className="font-mono-op rounded bg-base-200 px-1.5 py-0.5 text-[0.6875rem] text-primary">
                                {variableKeyLabel(key)}
                              </code>
                              <select
                                className="select select-bordered select-xs"
                                value={b.mode}
                                onChange={(e) =>
                                  setVariableBindings((prev) => ({
                                    ...prev,
                                    [key]: {
                                      mode: e.target.value as "field" | "static",
                                      value: "",
                                    },
                                  }))
                                }
                              >
                                <option value="field">Contact field</option>
                                <option value="static">Fixed value</option>
                              </select>
                              {b.mode === "field" ? (
                                <select
                                  className="select select-bordered select-xs min-w-[10rem]"
                                  value={b.value}
                                  onChange={(e) =>
                                    setVariableBindings((prev) => ({
                                      ...prev,
                                      [key]: { mode: "field", value: e.target.value },
                                    }))
                                  }
                                >
                                  <option value="">Select field…</option>
                                  <option value="name">Name</option>
                                  {contactFields.map((f) => (
                                    <option key={f.name} value={f.name}>
                                      {f.label || f.name}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <TemplateValueField
                                  kind={variableInputKind(key)}
                                  size="xs"
                                  className="min-w-[10rem]"
                                  value={b.value}
                                  placeholder="Fixed value for all recipients"
                                  onChange={(next) =>
                                    setVariableBindings((prev) => ({
                                      ...prev,
                                      [key]: { mode: "static", value: next },
                                    }))
                                  }
                                />
                              )}
                              {ready ? (
                                <span className="op-tag op-tag-ok">Set</span>
                              ) : (
                                <span className="op-tag op-tag-warn">Required</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
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
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="search"
                      className="input input-bordered input-sm flex-1"
                      placeholder="Search by name, phone, or email…"
                      value={contactsSearch}
                      onChange={(e) => setContactsSearch(e.target.value)}
                      data-esc-clearable="true"
                    />
                    <span className="text-xs tabular-nums text-base-content/60">
                      {selectedContacts.length.toLocaleString()} selected
                    </span>
                  </div>

                  <div className="max-h-72 overflow-y-auto card bg-base-100 border border-base-300 p-2">
                    {!contactsLoaded ? (
                      <p className="text-sm text-base-content/60">
                        Loading contacts…
                      </p>
                    ) : contacts.length === 0 ? (
                      <p className="text-sm text-base-content/60">
                        No contacts match{contactsSearch.trim() ? ` "${contactsSearch.trim()}"` : ""}.
                      </p>
                    ) : (
                      <>
                        {contacts.map((contact) => {
                          const checked = selectedContactsSet.has(contact.id);
                          return (
                            <label
                              key={contact.id}
                              className="flex items-center gap-2 py-1 text-sm"
                            >
                              <input
                                type="checkbox"
                                className="checkbox checkbox-sm"
                                checked={checked}
                                onChange={(event) => {
                                  setSelectedContacts((prev) =>
                                    event.target.checked
                                      ? [...prev, contact.id]
                                      : prev.filter((id) => id !== contact.id),
                                  );
                                  // Remember this contact's details so it
                                  // remains identifiable even if the user
                                  // searches away from it.
                                  if (event.target.checked) {
                                    setSelectedContactDetails((s) => ({
                                      ...s,
                                      [contact.id]: contact,
                                    }));
                                  }
                                }}
                              />
                              <span>
                                {contact.name || contact.phone} ({contact.phone})
                              </span>
                            </label>
                          );
                        })}
                        {contactsHasMore ? (
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm mt-1 w-full"
                            onClick={() => void loadMoreContacts()}
                            disabled={contactsLoadingMore}
                          >
                            {contactsLoadingMore ? (
                              <>
                                <span className="loading loading-spinner loading-xs" />
                                Loading…
                              </>
                            ) : (
                              "Load more"
                            )}
                          </button>
                        ) : null}
                      </>
                    )}
                  </div>

                  {/* Selected-but-not-on-screen tray — lets users untick
                      contacts they searched away from without losing them. */}
                  {selectedContacts.length > 0 ? (
                    <details className="card bg-base-200 border border-base-300 p-2">
                      <summary className="cursor-pointer text-xs font-medium text-base-content/70">
                        Selected ({selectedContacts.length})
                      </summary>
                      <ul className="mt-2 max-h-40 overflow-y-auto space-y-1">
                        {selectedContacts.map((id) => {
                          const c = selectedContactDetails[id];
                          return (
                            <li
                              key={id}
                              className="flex items-center justify-between gap-2 text-xs"
                            >
                              <span className="truncate">
                                {c
                                  ? `${c.name || c.phone} (${c.phone})`
                                  : id}
                              </span>
                              <button
                                type="button"
                                className="btn btn-ghost btn-xs"
                                onClick={() =>
                                  setSelectedContacts((prev) =>
                                    prev.filter((x) => x !== id),
                                  )
                                }
                                aria-label="Remove from selection"
                              >
                                ✕
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </details>
                  ) : null}
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
                      {(preview.excludedBlocked > 0 ||
                        preview.excludedOptedOut > 0 ||
                        (preview.excludedFrequencyCapped ?? 0) > 0) && (
                        <span className="text-warning">
                          {[
                            preview.excludedBlocked > 0
                              ? `${preview.excludedBlocked} blocked`
                              : null,
                            preview.excludedOptedOut > 0
                              ? `${preview.excludedOptedOut} opted out`
                              : null,
                            (preview.excludedFrequencyCapped ?? 0) > 0
                              ? `${preview.excludedFrequencyCapped} in 24h cap`
                              : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                          {" · skipped"}
                        </span>
                      )}
                    </div>
                    {preview.audienceCount > MAX_CAMPAIGN_AUDIENCE_SIZE ? (
                      <div role="alert" className="rounded-box border border-error/30 border-l-2 border-l-error bg-base-200 px-3 py-2">
                        <span className="op-label mb-1 block text-error">audience too large</span>
                        <p className="text-[0.8125rem]">
                          Max {MAX_CAMPAIGN_AUDIENCE_SIZE.toLocaleString()} contacts
                          per run — split into segments or stage across multiple
                          campaigns.
                        </p>
                      </div>
                    ) : null}
                    {quota && !quota.allowed ? (
                      <div role="alert" className="rounded-box border border-warning/30 border-l-2 border-l-warning bg-base-200 px-3 py-2">
                        <span className="op-label mb-1 block text-warning">message quota</span>
                        <p className="text-[0.8125rem]">
                          {quota.reason ??
                            `Your plan allows ${quota.limit.toLocaleString()} messages this period and you've used ${quota.current.toLocaleString()}. The campaign will start, but sends past the cap will fail.`}
                        </p>
                      </div>
                    ) : null}
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
                      Variable placeholders ({"{{1}}"}, etc.) are filled per recipient from the contact-field / fixed-value bindings set below. A recipient missing a mapped field is skipped at send time.
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
                  const tp = throttlePerMin.trim() ? Number(throttlePerMin) : 4200;
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

        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-base-300 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-2 text-[0.6875rem] text-base-content/55">
            {savingDraft ? (
              <>
                <span className="loading loading-spinner loading-xs" />
                Saving draft…
              </>
            ) : lastSavedAt ? (
              <>
                Draft saved · {lastSavedAt.toLocaleTimeString()}
              </>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/campaigns" className="btn btn-ghost">
              Cancel
            </Link>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => void saveAndExit()}
              disabled={savingDraft || loading}
              title="Saves your progress and returns to the campaigns list. You can resume any time."
            >
              Save & exit
            </button>
            {step > 1 && (
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => void goBack(step - 1)}
                disabled={savingDraft || loading}
              >
                Back
              </button>
            )}
            {step < 3 && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void goNext(step + 1)}
                disabled={
                  savingDraft ||
                  loading ||
                  (step === 1 &&
                    (!templateId || !canUseSelectedTemplate)) ||
                  (step === 2 && (!bindingsStepReady || !variablesReady))
                }
              >
                Next
              </button>
            )}
            {step === 3 && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void goNext(4)}
                disabled={
                  savingDraft ||
                  loading ||
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
                onClick={finishDraft}
                disabled={
                  loading ||
                  savingDraft ||
                  previewLoading ||
                  !!previewError ||
                  preview?.audienceCount === 0 ||
                  (preview?.audienceCount ?? 0) > MAX_CAMPAIGN_AUDIENCE_SIZE ||
                  (audienceType === "SPECIFIC" &&
                    selectedContacts.length === 0) ||
                  (audienceType === "SEGMENT" &&
                    (!selectedSegmentId ||
                      segmentsLoading ||
                      segments.length === 0))
                }
                title="Saves the campaign as DRAFT and opens the campaign page where you can review and Start it."
              >
                {loading ? (
                  <>
                    <span className="loading loading-spinner loading-xs" />
                    Saving…
                  </>
                ) : (
                  `Save draft${preview?.audienceCount ? ` · ${preview.audienceCount.toLocaleString()}` : ""}`
                )}
              </button>
            )}
          </div>
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
