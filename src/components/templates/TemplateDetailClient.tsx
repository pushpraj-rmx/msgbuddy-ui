"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  useTemplate,
  useUpdateTemplate,
  useChannelTemplateState,
  channelTemplateKeys,
} from "@/hooks/use-templates";
import type { ChannelTemplate, ChannelTemplateStateRequirement, TemplateCategory, TemplateChannel, WorkspaceRole } from "@/lib/types";
import { templatesApi } from "@/lib/api";
import { channelTemplateRequirementHref } from "@/lib/site";
import {
  parseWorkspaceSseEvent,
  isChannelTemplateCategoryPending,
  isWhatsAppAccountRestriction,
} from "@/lib/sseEvents";
import { getApiError } from "@/lib/api-error";

function ChannelTemplateCard({ ct }: { ct: ChannelTemplate }) {
  const stateQuery = useChannelTemplateState(ct.id, { refetchInterval: 10_000 });
  const state = stateQuery.data;

  const requirements = (state?.missingRequirements ?? []) as ChannelTemplateStateRequirement[];

  return (
    <div className="rounded-box border border-base-300 bg-base-100 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="badge badge-ghost">{ct.channel}</span>
            {ct.category && (
              <span className="badge badge-outline">{ct.category}</span>
            )}
            {state?.isSendable ? (
              <span className="badge badge-success">Sendable</span>
            ) : (
              <span className="badge badge-warning">Not sendable</span>
            )}
          </div>
          <div className="mt-2 text-sm text-base-content/70 space-y-1">
            <div>
              <span className="font-medium">Latest:</span>{" "}
              {state?.latestVersion ? `v${state.latestVersion.version} (${state.latestVersion.status})` : "—"}
            </div>
            <div>
              <span className="font-medium">Active:</span>{" "}
              {state?.activeVersion ? `v${state.activeVersion.version} (${state.activeVersion.status})` : "—"}
            </div>
          </div>
        </div>

        <Link href={`/channel-templates/${ct.id}`} className="btn btn-primary btn-sm">
          Manage
        </Link>
      </div>

      {stateQuery.isError && (
        <div role="alert" className="alert alert-error mt-3">
          <span>{getApiError(stateQuery.error)}</span>
        </div>
      )}

      {state?.categoryPendingChange && (
        <div role="alert" className="alert alert-info mt-3 text-sm">
          <span>
            Upcoming category change: {state.categoryPendingChange.currentCategory} →{" "}
            {state.categoryPendingChange.correctCategory}
          </span>
        </div>
      )}

      {requirements.length > 0 && (
        <div className="mt-3 space-y-2">
          {requirements.map((r) => {
            const codeLabel =
              r.code === "NO_VERSION"
                ? "No version yet"
                : r.code === "NO_SENDABLE_VERSION"
                  ? "Approval needed"
                  : r.code;
            return (
              <div key={r.code} className="flex items-center justify-between gap-3 rounded-lg border border-base-300/80 bg-base-100 px-3 py-2">
                <div className="text-sm">
                  <div className="font-medium">{codeLabel}</div>
                  <div className="text-base-content/70">{r.message}</div>
                </div>
                {r.action && (
                  <a
                    className="btn btn-outline btn-sm"
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
  );
}

type Props = {
  templateId: string;
  userRole: WorkspaceRole | string;
  workspaceId: string;
};

export function TemplateDetailClient({ templateId, workspaceId }: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [addWaOpen, setAddWaOpen] = useState(false);
  const [waCategory, setWaCategory] = useState<TemplateCategory>("UTILITY");
  const templateQuery = useTemplate(templateId);
  const updateMutation = useUpdateTemplate();
  const addWhatsAppMutation = useMutation({
    mutationFn: (category: TemplateCategory) =>
      templatesApi.addWhatsApp(templateId, { category }),
    onSuccess: (ct) => router.push(`/channel-templates/${ct.id}`),
  });

  const template = templateQuery.data;
  const channelTemplates = useMemo(
    () => (template?.channelTemplates ?? []).filter((ct) => !ct.deletedAt),
    [template?.channelTemplates]
  );
  const firstWaCt = channelTemplates.find((ct) => ct.channel === "WHATSAPP");
  const waRestrictionState = useChannelTemplateState(firstWaCt?.id ?? null, {
    enabled: !!firstWaCt,
    refetchInterval: 10_000,
  });
  const waUtilityRestriction = waRestrictionState.data?.whatsappUtilityRestriction;

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
        if (
          isChannelTemplateCategoryPending(ev.type) ||
          isWhatsAppAccountRestriction(ev.type)
        ) {
          void queryClient.invalidateQueries({ queryKey: channelTemplateKeys.all });
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
  }, [queryClient, workspaceId]);

  const hasWhatsApp = channelTemplates.some((ct) => ct.channel === "WHATSAPP");
  const hasChannel = useCallback(
    (ch: TemplateChannel) => channelTemplates.some((ct) => ct.channel === ch),
    [channelTemplates]
  );


  const openEdit = useCallback(() => {
    if (!template) return;
    setName(template.name);
    setDescription(template.description ?? "");
    setIsActive(template.isActive);
    setEditOpen(true);
  }, [template]);

  const saveEdit = useCallback(() => {
    updateMutation.mutate(
      {
        id: templateId,
        data: {
          name: name.trim() || undefined,
          description: description.trim() || undefined,
          isActive,
        },
      },
      { onSuccess: () => setEditOpen(false) }
    );
  }, [updateMutation, templateId, name, description, isActive]);

  if (templateQuery.isLoading || !template) {
    return (
      <div className="flex justify-center py-12">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  if (templateQuery.isError) {
    return (
      <div role="alert" className="alert alert-error">
        <span>{getApiError(templateQuery.error)}</span>
        <Link href="/templates" className="btn btn-ghost btn-sm">
          Back
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {waUtilityRestriction && (
        <div role="alert" className="alert alert-warning">
          <span>
            WhatsApp account notice
            {waUtilityRestriction.level != null && waUtilityRestriction.level !== ""
              ? `: ${waUtilityRestriction.level}`
              : ""}
            . Meta may flag utility template misuse; review WhatsApp policy and your template
            categories.
          </span>
        </div>
      )}

      <div className="rounded-box border border-base-300 bg-base-100 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xl font-semibold">{template.name}</div>
            {template.description && (
              <div className="text-sm text-base-content/70 mt-1">
                {template.description}
              </div>
            )}
          </div>
          <button className="btn btn-outline btn-sm" onClick={openEdit}>
            Edit
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Channels</h2>
          {!hasWhatsApp && (
            <button
              className="btn btn-primary btn-sm"
              type="button"
              onClick={() => setAddWaOpen(true)}
              disabled={addWhatsAppMutation.isPending}
            >
              {addWhatsAppMutation.isPending ? (
                <>
                  <span className="loading loading-spinner loading-sm" />
                  Adding…
                </>
              ) : (
                "+ Add WhatsApp"
              )}
            </button>
          )}
        </div>
        {addWhatsAppMutation.isError && (
          <div role="alert" className="alert alert-error">
            <span>{getApiError(addWhatsAppMutation.error) || "Failed to add WhatsApp."}</span>
          </div>
        )}
        {channelTemplates.length === 0 ? (
          <div className="rounded-box border border-base-300 bg-base-100 p-4 text-base-content/70">
            No channels configured yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {channelTemplates.map((ct) => (
              <ChannelTemplateCard key={ct.id} ct={ct} />
            ))}
          </div>
        )}
      </div>

      {addWaOpen && (
        <dialog open className="modal modal-middle">
          <div className="modal-box">
            <h3 className="text-lg font-semibold">Add WhatsApp channel</h3>
            <p className="text-sm text-base-content/60 mt-1">
              Choose the initial template category. Meta uses this to classify your messages.
            </p>
            <div className="mt-4 space-y-3">
              <label className="form-control w-full">
                <span className="label-text">Category</span>
                <select
                  className="select select-bordered w-full"
                  value={waCategory}
                  onChange={(e) => setWaCategory(e.target.value as TemplateCategory)}
                >
                  <option value="UTILITY">Utility — transactional, order updates, alerts</option>
                  <option value="MARKETING">Marketing — promotions, offers</option>
                  <option value="AUTHENTICATION">Authentication — OTP, verification codes</option>
                </select>
              </label>
            </div>
            <div className="modal-action">
              <button
                className="btn btn-ghost"
                type="button"
                onClick={() => setAddWaOpen(false)}
                disabled={addWhatsAppMutation.isPending}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                type="button"
                onClick={() => {
                  setAddWaOpen(false);
                  addWhatsAppMutation.mutate(waCategory);
                }}
                disabled={addWhatsAppMutation.isPending}
              >
                Add
              </button>
            </div>
          </div>
          <form method="dialog" className="modal-backdrop" onSubmit={() => setAddWaOpen(false)}>
            <button type="submit">close</button>
          </form>
        </dialog>
      )}

      {editOpen && (
        <dialog open className="modal modal-middle">
          <div className="modal-box">
            <h3 className="text-lg font-semibold">Edit template</h3>
            <div className="mt-4 space-y-3">
              <label className="label">
                <span className="label-text">Name</span>
              </label>
              <input
                type="text"
                className="input input-bordered w-full"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <label className="label">
                <span className="label-text">Description</span>
              </label>
              <input
                type="text"
                className="input input-bordered w-full"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
              <label className="label cursor-pointer justify-start gap-3">
                <input
                  type="checkbox"
                  className="checkbox checkbox-sm"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                />
                <span className="label-text">
                  Active
                  <span className="block text-xs font-normal text-base-content/60">
                    Inactive templates are hidden from campaign selection.
                  </span>
                </span>
              </label>
            </div>
            <div className="modal-action">
              <button
                className="btn btn-ghost"
                type="button"
                onClick={() => setEditOpen(false)}
                disabled={updateMutation.isPending}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                type="button"
                onClick={saveEdit}
                disabled={!name.trim() || updateMutation.isPending}
              >
                {updateMutation.isPending ? (
                  <>
                    <span className="loading loading-spinner loading-sm" />
                    Saving…
                  </>
                ) : (
                  "Save"
                )}
              </button>
            </div>
          </div>
          <form method="dialog" className="modal-backdrop" onSubmit={() => setEditOpen(false)}>
            <button type="submit">close</button>
          </form>
        </dialog>
      )}
    </div>
  );
}

