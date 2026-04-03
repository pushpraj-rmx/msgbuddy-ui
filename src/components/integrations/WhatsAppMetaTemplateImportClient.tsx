"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { templatesApi } from "@/lib/api";

type PreviewItem = {
  providerTemplateId: string;
  name: string;
  language: string;
  category: string;
  status: string;
  action: "create" | "link" | "skip";
  reason?: string;
};

export function WhatsAppMetaTemplateImportClient({
  workspaceId,
}: {
  workspaceId: string;
}) {
  const previewQuery = useQuery({
    queryKey: ["templates", "metaImportPreview", workspaceId],
    queryFn: () => templatesApi.metaImportPreview(),
    staleTime: 10_000,
    retry: 1,
  });

  const items: PreviewItem[] = (previewQuery.data?.items ?? []) as any;
  const defaultSelected = useMemo(
    () => items.filter((i) => i.action !== "skip").map((i) => i.providerTemplateId),
    [items]
  );
  const [selected, setSelected] = useState<string[]>([]);

  const selectedIds = selected.length > 0 ? selected : defaultSelected;

  const importMutation = useMutation({
    mutationFn: () => templatesApi.metaImport(selectedIds),
  });

  const summary = useMemo(() => {
    const s = { create: 0, link: 0, skip: 0 };
    for (const i of items) s[i.action] += 1;
    return s;
  }, [items]);

  return (
    <div className="space-y-4">
      <div className="rounded-box border border-base-300 bg-base-100 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="space-y-1">
            <div className="text-sm text-base-content/70">
              Preview shows what will be created/linked. Import is idempotent and won’t overwrite local versions.
            </div>
            <div className="text-xs text-base-content/60">
              create: {summary.create} · link: {summary.link} · skip: {summary.skip}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="btn btn-outline btn-sm"
              onClick={() => previewQuery.refetch()}
              disabled={previewQuery.isFetching}
            >
              {previewQuery.isFetching ? (
                <>
                  <span className="loading loading-spinner loading-xs" />
                  Refreshing…
                </>
              ) : (
                "Refresh preview"
              )}
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => importMutation.mutate()}
              disabled={importMutation.isPending || selectedIds.length === 0}
              title={selectedIds.length === 0 ? "Nothing to import." : undefined}
            >
              {importMutation.isPending ? (
                <>
                  <span className="loading loading-spinner loading-xs" />
                  Importing…
                </>
              ) : (
                `Import ${selectedIds.length}`
              )}
            </button>
          </div>
        </div>
      </div>

      {previewQuery.isLoading ? (
        <div className="flex justify-center py-10">
          <span className="loading loading-spinner loading-lg" />
        </div>
      ) : previewQuery.isError ? (
        <div role="alert" className="alert alert-error">
          <span>
            {(previewQuery.error as any)?.message ?? "Failed to load Meta templates preview."}
          </span>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-box border border-base-300">
          <table className="table table-sm">
            <thead>
              <tr>
                <th className="w-10" />
                <th>Name</th>
                <th>Lang</th>
                <th>Category</th>
                <th>Status</th>
                <th>Action</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => {
                const disabled = i.action === "skip";
                const checked = selectedIds.includes(i.providerTemplateId);
                return (
                  <tr key={i.providerTemplateId} className={disabled ? "opacity-60" : ""}>
                    <td>
                      <input
                        type="checkbox"
                        className="checkbox checkbox-xs"
                        disabled={disabled}
                        checked={checked}
                        onChange={(e) => {
                          const next = e.target.checked;
                          setSelected((prev) => {
                            const set = new Set(prev.length ? prev : defaultSelected);
                            if (next) set.add(i.providerTemplateId);
                            else set.delete(i.providerTemplateId);
                            return Array.from(set);
                          });
                        }}
                      />
                    </td>
                    <td className="font-mono text-xs">{i.name}</td>
                    <td className="font-mono text-xs">{i.language}</td>
                    <td>{i.category}</td>
                    <td>{i.status}</td>
                    <td>
                      <span className="badge badge-ghost">{i.action}</span>
                    </td>
                    <td className="text-xs text-base-content/60">{i.reason ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {importMutation.isError && (
        <div role="alert" className="alert alert-error">
          <span>
            {(importMutation.error as any)?.message ?? "Import failed."}
          </span>
        </div>
      )}
      {importMutation.isSuccess && (
        <div role="status" className="alert alert-success">
          <span>Import completed.</span>
        </div>
      )}
    </div>
  );
}

