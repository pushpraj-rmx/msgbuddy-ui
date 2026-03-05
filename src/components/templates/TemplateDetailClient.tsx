"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import {
  useTemplate,
  useTemplateVersion,
  useSubmitTemplateVersion,
  useApproveTemplateVersion,
  useRejectTemplateVersion,
  useSyncTemplateVersion,
  useArchiveTemplateVersion,
  useRefreshTemplateStatus,
  useCreateTemplateVersion,
  useUpdateTemplateVersion,
} from "@/hooks/use-templates";
import type {
  TemplateVersionStatus,
  WorkspaceRole,
} from "@/lib/types";
import type { TemplateVersionPayload } from "@/lib/types";
import { TemplateVersionEditor } from "./TemplateVersionEditor";

const POLL_INTERVAL_MS = 12_000;

function canApproveOrReject(role: WorkspaceRole | string): boolean {
  return role === "OWNER" || role === "ADMIN";
}

function statusBadgeClass(status: TemplateVersionStatus): string {
  switch (status) {
    case "PROVIDER_APPROVED":
      return "badge-success";
    case "APPROVED":
      return "badge-info";
    case "REJECTED":
    case "PROVIDER_REJECTED":
      return "badge-error";
    case "PENDING":
    case "PROVIDER_PENDING":
      return "badge-warning";
    default:
      return "badge-ghost";
  }
}

function getApiError(err: unknown): string {
  return (err as { response?: { data?: { message?: string } } })?.response
    ?.data?.message ?? "Something went wrong.";
}

type Props = {
  templateId: string;
  userRole: WorkspaceRole | string;
};

export function TemplateDetailClient({ templateId, userRole }: Props) {
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectModalVersion, setRejectModalVersion] = useState<number | null>(null);
  const [createVersionOpen, setCreateVersionOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const templateQuery = useTemplate(templateId, {
    refetchInterval: (query) => {
      const template = query.state.data as { versions?: { status: string }[] } | undefined;
      const versions = template?.versions ?? [];
      const hasProviderPending = versions.some((x) => x.status === "PROVIDER_PENDING");
      return hasProviderPending ? POLL_INTERVAL_MS : undefined;
    },
  });

  const template = templateQuery.data;
  const versions = useMemo(
    () => (template?.versions ?? []).sort((a, b) => b.version - a.version),
    [template?.versions]
  );
  const activeVersionNumber =
    selectedVersion ?? (versions[0]?.version ?? null);

  const versionQuery = useTemplateVersion(
    templateId,
    activeVersionNumber,
    activeVersionNumber != null
      ? {
          enabled: true,
          refetchInterval: (query) => {
            const v = query.state.data as { status: string } | undefined;
            return v?.status === "PROVIDER_PENDING" ? POLL_INTERVAL_MS : undefined;
          },
        }
      : { enabled: false }
  );

  const activeVersion = versionQuery.data ?? versions.find((v) => v.version === activeVersionNumber) ?? null;
  const isEditable =
    activeVersion?.status === "DRAFT" && !activeVersion?.isLocked;
  const showApproveReject = canApproveOrReject(userRole);

  const submitMutation = useSubmitTemplateVersion();
  const approveMutation = useApproveTemplateVersion();
  const rejectMutation = useRejectTemplateVersion();
  const syncMutation = useSyncTemplateVersion();
  const archiveMutation = useArchiveTemplateVersion();
  const refreshStatusMutation = useRefreshTemplateStatus();
  const createVersionMutation = useCreateTemplateVersion();
  const updateVersionMutation = useUpdateTemplateVersion();

  const handleSubmit = useCallback(() => {
    if (!activeVersionNumber) return;
    submitMutation.mutate(
      { id: templateId, version: activeVersionNumber },
      { onError: () => {} }
    );
  }, [templateId, activeVersionNumber, submitMutation]);

  const handleApprove = useCallback(() => {
    if (!activeVersionNumber) return;
    approveMutation.mutate(
      { id: templateId, version: activeVersionNumber },
      { onError: () => {} }
    );
  }, [templateId, activeVersionNumber, approveMutation]);

  const handleRejectOpen = useCallback(() => {
    setRejectModalVersion(activeVersionNumber);
    setRejectReason("");
  }, [activeVersionNumber]);

  const handleRejectConfirm = useCallback(() => {
    if (rejectModalVersion == null || !rejectReason.trim()) return;
    rejectMutation.mutate(
      { id: templateId, version: rejectModalVersion, reason: rejectReason.trim() },
      {
        onSuccess: () => {
          setRejectModalVersion(null);
          setRejectReason("");
        },
        onError: () => {},
      }
    );
  }, [templateId, rejectModalVersion, rejectReason, rejectMutation]);

  const handleSync = useCallback(() => {
    if (!activeVersionNumber) return;
    syncMutation.mutate(
      { id: templateId, version: activeVersionNumber },
      { onError: () => {} }
    );
  }, [templateId, activeVersionNumber, syncMutation]);

  const handleCreateVersion = useCallback(
    (payload: TemplateVersionPayload) => {
      createVersionMutation.mutate(
        { id: templateId, data: payload },
        {
          onSuccess: (data) => {
            setCreateVersionOpen(false);
            setSelectedVersion(data.version);
            templateQuery.refetch();
          },
          onError: () => {},
        }
      );
    },
    [templateId, createVersionMutation, templateQuery]
  );

  const handleUpdateVersion = useCallback(
    (payload: TemplateVersionPayload) => {
      if (activeVersionNumber == null) return;
      updateVersionMutation.mutate(
        { id: templateId, version: activeVersionNumber, data: payload },
        {
          onSuccess: () => {
            setEditOpen(false);
            versionQuery.refetch();
            templateQuery.refetch();
          },
          onError: () => {},
        }
      );
    },
    [templateId, activeVersionNumber, updateVersionMutation, versionQuery, templateQuery]
  );

  if (templateQuery.isLoading || !template) {
    return (
      <div className="flex justify-center py-12">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  if (templateQuery.error) {
    return (
      <div role="alert" className="alert alert-error">
        <span>{getApiError(templateQuery.error)}</span>
        <Link href="/templates" className="btn btn-ghost btn-sm">
          Back to templates
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href="/templates" className="btn btn-ghost btn-sm">
          ← Templates
        </Link>
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={() => refreshStatusMutation.mutate(templateId)}
          disabled={refreshStatusMutation.isPending}
        >
          {refreshStatusMutation.isPending ? "Refreshing…" : "Refresh provider status"}
        </button>
      </div>

      <div className="card bg-base-200 shadow-sm">
        <div className="card-body">
          <h2 className="card-title text-lg">{template.name}</h2>
          {template.description && (
            <p className="text-sm text-base-content/70">{template.description}</p>
          )}
          <div className="flex flex-wrap gap-2 mt-2">
            <span className="badge badge-ghost">{template.channel}</span>
            <span className="badge badge-ghost">{template.category}</span>
            {template.providerStatus != null && template.providerStatus !== "" && (
              <span className="badge badge-info">Provider: {template.providerStatus}</span>
            )}
            {template.providerTemplateId && (
              <span className="badge badge-success badge-sm">Synced</span>
            )}
          </div>
        </div>
      </div>

      <div className="card bg-base-200 shadow-sm">
        <div className="card-body">
          <h3 className="font-semibold">Versions</h3>
          <div className="overflow-x-auto">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th>Version</th>
                  <th>Status</th>
                  <th>Language</th>
                  <th>Updated</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {versions.map((v) => (
                  <tr
                    key={v.id}
                    className={
                      v.version === activeVersionNumber ? "bg-base-300/50" : ""
                    }
                  >
                    <td>
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs"
                        onClick={() => setSelectedVersion(v.version)}
                      >
                        v{v.version}
                      </button>
                    </td>
                    <td>
                      <span className={`badge badge-sm ${statusBadgeClass(v.status)}`}>
                        {v.status}
                      </span>
                    </td>
                    <td>{v.language}</td>
                    <td className="text-base-content/70 text-sm">
                      {v.updatedAt
                        ? new Date(v.updatedAt).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })
                        : "—"}
                    </td>
                    <td>
                      {v.archivedAt == null && v.status !== "DRAFT" && (
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs text-base-content/60"
                          onClick={() => archiveMutation.mutate({ id: templateId, version: v.version })}
                          disabled={archiveMutation.isPending}
                        >
                          Archive
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {versions.length === 0 && (
            <p className="text-sm text-base-content/60 py-4">
              No versions yet. Create the first version below.
            </p>
          )}
          <div className="flex flex-wrap gap-2 mt-2">
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => setCreateVersionOpen(true)}
            >
              Create new version
            </button>
          </div>
        </div>
      </div>

      {activeVersion && (
        <div className="card bg-base-200 shadow-sm">
          <div className="card-body">
            <h3 className="font-semibold">
              Version {activeVersion.version} — {activeVersion.status}
            </h3>
            {activeVersion.status === "PROVIDER_PENDING" && (
              <p className="text-sm text-warning">
                Waiting for provider approval. This page will update automatically.
              </p>
            )}
            {activeVersion.providerRejectionReason && (
              <div role="alert" className="alert alert-error alert-soft text-sm">
                <span>{activeVersion.providerRejectionReason}</span>
              </div>
            )}

            <div className="mt-4 space-y-2">
              {activeVersion.headerType !== "NONE" && activeVersion.headerContent && (
                <div>
                  <span className="text-xs text-base-content/60 uppercase">
                    Header ({activeVersion.headerType})
                  </span>
                  <p className="text-sm mt-0.5">{activeVersion.headerContent}</p>
                </div>
              )}
              <div>
                <span className="text-xs text-base-content/60 uppercase">Body</span>
                <p className="text-sm mt-0.5 whitespace-pre-wrap">{activeVersion.body}</p>
              </div>
              {activeVersion.footer && (
                <div>
                  <span className="text-xs text-base-content/60 uppercase">Footer</span>
                  <p className="text-sm mt-0.5">{activeVersion.footer}</p>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2 mt-4">
              {activeVersion.status === "DRAFT" && !activeVersion.isLocked && (
                <>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => setEditOpen(true)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={handleSubmit}
                    disabled={submitMutation.isPending}
                  >
                    {submitMutation.isPending ? "Submitting…" : "Submit for approval"}
                  </button>
                </>
              )}
              {activeVersion.status === "PENDING" && showApproveReject && (
                <>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={handleApprove}
                    disabled={approveMutation.isPending}
                  >
                    {approveMutation.isPending ? "Approving…" : "Approve"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-error btn-sm"
                    onClick={handleRejectOpen}
                    disabled={rejectMutation.isPending}
                  >
                    Reject
                  </button>
                </>
              )}
              {activeVersion.status === "APPROVED" && (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={handleSync}
                  disabled={syncMutation.isPending}
                >
                  {syncMutation.isPending ? "Syncing…" : "Sync to provider"}
                </button>
              )}
              {activeVersion.status === "PROVIDER_REJECTED" && (
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => setCreateVersionOpen(true)}
                >
                  Create new version
                </button>
              )}
              {!isEditable &&
                activeVersion.status !== "PENDING" &&
                activeVersion.status !== "APPROVED" &&
                activeVersion.status !== "PROVIDER_PENDING" &&
                activeVersion.status !== "PROVIDER_APPROVED" &&
                activeVersion.status !== "PROVIDER_REJECTED" && (
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => setCreateVersionOpen(true)}
                  >
                    Create new version
                  </button>
                )}
            </div>
          </div>
        </div>
      )}

      {(submitMutation.error ||
        approveMutation.error ||
        rejectMutation.error ||
        syncMutation.error ||
        archiveMutation.error ||
        refreshStatusMutation.error) && (
        <div role="alert" className="alert alert-error">
          <span>
            {getApiError(
              submitMutation.error ??
                approveMutation.error ??
                rejectMutation.error ??
                syncMutation.error ??
                archiveMutation.error ??
                refreshStatusMutation.error
            )}
          </span>
        </div>
      )}

      {editOpen && activeVersion && (
        <TemplateVersionEditor
          templateCategory={template.category}
          initial={activeVersion}
          onSave={handleUpdateVersion}
          onCancel={() => setEditOpen(false)}
          isPending={updateVersionMutation.isPending}
          mode="update"
        />
      )}

      {createVersionOpen && (
        <TemplateVersionEditor
          templateCategory={template.category}
          initial={null}
          onSave={handleCreateVersion}
          onCancel={() => setCreateVersionOpen(false)}
          isPending={createVersionMutation.isPending}
          mode="create"
        />
      )}

      {rejectModalVersion != null && (
        <dialog open className="modal modal-middle">
          <div className="modal-box">
            <h3 className="font-semibold">Reject version</h3>
            <p className="text-sm text-base-content/70 py-2">
              Provide a reason for rejection (optional but recommended).
            </p>
            <textarea
              className="textarea textarea-bordered w-full mt-2"
              placeholder="Rejection reason…"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
            />
            <div className="modal-action">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setRejectModalVersion(null);
                  setRejectReason("");
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-error"
                onClick={handleRejectConfirm}
                disabled={rejectMutation.isPending || !rejectReason.trim()}
              >
                {rejectMutation.isPending ? "Rejecting…" : "Reject"}
              </button>
            </div>
          </div>
          <form
            method="dialog"
            className="modal-backdrop"
            onSubmit={() => {
              setRejectModalVersion(null);
              setRejectReason("");
            }}
          >
            <button type="submit">close</button>
          </form>
        </dialog>
      )}
    </div>
  );
}

