"use client";

import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import Link from "next/link";
import { useMemo } from "react";
import { RefreshCw, Settings } from "lucide-react";
import { useCatalogs } from "@/hooks/use-commerce";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { getApiError } from "@/lib/api-error";
import type { ProductCatalog, ProductCatalogSyncStatus } from "@/lib/types";

const SYNC_BADGE: Record<ProductCatalogSyncStatus, { label: string; cls: string }> = {
  NEVER_SYNCED: { label: "Never synced", cls: "" },
  SYNCING: { label: "Syncing", cls: "op-tag-warn" },
  SYNCED: { label: "Synced", cls: "op-tag-ok" },
  ERROR: { label: "Sync error", cls: "op-tag-danger" },
};

function formatDate(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function CatalogsClient({ meRole }: { meRole: string }) {
  const { data, isLoading, isFetching, error, refetch } = useCatalogs();
  const catalogs = data ?? [];

  const columns: ColumnDef<ProductCatalog>[] = useMemo(
    () => [
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => (
          <div>
            <span className="font-medium">{row.original.name}</span>
            {row.original.vertical && (
              <p className="text-xs text-base-content/60">{row.original.vertical}</p>
            )}
          </div>
        ),
      },
      {
        accessorKey: "productCount",
        header: "Products",
        cell: ({ row }) => (
          <span className="font-mono-op tabular-nums text-base-content/70">
            {row.original.productCount}
          </span>
        ),
      },
      {
        accessorKey: "connectedToWaba",
        header: "WhatsApp",
        cell: ({ row }) =>
          row.original.connectedToWaba ? (
            <span className="op-tag op-tag-ok">Connected</span>
          ) : (
            <span className="op-tag">Not connected</span>
          ),
      },
      {
        accessorKey: "syncStatus",
        header: "Sync",
        cell: ({ row }) => {
          const badge = SYNC_BADGE[row.original.syncStatus] ?? SYNC_BADGE.NEVER_SYNCED;
          return <span className={`op-tag ${badge.cls}`}>{badge.label}</span>;
        },
      },
      {
        accessorKey: "lastSyncedAt",
        header: "Last synced",
        cell: ({ row }) => formatDate(row.original.lastSyncedAt),
      },
    ],
    []
  );

  const table = useReactTable({
    data: catalogs,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id,
  });

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="rounded-box border border-base-300 bg-base-200 px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-[0.8125rem] text-base-content/60">
            {catalogs.length} catalog{catalogs.length === 1 ? "" : "s"} mirrored
          </p>
          <div className="flex-1" />
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
          <Link href="/commerce/settings" className="btn btn-ghost btn-sm gap-1">
            <Settings className="h-3.5 w-3.5" /> Manage
          </Link>
        </div>
      </div>

      {error && <ErrorState message={getApiError(error)} />}

      {!error &&
        (isLoading ? (
          <div className="overflow-hidden rounded-box border border-base-300 bg-base-200">
            <div className="px-3 py-8 text-center">
              <span className="loading loading-spinner loading-sm text-primary" />
            </div>
          </div>
        ) : catalogs.length === 0 ? (
          <EmptyState
            title="No catalogs yet"
            description="Connect a Meta System User token and refresh from Meta to mirror your product catalogs."
            action={
              <Link href="/commerce/settings" className="btn btn-primary btn-sm gap-1">
                <Settings className="h-3.5 w-3.5" /> Go to Settings
              </Link>
            }
          />
        ) : (
          <div className="overflow-hidden rounded-box border border-base-300 bg-base-200">
            <div className="overflow-x-auto">
              <table className="w-full text-[0.78125rem]">
                <thead>
                  {table.getHeaderGroups().map((hg) => (
                    <tr key={hg.id} className="border-b border-base-300 bg-base-100">
                      {hg.headers.map((h) => (
                        <th
                          key={h.id}
                          className="op-label px-3 py-2.5 text-left font-medium"
                        >
                          {flexRender(
                            h.column.columnDef.header,
                            h.getContext()
                          )}
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {table.getRowModel().rows.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-base-300 transition last:border-b-0 hover:bg-base-300/40"
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td
                          key={cell.id}
                          className={`px-3 py-3 align-middle ${
                            cell.column.id === "lastSyncedAt"
                              ? "font-mono-op text-[0.6875rem] tabular-nums text-base-content/70"
                              : ""
                          }`}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
    </div>
  );
}
