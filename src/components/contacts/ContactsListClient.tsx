"use client";

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Eye, Search, Upload, Download, RefreshCw, UserPlus, Tag, Trash2, Copy, MessageSquare, Columns3, Check, Minus, LayoutGrid, Settings2 } from "lucide-react";
import { TagsPanelContent } from "./TagsPanelContent";
import { SegmentsPanelContent } from "./SegmentsPanelContent";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type VisibilityState,
} from "@tanstack/react-table";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useMediaQuery, LG_MEDIA_QUERY } from "@/hooks/useMediaQuery";
import { contactsApi, type ContactsListSort, tagsApi, segmentsApi, customFieldsApi } from "@/lib/api";
import { getApiError, getApiErrorStatus, getApiErrorData } from "@/lib/api-error";
import { useRightPanel } from "@/components/right-panel/useRightPanel";
import { roleHasWorkspacePermission } from "@/lib/workspace-role-permissions";
import {
  isContactBulkUpdated,
  isContactUpdated,
  parseWorkspaceSseEvent,
} from "@/lib/sseEvents";
import type { Contact, CustomFieldDef } from "@/lib/types";
import { formatRelativeTime } from "@/lib/format";
import { ContactAvatar } from "@/components/ui/ContactAvatar";
import { InfoTip } from "@/components/ui/InfoTip";
import { KpiCard } from "@/components/ui/KpiCard";
import { ContactDetailPanelContent } from "./ContactDetailDrawer";
import { ContactFormModal } from "./ContactFormModal";
import { DuplicatesModal } from "./DuplicatesModal";
import { ImportModal } from "./ImportModal";

const CONTACTS_LIST_QUERY_KEY = (
  segmentId: string | null,
  search: string,
  sortKey: SortKey,
  sortDir: SortDir,
  tagIds: string[] = [],
) => ["contacts", "list", segmentId ?? "all", search, sortKey, sortDir, tagIds.join(",") || "no-tags"] as const;
const LIST_PAGE_SIZE = 50;

const SERVER_SORT_KEYS: SortKey[] = [
  "name",
  "phone",
  "email",
  "lastMessageAt",
  "createdAt",
  "updatedAt",
];
function isServerSort(sortKey: SortKey): boolean {
  return SERVER_SORT_KEYS.includes(sortKey);
}

type SortKey =
  | "name"
  | "phone"
  | "email"
  | "isBlocked"
  | "isOptedOut"
  | "lastMessageAt"
  | "createdAt"
  | "updatedAt";
type SortDir = "asc" | "desc";

type ContactRow =
  | Contact
  | {
      id: string;
      phone: string;
      name?: string;
      email?: string;
      avatarUrl?: string | null;
    };

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

function formatFieldValue(value: string | undefined, def: CustomFieldDef) {
  if (!value) return "—";
  switch (def.type) {
    case "BOOLEAN":
      return value === "true" ? <Check className="h-3.5 w-3.5 text-success" /> : <Minus className="h-3.5 w-3.5 text-base-content/30" />;
    case "DATE":
      try {
        return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value));
      } catch {
        return value;
      }
    case "URL":
      return (
        <span className="truncate max-w-[120px] inline-block align-bottom text-primary/80" title={value}>
          {value.replace(/^https?:\/\//, "")}
        </span>
      );
    default:
      return value;
  }
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
  meRole,
}: {
  workspaceId: string;
  initialContacts: Contact[];
  initialNextCursor?: string;
  initialTotalCount?: number;
  selectedSegmentId?: string | null;
  meRole: string;
}) {
  const { setContent: setRightPanelContent, clearContent: clearRightPanelContent } =
    useRightPanel();
  const isLgUp = useMediaQuery(LG_MEDIA_QUERY);
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
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
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
  const [conflictContact, setConflictContact] = useState<{
    id: string;
    phone: string;
    name?: string | null;
    email?: string | null;
  } | null>(null);
  const [bulkSseNotice, setBulkSseNotice] = useState<{
    imported: number;
    failed: number;
  } | null>(null);
  const [localSegmentId, setLocalSegmentId] = useState<string | null>(null);
  const [filterTagIds, setFilterTagIds] = useState<string[]>([]);
  const [visibleFieldIds, setVisibleFieldIds] = useState<Set<string>>(new Set());
  const [tagsDropdownOpen, setTagsDropdownOpen] = useState(false);
  const canCreateContacts = roleHasWorkspacePermission(meRole, "contacts.create");
  const canImportContacts = roleHasWorkspacePermission(meRole, "contacts.import");
  const canExportContacts = roleHasWorkspacePermission(meRole, "contacts.export");
  const canFindDuplicates = roleHasWorkspacePermission(meRole, "contacts.create");
  const canDeleteContacts = roleHasWorkspacePermission(meRole, "contacts.delete");

  const showManagePanel = useCallback(() => {
    setSelectedContactId(null);
    setSelectedContactRow(null);
    setRightPanelContent({
      source: "contacts-manage",
      title: "Manage",
      openAfter: true,
      tabs: [
        {
          key: "tags",
          label: "Tags",
          content: <TagsPanelContent canManage={canCreateContacts} />,
        },
        {
          key: "segments",
          label: "Segments",
          content: (
            <SegmentsPanelContent
              canManage={canCreateContacts}
              onSelectSegment={(id) => {
                setLocalSegmentId(id);
              }}
            />
          ),
        },
      ],
      defaultTab: "tags",
    });
  }, [canCreateContacts, setRightPanelContent]);

  const debouncedSearch = useDebouncedValue(searchInput, 300);
  const segmentId = localSegmentId ?? selectedSegmentId ?? null;
  const searchParam = debouncedSearch.trim() || "";

  const useServerSortForList = isServerSort(sortKey);
  const listSort = useServerSortForList ? sortKey : "name";
  const listOrder = useServerSortForList ? sortDir : "asc";

  const infiniteQuery = useInfiniteQuery({
    queryKey: CONTACTS_LIST_QUERY_KEY(segmentId, searchParam, sortKey, sortDir, filterTagIds),
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
        tagIds: filterTagIds.length ? filterTagIds.join(",") : undefined,
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

  const { data: allSegments = [] } = useQuery({
    queryKey: ["segments"],
    queryFn: () => segmentsApi.list(),
  });

  const { data: customFieldDefs = [] } = useQuery({
    queryKey: ["custom-field-definitions"],
    queryFn: () => customFieldsApi.list(),
  });

  const visibleDefs = useMemo(
    () => customFieldDefs.filter((d) => visibleFieldIds.has(d.id)),
    [customFieldDefs, visibleFieldIds]
  );

  const invalidateContacts = () =>
    queryClient.invalidateQueries({ queryKey: ["contacts", "list"] });
  const invalidateSegmentPreview = () => invalidateContacts();

  useEffect(() => {
    setDisplayPageIndex(0);
  }, [segmentId]);

  useEffect(() => {
    setDisplayPageIndex(0);
  }, [debouncedSearch, sortKey, sortDir, filterTagIds]);

  // Auto-select first 2 custom field columns when definitions load
  const fieldDefsInitRef = useRef(false);
  useEffect(() => {
    if (fieldDefsInitRef.current || customFieldDefs.length === 0) return;
    fieldDefsInitRef.current = true;
    setVisibleFieldIds(new Set(customFieldDefs.slice(0, 2).map((d) => d.id)));
  }, [customFieldDefs]);

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

  useEffect(() => {
    if (!selectedContactId || !selectedContactRow) {
      clearRightPanelContent("contacts-detail");
      return;
    }
    setRightPanelContent({
      source: "contacts-detail",
      title: "Contact",
      openAfter: true,
      content: (
        <ContactDetailPanelContent
          contactId={selectedContactId}
          initialContact={selectedContactRow as Contact}
          canEdit={canCreateContacts}
          canDelete={canDeleteContacts}
          onEdit={(contact) => {
            setEditing(contact);
            setSelectedContactId(null);
            setSelectedContactRow(null);
          }}
          onDeleted={() => {
            setSelectedContactId(null);
            setSelectedContactRow(null);
          }}
        />
      ),
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: canCreateContacts/canDeleteContacts excluded to avoid re-rendering detail panel on permission load
  }, [
    clearRightPanelContent,
    selectedContactId,
    selectedContactRow,
    setRightPanelContent,
    isLgUp,
  ]);

  useEffect(() => {
    return () => {
      clearRightPanelContent("contacts-detail");
      clearRightPanelContent("contacts-manage");
    };
  }, [clearRightPanelContent]);

  const createMutation = useMutation({
    mutationFn: (payload: Parameters<typeof contactsApi.create>[0]) =>
      contactsApi.create(payload),
    onSuccess: () => {
      invalidateContacts();
      invalidateSegmentPreview();
      setCreating(false);
      setError(null);
      setConflictContact(null);
    },
    onError: (err) => {
      const status = getApiErrorStatus(err);
      const data = getApiErrorData(err) as {
        existingContact?: { id: string; phone: string; name?: string | null; email?: string | null };
      } | undefined;
      if (status === 409 && data?.existingContact) {
        setConflictContact(data.existingContact);
        setError(null);
      } else {
        setConflictContact(null);
        setError(getApiError(err));
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: {
        name?: string;
        designation?: string;
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

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(ids.map((id) => contactsApi.delete(id)));
    },
    onSuccess: (_, ids) => {
      invalidateContacts();
      invalidateSegmentPreview();
      setSelectedContactIds((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
      setBulkDeleteOpen(false);
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

  // Tag filtering is now server-side (tagIds param in API call).
  // No client-side filtering needed.

  const sorted = useMemo(() => {
    if (useServerSortForList) return allLoadedContacts;
    return sortContacts(allLoadedContacts, sortKey, sortDir);
  }, [allLoadedContacts, sortDir, sortKey, useServerSortForList]);

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

  const contactStats = useMemo(() => {
    const now = Date.now();
    const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
    const activeLastWeek = allLoadedContacts.filter((contact) => {
      if (!contact.lastMessageAt) return false;
      const ts = new Date(contact.lastMessageAt).getTime();
      return Number.isFinite(ts) && now - ts <= oneWeekMs;
    }).length;
    const recentlyAdded = allLoadedContacts.filter((contact) => {
      const ts = new Date(contact.createdAt).getTime();
      return Number.isFinite(ts) && now - ts <= oneWeekMs;
    }).length;
    const healthBase = Math.max(1, allLoadedContacts.length);
    const completeProfiles = allLoadedContacts.filter(
      (contact) => !!contact.name?.trim() && (!!contact.email?.trim() || !!contact.phone?.trim())
    ).length;
    const healthPct = Math.round((completeProfiles / healthBase) * 100);
    return {
      total: totalCount ?? allLoadedContacts.length,
      activeLastWeek,
      recentlyAdded,
      healthPct,
    };
  }, [allLoadedContacts, totalCount]);

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
    designation?: string;
    email?: string;
    emailLabel?: string;
  }) => {
    const phone = payload.phone?.trim();
    if (!phone) return;
    createMutation.mutate({
      phone,
      phoneLabel: payload.phoneLabel,
      name: payload.name,
      designation: payload.designation,
      email: payload.email,
      emailLabel: payload.emailLabel,
    });
  };

  const handleUpdate = (
    id: string,
    payload: {
      name?: string;
      designation?: string;
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

  const pending =
    createMutation.isPending ||
    updateMutation.isPending ||
    consentMutation.isPending ||
    bulkDeleteMutation.isPending ||
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

  // ── TanStack Table ──
  // Column visibility — persisted to localStorage (swap to API when /user/preferences is built)
  const COL_VIS_KEY = "contacts-column-visibility";
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => {
    try {
      const stored = localStorage.getItem(COL_VIS_KEY);
      if (stored) return JSON.parse(stored) as VisibilityState;
    } catch { /* ignore */ }
    return {};
  });
  const handleColumnVisibilityChange = useCallback((updater: VisibilityState | ((prev: VisibilityState) => VisibilityState)) => {
    setColumnVisibility((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      try { localStorage.setItem(COL_VIS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);
  const [colDropdownOpen, setColDropdownOpen] = useState(false);
  const colDropdownRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!colDropdownOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!colDropdownRef.current?.contains(e.target as Node)) setColDropdownOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [colDropdownOpen]);

  const [segDropdownOpen, setSegDropdownOpen] = useState(false);
  const segDropdownRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!segDropdownOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!segDropdownRef.current?.contains(e.target as Node)) setSegDropdownOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [segDropdownOpen]);

  type ContactRow = (typeof displayed)[number];
  const tableColumns: ColumnDef<ContactRow>[] = useMemo(() => {
    const cols: ColumnDef<ContactRow>[] = [
      {
        id: "select",
        header: () => (
          <input
            ref={headerCheckboxRef}
            type="checkbox"
            className="checkbox checkbox-sm"
            checked={displayed.length > 0 && selectedOnPageCount === displayed.length}
            onChange={selectAllOnPage}
            onClick={(e) => e.stopPropagation()}
            aria-label="Select all on page"
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            className="checkbox checkbox-sm"
            checked={selectedContactIds.has(row.original.id)}
            onChange={() => toggleContactSelection(row.original.id)}
            onClick={(e) => e.stopPropagation()}
            aria-label={`Select ${("name" in row.original ? row.original.name : "") || "contact"}`}
          />
        ),
        enableHiding: false,
        size: 40,
      },
      {
        accessorKey: "name",
        header: "Summary",
        cell: ({ row }) => {
          const c = row.original;
          const cName = "name" in c ? (c.name || "Unnamed") : "Unnamed";
          const cDesignation = "designation" in c ? ((c as { designation?: string }).designation || "") : "";
          return (
            <div className="flex items-center gap-2.5">
              <ContactAvatar name={c.name} phone={c.phone} avatarUrl={c.avatarUrl} size="sm" />
              <div>
                <div className="flex items-center gap-1.5">
                  <p className="text-[13px] font-semibold text-base-content">{cName}</p>
                  {"isBlocked" in c && c.isBlocked && <span className="op-tag op-tag-danger">Blocked</span>}
                  {"isOptedOut" in c && c.isOptedOut && <span className="op-tag op-tag-warn">Opted out</span>}
                </div>
                {cDesignation && <p className="text-[11px] text-base-content/55">{cDesignation}</p>}
              </div>
            </div>
          );
        },
        enableSorting: true,
      },
      {
        accessorKey: "email",
        header: "Email",
        cell: ({ row }) => {
          const c = row.original;
          return "email" in c ? (
            <span className="text-[13px] text-base-content/80">
              {c.email || "—"}
              {"emailLabel" in c && c.emailLabel && <span className="ml-1 text-[11px] text-base-content/50">({c.emailLabel})</span>}
            </span>
          ) : <span className="text-base-content/40">—</span>;
        },
        enableSorting: true,
      },
      {
        accessorKey: "phone",
        header: "Phone",
        cell: ({ row }) => {
          const c = row.original;
          return (
            <span className="font-mono-op text-[12px] tabular-nums text-base-content/85">
              {c.phone}
              {"phoneLabel" in c && c.phoneLabel && <span className="ml-1 font-sans text-[11px] text-base-content/50">({c.phoneLabel})</span>}
            </span>
          );
        },
        enableSorting: true,
      },
      {
        id: "tags",
        header: "Tags",
        cell: ({ row }) => {
          const tags = "tags" in row.original ? row.original.tags ?? [] : [];
          return tags.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {tags.slice(0, 3).map((tag) => <span key={tag.id} className="op-tag">{tag.name}</span>)}
              {tags.length > 3 && <span className="op-tag">+{tags.length - 3}</span>}
            </div>
          ) : <span className="text-base-content/40">—</span>;
        },
      },
      {
        accessorKey: "lastMessageAt",
        header: "Last active",
        cell: ({ row }) => {
          const c = row.original;
          return (
            <span className="font-mono-op text-[11px] tabular-nums text-base-content/55">
              {"lastMessageAt" in c && c.lastMessageAt ? formatRelativeTime(c.lastMessageAt) : "—"}
            </span>
          );
        },
        enableSorting: true,
      },
    ];

    // Dynamic custom field columns
    for (const def of visibleDefs) {
      cols.push({
        id: `cf_${def.id}`,
        header: def.label,
        cell: ({ row }) => {
          const c = row.original;
          return (
            <span className="text-[13px] text-base-content/80">
              {formatFieldValue(
                "customFields" in c ? (c as Contact).customFields?.[def.name] : undefined,
                def
              )}
            </span>
          );
        },
      });
    }

    // Actions column
    cols.push({
      id: "actions",
      header: "",
      enableHiding: false,
      cell: ({ row }) => {
        const c = row.original;
        return (
          <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
            <div className="tooltip tooltip-left" data-tip="Send message">
              <Link
                href={`/inbox?contactId=${c.id}&focus=reply`}
                className="btn btn-ghost btn-xs btn-square"
                onClick={(e) => e.stopPropagation()}
              >
                <MessageSquare className="h-3.5 w-3.5" />
              </Link>
            </div>
            <div className="tooltip tooltip-left" data-tip="Quick view">
              <button
                type="button"
                className="btn btn-ghost btn-xs btn-square"
                onClick={() => openDrawer(c)}
                aria-label="Quick view"
              >
                <Eye className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        );
      },
    });

    return cols;
  // eslint-disable-next-line react-hooks/exhaustive-deps -- callbacks are intentionally inline; column defs rebuild on data change which is correct
  }, [displayed, selectedOnPageCount, selectedContactIds, visibleDefs]);

  const contactsTable = useReactTable({
    data: displayed,
    columns: tableColumns,
    getCoreRowModel: getCoreRowModel(),
    state: { columnVisibility },
    onColumnVisibilityChange: handleColumnVisibilityChange,
    manualSorting: true,
    manualPagination: true,
    getRowId: (row) => row.id,
  });

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
    <div className="grid grid-cols-1 gap-4">
      <div className="space-y-4 min-w-0">
      {bulkSseNotice ? (
        <div role="status" className="rounded-box border border-success/30 border-l-2 border-l-success bg-base-200 px-3 py-2 text-sm">
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
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Total contacts" value={contactStats.total.toLocaleString()} />
        <KpiCard label="Active this week" value={contactStats.activeLastWeek.toLocaleString()} />
        <KpiCard label="New this week" value={`+${contactStats.recentlyAdded.toLocaleString()}`} />
        <KpiCard label="Profile health" value={`${contactStats.healthPct}%`} hint={<>Contacts with name + phone or email <InfoTip tip="Percentage of contacts with both a name and phone number or email filled in" /></>} />
      </div>
      <div className="rounded-box border border-base-300 bg-base-200 px-4 py-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-base-content/40" />
          <input
            type="text"
            placeholder="Search contacts…"
            className="input input-bordered input-sm w-full pl-8"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {canImportContacts ? (
            <div className="tooltip tooltip-bottom" data-tip="Import contacts">
              <button
                type="button"
                className="btn btn-ghost btn-sm btn-square"
                onClick={() => setImporting(true)}
              >
                <Upload className="h-4 w-4" />
              </button>
            </div>
          ) : null}
          {canExportContacts ? (
            <div className="tooltip tooltip-bottom" data-tip={selectedContactIds.size > 0 ? `Export ${selectedContactIds.size} selected` : "Export all"}>
              <button
                type="button"
                className="btn btn-ghost btn-sm btn-square"
                onClick={handleExport}
                disabled={exporting}
              >
                {exporting ? (
                  <span className="loading loading-spinner loading-xs" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
              </button>
            </div>
          ) : null}
          {canFindDuplicates ? (
            <div className="tooltip tooltip-bottom" data-tip="Find duplicate contacts">
              <button
                type="button"
                className="btn btn-ghost btn-sm btn-square"
                onClick={() => setDuplicatesOpen(true)}
              >
                <Copy className="h-4 w-4" />
              </button>
            </div>
          ) : null}
          <div className="tooltip tooltip-bottom" data-tip="Refresh list">
            <button
              type="button"
              className="btn btn-ghost btn-sm btn-square"
              onClick={() => invalidateContacts()}
              disabled={loadingList}
            >
              {loadingList ? (
                <span className="loading loading-spinner loading-xs" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </button>
          </div>
          {/* Manage tags & segments */}
          <div className="tooltip tooltip-bottom" data-tip="Manage tags & segments">
            <button
              type="button"
              className="btn btn-ghost btn-sm btn-square"
              onClick={showManagePanel}
            >
              <Settings2 className="h-4 w-4" />
            </button>
          </div>
          {/* Column visibility toggle */}
          <div className="relative" ref={colDropdownRef}>
            <div className="tooltip tooltip-bottom" data-tip="Toggle columns">
              <button
                type="button"
                className="btn btn-ghost btn-sm btn-square"
                onClick={() => setColDropdownOpen((v) => !v)}
              >
                <Columns3 className="h-4 w-4" />
              </button>
            </div>
            {colDropdownOpen && (
              <div className="absolute right-0 top-full z-20 mt-1 w-52 rounded-box border border-base-300 bg-base-200 p-2 shadow-lg">
                <div className="mb-1.5 flex items-center justify-between px-2">
                  <span className="op-label">Columns</span>
                  <span className="font-mono-op text-[9px] tracking-[0.08em] text-primary">saved</span>
                </div>
                {contactsTable.getAllLeafColumns()
                  .filter((col) => col.getCanHide())
                  .map((col) => (
                    <label key={col.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[12px] hover:bg-base-300/40">
                      <input
                        type="checkbox"
                        className="checkbox checkbox-xs"
                        checked={col.getIsVisible()}
                        onChange={col.getToggleVisibilityHandler()}
                      />
                      {typeof col.columnDef.header === "string" ? col.columnDef.header : col.id.replace("cf_", "")}
                    </label>
                  ))}
                <div className="mt-1.5 border-t border-base-300 pt-1.5">
                  <button
                    type="button"
                    className="w-full rounded-md px-2 py-1.5 text-left text-[12px] text-base-content/60 hover:bg-base-300/40 hover:text-base-content"
                    onClick={() => {
                      handleColumnVisibilityChange({});
                    }}
                  >
                    Reset to default
                  </button>
                </div>
              </div>
            )}
          </div>
          {selectedContactIds.size > 0 && (
            <>
              <div className="mx-1 h-5 w-px bg-base-300" />
              <div className="tooltip tooltip-bottom" data-tip={`Tag ${selectedContactIds.size} selected`}>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm gap-1"
                  onClick={() => setBulkTagOpen(true)}
                  disabled={bulkAssignTagMutation.isPending}
                >
                  <Tag className="h-3.5 w-3.5" />
                  <span className="font-mono-op text-[10px] tabular-nums">{selectedContactIds.size}</span>
                </button>
              </div>
              {canDeleteContacts ? (
                <div className="tooltip tooltip-bottom" data-tip={`Delete ${selectedContactIds.size} selected`}>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm gap-1 text-error/70 hover:text-error"
                    onClick={() => setBulkDeleteOpen(true)}
                    disabled={bulkDeleteMutation.isPending}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span className="font-mono-op text-[10px] tabular-nums">{selectedContactIds.size}</span>
                  </button>
                </div>
              ) : null}
            </>
          )}
          {canCreateContacts ? (
            <button
              type="button"
              className="btn btn-primary btn-sm gap-1"
              onClick={() => setCreating(true)}
            >
              <UserPlus className="h-3.5 w-3.5" /> Add contact
            </button>
          ) : null}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {/* Segment picker — dropdown like column toggle */}
          <div className="relative" ref={segDropdownRef}>
            <div className="tooltip tooltip-bottom" data-tip="Filter by segment">
              <button
                type="button"
                className={`btn btn-ghost btn-sm gap-1 ${segmentId ? "text-primary" : ""}`}
                onClick={() => setSegDropdownOpen((v) => !v)}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                {segmentId ? allSegments.find((s) => s.id === segmentId)?.name ?? "Segment" : "Segments"}
              </button>
            </div>
            {segDropdownOpen && (
              <div className="absolute left-0 top-full z-20 mt-1 w-52 rounded-box border border-base-300 bg-base-200 p-2 shadow-lg">
                <span className="op-label mb-1.5 block px-2">Segments</span>
                <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[12px] hover:bg-base-300/40">
                  <input
                    type="radio"
                    name="segment"
                    className="radio radio-xs radio-primary"
                    checked={!segmentId}
                    onChange={() => { setLocalSegmentId(null); setSegDropdownOpen(false); }}
                  />
                  All contacts
                </label>
                {allSegments.map((seg) => (
                  <label key={seg.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[12px] hover:bg-base-300/40">
                    <input
                      type="radio"
                      name="segment"
                      className="radio radio-xs radio-primary"
                      checked={segmentId === seg.id}
                      onChange={() => { setLocalSegmentId(seg.id); setSegDropdownOpen(false); }}
                    />
                    <span className="flex-1 truncate">{seg.name}</span>
                    {seg.contactCount != null ? (
                      <span className="font-mono-op text-[10px] tabular-nums text-base-content/40">{seg.contactCount}</span>
                    ) : null}
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Tags filter dropdown */}
          {allTags.length > 0 && (
            <div className="dropdown">
              <div className="tooltip tooltip-bottom" data-tip="Filter by tags">
                <button
                  type="button"
                  className={`btn btn-ghost btn-sm gap-1 ${filterTagIds.length > 0 ? "text-primary" : ""}`}
                  onClick={() => setTagsDropdownOpen((v) => !v)}
                >
                  <Tag className="h-3.5 w-3.5" />
                  Tags
                  {filterTagIds.length > 0 && (
                    <span className="font-mono-op text-[10px] tabular-nums">{filterTagIds.length}</span>
                  )}
                </button>
              </div>
              {tagsDropdownOpen && (
                <div className="dropdown-content z-20 mt-1 w-64 rounded-box border border-base-300 bg-base-100 p-2 shadow-sm">
                  <div className="flex items-center justify-between px-2 pb-1.5">
                    <p className="text-xs font-medium text-base-content/50">Filter by tags</p>
                    {filterTagIds.length > 0 && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs gap-1 text-base-content/50"
                        onClick={() => setFilterTagIds([])}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5 px-1">
                    {allTags.map((tag) => {
                      const active = filterTagIds.includes(tag.id);
                      return (
                        <button
                          key={tag.id}
                          type="button"
                          className={`op-tag cursor-pointer transition-colors ${active ? "border-primary bg-primary/10 text-primary" : ""}`}
                          style={!active && tag.color ? { borderColor: tag.color, color: tag.color } : undefined}
                          onClick={() =>
                            setFilterTagIds((prev) =>
                              prev.includes(tag.id)
                                ? prev.filter((id) => id !== tag.id)
                                : [...prev, tag.id]
                            )
                          }
                        >
                          {tag.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

        </div>

      </div>
      </div>

      {error && (
        <div role="alert" className="rounded-box border border-error/30 border-l-2 border-l-error bg-base-200 px-4 py-3">
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

      {conflictContact && (
        <div role="alert" className="rounded-box border border-warning/30 border-l-2 border-l-warning bg-base-200 px-4 py-3">
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
              d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span>
            A contact with this phone already exists
            {conflictContact.name ? `: ${conflictContact.name}` : ""}
            {" "}({conflictContact.phone})
          </span>
          <div className="flex gap-1">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setCreating(false);
                setConflictContact(null);
                setSelectedContactId(conflictContact.id);
                const found = allLoadedContacts.find(
                  (c) => c.id === conflictContact.id
                );
                if (found) setSelectedContactRow(found);
              }}
            >
              View contact
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setConflictContact(null)}
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {!loadingList && sorted.length === 0 && (
        <div className="rounded-box border border-base-300 bg-base-200 p-8 text-center">
          <p className="text-sm text-base-content/70">
            {searchParam || filterTagIds.length > 0
              ? "No contacts match the current search/filter combination."
              : segmentId
                ? "No contacts in this segment. Try another list or add contacts."
                : "No contacts yet. Add your first contact to get started."}
          </p>
          {canCreateContacts ? (
            <div className="mt-4 flex justify-center">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setCreating(true)}
              >
                Add your first contact
              </button>
            </div>
          ) : null}
        </div>
      )}

      {!loadingList && (totalCount > 0 || totalFiltered > 0) && <PaginationBar />}

      {loadingList && sorted.length === 0 && (
        <div className="overflow-x-auto card bg-base-100 border border-base-300">
          <table className="table table-sm">
            <thead>
              <tr>
                <th>Summary</th>
                <th>Email Address</th>
                <th>Phone Number</th>
                <th>Tags</th>
                <th>Last active</th>
                {visibleDefs.map((def) => (
                  <th key={def.id}>{def.label}</th>
                ))}
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
                  <td><div className="skeleton h-4 w-16" /></td>
                  {visibleDefs.map((def) => (
                    <td key={def.id}><div className="skeleton h-4 w-20" /></td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loadingList && sorted.length > 0 && (
        <div className="overflow-x-auto rounded-box border border-base-300 bg-base-200">
          <table className="w-full text-[12.5px]">
            <thead>
              {contactsTable.getHeaderGroups().map((hg) => (
                <tr key={hg.id} className="border-b border-base-300 bg-base-100">
                  {hg.headers.map((h) => {
                    const sortable = ["name", "email", "phone", "lastMessageAt"].includes(h.id);
                    const sortId = h.id === "name" ? "name" : h.id === "email" ? "email" : h.id === "phone" ? "phone" : h.id === "lastMessageAt" ? "lastMessageAt" : null;
                    return (
                      <th
                        key={h.id}
                        className={`${h.id === "select" ? "w-0 px-3 py-2.5" : "op-label px-3 py-2.5 text-left font-medium"} ${sortable ? "cursor-pointer select-none hover:text-base-content" : ""}`}
                        onClick={(e) => {
                          if (h.id === "select") { e.stopPropagation(); return; }
                          if (sortId) handleSort(sortId);
                        }}
                      >
                        {h.id === "select" ? (
                          flexRender(h.column.columnDef.header, h.getContext())
                        ) : (
                          <>
                            {flexRender(h.column.columnDef.header, h.getContext())}
                            {sortId && sortKey === sortId && (
                              <span className="ml-1">{sortDir === "asc" ? "↑" : "↓"}</span>
                            )}
                          </>
                        )}
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>
            <tbody>
              {contactsTable.getRowModel().rows.map((row) => {
                const isActiveRow = selectedContactId === row.original.id;
                return (
                  <tr
                    key={row.id}
                    className={`h-14 cursor-pointer border-b border-base-300/50 transition-colors ${
                      isActiveRow
                        ? "bg-base-200 [&>td:first-child]:border-l-2 [&>td:first-child]:border-l-primary"
                        : "hover:bg-base-200/55 [&>td:first-child]:border-l-2 [&>td:first-child]:border-l-transparent"
                    }`}
                    onClick={() => openDrawer(row.original)}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className={`px-3 align-middle ${cell.column.id === "select" ? "p-2" : ""}`}
                        onClick={cell.column.id === "select" ? (e) => e.stopPropagation() : undefined}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
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
      </div>

      {creating && (
        <ContactFormModal
          title="Create contact"
          onClose={() => setCreating(false)}
          onSave={handleCreate}
          onViewExisting={(contactId) => {
            setCreating(false);
            setConflictContact(null);
            setSelectedContactId(contactId);
            const found = allLoadedContacts.find((c) => c.id === contactId);
            if (found) setSelectedContactRow(found);
          }}
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
                    href="/people/tags"
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

      {canDeleteContacts && bulkDeleteOpen && (
        <dialog open className="modal modal-middle">
          <div className="modal-box">
            <h3 className="text-lg font-semibold">Delete selected contacts</h3>
            <p className="mt-2 text-sm text-base-content/70">
              Soft-delete {selectedContactIds.size} contact
              {selectedContactIds.size !== 1 ? "s" : ""}? They will be marked as
              deleted and will no longer appear in this list.
            </p>
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
                  bulkDeleteMutation.mutate(Array.from(selectedContactIds))
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
