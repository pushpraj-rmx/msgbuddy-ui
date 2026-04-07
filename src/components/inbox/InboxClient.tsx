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
import { useSearchParams } from "next/navigation";
import AccountCircleRounded from "@mui/icons-material/AccountCircleRounded";
import ArrowBackRounded from "@mui/icons-material/ArrowBackRounded";
import {
  conversationsApi,
  contactsApi,
  presenceApi,
  templatesApi,
  channelTemplatesApi,
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
import type { ChannelTemplateVersion, Contact, Template } from "@/lib/types";
import {
  carouselCardFileAccept,
  isMediaHeaderType,
  uploadWhatsAppAttachmentIdAndPrepareWhatsApp,
} from "@/lib/whatsappTemplateMedia";
import { extractApiErrorMessage } from "@/lib/messageApiErrors";
import { resolveMediaUrlForUi } from "@/lib/mediaUrls";
import {
  isContactBulkUpdated,
  isContactUpdated,
  isConversationPresenceUpdated,
  isConversationUpdated,
  inboxMessageFromSseWire,
  isMessageCreated,
  isMessageStatusUpdated,
  parseWorkspaceSseEvent,
} from "@/lib/sseEvents";
import { useMediaQuery, XL_MEDIA_QUERY } from "@/hooks/useMediaQuery";
import { ContactAvatar } from "@/components/ui/ContactAvatar";
import { useRightPanel } from "@/components/right-panel/useRightPanel";

export type Conversation = {
  id: string;
  contactId: string;
  channel: "WHATSAPP" | "TELEGRAM" | "EMAIL" | "SMS";
  status: "OPEN" | "CLOSED" | "ARCHIVED";
  awaitingReply?: boolean;
  turn?: "YOUR_TURN" | "WAITING_ON_CUSTOMER";
  snoozedUntil?: string | null;
  priority?: ConversationPriority;
  assignedUserId?: string | null;
  unreadCount?: number;
  lastMessageAt?: string;
  lastMessage?: {
    text?: string;
    type?: string;
    status?: string;
    direction?: "INBOUND" | "OUTBOUND";
    errorMessage?: string;
    failedAt?: string;
  };
  contact?: {
    name?: string;
    phone?: string;
    email?: string;
    avatarUrl?: string | null;
  };
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
  mode = "inbox",
}: {
  initialConversations: Conversation[];
  workspaceId: string;
  currentUserId: string;
  mode?: "inbox" | "contactsQueue";
}) {
  const {
    setContent: setRightPanelContent,
    clearContent: clearRightPanelContent,
    open: openRightPanel,
  } = useRightPanel();
  const [status, setStatus] = useState<Conversation["status"]>("OPEN");
  const [queueFilter, setQueueFilter] = useState<
    "all" | "awaiting" | "unread" | "snoozed"
  >("all");
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
  /** After switching threads, jump to bottom once; after local send, smooth scroll. No auto-scroll on later SSE/poll. */
  const scrollThreadIntentRef = useRef<"none" | "auto" | "smooth">("none");
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
  const [selectedTemplateVersion, setSelectedTemplateVersion] = useState<{
    id: string;
    version: number;
    status: string;
  } | null>(null);
  const [templateVersionLoading, setTemplateVersionLoading] = useState(false);
  const [templateVariables, setTemplateVariables] = useState<
    TemplateVariableRow[]
  >([]);
  const [inboxTemplateVersionDetail, setInboxTemplateVersionDetail] =
    useState<ChannelTemplateVersion | null>(null);
  const [inboxTemplateVersionDetailLoading, setInboxTemplateVersionDetailLoading] =
    useState(false);
  const [templateHeaderMediaId, setTemplateHeaderMediaId] = useState<
    string | null
  >(null);
  const [templateCarouselMediaIds, setTemplateCarouselMediaIds] = useState<
    string[]
  >([]);
  const [templateBindingUploadBusy, setTemplateBindingUploadBusy] =
    useState(false);
  const [templateBindingError, setTemplateBindingError] = useState<
    string | null
  >(null);
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
  const [viewersByConversation, setViewersByConversation] = useState<
    Record<string, string[]>
  >({});
  const [draftsByConversation, setDraftsByConversation] = useState<
    Record<string, string>
  >({});

  const searchParams = useSearchParams();
  const isLgUp = useMediaQuery("(min-width: 1024px)");
  const isXlUp = useMediaQuery(XL_MEDIA_QUERY);
  const [mobilePane, setMobilePane] = useState<"list" | "thread">("list");
  const handledHandoffKeyRef = useRef<string | null>(null);
  const preserveStartContactSelectionRef = useRef(false);
  const draftSyncConversationRef = useRef<string | null>(null);
  const handoffContactId = searchParams.get("contactId");
  const handoffConversationId = searchParams.get("conversationId");
  const shouldFocusReply = searchParams.get("focus") === "reply";

  const selectedConversation = useMemo(
    () => conversations.find((c) => c.id === selectedId) ?? null,
    [conversations, selectedId]
  );
  const draftsStorageKey = `inbox-drafts:${workspaceId}:${currentUserId}:${mode}`;
  const selectedViewers = selectedId ? viewersByConversation[selectedId] ?? [] : [];
  const otherViewers = selectedViewers.filter((id) => id !== currentUserId);
  const activeContactId =
    selectedConversation?.contactId ?? startContact?.id ?? null;
  const activeChannel =
    selectedConversation?.channel ?? (startContact ? "WHATSAPP" : null);

  const waChannelTemplateId = useMemo(() => {
    if (!selectedTemplateId) return null;
    const tpl = templateOptions.find((t) => t.id === selectedTemplateId);
    const wa = (tpl?.channelTemplates ?? []).find(
      (ct) => ct.channel === "WHATSAPP"
    );
    return wa?.id ?? null;
  }, [selectedTemplateId, templateOptions]);

  /** Shown on hover on the “Free chat” control (replaces a full-width policy alert). */
  const freeChatPolicyTip = useMemo(() => {
    if (policyLoading) return "Checking send policy…";
    if (sendPolicy?.templateRequired) {
      return "Template required: this chat is outside the 24h customer-care window.";
    }
    if (sendPolicy) {
      return "Free chat allowed in the current customer-care window.";
    }
    return undefined;
  }, [policyLoading, sendPolicy]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(draftsStorageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, string>;
      if (parsed && typeof parsed === "object") {
        setDraftsByConversation(parsed);
      }
    } catch {
      // ignore malformed local storage
    }
  }, [draftsStorageKey]);

  useEffect(() => {
    try {
      localStorage.setItem(draftsStorageKey, JSON.stringify(draftsByConversation));
    } catch {
      // ignore
    }
  }, [draftsByConversation, draftsStorageKey]);

  useLayoutEffect(() => {
    if (selectedId) {
      setDraft(draftsByConversation[selectedId] ?? "");
      draftSyncConversationRef.current = null;
      return;
    }
    setDraft("");
    draftSyncConversationRef.current = null;
  }, [draftsByConversation, selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    if (draftSyncConversationRef.current !== selectedId) {
      draftSyncConversationRef.current = selectedId;
      return;
    }
    setDraftsByConversation((prev) => {
      if (!draft.trim()) {
        if (!(selectedId in prev)) return prev;
        const next = { ...prev };
        delete next[selectedId];
        return next;
      }
      if (prev[selectedId] === draft) return prev;
      return { ...prev, [selectedId]: draft };
    });
  }, [draft, selectedId]);

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
  }, [selectedId]);

  useLayoutEffect(() => {
    if (!selectedId || messageLoading) return;

    const container = messagesScrollRef.current;
    const scrollToBottom = (behavior: ScrollBehavior) => {
      if (!container) return;
      container.scrollTo({ top: container.scrollHeight, behavior });
    };

    if (!sortedMessages.length) {
      const intent = scrollThreadIntentRef.current;
      if (intent === "auto" || intent === "smooth") {
        scrollToBottom(intent === "smooth" ? "smooth" : "auto");
        scrollThreadIntentRef.current = "none";
      }
      return;
    }

    if (!container) {
      return;
    }

    const intent = scrollThreadIntentRef.current;
    if (intent === "auto") {
      scrollToBottom("auto");
      scrollThreadIntentRef.current = "none";
      return;
    }
    if (intent === "smooth") {
      scrollToBottom("smooth");
      scrollThreadIntentRef.current = "none";
      return;
    }
  }, [selectedId, sortedMessages, messageLoading]);

  useEffect(() => {
    mediaUpload.cancel();
    setPendingMediaId(null);
    clearPendingMediaPreview();
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [selectedId, clearPendingMediaPreview]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "r") return;
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || target?.isContentEditable) return;
      event.preventDefault();
      draftInputRef.current?.focus({ preventScroll: true });
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

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
    setSelectedTemplateVersion(null);
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
        isActive: true,
        limit: 50,
        sortBy: "updatedAt",
        sortOrder: "desc",
      });
      const candidates = (res.items ?? [])
        .filter((t) => t.isActive)
        .filter((t) =>
          (t.channelTemplates ?? []).some((ct) => ct.channel === "WHATSAPP")
        );

      // List rows often omit or differ on `channelTemplates[].providerStatus`.
      // Same source of truth as send: `/channel-templates/:id/state` → latestSendableVersion.
      const approved = await Promise.all(
        candidates.map(async (t) => {
          const wa = (t.channelTemplates ?? []).find(
            (ct) => ct.channel === "WHATSAPP"
          );
          if (!wa?.id) return null;
          try {
            const state = await channelTemplatesApi.state(wa.id);
            const v = state.latestSendableVersion;
            if (v?.status === "PROVIDER_APPROVED") return t;
          } catch {
            return null;
          }
          return null;
        })
      );

      setTemplateOptions(
        approved.filter((t): t is Template => t != null)
      );
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
      setSelectedTemplateVersion(null);
      return;
    }
    let cancelled = false;
    setTemplateVersionLoading(true);
    const tpl = templateOptions.find((t) => t.id === selectedTemplateId);
    const wa = (tpl?.channelTemplates ?? []).find((ct) => ct.channel === "WHATSAPP");
    if (!wa?.id) {
      setSelectedTemplateVersion(null);
      setTemplateVersionLoading(false);
      return;
    }

    void channelTemplatesApi
      .state(wa.id)
      .then((state) => {
        if (cancelled) return;
        const v = state.latestSendableVersion;
        if (!v) {
          setSelectedTemplateVersion(null);
          return;
        }
        setSelectedTemplateVersion({ id: v.id, version: v.version, status: v.status });
      })
      .catch(() => {
        if (cancelled) return;
        setSelectedTemplateVersion(null);
      })
      .finally(() => {
        if (cancelled) return;
        setTemplateVersionLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedTemplateId, templateOptions]);

  useEffect(() => {
    setTemplateHeaderMediaId(null);
    setTemplateCarouselMediaIds([]);
    setTemplateBindingError(null);
    setInboxTemplateVersionDetail(null);
  }, [selectedTemplateId, selectedTemplateVersion?.id]);

  useEffect(() => {
    if (
      !useTemplateSend ||
      !waChannelTemplateId ||
      !selectedTemplateVersion?.id
    ) {
      setInboxTemplateVersionDetail(null);
      setInboxTemplateVersionDetailLoading(false);
      return;
    }
    let cancelled = false;
    setInboxTemplateVersionDetailLoading(true);
    void channelTemplatesApi
      .listVersions(waChannelTemplateId)
      .then((versions) => {
        if (cancelled) return;
        const v = versions.find((x) => x.id === selectedTemplateVersion.id);
        setInboxTemplateVersionDetail(v ?? null);
      })
      .catch(() => {
        if (cancelled) return;
        setInboxTemplateVersionDetail(null);
      })
      .finally(() => {
        if (!cancelled) setInboxTemplateVersionDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [useTemplateSend, waChannelTemplateId, selectedTemplateVersion?.id]);

  useEffect(() => {
    const cards = inboxTemplateVersionDetail?.carouselCards;
    if (
      inboxTemplateVersionDetail?.layoutType === "CAROUSEL" &&
      Array.isArray(cards)
    ) {
      const n = cards.length;
      setTemplateCarouselMediaIds((prev) => {
        if (prev.length === n) return prev;
        return Array.from({ length: n }, (_, i) => prev[i] ?? "");
      });
    } else {
      setTemplateCarouselMediaIds([]);
    }
  }, [inboxTemplateVersionDetail]);

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
      const queueFilterParams = {
        unreadOnly: queueFilter === "unread",
        awaitingReplyOnly: queueFilter === "awaiting",
        snoozedOnly: queueFilter === "snoozed",
        includeSnoozed: queueFilter === "all",
      };
      const params =
        mode === "contactsQueue"
          ? {
            status: "OPEN" as const,
            limit: LIMIT,
            cursor: nextCursor || undefined,
            ...queueFilterParams,
            sort: "lastMessageAt" as const,
          }
          : {
            status: nextStatus,
            limit: LIMIT,
            cursor: nextCursor || undefined,
            ...queueFilterParams,
          };

      const data = (await conversationsApi.list(params)) as Conversation[];
      setConversations((prev) => (append ? [...prev, ...data] : data));
      setCursor(data.length ? data.at(-1)?.id ?? null : null);
      if (!append && data.length) {
        setSelectedId((current) => {
          if (current) return current;
          if (preserveStartContactSelectionRef.current) return null;
          return data[0].id;
        });
      }
      if (!append && !data.length) {
        setSelectedId(null);
      }
    } catch (error: unknown) {
      setListError(extractApiErrorMessage(error) || "Failed to load conversations.");
    } finally {
      setListLoading(false);
    }
  }, [mode, queueFilter, status]);

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

  const focusReplyComposer = useCallback(() => {
    window.setTimeout(() => {
      draftInputRef.current?.focus({ preventScroll: true });
    }, 0);
  }, []);

  useEffect(() => {
    if (mode !== "inbox") return;
    if (!handoffContactId && !handoffConversationId) return;
    const handoffKey = `${handoffConversationId ?? ""}:${handoffContactId ?? ""}:${shouldFocusReply ? "1" : "0"}`;
    if (handledHandoffKeyRef.current === handoffKey) return;
    handledHandoffKeyRef.current = handoffKey;

    let cancelled = false;
    const upsertConversation = (next: Conversation) => {
      setConversations((prev) => {
        const rest = prev.filter((c) => c.id !== next.id);
        return [next, ...rest];
      });
    };

    const applyHandoff = async () => {
      if (!isLgUp) setMobilePane("thread");
      setStatus("OPEN");
      try {
        if (handoffConversationId) {
          const conversation = (await conversationsApi.getById(
            handoffConversationId
          )) as Conversation;
          if (cancelled) return;
          upsertConversation(conversation);
          preserveStartContactSelectionRef.current = false;
          setStartContact(null);
          setSelectedId(conversation.id);
          if (shouldFocusReply) focusReplyComposer();
          return;
        }

        if (!handoffContactId) return;
        const byContact = (await conversationsApi.listByContact(
          handoffContactId
        )) as Conversation[];
        if (cancelled) return;

        const existing =
          byContact.find((conversation) => conversation.status === "OPEN") ??
          byContact[0];
        if (existing) {
          upsertConversation(existing);
          preserveStartContactSelectionRef.current = false;
          setStartContact(null);
          setSelectedId(existing.id);
          if (shouldFocusReply) focusReplyComposer();
          return;
        }

        const contact = await contactsApi.getOne(handoffContactId);
        if (cancelled) return;
        preserveStartContactSelectionRef.current = true;
        setSelectedId(null);
        setMessages([]);
        setStartContact(contact);
        if (shouldFocusReply) focusReplyComposer();
      } catch (error: unknown) {
        if (cancelled) return;
        setMessageError(
          extractApiErrorMessage(error) || "Failed to open chat in inbox."
        );
      }
    };

    void applyHandoff();

    return () => {
      cancelled = true;
    };
  }, [
    mode,
    handoffContactId,
    handoffConversationId,
    shouldFocusReply,
    isLgUp,
    focusReplyComposer,
  ]);

  useEffect(() => {
    if (selectedId) {
      /** Clear immediately so scroll logic doesn’t run against the previous thread’s messages. */
      setMessages([]);
      void fetchMessages(selectedId);
      void loadNotes(selectedId);
      window.setTimeout(() => {
        draftInputRef.current?.focus({ preventScroll: true });
      }, 0);
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
          const convId =
            typeof ev.data.conversationId === "string" ? ev.data.conversationId : "";
          if (selectedId && convId === selectedId) {
            const wire = inboxMessageFromSseWire(ev.data.message);
            if (wire) {
              setMessages((prev) => {
                const idx = prev.findIndex((m) => m.id === wire.id);
                if (idx >= 0) {
                  const next = [...prev];
                  next[idx] = { ...next[idx], ...wire };
                  return next;
                }
                const next = [...prev, wire];
                next.sort((a, b) => {
                  const ta = Date.parse(a.createdAt ?? "") || 0;
                  const tb = Date.parse(b.createdAt ?? "") || 0;
                  return ta - tb;
                });
                return next;
              });
            } else {
              void fetchMessages(selectedId, { silent: true });
            }
          }
          return;
        }

        if (isMessageStatusUpdated(ev.type)) {
          const convId =
            typeof ev.data.conversationId === "string" ? ev.data.conversationId : "";
          if (selectedId && convId === selectedId) {
            const wire = inboxMessageFromSseWire(ev.data.message);
            if (wire?.id) {
              setMessages((prev) => {
                const idx = prev.findIndex((m) => m.id === wire.id);
                if (idx < 0) return prev;
                const next = [...prev];
                next[idx] = { ...next[idx], ...wire };
                return next;
              });
            } else {
              void fetchMessages(selectedId, { silent: true });
            }
          }
          return;
        }

        if (isConversationUpdated(ev.type)) {
          fetchConversations(status, null, false);
          return;
        }

        if (isConversationPresenceUpdated(ev.type)) {
          const conversationId =
            typeof ev.data.conversationId === "string"
              ? ev.data.conversationId
              : "";
          if (!conversationId) return;
          const viewersRaw = Array.isArray(ev.data.viewers) ? ev.data.viewers : [];
          const viewerIds = viewersRaw
            .map((v) =>
              v && typeof v === "object" && typeof (v as { userId?: unknown }).userId === "string"
                ? (v as { userId: string }).userId
                : ""
            )
            .filter(Boolean);
          setViewersByConversation((prev) => {
            const cur = prev[conversationId];
            if (
              cur &&
              cur.length === viewerIds.length &&
              cur.every((id, i) => id === viewerIds[i])
            ) {
              return prev;
            }
            return { ...prev, [conversationId]: viewerIds };
          });
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

  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    const beat = async () => {
      try {
        await presenceApi.heartbeatConversationView(selectedId);
      } catch {
        // best effort only
      }
    };
    void beat();
    const timer = window.setInterval(() => {
      if (!cancelled) void beat();
    }, 15_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      void presenceApi.clearConversationView(selectedId).catch(() => { });
    };
  }, [selectedId]);

  const needsTemplateHeaderMedia = useMemo(
    () =>
      inboxTemplateVersionDetail != null &&
      isMediaHeaderType(inboxTemplateVersionDetail.headerType),
    [inboxTemplateVersionDetail]
  );

  const templateCarouselCardCount = useMemo(() => {
    if (inboxTemplateVersionDetail?.layoutType !== "CAROUSEL") return 0;
    const cards = inboxTemplateVersionDetail.carouselCards;
    return Array.isArray(cards) ? cards.length : 0;
  }, [inboxTemplateVersionDetail]);

  const templateMediaBindingsReady = useMemo(() => {
    if (!useTemplateSend || !selectedTemplateVersion?.id) return true;
    if (inboxTemplateVersionDetailLoading) return false;
    if (!inboxTemplateVersionDetail) return false;
    if (needsTemplateHeaderMedia && !templateHeaderMediaId?.trim()) {
      return false;
    }
    if (templateCarouselCardCount > 0) {
      if (templateCarouselMediaIds.length < templateCarouselCardCount) {
        return false;
      }
      for (let i = 0; i < templateCarouselCardCount; i++) {
        if (!templateCarouselMediaIds[i]?.trim()) return false;
      }
    }
    return true;
  }, [
    useTemplateSend,
    selectedTemplateVersion?.id,
    inboxTemplateVersionDetailLoading,
    inboxTemplateVersionDetail,
    needsTemplateHeaderMedia,
    templateHeaderMediaId,
    templateCarouselCardCount,
    templateCarouselMediaIds,
  ]);

  const templateVariablesPayload = useMemo(() => {
    const entries = templateVariables
      .map((row) => ({
        key: row.key.trim(),
        value: row.value.trim(),
      }))
      .filter((row) => row.key && row.value);
    const fromRows: Record<string, string> = entries.length
      ? Object.fromEntries(entries.map((row) => [row.key, row.value]))
      : {};
    const merged: Record<string, string> = { ...fromRows };

    if (
      inboxTemplateVersionDetail &&
      isMediaHeaderType(inboxTemplateVersionDetail.headerType) &&
      templateHeaderMediaId?.trim()
    ) {
      const ht = inboxTemplateVersionDetail.headerType;
      const id = templateHeaderMediaId.trim();
      if (ht === "IMAGE") merged.header_image = id;
      else if (ht === "VIDEO") merged.header_video = id;
      else if (ht === "DOCUMENT") merged.header_document = id;
    }

    if (
      inboxTemplateVersionDetail?.layoutType === "CAROUSEL" &&
      Array.isArray(inboxTemplateVersionDetail.carouselCards)
    ) {
      const cards = inboxTemplateVersionDetail.carouselCards as unknown[];
      cards.forEach((card, idx) => {
        const mid = templateCarouselMediaIds[idx]?.trim();
        if (!mid) return;
        const fmt = String(
          (card as { headerFormat?: string })?.headerFormat ?? "IMAGE"
        ).toUpperCase();
        const suffix =
          fmt === "VIDEO" ? "video" : fmt === "DOCUMENT" ? "document" : "image";
        merged[`card_${idx + 1}_header_${suffix}`] = mid;
      });
    }

    if (Object.keys(merged).length === 0) return undefined;
    return merged;
  }, [
    templateVariables,
    inboxTemplateVersionDetail,
    templateHeaderMediaId,
    templateCarouselMediaIds,
  ]);

  const templateVarsAreValid = useMemo(() => {
    if (!useTemplateSend) return true;
    if (!templateVariables.length) return true;
    return templateVariables.every(
      (row) => row.key.trim().length > 0 && row.value.trim().length > 0
    );
  }, [templateVariables, useTemplateSend]);

  const clearDraftForConversation = useCallback((conversationId: string) => {
    setDraftsByConversation((prev) => {
      if (!(conversationId in prev)) return prev;
      const next = { ...prev };
      delete next[conversationId];
      return next;
    });
  }, []);

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
        preserveStartContactSelectionRef.current = false;
        clearDraftForConversation(created.id);
        setDraft("");
        setSelectedId(created.id);
        setStartContact(null);
        await fetchMessages(created.id, { silent: true });
      }
    },
    [clearDraftForConversation, fetchMessages]
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

  const toggleSnooze = useCallback(async () => {
    if (!selectedConversation || conversationActionBusy) return;
    setConversationActionBusy(true);
    try {
      const isSnoozed =
        !!selectedConversation.snoozedUntil &&
        new Date(selectedConversation.snoozedUntil).getTime() > Date.now();
      if (isSnoozed) {
        await conversationsApi.unsnooze(selectedConversation.id);
      } else {
        const until = new Date(Date.now() + 60 * 60 * 1000).toISOString();
        await conversationsApi.snooze(selectedConversation.id, until);
      }
      await refreshConversationById(selectedConversation.id);
      await fetchConversations(status, null, false);
    } catch (error: unknown) {
      setMessageError(
        extractApiErrorMessage(error) || "Failed to update snooze state."
      );
    } finally {
      setConversationActionBusy(false);
    }
  }, [
    conversationActionBusy,
    fetchConversations,
    refreshConversationById,
    selectedConversation,
    status,
  ]);

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
      if (!selectedTemplateId || !selectedTemplateVersion?.id) {
        setMessageError("Select a WhatsApp template before sending.");
        return;
      }
      if (!templateVarsAreValid) {
        setMessageError("Fill all template variables before sending.");
        return;
      }
      if (!templateMediaBindingsReady) {
        setMessageError(
          "Upload required template media (header or carousel cards) before sending."
        );
        return;
      }
      if (selectedTemplateVersion.status !== "PROVIDER_APPROVED") {
        setMessageError("Selected WhatsApp template is not approved yet.");
        return;
      }
      setSending(true);
      try {
        await conversationsApi.sendMessage({
          contactId: activeContactId,
          channel: "WHATSAPP",
          channelTemplateVersionId: selectedTemplateVersion.id,
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
            .catch(() => { });
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
            .catch(() => { });
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
          .catch(() => { });
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

  const retryFailedLastMessage = useCallback(
    async (conversation: Conversation) => {
      const text = conversation.lastMessage?.text?.trim();
      if (!text) return;
      try {
        await conversationsApi.sendMessage({
          contactId: conversation.contactId,
          text,
          idempotencyKey:
            typeof crypto !== "undefined" ? crypto.randomUUID() : undefined,
          channel: conversation.channel,
        });
        await fetchConversations(status, null, false);
        if (selectedId === conversation.id) {
          await fetchMessages(conversation.id, { silent: true });
        }
      } catch (error: unknown) {
        setMessageError(extractApiErrorMessage(error) || "Failed to retry message.");
      }
    },
    [fetchConversations, fetchMessages, selectedId, status]
  );

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
      !!selectedTemplateVersion?.id &&
      selectedTemplateVersion.status === "PROVIDER_APPROVED" &&
      templateVarsAreValid &&
      templateMediaBindingsReady &&
      !templateBindingUploadBusy
      : (pendingMediaId &&
        pendingKind &&
        activeChannel === "WHATSAPP") ||
      (!!draft.trim() && !pendingMediaId));

  const showWhatsAppMediaTools =
    activeChannel === "WHATSAPP";

  const contactForDetails = useMemo(
    () =>
      selectedConversation?.contact
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
          : null,
    [selectedConversation, startContact]
  );

  const contactDetailsEl = useMemo(
    () =>
      !contactForDetails ? (
        <EmptyState
          title="No contact selected"
          description="Contact details appear when you open a conversation."
        />
      ) : (
        <div className="rounded-none bg-base-100 p-4 space-y-6">
          <div className="space-y-2">
            <p className="text-xs text-base-content/55">Name</p>
            <p className="text-sm text-base-content">
              {contactForDetails.name || "Unknown"}
            </p>
          </div>
          <div className="space-y-2">
            <p className="text-xs text-base-content/55">Phone</p>
            <p className="text-sm text-base-content">
              {contactForDetails.phone || "—"}
            </p>
          </div>
          <div className="space-y-2">
            <p className="text-xs text-base-content/55">Email</p>
            <p className="text-sm text-base-content">
              {contactForDetails.email || "—"}
            </p>
          </div>
          <div className="space-y-2">
            <p className="text-xs text-base-content/55">Status</p>
            <p className="text-sm text-base-content">
              {contactForDetails.status}
            </p>
          </div>
        </div>
      ),
    [contactForDetails]
  );

  const rightPanelContent = useMemo(
    () => (
      <div className="space-y-3">
        {contactDetailsEl}
        {selectedConversation ? (
          <>
            <div className="rounded-none bg-base-100 p-3 space-y-2">
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
                <div className="rounded-none p-2 text-xs space-y-1">
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
                        void fetchMessages(selectedConversation.id, {
                          silent: false,
                        });
                      }}
                    >
                      Refresh thread
                    </button>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="rounded-none bg-base-100 p-3 space-y-2">
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
                    <li
                      key={note.id}
                      className="rounded-none p-2"
                    >
                      <p className="text-xs">{note.content}</p>
                      <div className="mt-1 flex items-center justify-between text-xs text-base-content/60">
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
    ),
    [
      contactDetailsEl,
      conversationActionBusy,
      conversationNotes,
      createConversationNote,
      deleteConversationNote,
      fetchMessages,
      messageSearchBusy,
      messageSearchQuery,
      messageSearchResult,
      noteDraft,
      notesLoading,
      runMessageSearch,
      selectedConversation,
      selectedId,
    ]
  );

  useEffect(() => {
    setRightPanelContent({
      source: "inbox",
      title: "Contact",
      content: rightPanelContent,
      openAfter: false,
    });
  }, [rightPanelContent, setRightPanelContent]);

  /** Open panel when user selects a conversation or starts a chat with a contact (not on every panel content sync). */
  const detailSelectionKey =
    selectedConversation?.id ?? startContact?.id ?? null;
  useEffect(() => {
    if (!detailSelectionKey || !isXlUp) return;
    openRightPanel();
  }, [detailSelectionKey, openRightPanel, isXlUp]);

  useEffect(() => {
    return () => clearRightPanelContent("inbox");
  }, [clearRightPanelContent]);

  return (
    <>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden lg:grid lg:h-full lg:min-h-0 lg:grid-cols-[minmax(240px,1fr)_minmax(0,2.2fr)] lg:grid-rows-[minmax(0,1fr)] lg:items-stretch lg:gap-1">
        <div
          className={`flex min-h-0 flex-1 flex-col overflow-hidden rounded-none border border-base-content/15 bg-base-200 shadow-sm lg:min-h-0 lg:max-h-full ${!isLgUp && mobilePane === "thread" ? "hidden" : "flex"
            }`}
        >
          <div className="sticky top-0 z-10 flex h-14 shrink-0 items-center justify-between gap-2 border-b border-base-300 bg-base-200 px-3">
            <h2 className="truncate text-sm font-medium text-base-content/80">
              Conversation
            </h2>
            <div className="flex items-center gap-2">
              {listLoading && <span className="loading loading-spinner" />}
              <button
                type="button"
                className="btn btn-ghost btn-sm"
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
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-3 sm:p-4">
            <div className="shrink-0 space-y-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  className={`btn btn-xs ${queueFilter === "all" ? "btn-primary" : "btn-ghost"}`}
                  onClick={() => setQueueFilter("all")}
                >
                  All
                </button>
                <button
                  type="button"
                  className={`btn btn-xs ${queueFilter === "awaiting" ? "btn-primary" : "btn-ghost"}`}
                  onClick={() => setQueueFilter("awaiting")}
                >
                  Awaiting reply
                </button>
                <button
                  type="button"
                  className={`btn btn-xs ${queueFilter === "unread" ? "btn-primary" : "btn-ghost"}`}
                  onClick={() => setQueueFilter("unread")}
                >
                  Unread
                </button>
                <button
                  type="button"
                  className={`btn btn-xs ${queueFilter === "snoozed" ? "btn-primary" : "btn-ghost"}`}
                  onClick={() => setQueueFilter("snoozed")}
                >
                  Snoozed
                </button>
              </div>
              {mode !== "contactsQueue" ? (
                <div role="tablist" className="tabs tabs-box w-full rounded-none">
                  {STATUS_TABS.map((tab) => (
                    <button
                      key={tab}
                      role="tab"
                      className={`tab min-h-11 flex-1 sm:min-h-0 sm:flex-none ${status === tab ? "tab-active" : ""
                        }`}
                      onClick={() => setStatus(tab)}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            {listError ? (
              <div className="shrink-0 space-y-2">
                <ErrorState message={listError} />
                <button
                  type="button"
                  className="btn btn-outline btn-sm w-full"
                  onClick={() => fetchConversations(status, null, false)}
                >
                  Retry
                </button>
              </div>
            ) : null}

            {!listLoading && !conversations.length && !listError ? (
              <div className="shrink-0">
                <EmptyState
                  title="No conversations"
                  description="No conversations for this filter."
                />
              </div>
            ) : null}

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain pr-1">
              <ul className="space-y-1">
                {conversations.map((conversation) => {
                  const isActive = conversation.id === selectedId;
                  const hasUnread = (conversation.unreadCount ?? 0) > 0;
                  const isAwaitingReply = conversation.awaitingReply === true;
                  const isFailed =
                    conversation.lastMessage?.status === "FAILED" &&
                    conversation.lastMessage?.direction === "OUTBOUND";
                  const hasDraft = !!draftsByConversation[conversation.id]?.trim();
                  const title =
                    conversation.contact?.name ||
                    conversation.contact?.phone ||
                    conversation.contact?.email ||
                    "Unknown contact";
                  const subtitle = hasDraft
                    ? `Draft: ${draftsByConversation[conversation.id]}`
                    : lastMessagePreview(conversation.lastMessage);
                  return (
                    <li key={conversation.id}>
                      <button
                        type="button"
                        onClick={() => {
                          preserveStartContactSelectionRef.current = false;
                          setStartContact(null);
                          setSelectedId(conversation.id);
                          if (!isLgUp) setMobilePane("thread");
                        }}
                        className={`group flex min-h-14 w-full items-center gap-2 rounded-none px-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${isActive
                          ? "bg-primary/12"
                          : isAwaitingReply
                            ? "bg-base-100 hover:bg-base-300/40"
                            : "bg-base-100 hover:bg-base-300/35"
                          }`}
                      >
                        <ContactAvatar
                          name={conversation.contact?.name}
                          phone={conversation.contact?.phone}
                          avatarUrl={conversation.contact?.avatarUrl}
                          size="sm"
                          className="shrink-0"
                        />
                        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex min-w-0 items-center gap-2">
                              <span
                                className={`truncate text-sm ${hasUnread || isAwaitingReply
                                  ? "font-semibold text-base-content"
                                  : "text-base-content/85"
                                  }`}
                              >
                                {title}
                              </span>
                              {conversation.turn ? (
                                <span className="badge badge-outline badge-xs">
                                  {conversation.turn === "YOUR_TURN"
                                    ? "Your turn"
                                    : "Waiting"}
                                </span>
                              ) : null}
                              {isAwaitingReply ? (
                                <span className="badge badge-warning badge-xs">
                                  Awaiting reply
                                </span>
                              ) : null}
                              {hasDraft ? (
                                <span className="badge badge-info badge-xs">Draft</span>
                              ) : null}
                              {isFailed ? (
                                <span className="badge badge-error badge-xs">Failed</span>
                              ) : null}
                            </div>
                            <div className="flex shrink-0 items-center gap-1">
                              {hasUnread ? (
                                <span className="badge badge-primary badge-xs">
                                  {conversation.unreadCount}
                                </span>
                              ) : null}
                            </div>
                          </div>
                          <span
                            className={`truncate text-xs ${hasUnread || isAwaitingReply
                              ? "font-medium text-base-content/80"
                              : "text-base-content/55"
                              }`}
                          >
                            {subtitle}
                          </span>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <button
                type="button"
                className="btn btn-ghost btn-sm mt-2 w-full"
                onClick={() => fetchConversations(status, cursor, true)}
                disabled={!cursor || listLoading}
              >
                Load more
              </button>
            </div>
          </div>
        </div>

        <div
          className={`flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-none border border-base-content/15 bg-base-200 shadow-sm lg:min-h-0 lg:max-h-full ${!isLgUp && mobilePane === "list" ? "hidden" : "flex"
            }`}
        >
          <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center justify-between gap-2 border-b border-base-300 bg-base-200 px-3">
            <div className="flex min-h-0 min-w-0 flex-1 items-center gap-2">
              {!isLgUp ? (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm btn-square shrink-0"
                  aria-label="Back to conversations"
                  onClick={() => setMobilePane("list")}
                >
                  <ArrowBackRounded className="h-5 w-5" />
                </button>
              ) : null}
              <h2 className="truncate text-sm font-medium text-base-content/80">
                {selectedConversation
                  ? conversationTitle(selectedConversation)
                  : startContact
                    ? startContact.name ||
                      startContact.phone ||
                      startContact.email ||
                      "New chat"
                    : "Select a conversation"}
              </h2>
            </div>
            <div className="flex min-w-0 shrink-0 flex-wrap items-center justify-end gap-2">
              {selectedConversation ? (
                <>
                  {otherViewers.length > 0 ? (
                    <span className="hidden text-xs text-base-content/65 md:inline">
                      {otherViewers.slice(0, 2).join(", ")} is viewing this
                    </span>
                  ) : null}
                  <div className="hidden items-center gap-1 md:flex">
                    <button
                      type="button"
                      className="btn btn-xs btn-ghost"
                      onClick={() => runConversationAction("open")}
                      disabled={conversationActionBusy}
                    >
                      Open
                    </button>
                    {mode === "inbox" ? (
                      <>
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
                      </>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-xs btn-ghost"
                        onClick={toggleSnooze}
                        disabled={conversationActionBusy}
                      >
                        {selectedConversation.snoozedUntil &&
                          new Date(selectedConversation.snoozedUntil).getTime() > Date.now()
                          ? "Unsnooze"
                          : "Snooze 1h"}
                      </button>
                    )}
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
                  {selectedConversation.lastMessage?.status === "FAILED" &&
                    selectedConversation.lastMessage?.direction === "OUTBOUND" &&
                    selectedConversation.lastMessage?.text ? (
                    <button
                      type="button"
                      className="btn btn-xs btn-error"
                      onClick={() => void retryFailedLastMessage(selectedConversation)}
                      disabled={conversationActionBusy || sending}
                    >
                      Retry failed
                    </button>
                  ) : null}
                </>
              ) : null}
              {!isLgUp && selectedConversation ? (
                <button
                  type="button"
                  className="btn btn-ghost btn-square"
                  aria-label="Contact details"
                  onClick={() => contactDialogRef.current?.showModal()}
                >
                  <AccountCircleRounded className="h-6 w-6" />
                </button>
              ) : null}
              {messageLoading && <span className="loading loading-spinner" />}
            </div>
          </header>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-3 pb-3 pt-2 sm:px-4">
            {messageError ? (
              <div className="shrink-0 space-y-2">
                <ErrorState message={messageError} />
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() =>
                    selectedId && fetchMessages(selectedId, { silent: false })
                  }
                >
                  Retry
                </button>
              </div>
            ) : null}

            {!selectedConversation && !startContact ? (
              <div className="shrink-0">
                <EmptyState
                  title="Select a conversation"
                  description="Choose a conversation or start a new chat."
                />
              </div>
            ) : null}

            {!!(selectedConversation || startContact) && !messageLoading && !messages.length ? (
              <div className="shrink-0">
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

            <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col overflow-hidden pt-2">
              <div
                ref={messagesScrollRef}
                className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-y-contain pr-1"
              >
                {sortedMessages.map((message) => (
                  <MessageBubble
                    key={`${message.id}-${resolveMediaUrlForUi(message.mediaUrl ?? undefined) ?? ""}-${message.status ?? ""}`}
                    message={message}
                  />
                ))}
                <div aria-hidden className="h-px w-full shrink-0" />
              </div>

              <div className="mt-3 shrink-0 space-y-2 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]">
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
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-base-content/65">
                        Send mode
                      </span>
                      <div className="join">
                        <div
                          className={
                            freeChatPolicyTip
                              ? "tooltip tooltip-top join-item"
                              : "join-item"
                          }
                          {...(freeChatPolicyTip
                            ? { "data-tip": freeChatPolicyTip }
                            : {})}
                        >
                          <button
                            type="button"
                            className={`btn btn-xs w-full ${!useTemplateSend ? "btn-primary" : "btn-ghost"
                              }`}
                            disabled={sendPolicy?.templateRequired === true}
                            onClick={() => setUseTemplateSend(false)}
                            aria-label={
                              sendPolicy?.templateRequired
                                ? "Free chat unavailable: outside the customer-care window. Use a template."
                                : sendPolicy
                                  ? "Free chat: inside the customer-care window."
                                  : "Free chat"
                            }
                          >
                            Free chat
                          </button>
                        </div>
                        <button
                          type="button"
                          className={`btn btn-xs join-item ${useTemplateSend ? "btn-primary" : "btn-ghost"
                            }`}
                          onClick={() => setUseTemplateSend(true)}
                        >
                          Template
                        </button>
                      </div>
                    </div>
                    {useTemplateSend ? (
                      <div className="space-y-2 rounded-none bg-base-100 p-3">
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
                                : selectedTemplateVersion != null
                                  ? String(selectedTemplateVersion.version)
                                  : ""
                            }
                            readOnly
                            placeholder="Approved version"
                          />
                          <span>Version</span>
                        </label>
                        {selectedTemplateId && selectedTemplateVersion?.id ? (
                          <>
                            {inboxTemplateVersionDetailLoading ? (
                              <div className="flex items-center gap-2 text-sm text-base-content/70">
                                <span className="loading loading-spinner loading-sm" />
                                Loading template details…
                              </div>
                            ) : !inboxTemplateVersionDetail ? (
                              <div
                                role="alert"
                                className="alert alert-warning alert-soft py-2 text-sm"
                              >
                                Could not load template details. Try re-selecting the
                                template.
                              </div>
                            ) : (
                              <>
                                {needsTemplateHeaderMedia &&
                                  inboxTemplateVersionDetail.headerType ? (
                                  <div className="rounded-none bg-base-200/40 p-3">
                                    <p className="text-sm font-medium text-base-content">
                                      Header media (
                                      {inboxTemplateVersionDetail.headerType})
                                    </p>
                                    <p className="mt-1 text-xs text-base-content/60">
                                      WhatsApp requires media for this template
                                      header. Upload a file; it is prepared for this
                                      send only.
                                    </p>
                                    <div className="mt-2 flex flex-wrap items-center gap-2">
                                      <input
                                        type="file"
                                        className="file-input file-input-bordered file-input-sm w-full max-w-xs"
                                        accept={
                                          inboxTemplateVersionDetail.headerType ===
                                            "VIDEO"
                                            ? "video/mp4,video/3gpp"
                                            : inboxTemplateVersionDetail.headerType ===
                                              "DOCUMENT"
                                              ? "application/pdf,application/*"
                                              : "image/jpeg,image/png,image/webp,image/gif"
                                        }
                                        disabled={templateBindingUploadBusy}
                                        onChange={async (e) => {
                                          const file = e.target.files?.[0];
                                          e.target.value = "";
                                          if (!file) return;
                                          setTemplateBindingError(null);
                                          setTemplateBindingUploadBusy(true);
                                          try {
                                            const id =
                                              await uploadWhatsAppAttachmentIdAndPrepareWhatsApp(
                                                file
                                              );
                                            setTemplateHeaderMediaId(id);
                                          } catch (err: unknown) {
                                            setTemplateBindingError(
                                              extractApiErrorMessage(err) ||
                                              "Upload failed. Try a smaller file or supported format."
                                            );
                                          } finally {
                                            setTemplateBindingUploadBusy(false);
                                          }
                                        }}
                                      />
                                      {templateHeaderMediaId ? (
                                        <span className="badge badge-success badge-outline">
                                          Ready
                                        </span>
                                      ) : (
                                        <span className="text-xs text-warning">
                                          Required
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                ) : (
                                  <p className="text-xs text-base-content/55">
                                    This template has no media header (text or none
                                    only).
                                  </p>
                                )}

                                {templateCarouselCardCount > 0 ? (
                                  <div className="space-y-2">
                                    <p className="text-sm font-medium text-base-content">
                                      Carousel cards ({templateCarouselCardCount})
                                    </p>
                                    <p className="text-xs text-base-content/60">
                                      Each card needs header media for WhatsApp.
                                    </p>
                                    {Array.from(
                                      { length: templateCarouselCardCount },
                                      (_, idx) => {
                                        const card = (
                                          inboxTemplateVersionDetail
                                            .carouselCards as unknown[]
                                        )?.[idx];
                                        return (
                                          <div
                                            key={idx}
                                            className="rounded-none bg-base-100 p-3"
                                          >
                                            <p className="text-xs font-medium text-base-content/80">
                                              Card {idx + 1}
                                            </p>
                                            <input
                                              type="file"
                                              className="file-input file-input-bordered file-input-sm mt-2 w-full max-w-xs"
                                              accept={carouselCardFileAccept(card)}
                                              disabled={templateBindingUploadBusy}
                                              onChange={async (e) => {
                                                const file = e.target.files?.[0];
                                                e.target.value = "";
                                                if (!file) return;
                                                setTemplateBindingError(null);
                                                setTemplateBindingUploadBusy(true);
                                                try {
                                                  const id =
                                                    await uploadWhatsAppAttachmentIdAndPrepareWhatsApp(
                                                      file
                                                    );
                                                  setTemplateCarouselMediaIds(
                                                    (prev) => {
                                                      const next = [...prev];
                                                      next[idx] = id;
                                                      return next;
                                                    }
                                                  );
                                                } catch (err: unknown) {
                                                  setTemplateBindingError(
                                                    extractApiErrorMessage(err) ||
                                                    "Upload failed for this card."
                                                  );
                                                } finally {
                                                  setTemplateBindingUploadBusy(
                                                    false
                                                  );
                                                }
                                              }}
                                            />
                                            {templateCarouselMediaIds[idx] ? (
                                              <span className="mt-1 inline-block text-xs text-success">
                                                Uploaded
                                              </span>
                                            ) : null}
                                          </div>
                                        );
                                      }
                                    )}
                                  </div>
                                ) : null}

                                {templateBindingError ? (
                                  <div
                                    role="alert"
                                    className="alert alert-error text-sm py-2"
                                  >
                                    {templateBindingError}
                                  </div>
                                ) : null}
                              </>
                            )}
                          </>
                        ) : null}
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
                  <div className="flex items-start gap-3 rounded-none bg-base-200 p-3">
                    {pendingKind === "IMAGE" && pendingPreviewUrl ? (
                      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-none bg-base-300">
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
                      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-none bg-base-300">
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
                      <div className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-none bg-base-300 text-2xl">
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
                        className="btn btn-ghost btn-xs w-fit"
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
                      className="btn btn-ghost btn-square shrink-0"
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
                        className="btn btn-ghost btn-square btn-disabled cursor-not-allowed"
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
                    className="input input-bordered min-w-0 flex-1"
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
                    className="btn btn-primary min-w-[4.5rem] px-4 shrink-0 sm:min-w-0"
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
        </div>
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

          <label className="input input-bordered mb-3 w-full">
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
                      className="w-full rounded-none bg-base-100 px-3 py-2 text-left hover:bg-base-200"
                      onClick={() => {
                        setStatus("OPEN");
                        preserveStartContactSelectionRef.current = true;
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
