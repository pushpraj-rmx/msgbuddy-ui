"use client";

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { EyeIcon } from "@heroicons/react/24/outline";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { contactsApi, type ContactsListSort, tagsApi } from "@/lib/api";
import {
  isContactBulkUpdated,
  isContactUpdated,
  parseWorkspaceSseEvent,
} from "@/lib/sseEvents";
import type { Contact } from "@/lib/types";
import { ContactDetailDrawer } from "./ContactDetailDrawer";
import { ContactFormModal } from "./ContactFormModal";
import { DuplicatesModal } from "./DuplicatesModal";
import { ImportModal } from "./ImportModal";

function getInitials(name?: string, phone?: string): string {
  if (name?.trim()) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2)
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  }
  if (phone) {
    const digits = phone.replace(/\D/g, "").slice(-2);
    return digits ? digits.toUpperCase() : "?";
  }
  return "?";
}

const CONTACTS_LIST_QUERY_KEY = (
  segmentId: string | null,
  search: string,
  sortKey: SortKey,
  sortDir: SortDir
) => ["contacts", "list", segmentId ?? "all", search, sortKey, sortDir] as const;
const LIST_PAGE_SIZE = 50;

const SERVER_SORT_KEYS: SortKey[] = ["name", "phone", "email", "lastMessageAt"];
function isServerSort(sortKey: SortKey): boolean {
  return SERVER_SORT_KEYS.includes(sortKey);
}

type SortKey =
  | "name"
  | "phone"
  | "email"
  | "isBlocked"
  | "isOptedOut"
  | "lastMessageAt";
type SortDir = "asc" | "desc";

type ContactRow = Contact | { id: string; phone: string; name?: string; email?: string };

function sortContacts(
  contacts: ContactRow[],
  sortKey: SortKey,
  sortDir: SortDir
): ContactRow[] {
  return [...contacts].sort((a, b) => {
    const aAny = a as Contact & Record<string, unknown>;
    const bAny = b as Contact & Record<string, unknown>;
    let av: string | boolean | undefined =
      (aAny?.[sortKey] as string | boolean | undefined) ?? "";
    let bv: string | boolean | undefined =
      (bAny?.[sortKey] as string | boolean | undefined) ?? "";
    if (sortKey === "isBlocked" || sortKey === "isOptedOut") {
      av = !!av;
      bv = !!bv;
    }
    const aStr = String(av).toLowerCase();
    const bStr = String(bv).toLowerCase();
    const cmp = aStr.localeCompare(bStr, undefined, { numeric: true });
    return sortDir === "asc" ? cmp : -cmp;
  });
}

function getApiError(err: unknown): string {
  return (err as { response?: { data?: { message?: string } } })?.response
    ?.data?.message ?? "Something went wrong.";
}

function toCsvCell(value: string | number | boolean | null | undefined): string {
  if (value == null) return "";
  const text = String(value);
  if (text.includes(",") || text.includes('"') || text.includes("\n")) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function ContactsListClient({
  workspaceId,
  initialContacts,
  initialNextCursor,
  initialTotalCount,
  selectedSegmentId,
}: {
  workspaceId: string;
  initialContacts: Contact[];
  initialNextCursor?: string;
  initialTotalCount?: number;
  selectedSegmentId?: string | null;
}) {
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState("");
  const [displayPageIndex, setDisplayPageIndex] = useState(0);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [duplicatesOpen, setDuplicatesOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Contact | null>(null);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(
    null
  );
  const [selectedContactRow, setSelectedContactRow] =
    useState<ContactRow | null>(null);
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(
    () => new Set()
  );
  const [bulkTagOpen, setBulkTagOpen] = useState(false);
  const [bulkTagSelectedId, setBulkTagSelectedId] = useState<string | null>(
    null
  );
  const [bulkSseNotice, setBulkSseNotice] = useState<{
    imported: number;
    failed: number;
  } | null>(null);

  const debouncedSearch = useDebouncedValue(searchInput, 300);
  const segmentId = selectedSegmentId ?? null;
  const searchParam = debouncedSearch.trim() || "";

  const useServerSortForList = isServerSort(sortKey);
  const listSort = useServerSortForList ? sortKey : "name";
  const listOrder = useServerSortForList ? sortDir : "asc";

  const infiniteQuery = useInfiniteQuery({
    queryKey: CONTACTS_LIST_QUERY_KEY(segmentId, searchParam, sortKey, sortDir),
    queryFn: async ({ pageParam }) =>
      contactsApi.list({
        limit: LIST_PAGE_SIZE,
        cursor: pageParam,
        segmentId: segmentId ?? undefined,
        search: searchParam || undefined,
        sort: listSort as ContactsListSort,
        order: listOrder,
        includeTotal: true,
        include: "tags,customFields",
      }),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    initialPageParam: undefined as string | undefined,
    initialData:
      segmentId === null &&
      !searchParam &&
      sortKey === "name" &&
      sortDir === "asc" &&
      initialContacts.length >= 0
        ? {
            pages: [
              {
                contacts: initialContacts,
                nextCursor: initialNextCursor ?? null,
                totalCount: initialTotalCount,
              },
            ],
            pageParams: [undefined],
          }
        : undefined,
  });

  const { data, isFetching: loadingList, fetchNextPage, hasNextPage } =
    infiniteQuery;
  const pages = useMemo(() => data?.pages ?? [], [data?.pages]);
  const allLoadedContacts = useMemo(
    () => pages.flatMap((p) => p.contacts),
    [pages]
  );
  const totalFromApi = pages[0]?.totalCount;
  const totalLoaded = allLoadedContacts.length;
  const totalCount = totalFromApi ?? totalLoaded;

  const { data: allTags = [] } = useQuery({
    queryKey: ["tags"],
    queryFn: () => tagsApi.list(),
  });

  const invalidateContacts = () =>
    queryClient.invalidateQueries({ queryKey: ["contacts", "list"] });
  const invalidateSegmentPreview = () => invalidateContacts();

  useEffect(() => {
    setDisplayPageIndex(0);
  }, [segmentId]);

  useEffect(() => {
    setDisplayPageIndex(0);
  }, [debouncedSearch, sortKey, sortDir]);

  useEffect(() => {
    if (!workspaceId?.trim()) return;
    const source = new EventSource(`/api/sse/workspace/${workspaceId}`);
    source.onmessage = (event) => {
      const ev = parseWorkspaceSseEvent(event.data);
      if (!ev) return;
      if (isContactBulkUpdated(ev.type)) {
        void queryClient.invalidateQueries({ queryKey: ["contacts", "list"] });
        const imported = Number(ev.data.importedCount ?? 0);
        const failed = Number(ev.data.failedCount ?? 0);
        setBulkSseNotice({ imported, failed });
        return;
      }
      if (isContactUpdated(ev.type)) {
        const id =
          typeof ev.data.contactId === "string" ? ev.data.contactId : undefined;
        void queryClient.invalidateQueries({ queryKey: ["contacts", "list"] });
        if (id) {
          void queryClient.invalidateQueries({ queryKey: ["contacts", id] });
        }
      }
    };
    source.onerror = () => {
      source.close();
    };
    return () => source.close();
  }, [workspaceId, queryClient]);

  useEffect(() => {
    if (!bulkSseNotice) return;
    const t = window.setTimeout(() => setBulkSseNotice(null), 8000);
    return () => window.clearTimeout(t);
  }, [bulkSseNotice]);

  const createMutation = useMutation({
    mutationFn: (payload: {
      phone: string;
      phoneLabel?: string;
      name?: string;
      email?: string;
      emailLabel?: string;
    }) => contactsApi.create(payload),
    onSuccess: () => {
      invalidateContacts();
      invalidateSegmentPreview();
      setCreating(false);
      setError(null);
    },
    onError: (err) => setError(getApiError(err)),
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: {
        name?: string;
        email?: string;
        phoneLabel?: string;
        emailLabel?: string;
        isBlocked?: boolean;
        isOptedOut?: boolean;
      };
    }) => contactsApi.update(id, payload),
    onSuccess: () => {
      invalidateContacts();
      invalidateSegmentPreview();
      setEditing(null);
      setError(null);
    },
    onError: (err) => setError(getApiError(err)),
  });

  const consentMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: { isBlocked: boolean; isOptedOut: boolean };
    }) => contactsApi.updateConsent(id, data),
    onSuccess: () => {
      invalidateContacts();
      invalidateSegmentPreview();
      setError(null);
    },
    onError: (err) => setError(getApiError(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => contactsApi.delete(id),
    onSuccess: () => {
      invalidateContacts();
      invalidateSegmentPreview();
      setDeleteTarget(null);
      setError(null);
    },
    onError: (err) => setError(getApiError(err)),
  });

  const bulkAssignTagMutation = useMutation({
    mutationFn: async ({
      contactIds,
      tagId,
    }: {
      contactIds: string[];
      tagId: string;
    }) => {
      await Promise.all(
        contactIds.map((id) => contactsApi.assignTags(id, [tagId]))
      );
    },
    onSuccess: (_, { contactIds }) => {
      invalidateContacts();
      invalidateSegmentPreview();
      setSelectedContactIds((prev) => {
        const next = new Set(prev);
        contactIds.forEach((id) => next.delete(id));
        return next;
      });
      setBulkTagOpen(false);
      setBulkTagSelectedId(null);
      setError(null);
    },
    onError: (err) => setError(getApiError(err)),
  });

  const sorted = useMemo(() => {
    if (useServerSortForList) return allLoadedContacts;
    return sortContacts(allLoadedContacts, sortKey, sortDir);
  }, [allLoadedContacts, sortKey, sortDir, useServerSortForList]);

  const totalFiltered = sorted.length;
  const displayPageSize = LIST_PAGE_SIZE;
  const totalPagesFiltered = Math.max(
    1,
    Math.ceil(totalFiltered / displayPageSize)
  );
  const displayed = useMemo(
    () =>
      sorted.slice(
        displayPageIndex * displayPageSize,
        (displayPageIndex + 1) * displayPageSize
      ),
    [sorted, displayPageIndex, displayPageSize]
  );

  const hasSearch = searchParam.length > 0;
  const start =
    totalFiltered > 0 ? displayPageIndex * displayPageSize + 1 : 0;
  const end = displayPageIndex * displayPageSize + displayed.length;
  const totalForLabel = hasSearch ? totalFiltered : (totalCount ?? 0);
  const totalPages =
    hasSearch && totalFiltered > 0
      ? totalPagesFiltered
      : totalCount != null && totalCount > 0
        ? Math.ceil(totalCount / LIST_PAGE_SIZE)
        : null;
  const showingText =
    totalForLabel > 0
      ? `Showing ${start}-${end} of ${totalForLabel}`
      : "Showing 0 of 0";
  const pageLabel =
    totalPages != null && totalPages > 0
      ? `Page ${displayPageIndex + 1} of ${totalPages}`
      : totalPagesFiltered <= 1 && !hasNextPage
        ? "Page 1"
        : hasNextPage
          ? `Page ${displayPageIndex + 1} of ${displayPageIndex + 2}+`
          : `Page ${displayPageIndex + 1} of ${totalPagesFiltered}`;

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const handleNext = () => {
    if (displayPageIndex + 1 < totalPagesFiltered) {
      setDisplayPageIndex((i) => i + 1);
    } else if (hasNextPage) {
      fetchNextPage().then(() => setDisplayPageIndex((i) => i + 1));
    }
  };

  const handlePrev = () => {
    if (displayPageIndex > 0) setDisplayPageIndex((i) => i - 1);
  };

  const handleCreate = (payload: {
    phone?: string;
    phoneLabel?: string;
    name?: string;
    email?: string;
    emailLabel?: string;
  }) => {
    const phone = payload.phone?.trim();
    if (!phone) return;
    createMutation.mutate({
      phone,
      phoneLabel: payload.phoneLabel,
      name: payload.name,
      email: payload.email,
      emailLabel: payload.emailLabel,
    });
  };

  const handleUpdate = (
    id: string,
    payload: {
      name?: string;
      email?: string;
      phoneLabel?: string;
      emailLabel?: string;
      isBlocked?: boolean;
      isOptedOut?: boolean;
    }
  ) => {
    updateMutation.mutate({ id, payload });
  };

  const handleExport = async () => {
    setExporting(true);
    setError(null);
    try {
      if (selectedContactIds.size > 0) {
        const selected = allLoadedContacts.filter((contact) =>
          selectedContactIds.has(contact.id)
        );
        const header = [
          "id",
          "name",
          "email",
          "emailLabel",
          "phone",
          "phoneLabel",
          "isBlocked",
          "isOptedOut",
          "tags",
        ];
        const rows = selected.map((contact) => [
          toCsvCell(contact.id),
          toCsvCell(contact.name ?? ""),
          toCsvCell(contact.email ?? ""),
          toCsvCell(contact.emailLabel ?? ""),
          toCsvCell(contact.phone ?? ""),
          toCsvCell(contact.phoneLabel ?? ""),
          toCsvCell(contact.isBlocked ?? false),
          toCsvCell(contact.isOptedOut ?? false),
          toCsvCell((contact.tags ?? []).map((tag) => tag.name).join("|")),
        ]);
        const csv = [header.join(","), ...rows.map((row) => row.join(","))].join(
          "\n"
        );
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "contacts-selected.csv";
        a.click();
        URL.revokeObjectURL(url);
      } else {
        await contactsApi.exportCsv();
      }
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteConfirm = (contact: Contact) => {
    deleteMutation.mutate(contact.id);
  };

  const pending =
    createMutation.isPending ||
    updateMutation.isPending ||
    consentMutation.isPending ||
    deleteMutation.isPending ||
    bulkAssignTagMutation.isPending;

  const openDrawer = (contact: ContactRow) => {
    setSelectedContactId(contact.id);
    setSelectedContactRow(contact);
  };

  const toggleContactSelection = (id: string) => {
    if (id == null || id === "") return;
    setSelectedContactIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllOnPage = () => {
    const displayedIds = displayed
      .map((c) => c.id)
      .filter((id): id is string => id != null && id !== "");
    if (displayedIds.length === 0) return;
    const allSelected = displayedIds.every((id) =>
      selectedContactIds.has(id)
    );
    setSelectedContactIds((prev) => {
      const next = new Set(prev);
      if (allSelected) displayedIds.forEach((id) => next.delete(id));
      else displayedIds.forEach((id) => next.add(id));
      return next;
    });
  };

  const headerCheckboxRef = useRef<HTMLInputElement>(null);
  const selectedOnPageCount = useMemo(
    () => displayed.filter((c) => selectedContactIds.has(c.id)).length,
    [displayed, selectedContactIds]
  );
  const headerIndeterminate =
    selectedOnPageCount > 0 && selectedOnPageCount < displayed.length;
  useEffect(() => {
    const el = headerCheckboxRef.current;
    if (!el) return;
    el.indeterminate = headerIndeterminate;
  }, [headerIndeterminate]);

  const PaginationBar = () =>
    !loadingList && (totalCount > 0 || totalFiltered > 0) ? (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-box border border-base-300 bg-base-200 px-3 py-2">
        <span className="text-sm text-base-content/70">
          {showingText}
          <span className="mx-2 text-base-content/40">·</span>
          {pageLabel}
        </span>
        <div className="join">
          <button
            type="button"
            className="btn btn-sm join-item"
            onClick={handlePrev}
            disabled={displayPageIndex <= 0}
          >
            Previous
          </button>
          <button
            type="button"
            className="btn btn-sm join-item"
            onClick={handleNext}
            disabled={
              displayPageIndex >= totalPagesFiltered - 1 && !hasNextPage
            }
          >
            Next
          </button>
        </div>
      </div>
    ) : null;

  return (
    <div className="space-y-4">
      {bulkSseNotice ? (
        <div role="status" className="alert alert-success alert-soft text-sm">
          <span>
            Contacts updated from import: {bulkSseNotice.imported} imported
            {bulkSseNotice.failed > 0
              ? `, ${bulkSseNotice.failed} failed`
              : ""}
            .
          </span>
          <button
            type="button"
            className="btn btn-ghost btn-xs"
            aria-label="Dismiss"
            onClick={() => setBulkSseNotice(null)}
          >
            ✕
          </button>
        </div>
      ) : null}
      <div className="rounded-xl border border-base-300/80 bg-base-200 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="Search contacts…"
            className="input input-bordered input-sm w-full rounded-xl transition-all duration-150 focus:border-primary/50"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-ghost btn-sm rounded-xl transition-all duration-150 active:scale-[0.99]"
            onClick={() => setImporting(true)}
          >
            Import
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm rounded-xl transition-all duration-150 active:scale-[0.99]"
            onClick={handleExport}
            disabled={exporting}
          >
            {exporting ? (
              <span className="loading loading-spinner loading-sm" />
            ) : (
              selectedContactIds.size > 0
                ? `Export selected (${selectedContactIds.size})`
                : "Export"
            )}
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm rounded-xl transition-all duration-150 active:scale-[0.99]"
            onClick={() => setDuplicatesOpen(true)}
          >
            Find duplicates
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm rounded-xl transition-all duration-150 active:scale-[0.99]"
            onClick={() => invalidateContacts()}
            disabled={loadingList}
          >
            {loadingList ? (
              <span className="loading loading-spinner loading-sm" />
            ) : (
              "Refresh"
            )}
          </button>
          {selectedContactIds.size > 0 && (
            <button
              type="button"
              className="btn btn-outline btn-sm rounded-xl transition-all duration-150 active:scale-[0.99]"
              onClick={() => setBulkTagOpen(true)}
              disabled={bulkAssignTagMutation.isPending}
            >
              Add tag to {selectedContactIds.size} selected
            </button>
          )}
          <Link href="/contacts/tags" className="btn btn-ghost btn-sm rounded-xl transition-all duration-150 active:scale-[0.99]">
            Manage tags
          </Link>
          <button
            type="button"
            className="btn btn-primary btn-sm rounded-xl transition-all duration-150 active:scale-[0.99]"
            onClick={() => setCreating(true)}
          >
            Add Person
          </button>
        </div>
      </div>
      </div>

      {error && (
        <div role="alert" className="alert alert-error alert-dash">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span>{error}</span>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setError(null)}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      {!loadingList && sorted.length === 0 && (
        <div className="rounded-box border border-base-300 bg-base-200 p-8 text-center">
          <p className="text-sm text-base-content/70">
            {selectedSegmentId
              ? "No contacts in this segment. Try another list or add contacts."
              : "No contacts yet. Add your first contact to get started."}
          </p>
          <div className="mt-4 flex justify-center">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setCreating(true)}
            >
              Add your first contact
            </button>
          </div>
        </div>
      )}

      {!loadingList && (totalCount > 0 || totalFiltered > 0) && <PaginationBar />}

      {loadingList && sorted.length === 0 && (
        <div className="overflow-x-auto rounded-xl border border-base-300 bg-base-100">
          <table className="table table-sm">
            <thead>
              <tr>
                <th>Summary</th>
                <th>Email Address</th>
                <th>Phone Number</th>
                <th>Location / Tags</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="skeleton h-10 w-10 shrink-0 rounded-full" />
                      <div className="flex flex-col gap-1">
                        <div className="skeleton h-4 w-24" />
                        <div className="skeleton h-3 w-32" />
                      </div>
                    </div>
                  </td>
                  <td><div className="skeleton h-4 w-28" /></td>
                  <td><div className="skeleton h-4 w-24" /></td>
                  <td><div className="skeleton h-6 w-20" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loadingList && sorted.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-base-300/80 bg-base-100">
          <table className="table table-sm table-zebra">
            <thead>
              <tr>
                <th className="w-0 p-2" onClick={(e) => e.stopPropagation()}>
                  <input
                    ref={headerCheckboxRef}
                    type="checkbox"
                    className="checkbox checkbox-sm"
                    checked={
                      displayed.length > 0 &&
                      selectedOnPageCount === displayed.length
                    }
                    onChange={selectAllOnPage}
                    onClick={(e) => e.stopPropagation()}
                    aria-label="Select all on page"
                  />
                </th>
                <th className="text-xs font-medium text-base-content/60">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-xs font-medium text-base-content/70 hover:text-base-content"
                    onClick={() => handleSort("name")}
                  >
                    Summary{" "}
                    {sortKey === "name"
                      ? sortDir === "asc"
                        ? "↑"
                        : "↓"
                      : ""}
                  </button>
                </th>
                <th className="text-xs font-medium text-base-content/60">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-xs font-medium text-base-content/70 hover:text-base-content"
                    onClick={() => handleSort("email")}
                  >
                    Email Address{" "}
                    {sortKey === "email"
                      ? sortDir === "asc"
                        ? "↑"
                        : "↓"
                      : ""}
                  </button>
                </th>
                <th className="text-xs font-medium text-base-content/60">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-xs font-medium text-base-content/70 hover:text-base-content"
                    onClick={() => handleSort("phone")}
                  >
                    Phone Number{" "}
                    {sortKey === "phone"
                      ? sortDir === "asc"
                        ? "↑"
                        : "↓"
                      : ""}
                  </button>
                </th>
                <th className="text-xs font-medium text-base-content/60">Location / Tags</th>
                <th className="w-0" />
              </tr>
            </thead>
            <tbody>
              {displayed.map((contact) => {
                const tags =
                  "tags" in contact ? contact.tags ?? [] : [];
                const name =
                  "name" in contact ? (contact.name || "Unnamed") : "Unnamed";
                const email =
                  "email" in contact ? (contact.email || "") : "";
                return (
                  <tr
                    key={contact.id}
                    className="cursor-pointer transition-colors duration-150 hover:bg-base-200/70"
                    onClick={() => openDrawer(contact)}
                  >
                    <td
                      className="p-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        className="checkbox checkbox-sm"
                        checked={selectedContactIds.has(contact.id)}
                        onChange={() => toggleContactSelection(contact.id)}
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`Select ${name}`}
                      />
                    </td>
                    <td className="align-middle">
                      <div className="flex items-center gap-3">
                        <div className="avatar placeholder">
                          <div className="bg-primary text-primary-content w-10 rounded-full">
                            <span className="text-sm font-medium">
                              {getInitials(name, contact.phone)}
                            </span>
                          </div>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-base-content">{name}</p>
                          {email && (
                            <p className="text-xs text-base-content/55">
                              {email}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="align-middle text-sm text-base-content/80">
                      {"email" in contact ? (
                        <>
                          {contact.email || "—"}
                          {"emailLabel" in contact &&
                            contact.emailLabel && (
                              <span className="ml-1 text-base-content/50 text-xs">
                                ({contact.emailLabel})
                              </span>
                            )}
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="align-middle text-sm text-base-content/85">
                      {contact.phone}
                      {"phoneLabel" in contact && contact.phoneLabel && (
                        <span className="ml-1 text-base-content/50 text-xs">
                          ({contact.phoneLabel})
                        </span>
                      )}
                    </td>
                    <td className="align-middle">
                      {tags.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {tags.slice(0, 3).map((tag) => (
                            <span
                              key={tag.id}
                              className="badge badge-ghost badge-sm"
                            >
                              {tag.name}
                            </span>
                          ))}
                          {tags.length > 3 && (
                            <span className="badge badge-ghost badge-sm">
                              +{tags.length - 3}
                            </span>
                          )}
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="p-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm btn-square"
                        onClick={() => openDrawer(contact)}
                        aria-label="Quick view"
                        title="Quick view"
                      >
                        <EyeIcon className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {pending && (
        <div className="flex items-center gap-2 text-sm text-base-content/60">
          <span className="loading loading-spinner loading-sm" />
          Updating…
        </div>
      )}

      {creating && (
        <ContactFormModal
          title="Create contact"
          onClose={() => setCreating(false)}
          onSave={handleCreate}
        />
      )}

      {editing && (
        <ContactFormModal
          title="Edit contact"
          contact={editing}
          onClose={() => setEditing(null)}
          onSave={(payload) => handleUpdate(editing.id, payload)}
        />
      )}

      {selectedContactId && (
        <ContactDetailDrawer
          contactId={selectedContactId}
          initialContact={selectedContactRow as Contact}
          onClose={() => {
            setSelectedContactId(null);
            setSelectedContactRow(null);
          }}
          onEdit={(contact) => {
            setEditing(contact);
            setSelectedContactId(null);
            setSelectedContactRow(null);
          }}
        />
      )}

      {importing && (
        <ImportModal
          onClose={() => setImporting(false)}
          onSuccess={() => {
            setImporting(false);
            invalidateContacts();
            invalidateSegmentPreview();
          }}
          onError={setError}
        />
      )}

      {duplicatesOpen && (
        <DuplicatesModal
          onClose={() => setDuplicatesOpen(false)}
          onMerged={() => {
            invalidateContacts();
            invalidateSegmentPreview();
          }}
        />
      )}

      {bulkTagOpen && (
        <dialog open className="modal modal-middle">
          <div className="modal-box max-w-sm rounded-box">
            <h3 className="text-lg font-semibold">
              Add tag to {selectedContactIds.size} contact
              {selectedContactIds.size !== 1 ? "s" : ""}
            </h3>
            <p className="mt-1 text-sm text-base-content/70">
              Choose a tag to assign to all selected contacts.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {allTags.length === 0 ? (
                <p className="text-sm text-base-content/60">
                  No tags yet.{" "}
                  <Link
                    href="/contacts/tags"
                    className="link link-primary"
                    onClick={() => setBulkTagOpen(false)}
                  >
                    Create tags
                  </Link>{" "}
                  first.
                </p>
              ) : (
                allTags.map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    className={`btn btn-sm ${
                      bulkTagSelectedId === tag.id ? "btn-primary" : "btn-ghost"
                    }`}
                    onClick={() =>
                      setBulkTagSelectedId((prev) =>
                        prev === tag.id ? null : tag.id
                      )
                    }
                  >
                    {tag.color && (
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: tag.color }}
                        aria-hidden
                      />
                    )}
                    {tag.name}
                  </button>
                ))
              )}
            </div>
            <div className="modal-action">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setBulkTagOpen(false);
                  setBulkTagSelectedId(null);
                }}
                disabled={bulkAssignTagMutation.isPending}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  if (!bulkTagSelectedId) return;
                  bulkAssignTagMutation.mutate({
                    contactIds: Array.from(selectedContactIds),
                    tagId: bulkTagSelectedId,
                  });
                }}
                disabled={
                  !bulkTagSelectedId ||
                  allTags.length === 0 ||
                  bulkAssignTagMutation.isPending
                }
              >
                {bulkAssignTagMutation.isPending ? (
                  <span className="loading loading-spinner loading-sm" />
                ) : (
                  "Add tag"
                )}
              </button>
            </div>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button
              type="button"
              onClick={() => {
                setBulkTagOpen(false);
                setBulkTagSelectedId(null);
              }}
              aria-label="Close"
            />
          </form>
        </dialog>
      )}

      {deleteTarget && (
        <dialog open className="modal modal-middle">
          <div className="modal-box">
            <h3 className="text-lg font-semibold">Delete contact</h3>
            <p className="mt-2 text-sm text-base-content/70">
              Delete {deleteTarget.name || deleteTarget.phone}? This will
              soft-delete the contact; they will no longer appear in the list.
            </p>
            <div className="modal-action">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setDeleteTarget(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-error"
                onClick={() => handleDeleteConfirm(deleteTarget)}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? (
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
              onClick={() => setDeleteTarget(null)}
              aria-label="Close"
            />
          </form>
        </dialog>
      )}
    </div>
  );
}
