"use client";

import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ImageOff, RefreshCw, Search, Settings } from "lucide-react";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useCatalogs, useProducts, type CommerceProductsParams } from "@/hooks/use-commerce";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { getApiError } from "@/lib/api-error";
import type { CatalogProduct } from "@/lib/types";

const PAGE_SIZES = [10, 25, 50, 100];

function ProductThumb({ product }: { product: CatalogProduct }) {
  if (!product.imageUrl) {
    return (
      <div className="flex h-10 w-10 items-center justify-center rounded-box border border-base-300 bg-base-100 text-base-content/30">
        <ImageOff className="h-4 w-4" />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- remote Meta catalog image, dimensions unknown
    <img
      src={product.imageUrl}
      alt=""
      className="h-10 w-10 rounded-box border border-base-300 object-cover"
      loading="lazy"
    />
  );
}

function formatPrice(product: CatalogProduct): string {
  if (!product.price) return "—";
  return product.currency
    ? `${product.price} ${product.currency}`
    : product.price;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function ProductsClient({ meRole }: { meRole: string }) {
  const [search, setSearch] = useState("");
  const [catalogId, setCatalogId] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);

  const debouncedSearch = useDebouncedValue(search, 300);

  const catalogsQuery = useCatalogs();
  const catalogs = catalogsQuery.data ?? [];

  const listParams: CommerceProductsParams = useMemo(
    () => ({
      catalogId: catalogId || undefined,
      search: debouncedSearch.trim() || undefined,
      page,
      limit,
    }),
    [catalogId, debouncedSearch, page, limit]
  );

  const { data, isLoading, isFetching, error, refetch } = useProducts(listParams);

  const items = useMemo(() => data?.items ?? [], [data?.items]);
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  // Reset to the first page whenever a filter changes.
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, catalogId, limit]);

  const columns: ColumnDef<CatalogProduct>[] = useMemo(
    () => [
      {
        id: "image",
        header: "",
        cell: ({ row }) => <ProductThumb product={row.original} />,
      },
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => (
          <div className="min-w-0">
            <span className="font-medium">{row.original.name}</span>
            {row.original.category && (
              <p className="truncate text-xs text-base-content/60">
                {row.original.category}
              </p>
            )}
          </div>
        ),
      },
      {
        accessorKey: "retailerId",
        header: "Retailer ID",
        cell: ({ row }) => (
          <span className="font-mono-op text-[0.6875rem] text-base-content/70">
            {row.original.retailerId}
          </span>
        ),
      },
      {
        accessorKey: "price",
        header: "Price",
        cell: ({ row }) => (
          <span className="font-mono-op tabular-nums text-base-content/80">
            {formatPrice(row.original)}
          </span>
        ),
      },
      {
        accessorKey: "availability",
        header: "Availability",
        cell: ({ row }) => {
          const avail = (row.original.availability ?? "").toLowerCase();
          const inStock = avail.includes("in stock") || avail === "in_stock";
          return (
            <span className={`op-tag ${inStock ? "op-tag-ok" : ""}`}>
              {row.original.availability || "—"}
            </span>
          );
        },
      },
      {
        accessorKey: "brand",
        header: "Brand",
        cell: ({ row }) => row.original.brand || "—",
      },
    ],
    []
  );

  const table = useReactTable({
    data: items,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id,
    manualPagination: true,
    pageCount: totalPages,
  });

  const hasFilters = !!debouncedSearch.trim() || !!catalogId;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="rounded-box border border-base-300 bg-base-200 px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[200px] max-w-sm flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-base-content/40" />
            <input
              type="search"
              placeholder="Search products…"
              className="input input-bordered input-sm w-full pl-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              data-esc-clearable="true"
            />
          </div>
          <select
            className="select select-bordered select-sm w-48"
            value={catalogId}
            onChange={(e) => setCatalogId(e.target.value)}
            aria-label="Filter by catalog"
          >
            <option value="">All catalogs</option>
            {catalogs.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            className="select select-bordered select-sm w-20"
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            aria-label="Rows per page"
          >
            {PAGE_SIZES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
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
        ) : items.length === 0 && !hasFilters ? (
          <EmptyState
            title="No products yet"
            description="Sync a connected catalog from Settings to mirror its products here."
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
                          {flexRender(h.column.columnDef.header, h.getContext())}
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr>
                      <td
                        colSpan={columns.length}
                        className="px-3 py-12 text-center text-[0.8125rem] text-base-content/55"
                      >
                        No products match your filters.
                      </td>
                    </tr>
                  ) : (
                    table.getRowModel().rows.map((row) => (
                      <tr
                        key={row.id}
                        className="border-b border-base-300 transition last:border-b-0 hover:bg-base-300/40"
                      >
                        {row.getVisibleCells().map((cell) => (
                          <td key={cell.id} className="px-3 py-3 align-middle">
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {total > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-base-300 px-3 py-2.5">
                <span className="font-mono-op text-[0.625rem] tracking-[0.04em] tabular-nums text-base-content/50">
                  {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}
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
                    className="btn btn-sm join-item font-mono-op text-[0.625rem] tabular-nums no-animation"
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
        ))}
    </div>
  );
}
