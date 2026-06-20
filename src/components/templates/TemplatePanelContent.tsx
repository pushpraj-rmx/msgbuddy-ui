"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, ExternalLink, Send, Power, RefreshCw } from "lucide-react";
import {
  useTemplate,
  useChannelTemplateState,
  useSyncChannelTemplateVersion,
  useActivateChannelTemplateVersion,
  useRefreshChannelTemplateProviderState,
  channelTemplateKeys,
  templateKeys,
} from "@/hooks/use-templates";
import { templatesApi } from "@/lib/api";
import type { TemplateCategory } from "@/lib/types";
import { WhatsAppTemplatePreviewFromVersion } from "./WhatsAppTemplatePreview";
import { getApiError } from "@/lib/api-error";
import { PanelBody, PanelSection } from "@/components/right-panel/PanelBody";
import { CopyableId } from "@/components/ui/CopyableId";

export function TemplatePanelContent({ templateId }: { templateId: string }) {
  const queryClient = useQueryClient();
  const templateQuery = useTemplate(templateId);
  const template = templateQuery.data;

  const channelTemplates = (template?.channelTemplates ?? []).filter(
    (ct) => !ct.deletedAt
  );
  const waCt = channelTemplates.find((ct) => ct.channel === "WHATSAPP");
  const hasWhatsApp = !!waCt;

  const stateQuery = useChannelTemplateState(waCt?.id ?? null, {
    enabled: !!waCt,
  });
  const state = stateQuery.data;
  const version = state?.activeVersion ?? state?.latestSendableVersion ?? state?.latestVersion ?? null;

  // Add WhatsApp channel
  const [addWaOpen, setAddWaOpen] = useState(false);
  const [waCategory, setWaCategory] = useState<TemplateCategory>("UTILITY");
  const addWhatsAppMutation = useMutation({
    mutationFn: (category: TemplateCategory) =>
      templatesApi.addWhatsApp(templateId, { category }),
    onSuccess: () => {
      // Was `["templates", templateId]` — that prefix matches no real key, so it never
      // invalidated the detail. Use the proper keys so the new WhatsApp channel shows up.
      void queryClient.invalidateQueries({ queryKey: templateKeys.detail(templateId) });
      void queryClient.invalidateQueries({ queryKey: templateKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: channelTemplateKeys.all });
      setAddWaOpen(false);
    },
  });

  // Action mutations for version lifecycle
  const syncMutation = useSyncChannelTemplateVersion();
  const activateMutation = useActivateChannelTemplateVersion();
  const refreshMutation = useRefreshChannelTemplateProviderState();
  const actionBusy = syncMutation.isPending || activateMutation.isPending || refreshMutation.isPending;

  if (templateQuery.isLoading) {
    return (
      <div className="flex justify-center py-8">
        <span className="loading loading-spinner loading-sm text-primary" />
      </div>
    );
  }

  if (templateQuery.isError) {
    return (
      <div className="rounded-box border border-error/30 border-l-2 border-l-error bg-base-200 px-4 py-3">
        <span className="op-label mb-1 block text-error">error</span>
        <p className="text-[0.8125rem] text-base-content">{getApiError(templateQuery.error) || "Failed to load template."}</p>
      </div>
    );
  }

  if (!template) return null;

  return (
    <PanelBody>
      {/* WhatsApp preview */}
      {stateQuery.isLoading ? (
        <PanelSection label="Preview">
          <div className="flex justify-center py-4">
            <span className="loading loading-spinner loading-xs text-primary" />
          </div>
        </PanelSection>
      ) : version?.body ? (
        <PanelSection label="Preview">
          <WhatsAppTemplatePreviewFromVersion
            version={version}
            category={state?.category ?? undefined}
          />
        </PanelSection>
      ) : null}

      {/* Template info */}
      <PanelSection label="Details">
        {template.description && (
          <p className="mb-2 text-[0.8125rem] text-base-content/70">{template.description}</p>
        )}
        <div className="flex flex-wrap items-center gap-1.5">
          {template.isActive ? (
            <span className="op-tag op-tag-ok">Active</span>
          ) : (
            <span className="op-tag">Inactive</span>
          )}
          {channelTemplates.map((ct) => (
            <span key={ct.id} className="op-tag">{ct.channel}</span>
          ))}
          {state?.isSendable ? (
            <span className="op-tag op-tag-ok">Sendable</span>
          ) : state ? (
            <span className="op-tag op-tag-warn">Not sendable</span>
          ) : null}
        </div>
        {version && (
          <p className="mt-2 font-mono-op text-[0.6875rem] tabular-nums text-base-content/50">
            v{version.version} · {version.status}
          </p>
        )}
      </PanelSection>

      {/* Integration ids — what an external app needs to send via this template. */}
      <PanelSection label="Integration">
        <div className="space-y-2">
          <CopyableId
            value={template.id}
            label="template id"
            srLabel="template id"
            className="min-w-0 max-w-full"
          />
          {version ? (
            <CopyableId
              value={version.id}
              label="channelTemplateVersionId"
              srLabel="channel template version id"
              className="min-w-0 max-w-full"
            />
          ) : null}
        </div>
        <p className="mt-2 font-mono-op text-[0.6875rem] tracking-[0.04em] text-base-content/40">
          POST /v2/messages · pass channelTemplateVersionId to pin this exact
          version. A future re-approval won&apos;t change the wire shape.
        </p>
      </PanelSection>

      {/* No WhatsApp channel — prompt to add */}
      {!hasWhatsApp && (
        <PanelSection label="Channels">
          {addWaOpen ? (
            <div className="space-y-3">
              <div>
                <span className="op-label mb-1.5 block">Category</span>
                <select
                  className="select select-bordered select-sm w-full"
                  value={waCategory}
                  onChange={(e) => setWaCategory(e.target.value as TemplateCategory)}
                >
                  <option value="UTILITY">Utility — transactional, alerts</option>
                  <option value="MARKETING">Marketing — promotions, offers</option>
                  <option value="AUTHENTICATION">Authentication — OTP, verification</option>
                </select>
              </div>
              <div className="flex justify-end gap-1.5">
                <button
                  type="button"
                  className="btn btn-ghost btn-xs"
                  onClick={() => setAddWaOpen(false)}
                  disabled={addWhatsAppMutation.isPending}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-xs gap-1"
                  onClick={() => addWhatsAppMutation.mutate(waCategory)}
                  disabled={addWhatsAppMutation.isPending}
                >
                  {addWhatsAppMutation.isPending ? (
                    <span className="loading loading-spinner loading-xs" />
                  ) : (
                    <Plus className="h-3 w-3" />
                  )}
                  Add WhatsApp
                </button>
              </div>
              {addWhatsAppMutation.isError && (
                <p className="text-[0.75rem] text-error">{getApiError(addWhatsAppMutation.error)}</p>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 py-3 text-center">
              <p className="text-[0.8125rem] text-base-content/55">No WhatsApp channel configured yet.</p>
              <button
                type="button"
                className="btn btn-primary btn-sm gap-1"
                onClick={() => setAddWaOpen(true)}
              >
                <Plus className="h-3.5 w-3.5" /> Add WhatsApp channel
              </button>
            </div>
          )}
        </PanelSection>
      )}

      {/* Channel info + actions */}
      {hasWhatsApp && (
        <PanelSection label="WhatsApp" noBorder>
          <div className="flex flex-col gap-2.5">
            {state?.missingRequirements?.length ? (
              <div className="space-y-1.5">
                {(state.missingRequirements as Array<{ code: string; message: string }>).map((r) => (
                  <div key={r.code} className="rounded-md border border-warning/30 bg-warning/5 px-2.5 py-1.5 text-[0.75rem] text-base-content/70">
                    <span className="font-medium text-warning">{r.code === "NO_VERSION" ? "No version" : r.code === "NO_SENDABLE_VERSION" ? "Approval needed" : r.code}</span>
                    {" — "}{r.message}
                  </div>
                ))}
              </div>
            ) : null}

            {/* Status-aware action buttons */}
            {version && (
              <div className="flex flex-col gap-1.5">
                {/* APPROVED → Send to Meta */}
                {version.status === "APPROVED" && (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm gap-1.5"
                    disabled={actionBusy}
                    onClick={() => syncMutation.mutate({ id: waCt!.id, version: version.version })}
                  >
                    {syncMutation.isPending ? (
                      <span className="loading loading-spinner loading-xs" />
                    ) : (
                      <Send className="h-3.5 w-3.5" />
                    )}
                    Send to Meta
                  </button>
                )}

                {/* PROVIDER_PENDING → Waiting */}
                {version.status === "PROVIDER_PENDING" && (
                  <div className="flex items-center gap-2">
                    <span className="op-tag op-tag-info">Under review by Meta</span>
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs gap-1"
                      disabled={actionBusy}
                      onClick={() => refreshMutation.mutate({ id: waCt!.id })}
                    >
                      <RefreshCw className={`h-3 w-3 ${refreshMutation.isPending ? "animate-spin" : ""}`} />
                      Refresh
                    </button>
                  </div>
                )}

                {/* PROVIDER_APPROVED + not active → Activate */}
                {version.status === "PROVIDER_APPROVED" && !version.isActive && (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm gap-1.5"
                    disabled={actionBusy}
                    onClick={() => activateMutation.mutate({ id: waCt!.id, version: version.version })}
                  >
                    {activateMutation.isPending ? (
                      <span className="loading loading-spinner loading-xs" />
                    ) : (
                      <Power className="h-3.5 w-3.5" />
                    )}
                    Activate
                  </button>
                )}

                {/* PROVIDER_REJECTED → Show reason */}
                {version.status === "PROVIDER_REJECTED" && (
                  <div className="rounded-md border border-error/30 bg-error/5 px-2.5 py-1.5 text-[0.75rem] text-base-content/70">
                    <span className="font-medium text-error">Rejected by Meta</span>
                    {version.providerRejectionReason && (
                      <p className="mt-0.5">{version.providerRejectionReason}</p>
                    )}
                  </div>
                )}

                {/* PROVIDER_IN_APPEAL → Awaiting Meta re-review */}
                {version.status === "PROVIDER_IN_APPEAL" && (
                  <div className="rounded-md border border-warning/30 bg-warning/5 px-2.5 py-1.5 text-[0.75rem] text-base-content/70">
                    <span className="font-medium text-warning">Appeal in review</span>
                    <p className="mt-0.5">
                      Submitted to Meta for re-review. Status will update via webhook when they decide.
                    </p>
                  </div>
                )}

                {/* Sync error */}
                {syncMutation.isError && (
                  <p className="text-[0.75rem] text-error">{getApiError(syncMutation.error) || "Sync failed"}</p>
                )}
                {syncMutation.isSuccess && (
                  <p className="text-[0.75rem] text-success">Sent to Meta for review</p>
                )}
              </div>
            )}

            <Link
              href={`/channel-templates/${waCt!.id}`}
              className="btn btn-sm btn-ghost gap-1 self-start"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Manage versions
            </Link>
          </div>
        </PanelSection>
      )}
    </PanelBody>
  );
}
