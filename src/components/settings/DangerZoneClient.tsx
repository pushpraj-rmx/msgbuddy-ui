"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { PurgeContactsClient } from "@/components/settings/PurgeContactsClient";
import { workspaceApi } from "@/lib/api";

export function DangerZoneClient({
  workspaceId,
  workspaceName,
}: {
  workspaceId: string;
  workspaceName: string;
}) {
  const router = useRouter();
  const [dangerBusy, setDangerBusy] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  const onDeleteWorkspace = async () => {
    setDangerBusy(true);
    try {
      await workspaceApi.deleteWorkspace(workspaceId);
      router.replace("/login");
    } catch {
      setDangerBusy(false);
    }
  };

  return (
    <section className="space-y-3">
      <span className="op-section-title text-error">Danger zone</span>
      <div className="space-y-3">
        <div className="rounded-box border border-error/20 bg-base-200 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[0.875rem] font-semibold">Archive workspace</p>
              <p className="mt-0.5 text-[0.75rem] text-base-content/55">
                Pauses all integrations and automation. Reactivate anytime.
              </p>
            </div>
            <button
              type="button"
              className="btn btn-sm btn-outline btn-error"
              onClick={() => setShowConfirmDelete(true)}
              disabled={dangerBusy}
            >
              {dangerBusy ? (
                <>
                  <span className="loading loading-spinner loading-xs" />
                  Archiving…
                </>
              ) : (
                "Archive"
              )}
            </button>
          </div>
        </div>

        <PurgeContactsClient workspaceName={workspaceName} />
      </div>

      <ConfirmDialog
        open={showConfirmDelete}
        title="Archive this workspace?"
        description="This is a soft-delete, but it will immediately block access."
        confirmLabel="Archive Workspace"
        tone="warning"
        loading={dangerBusy}
        onConfirm={() => {
          setShowConfirmDelete(false);
          onDeleteWorkspace();
        }}
        onClose={() => setShowConfirmDelete(false)}
      />
    </section>
  );
}
