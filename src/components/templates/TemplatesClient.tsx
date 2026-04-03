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
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import {
  useTemplatesList,
  useTemplateLimits,
  useCreateTemplate,
  useRemoveTemplate,
  type TemplatesListParams,
} from "@/hooks/use-templates";
import type { Template } from "@/lib/types";
import { TemplateCreateModal } from "./TemplateCreateModal";

const SORT_FIELDS = [
  { value: "updatedAt", label: "Updated" },
  { value: "createdAt", label: "Created" },
  { value: "name", label: "Name" },
  { value: "isActive", label: "Active" },
] as const;

const PAGE_SIZES = [10, 25, 50, 100];

function getApiError(err: unknown): string {
  return (err as { response?: { data?: { message?: string } } })?.response
    ?.data?.message ?? "Something went wrong.";
}

export function TemplatesClient() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [isActive, setIsActive] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("updatedAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Template | null>(null);

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
      sortBy: sortBy || undefined,
      sortOrder,
      page,
      limit,
    }),
    [
      debouncedSearch,
      isActive,
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
  const createMutation = useCreateTemplate();
  const removeMutation = useRemoveTemplate();

  const [sorting, setSorting] = useState<SortingState>([
    { id: "updatedAt", desc: true },
  ]);

  const columns: ColumnDef<Template>[] = useMemo(
    () => [
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
          </div>
        ),
      },
      {
        accessorKey: "isActive",
        header: "Active",
        cell: ({ row }) =>
          row.original.isActive ? (
            <span className="badge badge-success badge-sm">Yes</span>
          ) : (
            <span className="badge badge-ghost badge-sm">No</span>
          ),
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
            <div className="flex items-center gap-1">
              <Link
                href={`/templates/${t.id}`}
                className="btn btn-ghost btn-xs"
              >
                Manage
              </Link>
              <button
                type="button"
                className="btn btn-ghost btn-xs"
                disabled
                title="Preview is moving to WhatsApp templates"
              >
                Preview
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-xs text-error"
                onClick={() => setDeleteConfirm(t)}
              >
                Delete
              </button>
            </div>
          );
        },
      },
    ],
    []
  );

  // TanStack Table intentionally uses dynamic function references.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: data?.items ?? [],
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

  const handleCreate = useCallback(
    (payload: {
      name: string;
      description?: string;
    }) => {
      setCreateError(null);
      createMutation.mutate(payload, {
        onSuccess: (data) => {
          setCreating(false);
          router.push(`/templates/${data.id}`);
        },
        onError: (err) => {
          setCreateError(getApiError(err));
        },
      });
    },
    [createMutation, router]
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
      {/* Filters */}
      <div className="rounded-box border border-base-300 bg-base-100 p-4">
          <div className="flex flex-wrap items-end gap-2">
            <div className="form-control min-w-[200px]">
              <label className="label py-0">
                <span className="label-text text-xs text-base-content/60">Search</span>
              </label>
              <input
                type="search"
                placeholder="Search messages…"
                className="input input-bordered input-sm w-full"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div className="form-control w-28">
              <label className="label py-0">
                <span className="label-text text-xs text-base-content/60">Active</span>
              </label>
              <select
                className="select select-bordered select-sm w-full"
                value={isActive}
                onChange={(e) => {
                  setIsActive(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">All</option>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </div>
            <div className="form-control w-32">
              <label className="label py-0">
                <span className="label-text text-xs text-base-content/60">Sort</span>
              </label>
              <select
                className="select select-bordered select-sm w-full"
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value);
                  setPage(1);
                }}
              >
                {SORT_FIELDS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setSortOrder((o) => (o === "desc" ? "asc" : "desc"));
                setPage(1);
              }}
              title={sortOrder === "desc" ? "Descending" : "Ascending"}
            >
              {sortOrder === "desc" ? "↓" : "↑"}
            </button>
            <div className="form-control w-20">
              <label className="label py-0">
                <span className="label-text text-xs text-base-content/60">Per page</span>
              </label>
              <select
                className="select select-bordered select-sm w-full"
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setPage(1);
                }}
              >
                {PAGE_SIZES.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2 ml-auto">
              {limits != null && (
                <span className="text-sm text-base-content/60 self-center">
                  {limits.current} / {limits.max} templates
                  {limits.isVerified && " (verified)"}
                </span>
              )}
              <Link
                href="/settings/integrations/whatsapp/import-templates"
                className="btn btn-outline btn-sm"
                title="Import existing WhatsApp templates from Meta"
              >
                Import from Meta
              </Link>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => {
                  setCreateError(null);
                  setCreating(true);
                }}
                disabled={atLimit}
                title={atLimit ? "Template limit reached" : undefined}
              >
                Create message
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => refetch()}
                disabled={isFetching}
              >
                {isFetching ? (
                  <span className="loading loading-spinner loading-sm" />
                ) : (
                  "Refresh"
                )}
              </button>
            </div>
          </div>
      </div>

      {error && (
        <div role="alert" className="alert alert-error">
          <span>{getApiError(error)}</span>
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-box border border-base-300 bg-base-100">
        <div className="overflow-x-auto">
          <table className="table table-sm table-zebra">
            <thead>
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
                  {hg.headers.map((h) => (
                    <th
                      key={h.id}
                      className={
                        ["name", "updatedAt", "createdAt", "isActive"].includes(
                          h.id
                        )
                          ? "cursor-pointer select-none text-xs font-medium text-base-content/60"
                          : "text-xs font-medium text-base-content/60"
                      }
                      onClick={() =>
                        ["name", "updatedAt", "createdAt", "isActive"].includes(
                          h.id
                        )
                          ? handleSort(h.id)
                          : undefined
                      }
                    >
                      {h.column.columnDef.header as React.ReactNode}
                      {sortBy === h.id && (
                        <span className="ml-1 opacity-70">
                          {sortOrder === "desc" ? " ↓" : " ↑"}
                        </span>
                      )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={columns.length} className="text-center py-8">
                    <span className="loading loading-spinner" />
                  </td>
                </tr>
              ) : table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="text-center py-8 text-base-content/60">
                    No messages found.
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="align-middle text-sm">
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
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-base-300 p-3">
            <p className="text-sm text-base-content/70">
              Showing {(page - 1) * limit + 1}–{Math.min(page * limit, data.total)} of{" "}
              {data.total}
            </p>
            <div className="join">
              <button
                type="button"
                className="btn btn-sm join-item"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                Previous
              </button>
              <button
                type="button"
                className="btn btn-sm join-item btn-disabled no-animation"
              >
                Page {page} of {totalPages}
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

      {creating && (
        <TemplateCreateModal
          onClose={() => {
            setCreateError(null);
            setCreating(false);
          }}
          onSave={handleCreate}
          isPending={createMutation.isPending}
          errorMessage={createError}
          onClearError={() => setCreateError(null)}
        />
      )}

      {deleteConfirm && (
        <dialog open className="modal modal-middle">
          <div className="modal-box">
            <h3 className="font-semibold">Delete message?</h3>
            <p className="py-2 text-base-content/70">
              “{deleteConfirm.name}” will be removed. This cannot be undone.
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
    </div>
  );
}
