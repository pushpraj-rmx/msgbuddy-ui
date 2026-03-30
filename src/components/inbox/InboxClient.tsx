"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import {
  ArrowLeftIcon,
  UserCircleIcon,
} from "@heroicons/react/24/outline";
import {
  conversationsApi,
  contactsApi,
  templatesApi,
  workspaceApi,
  type ConversationPriority,
  type ConversationNote,
  type WorkspaceMemberResponseDto,
  type ConversationSendPolicyDto,
  type WhatsAppOutboundMediaType,
} from "@/lib/api";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { MessageBubble } from "@/components/inbox/MessageBubble";
import { InternalMessagesPanel } from "@/components/inbox/InternalMessagesPanel";
import { InternalNotesPanel } from "@/components/inbox/InternalNotesPanel";
import {
  classifyWhatsAppMediaKind,
  useInboxWhatsAppMediaUpload,
} from "@/hooks/use-inbox-whatsapp-media-upload";
import { type InboxMessage } from "@/lib/messaging";
import type { Contact, Template } from "@/lib/types";
import { extractApiErrorMessage } from "@/lib/messageApiErrors";
import { resolveMediaUrlForUi } from "@/lib/mediaUrls";
import {
  isContactBulkUpdated,
  isContactUpdated,
  isConversationUpdated,
  isMessageCreated,
  isMessageStatusUpdated,
  parseWorkspaceSseEvent,
} from "@/lib/sseEvents";
import { useMediaQuery } from "@/hooks/useMediaQuery";

export type Conversation = {
  id: string;
  contactId: string;
  channel: "WHATSAPP" | "TELEGRAM" | "EMAIL" | "SMS";
  status: "OPEN" | "CLOSED" | "ARCHIVED";
  priority?: ConversationPriority;
  assignedUserId?: string | null;
  unreadCount?: number;
  lastMessageAt?: string;
  contact?: { name?: string; phone?: string; email?: string };
  lastMessage?: { text?: string; type?: string };
};

function lastMessagePreview(lastMessage?: Conversation["lastMessage"]): string {
  if (!lastMessage) return "No messages";
  const t = lastMessage.text?.trim();
  if (t) return t;
  const ty = lastMessage.type?.toUpperCase();
  if (ty === "IMAGE") return "Image";
  if (ty === "VIDEO") return "Video";
  if (ty === "AUDIO") return "Audio";
  if (ty === "DOCUMENT") return "Document";
  return "No messages";
}

function pendingKindLabel(kind: WhatsAppOutboundMediaType | null): string {
  switch (kind) {
    case "IMAGE":
      return "Image";
    case "VIDEO":
      return "Video";
    case "AUDIO":
      return "Audio";
    case "DOCUMENT":
      return "Document";
    default:
      return "File";
  }
}

const WHATSAPP_ATTACH_ACCEPT =
  "image/jpg,image/jpeg,image/png,image/webp,video/mp4,video/3gpp,audio/aac,audio/mp4,audio/mpeg,audio/amr,audio/ogg,audio/opus,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain";

function conversationTitle(c: Conversation): string {
  return (
    c.contact?.name ||
    c.contact?.phone ||
    c.contact?.email ||
    "Unknown contact"
  );
}

/**
 * Fallback poll while a thread is open if SSE disconnects. Refetches also pick up
 * inbound IMAGE `PROCESSING` → `DELIVERED` when EventSource fails (see reconnect in SSE effect).
 */
const MESSAGE_POLL_MS = 12000;

const STATUS_TABS: Array<Conversation["status"]> = [
  "OPEN",
  "CLOSED",
  "ARCHIVED",
];

const LIMIT = 50;

/** Pixels from bottom — if the user is within this band, new messages auto-scroll. */
const NEAR_BOTTOM_PX = 120;

type TemplateVariableRow = {
  id: string;
  key: string;
  value: string;
};

function newTemplateVariableRow(): TemplateVariableRow {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    key: "",
    value: "",
  };
}

export function InboxClient({
  initialConversations,
  workspaceId,
  currentUserId,
}: {
  initialConversations: Conversation[];
  workspaceId: string;
  currentUserId: string;
}) {
  const [status, setStatus] = useState<Conversation["status"]>("OPEN");
  const [conversations, setConversations] =
    useState<Conversation[]>(initialConversations);
  const [listError, setListError] = useState<string | null>(null);
  const [listLoading, setListLoading] = useState(false);
  const [cursor, setCursor] = useState<string | null>(
    initialConversations.length ? initialConversations.at(-1)?.id ?? null : null
  );
  const [selectedId, setSelectedId] = useState<string | null>(
    initialConversations[0]?.id ?? null
  );

  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [messageLoading, setMessageLoading] = useState(false);
  const [messageError, setMessageError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [pendingMediaId, setPendingMediaId] = useState<string | null>(null);
  const [pendingKind, setPendingKind] =
    useState<WhatsAppOutboundMediaType | null>(null);
  const [pendingPreviewUrl, setPendingPreviewUrl] = useState<string | null>(
    null
  );
  const [pendingFileName, setPendingFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const draftInputRef = useRef<HTMLInputElement>(null);
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  const messagesBottomSentinelRef = useRef<HTMLDivElement>(null);
  /** After switching threads, jump to bottom; after local send, smooth scroll; else only if already near bottom. */
  const scrollThreadIntentRef = useRef<"none" | "auto" | "smooth">("none");
  /** Ids seen after last scroll effect — used to detect newly arrived messages (SSE / poll). */
  const messageIdsSnapshotRef = useRef<Set<string>>(new Set());
  const contactDialogRef = useRef<HTMLDialogElement>(null);
  const startChatDialogRef = useRef<HTMLDialogElement>(null);
  const mediaUpload = useInboxWhatsAppMediaUpload();
  const [startContact, setStartContact] = useState<Contact | null>(null);
  const [startChatSearch, setStartChatSearch] = useState("");
  const [startChatContacts, setStartChatContacts] = useState<Contact[]>([]);
  const [startChatLoading, setStartChatLoading] = useState(false);
  const [startChatError, setStartChatError] = useState<string | null>(null);
  const [sendPolicy, setSendPolicy] = useState<ConversationSendPolicyDto | null>(
    null
  );
  const [policyLoading, setPolicyLoading] = useState(false);
  const [policyError, setPolicyError] = useState<string | null>(null);
  const [useTemplateSend, setUseTemplateSend] = useState(false);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  /** True after a template list request finishes (even if the list is empty). Stops fetch loops when `templateOptions` stays []. */
  const [templateListFetched, setTemplateListFetched] = useState(false);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const [templateOptions, setTemplateOptions] = useState<Template[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [selectedTemplateVersionNum, setSelectedTemplateVersionNum] = useState<
    number | null
  >(null);
  const [templateVersionLoading, setTemplateVersionLoading] = useState(false);
  const [templateVariables, setTemplateVariables] = useState<
    TemplateVariableRow[]
  >([]);
  const [conversationActionBusy, setConversationActionBusy] = useState(false);
  const [conversationNotes, setConversationNotes] = useState<ConversationNote[]>(
    []
  );
  const [notesLoading, setNotesLoading] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [members, setMembers] = useState<WorkspaceMemberResponseDto[]>([]);
  const [assigneeUserId, setAssigneeUserId] = useState("");
  const [messageSearchQuery, setMessageSearchQuery] = useState("");
  const [messageSearchBusy, setMessageSearchBusy] = useState(false);
  const [messageSearchResult, setMessageSearchResult] = useState<InboxMessage | null>(
    null
  );

  const isLgUp = useMediaQuery("(min-width: 1024px)");
  const [mobilePane, setMobilePane] = useState<"list" | "thread">("list");

  const selectedConversation = useMemo(
    () => conversations.find((c) => c.id === selectedId) ?? null,
    [conversations, selectedId]
  );
  const activeContactId =
    selectedConversation?.contactId ?? startContact?.id ?? null;
  const activeChannel =
    selectedConversation?.channel ?? (startContact ? "WHATSAPP" : null);

  useEffect(() => {
    let cancelled = false;
    void workspaceApi
      .getMembers(workspaceId)
      .then((rows: WorkspaceMemberResponseDto[]) => {
        if (cancelled) return;
        setMembers(rows ?? []);
      })
      .catch(() => {
        if (cancelled) return;
        setMembers([]);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  useEffect(() => {
    setAssigneeUserId(selectedConversation?.assignedUserId ?? currentUserId);
  }, [currentUserId, selectedConversation?.assignedUserId, selectedId]);

  const sortedMessages = useMemo(
    () => [...messages].sort((a, b) => a.id.localeCompare(b.id)),
    [messages]
  );

  const clearPendingMediaPreview = useCallback(() => {
    setPendingPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setPendingFileName(null);
    setPendingKind(null);
  }, []);

  useLayoutEffect(() => {
    scrollThreadIntentRef.current = "auto";
    messageIdsSnapshotRef.current = new Set();
  }, [selectedId]);

  useLayoutEffect(() => {
    if (!selectedId || messageLoading) return;

    const container = messagesScrollRef.current;
    const bottom = messagesBottomSentinelRef.current;
    const scrollToBottom = (behavior: ScrollBehavior) => {
      bottom?.scrollIntoView({ block: "end", behavior });
    };

    if (!sortedMessages.length) {
      messageIdsSnapshotRef.current = new Set();
      const intent = scrollThreadIntentRef.current;
      if (intent === "auto" || intent === "smooth") {
        scrollToBottom(intent === "smooth" ? "smooth" : "auto");
        scrollThreadIntentRef.current = "none";
      }
      return;
    }

    const prevIds = messageIdsSnapshotRef.current;
    const newcomers = sortedMessages.filter((m) => !prevIds.has(m.id));

    const commitSnapshot = () => {
      messageIdsSnapshotRef.current = new Set(
        sortedMessages.map((m) => m.id)
      );
    };

    if (!container || !bottom) {
      commitSnapshot();
      return;
    }

    const intent = scrollThreadIntentRef.current;
    if (intent === "auto") {
      scrollToBottom("auto");
      scrollThreadIntentRef.current = "none";
      commitSnapshot();
      return;
    }
    if (intent === "smooth") {
      scrollToBottom("smooth");
      scrollThreadIntentRef.current = "none";
      commitSnapshot();
      return;
    }

    const nearBottom =
      container.scrollHeight -
        container.scrollTop -
        container.clientHeight <
      NEAR_BOTTOM_PX;
    if (nearBottom) {
      scrollToBottom("smooth");
      commitSnapshot();
      return;
    }

    /* New ids (SSE / poll / refetch) — scroll even when not near bottom so arrivals stay visible. */
    if (newcomers.length > 0) {
      scrollToBottom("smooth");
    }

    commitSnapshot();
  }, [selectedId, sortedMessages, messageLoading]);

  useEffect(() => {
    mediaUpload.cancel();
    setPendingMediaId(null);
    clearPendingMediaPreview();
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [selectedId, clearPendingMediaPreview]);

  const loadStartChatContacts = useCallback(
    async (search = "") => {
      setStartChatLoading(true);
      setStartChatError(null);
      try {
        const res = await contactsApi.list({
          limit: 25,
          search: search.trim() || undefined,
          sort: "lastMessageAt",
          order: "desc",
        });
        setStartChatContacts(res.contacts ?? []);
      } catch (error: unknown) {
        setStartChatError(
          extractApiErrorMessage(error) || "Failed to load contacts."
        );
      } finally {
        setStartChatLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    const trimmed = startChatSearch.trim();
    const timer = window.setTimeout(() => {
      void loadStartChatContacts(trimmed);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [startChatSearch, loadStartChatContacts]);

  useEffect(() => {
    setSelectedTemplateId("");
    setSelectedTemplateVersionNum(null);
    setTemplateVariables([]);
    setTemplatesError(null);
    setPolicyError(null);
    setSendPolicy(null);
    setUseTemplateSend(false);
  }, [activeContactId]);

  useEffect(() => {
    if (!activeContactId || activeChannel !== "WHATSAPP") {
      setSendPolicy(null);
      setPolicyError(null);
      setPolicyLoading(false);
      return;
    }
    let cancelled = false;
    setPolicyLoading(true);
    setPolicyError(null);
    void conversationsApi
      .getSendPolicy(activeContactId)
      .then((policy) => {
        if (cancelled) return;
        setSendPolicy(policy);
        if (policy.templateRequired) {
          setUseTemplateSend(true);
        }
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setPolicyError(
          extractApiErrorMessage(error) || "Failed to load send policy."
        );
      })
      .finally(() => {
        if (cancelled) return;
        setPolicyLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeContactId, activeChannel]);

  const loadTemplateOptions = useCallback(async () => {
    setTemplatesLoading(true);
    setTemplatesError(null);
    try {
      const res = await templatesApi.list({
        channel: "WHATSAPP",
        isActive: true,
        limit: 50,
        sortBy: "updatedAt",
        sortOrder: "desc",
      });
      setTemplateOptions((res.items ?? []).filter((t) => t.isActive));
    } catch (error: unknown) {
      setTemplatesError(
        extractApiErrorMessage(error) || "Failed to load templates."
      );
    } finally {
      setTemplatesLoading(false);
      setTemplateListFetched(true);
    }
  }, []);

  useEffect(() => {
    if (!useTemplateSend || activeChannel !== "WHATSAPP") {
      setTemplateListFetched(false);
      return;
    }
    if (templatesLoading || templateListFetched) return;
    void loadTemplateOptions();
  }, [
    useTemplateSend,
    activeChannel,
    templatesLoading,
    templateListFetched,
    loadTemplateOptions,
  ]);

  useEffect(() => {
    if (!selectedTemplateId) {
      setSelectedTemplateVersionNum(null);
      return;
    }
    let cancelled = false;
    setTemplateVersionLoading(true);
    void templatesApi
      .latestApproved(selectedTemplateId)
      .then((version) => {
        if (cancelled) return;
        setSelectedTemplateVersionNum(version.version);
      })
      .catch(() => {
        if (cancelled) return;
        setSelectedTemplateVersionNum(null);
      })
      .finally(() => {
        if (cancelled) return;
        setTemplateVersionLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedTemplateId]);

  useEffect(() => {
    if (!useTemplateSend) return;
    mediaUpload.cancel();
    setPendingMediaId(null);
    clearPendingMediaPreview();
  }, [useTemplateSend, clearPendingMediaPreview, mediaUpload.cancel]);

  const fetchConversations = useCallback(async (
    nextStatus = status,
    nextCursor?: string | null,
    append = false
  ) => {
    setListLoading(true);
    setListError(null);
    try {
      const data = (await conversationsApi.list({
        status: nextStatus,
        limit: LIMIT,
        cursor: nextCursor || undefined,
      })) as Conversation[];
      setConversations((prev) => (append ? [...prev, ...data] : data));
      setCursor(data.length ? data.at(-1)?.id ?? null : null);
      if (!append && data.length) {
        setSelectedId((current) => current ?? data[0].id);
      }
      if (!append && !data.length) {
        setSelectedId(null);
      }
    } catch (error: unknown) {
      setListError(extractApiErrorMessage(error) || "Failed to load conversations.");
    } finally {
      setListLoading(false);
    }
  }, [status]);

  const fetchMessages = useCallback(
    async (conversationId: string, options?: { silent?: boolean }) => {
      const silent = options?.silent === true;
      if (!silent) {
        setMessageLoading(true);
        setMessageError(null);
      }
      try {
        const data = (await conversationsApi.messages(
          conversationId
        )) as InboxMessage[];
        setMessages(data);
      } catch (error: unknown) {
        if (!silent) {
          setMessageError(extractApiErrorMessage(error) || "Failed to load messages.");
        }
      } finally {
        if (!silent) {
          setMessageLoading(false);
        }
      }
    },
    []
  );

  const refreshConversationById = useCallback(
    async (id: string) => {
      const detail = (await conversationsApi.getById(id)) as Conversation;
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, ...detail } : c))
      );
    },
    []
  );

  const loadNotes = useCallback(async (conversationId: string) => {
    setNotesLoading(true);
    try {
      const rows = await conversationsApi.listNotes(conversationId);
      setConversationNotes(rows ?? []);
    } catch {
      setConversationNotes([]);
    } finally {
      setNotesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedId) {
      /** Clear immediately so scroll logic doesn’t run against the previous thread’s messages. */
      setMessages([]);
      void fetchMessages(selectedId);
      void loadNotes(selectedId);
    } else {
      setMessages([]);
      setConversationNotes([]);
    }
  }, [fetchMessages, loadNotes, selectedId]);

  useEffect(() => {
    fetchConversations(status, null, false);
  }, [fetchConversations, status]);

  /** Refetch when returning to the tab so delivery status catches up with webhooks. */
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible" && selectedId) {
        void fetchMessages(selectedId, { silent: true });
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [fetchMessages, selectedId]);

  /** Fallback poll — prefer `message.status_updated` over SSE (see sseEvents). */
  useEffect(() => {
    if (!selectedId) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void fetchMessages(selectedId, { silent: true });
      }
    }, MESSAGE_POLL_MS);
    return () => window.clearInterval(timer);
  }, [fetchMessages, selectedId]);

  useEffect(() => {
    if (!workspaceId) return;
    let cancelled = false;
    let source: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let retries = 0;

    const connect = () => {
      if (cancelled) return;
      source = new EventSource(`/api/sse/workspace/${workspaceId}`);
      source.onopen = () => {
        retries = 0;
      };
      source.onmessage = (event) => {
        const ev = parseWorkspaceSseEvent(event.data);
        if (!ev) return;

        if (isMessageCreated(ev.type)) {
          fetchConversations(status, null, false);
          if (selectedId) {
            void fetchMessages(selectedId, { silent: true });
          }
          return;
        }

        if (isMessageStatusUpdated(ev.type)) {
          if (selectedId) {
            void fetchMessages(selectedId, { silent: true });
          }
          return;
        }

        if (isConversationUpdated(ev.type)) {
          fetchConversations(status, null, false);
          return;
        }

        if (isContactUpdated(ev.type) || isContactBulkUpdated(ev.type)) {
          fetchConversations(status, null, false);
        }
      };
      source.onerror = () => {
        source?.close();
        source = null;
        if (cancelled) return;
        retries += 1;
        const delay = Math.min(
          30_000,
          3000 * 2 ** Math.min(retries - 1, 4)
        );
        retryTimer = setTimeout(connect, delay);
      };
    };

    connect();

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      source?.close();
    };
  }, [fetchConversations, fetchMessages, selectedId, status, workspaceId]);

  const templateVariablesPayload = useMemo(() => {
    const entries = templateVariables
      .map((row) => ({
        key: row.key.trim(),
        value: row.value.trim(),
      }))
      .filter((row) => row.key && row.value);
    if (!entries.length) return undefined;
    return Object.fromEntries(entries.map((row) => [row.key, row.value]));
  }, [templateVariables]);

  const templateVarsAreValid = useMemo(() => {
    if (!useTemplateSend) return true;
    if (!templateVariables.length) return true;
    return templateVariables.every(
      (row) => row.key.trim().length > 0 && row.value.trim().length > 0
    );
  }, [templateVariables, useTemplateSend]);

  const refreshThreadAfterSend = useCallback(
    async (contactId: string, channel: Conversation["channel"]) => {
      scrollThreadIntentRef.current = "smooth";
      const refreshed = (await conversationsApi.list({
        status: "OPEN",
        limit: LIMIT,
      })) as Conversation[];
      setConversations(refreshed);
      const created =
        refreshed.find(
          (c) => c.contactId === contactId && c.channel === channel
        ) ?? null;
      if (created) {
        setSelectedId(created.id);
        setStartContact(null);
        await fetchMessages(created.id, { silent: true });
      }
    },
    [fetchMessages]
  );

  const runConversationAction = useCallback(
    async (
      operation:
        | "open"
        | "close"
        | "archive"
        | "read"
        | "assign"
        | "unassign"
        | "priority",
      payload?: { userId?: string; priority?: ConversationPriority }
    ) => {
      if (!selectedId || conversationActionBusy) return;
      setConversationActionBusy(true);
      try {
        if (operation === "open") await conversationsApi.open(selectedId);
        if (operation === "close") await conversationsApi.close(selectedId);
        if (operation === "archive") await conversationsApi.archive(selectedId);
        if (operation === "read") await conversationsApi.read(selectedId);
        if (operation === "assign" && payload?.userId) {
          await conversationsApi.assign(selectedId, payload.userId);
        }
        if (operation === "unassign") await conversationsApi.unassign(selectedId);
        if (operation === "priority" && payload?.priority) {
          await conversationsApi.setPriority(selectedId, payload.priority);
        }
        await refreshConversationById(selectedId);
        await fetchConversations(status, null, false);
      } catch (error: unknown) {
        setMessageError(
          extractApiErrorMessage(error) || "Failed to update conversation."
        );
      } finally {
        setConversationActionBusy(false);
      }
    },
    [
      conversationActionBusy,
      fetchConversations,
      refreshConversationById,
      selectedId,
      status,
    ]
  );

  const createConversationNote = useCallback(async () => {
    if (!selectedId || !noteDraft.trim()) return;
    setConversationActionBusy(true);
    try {
      await conversationsApi.createNote(selectedId, noteDraft.trim());
      setNoteDraft("");
      await loadNotes(selectedId);
    } catch (error: unknown) {
      setMessageError(extractApiErrorMessage(error) || "Failed to create note.");
    } finally {
      setConversationActionBusy(false);
    }
  }, [loadNotes, noteDraft, selectedId]);

  const deleteConversationNote = useCallback(
    async (noteId: string) => {
      if (!selectedId) return;
      setConversationActionBusy(true);
      try {
        await conversationsApi.deleteNote(selectedId, noteId);
        await loadNotes(selectedId);
      } catch (error: unknown) {
        setMessageError(extractApiErrorMessage(error) || "Failed to delete note.");
      } finally {
        setConversationActionBusy(false);
      }
    },
    [loadNotes, selectedId]
  );

  const runMessageSearch = useCallback(async () => {
    if (!selectedId || !messageSearchQuery.trim()) return;
    setMessageSearchBusy(true);
    try {
      const rows = (await conversationsApi.searchMessages({
        q: messageSearchQuery.trim(),
        conversationId: selectedId,
        limit: 1,
      })) as InboxMessage[];
      const first = rows?.[0] ?? null;
      if (!first) {
        setMessageSearchResult(null);
        return;
      }
      const full = (await conversationsApi.getMessageById(first.id)) as InboxMessage;
      setMessageSearchResult(full);
    } catch (error: unknown) {
      setMessageError(extractApiErrorMessage(error) || "Failed to search messages.");
    } finally {
      setMessageSearchBusy(false);
    }
  }, [messageSearchQuery, selectedId]);

  const handleSend = async () => {
    if (!activeContactId || !activeChannel || sending || mediaUpload.uploading) return;

    if (useTemplateSend) {
      if (!selectedTemplateId || !selectedTemplateVersionNum) {
        setMessageError("Select a template before sending.");
        return;
      }
      if (!templateVarsAreValid) {
        setMessageError("Fill all template variables before sending.");
        return;
      }
      setSending(true);
      try {
        await conversationsApi.sendMessage({
          contactId: activeContactId,
          channel: "WHATSAPP",
          templateId: selectedTemplateId,
          templateVersionNum: selectedTemplateVersionNum,
          templateVariables: templateVariablesPayload,
          idempotencyKey:
            typeof crypto !== "undefined" ? crypto.randomUUID() : undefined,
        });
        setDraft("");
        setPendingMediaId(null);
        clearPendingMediaPreview();
        await refreshThreadAfterSend(activeContactId, "WHATSAPP");
      } catch (error: unknown) {
        const maybeReason =
          ((error as { response?: { data?: { reason?: string } } }).response
            ?.data?.reason || "") as string;
        if (maybeReason.toUpperCase() === "TEMPLATE_REQUIRED") {
          setUseTemplateSend(true);
          void conversationsApi
            .getSendPolicy(activeContactId)
            .then(setSendPolicy)
            .catch(() => {});
        }
        setMessageError(
          extractApiErrorMessage(error) || "Failed to send message."
        );
      } finally {
        setSending(false);
        window.setTimeout(() => {
          draftInputRef.current?.focus({ preventScroll: true });
        }, 0);
      }
      return;
    }

    if (
      pendingMediaId &&
      pendingKind &&
      activeChannel === "WHATSAPP"
    ) {
      setSending(true);
      try {
        await conversationsApi.sendMessage({
          contactId: activeContactId,
          type: pendingKind,
          mediaId: pendingMediaId,
          text: draft.trim() || undefined,
          idempotencyKey:
            typeof crypto !== "undefined" ? crypto.randomUUID() : undefined,
          channel: "WHATSAPP",
        });
        setDraft("");
        setPendingMediaId(null);
        clearPendingMediaPreview();
        await refreshThreadAfterSend(activeContactId, "WHATSAPP");
      } catch (error: unknown) {
        const maybeReason =
          ((error as { response?: { data?: { reason?: string } } }).response
            ?.data?.reason || "") as string;
        if (maybeReason.toUpperCase() === "TEMPLATE_REQUIRED") {
          setUseTemplateSend(true);
          void conversationsApi
            .getSendPolicy(activeContactId)
            .then(setSendPolicy)
            .catch(() => {});
        }
        setMessageError(
          extractApiErrorMessage(error) || "Failed to send message."
        );
      } finally {
        setSending(false);
        window.setTimeout(() => {
          draftInputRef.current?.focus({ preventScroll: true });
        }, 0);
      }
      return;
    }

    if (!draft.trim()) return;

    setSending(true);
    try {
      await conversationsApi.sendMessage({
        contactId: activeContactId,
        text: draft.trim(),
        idempotencyKey:
          typeof crypto !== "undefined" ? crypto.randomUUID() : undefined,
        channel: activeChannel,
      });
      setDraft("");
      await refreshThreadAfterSend(activeContactId, activeChannel);
    } catch (error: unknown) {
      const maybeReason =
        ((error as { response?: { data?: { reason?: string } } }).response?.data
          ?.reason || "") as string;
      if (maybeReason.toUpperCase() === "TEMPLATE_REQUIRED") {
        setUseTemplateSend(true);
        void conversationsApi
          .getSendPolicy(activeContactId)
          .then(setSendPolicy)
          .catch(() => {});
      }
      setMessageError(
        extractApiErrorMessage(error) || "Failed to send message."
      );
    } finally {
      setSending(false);
      window.setTimeout(() => {
        draftInputRef.current?.focus({ preventScroll: true });
      }, 0);
    }
  };

  const handleMediaFileChange = async (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    clearPendingMediaPreview();
    const kind = classifyWhatsAppMediaKind(file);
    setPendingKind(kind);
    setPendingFileName(file.name);
    if (kind === "IMAGE" || kind === "VIDEO" || kind === "AUDIO") {
      setPendingPreviewUrl(URL.createObjectURL(file));
    }
    try {
      const { mediaId, kind: confirmed } = await mediaUpload.upload(file);
      setPendingMediaId(mediaId);
      setPendingKind(confirmed);
    } catch {
      clearPendingMediaPreview();
    } finally {
      event.target.value = "";
    }
  };

  const updateTemplateVariableRow = useCallback(
    (id: string, patch: Partial<Pick<TemplateVariableRow, "key" | "value">>) => {
      setTemplateVariables((rows) =>
        rows.map((row) => (row.id === id ? { ...row, ...patch } : row))
      );
    },
    []
  );

  const addTemplateVariableRow = useCallback(() => {
    setTemplateVariables((rows) => [...rows, newTemplateVariableRow()]);
  }, []);

  const removeTemplateVariableRow = useCallback((id: string) => {
    setTemplateVariables((rows) => {
      return rows.filter((row) => row.id !== id);
    });
  }, []);

  const canSend =
    !!activeContactId &&
    !sending &&
    !mediaUpload.uploading &&
    (useTemplateSend
      ? !!selectedTemplateId &&
        !!selectedTemplateVersionNum &&
        templateVarsAreValid
      : (pendingMediaId &&
          pendingKind &&
          activeChannel === "WHATSAPP") ||
        (!!draft.trim() && !pendingMediaId));

  const showWhatsAppMediaTools =
    activeChannel === "WHATSAPP";

  const contactForDetails = selectedConversation?.contact
    ? {
        name: selectedConversation.contact.name,
        phone: selectedConversation.contact.phone,
        email: selectedConversation.contact.email,
        status: selectedConversation.status,
      }
    : startContact
      ? {
          name: startContact.name,
          phone: startContact.phone,
          email: startContact.email,
          status: "NEW",
        }
      : null;

  const contactDetailsEl =
    !contactForDetails ? (
      <EmptyState
        title="No contact selected"
        description="Contact details appear when you open a conversation."
      />
    ) : (
      <div className="divide-y divide-base-300/70 rounded-xl bg-base-100">
        <div className="space-y-2 p-4">
          <p className="text-xs text-base-content/55">Name</p>
          <p className="text-sm text-base-content">
            {contactForDetails.name || "Unknown"}
          </p>
        </div>
        <div className="space-y-2 p-4">
          <p className="text-xs text-base-content/55">Phone</p>
          <p className="text-sm text-base-content">
            {contactForDetails.phone || "—"}
          </p>
        </div>
        <div className="space-y-2 p-4">
          <p className="text-xs text-base-content/55">Email</p>
          <p className="text-sm text-base-content">
            {contactForDetails.email || "—"}
          </p>
        </div>
        <div className="space-y-2 p-4">
          <p className="text-xs text-base-content/55">Status</p>
          <p className="text-sm text-base-content">
            {contactForDetails.status}
          </p>
        </div>
      </div>
    );

  return (
    <>
    <div className="flex min-h-[50dvh] flex-1 flex-col gap-3 lg:min-h-[70vh] lg:grid lg:grid-cols-[minmax(240px,1fr)_minmax(0,2.2fr)_minmax(240px,1fr)] lg:gap-1">
      <div
        className={`flex min-h-0 flex-1 flex-col space-y-3 rounded-xl border border-base-300/80 bg-base-200 p-3 sm:p-4 max-lg:min-h-[38vh] lg:min-h-0 ${
          !isLgUp && mobilePane === "thread" ? "hidden" : "flex"
        }`}
      >
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-medium">Conversations</h2>
            <div className="flex items-center gap-2">
              {listLoading && <span className="loading loading-spinner" />}
              <button
                type="button"
                className="btn btn-ghost btn-sm rounded-xl"
                onClick={() => {
                  setStartChatSearch("");
                  void loadStartChatContacts("");
                  startChatDialogRef.current?.showModal();
                }}
              >
                New chat
              </button>
            </div>
          </div>
          <div role="tablist" className="tabs tabs-box w-full">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab}
                role="tab"
                className={`tab min-h-11 flex-1 sm:min-h-0 sm:flex-none ${
                  status === tab ? "tab-active" : ""
                }`}
                onClick={() => setStatus(tab)}
              >
                {tab}
              </button>
            ))}
          </div>

          {listError ? (
            <div className="space-y-2">
              <ErrorState message={listError} />
              <button
                type="button"
                className="btn btn-outline btn-sm w-full rounded-xl"
                onClick={() => fetchConversations(status, null, false)}
              >
                Retry
              </button>
            </div>
          ) : null}

          {!listLoading && !conversations.length && !listError ? (
            <EmptyState
              title="No conversations"
              description="No conversations for this filter."
            />
          ) : null}

          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            <ul className="space-y-1">
              {conversations.map((conversation) => {
                const isActive = conversation.id === selectedId;
                const hasUnread = (conversation.unreadCount ?? 0) > 0;
                const title =
                  conversation.contact?.name ||
                  conversation.contact?.phone ||
                  conversation.contact?.email ||
                  "Unknown contact";
                const subtitle = lastMessagePreview(conversation.lastMessage);
                return (
                  <li key={conversation.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setStartContact(null);
                        setSelectedId(conversation.id);
                        if (!isLgUp) setMobilePane("thread");
                      }}
                      className={`group flex min-h-11 w-full flex-col gap-1 rounded-xl px-3 py-2.5 text-left transition-all duration-150 sm:min-h-0 sm:py-2 ${
                        isActive
                          ? "bg-primary/12 ring-1 ring-primary/30"
                          : "bg-base-100 hover:bg-base-300/40"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`truncate text-sm ${
                            hasUnread ? "font-medium text-base-content" : "text-base-content/85"
                          }`}
                        >
                          {title}
                        </span>
                        {hasUnread ? (
                          <span className="badge badge-primary badge-sm">
                            {conversation.unreadCount}
                          </span>
                        ) : null}
                      </div>
                      <span
                        className={`truncate text-xs ${
                          hasUnread ? "text-base-content/75" : "text-base-content/55"
                        }`}
                      >
                        {subtitle}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

        <button
          type="button"
          className="btn btn-ghost btn-sm w-full rounded-xl transition-all duration-150 active:scale-[0.99]"
          onClick={() => fetchConversations(status, cursor, true)}
          disabled={!cursor || listLoading}
        >
          Load more
        </button>
      </div>

      <div
        className={`flex min-h-0 flex-1 flex-col rounded-xl border border-base-300/80 bg-base-200 p-3 sm:p-4 lg:max-h-[calc(100dvh-7rem)] ${
          !isLgUp && mobilePane === "list" ? "hidden" : "flex"
        }`}
      >
          <div className="flex shrink-0 items-center justify-between gap-2">
            <div className="flex min-h-11 min-w-0 flex-1 items-center gap-2 sm:min-h-0">
              {!isLgUp ? (
                <button
                  type="button"
                  className="btn btn-ghost btn-square shrink-0 rounded-xl"
                  aria-label="Back to conversations"
                  onClick={() => setMobilePane("list")}
                >
                  <ArrowLeftIcon className="h-5 w-5" />
                </button>
              ) : null}
              <h2 className="truncate text-base font-medium">
                {!isLgUp && (selectedConversation || startContact)
                  ? selectedConversation
                    ? conversationTitle(selectedConversation)
                    : startContact?.name || startContact?.phone || startContact?.email || "New chat"
                  : "Messages"}
              </h2>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {selectedConversation ? (
                <>
                  <div className="hidden items-center gap-1 md:flex">
                    <button
                      type="button"
                      className="btn btn-xs btn-ghost"
                      onClick={() => runConversationAction("open")}
                      disabled={conversationActionBusy}
                    >
                      Open
                    </button>
                    <button
                      type="button"
                      className="btn btn-xs btn-ghost"
                      onClick={() => runConversationAction("close")}
                      disabled={conversationActionBusy}
                    >
                      Close
                    </button>
                    <button
                      type="button"
                      className="btn btn-xs btn-ghost"
                      onClick={() => runConversationAction("archive")}
                      disabled={conversationActionBusy}
                    >
                      Archive
                    </button>
                    <button
                      type="button"
                      className="btn btn-xs btn-ghost"
                      onClick={() => runConversationAction("read")}
                      disabled={conversationActionBusy}
                    >
                      Mark read
                    </button>
                  </div>

                  <select
                    className="select select-bordered select-xs w-28"
                    value={selectedConversation.priority || "NORMAL"}
                    onChange={(event) =>
                      runConversationAction("priority", {
                        priority: event.target.value as ConversationPriority,
                      })
                    }
                    disabled={conversationActionBusy}
                    aria-label="Conversation priority"
                  >
                    <option value="LOW">LOW</option>
                    <option value="NORMAL">NORMAL</option>
                    <option value="HIGH">HIGH</option>
                    <option value="URGENT">URGENT</option>
                  </select>

                  <select
                    className="select select-bordered select-xs w-40"
                    value={assigneeUserId}
                    onChange={(event) => setAssigneeUserId(event.target.value)}
                    disabled={conversationActionBusy || !members.length}
                    aria-label="Assign conversation"
                  >
                    {members.map((member) => (
                      <option
                        key={member.id}
                        value={member.user?.id ?? ""}
                        disabled={!member.user?.id}
                      >
                        {member.user?.email || member.user?.id || "Unknown user"}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn btn-xs btn-outline"
                    onClick={() =>
                      runConversationAction("assign", { userId: assigneeUserId })
                    }
                    disabled={conversationActionBusy || !assigneeUserId}
                  >
                    Assign
                  </button>
                  <button
                    type="button"
                    className="btn btn-xs btn-ghost"
                    onClick={() => runConversationAction("unassign")}
                    disabled={conversationActionBusy}
                  >
                    Unassign
                  </button>
                </>
              ) : null}
              {!isLgUp && selectedConversation ? (
                <button
                  type="button"
                  className="btn btn-ghost btn-square rounded-xl"
                  aria-label="Contact details"
                  onClick={() => contactDialogRef.current?.showModal()}
                >
                  <UserCircleIcon className="h-6 w-6" />
                </button>
              ) : null}
              {messageLoading && <span className="loading loading-spinner" />}
            </div>
          </div>

          {messageError ? (
            <div className="mt-2 shrink-0 space-y-2">
              <ErrorState message={messageError} />
              <button
                type="button"
                className="btn btn-outline btn-sm rounded-xl"
                onClick={() =>
                  selectedId && fetchMessages(selectedId, { silent: false })
                }
              >
                Retry
              </button>
            </div>
          ) : null}

          {!selectedConversation && !startContact ? (
            <div className="mt-2 shrink-0">
              <EmptyState
                title="Select a conversation"
                description="Choose a conversation or start a new chat."
              />
            </div>
          ) : null}

          {!!(selectedConversation || startContact) && !messageLoading && !messages.length ? (
            <div className="mt-2 shrink-0">
              <EmptyState
                title="No messages yet"
                description={
                  startContact && !selectedConversation
                    ? "Send the first message to create this conversation."
                    : "Send the first message to start this thread."
                }
              />
            </div>
          ) : null}

          <div className="mx-auto mt-2 flex min-h-0 w-full max-w-3xl flex-1 flex-col">
            <div
              ref={messagesScrollRef}
              className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1"
            >
              {sortedMessages.map((message) => (
                <MessageBubble
                  key={`${message.id}-${resolveMediaUrlForUi(message.mediaUrl ?? undefined) ?? ""}-${message.status ?? ""}`}
                  message={message}
                />
              ))}
              <div
                ref={messagesBottomSentinelRef}
                aria-hidden
                className="h-px w-full shrink-0"
              />
            </div>

            <div className="mt-3 shrink-0 space-y-2 border-t border-base-300/70 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]">
            <input
              ref={fileInputRef}
              type="file"
              accept={WHATSAPP_ATTACH_ACCEPT}
              className="hidden"
              onChange={handleMediaFileChange}
            />
            {activeContactId && activeChannel === "WHATSAPP" ? (
              <div className="space-y-2">
                {policyLoading ? (
                  <div className="flex items-center gap-2 text-xs text-base-content/60">
                    <span className="loading loading-spinner loading-xs" />
                    Checking send policy…
                  </div>
                ) : null}
                {policyError ? (
                  <div role="alert" className="alert alert-warning alert-soft py-2 text-sm">
                    {policyError}
                  </div>
                ) : null}
                {sendPolicy ? (
                  <div
                    role="status"
                    className={`alert py-2 text-sm ${
                      sendPolicy.templateRequired
                        ? "alert-warning alert-soft"
                        : "alert-success alert-soft"
                    }`}
                  >
                    {sendPolicy.templateRequired
                      ? "Template required: this chat is outside the 24h customer-care window."
                      : "Free chat allowed in the current customer-care window."}
                  </div>
                ) : null}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-base-content/65">
                    Send mode
                  </span>
                  <div className="join">
                    <button
                      type="button"
                      className={`btn btn-xs join-item ${
                        !useTemplateSend ? "btn-primary" : "btn-ghost"
                      }`}
                      disabled={sendPolicy?.templateRequired === true}
                      onClick={() => setUseTemplateSend(false)}
                    >
                      Free chat
                    </button>
                    <button
                      type="button"
                      className={`btn btn-xs join-item ${
                        useTemplateSend ? "btn-primary" : "btn-ghost"
                      }`}
                      onClick={() => setUseTemplateSend(true)}
                    >
                      Template
                    </button>
                  </div>
                </div>
                {useTemplateSend ? (
                  <div className="space-y-2 rounded-xl border border-base-300/70 bg-base-100/70 p-3">
                    {templatesError ? (
                      <div role="alert" className="alert alert-warning alert-soft py-2 text-sm">
                        {templatesError}
                      </div>
                    ) : null}
                    <label className="floating-label">
                      <select
                        className="select select-bordered w-full"
                        value={selectedTemplateId}
                        onChange={(event) => setSelectedTemplateId(event.target.value)}
                        disabled={templatesLoading}
                      >
                        <option value="">Select template</option>
                        {templateOptions.map((template) => (
                          <option key={template.id} value={template.id}>
                            {template.name}
                          </option>
                        ))}
                      </select>
                      <span>Template</span>
                    </label>
                    <label className="floating-label">
                      <input
                        type="text"
                        className="input input-bordered w-full"
                        value={
                          templateVersionLoading
                            ? "Loading latest approved version..."
                            : selectedTemplateVersionNum != null
                              ? String(selectedTemplateVersionNum)
                              : ""
                        }
                        readOnly
                        placeholder="Approved version"
                      />
                      <span>Version</span>
                    </label>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-base-content/65">
                          Template variables
                        </p>
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs"
                          onClick={addTemplateVariableRow}
                        >
                          Add variable
                        </button>
                      </div>
                      {templateVariables.map((row) => (
                        <div key={row.id} className="flex items-center gap-2">
                          <input
                            type="text"
                            className="input input-bordered input-sm w-1/2"
                            placeholder="key"
                            value={row.key}
                            onChange={(event) =>
                              updateTemplateVariableRow(row.id, {
                                key: event.target.value,
                              })
                            }
                          />
                          <input
                            type="text"
                            className="input input-bordered input-sm w-1/2"
                            placeholder="value"
                            value={row.value}
                            onChange={(event) =>
                              updateTemplateVariableRow(row.id, {
                                value: event.target.value,
                              })
                            }
                          />
                          <button
                            type="button"
                            className="btn btn-ghost btn-xs"
                            onClick={() => removeTemplateVariableRow(row.id)}
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
            {mediaUpload.error ? (
              <div role="alert" className="alert alert-warning alert-soft text-sm py-2">
                {mediaUpload.error}
              </div>
            ) : null}
            {!useTemplateSend && (pendingPreviewUrl || pendingFileName) && pendingKind ? (
              <div className="flex items-start gap-3 rounded-xl border border-base-300/60 bg-base-300/30 p-3">
                {pendingKind === "IMAGE" && pendingPreviewUrl ? (
                  <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-base-300 ring-1 ring-base-300/80">
                    {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
                    <img
                      src={pendingPreviewUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                    {mediaUpload.uploading ? (
                      <div
                        className="absolute inset-0 flex items-center justify-center bg-base-100/65"
                        aria-hidden
                      >
                        <span className="loading loading-spinner loading-md text-primary" />
                      </div>
                    ) : null}
                  </div>
                ) : null}
                {pendingKind === "VIDEO" && pendingPreviewUrl ? (
                  <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-base-300 ring-1 ring-base-300/80">
                    <video
                      src={pendingPreviewUrl}
                      muted
                      className="h-full w-full object-cover"
                      playsInline
                    />
                    {mediaUpload.uploading ? (
                      <div
                        className="absolute inset-0 flex items-center justify-center bg-base-100/65"
                        aria-hidden
                      >
                        <span className="loading loading-spinner loading-md text-primary" />
                      </div>
                    ) : null}
                  </div>
                ) : null}
                {pendingKind === "AUDIO" && pendingPreviewUrl ? (
                  <div className="relative flex min-h-[3rem] shrink-0 flex-col justify-center">
                    <audio
                      src={pendingPreviewUrl}
                      controls
                      className="h-10 w-[min(100%,12rem)] max-w-[12rem]"
                    />
                    {mediaUpload.uploading ? (
                      <div
                        className="absolute inset-0 flex items-center justify-center bg-base-100/50"
                        aria-hidden
                      >
                        <span className="loading loading-spinner loading-md text-primary" />
                      </div>
                    ) : null}
                  </div>
                ) : null}
                {pendingKind === "DOCUMENT" ? (
                  <div className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-lg bg-base-300 text-2xl ring-1 ring-base-300/80">
                    <span aria-hidden>📄</span>
                    {mediaUpload.uploading ? (
                      <div
                        className="absolute inset-0 flex items-center justify-center bg-base-100/65"
                        aria-hidden
                      >
                        <span className="loading loading-spinner loading-md text-primary" />
                      </div>
                    ) : null}
                  </div>
                ) : null}
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <p className="text-sm text-base-content/90">
                    {mediaUpload.uploading
                      ? `Uploading…${mediaUpload.progress > 0 ? ` ${mediaUpload.progress}%` : ""}`
                      : pendingMediaId
                        ? `${pendingKindLabel(pendingKind)} ready to send`
                        : "Preparing…"}
                  </p>
                  {pendingFileName ? (
                    <p className="truncate text-xs text-base-content/70" title={pendingFileName}>
                      {pendingFileName}
                    </p>
                  ) : null}
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs w-fit rounded-lg"
                    onClick={() => {
                      mediaUpload.cancel();
                      setPendingMediaId(null);
                      clearPendingMediaPreview();
                    }}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ) : null}
            <div className="flex flex-wrap items-center gap-2">
              {showWhatsAppMediaTools ? (
                <button
                  type="button"
                  className="btn btn-ghost btn-square rounded-xl shrink-0"
                  aria-label="Attach photo, video, audio, or document"
                  disabled={
                    !activeContactId ||
                    mediaUpload.uploading ||
                    useTemplateSend ||
                    !!pendingMediaId
                  }
                  onClick={() => fileInputRef.current?.click()}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                    <circle cx="9" cy="9" r="2" />
                    <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                  </svg>
                </button>
              ) : activeContactId ? (
                <span
                  className="tooltip tooltip-top shrink-0 text-xs text-base-content/50"
                  data-tip="Media attachments are only available on WhatsApp for now."
                >
                  <button
                    type="button"
                    className="btn btn-ghost btn-square btn-disabled rounded-xl cursor-not-allowed"
                    aria-label="Media only on WhatsApp"
                    disabled
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      aria-hidden
                    >
                      <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                      <circle cx="9" cy="9" r="2" />
                      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                    </svg>
                  </button>
                </span>
              ) : null}
              <input
                ref={draftInputRef}
                type="text"
                className="input input-bordered min-w-0 flex-1 rounded-xl transition-all duration-150 focus:border-primary/50"
                placeholder={
                  useTemplateSend
                    ? "Template mode: free text is disabled"
                    : pendingMediaId
                    ? "Add a caption (optional)…"
                    : "Type a message…"
                }
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    if (canSend) handleSend();
                  }
                }}
                disabled={
                  !activeContactId ||
                  sending ||
                  mediaUpload.uploading ||
                  useTemplateSend
                }
              />
              <button
                type="button"
                className="btn btn-primary min-h-11 min-w-[4.5rem] rounded-xl px-4 transition-all duration-150 active:scale-[0.99] shrink-0 sm:min-h-0 sm:min-w-0"
                onClick={handleSend}
                disabled={!canSend}
              >
                {sending ? (
                  <span className="loading loading-spinner" />
                ) : (
                  "Send"
                )}
              </button>
            </div>
          </div>
          </div>
      </div>

      <div className="hidden min-h-0 flex-col space-y-3 rounded-xl border border-base-300/80 bg-base-200 p-3 sm:p-4 lg:flex">
        <h2 className="text-base font-medium">Contact</h2>
        {contactDetailsEl}
        {selectedConversation ? (
          <>
            <div className="rounded-xl border border-base-300 bg-base-100 p-3 space-y-2">
              <h3 className="text-sm font-medium">Message search</h3>
              <div className="flex items-center gap-2">
                <input
                  className="input input-bordered input-sm w-full"
                  placeholder="Search in this conversation"
                  value={messageSearchQuery}
                  onChange={(e) => setMessageSearchQuery(e.target.value)}
                />
                <button
                  type="button"
                  className="btn btn-sm btn-outline"
                  onClick={runMessageSearch}
                  disabled={messageSearchBusy || !messageSearchQuery.trim()}
                >
                  {messageSearchBusy ? "..." : "Find"}
                </button>
              </div>
              {messageSearchResult ? (
                <div className="rounded-lg border border-base-300 p-2 text-xs space-y-1">
                  <div className="font-mono text-base-content/70">
                    {messageSearchResult.id}
                  </div>
                  <div className="line-clamp-2">{messageSearchResult.text || "—"}</div>
                  <div className="flex items-center gap-2">
                    <select
                      className="select select-bordered select-xs"
                      value={String(messageSearchResult.status || "SENT").toUpperCase()}
                      onChange={async (event) => {
                        try {
                          const updated = (await conversationsApi.updateMessageStatus(
                            messageSearchResult.id,
                            event.target.value as
                              | "PENDING"
                              | "PROCESSING"
                              | "QUEUED"
                              | "SENT"
                              | "DELIVERED"
                              | "READ"
                              | "FAILED"
                          )) as InboxMessage;
                          setMessageSearchResult(updated);
                          if (selectedId) {
                            void fetchMessages(selectedId, { silent: true });
                          }
                        } catch (error: unknown) {
                          setMessageError(
                            extractApiErrorMessage(error) ||
                              "Failed to update message status."
                          );
                        }
                      }}
                    >
                      <option value="PENDING">PENDING</option>
                      <option value="PROCESSING">PROCESSING</option>
                      <option value="QUEUED">QUEUED</option>
                      <option value="SENT">SENT</option>
                      <option value="DELIVERED">DELIVERED</option>
                      <option value="READ">READ</option>
                      <option value="FAILED">FAILED</option>
                    </select>
                    <button
                      type="button"
                      className="btn btn-xs btn-ghost"
                      onClick={() => {
                        setSelectedId(selectedConversation.id);
                        void fetchMessages(selectedConversation.id, { silent: false });
                      }}
                    >
                      Refresh thread
                    </button>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="rounded-xl border border-base-300 bg-base-100 p-3 space-y-2">
              <h3 className="text-sm font-medium">Conversation notes</h3>
              <div className="flex items-center gap-2">
                <input
                  className="input input-bordered input-sm w-full"
                  placeholder="Add internal note"
                  value={noteDraft}
                  onChange={(e) => setNoteDraft(e.target.value)}
                />
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={createConversationNote}
                  disabled={conversationActionBusy || !noteDraft.trim()}
                >
                  Add
                </button>
              </div>
              {notesLoading ? (
                <span className="loading loading-spinner loading-sm" />
              ) : conversationNotes.length ? (
                <ul className="space-y-2">
                  {conversationNotes.map((note) => (
                    <li key={note.id} className="rounded-lg border border-base-300 p-2">
                      <p className="text-xs">{note.content}</p>
                      <div className="mt-1 flex items-center justify-between text-[11px] text-base-content/60">
                        <span>{note.authorUserId || "unknown"}</span>
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs"
                          onClick={() => deleteConversationNote(note.id)}
                          disabled={conversationActionBusy}
                        >
                          Delete
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-base-content/60">No notes yet.</p>
              )}
            </div>

            <InternalNotesPanel conversationId={selectedConversation.id} />
            <InternalMessagesPanel conversationId={selectedConversation.id} />
          </>
        ) : null}
      </div>
    </div>

    <dialog
      ref={startChatDialogRef}
      className="modal"
      aria-labelledby="inbox-start-chat-title"
    >
      <div className="modal-box max-h-[85dvh] max-w-lg overflow-y-auto">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 id="inbox-start-chat-title" className="text-lg font-semibold">
            Start new chat
          </h3>
          <form method="dialog">
            <button
              type="submit"
              className="btn btn-sm btn-circle btn-ghost"
              aria-label="Close"
            >
              ✕
            </button>
          </form>
        </div>

        <label className="input input-bordered mb-3 w-full rounded-xl">
          <span className="label">Search</span>
          <input
            type="text"
            placeholder="Name, phone, or email"
            value={startChatSearch}
            onChange={(event) => setStartChatSearch(event.target.value)}
          />
        </label>

        {startChatError ? (
          <div role="alert" className="alert alert-warning alert-soft mb-3 text-sm">
            {startChatError}
          </div>
        ) : null}
        {startChatLoading ? (
          <div className="flex justify-center py-4">
            <span className="loading loading-spinner" />
          </div>
        ) : null}

        {!startChatLoading && startChatContacts.length === 0 ? (
          <EmptyState
            title="No contacts found"
            description="Try a different search term or add a contact first."
          />
        ) : (
          <ul className="space-y-2">
            {startChatContacts.map((contact) => {
              const title =
                contact.name || contact.phone || contact.email || "Unknown contact";
              return (
                <li key={contact.id}>
                  <button
                    type="button"
                    className="w-full rounded-xl border border-base-300/60 bg-base-100 px-3 py-2 text-left hover:bg-base-200"
                    onClick={() => {
                      setStatus("OPEN");
                      setSelectedId(null);
                      setMessages([]);
                      setStartContact(contact);
                      if (!isLgUp) setMobilePane("thread");
                      startChatDialogRef.current?.close();
                      window.setTimeout(() => {
                        draftInputRef.current?.focus({ preventScroll: true });
                      }, 0);
                    }}
                  >
                    <p className="truncate text-sm font-medium">{title}</p>
                    <p className="truncate text-xs text-base-content/60">
                      {contact.phone || contact.email || "No phone/email"}
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <form method="dialog" className="modal-backdrop">
        <button type="submit" className="sr-only">
          Close
        </button>
      </form>
    </dialog>

    <dialog
      ref={contactDialogRef}
      className="modal"
      aria-labelledby="inbox-contact-title"
    >
      <div className="modal-box max-h-[85dvh] max-w-md overflow-y-auto">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 id="inbox-contact-title" className="text-lg font-semibold">
            Contact
          </h3>
          <form method="dialog">
            <button
              type="submit"
              className="btn btn-sm btn-circle btn-ghost"
              aria-label="Close"
            >
              ✕
            </button>
          </form>
        </div>
        {contactDetailsEl}
      </div>
      <form method="dialog" className="modal-backdrop">
        <button type="submit" className="sr-only">
          Close
        </button>
      </form>
    </dialog>
    </>
  );
}
