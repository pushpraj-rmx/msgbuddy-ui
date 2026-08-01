"use client";

import { useEffect, useState } from "react";
import { campaignsApi } from "@/lib/api";
import { getApiError } from "@/lib/api-error";
import type { ChannelTemplateState, ChannelTemplateVersion } from "@/lib/types";
import { normalizeQualityRating } from "@/lib/types";
import { useChannelTemplateState } from "@/hooks/use-templates";
import { WhatsAppTemplatePreviewFromVersion } from "@/components/templates/WhatsAppTemplatePreview";

export type CampaignReviewInput = {
  audienceType: "ALL" | "SPECIFIC" | "SEGMENT";
  contactIds?: string[];
  audienceQuery?: Record<string, unknown> | null;
  /** Resolved version so the panel can render the WhatsApp preview. */
  channelTemplateVersion: ChannelTemplateVersion | null;
  /** Visual overrides for media (only relevant during the create wizard). */
  headerPreviewUrl?: string | null;
  carouselCardPreviewUrls?: string[];
  /** Display-only — chunkSize / throttlePerMin from the campaign config. */
  chunkSize?: number | null;
  throttlePerMin?: number | null;
  /** Segment name (display only). */
  segmentName?: string | null;
};

type Preview = {
  audienceCount: number;
  sample: Array<{ id: string; name: string | null; phone: string }>;
  excludedBlocked: number;
  excludedOptedOut: number;
  excludedFrequencyCapped: number;
};

type ReviewTab = "audience" | "message";

const DEFAULT_CHUNK = 100;
// Must match the backend default applied when throttlePerMin is omitted
// (campaigns.service.ts: `throttlePerMin = 4200`). A 60 fallback here made the
// ETA disagree with what the queue actually does when the field is left blank.
const DEFAULT_THROTTLE = 4200;

/**
 * Read-only "Review before send" view shared by:
 *   - CreateCampaignForm's Step 4 (wizard)
 *   - StartCampaignDialog (existing campaign confirm + standalone preview)
 *
 * Audience + Message live in tabs; Delivery is a compact strip below.
 */
export function CampaignReviewPanel({
  input,
  onEditAudience,
  onEditMessage,
  onEditDelivery,
}: {
  input: CampaignReviewInput;
  onEditAudience?: () => void;
  onEditMessage?: () => void;
  onEditDelivery?: () => void;
}) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [tab, setTab] = useState<ReviewTab>("audience");

  // When MARKETING, ask the server for the per-recipient 24h cap count too.
  const templateCategory = input.channelTemplateVersion?.channelTemplate?.category;

  useEffect(() => {
    let cancelled = false;
    /* eslint-disable react-hooks/set-state-in-effect -- resetting before re-fetch when input changes */
    setPreview(null);
    setPreviewError(null);
    setPreviewLoading(true);
    /* eslint-enable react-hooks/set-state-in-effect */
    void campaignsApi
      .preview({
        audienceType: input.audienceType,
        contactIds: input.contactIds,
        audienceQuery: input.audienceQuery ?? undefined,
        templateCategory:
          templateCategory === "MARKETING" ||
          templateCategory === "UTILITY" ||
          templateCategory === "AUTHENTICATION"
            ? templateCategory
            : undefined,
      })
      .then((data) => {
        if (!cancelled) setPreview(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setPreviewError(getApiError(err));
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    input.audienceType,
    input.contactIds,
    input.audienceQuery,
    templateCategory,
  ]);

  const audienceBadge =
    preview && !previewLoading && !previewError
      ? preview.audienceCount.toLocaleString()
      : null;

  // Pull fresh channel-template state so we can warn the user about quality /
  // pause / appeal / category issues before they start the campaign. Falls back
  // gracefully if the template snapshot doesn't include channelTemplateId (older
  // wire payloads).
  const channelTemplateId = input.channelTemplateVersion?.channelTemplateId ?? null;
  const stateQuery = useChannelTemplateState(channelTemplateId);
  const templateWarnings = collectTemplateReviewWarnings(stateQuery.data ?? null);

  return (
    <div className="space-y-4">
      {templateWarnings.length > 0 && (
        <div className="space-y-2">
          {templateWarnings.map((w) => (
            <TemplateWarning key={w.key} warning={w} />
          ))}
        </div>
      )}
      <div className="rounded-box border border-base-300 bg-base-200">
        {/* Tab strip */}
        <div
          role="tablist"
          className="flex items-center gap-1 border-b border-base-300 px-2 py-1.5"
        >
          <TabButton
            active={tab === "audience"}
            onClick={() => setTab("audience")}
            label="Audience"
            badge={audienceBadge}
          />
          <TabButton
            active={tab === "message"}
            onClick={() => setTab("message")}
            label="Message"
          />
          <div className="ml-auto">
            {tab === "audience" && onEditAudience ? (
              <EditLink onClick={onEditAudience} />
            ) : tab === "message" && onEditMessage ? (
              <EditLink onClick={onEditMessage} />
            ) : null}
          </div>
        </div>

        {/* Tab body */}
        <div className="px-4 py-3 sm:px-5">
          {tab === "audience" ? (
            <AudienceTabBody
              input={input}
              preview={preview}
              previewLoading={previewLoading}
              previewError={previewError}
            />
          ) : (
            <MessageTabBody input={input} />
          )}
        </div>
      </div>

      {/* Delivery — compact always-visible strip below tabs */}
      <div className="rounded-box border border-base-300 bg-base-200">
        <div className="flex items-center justify-between gap-2 border-b border-base-300 px-4 py-2 sm:px-5">
          <h3 className="text-[0.8125rem] font-semibold tracking-[-0.01em]">
            Delivery
          </h3>
          {onEditDelivery ? <EditLink onClick={onEditDelivery} /> : null}
        </div>
        <div className="px-4 py-3 sm:px-5">
          <DeliveryBody input={input} audienceCount={preview?.audienceCount ?? 0} />
        </div>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  badge?: string | null;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-[3px] px-2.5 py-1 text-[0.8125rem] font-medium transition-colors ${
        active
          ? "bg-base-100 text-base-content shadow-[0_0_0_1px_var(--color-base-300)]"
          : "text-base-content/60 hover:bg-base-100/60 hover:text-base-content"
      }`}
    >
      {label}
      {badge ? (
        <span className="font-mono-op rounded-[3px] border border-base-300 bg-base-200 px-1 py-[1px] text-[0.625rem] tabular-nums tracking-[0.04em] text-base-content/70">
          {badge}
        </span>
      ) : null}
    </button>
  );
}

function EditLink({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      className="font-mono-op text-[0.625rem] tracking-[0.08em] uppercase text-base-content/55 transition-colors hover:text-primary"
      onClick={onClick}
    >
      Edit
    </button>
  );
}

function AudienceTabBody({
  input,
  preview,
  previewLoading,
  previewError,
}: {
  input: CampaignReviewInput;
  preview: Preview | null;
  previewLoading: boolean;
  previewError: string | null;
}) {
  if (previewLoading) {
    return (
      <div className="flex items-center gap-2 text-[0.8125rem] text-base-content/55">
        <span className="loading loading-spinner loading-xs" />
        Resolving audience…
      </div>
    );
  }
  if (previewError) {
    return (
      <div
        role="alert"
        className="rounded-box border border-error/30 border-l-2 border-l-error bg-base-100 px-3 py-2"
      >
        <span className="op-label mb-1 block text-error">error</span>
        <p className="text-[0.8125rem]">{previewError}</p>
      </div>
    );
  }
  if (!preview) return null;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline gap-3">
        <span className="font-mono-op text-[1.625rem] font-semibold tabular-nums">
          {preview.audienceCount.toLocaleString()}
        </span>
        <span className="op-label">contacts will receive this</span>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-[0.71875rem]">
        <span className="rounded-[3px] border border-base-300 bg-base-100 px-1.5 py-[1px] font-mono-op tracking-[0.04em] uppercase text-base-content/65">
          {input.audienceType.toLowerCase()}
        </span>
        {input.audienceType === "SEGMENT" && input.segmentName ? (
          <span className="text-base-content/60">
            segment ·{" "}
            <span className="text-base-content">{input.segmentName}</span>
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
      {preview.excludedFrequencyCapped > 0 && (
        <div
          role="alert"
          className="rounded-box border border-warning/30 border-l-2 border-l-warning bg-base-100 px-3 py-2"
        >
          <span className="op-label mb-1 block text-warning">
            {preview.excludedFrequencyCapped.toLocaleString()} will be skipped at
            send · marketing cap
          </span>
          <p className="text-[0.78125rem] text-base-content/75">
            These recipients received a marketing template in the last 24h and
            haven&apos;t replied since. msgbuddy holds them back to protect your
            WhatsApp quality rating — Meta isn&apos;t rejecting them, and you can
            override this per campaign in Delivery settings.
          </p>
        </div>
      )}
      {preview.audienceCount === 0 ? (
        <div
          role="alert"
          className="rounded-box border border-warning/30 border-l-2 border-l-warning bg-base-100 px-3 py-2"
        >
          <span className="op-label mb-1 block text-warning">
            empty audience
          </span>
          <p className="text-[0.8125rem]">
            No sendable contacts match this configuration.
          </p>
        </div>
      ) : (
        <div className="rounded-box border border-base-300 bg-base-100">
          <div className="border-b border-base-300 px-3 py-2">
            <span className="op-label">
              sample · first {preview.sample.length}
            </span>
          </div>
          <ul className="divide-y divide-base-300/50">
            {preview.sample.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between gap-3 px-3 py-2 text-[0.78125rem]"
              >
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
  );
}

function MessageTabBody({ input }: { input: CampaignReviewInput }) {
  if (!input.channelTemplateVersion) {
    return (
      <div className="text-[0.8125rem] text-base-content/55">
        No template version attached.
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <div className="rounded-box border border-base-300 bg-base-100 p-3">
        <WhatsAppTemplatePreviewFromVersion version={mergePreviewMedia(input)} />
      </div>
      <p className="text-[0.6875rem] text-base-content/50">
        Variable placeholders ({"{{1}}"}, etc.) are filled per recipient from the
        contact-field / fixed-value bindings you set on the Template step. A
        recipient missing a mapped field is skipped at send time.
      </p>
    </div>
  );
}

function DeliveryBody({
  input,
  audienceCount,
}: {
  input: CampaignReviewInput;
  audienceCount: number;
}) {
  const cs = input.chunkSize ?? DEFAULT_CHUNK;
  const tp = input.throttlePerMin ?? DEFAULT_THROTTLE;
  const minutes = tp > 0 ? Math.ceil(audienceCount / tp) : 0;
  const eta =
    audienceCount === 0
      ? "—"
      : minutes < 1
        ? "< 1 min"
        : minutes < 60
          ? `~${minutes} min`
          : `~${(minutes / 60).toFixed(1)} hr`;
  return (
    <div className="grid grid-cols-2 gap-3 text-[0.8125rem] sm:grid-cols-3">
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
}

type TemplateReviewWarning = {
  key: string;
  tone: "danger" | "warning";
  label: string;
  body: string;
  /** When true, downstream consumers (e.g. the start button) should refuse to proceed. */
  blocksSend: boolean;
};

/**
 * Inspect the channel template's current Meta state and surface anything the
 * user should know before they click Start. Anything `blocksSend=true` will
 * make the Start button refuse to fire from the dialog.
 */
export function collectTemplateReviewWarnings(
  state: ChannelTemplateState | null,
): TemplateReviewWarning[] {
  if (!state) return [];
  const out: TemplateReviewWarning[] = [];

  // Latest version's status is the strongest send-time signal.
  const versionStatus = state.latestSendableVersion?.status ?? state.latestVersion?.status;

  if (versionStatus === "PROVIDER_DISABLED") {
    out.push({
      key: "disabled",
      tone: "danger",
      label: "Template disabled by Meta",
      body: "This template is permanently disabled on Meta. Sends will fail. Create a new template with revised content.",
      blocksSend: true,
    });
  } else if (versionStatus === "PROVIDER_PAUSED") {
    out.push({
      key: "paused",
      tone: "danger",
      label: "Template paused by Meta",
      body: "This template is temporarily paused due to quality issues. Sends will be rejected until Meta lifts the pause (3h on first pause, 6h on second).",
      blocksSend: true,
    });
  } else if (versionStatus === "PROVIDER_IN_APPEAL") {
    out.push({
      key: "in-appeal",
      tone: "warning",
      label: "Appeal in review with Meta",
      body: "This template was rejected and you submitted an appeal. Sends will fail until Meta approves. You can still queue the campaign — it just won't send anything until the appeal succeeds.",
      blocksSend: false,
    });
  } else if (versionStatus !== "PROVIDER_APPROVED") {
    out.push({
      key: "not-approved",
      tone: "danger",
      label: "No approved version on Meta",
      body: `Latest version is "${versionStatus ?? "unknown"}". Send this template for Meta approval before starting a campaign.`,
      blocksSend: true,
    });
  }

  if (normalizeQualityRating(state.qualityScore) === "RED") {
    out.push({
      key: "quality-red",
      tone: "warning",
      label: "Low quality rating",
      body: "Meta has rated this template Low quality. Continued sends may push it into PAUSED. Consider reducing send volume or revising the content first.",
      blocksSend: false,
    });
  }

  if (state.categoryPendingChange) {
    out.push({
      key: "category-pending",
      tone: "warning",
      label: "Meta will reclassify this template",
      body: `Meta detected this should be ${state.categoryPendingChange.correctCategory} instead of ${state.categoryPendingChange.currentCategory}. Pricing and policy may change — update the category in template settings before sending.`,
      blocksSend: false,
    });
  }

  if (state.whatsappPhoneQuality?.rating === "FLAGGED") {
    out.push({
      key: "phone-flagged",
      tone: "warning",
      label: "Phone number flagged",
      body: "Your WhatsApp phone number is flagged. Continued low-quality sends could drop your messaging tier. Consider holding non-urgent marketing until quality recovers.",
      blocksSend: false,
    });
  }

  return out;
}

function TemplateWarning({ warning }: { warning: TemplateReviewWarning }) {
  const borderClass =
    warning.tone === "danger"
      ? "border-error/30 border-l-error"
      : "border-warning/30 border-l-warning";
  const labelClass = warning.tone === "danger" ? "text-error" : "text-warning";
  return (
    <div
      role="alert"
      className={`rounded-box border border-l-2 ${borderClass} bg-base-200 px-4 py-3`}
    >
      <span className={`op-label mb-1 block ${labelClass}`}>
        {warning.label}
      </span>
      <p className="text-[0.8125rem] text-base-content">{warning.body}</p>
    </div>
  );
}

function mergePreviewMedia(input: CampaignReviewInput): ChannelTemplateVersion {
  const v = input.channelTemplateVersion as ChannelTemplateVersion;
  const hasHeaderOverride = !!input.headerPreviewUrl;
  const hasCarouselOverrides =
    (input.carouselCardPreviewUrls?.length ?? 0) > 0;
  if (!hasHeaderOverride && !hasCarouselOverrides) return v;

  return {
    ...v,
    ...(hasHeaderOverride
      ? { headerPreviewUrl: input.headerPreviewUrl ?? undefined }
      : {}),
    ...(hasCarouselOverrides && Array.isArray(v.carouselCards)
      ? {
          carouselCards: v.carouselCards.map((c, i) => ({
            ...c,
            ...(input.carouselCardPreviewUrls?.[i]
              ? { headerPreviewUrl: input.carouselCardPreviewUrls[i] }
              : {}),
          })),
        }
      : {}),
  };
}
