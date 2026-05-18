"use client";

import { useEffect, useMemo, useState } from "react";
import { campaignsApi } from "@/lib/api";
import { getApiError } from "@/lib/api-error";
import type { ChannelTemplateVersion } from "@/lib/types";
import { useChannelTemplateState } from "@/hooks/use-templates";
import {
  CampaignReviewPanel,
  collectTemplateReviewWarnings,
  type CampaignReviewInput,
} from "./CampaignReviewPanel";

export type CampaignReviewDialogMode = "preview" | "confirm-start";

type FullCampaign = {
  id: string;
  name: string;
  audienceType?: "ALL" | "SPECIFIC" | "SEGMENT";
  audienceQuery?: Record<string, unknown> | null;
  contactIds?: string[];
  chunkSize?: number | null;
  throttlePerMin?: number | null;
  channelTemplateVersion?: ChannelTemplateVersion | null;
};

/**
 * Modal wrapper around CampaignReviewPanel. Two modes:
 *   - "preview" — read-only browse, single "Close" button.
 *   - "confirm-start" — adds a primary "Start campaign" button that calls
 *     POST /campaigns/:id/start, then notifies the parent on success.
 *
 * Fetches the full campaign on mount so audience + template version are
 * fresh (the cached list endpoint doesn't include channelTemplateVersion).
 */
export function CampaignReviewDialog({
  campaignId,
  campaignName,
  mode,
  onClose,
  onStarted,
}: {
  campaignId: string;
  campaignName: string;
  mode: CampaignReviewDialogMode;
  onClose: () => void;
  onStarted?: () => void;
}) {
  const [campaign, setCampaign] = useState<FullCampaign | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setCampaign(null);
    setLoadError(null);
    void campaignsApi
      .getById(campaignId)
      .then((data) => {
        if (!cancelled) setCampaign(data as FullCampaign);
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(getApiError(err));
      });
    return () => {
      cancelled = true;
    };
  }, [campaignId]);

  const handleStart = async () => {
    setStarting(true);
    setError(null);
    try {
      await campaignsApi.start(campaignId);
      onStarted?.();
      onClose();
    } catch (err: unknown) {
      setError(getApiError(err));
    } finally {
      setStarting(false);
    }
  };

  const heading =
    mode === "confirm-start" ? "Review & start campaign" : "Campaign preview";

  const reviewInput: CampaignReviewInput | null = campaign
    ? {
        audienceType: campaign.audienceType ?? "ALL",
        contactIds: campaign.contactIds,
        audienceQuery: campaign.audienceQuery ?? undefined,
        channelTemplateVersion: campaign.channelTemplateVersion ?? null,
        chunkSize: campaign.chunkSize ?? null,
        throttlePerMin: campaign.throttlePerMin ?? null,
      }
    : null;

  // Pull current template state to determine whether Start should be allowed.
  // The panel already renders the warning blocks; here we just enforce the
  // block-send subset to prevent a doomed send.
  const channelTemplateId =
    campaign?.channelTemplateVersion?.channelTemplateId ?? null;
  const templateStateQuery = useChannelTemplateState(channelTemplateId);
  const blockingReason = useMemo(() => {
    const warnings = collectTemplateReviewWarnings(templateStateQuery.data ?? null);
    return warnings.find((w) => w.blocksSend) ?? null;
  }, [templateStateQuery.data]);

  return (
    <dialog open className="modal modal-middle">
      <div className="modal-box flex max-h-[88vh] max-w-2xl flex-col rounded-box border border-base-300 !bg-base-100 p-0">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-base-300 px-5 py-4">
          <div className="min-w-0">
            <span className="op-label">campaign</span>
            <h3 className="mt-0.5 truncate text-[1.0625rem] font-semibold tracking-[-0.015em]">
              {heading}
            </h3>
            <p className="mt-1 truncate text-[0.78125rem] text-base-content/55">
              {campaignName}
            </p>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-circle"
            onClick={onClose}
            disabled={starting}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loadError ? (
            <div
              role="alert"
              className="rounded-box border border-error/30 border-l-2 border-l-error bg-base-200 px-3 py-2"
            >
              <span className="op-label mb-1 block text-error">error</span>
              <p className="text-[0.8125rem]">{loadError}</p>
            </div>
          ) : !reviewInput ? (
            <div className="flex items-center gap-2 text-[0.8125rem] text-base-content/55">
              <span className="loading loading-spinner loading-xs" />
              Loading campaign…
            </div>
          ) : (
            <CampaignReviewPanel input={reviewInput} />
          )}
          {error ? (
            <div
              role="alert"
              className="mt-3 rounded-box border border-error/30 border-l-2 border-l-error bg-base-200 px-3 py-2"
            >
              <span className="op-label mb-1 block text-error">error</span>
              <p className="text-[0.8125rem]">{error}</p>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-base-300 px-5 py-3">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={onClose}
            disabled={starting}
          >
            {mode === "confirm-start" ? "Cancel" : "Close"}
          </button>
          {mode === "confirm-start" ? (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleStart}
              disabled={starting || !reviewInput || blockingReason != null}
              title={blockingReason?.label}
            >
              {starting ? (
                <>
                  <span className="loading loading-spinner loading-xs" />
                  Starting…
                </>
              ) : blockingReason ? (
                <>Cannot start — {blockingReason.label}</>
              ) : (
                <>
                  <span aria-hidden>▶</span> Start campaign
                </>
              )}
            </button>
          ) : null}
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button type="button" onClick={onClose} aria-label="Close" />
      </form>
    </dialog>
  );
}
