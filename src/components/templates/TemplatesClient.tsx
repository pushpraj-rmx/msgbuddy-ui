"use client";

import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import {
  useTemplatesList,
  useTemplateLimits,
  useRemoveTemplate,
  type TemplatesListParams,
} from "@/hooks/use-templates";
import { normalizeQualityRating, type Template } from "@/lib/types";

import { TemplatePanelContent } from "./TemplatePanelContent";
import { getApiError } from "@/lib/api-error";
import { roleHasWorkspacePermission } from "@/lib/workspace-role-permissions";
import { useMutation } from "@tanstack/react-query";
import { Search, RefreshCw, Plus, Download, Trash2, Settings } from "lucide-react";
import { useRightPanel } from "@/components/right-panel/useRightPanel";

const PAGE_SIZES = [10, 25, 50, 100];

/** Coarse WhatsApp approval status derived from a row's raw Meta providerStatus. */
type WhatsAppDerivedStatus =
  | "approved"
  | "pending"
  | "appeal"
  | "rejected"
  | "paused"
  | "disabled"
  | "archived"
  | "draft";

/** Raw Meta provider status → coarse derived status. Keys match ChannelTemplate.providerStatus strings. */
const WA_RAW_STATUS_TO_DERIVED: Record<string, WhatsAppDerivedStatus> = {
  APPROVED: "approved",
  PENDING: "pending",
  PROVIDER_PENDING: "pending",
  REJECTED: "rejected",
  PAUSED: "paused",
  DISABLED: "disabled",
  IN_APPEAL: "appeal",
  APPEAL_REQUESTED: "appeal",
  ARCHIVED_BY_META: "archived",
};

/** Derived status → list badge presentation. */
const WA_STATUS_BADGE: Record<WhatsAppDerivedStatus, { label: string; cls: string }> = {
  approved: { label: "Approved", cls: "op-tag-ok" },
  pending: { label: "Pending", cls: "op-tag-warn" },
  appeal: { label: "In appeal", cls: "op-tag-warn" },
  rejected: { label: "Rejected", cls: "op-tag-danger" },
  paused: { label: "Paused", cls: "op-tag-warn" },
  disabled: { label: "Disabled", cls: "op-tag-danger" },
  archived: { label: "Archived", cls: "op-tag-danger" },
  draft: { label: "Draft", cls: "" },
};

/**
 * Single source of truth for a row's WhatsApp status: reads the first
 * non-deleted WHATSAPP channel template's raw Meta providerStatus (the only
 * status carried in the list payload) and maps it to a coarse derived status.
 * Returns null when the template has no WhatsApp channel template at all. Used
 * by both the list badge cell and the status filter so they never diverge.
 */
function deriveWhatsAppStatus(template: Template): WhatsAppDerivedStatus | null {
  const ct = (template.channelTemplates ?? []).find(
    (c) => c.channel === "WHATSAPP" && !c.deletedAt
  );
  if (!ct) return null;
  const raw = (ct.providerStatus ?? "").toUpperCase();
  if (!raw) return "draft";
  return WA_RAW_STATUS_TO_DERIVED[raw] ?? "draft";
}

/**
 * WhatsApp approval + quality badge for a list row. Lets users see approved /
 * pending / rejected without opening each row.
 */
function WhatsAppStatusCell({ template }: { template: Template }) {
  const ct = (template.channelTemplates ?? []).find(
    (c) => c.channel === "WHATSAPP" && !c.deletedAt
  );
  if (!ct) return <span className="op-tag">No WhatsApp</span>;
  const badge = WA_STATUS_BADGE[deriveWhatsAppStatus(template) ?? "draft"];
  const rating = normalizeQualityRating(ct.qualityScore);
  const showQuality = ct.qualityScore != null && rating !== "UNKNOWN";
  const reclassifyPending =
    !!ct.providerCorrectCategory &&
    ct.providerCorrectCategory.toUpperCase() !==
      (ct.category ?? "").toUpperCase();
  return (
    <div className="flex flex-col gap-1">
      <span className={`op-tag ${badge.cls}`}>{badge.label}</span>
      {ct.category && (
        <span className="op-tag" title="WhatsApp template category">
          {ct.category}
        </span>
      )}
      {reclassifyPending && (
        <span
          className="op-tag op-tag-warn"
          title={`Meta plans to reclassify this to ${ct.providerCorrectCategory}`}
        >
          → {ct.providerCorrectCategory}
        </span>
      )}
      {showQuality && (
        <span
          className={`op-tag ${
            rating === "GREEN"
              ? "op-tag-ok"
              : rating === "YELLOW"
                ? "op-tag-warn"
                : "op-tag-danger"
          }`}
        >
          {rating === "GREEN" ? "High" : rating === "YELLOW" ? "Medium" : "Low"}{" "}
          quality
        </span>
      )}
    </div>
  );
}

export function TemplatesClient({ meRole }: { meRole: string }) {
  const canCreateTemplate = roleHasWorkspacePermission(meRole, "templates.create");
  const [search, setSearch] = useState("");
  const [isActive, setIsActive] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("updatedAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [deleteConfirm, setDeleteConfirm] = useState<Template | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const { setContent: setRightPanelContent, clearContent: clearRightPanelContent } = useRightPanel();

  const debouncedSearch = useDebouncedValue(search, 300);

  const listParams: TemplatesListParams = useMemo(
    () => ({
      q: debouncedSearch.trim() || undefined,
      isActive:
        isActive === "true"
          ? true
          : isActive === "false"
            ? false
            : undefined,
      hasWhatsAppSendableVersion: statusFilter === "sendable" ? true : undefined,
      sortBy: sortBy || undefined,
      sortOrder,
      page,
      limit,
    }),
    [
      debouncedSearch,
      isActive,
      statusFilter,
      sortBy,
      sortOrder,
      page,
      limit,
    ]
  );

  const { data, isLoading, isFetching, error, refetch } =
    useTemplatesList(listParams);
  const limitsQuery = useTemplateLimits();
  const limits = limitsQuery.data;
  const atLimit = limits ? limits.current >= limits.max : false;
  const removeMutation = useRemoveTemplate();

  // "sendable" is applied server-side via hasWhatsAppSendableVersion; the coarse
  // derived-status buckets are applied client-side from the list payload so the
  // filter and the WhatsApp badge column always agree (shared deriveWhatsAppStatus).
  const filteredItems = useMemo(() => {
    const items = data?.items ?? [];
    if (!statusFilter || statusFilter === "sendable") return items;
    return items.filter((t) => deriveWhatsAppStatus(t) === statusFilter);
  }, [data?.items, statusFilter]);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleteError, setBulkDeleteError] = useState<string | null>(null);

  // Clear selection when filters/search/pagination change
  useEffect(() => {
    setSelectedIds(new Set());
  }, [debouncedSearch, isActive, statusFilter, sortBy, sortOrder, page, limit]);

  const bulkDeleteMutation = useMutation({
    // allSettled, not all — one failure (e.g. a template in use by a campaign)
    // must not abort the whole batch or leave a partially-deleted, stale
    // selection. Succeeded rows are cleared; failed rows stay selected and are
    // surfaced to the user.
    mutationFn: async (ids: string[]) => {
      const results = await Promise.allSettled(
        ids.map((id) => removeMutation.mutateAsync(id))
      );
      const failedIds = ids.filter((_, i) => results[i].status === "rejected");
      return { failedIds };
    },
    onSuccess: ({ failedIds }, ids) => {
      const failed = new Set(failedIds);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => {
          if (!failed.has(id)) next.delete(id);
        });
        return next;
      });
      if (failedIds.length > 0) {
        setBulkDeleteError(
          `${failedIds.length} of ${ids.length} template(s) could not be deleted (they may be in use by an active campaign). The others were removed.`
        );
      } else {
        setBulkDeleteError(null);
        setBulkDeleteOpen(false);
      }
    },
    onError: (err) => setBulkDeleteError(getApiError(err)),
  });

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllOnPage = () => {
    const displayedIds = filteredItems.map((t) => t.id);
    if (displayedIds.length === 0) return;
    const allSelected = displayedIds.every((id) => selectedIds.has(id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) displayedIds.forEach((id) => next.delete(id));
      else displayedIds.forEach((id) => next.add(id));
      return next;
    });
  };

  const headerCheckboxRef = useRef<HTMLInputElement>(null);
  const selectedOnPageCount = useMemo(
    () => filteredItems.filter((t) => selectedIds.has(t.id)).length,
    [filteredItems, selectedIds]
  );
  const headerIndeterminate =
    selectedOnPageCount > 0 && selectedOnPageCount < filteredItems.length;

  useEffect(() => {
    if (headerCheckboxRef.current)
      headerCheckboxRef.current.indeterminate = headerIndeterminate;
  }, [headerIndeterminate]);

  const [sorting, setSorting] = useState<SortingState>([
    { id: "updatedAt", desc: true },
  ]);

  useEffect(() => {
    if (!selectedTemplateId) {
      clearRightPanelContent("templates");
      return;
    }
    const items = data?.items ?? [];
    const selected = items.find((t) => t.id === selectedTemplateId);
    setRightPanelContent({
      source: "templates",
      title: selected?.name ?? "Template",
      openAfter: true,
      content: (
        <TemplatePanelContent
          key={selectedTemplateId}
          templateId={selectedTemplateId}
        />
      ),
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-run when selectedTemplateId changes, not on data refetch
  }, [selectedTemplateId, setRightPanelContent, clearRightPanelContent]);

  useEffect(() => {
    return () => clearRightPanelContent("templates");
  }, [clearRightPanelContent]);

  const columns: ColumnDef<Template>[] = useMemo(
    () => [
      {
        id: "select",
        header: () => (
          <input
            ref={headerCheckboxRef}
            type="checkbox"
            className="checkbox checkbox-sm"
            checked={filteredItems.length > 0 && selectedOnPageCount === filteredItems.length}
            onChange={selectAllOnPage}
            onClick={(e) => e.stopPropagation()}
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            className="checkbox checkbox-sm"
            checked={selectedIds.has(row.original.id)}
            onChange={() => toggleSelection(row.original.id)}
            onClick={(e) => e.stopPropagation()}
            aria-label={`Select ${row.original.name}`}
          />
        ),
      },
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => (
          <div>
            <span className="font-medium">{row.original.name}</span>
            {row.original.description && (
              <p className="text-xs text-base-content/60 truncate max-w-[200px]">
                {row.original.description}
              </p>
            )}
            {(row.original.channelTemplates ?? []).filter((ct) => !ct.deletedAt).length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {(row.original.channelTemplates ?? []).filter((ct) => !ct.deletedAt).map((ct) => (
                  <span key={ct.id} className="op-tag">{ct.channel}</span>
                ))}
              </div>
            )}
          </div>
        ),
      },
      {
        accessorKey: "isActive",
        header: "Active",
        cell: ({ row }) =>
          row.original.isActive ? (
            <span className="op-tag op-tag-ok">Yes</span>
          ) : (
            <span className="op-tag">No</span>
          ),
      },
      {
        id: "waStatus",
        header: "WhatsApp",
        cell: ({ row }) => <WhatsAppStatusCell template={row.original} />,
      },
      {
        accessorKey: "updatedAt",
        header: "Updated",
        cell: ({ row }) =>
          row.original.updatedAt
            ? new Date(row.original.updatedAt).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              })
            : "—",
      },
      {
        accessorKey: "createdAt",
        header: "Created",
        cell: ({ row }) =>
          row.original.createdAt
            ? new Date(row.original.createdAt).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              })
            : "—",
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => {
          const t = row.original;
          return (
            <div
              className="flex items-center gap-1"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="tooltip tooltip-left" data-tip="Manage versions">
                <button
                  type="button"
                  className="btn btn-ghost btn-xs btn-square"
                  onClick={() => setSelectedTemplateId(t.id)}
                >
                  <Settings className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="tooltip tooltip-left" data-tip="Delete template">
                <button
                  type="button"
                  className="btn btn-ghost btn-xs btn-square text-error/70 hover:text-error"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteConfirm(t);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps -- selection state drives checkbox renders
    [selectedIds, selectedOnPageCount, filteredItems]
  );

  const table = useReactTable({
    data: filteredItems,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: { sorting },
    onSortingChange: setSorting,
    manualSorting: true,
    manualPagination: true,
    pageCount: data ? Math.ceil((data.total || 0) / data.limit) : 0,
  });

  const handleSort = useCallback(
    (id: string) => {
      const desc = sortBy === id && sortOrder === "desc" ? false : true;
      setSortBy(id);
      setSortOrder(desc ? "desc" : "asc");
      setPage(1);
    },
    [sortBy, sortOrder]
  );

  const handleDelete = useCallback(
    (t: Template) => {
      removeMutation.mutate(t.id, {
        onSettled: () => setDeleteConfirm(null),
      });
    },
    [removeMutation]
  );

  const totalPages = data
    ? Math.max(1, Math.ceil(data.total / data.limit))
    : 1;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="rounded-box border border-base-300 bg-base-200 px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative min-w-[200px] flex-1 max-w-sm">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-base-content/40" />
            <input
              type="search"
              placeholder="Search templates…"
              className="input input-bordered input-sm w-full pl-8"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              data-esc-clearable="true"
            />
          </div>
          {/* Filters */}
          <select
            className="select select-bordered select-sm w-24"
            value={isActive}
            onChange={(e) => { setIsActive(e.target.value); setPage(1); }}
            aria-label="Filter by active status"
          >
            <option value="">Active: All</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
          <select
            className="select select-bordered select-sm w-40"
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            aria-label="Filter by WhatsApp status"
          >
            <option value="">WhatsApp: All</option>
            <option value="sendable">Sendable</option>
            <option value="pending">Pending</option>
            <option value="appeal">In appeal</option>
            <option value="rejected">Rejected</option>
            <option value="paused">Paused</option>
            <option value="draft">Draft</option>
          </select>
          <select
            className="select select-bordered select-sm w-20"
            value={limit}
            onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
            aria-label="Rows per page"
          >
            {PAGE_SIZES.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
          {/* Spacer */}
          <div className="flex-1" />
          {/* Quota indicator */}
          {limits != null && (
            <span className="font-mono-op text-[0.6875rem] tabular-nums text-base-content/50">
              {limits.current}/{limits.max}
              {limits.isVerified && " · verified"}
            </span>
          )}
          {/* Actions */}
          {canCreateTemplate && (
            <div className="tooltip tooltip-bottom" data-tip="Import from Meta">
              <Link
                href="/settings/integrations/whatsapp/import-templates?returnTo=%2Ftemplates"
                className="btn btn-ghost btn-sm btn-square"
              >
                <Download className="h-4 w-4" />
              </Link>
            </div>
          )}
          <div className="tooltip tooltip-bottom" data-tip="Refresh">
            <button
              type="button"
              className="btn btn-ghost btn-sm btn-square"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              {isFetching ? (
                <span className="loading loading-spinner loading-xs" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </button>
          </div>
          {selectedIds.size > 0 && (
            <>
              <div className="mx-1 h-5 w-px bg-base-300" />
              <div className="tooltip tooltip-bottom" data-tip={`Delete ${selectedIds.size} selected`}>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm gap-1 text-error/70 hover:text-error"
                  onClick={() => { setBulkDeleteError(null); setBulkDeleteOpen(true); }}
                  disabled={bulkDeleteMutation.isPending}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span className="font-mono-op text-[0.625rem] tabular-nums">{selectedIds.size}</span>
                </button>
              </div>
            </>
          )}
          {canCreateTemplate &&
            (atLimit ? (
              <button
                type="button"
                className="btn btn-primary btn-sm gap-1"
                disabled
                title={`Template limit reached (${limits?.current ?? ""}/${limits?.max ?? ""}). Delete a template or upgrade to create more.`}
              >
                <Plus className="h-3.5 w-3.5" /> Create
              </button>
            ) : (
              <Link
                href="/templates/new"
                className="btn btn-primary btn-sm gap-1"
              >
                <Plus className="h-3.5 w-3.5" /> Create
              </Link>
            ))}
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-box border border-error/30 border-l-2 border-l-error bg-base-200 px-4 py-3">
          <span>{getApiError(error)}</span>
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-box border border-base-300 bg-base-200">
        <div className="overflow-x-auto">
          <table className="w-full text-[0.78125rem]">
            <thead>
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id} className="border-b border-base-300 bg-base-100">
                  {hg.headers.map((h) => {
                    const sortable = ["name", "updatedAt", "createdAt", "isActive"].includes(h.id);
                    return (
                      <th
                        key={h.id}
                        className={`op-label px-3 py-2.5 text-left font-medium ${sortable ? "cursor-pointer select-none hover:text-base-content" : ""}`}
                        onClick={() => sortable ? handleSort(h.id) : undefined}
                      >
                        {h.column.columnDef.header as React.ReactNode}
                        {sortBy === h.id && (
                          <span className="ml-1">{sortOrder === "desc" ? "↓" : "↑"}</span>
                        )}
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={columns.length} className="px-3 py-8 text-center">
                    <span className="loading loading-spinner loading-sm text-primary" />
                  </td>
                </tr>
              ) : table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="px-3 py-12 text-center">
                    {debouncedSearch.trim() || isActive || statusFilter ? (
                      <p className="text-[0.8125rem] text-base-content/55">
                        No templates match your filters.
                      </p>
                    ) : (
                      <div className="mx-auto max-w-sm space-y-2">
                        <p className="text-sm font-medium text-base-content/80">
                          No templates yet
                        </p>
                        <p className="text-[0.8125rem] text-base-content/55">
                          Create a WhatsApp message template, or import the ones
                          you already have on Meta.
                        </p>
                        {canCreateTemplate && (
                          <div className="flex items-center justify-center gap-2 pt-1">
                            {atLimit ? (
                              <button
                                type="button"
                                className="btn btn-primary btn-sm gap-1"
                                disabled
                                title={`Template limit reached (${limits?.current ?? ""}/${limits?.max ?? ""}). Delete a template or upgrade to create more.`}
                              >
                                <Plus className="h-3.5 w-3.5" /> Create template
                              </button>
                            ) : (
                              <Link href="/templates/new" className="btn btn-primary btn-sm gap-1">
                                <Plus className="h-3.5 w-3.5" /> Create template
                              </Link>
                            )}
                            <Link
                              href="/settings/integrations/whatsapp/import-templates?returnTo=%2Ftemplates"
                              className="btn btn-ghost btn-sm gap-1"
                            >
                              <Download className="h-3.5 w-3.5" /> Import from Meta
                            </Link>
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className="cursor-pointer border-b border-base-300 transition hover:bg-base-300/40 last:border-b-0"
                    onClick={() => setSelectedTemplateId(row.original.id)}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className={`px-3 py-3 align-middle ${["updatedAt", "createdAt"].includes(cell.column.id) ? "font-mono-op text-[0.6875rem] tabular-nums text-base-content/70" : ""}`}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data && data.total > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-base-300 px-3 py-2.5">
            <span className="font-mono-op text-[0.625rem] tracking-[0.04em] tabular-nums text-base-content/50">
              {(page - 1) * limit + 1}–{Math.min(page * limit, data.total)} of {data.total}
            </span>
            <div className="join">
              <button
                type="button"
                className="btn btn-sm join-item"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                Prev
              </button>
              <button
                type="button"
                className="btn btn-sm join-item font-mono-op tabular-nums text-[0.625rem] no-animation"
                disabled
              >
                {page} / {totalPages}
              </button>
              <button
                type="button"
                className="btn btn-sm join-item"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>


      {deleteConfirm && (
        <dialog open className="modal modal-middle">
          <div className="modal-box">
            <h3 className="font-semibold">Delete template?</h3>
            <p className="py-2 text-base-content/70">
              <strong>{deleteConfirm.name}</strong> will be permanently removed. This cannot be undone.
            </p>
            <div className="modal-action">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setDeleteConfirm(null)}
                disabled={removeMutation.isPending}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-error"
                onClick={() => handleDelete(deleteConfirm)}
                disabled={removeMutation.isPending}
              >
                {removeMutation.isPending ? (
                  <span className="loading loading-spinner loading-sm" />
                ) : (
                  "Delete"
                )}
              </button>
            </div>
          </div>
          <form
            method="dialog"
            className="modal-backdrop"
            onSubmit={() => setDeleteConfirm(null)}
          >
            <button type="submit">close</button>
          </form>
        </dialog>
      )}

      {bulkDeleteOpen && (
        <dialog open className="modal modal-middle">
          <div className="modal-box">
            <h3 className="font-semibold">Delete selected templates</h3>
            <p className="mt-2 text-sm text-base-content/70">
              Soft-delete {selectedIds.size} template
              {selectedIds.size !== 1 ? "s" : ""}? They will be marked as
              deleted and will no longer appear in this list.
            </p>
            {bulkDeleteError && (
              <div
                role="alert"
                className="mt-3 rounded-box border border-error/30 border-l-2 border-l-error bg-base-200 px-3 py-2 text-[0.8125rem] text-base-content"
              >
                {bulkDeleteError}
              </div>
            )}
            <div className="modal-action">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setBulkDeleteOpen(false)}
                disabled={bulkDeleteMutation.isPending}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-error"
                onClick={() =>
                  bulkDeleteMutation.mutate(Array.from(selectedIds))
                }
                disabled={bulkDeleteMutation.isPending}
              >
                {bulkDeleteMutation.isPending ? (
                  <span className="loading loading-spinner loading-sm" />
                ) : (
                  "Delete"
                )}
              </button>
            </div>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button
              type="button"
              onClick={() => setBulkDeleteOpen(false)}
              aria-label="Close"
            />
          </form>
        </dialog>
      )}
    </div>
  );
}
