"use client";

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Eye, Search, Upload, Download, UserPlus, Tag, Trash2, MessageSquare, Columns3, Check, Minus, LayoutGrid, Settings2, CalendarDays, GitBranch } from "lucide-react";
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
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useRightPanel } from "@/components/right-panel/useRightPanel";
import { roleHasWorkspacePermission } from "@/lib/workspace-role-permissions";
import {
  isContactBulkUpdated,
  isContactUpdated,
  parseWorkspaceSseEvent,
} from "@/lib/sseEvents";
import type { Contact, CustomFieldDef } from "@/lib/types";
import {
  CONTACT_LIFECYCLE_STAGES,
  type ContactLifecycleStage,
} from "@/lib/types";

const LIFECYCLE_STAGE_LABELS: Record<ContactLifecycleStage, string> = {
  LEAD: "Lead",
  ENGAGED: "Engaged",
  QUALIFIED: "Qualified",
  CUSTOMER: "Customer",
  DORMANT: "Dormant",
  LOST: "Lost",
};
import { formatRelativeTime } from "@/lib/format";
import { ContactAvatar } from "@/components/ui/ContactAvatar";
import { ContactDetailPanelContent } from "./ContactDetailDrawer";
import { ContactFormModal } from "./ContactFormModal";
import { ImportModal } from "./ImportModal";

type TagsMatch = "all" | "any";

const CONTACTS_LIST_QUERY_KEY = (
  segmentId: string | null,
  search: string,
  sortKey: SortKey,
  sortDir: SortDir,
  tagIds: string[] = [],
  tagsMatch: TagsMatch = "all",
  createdAfter: string | null = null,
  createdBefore: string | null = null,
  lifecycleStage: ContactLifecycleStage | null = null,
) => [
  "contacts",
  "list",
  segmentId ?? "all",
  search,
  sortKey,
  sortDir,
  tagIds.join(",") || "no-tags",
  tagsMatch,
  createdAfter ?? "any-after",
  createdBefore ?? "any-before",
  lifecycleStage ?? "any-stage",
] as const;
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
  const [exporting, setExporting] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [filterDeleteOpen, setFilterDeleteOpen] = useState(false);
  const [filterDeletePreview, setFilterDeletePreview] = useState<{
    count: number;
    sample: Array<{
      id: string;
      name: string | null;
      phone: string | null;
      email: string | null;
    }>;
  } | null>(null);
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
  const [tagsMatch, setTagsMatch] = useState<TagsMatch>("all");
  const [createdAfter, setCreatedAfter] = useState<string>("");
  const [createdBefore, setCreatedBefore] = useState<string>("");
  const [createdDropdownOpen, setCreatedDropdownOpen] = useState(false);
  const createdDropdownRef = useRef<HTMLDivElement>(null);
  const tagsDropdownRef = useRef<HTMLDivElement>(null);
  const [lifecycleStageFilter, setLifecycleStageFilter] =
    useState<ContactLifecycleStage | null>(null);
  const [lifecycleDropdownOpen, setLifecycleDropdownOpen] = useState(false);
  const lifecycleDropdownRef = useRef<HTMLDivElement>(null);
  const [visibleFieldIds, setVisibleFieldIds] = useState<Set<string>>(new Set());
  const [tagsDropdownOpen, setTagsDropdownOpen] = useState(false);
  const canCreateContacts = roleHasWorkspacePermission(meRole, "contacts.create");
  const canImportContacts = roleHasWorkspacePermission(meRole, "contacts.import");
  const canExportContacts = roleHasWorkspacePermission(meRole, "contacts.export");
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

  const createdAfterIso = createdAfter ? `${createdAfter}T00:00:00.000Z` : null;
  const createdBeforeIso = createdBefore ? `${createdBefore}T23:59:59.999Z` : null;

  const infiniteQuery = useInfiniteQuery({
    queryKey: CONTACTS_LIST_QUERY_KEY(
      segmentId,
      searchParam,
      sortKey,
      sortDir,
      filterTagIds,
      tagsMatch,
      createdAfterIso,
      createdBeforeIso,
      lifecycleStageFilter,
    ),
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
        tagsMatch: filterTagIds.length ? tagsMatch : undefined,
        createdAfter: createdAfterIso ?? undefined,
        createdBefore: createdBeforeIso ?? undefined,
        lifecycleStage: lifecycleStageFilter ?? undefined,
      }),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    initialPageParam: undefined as string | undefined,
    initialData:
      segmentId === null &&
      !searchParam &&
      sortKey === "name" &&
      sortDir === "asc" &&
      filterTagIds.length === 0 &&
      !createdAfterIso &&
      !createdBeforeIso &&
      !lifecycleStageFilter
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
  }, [
    debouncedSearch,
    sortKey,
    sortDir,
    filterTagIds,
    tagsMatch,
    createdAfter,
    createdBefore,
    lifecycleStageFilter,
  ]);

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

  /**
   * The exact filter payload the user is currently looking at — sent to both
   * preview-delete and bulk-delete so "what you see" matches "what gets deleted".
   * Keyed off the same memoised values that drive the list query.
   */
  const activeFilterPayload = useMemo(
    () => ({
      search: searchParam || undefined,
      tagIds: filterTagIds.length > 0 ? filterTagIds : undefined,
      tagsMatch: filterTagIds.length > 0 ? tagsMatch : undefined,
      createdAfter: createdAfterIso ?? undefined,
      createdBefore: createdBeforeIso ?? undefined,
      lifecycleStage: lifecycleStageFilter ?? undefined,
      segmentId: segmentId ?? undefined,
    }),
    [
      searchParam,
      filterTagIds,
      tagsMatch,
      createdAfterIso,
      createdBeforeIso,
      lifecycleStageFilter,
      segmentId,
    ],
  );

  const hasActiveFilters =
    !!searchParam ||
    filterTagIds.length > 0 ||
    !!createdAfterIso ||
    !!createdBeforeIso ||
    !!lifecycleStageFilter ||
    !!segmentId;

  const filterPreviewMutation = useMutation({
    mutationFn: () => contactsApi.previewBulkDelete(activeFilterPayload),
    onSuccess: (preview) => {
      setFilterDeletePreview(preview);
      setFilterDeleteOpen(true);
      setError(null);
    },
    onError: (err) => setError(getApiError(err)),
  });

  const filterBulkDeleteMutation = useMutation({
    mutationFn: () => {
      if (!filterDeletePreview) {
        throw new Error("Preview required before bulk delete.");
      }
      return contactsApi.bulkDelete({
        ...activeFilterPayload,
        confirmCount: filterDeletePreview.count,
      });
    },
    onSuccess: () => {
      invalidateContacts();
      invalidateSegmentPreview();
      setFilterDeleteOpen(false);
      setFilterDeletePreview(null);
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

  const start =
    totalFiltered > 0 ? displayPageIndex * displayPageSize + 1 : 0;
  const end = displayPageIndex * displayPageSize + displayed.length;
  // `totalCount` is the server total for the *active* query (search, tags,
  // segment, lifecycle all flow through includeTotal), so use it for both the
  // "showing X of N" label and the page count. Falling back to loaded-row
  // counts (totalFiltered) only before the first page resolves keeps the two
  // labels consistent — previously search used loaded rows and undercounted.
  const totalForLabel = totalCount ?? totalFiltered;
  const totalPages =
    totalCount != null && totalCount > 0
      ? Math.ceil(totalCount / LIST_PAGE_SIZE)
      : totalFiltered > 0
        ? totalPagesFiltered
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
      // Date-like columns default to newest first; text columns default to A→Z.
      const dateLike =
        key === "lastMessageAt" || key === "createdAt" || key === "updatedAt";
      setSortKey(key);
      setSortDir(dateLike ? "desc" : "asc");
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
        // Selection persists across pages, but we can only serialize rows that
        // are currently loaded in memory. Surface any selected-but-unloaded
        // contacts instead of silently dropping them from the CSV.
        const missing = selectedContactIds.size - selected.length;
        if (selected.length === 0) {
          setError(
            "None of the selected contacts are loaded on this page. Load more rows (or clear filters) and try again."
          );
          return;
        }
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
        if (missing > 0) {
          setError(
            `Exported ${selected.length} loaded contact(s). ${missing} selected contact(s) weren't loaded and were skipped — load more rows and export again to include them.`
          );
        }
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
  // `indeterminate` is applied via the header checkbox's callback ref (below)
  // so it stays in sync on the same commit as `checked`.

  // ── TanStack Table ──
  // Column visibility — persisted to localStorage (swap to API when /user/preferences is built)
  const COL_VIS_KEY = "contacts-column-visibility";
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => {
    let initial: VisibilityState = {};
    try {
      const stored = localStorage.getItem(COL_VIS_KEY);
      if (stored) initial = JSON.parse(stored) as VisibilityState;
    } catch { /* ignore */ }
    // Default new columns to hidden if user hasn't explicitly set them.
    if (!("createdAt" in initial)) initial.createdAt = false;
    if (!("updatedAt" in initial)) initial.updatedAt = false;
    return initial;
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

  useEffect(() => {
    if (!createdDropdownOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!createdDropdownRef.current?.contains(e.target as Node)) setCreatedDropdownOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [createdDropdownOpen]);

  useEffect(() => {
    if (!tagsDropdownOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!tagsDropdownRef.current?.contains(e.target as Node)) setTagsDropdownOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [tagsDropdownOpen]);

  useEffect(() => {
    if (!lifecycleDropdownOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!lifecycleDropdownRef.current?.contains(e.target as Node)) {
        setLifecycleDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [lifecycleDropdownOpen]);

  type ContactRow = (typeof displayed)[number];
  const tableColumns: ColumnDef<ContactRow>[] = useMemo(() => {
    const cols: ColumnDef<ContactRow>[] = [
      {
        id: "select",
        header: () => (
          <input
            // Callback ref keeps `indeterminate` in sync synchronously on every
            // commit, so it can't lag the controlled `checked` when the page
            // changes (a separate post-paint effect could be a frame behind).
            ref={(el) => {
              headerCheckboxRef.current = el;
              if (el) el.indeterminate = headerIndeterminate;
            }}
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
                  <p className="text-[0.8125rem] font-semibold text-base-content">{cName}</p>
                  {"isBlocked" in c && c.isBlocked && <span className="op-tag op-tag-danger">Blocked</span>}
                  {"isOptedOut" in c && c.isOptedOut && <span className="op-tag op-tag-warn">Opted out</span>}
                </div>
                {cDesignation && <p className="text-[0.6875rem] text-base-content/55">{cDesignation}</p>}
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
            <span className="text-[0.8125rem] text-base-content/80">
              {c.email || "—"}
              {"emailLabel" in c && c.emailLabel && <span className="ml-1 text-[0.6875rem] text-base-content/50">({c.emailLabel})</span>}
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
            <span className="font-mono-op text-[0.75rem] tabular-nums text-base-content/85">
              {c.phone}
              {"phoneLabel" in c && c.phoneLabel && <span className="ml-1 font-sans text-[0.6875rem] text-base-content/50">({c.phoneLabel})</span>}
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
            <span className="font-mono-op text-[0.6875rem] tabular-nums text-base-content/55">
              {"lastMessageAt" in c && c.lastMessageAt ? formatRelativeTime(c.lastMessageAt) : "—"}
            </span>
          );
        },
        enableSorting: true,
      },
      {
        accessorKey: "createdAt",
        header: "Created",
        cell: ({ row }) => {
          const c = row.original;
          return (
            <span className="font-mono-op text-[0.6875rem] tabular-nums text-base-content/55">
              {"createdAt" in c && (c as Contact).createdAt
                ? formatRelativeTime((c as Contact).createdAt)
                : "—"}
            </span>
          );
        },
        enableSorting: true,
      },
      {
        accessorKey: "updatedAt",
        header: "Updated",
        cell: ({ row }) => {
          const c = row.original;
          return (
            <span className="font-mono-op text-[0.6875rem] tabular-nums text-base-content/55">
              {"updatedAt" in c && (c as Contact).updatedAt
                ? formatRelativeTime((c as Contact).updatedAt as string)
                : "—"}
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
            <span className="text-[0.8125rem] text-base-content/80">
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
        <div role="status" className="rounded-box border border-success/30 border-l-2 border-l-success bg-base-200 px-3 py-2.5">
          <div className="flex items-start justify-between gap-2">
            <div className="text-[0.8125rem]">
              <span className="op-label mb-1 block text-success">import complete</span>
              <span className="text-base-content">
                <span className="font-mono-op tabular-nums font-semibold">{bulkSseNotice.imported}</span> imported
                {bulkSseNotice.failed > 0 ? (
                  <>
                    {" · "}
                    <span className="font-mono-op tabular-nums font-semibold text-error">{bulkSseNotice.failed}</span> failed
                  </>
                ) : null}
              </span>
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-xs btn-circle"
              aria-label="Dismiss"
              onClick={() => setBulkSseNotice(null)}
            >
              ×
            </button>
          </div>
        </div>
      ) : null}
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
            data-esc-clearable="true"
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
                  <span className="font-mono-op text-[0.5625rem] tracking-[0.08em] text-primary">saved</span>
                </div>
                {contactsTable.getAllLeafColumns()
                  .filter((col) => col.getCanHide())
                  .map((col) => (
                    <label key={col.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[0.75rem] hover:bg-base-300/40">
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
                    className="w-full rounded-md px-2 py-1.5 text-left text-[0.75rem] text-base-content/60 hover:bg-base-300/40 hover:text-base-content"
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
                  <span className="font-mono-op text-[0.625rem] tabular-nums">{selectedContactIds.size}</span>
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
                    <span className="font-mono-op text-[0.625rem] tabular-nums">{selectedContactIds.size}</span>
                  </button>
                </div>
              ) : null}
            </>
          )}
          {canDeleteContacts && hasActiveFilters && selectedContactIds.size === 0 && (
            <>
              <div className="mx-1 h-5 w-px bg-base-300" />
              <div className="tooltip tooltip-bottom" data-tip="Delete every contact matching the current filter">
                <button
                  type="button"
                  className="btn btn-ghost btn-sm gap-1 text-error/70 hover:text-error"
                  onClick={() => filterPreviewMutation.mutate()}
                  disabled={
                    filterPreviewMutation.isPending ||
                    filterBulkDeleteMutation.isPending
                  }
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span className="text-[0.6875rem]">
                    {filterPreviewMutation.isPending
                      ? "Counting…"
                      : "Delete matching"}
                  </span>
                </button>
              </div>
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
                <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[0.75rem] hover:bg-base-300/40">
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
                  <label key={seg.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[0.75rem] hover:bg-base-300/40">
                    <input
                      type="radio"
                      name="segment"
                      className="radio radio-xs radio-primary"
                      checked={segmentId === seg.id}
                      onChange={() => { setLocalSegmentId(seg.id); setSegDropdownOpen(false); }}
                    />
                    <span className="flex-1 truncate">{seg.name}</span>
                    {seg.contactCount != null ? (
                      <span className="font-mono-op text-[0.625rem] tabular-nums text-base-content/40">{seg.contactCount}</span>
                    ) : null}
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Tags filter dropdown */}
          {allTags.length > 0 && (
            <div className="relative" ref={tagsDropdownRef}>
              <div className="tooltip tooltip-bottom" data-tip="Filter by tags">
                <button
                  type="button"
                  className={`btn btn-ghost btn-sm gap-1 ${filterTagIds.length > 0 ? "text-primary" : ""}`}
                  onClick={() => setTagsDropdownOpen((v) => !v)}
                >
                  <Tag className="h-3.5 w-3.5" />
                  Tags
                  {filterTagIds.length > 0 && (
                    <span className="font-mono-op text-[0.625rem] tabular-nums">
                      {filterTagIds.length} · {tagsMatch}
                    </span>
                  )}
                </button>
              </div>
              {tagsDropdownOpen && (
                <div className="absolute right-0 top-full z-20 mt-1 w-64 rounded-box border border-base-300 bg-base-100 p-2 shadow-lg">
                  <div className="flex items-center justify-between px-2 pb-1.5">
                    <span className="op-label">Filter by tags</span>
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
                  <div className="flex items-center gap-1 rounded-md border border-base-300 bg-base-200 p-0.5">
                    {(["all", "any"] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        className={`flex-1 rounded font-mono-op px-2 py-1 text-[0.625rem] tracking-[0.08em] uppercase transition-colors ${
                          tagsMatch === m
                            ? "bg-base-100 text-primary"
                            : "text-base-content/55 hover:text-base-content"
                        }`}
                        onClick={() => setTagsMatch(m)}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                  <p className="mb-2 mt-1 px-1 text-[0.6875rem] text-base-content/55">
                    {tagsMatch === "all"
                      ? "Match contacts that have every selected tag."
                      : "Match contacts that have at least one selected tag."}
                  </p>
                  <div className="flex flex-wrap gap-1.5 px-1">
                    {allTags.map((tag) => {
                      const active = filterTagIds.includes(tag.id);
                      return (
                        <button
                          key={tag.id}
                          type="button"
                          className={`op-tag cursor-pointer gap-1 transition-colors ${active ? "op-tag-ok font-semibold" : ""}`}
                          style={!active && tag.color ? { borderColor: tag.color, color: tag.color } : undefined}
                          onClick={() =>
                            setFilterTagIds((prev) =>
                              prev.includes(tag.id)
                                ? prev.filter((id) => id !== tag.id)
                                : [...prev, tag.id]
                            )
                          }
                        >
                          {active ? <span aria-hidden>✓</span> : null}
                          {tag.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Lifecycle stage filter dropdown */}
          <div className="relative" ref={lifecycleDropdownRef}>
            <div className="tooltip tooltip-bottom" data-tip="Filter by lifecycle stage">
              <button
                type="button"
                className={`btn btn-ghost btn-sm gap-1 ${lifecycleStageFilter ? "text-primary" : ""}`}
                onClick={() => setLifecycleDropdownOpen((v) => !v)}
              >
                <GitBranch className="h-3.5 w-3.5" />
                Stage
                {lifecycleStageFilter ? (
                  <span className="font-mono-op text-[0.625rem] tabular-nums uppercase tracking-[0.04em]">
                    {LIFECYCLE_STAGE_LABELS[lifecycleStageFilter]}
                  </span>
                ) : null}
              </button>
            </div>
            {lifecycleDropdownOpen && (
              <div className="absolute right-0 top-full z-20 mt-1 w-56 rounded-box border border-base-300 bg-base-100 p-2 shadow-lg">
                <div className="flex items-center justify-between px-2 pb-1.5">
                  <span className="op-label">Lifecycle stage</span>
                  {lifecycleStageFilter ? (
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs gap-1 text-base-content/50"
                      onClick={() => setLifecycleStageFilter(null)}
                    >
                      Clear
                    </button>
                  ) : null}
                </div>
                <div className="flex flex-col">
                  <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[0.75rem] hover:bg-base-300/40">
                    <input
                      type="radio"
                      name="lifecycle-stage"
                      className="radio radio-xs radio-primary"
                      checked={!lifecycleStageFilter}
                      onChange={() => {
                        setLifecycleStageFilter(null);
                        setLifecycleDropdownOpen(false);
                      }}
                    />
                    Any stage
                  </label>
                  {CONTACT_LIFECYCLE_STAGES.map((stage) => (
                    <label
                      key={stage}
                      className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[0.75rem] hover:bg-base-300/40"
                    >
                      <input
                        type="radio"
                        name="lifecycle-stage"
                        className="radio radio-xs radio-primary"
                        checked={lifecycleStageFilter === stage}
                        onChange={() => {
                          setLifecycleStageFilter(stage);
                          setLifecycleDropdownOpen(false);
                        }}
                      />
                      {LIFECYCLE_STAGE_LABELS[stage]}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Created date filter dropdown */}
          <div className="relative" ref={createdDropdownRef}>
            <div className="tooltip tooltip-bottom" data-tip="Filter by created date">
              <button
                type="button"
                className={`btn btn-ghost btn-sm gap-1 ${createdAfter || createdBefore ? "text-primary" : ""}`}
                onClick={() => setCreatedDropdownOpen((v) => !v)}
              >
                <CalendarDays className="h-3.5 w-3.5" />
                Created
                {(createdAfter || createdBefore) && (
                  <span className="font-mono-op text-[0.625rem] tabular-nums">
                    {createdAfter || "…"} → {createdBefore || "…"}
                  </span>
                )}
              </button>
            </div>
            {createdDropdownOpen && (
              <div className="absolute right-0 top-full z-20 mt-1 w-72 rounded-box border border-base-300 bg-base-100 p-3 shadow-lg">
                <div className="mb-2 flex items-center justify-between">
                  <span className="op-label">Created date</span>
                  {(createdAfter || createdBefore) && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs text-base-content/50"
                      onClick={() => {
                        setCreatedAfter("");
                        setCreatedBefore("");
                      }}
                    >
                      Clear
                    </button>
                  )}
                </div>
                <div className="space-y-2">
                  <div className="space-y-1">
                    <span className="op-label block">From</span>
                    <input
                      type="date"
                      className="input input-bordered input-sm w-full"
                      value={createdAfter}
                      max={createdBefore || undefined}
                      onChange={(e) => setCreatedAfter(e.target.value)}
                      aria-label="Created after"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="op-label block">To</span>
                    <input
                      type="date"
                      className="input input-bordered input-sm w-full"
                      value={createdBefore}
                      min={createdAfter || undefined}
                      onChange={(e) => setCreatedBefore(e.target.value)}
                      aria-label="Created before"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

        </div>

      </div>
      </div>

      {error && (
        <div role="alert" className="rounded-box border border-error/30 border-l-2 border-l-error bg-base-200 px-3 py-2.5">
          <div className="flex items-start justify-between gap-2">
            <div className="text-[0.8125rem]">
              <span className="op-label mb-1 block text-error">error</span>
              <span className="text-base-content">{error}</span>
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-xs btn-circle"
              onClick={() => setError(null)}
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {conflictContact && (
        <div role="alert" className="rounded-box border border-warning/30 border-l-2 border-l-warning bg-base-200 px-3 py-2.5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="text-[0.8125rem]">
              <span className="op-label mb-1 block text-warning">duplicate phone</span>
              <span className="text-base-content">
                A contact with this phone already exists
                {conflictContact.name ? `: ${conflictContact.name}` : ""}
                {" "}
                <span className="font-mono-op tabular-nums text-base-content/70">({conflictContact.phone})</span>
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="btn btn-ghost btn-xs"
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
                className="btn btn-ghost btn-xs btn-circle"
                onClick={() => setConflictContact(null)}
                aria-label="Dismiss"
              >
                ×
              </button>
            </div>
          </div>
        </div>
      )}

      {!loadingList && sorted.length === 0 && (
        <div className="rounded-box border border-base-300 bg-base-200 p-8 text-center">
          <p className="text-sm text-base-content/70">
            {searchParam || filterTagIds.length > 0 || createdAfter || createdBefore || lifecycleStageFilter
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
        <div className="overflow-x-auto rounded-box border border-base-300 bg-base-200">
          <table className="w-full text-[0.78125rem]">
            <thead>
              <tr className="border-b border-base-300 bg-base-100">
                <th className="op-label px-3 py-2.5 text-left font-medium">Summary</th>
                <th className="op-label px-3 py-2.5 text-left font-medium">Email</th>
                <th className="op-label px-3 py-2.5 text-left font-medium">Phone</th>
                <th className="op-label px-3 py-2.5 text-left font-medium">Tags</th>
                <th className="op-label px-3 py-2.5 text-left font-medium">Last active</th>
                {visibleDefs.map((def) => (
                  <th key={def.id} className="op-label px-3 py-2.5 text-left font-medium">{def.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-base-300/50 last:border-b-0">
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="skeleton h-8 w-8 shrink-0 rounded-full" />
                      <div className="flex flex-col gap-1">
                        <div className="skeleton h-3.5 w-24 rounded-sm" />
                        <div className="skeleton h-3 w-32 rounded-sm" />
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3"><div className="skeleton h-3.5 w-28 rounded-sm" /></td>
                  <td className="px-3 py-3"><div className="skeleton h-3.5 w-24 rounded-sm" /></td>
                  <td className="px-3 py-3"><div className="skeleton h-5 w-20 rounded-sm" /></td>
                  <td className="px-3 py-3"><div className="skeleton h-3.5 w-16 rounded-sm" /></td>
                  {visibleDefs.map((def) => (
                    <td key={def.id} className="px-3 py-3"><div className="skeleton h-3.5 w-20 rounded-sm" /></td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loadingList && sorted.length > 0 && (
        <div className="overflow-x-auto rounded-box border border-base-300 bg-base-200">
          <table className="w-full text-[0.78125rem]">
            <thead>
              {contactsTable.getHeaderGroups().map((hg) => (
                <tr key={hg.id} className="border-b border-base-300 bg-base-100">
                  {hg.headers.map((h) => {
                    const sortable = ["name", "email", "phone", "lastMessageAt", "createdAt", "updatedAt"].includes(h.id);
                    const sortId =
                      h.id === "name" ? "name" :
                      h.id === "email" ? "email" :
                      h.id === "phone" ? "phone" :
                      h.id === "lastMessageAt" ? "lastMessageAt" :
                      h.id === "createdAt" ? "createdAt" :
                      h.id === "updatedAt" ? "updatedAt" :
                      null;
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
          workspaceId={workspaceId}
          onClose={() => setImporting(false)}
          onSuccess={() => {
            setImporting(false);
            invalidateContacts();
            invalidateSegmentPreview();
          }}
          onError={setError}
        />
      )}

      {bulkTagOpen && (
        <dialog open className="modal modal-middle">
          <div className="modal-box max-w-sm rounded-box border border-base-300 !bg-base-100 p-0">
            <div className="flex items-start justify-between gap-3 border-b border-base-300 px-5 py-4">
              <div>
                <span className="op-label">tag · {selectedContactIds.size} selected</span>
                <h3 className="mt-0.5 text-[1.0625rem] font-semibold tracking-[-0.015em]">Add tag</h3>
                <p className="mt-1 text-[0.78125rem] text-base-content/55">
                  Choose a tag to assign to all selected contacts.
                </p>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm btn-circle"
                onClick={() => {
                  setBulkTagOpen(false);
                  setBulkTagSelectedId(null);
                }}
                aria-label="Close"
                disabled={bulkAssignTagMutation.isPending}
              >
                ×
              </button>
            </div>
            <div className="px-5 py-4">
              {allTags.length === 0 ? (
                <p className="text-[0.8125rem] text-base-content/55">
                  No tags yet.{" "}
                  <button
                    type="button"
                    className="link link-primary"
                    onClick={() => {
                      setBulkTagOpen(false);
                      showManagePanel();
                    }}
                  >
                    Create tags
                  </button>{" "}
                  first.
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {allTags.map((tag) => {
                    const active = bulkTagSelectedId === tag.id;
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        className={`op-tag flex items-center gap-1.5 transition-colors ${
                          active ? "border-primary bg-primary/10 text-primary" : "hover:border-base-content/30"
                        }`}
                        style={!active && tag.color ? { borderColor: tag.color, color: tag.color } : undefined}
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
                    );
                  })}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 border-t border-base-300 px-5 py-3">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
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
                className="btn btn-primary btn-sm"
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
                  <span className="loading loading-spinner loading-xs" />
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

      {canDeleteContacts && (
        <ConfirmDialog
          open={bulkDeleteOpen}
          title="Delete selected contacts"
          description={`Soft-delete ${selectedContactIds.size} contact${selectedContactIds.size !== 1 ? "s" : ""}? They will be marked as deleted and no longer appear in this list.`}
          confirmLabel="Delete"
          tone="danger"
          loading={bulkDeleteMutation.isPending}
          onConfirm={() => bulkDeleteMutation.mutate(Array.from(selectedContactIds))}
          onClose={() => setBulkDeleteOpen(false)}
        />
      )}
      {canDeleteContacts && filterDeletePreview && (
        <ConfirmDialog
          open={filterDeleteOpen}
          title={
            filterDeletePreview.count === 0
              ? "Nothing matches the current filter"
              : `Delete ${filterDeletePreview.count} contact${filterDeletePreview.count !== 1 ? "s" : ""}?`
          }
          description={
            <span className="block space-y-2">
              {filterDeletePreview.count === 0 ? (
                <span className="block">
                  No contacts match the current filter. Adjust the filter and try again.
                </span>
              ) : (
                <>
                  <span className="block">
                    Soft-deletes every contact matching the current filter (search, tags,
                    lifecycle stage, date range, segment). Deleted contacts can be
                    restored individually from the contact record.
                  </span>
                  {filterDeletePreview.sample.length > 0 && (
                    <span className="block rounded-md border border-base-300 bg-base-200 px-2 py-1.5">
                      <span className="op-label mb-1 block">
                        sample ({filterDeletePreview.sample.length} of {filterDeletePreview.count})
                      </span>
                      <span className="block max-h-32 overflow-y-auto text-[0.75rem]">
                        {filterDeletePreview.sample.map((c) => (
                          <span key={c.id} className="block truncate">
                            {c.name?.trim() || c.phone || c.email || c.id}
                          </span>
                        ))}
                      </span>
                    </span>
                  )}
                </>
              )}
            </span>
          }
          confirmLabel={filterDeletePreview.count === 0 ? "Close" : `Delete ${filterDeletePreview.count}`}
          tone="danger"
          loading={filterBulkDeleteMutation.isPending}
          onConfirm={() => {
            if (filterDeletePreview.count === 0) {
              setFilterDeleteOpen(false);
              setFilterDeletePreview(null);
              return;
            }
            filterBulkDeleteMutation.mutate();
          }}
          onClose={() => {
            setFilterDeleteOpen(false);
            setFilterDeletePreview(null);
          }}
        />
      )}
    </div>
  );
}
