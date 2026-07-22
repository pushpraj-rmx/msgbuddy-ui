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
import { CircleUser, Bot, ArrowLeft, PlusCircle, SlidersHorizontal, MoreVertical, Phone, Mail, Search as SearchIcon, Image as ImageIcon, StickyNote, ExternalLink, ChevronLeft, ChevronRight, Tag as TagIcon, ArrowUpDown, Clock, X as XIcon } from "lucide-react";
import Picker from "@emoji-mart/react";
import emojiData from "@emoji-mart/data";
import { useVoiceRecorder } from "@/hooks/use-voice-recorder";
import {
  conversationsApi,
  contactsApi,
  presenceApi,
  workspaceApi,
  tagsApi,
  cannedResponsesApi,
  type CannedResponse,
  type WorkspaceMemberResponseDto,
  type ConversationSendPolicyDto,
  type WhatsAppOutboundMediaType,
} from "@/lib/api";
import type { Tag } from "@/lib/types";
import {
  CONTACT_LIFECYCLE_STAGES,
  type ContactLifecycleStage,
} from "@/lib/types";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { MessageBubble } from "@/components/inbox/MessageBubble";
import { MessageStatusIcon } from "@/components/inbox/MessageStatusIcon";
import { CreateTaskFromMessageModal } from "@/components/inbox/CreateTaskFromMessageModal";
import { InternalNotesPanel } from "@/components/inbox/InternalNotesPanel";
import { TasksPanel } from "@/components/inbox/TasksPanel";
import { DateSeparator, formatDateLabel, getDateKey } from "@/components/inbox/DateSeparator";
import { MediaGallery } from "@/components/inbox/MediaGallery";
import {
  classifyWhatsAppMediaKind,
  useInboxWhatsAppMediaUpload,
} from "@/hooks/use-inbox-whatsapp-media-upload";
import {
  type InboxMessage,
  type MessageReactionWire,
  isFailedMessage,
  collapseCampaignFailures,
} from "@/lib/messaging";
import { lastMessagePreview, reactionPreview, dbOrderBoundaryId } from "@/lib/inboxPreview";
import { ConversationSenderPicker } from "./ConversationSenderPicker";
import type { Contact } from "@/lib/types";
import { extractApiErrorMessage } from "@/lib/messageApiErrors";
import { resolveMediaUrlForUi } from "@/lib/mediaUrls";
import { roleHasWorkspacePermission } from "@/lib/workspace-role-permissions";
import { TemplateComposer, type TemplateComposerHandle } from "@/components/inbox/TemplateComposer";
import {
  isContactBulkUpdated,
  isContactUpdated,
  isConversationPresenceUpdated,
  isConversationUpdated,
  inboxMessageFromSseWire,
  isMessageCreated,
  isMessageReactionChanged,
  isMessageStatusUpdated,
  parseWorkspaceSseEvent,
} from "@/lib/sseEvents";
import { useMediaQuery, LG_MEDIA_QUERY } from "@/hooks/useMediaQuery";
import { ContactAvatar } from "@/components/ui/ContactAvatar";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useRightPanel } from "@/components/right-panel/useRightPanel";

export type Conversation = {
  id: string;
  contactId: string;
  channel: "WHATSAPP" | "TELEGRAM" | "EMAIL" | "SMS";
  status: "OPEN" | "CLOSED" | "ARCHIVED";
  awaitingReply?: boolean;
  turn?: "YOUR_TURN" | "WAITING_ON_CUSTOMER";
  snoozedUntil?: string | null;
  assignedUserId?: string | null;
  controlOwner?: "NONE" | "AI" | "HUMAN" | null;
  /** ChannelAccount the conversation currently sends from (WhatsApp). */
  channelAccountId?: string | null;
  unreadCount?: number;
  lastMessageAt?: string;
  /** When the OLDEST unanswered inbound landed in the current streak. Drives
   *  the WhatsApp 24-hour free-form-window countdown — null when we are not
   *  currently awaiting a reply. */
  firstInboundAwaitingReplyAt?: string | null;
  lastMessage?: {
    text?: string;
    type?: string;
    status?: string;
    direction?: "INBOUND" | "OUTBOUND";
    errorMessage?: string;
    failedAt?: string;
    createdAt?: string;
  };
  /** Most recent reaction in the conversation (reactions aren't messages, so
   *  they surface here). Shown in the preview when newer than lastMessage. */
  lastReactionEmoji?: string | null;
  lastReactionAt?: string | null;
  lastReactionByContact?: boolean | null;
  contact?: {
    id?: string;
    name?: string;
    phone?: string;
    email?: string;
    avatarUrl?: string | null;
    isOptedOut?: boolean;
    isBlocked?: boolean;
    lifecycleStage?:
      | "LEAD"
      | "ENGAGED"
      | "QUALIFIED"
      | "CUSTOMER"
      | "DORMANT"
      | "LOST"
      | null;
  };
  mode?: "solo" | "collaborative" | "queue";
  assignedUser?: {
    id?: string;
    name?: string | null;
    email?: string;
  } | null;
};


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
const SCROLL_BOTTOM_THRESHOLD = 80; // px from bottom to consider "at bottom"

const STATUS_TABS: Array<Conversation["status"]> = [
  "OPEN",
  "CLOSED",
  "ARCHIVED",
];

const STATUS_LABELS: Record<Conversation["status"], string> = {
  OPEN: "Open",
  CLOSED: "Closed",
  ARCHIVED: "Archived",
};

const LIFECYCLE_STAGE_LABELS: Record<ContactLifecycleStage, string> = {
  LEAD: "Lead",
  ENGAGED: "Engaged",
  QUALIFIED: "Qualified",
  CUSTOMER: "Customer",
  DORMANT: "Dormant",
  LOST: "Lost",
};

type ChannelFilter = "WHATSAPP" | "TELEGRAM" | "EMAIL" | "SMS";
const CHANNEL_OPTIONS: Array<{ value: ChannelFilter; label: string }> = [
  { value: "WHATSAPP", label: "WhatsApp" },
  { value: "TELEGRAM", label: "Telegram" },
  { value: "EMAIL", label: "Email" },
  { value: "SMS", label: "SMS" },
];

const LIMIT = 50;
/** Depth cap for live refreshes — beyond 4 loaded pages we refresh only this many. */
const MAX_REFRESH_DEPTH = 200;

/** Max visible lines for the reply box before scrolling (see useLayoutEffect on draft). */
const DRAFT_COMPOSER_MAX_LINES = 5;

function readInboxDraftsFromStorage(storageKey: string): Record<string, string> {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, string>;
    if (parsed && typeof parsed === "object") return parsed;
  } catch {
    // ignore
  }
  return {};
}

/** The true owner of a conversation, from the embedded assignee + controlOwner. */
function conversationOwnerInfo(conv: {
  assignedUserId?: string | null;
  controlOwner?: "NONE" | "AI" | "HUMAN" | null;
  assignedUser?: { name?: string | null; email?: string } | null;
}): { kind: "human" | "ai" | "unassigned"; label: string } {
  if (conv.assignedUserId)
    return {
      kind: "human",
      label:
        conv.assignedUser?.name || conv.assignedUser?.email || "Assigned agent",
    };
  if (conv.controlOwner === "AI") return { kind: "ai", label: "AI" };
  if (conv.controlOwner === "HUMAN")
    return { kind: "human", label: "With an agent" };
  return { kind: "unassigned", label: "Unassigned" };
}

export function InboxClient({
  initialConversations,
  workspaceId,
  currentUserId,
  meRole = "",
  mode = "inbox",
}: {
  initialConversations: Conversation[];
  workspaceId: string;
  currentUserId: string;
  meRole?: string;
  mode?: "inbox" | "contactsQueue";
}) {
  const draftsStorageKey = `inbox-drafts:${workspaceId}:${currentUserId}:${mode}`;
  const canSendMessages = roleHasWorkspacePermission(meRole, "messages.send");
  const canManageConversations = roleHasWorkspacePermission(meRole, "conversations.assign");
  const canClaimConversation = roleHasWorkspacePermission(meRole, "conversations.claim");
  const canReleaseConversation = roleHasWorkspacePermission(meRole, "conversations.release");
  const {
    setContent: setRightPanelContent,
    clearContent: clearRightPanelContent,
    open: openRightPanel,
  } = useRightPanel();
  const [status, setStatus] = useState<Conversation["status"]>("OPEN");
  const [sidebarView, setSidebarView] = useState<"conversations" | "starred" | "scheduled">("conversations");
  const [starredMessages, setStarredMessages] = useState<InboxMessage[]>([]);
  const [starredCursor, setStarredCursor] = useState<string | null>(null);
  const [starredLoading, setStarredLoading] = useState(false);
  const [scheduledMessages, setScheduledMessages] = useState<InboxMessage[]>([]);
  const [scheduledCursor, setScheduledCursor] = useState<string | null>(null);
  const [scheduledLoading, setScheduledLoading] = useState(false);
  /**
   * Conversation sort mode for the queue. Default newest-first; SLA-triage
   * mode (oldestUnreadFirst) floats unread conversations to the top ordered
   * by longest-waiting. Backend is `conversations.service.ts:list#sort`.
   */
  const [sortMode, setSortMode] = useState<
    "lastMessageAt" | "oldestUnreadFirst"
  >("lastMessageAt");
  const [queueFilter, setQueueFilter] = useState<
    "all" | "awaiting" | "unread" | "snoozed"
  >("all");
  const [channelFilter, setChannelFilter] = useState<ChannelFilter | null>(null);
  const [assigneeFilter, setAssigneeFilter] = useState<string | null>(null);
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [listSearch, setListSearch] = useState("");

  // Filter chip strip scroll arrows
  const chipStripRef = useRef<HTMLDivElement>(null);
  const [chipCanScrollLeft, setChipCanScrollLeft] = useState(false);
  const [chipCanScrollRight, setChipCanScrollRight] = useState(false);
  const updateChipScroll = useCallback(() => {
    const el = chipStripRef.current;
    if (!el) return;
    setChipCanScrollLeft(el.scrollLeft > 2);
    setChipCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  }, []);
  useEffect(() => {
    const el = chipStripRef.current;
    if (!el) return;
    updateChipScroll();
    el.addEventListener("scroll", updateChipScroll, { passive: true });
    const ro = new ResizeObserver(updateChipScroll);
    ro.observe(el);
    return () => { el.removeEventListener("scroll", updateChipScroll); ro.disconnect(); };
  }, [updateChipScroll]);
  const scrollChips = useCallback((dir: "left" | "right") => {
    const el = chipStripRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === "left" ? -160 : 160, behavior: "smooth" });
  }, []);
  const [showTagPanel, setShowTagPanel] = useState(false);
  const [tags, setTags] = useState<Tag[]>([]);
  const [conversations, setConversations] =
    useState<Conversation[]>(initialConversations);
  const [listError, setListError] = useState<string | null>(null);
  const [listLoading, setListLoading] = useState(false);
  const [cursor, setCursor] = useState<string | null>(
    initialConversations.length ? initialConversations.at(-1)?.id ?? null : null
  );
  const searchParams = useSearchParams();
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    const urlConversationId = searchParams.get("conversationId");
    if (urlConversationId) return urlConversationId;
    return initialConversations[0]?.id ?? null;
  });

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
  const [pendingImages, setPendingImages] = useState<{ file: File; previewUrl: string; mediaId: string | null }[]>([]);
  const [multiImageSendProgress, setMultiImageSendProgress] = useState<{ current: number; total: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const draftInputRef = useRef<HTMLTextAreaElement>(null);
  const scheduleInputRef = useRef<HTMLInputElement>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const voiceRecorder = useVoiceRecorder();
  const messagesScrollRef = useRef<HTMLDivElement>(null);
  /** After switching threads, jump to bottom once; after local send, smooth scroll. No auto-scroll on later SSE/poll. */
  const scrollThreadIntentRef = useRef<"none" | "auto" | "smooth">("none");
  /**
   * Last conversation id we finished loading messages for (success or failure).
   * Prevents consuming scroll intent while `messages` still belongs to a previous thread
   * (layout effects run before the fetch effect clears state and sets loading).
   */
  const messagesLoadedForConversationIdRef = useRef<string | null>(null);
  const isAtBottomRef = useRef(true);
  const unreadNewRef = useRef(0);
  const [unreadNewCount, setUnreadNewCount] = useState(0);
  const [pendingScrollMessageId, setPendingScrollMessageId] = useState<string | null>(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
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
  /** Imperative handle to the WhatsApp template picker (owns its own state). */
  const templateComposerRef = useRef<TemplateComposerHandle>(null);
  /** Mirrors the composer's "can send a template" predicate for `canSend`. */
  const [templateReady, setTemplateReady] = useState(false);
  const [conversationActionBusy, setConversationActionBusy] = useState(false);
  const [members, setMembers] = useState<WorkspaceMemberResponseDto[]>([]);
  const [assigneeUserId, setAssigneeUserId] = useState("");
  const [messageSearchQuery, setMessageSearchQuery] = useState("");
  const [messageSearchBusy, setMessageSearchBusy] = useState(false);
  const [messageSearchResult, setMessageSearchResult] = useState<InboxMessage | null>(
    null
  );
  const [pinnedMessages, setPinnedMessages] = useState<InboxMessage[]>([]);
  const [pinnedBannerExpanded, setPinnedBannerExpanded] = useState(true);
  const [messageMutationBusy, setMessageMutationBusy] = useState(false);
  const [scheduleAt, setScheduleAt] = useState<string>("");
  const [showSchedulePicker, setShowSchedulePicker] = useState(false);

  /** Format a Date as `YYYY-MM-DDTHH:mm` in the user's local timezone —
   *  the format an `<input type="datetime-local">` needs. `toISOString()`
   *  is UTC, which shifts the displayed time on every render and breaks
   *  presets like "Tomorrow 9 AM". */
  const toLocalInputValue = useCallback((d: Date): string => {
    const pad = (n: number) => String(n).padStart(2, "0");
    return (
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
      `T${pad(d.getHours())}:${pad(d.getMinutes())}`
    );
  }, []);

  /** Quick-pick presets — pickers alone make scheduling a chore. Mirrors
   *  Gmail/Slack "Send later" affordances; absolute hour targets respect
   *  the user's local clock. */
  const schedulePresets = useMemo(() => {
    const now = new Date();
    const inMinutes = (m: number) => {
      const d = new Date(now);
      d.setMinutes(d.getMinutes() + m);
      return d;
    };
    const tomorrowAt = (hour: number) => {
      const d = new Date(now);
      d.setDate(d.getDate() + 1);
      d.setHours(hour, 0, 0, 0);
      return d;
    };
    const nextWeekday = (targetDay: number, hour: number) => {
      // targetDay: 0=Sun, 1=Mon, … 6=Sat. Always picks the next occurrence,
      // skipping today even if today matches.
      const d = new Date(now);
      const diff = ((targetDay - d.getDay() + 7) % 7) || 7;
      d.setDate(d.getDate() + diff);
      d.setHours(hour, 0, 0, 0);
      return d;
    };
    return [
      { label: "+30 min", date: inMinutes(30) },
      { label: "+1 hour", date: inMinutes(60) },
      { label: "+2 hours", date: inMinutes(120) },
      { label: "Tomorrow 9 AM", date: tomorrowAt(9) },
      { label: "Tomorrow 6 PM", date: tomorrowAt(18) },
      { label: "Monday 9 AM", date: nextWeekday(1, 9) },
    ];
  }, [showSchedulePicker]); // recompute when reopened so "now" is fresh
  const [viewersByConversation, setViewersByConversation] = useState<
    Record<string, string[]>
  >({});
  const [draftsByConversation, setDraftsByConversation] = useState<
    Record<string, string>
  >(() =>
    typeof window === "undefined"
      ? {}
      : readInboxDraftsFromStorage(draftsStorageKey)
  );

  /**
   * Canned responses — loaded once per session. The composer triggers on
   * `/shortcut` and surfaces matching snippets in a popover.
   */
  const [cannedResponses, setCannedResponses] = useState<CannedResponse[]>([]);
  const [cannedSelectedIdx, setCannedSelectedIdx] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void cannedResponsesApi
      .list()
      .then((list) => {
        if (!cancelled) setCannedResponses(list);
      })
      .catch(() => {
        // non-fatal; suggestions just stay empty
      });
    return () => {
      cancelled = true;
    };
  }, []);

  //  const isLgUp = useMediaQuery("(min-width: 1024px)");
  const isLgUp = useMediaQuery(LG_MEDIA_QUERY);
  const [mobilePane, setMobilePane] = useState<"list" | "thread">("list");
  const handledHandoffKeyRef = useRef<string | null>(null);
  const preserveStartContactSelectionRef = useRef(false);
  /** Latest draft for blur / conversation-switch flush without re-rendering on every keystroke. */
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;
  /** Rows currently loaded — lets live refreshes preserve "Load more" depth. */
  const conversationsCountRef = useRef(conversations.length);
  conversationsCountRef.current = conversations.length;
  /** Mirrors `draftsByConversation` for synchronous merge when `selectedId` changes (avoids stale functional updater `prevMap`). */
  const draftsByConversationRef = useRef(draftsByConversation);
  draftsByConversationRef.current = draftsByConversation;
  /** Conversation id the reply box had when focused — blur may run after `selectedId` already changed. */
  const draftComposerConversationIdRef = useRef<string | null>(null);
  /** Previous `selectedId` for persisting the composer when switching threads. */
  const prevConversationIdForDraftRef = useRef<string | null>(null);
  const handoffContactId = searchParams.get("contactId");
  const handoffConversationId = searchParams.get("conversationId");
  const shouldFocusReply = searchParams.get("focus") === "reply";

  const selectedConversation = useMemo(
    () => conversations.find((c) => c.id === selectedId) ?? null,
    [conversations, selectedId]
  );
  const selectedViewers = useMemo(
    () => (selectedId ? viewersByConversation[selectedId] ?? [] : []),
    [selectedId, viewersByConversation]
  );
  const resolveUserLabel = useCallback(
    (userId: string | null | undefined) => {
      if (!userId) return null;
      if (userId === currentUserId) return "You";
      const member = members.find((m) => m.user?.id === userId);
      return member?.user?.name || member?.user?.email || userId;
    },
    [members, currentUserId]
  );
  const otherViewers = useMemo(
    () =>
      selectedViewers
        .filter((id) => id !== currentUserId)
        .map((id) => resolveUserLabel(id) || id),
    [selectedViewers, currentUserId, resolveUserLabel]
  );

  const isAgentRole = !canManageConversations && canSendMessages;

  const showTakeOverNotice = useMemo(() => {
    if (!isAgentRole) return false;
    if (!selectedConversation) return false;
    const convMode = selectedConversation.mode ?? "solo";
    if (convMode === "collaborative" || convMode === "queue") return false;
    const assignedTo = selectedConversation.assignedUserId;
    return !!assignedTo && assignedTo !== currentUserId;
  }, [isAgentRole, selectedConversation, currentUserId]);

  const assigneeName = useMemo(() => {
    if (!selectedConversation?.assignedUserId) return null;
    const embedded = selectedConversation.assignedUser;
    if (embedded?.name) return embedded.name;
    if (embedded?.email) return embedded.email;
    const member = members.find((m) => m.user?.id === selectedConversation.assignedUserId);
    return member?.user?.name || member?.user?.email || null;
  }, [selectedConversation?.assignedUserId, selectedConversation?.assignedUser, members]);
  // The TRUE owner of a conversation. `assignedUserId` alone is unreliable — a
  // chat can be unassigned yet still human-owned (controlOwner=HUMAN) and thus
  // muted to the bot. This reflects the real state so it's never ambiguous.
  const conversationOwner = useMemo<{
    kind: "human" | "ai" | "unassigned";
    label: string;
  } | null>(() => {
    if (!selectedConversation) return null;
    if (selectedConversation.assignedUserId)
      return { kind: "human", label: assigneeName ?? "Assigned agent" };
    if (selectedConversation.controlOwner === "AI")
      return { kind: "ai", label: "AI" };
    if (selectedConversation.controlOwner === "HUMAN")
      return { kind: "human", label: "With an agent" };
    return { kind: "unassigned", label: "Unassigned" };
  }, [selectedConversation, assigneeName]);
  const activeContactId =
    selectedConversation?.contactId ?? startContact?.id ?? null;
  const activeChannel =
    selectedConversation?.channel ?? (startContact ? "WHATSAPP" : null);

  const channelOption = channelFilter
    ? CHANNEL_OPTIONS.find((c) => c.value === channelFilter)
    : null;
  const inboxTitle = channelOption ? channelOption.label : 'Inbox';

  const activeTagCount = tagFilter.length;

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

  /** Outside the 24h WhatsApp window — only template sends; UI swaps the composer for template pickers. */
  const templateOnlyMode = sendPolicy?.templateRequired === true;

  /** Reload drafts when storage key changes (e.g. workspace switch). Initial load uses useState lazy init. */
  useEffect(() => {
    try {
      const parsed = readInboxDraftsFromStorage(draftsStorageKey);
      setDraftsByConversation(parsed);
      const sid = selectedIdRef.current;
      if (sid && parsed[sid] !== undefined) {
        setDraft(parsed[sid]!);
      }
    } catch {
      // ignore
    }
  }, [draftsStorageKey]);

  useEffect(() => {
    try {
      localStorage.setItem(draftsStorageKey, JSON.stringify(draftsByConversation));
    } catch {
      // ignore
    }
  }, [draftsByConversation, draftsStorageKey]);

  /** When switching threads: persist the previous thread's draft, then load the new one from the map. */
  useLayoutEffect(() => {
    const prevId = prevConversationIdForDraftRef.current;
    const merged = { ...draftsByConversationRef.current };

    if (prevId !== null && prevId !== selectedId) {
      const t = draftRef.current.trim();
      if (!t) {
        if (prevId in merged) delete merged[prevId];
      } else {
        merged[prevId] = draftRef.current;
      }
    }

    const load = selectedId ? (merged[selectedId] ?? "") : "";

    prevConversationIdForDraftRef.current = selectedId;
    draftComposerConversationIdRef.current = selectedId;
    draftsByConversationRef.current = merged;
    setDraftsByConversation(merged);
    setDraft(load);
  }, [selectedId]);

  const persistDraftToStorageMap = useCallback(() => {
    const convId =
      draftComposerConversationIdRef.current ?? selectedIdRef.current;
    if (!convId) return;
    setDraftsByConversation((prev) => {
      const text = draftRef.current.trim();
      if (!text) {
        if (!(convId in prev)) return prev;
        const next = { ...prev };
        delete next[convId];
        return next;
      }
      if (prev[convId] === draftRef.current) return prev;
      return { ...prev, [convId]: draftRef.current };
    });
  }, []);

  /** DaisyUI / browsers often ignore `field-sizing:content`; grow up to 5 lines then scroll. */
  useLayoutEffect(() => {
    const el = draftInputRef.current;
    if (!el) return;
    const styles = getComputedStyle(el);
    const fontSizePx = parseFloat(styles.fontSize);
    const parsedLh = parseFloat(styles.lineHeight);
    const line =
      Number.isFinite(parsedLh) && parsedLh > 0
        ? parsedLh
        : Number.isFinite(fontSizePx) && fontSizePx > 0
          ? fontSizePx * 1.375
          : 20;
    const padY =
      (parseFloat(styles.paddingTop) || 0) +
      (parseFloat(styles.paddingBottom) || 0);
    const maxH = line * DRAFT_COMPOSER_MAX_LINES + padY;

    el.style.maxHeight = `${maxH}px`;
    el.style.height = "0px";
    const next = Math.min(el.scrollHeight, maxH);
    el.style.height = `${next}px`;
  }, [draft, selectedId]);

  // Close emoji picker on outside click
  useEffect(() => {
    if (!showEmojiPicker) return;
    const handler = (e: MouseEvent) => {
      if (
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(e.target as Node)
      ) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showEmojiPicker]);

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
    void tagsApi.list().then(setTags).catch(() => setTags([]));
  }, []);

  useEffect(() => {
    setAssigneeUserId(selectedConversation?.assignedUserId ?? currentUserId);
  }, [currentUserId, selectedConversation?.assignedUserId, selectedId]);

  const sortedMessages = useMemo(
    () =>
      [...messages]
        // Scheduled messages never appear in the inline thread — they live
        // in the per-contact "scheduled" strip above the composer and join
        // the timeline only when they actually fire. Without this filter
        // the bubble shows up at the moment the agent created it, which
        // doesn't match what the recipient sees.
        .filter((m) => (m.status ?? "").toUpperCase() !== "SCHEDULED")
        .sort((a, b) => {
          if (a.createdAt && b.createdAt) {
            return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          }
          return a.id.localeCompare(b.id);
        }),
    [messages]
  );

  /**
   * Scheduled messages addressed to the currently-open conversation.
   * Reuses the workspace-wide `scheduledMessages` cache (already populated
   * by the sidebar) and filters client-side — the set is small (~per-user
   * scheduled volume) so server-side filtering isn't worth a new endpoint.
   */
  const scheduledForActiveContact = useMemo(() => {
    if (!selectedConversation) return [] as InboxMessage[];
    const cid = selectedConversation.contactId;
    return scheduledMessages
      .filter((m) => {
        const status = (m.status ?? "").toUpperCase();
        if (status !== "SCHEDULED") return false;
        // The wire shape on listScheduled includes `conversationId`; some
        // older payloads only carry contactId. Match either to be safe.
        const mAny = m as InboxMessage & { contactId?: string };
        return (
          m.conversationId === selectedConversation.id ||
          mAny.contactId === cid
        );
      })
      .sort((a, b) => {
        const aT = a.sendAt ? new Date(a.sendAt).getTime() : 0;
        const bT = b.sendAt ? new Date(b.sendAt).getTime() : 0;
        return aT - bT;
      });
  }, [scheduledMessages, selectedConversation]);

  const [showScheduledStrip, setShowScheduledStrip] = useState(false);

  /** Messages grouped by calendar date, in order. */
  const groupedMessages = useMemo(() => {
    const groups: { dateKey: string; dateLabel: string; messages: InboxMessage[] }[] = [];
    for (const msg of sortedMessages) {
      const key = getDateKey(msg.createdAt);
      const last = groups[groups.length - 1];
      if (last && last.dateKey === key) {
        last.messages.push(msg);
      } else {
        groups.push({ dateKey: key, dateLabel: formatDateLabel(msg.createdAt), messages: [msg] });
      }
    }
    return groups;
  }, [sortedMessages]);

  /**
   * Per-group render items with campaign delivery failures collapsed into a
   * single summary line (see collapseCampaignFailures). Keeps the bubble stream
   * free of the red-failure spam a broad campaign otherwise leaves in every
   * recipient's chat, while manual send failures still render inline.
   */
  const groupedTimeline = useMemo(
    () =>
      groupedMessages.map((group) => ({
        dateKey: group.dateKey,
        dateLabel: group.dateLabel,
        items: collapseCampaignFailures(group.messages),
      })),
    [groupedMessages]
  );

  /** Campaign-failure summary lines the agent has expanded to inspect. */
  const [expandedFailureGroups, setExpandedFailureGroups] = useState<Set<string>>(
    () => new Set()
  );
  const toggleFailureGroup = useCallback((id: string) => {
    setExpandedFailureGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

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
    isAtBottomRef.current = true;
    unreadNewRef.current = 0;
    setUnreadNewCount(0);
    messagesLoadedForConversationIdRef.current = null;
  }, [selectedId]);

  useLayoutEffect(() => {
    if (!selectedId || messageLoading) return;

    if (messagesLoadedForConversationIdRef.current !== selectedId) {
      // Still showing another thread's messages, or fetch not finished — keep scroll intent.
      return;
    }

    const container = messagesScrollRef.current;
    const scrollToBottom = (behavior: ScrollBehavior) => {
      if (!container) return;
      container.scrollTo({ top: container.scrollHeight, behavior });
    };

    const intent = scrollThreadIntentRef.current;

    if (!sortedMessages.length) {
      if (intent === "auto") {
        scrollThreadIntentRef.current = "none";
        if (container) {
          container.scrollTo({ top: 0, behavior: "auto" });
        }
        // Read state is now driven by the 1s focus+visibility dwell effect
        // below — not by conversation open. Avoids the "clicked a notification
        // by accident" false-read and lets us defer the WhatsApp blue-tick.
      }
      return;
    }

    if (!container) {
      return;
    }

    if (intent === "auto") {
      scrollThreadIntentRef.current = "none";
      if (!pendingScrollMessageId) scrollToBottom("auto");
      return;
    }
    if (intent === "smooth") {
      scrollThreadIntentRef.current = "none";
      if (!pendingScrollMessageId) requestAnimationFrame(() => scrollToBottom("smooth"));
      return;
    }
  }, [selectedId, sortedMessages, messageLoading, pendingScrollMessageId]);

  /**
   * Tracks PUTs in flight so a flurry of SSE-driven list refreshes can't
   * trigger duplicate PUTs (= duplicate WhatsApp blue-ticks to Meta) before
   * the first one returns and zeroes unreadCount in our local state.
   */
  const readInFlightRef = useRef<Set<string>>(new Set());

  /**
   * Mark conversation as read the moment the user opens it AND any time it
   * gains unread messages while open. Clicking / new-message arrival is the
   * engagement signal — the earlier "1s dwell + focus + visibility" gate was
   * meant to defend against skim-clicks but in practice made the badge feel
   * broken (slow / overwritten by a racing SSE refetch).
   *
   * Re-runs on every conversations-array change so SSE-driven unread bumps
   * on the OPEN conversation get auto-cleared. Bails cheaply when there's
   * nothing to mark.
   */
  useEffect(() => {
    if (!selectedId) return;
    const conv = conversations.find((c) => c.id === selectedId);
    if (!conv || (conv.unreadCount ?? 0) === 0) return;
    if (readInFlightRef.current.has(selectedId)) return;

    readInFlightRef.current.add(selectedId);

    // Optimistic — badge disappears immediately.
    setConversations((prev) =>
      prev.map((c) =>
        c.id === selectedId ? { ...c, unreadCount: 0 } : c,
      ),
    );

    void conversationsApi
      .read(selectedId)
      .catch(() => {
        // If the PUT failed, the next list refresh will resync unreadCount
        // from the server, and this effect will retry naturally.
      })
      .finally(() => {
        readInFlightRef.current.delete(selectedId);
      });
  }, [selectedId, conversations]);

  useEffect(() => {
    const container = messagesScrollRef.current;
    if (!container || !selectedId) return;

    const onScroll = () => {
      const atBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight <
        SCROLL_BOTTOM_THRESHOLD;
      const wasAtBottom = isAtBottomRef.current;
      isAtBottomRef.current = atBottom;

      if (atBottom && !wasAtBottom) {
        unreadNewRef.current = 0;
        setUnreadNewCount(0);
        void conversationsApi.read(selectedId).catch(() => { });
        setConversations((prev) =>
          prev.map((c) => (c.id === selectedId ? { ...c, unreadCount: 0 } : c))
        );
      }
    };

    container.addEventListener("scroll", onScroll, { passive: true });
    return () => container.removeEventListener("scroll", onScroll);
  }, [selectedId]);

  useEffect(() => {
    if (!pendingScrollMessageId) return;
    const container = messagesScrollRef.current;
    if (!container) return;
    if (!messages.some((m) => m.id === pendingScrollMessageId)) return;
    const raf = requestAnimationFrame(() => {
      const el = container.querySelector<HTMLElement>(
        `[data-message-id="${pendingScrollMessageId}"]`,
      );
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlightedMessageId(pendingScrollMessageId);
      setPendingScrollMessageId(null);
    });
    return () => cancelAnimationFrame(raf);
  }, [messages, pendingScrollMessageId]);

  useEffect(() => {
    if (!highlightedMessageId) return;
    const timer = window.setTimeout(() => setHighlightedMessageId(null), 1800);
    return () => window.clearTimeout(timer);
  }, [highlightedMessageId]);

  useEffect(() => {
    mediaUpload.cancel();
    setPendingMediaId(null);
    clearPendingMediaPreview();
    setPendingImages((prev) => {
      prev.forEach((img) => URL.revokeObjectURL(img.previewUrl));
      return [];
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: mediaUpload excluded to prevent cleanup loop
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
    // Template picker state resets itself via its own contactId-keyed effect.
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

  useEffect(() => {
    if (!useTemplateSend) return;
    mediaUpload.cancel();
    setPendingMediaId(null);
    clearPendingMediaPreview();
    setPendingImages((prev) => {
      prev.forEach((img) => URL.revokeObjectURL(img.previewUrl));
      return [];
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: mediaUpload.cancel is unstable method ref
  }, [useTemplateSend, clearPendingMediaPreview, mediaUpload.cancel]);

  const fetchConversations = useCallback(async (
    nextStatus = status,
    nextCursor?: string | null,
    append = false,
    /** Refetch this many rows instead of one page (depth-preserving refresh). */
    overrideLimit?: number
  ) => {
    const requestedLimit = overrideLimit ?? LIMIT;
    setListLoading(true);
    setListError(null);
    try {
      const queueFilterParams = {
        unreadOnly: queueFilter === "unread",
        awaitingReplyOnly: queueFilter === "awaiting",
        snoozedOnly: queueFilter === "snoozed",
        includeSnoozed: queueFilter === "all",
      };
      const extraFilters = {
        ...(channelFilter && { channel: channelFilter }),
        ...(assigneeFilter === "__unassigned__"
          ? { unassignedOnly: true }
          : assigneeFilter
            ? { assignedUserId: assigneeFilter }
            : {}),
        ...(tagFilter.length > 0 && { tagIds: tagFilter.join(",") }),
        ...(listSearch.trim() && { search: listSearch.trim() }),
      };
      const params =
        mode === "contactsQueue"
          ? {
            status: "OPEN" as const,
            limit: requestedLimit,
            cursor: nextCursor || undefined,
            ...queueFilterParams,
            ...extraFilters,
            sort: sortMode,
          }
          : {
            status: nextStatus,
            limit: requestedLimit,
            cursor: nextCursor || undefined,
            ...queueFilterParams,
            ...extraFilters,
            sort: sortMode,
          };

      const data = (await conversationsApi.list(params)) as Conversation[];
      setConversations((prev) => {
        if (append) return [...prev, ...data];
        // Preserve the handoff conversation (added by applyHandoff) if it's
        // currently selected but not present in the fresh page of results.
        const currentSelectedId = selectedIdRef.current;
        if (currentSelectedId && !data.some((c) => c.id === currentSelectedId)) {
          const kept = prev.find((c) => c.id === currentSelectedId);
          if (kept) return [kept, ...data];
        }
        return data;
      });
      // Only offer "Load more" when a FULL page came back — a partial page is
      // the last page. Setting a cursor whenever data.length > 0 left the button
      // enabled for any small result set (e.g. the Awaiting/Unread/Snoozed
      // filters), where clicking it just fetched an empty next page.
      //
      // Use the page's true DB-order boundary (not data.at(-1)): under the
      // oldestUnreadFirst sort the server re-sorts the page for display, so the
      // last array item is a mid-order row and paging from it skips/repeats.
      setCursor(data.length === requestedLimit ? dbOrderBoundaryId(data) : null);
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
  }, [mode, queueFilter, status, channelFilter, assigneeFilter, tagFilter, listSearch, sortMode]);

  /**
   * Depth-preserving list refresh for live (SSE) and post-action updates.
   * Refetches as many rows as are currently loaded (whole pages, capped) so a
   * workspace event doesn't collapse "Load more" progress back to page 1 —
   * that reset made Awaiting-tab paging look broken: every message/receipt in
   * the workspace threw away the loaded pages and the cursor seconds after
   * each click.
   */
  const refreshConversations = useCallback(async () => {
    const depth = Math.min(
      Math.max(Math.ceil(conversationsCountRef.current / LIMIT), 1) * LIMIT,
      MAX_REFRESH_DEPTH,
    );
    await fetchConversations(status, null, false, depth);
  }, [fetchConversations, status]);

  /** Debounced refresh for SSE bursts (a webhook batch fires many events at once). */
  const listRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleListRefresh = useCallback(() => {
    if (listRefreshTimerRef.current) clearTimeout(listRefreshTimerRef.current);
    listRefreshTimerRef.current = setTimeout(() => {
      listRefreshTimerRef.current = null;
      void refreshConversations();
    }, 400);
  }, [refreshConversations]);
  // Cancel any pending refresh when the list identity (filter/status/sort)
  // changes — a stale timer would refetch with the OLD filter and clobber the
  // fresh page-1 the filter-change effect just loaded. Also covers unmount.
  useEffect(() => () => {
    if (listRefreshTimerRef.current) {
      clearTimeout(listRefreshTimerRef.current);
      listRefreshTimerRef.current = null;
    }
  }, [scheduleListRefresh]);

  const fetchStarredMessages = useCallback(async (nextCursor?: string | null, append = false) => {
    setStarredLoading(true);
    try {
      const data = await conversationsApi.listStarred(nextCursor ?? undefined, LIMIT);
      setStarredMessages((prev) => (append ? [...prev, ...data.messages] : data.messages));
      setStarredCursor(data.nextCursor);
    } catch {
      // silent — starred is a secondary view
    } finally {
      setStarredLoading(false);
    }
  }, []);

  const fetchScheduledMessages = useCallback(async (nextCursor?: string | null, append = false) => {
    setScheduledLoading(true);
    try {
      const data = await conversationsApi.listScheduled(nextCursor ?? undefined, LIMIT);
      setScheduledMessages((prev) => (append ? [...prev, ...data.messages] : data.messages));
      setScheduledCursor(data.nextCursor);
    } catch {
      // silent
    } finally {
      setScheduledLoading(false);
    }
  }, []);

  const handleCancelScheduled = useCallback(async (messageId: string) => {
    try {
      await conversationsApi.cancelScheduledMessage(messageId);
      setScheduledMessages((prev) => prev.filter((m) => m.id !== messageId));
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    if (sidebarView === "starred") void fetchStarredMessages();
    if (sidebarView === "scheduled") void fetchScheduledMessages();
  }, [sidebarView, fetchStarredMessages, fetchScheduledMessages]);

  /** Fetch scheduled once on mount so the per-contact strip can hydrate
   *  immediately when the user opens any conversation — without requiring
   *  them to first open the global "Scheduled" sidebar. */
  useEffect(() => {
    void fetchScheduledMessages();
  }, [fetchScheduledMessages]);

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
        // The user may have switched conversations while this request was in
        // flight. A late response must not render under the now-selected thread
        // (wrong messages under the wrong header/composer).
        if (conversationId !== selectedIdRef.current) {
          return;
        }
        setMessages((prev) => {
          if (
            silent &&
            prev.length === data.length &&
            prev.every(
              (m, i) => m.id === data[i].id && m.status === data[i].status
            )
          ) {
            return prev;
          }
          return data;
        });
      } catch (error: unknown) {
        if (!silent && conversationId === selectedIdRef.current) {
          setMessageError(extractApiErrorMessage(error) || "Failed to load messages.");
        }
      } finally {
        if (!silent) {
          setMessageLoading(false);
        }
        if (conversationId === selectedIdRef.current) {
          messagesLoadedForConversationIdRef.current = conversationId;
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

  const loadPinnedMessages = useCallback(async (conversationId: string) => {
    try {
      const rows = (await conversationsApi.getPinnedMessages(conversationId)) as InboxMessage[];
      setPinnedMessages(rows ?? []);
    } catch {
      setPinnedMessages([]);
    }
  }, []);

  const handlePinMessage = useCallback(async (msg: InboxMessage) => {
    if (messageMutationBusy) return;
    setMessageMutationBusy(true);
    try {
      if (msg.isPinned) {
        await conversationsApi.unpinMessage(msg.id);
      } else {
        await conversationsApi.pinMessage(msg.id);
      }
      // Optimistically update local message state
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msg.id
            ? { ...m, isPinned: !m.isPinned, pinnedAt: m.isPinned ? null : new Date().toISOString() }
            : m
        )
      );
      if (selectedId) void loadPinnedMessages(selectedId);
    } catch (err: unknown) {
      setMessageError(extractApiErrorMessage(err) || "Failed to pin message.");
    } finally {
      setMessageMutationBusy(false);
    }
  }, [messageMutationBusy, selectedId, loadPinnedMessages]);

  const handleStarMessage = useCallback(async (msg: InboxMessage) => {
    if (messageMutationBusy) return;
    setMessageMutationBusy(true);
    try {
      if (msg.isStarred) {
        await conversationsApi.unstarMessage(msg.id);
      } else {
        await conversationsApi.starMessage(msg.id);
      }
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msg.id
            ? { ...m, isStarred: !m.isStarred, starredAt: m.isStarred ? null : new Date().toISOString() }
            : m
        )
      );
    } catch (err: unknown) {
      setMessageError(extractApiErrorMessage(err) || "Failed to star message.");
    } finally {
      setMessageMutationBusy(false);
    }
  }, [messageMutationBusy]);

  /**
   * Send / change a reaction. Optimistic local update first (immediate
   * feedback even on a slow link); the server response replaces the
   * optimistic set with the canonical reaction list, and the SSE
   * MESSAGE_REACTION_CHANGED handler reconciles for other connected agents.
   */
  const handleReactToMessage = useCallback(
    async (msg: InboxMessage, emoji: string) => {
      const optimistic: InboxMessage["reactions"] = (() => {
        const existing = msg.reactions ?? [];
        const mine = existing.find((r) => r.actorUserId === currentUserId);
        const now = new Date().toISOString();
        if (mine) {
          return existing.map((r) =>
            r.actorUserId === currentUserId
              ? { ...r, emoji, updatedAt: now }
              : r,
          );
        }
        return [
          ...existing,
          {
            id: `optimistic-${msg.id}`,
            emoji,
            actorContactId: null,
            actorUserId: currentUserId ?? null,
            createdAt: now,
            updatedAt: now,
          },
        ];
      })();
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msg.id ? { ...m, reactions: optimistic } : m,
        ),
      );
      try {
        const fresh = await conversationsApi.reactToMessage(msg.id, emoji);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === msg.id ? { ...m, reactions: fresh } : m,
          ),
        );
      } catch (err: unknown) {
        setMessageError(extractApiErrorMessage(err) || "Failed to react.");
      }
    },
    [currentUserId],
  );

  const handleUnreactToMessage = useCallback(
    async (msg: InboxMessage) => {
      const stripped =
        (msg.reactions ?? []).filter((r) => r.actorUserId !== currentUserId);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msg.id ? { ...m, reactions: stripped } : m,
        ),
      );
      try {
        const fresh = await conversationsApi.unreactToMessage(msg.id);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === msg.id ? { ...m, reactions: fresh } : m,
          ),
        );
      } catch (err: unknown) {
        setMessageError(
          extractApiErrorMessage(err) || "Failed to remove reaction.",
        );
      }
    },
    [currentUserId],
  );

  const [retryingMessageIds, setRetryingMessageIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [discardingMessageIds, setDiscardingMessageIds] = useState<Set<string>>(
    () => new Set(),
  );
  // The message the agent right-clicked to seed the Create-task modal. Null
  // when modal is closed.
  const [createTaskFor, setCreateTaskFor] = useState<InboxMessage | null>(null);

  const handleOpenCreateTaskForMessage = useCallback((msg: InboxMessage) => {
    setCreateTaskFor(msg);
  }, []);

  const handleRetryFailedMessage = useCallback(
    async (msg: InboxMessage) => {
      if (retryingMessageIds.has(msg.id)) return;
      setRetryingMessageIds((prev) => {
        const next = new Set(prev);
        next.add(msg.id);
        return next;
      });
      try {
        const updated = await conversationsApi.retryFailedMessage(msg.id);
        // Server returns the updated row (status QUEUED, error fields cleared);
        // SSE will surface subsequent status transitions.
        setMessages((prev) =>
          prev.map((m) => (m.id === msg.id ? { ...m, ...updated } : m)),
        );
        setMessageError(null);
      } catch (err: unknown) {
        setMessageError(
          extractApiErrorMessage(err) || "Failed to retry message.",
        );
      } finally {
        setRetryingMessageIds((prev) => {
          const next = new Set(prev);
          next.delete(msg.id);
          return next;
        });
      }
    },
    [retryingMessageIds],
  );

  const handleDiscardFailedMessage = useCallback(
    async (msg: InboxMessage) => {
      if (discardingMessageIds.has(msg.id)) return;
      setDiscardingMessageIds((prev) => {
        const next = new Set(prev);
        next.add(msg.id);
        return next;
      });
      // Optimistically remove from the timeline; rollback on error.
      const snapshot = msg;
      setMessages((prev) => prev.filter((m) => m.id !== msg.id));
      try {
        await conversationsApi.discardFailedMessage(msg.id);
        setMessageError(null);
      } catch (err: unknown) {
        // Re-insert at the original position (best-effort: append + re-sort
        // by createdAt would be ideal, but the original ordering is by
        // createdAt asc, so push-then-sort is correct).
        setMessages((prev) => {
          if (prev.some((m) => m.id === snapshot.id)) return prev;
          const next = [...prev, snapshot];
          next.sort(
            (a, b) =>
              new Date(a.createdAt ?? 0).getTime() -
              new Date(b.createdAt ?? 0).getTime(),
          );
          return next;
        });
        setMessageError(
          extractApiErrorMessage(err) || "Failed to discard message.",
        );
      } finally {
        setDiscardingMessageIds((prev) => {
          const next = new Set(prev);
          next.delete(msg.id);
          return next;
        });
      }
    },
    [discardingMessageIds],
  );

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
      setSidebarView("conversations");
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
      setPinnedMessages([]);
      void fetchMessages(selectedId);
      void loadPinnedMessages(selectedId);
      // If selectedId is set (e.g. from URL param) but the conversation object
      // isn’t in the list yet, eagerly fetch and upsert it so the thread panel
      // renders the header, contact info, and reply box.
      const alreadyInList = conversations.some((c) => c.id === selectedId);
      if (!alreadyInList) {
        void conversationsApi.getById(selectedId).then((conv) => {
          const conversation = conv as Conversation;
          setConversations((prev) => {
            if (prev.some((c) => c.id === conversation.id)) return prev;
            return [conversation, ...prev];
          });
        }).catch(() => { /* conversation may have been deleted */ });
      }
      window.setTimeout(() => {
        draftInputRef.current?.focus({ preventScroll: true });
      }, 0);
    } else {
      setMessages([]);
      setPinnedMessages([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchMessages, loadPinnedMessages, selectedId]);

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
          scheduleListRefresh();
          const convId =
            typeof ev.data.conversationId === "string" ? ev.data.conversationId : "";
          if (selectedId && convId === selectedId) {
            const wire = inboxMessageFromSseWire(ev.data.message);
            if (wire) {
              // Customer replied → 24h window re-opens; drop the template-required UI.
              if (wire.direction === "INBOUND") {
                setSendPolicy((prev) =>
                  prev?.templateRequired ? { ...prev, templateRequired: false } : prev
                );
                setUseTemplateSend(false);
              }
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
              // Only for genuinely new messages (not status patches)
              const isNew = !wire.status || wire.direction === "INBOUND" || wire.status === "PENDING";
              if (isNew) {
                if (isAtBottomRef.current) {
                  requestAnimationFrame(() => {
                    const container = messagesScrollRef.current;
                    container?.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
                  });
                  void conversationsApi.read(selectedId).catch(() => { });
                  setConversations((prev) =>
                    prev.map((c) => (c.id === selectedId ? { ...c, unreadCount: 0 } : c))
                  );
                } else {
                  unreadNewRef.current += 1;
                  setUnreadNewCount(unreadNewRef.current);
                }
              }
            } else {
              void fetchMessages(selectedId, { silent: true });
            }
          }
          return;
        }

        if (isMessageReactionChanged(ev.type)) {
          const convId =
            typeof ev.data.conversationId === "string" ? ev.data.conversationId : "";
          const reactions: MessageReactionWire[] = Array.isArray(ev.data.reactions)
            ? (ev.data.reactions as MessageReactionWire[])
            : [];
          if (selectedId && convId === selectedId) {
            const messageId =
              typeof ev.data.messageId === "string" ? ev.data.messageId : "";
            if (messageId) {
              setMessages((prev) => {
                const idx = prev.findIndex((m) => m.id === messageId);
                if (idx < 0) return prev;
                const next = [...prev];
                next[idx] = { ...next[idx], reactions };
                return next;
              });
            }
          }
          // Patch the conversation-list preview for ANY conversation (not just
          // the open one) so "Reacted 👍" appears/updates live. Uses this
          // message's latest reaction as the conversation's latest — the next
          // list fetch reconciles the rare cross-message case.
          if (convId) {
            const latest = reactions.reduce<MessageReactionWire | null>(
              (acc, r) => {
                if (!acc) return r;
                const t = new Date(r.updatedAt ?? r.createdAt).getTime();
                const accT = new Date(acc.updatedAt ?? acc.createdAt).getTime();
                return t >= accT ? r : acc;
              },
              null,
            );
            setConversations((prev) =>
              prev.map((c) =>
                c.id === convId
                  ? {
                      ...c,
                      lastReactionEmoji: latest ? latest.emoji : null,
                      lastReactionAt: latest
                        ? (latest.updatedAt ?? latest.createdAt)
                        : null,
                      lastReactionByContact: latest
                        ? latest.actorContactId != null
                        : null,
                    }
                  : c,
              ),
            );
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
          // Keep the per-contact "scheduled" strip in sync when a scheduled
          // message transitions to a real status (QUEUED/SENT/etc.) or is
          // cancelled — prune by id when the new status isn't SCHEDULED.
          const updatedMsg = inboxMessageFromSseWire(ev.data.message);
          if (updatedMsg?.id) {
            const nextStatus = (updatedMsg.status ?? "").toUpperCase();
            if (nextStatus && nextStatus !== "SCHEDULED") {
              setScheduledMessages((prev) =>
                prev.filter((m) => m.id !== updatedMsg.id),
              );
            }
          }
          return;
        }

        if (isConversationUpdated(ev.type)) {
          scheduleListRefresh();
          const updatedId = typeof ev.data?.conversationId === "string" ? ev.data.conversationId : "";
          if (updatedId && updatedId === selectedIdRef.current) {
            void refreshConversationById(updatedId);
          }
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
          scheduleListRefresh();
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
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: refreshConversationById excluded to prevent SSE re-subscribe on every conversation change
  }, [scheduleListRefresh, fetchMessages, selectedId, status, workspaceId]);

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
      // Unfiltered OPEN page only to FIND the (possibly new) conversation —
      // the visible list refresh must keep the active filters and loaded depth.
      const refreshed = (await conversationsApi.list({
        status: "OPEN",
        limit: LIMIT,
      })) as Conversation[];
      const created =
        refreshed.find(
          (c) => c.contactId === contactId && c.channel === channel
        ) ?? null;
      await refreshConversations();
      if (created) {
        // Active filter may exclude the just-sent thread (e.g. Awaiting after a
        // reply) — keep it visible at the top so selection doesn't dead-end.
        setConversations((prev) =>
          prev.some((c) => c.id === created.id) ? prev : [created, ...prev]
        );
        preserveStartContactSelectionRef.current = false;
        clearDraftForConversation(created.id);
        setDraft("");
        setSelectedId(created.id);
        setStartContact(null);
        await fetchMessages(created.id, { silent: true });
      }
    },
    [clearDraftForConversation, fetchMessages, refreshConversations]
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
        | "claim"
        | "release"
        | "resetAi"
        | "handoffAi",
      payload?: { userId?: string; conversationId?: string }
    ) => {
      const targetId = payload?.conversationId ?? selectedId;
      if (!targetId || conversationActionBusy) return;
      setConversationActionBusy(true);
      try {
        if (operation === "open") await conversationsApi.open(targetId);
        if (operation === "close") await conversationsApi.close(targetId);
        if (operation === "archive") await conversationsApi.archive(targetId);
        if (operation === "read") await conversationsApi.read(targetId);
        if (operation === "assign" && payload?.userId) {
          await conversationsApi.assign(targetId, payload.userId);
        }
        if (operation === "unassign") await conversationsApi.unassign(targetId);
        if (operation === "claim") await conversationsApi.claim(targetId);
        if (operation === "release") await conversationsApi.release(targetId);
        if (operation === "resetAi") await conversationsApi.resetAi(targetId);
        if (operation === "handoffAi") await conversationsApi.handoffAi(targetId);
        await refreshConversationById(targetId);
        await refreshConversations();
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
      refreshConversations,
      refreshConversationById,
      selectedId,
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
      await refreshConversations();
    } catch (error: unknown) {
      setMessageError(
        extractApiErrorMessage(error) || "Failed to update snooze state."
      );
    } finally {
      setConversationActionBusy(false);
    }
  }, [
    conversationActionBusy,
    refreshConversations,
    refreshConversationById,
    selectedConversation,
  ]);

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
      const payload = templateComposerRef.current?.getSendPayload();
      if (!payload) return;
      setSending(true);
      try {
        await conversationsApi.sendMessage({
          contactId: activeContactId,
          channel: "WHATSAPP",
          channelTemplateVersionId: payload.channelTemplateVersionId,
          templateVariables: payload.templateVariables,
          idempotencyKey:
            typeof crypto !== "undefined" ? crypto.randomUUID() : undefined,
        });
        setDraft("");
        if (selectedId) clearDraftForConversation(selectedId);
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

    if (pendingImages.length > 0 && activeChannel === "WHATSAPP") {
      const readyImages = pendingImages.filter((img) => img.mediaId);
      if (readyImages.length === 0) return;
      setSending(true);
      setMultiImageSendProgress({ current: 0, total: readyImages.length });
      try {
        for (let i = 0; i < readyImages.length; i++) {
          setMultiImageSendProgress({ current: i + 1, total: readyImages.length });
          await conversationsApi.sendMessage({
            contactId: activeContactId,
            type: "IMAGE",
            mediaId: readyImages[i].mediaId!,
            text: i === readyImages.length - 1 ? draft.trim() || undefined : undefined,
            idempotencyKey:
              typeof crypto !== "undefined" ? crypto.randomUUID() : undefined,
            channel: "WHATSAPP",
          });
        }
        setDraft("");
        if (selectedId) clearDraftForConversation(selectedId);
        setPendingImages((prev) => {
          prev.forEach((img) => URL.revokeObjectURL(img.previewUrl));
          return [];
        });
        await refreshThreadAfterSend(activeContactId, "WHATSAPP");
      } catch (error: unknown) {
        setMessageError(extractApiErrorMessage(error) || "Failed to send images.");
      } finally {
        setSending(false);
        setMultiImageSendProgress(null);
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
        if (selectedId) clearDraftForConversation(selectedId);
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
      const sendPayload: { contactId: string; text: string; idempotencyKey?: string; channel?: "WHATSAPP" | "TELEGRAM" | "EMAIL" | "SMS"; type?: "TEXT"; sendAt?: string } = {
        contactId: activeContactId,
        text: draft.trim(),
        idempotencyKey:
          typeof crypto !== "undefined" ? crypto.randomUUID() : undefined,
        channel: activeChannel,
      };
      if (scheduleAt) {
        sendPayload.sendAt = new Date(scheduleAt).toISOString();
      }
      const hadSchedule = !!sendPayload.sendAt;
      await conversationsApi.sendMessage(sendPayload);
      setDraft("");
      if (selectedId) clearDraftForConversation(selectedId);
      setScheduleAt("");
      setShowSchedulePicker(false);
      await refreshThreadAfterSend(activeContactId, activeChannel);
      // After scheduling a new message we need the strip above the composer
      // to reflect it immediately — the SSE message.created event will fire
      // but parking on a server round-trip is cheap and avoids races where
      // the strip stays empty until the next poll.
      if (hadSchedule) {
        void fetchScheduledMessages();
        setShowScheduledStrip(true);
      }
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
      // Assignment conflict: another agent claimed the conversation between
      // the user loading this thread and hitting send. Pull fresh state so the
      // composer immediately reflects the new assignee.
      const status = (
        error as { response?: { status?: number } }
      ).response?.status;
      if (status === 403 && selectedId) {
        void refreshConversationById(selectedId);
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
        await refreshConversations();
        if (selectedId === conversation.id) {
          await fetchMessages(conversation.id, { silent: true });
        }
      } catch (error: unknown) {
        setMessageError(extractApiErrorMessage(error) || "Failed to retry message.");
      }
    },
    [refreshConversations, fetchMessages, selectedId]
  );

  const handleMediaFileChange = async (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0) return;

    const allImages = files.every((f) => classifyWhatsAppMediaKind(f) === "IMAGE");

    if (files.length > 1 && allImages) {
      // Multi-image flow: upload each sequentially
      clearPendingMediaPreview();
      const items = files.map((file) => ({
        file,
        previewUrl: URL.createObjectURL(file),
        mediaId: null as string | null,
      }));
      setPendingImages(items);
      for (let i = 0; i < files.length; i++) {
        try {
          const { mediaId } = await mediaUpload.upload(files[i]);
          setPendingImages((prev) =>
            prev.map((item, j) => (j === i ? { ...item, mediaId } : item))
          );
        } catch {
          // leave mediaId as null — will be skipped on send
        }
      }
      return;
    }

    // Single file flow (existing)
    setPendingImages([]);
    const file = files[0];
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
    }
  };

  const handleStopVoiceNote = async () => {
    if (!activeContactId || !activeChannel) return;
    let file: File;
    try {
      file = await voiceRecorder.stop();
    } catch {
      return;
    }
    clearPendingMediaPreview();
    setPendingKind("AUDIO");
    setPendingFileName(file.name);
    setPendingPreviewUrl(URL.createObjectURL(file));
    try {
      const { mediaId } = await mediaUpload.upload(file);
      setPendingMediaId(mediaId);
    } catch {
      clearPendingMediaPreview();
    }
  };

  /**
   * Match a `/<token>` written at the start of the draft (or after a newline /
   * space) immediately before the cursor. Returns the token + the absolute
   * span [start, end] in `draft` so we can replace it on apply.
   *
   * We only trigger when the user is actively typing a shortcut; once they
   * hit space or move the cursor past the token, the popover hides.
   */
  const cannedTrigger = useMemo(() => {
    if (!draft.startsWith("/")) return null;
    // Only match at the very start to avoid colliding with chat content.
    const m = draft.match(/^\/([a-z0-9_-]*)$/i);
    if (!m) return null;
    return { token: m[1].toLowerCase(), start: 0, end: m[0].length };
  }, [draft]);

  const cannedSuggestions = useMemo(() => {
    if (!cannedTrigger) return [] as CannedResponse[];
    const t = cannedTrigger.token;
    if (!t) {
      return cannedResponses.slice(0, 8);
    }
    return cannedResponses
      .filter(
        (c) =>
          c.shortcut.toLowerCase().startsWith(t) ||
          c.title.toLowerCase().includes(t),
      )
      .slice(0, 8);
  }, [cannedTrigger, cannedResponses]);

  useEffect(() => {
    setCannedSelectedIdx(0);
  }, [cannedTrigger?.token]);

  const applyCannedResponse = useCallback(
    (c: CannedResponse) => {
      if (!cannedTrigger) return;
      const before = draft.slice(0, cannedTrigger.start);
      const after = draft.slice(cannedTrigger.end);
      const next = `${before}${c.content}${after}`;
      setDraft(next);
      // restore caret to end of inserted content
      const caret = before.length + c.content.length;
      window.setTimeout(() => {
        const el = draftInputRef.current;
        if (el) {
          el.focus();
          try {
            el.setSelectionRange(caret, caret);
          } catch {
            // ignored
          }
        }
      }, 0);
      // Optimistic local bump so the next /-popup ordering reflects usage.
      setCannedResponses((prev) =>
        prev
          .map((p) =>
            p.id === c.id
              ? {
                  ...p,
                  usageCount: (p.usageCount ?? 0) + 1,
                  lastUsedAt: new Date().toISOString(),
                }
              : p,
          )
          .sort((a, b) => b.usageCount - a.usageCount),
      );
      // Fire-and-forget — failure here is acceptable; just doesn't move the rank.
      void cannedResponsesApi.recordUsage(c.id).catch(() => undefined);
    },
    [draft, cannedTrigger],
  );

  const handleEmojiSelect = useCallback((emoji: { native?: string }) => {
    if (!emoji.native) return;
    const input = draftInputRef.current;
    if (input) {
      const start = input.selectionStart ?? draft.length;
      const end = input.selectionEnd ?? draft.length;
      const next = draft.slice(0, start) + emoji.native + draft.slice(end);
      setDraft(next);
      // Restore cursor after the inserted emoji
      window.setTimeout(() => {
        input.focus();
        const pos = start + emoji.native!.length;
        input.setSelectionRange(pos, pos);
      }, 0);
    } else {
      setDraft((prev) => prev + emoji.native);
    }
    setShowEmojiPicker(false);
  }, [draft]);

  const canSend =
    !!activeContactId &&
    !sending &&
    !mediaUpload.uploading &&
    (useTemplateSend
      ? templateReady
      : (pendingImages.length > 0 &&
        pendingImages.every((img) => img.mediaId) &&
        activeChannel === "WHATSAPP") ||
      (pendingMediaId &&
        pendingKind &&
        activeChannel === "WHATSAPP") ||
      (!!draft.trim() && !pendingMediaId && pendingImages.length === 0));

  const showWhatsAppMediaTools =
    activeChannel === "WHATSAPP";

  /**
   * Consent actions surfaced in the conversation sidebar — opt-out and block
   * originate from the chat ("STOP" / abusive sender) so the agent needs them
   * one click away. ConfirmDialog gates the toggle in both directions; the
   * undo paths ("Restore" / "Unblock") use a lower-stakes tone.
   */
  const [consentAction, setConsentAction] = useState<
    | null
    | {
        kind: "opt-out" | "restore" | "block" | "unblock";
        contactId: string;
      }
  >(null);
  const [consentBusy, setConsentBusy] = useState(false);
  const [consentError, setConsentError] = useState<string | null>(null);

  const applyConsent = useCallback(
    async (
      contactId: string,
      patch: { isOptedOut?: boolean; isBlocked?: boolean },
    ) => {
      setConsentBusy(true);
      setConsentError(null);
      try {
        await contactsApi.updateConsent(contactId, patch);
        // Optimistically refresh the embedded contact on the selected
        // conversation. Avoids a full /conversations/:id refetch round-trip
        // for a UI-local update.
        setConversations((prev) =>
          prev.map((c) =>
            c.contactId === contactId
              ? {
                  ...c,
                  contact: c.contact
                    ? { ...c.contact, ...patch }
                    : { ...patch },
                }
              : c,
          ),
        );
        setConsentAction(null);
      } catch (err: unknown) {
        setConsentError(
          extractApiErrorMessage(err) || "Failed to update consent.",
        );
      } finally {
        setConsentBusy(false);
      }
    },
    [],
  );

  const contactForDetails = useMemo(
    () =>
      selectedConversation?.contact
        ? {
          id: selectedConversation.contact.id ?? selectedConversation.contactId,
          name: selectedConversation.contact.name,
          phone: selectedConversation.contact.phone,
          email: selectedConversation.contact.email,
          isOptedOut: selectedConversation.contact.isOptedOut ?? false,
          isBlocked: selectedConversation.contact.isBlocked ?? false,
          lifecycleStage:
            selectedConversation.contact.lifecycleStage ?? null,
          status: selectedConversation.status,
        }
        : startContact
          ? {
            id: startContact.id,
            name: startContact.name,
            phone: startContact.phone,
            email: startContact.email,
            isOptedOut: false,
            isBlocked: false,
            lifecycleStage: startContact.lifecycleStage ?? null,
            status: "NEW",
          }
          : null,
    [selectedConversation, startContact]
  );

  const [lifecycleBusy, setLifecycleBusy] = useState(false);
  const [lifecycleError, setLifecycleError] = useState<string | null>(null);

  const applyLifecycleStage = useCallback(
    async (contactId: string, stage: ContactLifecycleStage | null) => {
      setLifecycleBusy(true);
      setLifecycleError(null);
      try {
        await contactsApi.update(contactId, { lifecycleStage: stage });
        setConversations((prev) =>
          prev.map((c) =>
            c.contactId === contactId
              ? {
                  ...c,
                  contact: c.contact
                    ? { ...c.contact, lifecycleStage: stage }
                    : { lifecycleStage: stage },
                }
              : c,
          ),
        );
      } catch (err: unknown) {
        setLifecycleError(
          extractApiErrorMessage(err) || "Failed to update lifecycle stage.",
        );
      } finally {
        setLifecycleBusy(false);
      }
    },
    [],
  );

  const contactDetailsEl = useMemo(
    () =>
      !contactForDetails ? (
        <EmptyState
          title="No contact selected"
          description="Contact details appear when you open a conversation."
        />
      ) : (
        <div className="flex flex-col">
          {/* Hero */}
          <div className="op-grain relative flex flex-col items-center gap-2 border-b border-base-300 bg-base-200 px-4 py-5">
            <ContactAvatar
              name={contactForDetails.name}
              phone={contactForDetails.phone}
              size="lg"
            />
            <h3 className="text-[1rem] font-semibold tracking-[-0.02em]">
              {contactForDetails.name || "Unknown"}
            </h3>
            <div className="flex flex-wrap items-center justify-center gap-1.5">
              {contactForDetails.status ? (
                <span className="op-tag">{contactForDetails.status}</span>
              ) : null}
              {contactForDetails.lifecycleStage ? (
                <span className="rounded-[3px] border border-primary/40 bg-primary/10 px-1.5 py-[1px] text-[0.6875rem] font-mono-op uppercase tracking-[0.04em] text-primary">
                  {LIFECYCLE_STAGE_LABELS[contactForDetails.lifecycleStage]}
                </span>
              ) : null}
            </div>
            {selectedConversation?.contactId ? (
              <a
                href={`/people/contacts/${selectedConversation.contactId}`}
                className="mt-1 flex items-center gap-1 text-[0.6875rem] text-primary hover:underline"
                title="Open full contact page"
              >
                <ExternalLink className="h-3 w-3" /> Full profile
              </a>
            ) : null}
          </div>
          {/* Contact info */}
          <div className="border-b border-base-300 px-4 py-3">
            <div className="flex items-start gap-3 py-1.5">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-base-300 bg-base-200 text-base-content/50">
                <Phone className="h-3 w-3" />
              </div>
              <p className="font-mono-op text-[0.8125rem] tabular-nums text-base-content">
                {contactForDetails.phone || "—"}
              </p>
            </div>
            {selectedConversation?.id ? (
              <ConversationSenderPicker
                conversationId={selectedConversation.id}
                currentChannelAccountId={selectedConversation.channelAccountId}
                channel={selectedConversation.channel}
                onChanged={() => void refreshConversations()}
              />
            ) : null}
            {contactForDetails.email ? (
              <div className="flex items-start gap-3 py-1.5">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-base-300 bg-base-200 text-base-content/50">
                  <Mail className="h-3 w-3" />
                </div>
                <a
                  href={`mailto:${contactForDetails.email}`}
                  className="text-[0.8125rem] text-base-content hover:text-primary transition-colors"
                >
                  {contactForDetails.email}
                </a>
              </div>
            ) : null}
          </div>

          {/* Lifecycle stage — funnel position, set by the agent while
              talking to the customer. Null means "not classified yet". */}
          {contactForDetails.id ? (
            <div className="border-b border-base-300 px-4 py-3">
              <p className="op-label mb-2">Lifecycle stage</p>
              <select
                className="select select-bordered select-sm w-full font-mono-op text-[0.75rem] uppercase tracking-[0.04em]"
                value={contactForDetails.lifecycleStage ?? ""}
                disabled={lifecycleBusy}
                onChange={(event) => {
                  const next = event.target.value;
                  void applyLifecycleStage(
                    contactForDetails.id!,
                    next ? (next as ContactLifecycleStage) : null,
                  );
                }}
              >
                <option value="">Not set</option>
                {CONTACT_LIFECYCLE_STAGES.map((s) => (
                  <option key={s} value={s}>
                    {LIFECYCLE_STAGE_LABELS[s]}
                  </option>
                ))}
              </select>
              {lifecycleError ? (
                <p className="mt-2 text-[0.6875rem] text-error">
                  {lifecycleError}
                </p>
              ) : null}
            </div>
          ) : null}

          {/* Consent / safety actions — opt-out for compliance ("STOP"),
              block for abuse. Surfaced here so the agent doesn't have to
              leave the conversation to act on a customer's request. */}
          {contactForDetails.id ? (
            <div className="border-b border-base-300 px-4 py-3">
              <p className="op-label mb-2">Consent &amp; safety</p>

              {(contactForDetails.isOptedOut || contactForDetails.isBlocked) ? (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {contactForDetails.isOptedOut ? (
                    <span className="rounded-[3px] border border-warning/40 bg-warning/10 px-1.5 py-[1px] text-[0.6875rem] font-mono-op uppercase tracking-[0.04em] text-warning">
                      opted out
                    </span>
                  ) : null}
                  {contactForDetails.isBlocked ? (
                    <span className="rounded-[3px] border border-error/40 bg-error/10 px-1.5 py-[1px] text-[0.6875rem] font-mono-op uppercase tracking-[0.04em] text-error">
                      blocked
                    </span>
                  ) : null}
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2">
                {contactForDetails.isOptedOut ? (
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs"
                    onClick={() =>
                      setConsentAction({
                        kind: "restore",
                        contactId: contactForDetails.id!,
                      })
                    }
                  >
                    Restore consent
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-outline btn-warning btn-xs"
                    onClick={() =>
                      setConsentAction({
                        kind: "opt-out",
                        contactId: contactForDetails.id!,
                      })
                    }
                    title="Mark this contact as opted out — outbound sends will be blocked."
                  >
                    Mark opted out
                  </button>
                )}

                {contactForDetails.isBlocked ? (
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs"
                    onClick={() =>
                      setConsentAction({
                        kind: "unblock",
                        contactId: contactForDetails.id!,
                      })
                    }
                  >
                    Unblock
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-outline btn-error btn-xs"
                    onClick={() =>
                      setConsentAction({
                        kind: "block",
                        contactId: contactForDetails.id!,
                      })
                    }
                    title="Block this contact — outbound sends will be refused and inbound is suppressed in the inbox."
                  >
                    Block contact
                  </button>
                )}
              </div>

              {consentError ? (
                <p className="mt-2 text-[0.6875rem] text-error">{consentError}</p>
              ) : null}
            </div>
          ) : null}
        </div>
      ),
    [
      contactForDetails,
      selectedConversation?.contactId,
      selectedConversation?.id,
      selectedConversation?.channel,
      selectedConversation?.channelAccountId,
      refreshConversations,
      consentError,
      lifecycleBusy,
      lifecycleError,
      applyLifecycleStage,
    ]
  );

  const rightPanelContent = useMemo(
    () => (
      <div className="flex flex-col">
        {contactDetailsEl}
        {selectedConversation ? (
          <>
            {/* Message search */}
            <div className="border-b border-base-300 px-4 py-3">
              <div className="mb-2 flex items-center gap-2">
                <SearchIcon className="h-3.5 w-3.5 text-base-content/40" />
                <span className="op-label">Message search</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  className="input input-bordered input-sm w-full"
                  placeholder="Search in this conversation"
                  value={messageSearchQuery}
                  onChange={(e) => setMessageSearchQuery(e.target.value)}
                  data-esc-clearable="true"
                />
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={runMessageSearch}
                  disabled={messageSearchBusy || !messageSearchQuery.trim()}
                >
                  {messageSearchBusy ? "..." : "Find"}
                </button>
              </div>
              {messageSearchResult ? (
                <div className="mt-2 rounded-md border border-base-300 bg-base-200 p-2.5 text-[0.75rem]">
                  <p className="font-mono-op text-[0.625rem] tracking-wider text-base-content/50">
                    {messageSearchResult.id.slice(0, 12).toUpperCase()}
                  </p>
                  <p className="mt-1 line-clamp-2 text-base-content/80">{messageSearchResult.text || "—"}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <select
                      className="select select-bordered select-xs font-mono-op"
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
                      Refresh
                    </button>
                  </div>
                </div>
              ) : null}
            </div>

            {/* Internal notes */}
            <div className="border-b border-base-300">
              <div className="flex items-center gap-2 px-4 pt-3 pb-1">
                <StickyNote className="h-3.5 w-3.5 text-base-content/40" />
                <span className="op-label">Notes</span>
              </div>
              <InternalNotesPanel conversationId={selectedConversation.id} currentUserId={currentUserId} />
            </div>

            {/* Tasks for this contact */}
            {selectedConversation.contactId ? (
              <div className="border-b border-base-300">
                <TasksPanel
                  contactId={selectedConversation.contactId}
                  conversationId={selectedConversation.id}
                />
              </div>
            ) : null}

            {/* Shared media */}
            <div className="px-4 py-3">
              <div className="mb-2 flex items-center gap-2">
                <ImageIcon className="h-3.5 w-3.5 text-base-content/40" />
                <span className="op-label">Shared media</span>
              </div>
              <MediaGallery conversationId={selectedConversation.id} />
            </div>
          </>
        ) : null}
      </div>
    ),
    [
      contactDetailsEl,
      fetchMessages,
      messageSearchBusy,
      messageSearchQuery,
      messageSearchResult,
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
    if (!detailSelectionKey || !isLgUp) return;
    openRightPanel();
  }, [detailSelectionKey, openRightPanel, isLgUp]);

  useEffect(() => {
    return () => clearRightPanelContent("inbox");
  }, [clearRightPanelContent]);

  return (
    <>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden lg:grid lg:h-full lg:min-h-0 lg:grid-cols-[minmax(240px,1fr)_minmax(0,1.5fr)] lg:grid-rows-[minmax(0,1fr)] lg:items-stretch lg:gap-1">
          <div
            className={`flex min-h-0 flex-1 flex-col overflow-hidden rounded-none shadow-sm lg:min-h-0 lg:max-h-full ${!isLgUp && mobilePane === "thread" ? "hidden" : "flex"
              }`}
          >
            <div className="sticky top-0 z-10 flex h-14 shrink-0 items-center justify-between gap-2 border-b border-base-300 px-3">
              <h2 className="truncate text-xl font-medium text-base-content/80">
                {inboxTitle}
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
                  <span className="material-symbols-outlined">
                    <PlusCircle className="" />
                  </span>

                </button>
              </div>
            </div>
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              {/* Sidebar view tabs: Conversations | Starred | Scheduled */}
              <div className="flex shrink-0 border-b border-base-300">
                {(["conversations", "starred", "scheduled"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setSidebarView(v)}
                    className={`flex-1 py-2 text-xs font-medium transition-colors ${
                      sidebarView === v
                        ? "border-b-2 border-primary text-primary"
                        : "text-base-content/60 hover:text-base-content"
                    }`}
                  >
                    {v === "conversations" ? "Conversations" : v === "starred" ? "Starred" : "Scheduled"}
                  </button>
                ))}
              </div>

              {sidebarView === "conversations" ? (
              <>
              <div className="shrink-0 space-y-2 border-b border-base-300 pb-2">
                {/* Search */}
                <div className="px-2 pt-2">
                  <div className="relative">
                    <input
                      type="search"
                      placeholder="Search contacts…"
                      className="input input-bordered input-sm w-full pr-8"
                      value={listSearch}
                      onChange={(e) => setListSearch(e.target.value)}
                      data-esc-clearable="true"
                    />
                    {listSearch && (
                      <button
                        type="button"
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-base-content/40 hover:text-base-content"
                        onClick={() => setListSearch("")}
                        aria-label="Clear search"
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>

                {/* Filter chip strip */}
                <div className="relative flex items-center">
                  {/* Left arrow + fade */}
                  {chipCanScrollLeft ? (
                    <div className="absolute inset-y-0 left-0 z-10 flex items-center">
                      <div className="flex h-full items-center bg-gradient-to-r from-base-100 via-base-100 to-transparent pl-0.5 pr-3">
                        <button
                          type="button"
                          className="flex h-6 w-6 items-center justify-center rounded-md border border-base-300 bg-base-200 text-base-content/60 transition-colors hover:bg-base-300 hover:text-base-content"
                          onClick={() => scrollChips("left")}
                          aria-label="Scroll filters left"
                        >
                          <ChevronLeft className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  ) : null}
                  {/* Scrollable chips */}
                  <div className="min-w-0 flex-1">
                    <div ref={chipStripRef} className="flex items-center gap-1 overflow-x-auto px-2 pb-1 pt-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                      {/* Status chips — not shown in contactsQueue mode */}
                      {mode !== "contactsQueue" && STATUS_TABS.map((tab) => (
                        <button
                          key={tab}
                          type="button"
                          onClick={() => setStatus(tab)}
                          className={`shrink-0 rounded-md border px-2.5 py-1 text-[0.6875rem] font-medium transition-colors ${status === tab
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-base-300 bg-base-200 text-base-content/70 hover:bg-base-300"
                            }`}
                        >
                          {STATUS_LABELS[tab]}
                        </button>
                      ))}
                      {/* Queue chips — skip "all" since no chip = all */}
                      {(["awaiting", "unread", "snoozed"] as const).map((f) => (
                        <button
                          key={f}
                          type="button"
                          onClick={() => setQueueFilter(queueFilter === f ? "all" : f)}
                          className={`shrink-0 rounded-md border px-2.5 py-1 text-[0.6875rem] font-medium transition-colors ${queueFilter === f
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-base-300 bg-base-200 text-base-content/70 hover:bg-base-300"
                            }`}
                        >
                          {f === "awaiting" ? "Awaiting" : f === "unread" ? "Unread" : "Snoozed"}
                        </button>
                      ))}
                      {/* Sort selector — visually distinct from filter chips
                          (those narrow the result set; sort reorders the same
                          set). Native select keeps the row compact and scales
                          to additional sort modes later. */}
                      <label
                        className={`inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-0.5 text-[0.6875rem] font-medium transition-colors ${sortMode === "oldestUnreadFirst"
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-base-300 bg-base-100 text-base-content/70 hover:bg-base-200"
                          }`}
                        title="Conversation sort order"
                      >
                        <ArrowUpDown className="h-3 w-3" aria-hidden />
                        <span className="text-base-content/55">Sort:</span>
                        <select
                          className="select select-ghost select-xs min-h-0 h-5 border-0 bg-transparent px-0 pl-0 pr-4 text-[0.6875rem] font-medium focus:outline-none"
                          value={sortMode}
                          onChange={(e) =>
                            setSortMode(
                              e.target.value as
                                | "lastMessageAt"
                                | "oldestUnreadFirst",
                            )
                          }
                        >
                          <option value="lastMessageAt">Newest first</option>
                          <option value="oldestUnreadFirst">
                            Oldest unread (SLA)
                          </option>
                        </select>
                      </label>
                      {/* Channel chips */}
                      {CHANNEL_OPTIONS.map((ch) => (
                        <button
                          key={ch.value}
                          type="button"
                          onClick={() => setChannelFilter(channelFilter === ch.value ? null : ch.value)}
                          className={`shrink-0 rounded-md border px-2.5 py-1 text-[0.6875rem] font-medium transition-colors ${channelFilter === ch.value
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-base-300 bg-base-200 text-base-content/70 hover:bg-base-300"
                            }`}
                        >
                          {ch.label}
                        </button>
                      ))}
                      {/* Assigned to me */}
                      <button
                        type="button"
                        onClick={() => setAssigneeFilter(assigneeFilter === currentUserId ? null : currentUserId)}
                        className={`shrink-0 rounded-md border px-2.5 py-1 text-[0.6875rem] font-medium transition-colors ${assigneeFilter === currentUserId
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-base-300 bg-base-200 text-base-content/70 hover:bg-base-300"
                          }`}
                      >
                        Mine
                      </button>
                      {/* Unassigned queue */}
                      <button
                        type="button"
                        onClick={() => setAssigneeFilter(assigneeFilter === "__unassigned__" ? null : "__unassigned__")}
                        className={`shrink-0 rounded-md border px-2.5 py-1 text-[0.6875rem] font-medium transition-colors ${assigneeFilter === "__unassigned__"
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-base-300 bg-base-200 text-base-content/70 hover:bg-base-300"
                          }`}
                      >
                        Unassigned
                      </button>
                    </div>
                  </div>
                  {/* Right arrow + fade */}
                  {chipCanScrollRight ? (
                    <div className="absolute inset-y-0 right-0 z-10 flex items-center">
                      <div className="flex h-full items-center bg-gradient-to-l from-base-100 via-base-100 to-transparent pl-3 pr-0.5">
                        <button
                          type="button"
                          className="flex h-6 w-6 items-center justify-center rounded-md border border-base-300 bg-base-200 text-base-content/60 transition-colors hover:bg-base-300 hover:text-base-content"
                          onClick={() => scrollChips("right")}
                          aria-label="Scroll filters right"
                        >
                          <ChevronRight className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {/* Filter icon for tags */}
                  <button
                    type="button"
                    onClick={() => setShowTagPanel((v) => !v)}
                    aria-label="Filter by tags"
                    className={`relative shrink-0 px-2 py-1 ${showTagPanel ? "text-primary" : "text-base-content/50 hover:text-base-content"}`}
                  >
                    <SlidersHorizontal className="h-4 w-4" />
                    {activeTagCount > 0 && (
                      <span className="absolute right-0.5 top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary text-[0.5625rem] text-primary-content">
                        {activeTagCount}
                      </span>
                    )}
                  </button>
                </div>

                {/* Tag panel */}
                {showTagPanel && (
                  <div className="space-y-2 border-t border-base-300 px-2 py-2">
                    {tags.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {tags.map((tag) => (
                          <button
                            key={tag.id}
                            type="button"
                            onClick={() =>
                              setTagFilter((prev) =>
                                prev.includes(tag.id)
                                  ? prev.filter((id) => id !== tag.id)
                                  : [...prev, tag.id]
                              )
                            }
                            className={`inline-flex shrink-0 items-center gap-1 rounded-md border px-2.5 py-1 text-[0.6875rem] font-medium transition-colors ${tagFilter.includes(tag.id)
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-base-300 bg-base-200 text-base-content/70 hover:bg-base-300"
                              }`}
                            style={
                              !tagFilter.includes(tag.id) && tag.color
                                ? { borderColor: tag.color, color: tag.color }
                                : {}
                            }
                          >
                            <TagIcon className="h-3 w-3" aria-hidden />
                            {tag.name}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-base-content/40">No tags yet.</p>
                    )}
                    {activeTagCount > 0 && (
                      <button
                        type="button"
                        className="text-xs text-error hover:underline"
                        onClick={() => setTagFilter([])}
                      >
                        Clear tags
                      </button>
                    )}
                  </div>
                )}

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
                <ul className="space-y-3">
                  {conversations.map((conversation) => {
                    const isActive = conversation.id === selectedId;
                    const hasUnread = (conversation.unreadCount ?? 0) > 0;
                    const isAwaitingReply = conversation.awaitingReply === true;
                    const hasDraft = !!draftsByConversation[conversation.id]?.trim();
                    const title =
                      conversation.contact?.name ||
                      conversation.contact?.phone ||
                      conversation.contact?.email ||
                      "Unknown contact";
                    const reactionLine = reactionPreview(conversation);
                    const subtitle = hasDraft
                      ? `Draft: ${draftsByConversation[conversation.id]}`
                      : (reactionLine ?? lastMessagePreview(conversation.lastMessage));
                    // When the latest activity is a reaction, don't also draw
                    // the outbound delivery-status icon (it refers to the
                    // message, not the reaction).
                    const showReactionLine = !hasDraft && reactionLine !== null;
                    // Outbound-only delivery indicator on the last message. Not
                    // shown while a draft is pending (the draft isn't sent yet).
                    const showStatusIcon =
                      !hasDraft &&
                      !showReactionLine &&
                      conversation.lastMessage?.direction === "OUTBOUND";
                    const lastMessageFailed =
                      showStatusIcon &&
                      isFailedMessage(conversation.lastMessage!);
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
                          className={`group flex min-h-14 w-full items-center gap-4 rounded-box px-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${isActive
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
                              <span
                                className={`truncate text-sm ${hasUnread || isAwaitingReply
                                  ? "font-semibold text-base-content"
                                  : "text-base-content/85"
                                  }`}
                              >
                                {title}
                              </span>
                              {hasUnread ? (
                                <span className="font-mono-op flex min-w-[18px] shrink-0 items-center justify-center rounded-[3px] bg-primary px-1 text-[0.625rem] font-semibold leading-[16px] text-primary-content tabular-nums">
                                  {conversation.unreadCount}
                                </span>
                              ) : null}
                            </div>
                            <span
                              className={`flex items-center gap-1 text-xs ${lastMessageFailed
                                ? "font-medium text-error"
                                : hasUnread || isAwaitingReply
                                  ? "font-medium text-base-content/80"
                                  : "text-base-content/55"
                                }`}
                            >
                              {showStatusIcon ? (
                                <MessageStatusIcon
                                  message={conversation.lastMessage!}
                                  className="h-3 w-3 shrink-0"
                                />
                              ) : null}
                              <span className="truncate">{subtitle}</span>
                            </span>
                          </div>
                          {(() => {
                            const owner = conversationOwnerInfo(conversation);
                            if (owner.kind === "unassigned") return null;
                            return (
                              <span
                                className="ml-1 hidden shrink-0 items-center gap-1 rounded-full bg-base-200/70 px-1.5 py-0.5 text-[0.625rem] text-base-content/60 sm:flex"
                                title={
                                  owner.kind === "ai"
                                    ? "Handled by AI"
                                    : `Assigned to ${owner.label}`
                                }
                              >
                                {owner.kind === "ai" ? (
                                  <Bot className="h-3 w-3 shrink-0" />
                                ) : (
                                  <CircleUser className="h-3 w-3 shrink-0" />
                                )}
                                <span className="max-w-[64px] truncate">
                                  {owner.kind === "ai" ? "AI" : owner.label}
                                </span>
                              </span>
                            );
                          })()}
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
              </>
              ) : sidebarView === "starred" ? (
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain p-2">
                {starredLoading && !starredMessages.length ? (
                  <div className="flex justify-center py-8"><span className="loading loading-spinner" /></div>
                ) : !starredMessages.length ? (
                  <EmptyState title="No starred messages" description="Star a message in any conversation to save it here." />
                ) : (
                  <>
                    <ul className="space-y-2">
                      {starredMessages.map((msg) => (
                        <li key={msg.id}>
                          <button
                            type="button"
                            className="card w-full bg-base-100 border border-base-300 p-3 text-left transition-colors hover:bg-base-300/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                            onClick={() => {
                              if (!msg.conversationId) return;
                              setSidebarView("conversations");
                              setPendingScrollMessageId(msg.id);
                              setSelectedId(msg.conversationId);
                              if (!isLgUp) setMobilePane("thread");
                            }}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-xs font-medium text-base-content/70">
                                  {(msg as Record<string, unknown>).contactName as string || (msg as Record<string, unknown>).contactPhone as string || "Message"}
                                </p>
                                <p className="mt-0.5 text-sm text-base-content">{msg.text || `[${msg.type}]`}</p>
                                <p className="mt-1 text-[0.625rem] text-base-content/40">
                                  {msg.starredAt ? new Date(msg.starredAt).toLocaleString() : ""}
                                </p>
                              </div>
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm mt-2 w-full"
                      onClick={() => fetchStarredMessages(starredCursor, true)}
                      disabled={!starredCursor || starredLoading}
                    >
                      Load more
                    </button>
                  </>
                )}
              </div>
              ) : (
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain p-2">
                {scheduledLoading && !scheduledMessages.length ? (
                  <div className="flex justify-center py-8"><span className="loading loading-spinner" /></div>
                ) : !scheduledMessages.length ? (
                  <EmptyState title="No scheduled messages" description="Schedule a message to send later." />
                ) : (
                  <>
                    <ul className="space-y-2">
                      {scheduledMessages.map((msg) => (
                        <li key={msg.id} className="card bg-base-100 border border-base-300 p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-medium text-base-content/70">
                                {(msg as Record<string, unknown>).contactName as string || (msg as Record<string, unknown>).contactPhone as string || "Message"}
                              </p>
                              <p className="mt-0.5 text-sm text-base-content">{msg.text || `[${msg.type}]`}</p>
                              <p className="mt-1 text-[0.625rem] text-base-content/40">
                                Scheduled: {msg.sendAt ? new Date(msg.sendAt).toLocaleString() : "—"}
                              </p>
                            </div>
                            <button
                              type="button"
                              className="btn btn-ghost btn-xs text-error"
                              onClick={() => handleCancelScheduled(msg.id)}
                              title="Cancel scheduled message"
                            >
                              Cancel
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm mt-2 w-full"
                      onClick={() => fetchScheduledMessages(scheduledCursor, true)}
                      disabled={!scheduledCursor || scheduledLoading}
                    >
                      Load more
                    </button>
                  </>
                )}
              </div>
              )}
            </div>
          </div>

          <div
            className={`flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-none  lg:min-h-0 lg:max-h-full ${!isLgUp && mobilePane === "list" ? "hidden" : "flex"
              }`}
          >
            <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center justify-between gap-2 border-b border-base-300  px-3">
              <div className="flex min-h-0 min-w-0 flex-1 items-center gap-2">
                {!isLgUp ? (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm btn-square shrink-0"
                    aria-label="Back to conversations"
                    onClick={() => setMobilePane("list")}
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                ) : null}
                {selectedConversation ? (
                  // Clicking the contact title opens the right detail panel,
                  // matching the WhatsApp Web pattern. The panel is already
                  // populated via the `rightPanelContent` effect — we just
                  // need to open it. (`openAfter: true` on the content sync
                  // is avoided because the memory `right-panel-openAfter-mobile`
                  // warns against auto-open on data refreshes.)
                  <button
                    type="button"
                    onClick={openRightPanel}
                    className="group/title flex min-w-0 items-center gap-1.5 truncate rounded-md px-1 py-0.5 text-left text-sm font-medium text-base-content/80 transition-colors hover:bg-base-200/80 hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary/40"
                    title="Open contact details"
                  >
                    <span className="truncate">
                      {conversationTitle(selectedConversation)}
                    </span>
                  </button>
                ) : (
                  <h2 className="truncate text-sm font-medium text-base-content/80">
                    {startContact
                      ? startContact.name ||
                        startContact.phone ||
                        startContact.email ||
                        "New chat"
                      : "Select a conversation"}
                  </h2>
                )}
                {selectedConversation && conversationOwner ? (
                  <span
                    className="hidden shrink-0 items-center gap-1 rounded-full bg-base-200 px-2 py-0.5 text-xs text-base-content/70 sm:flex"
                    title={
                      conversationOwner.kind === "ai"
                        ? "The AI chatbot is handling this conversation"
                        : conversationOwner.kind === "unassigned"
                          ? "No one is assigned — the AI will respond if enabled"
                          : "Handled by a human agent"
                    }
                  >
                    {conversationOwner.kind === "ai" ? (
                      <Bot className="h-3.5 w-3.5 shrink-0" />
                    ) : (
                      <CircleUser
                        className={`h-3.5 w-3.5 shrink-0 ${conversationOwner.kind === "unassigned" ? "opacity-50" : ""}`}
                      />
                    )}
                    {conversationOwner.label}
                  </span>
                ) : null}
              </div>
              <div className="flex min-w-0 shrink-0 flex-wrap items-center justify-end gap-2">
                {selectedConversation ? (
                  <>
                    {otherViewers.length > 0 ? (
                      <span className="hidden text-xs text-base-content/65 md:inline">
                        {otherViewers.slice(0, 2).join(", ")} is viewing this
                      </span>
                    ) : null}
                    {/* Claim / Release: available to agents and above based on assignment state. */}
                    {canClaimConversation && !selectedConversation.assignedUserId ? (
                      <button
                        type="button"
                        className="btn btn-primary btn-xs shrink-0"
                        onClick={() => void runConversationAction("claim")}
                        disabled={conversationActionBusy}
                      >
                        Claim
                      </button>
                    ) : null}
                    {canReleaseConversation &&
                    selectedConversation.assignedUserId === currentUserId ? (
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs shrink-0 border border-base-300"
                        onClick={() => void runConversationAction("release")}
                        disabled={conversationActionBusy}
                      >
                        Release
                      </button>
                    ) : null}
                    {canManageConversations && (
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
                    )}
                    {canManageConversations && (
                    <div className="dropdown dropdown-end">
                      <button
                        type="button"
                        tabIndex={0}
                        className="btn btn-ghost btn-square btn-sm shrink-0"
                        aria-label="Conversation actions"
                        aria-haspopup="menu"
                        disabled={conversationActionBusy}
                      >
                        <MoreVertical className="h-5 w-5" />
                      </button>
                      <ul
                        tabIndex={0}
                        className="dropdown-content menu z-[60] w-56 rounded-box border border-base-300 bg-base-100 p-2 shadow-lg"
                        role="menu"
                        aria-label="Conversation actions"
                      >
                        <li role="none">
                          <button
                            type="button"
                            role="menuitem"
                            className="w-full justify-start text-left font-normal"
                            onClick={() => void runConversationAction("open")}
                            disabled={conversationActionBusy}
                          >
                            Open
                          </button>
                        </li>
                        {mode === "inbox" ? (
                          <>
                            <li role="none">
                              <button
                                type="button"
                                role="menuitem"
                                className="w-full justify-start text-left font-normal"
                                onClick={() => void runConversationAction("close")}
                                disabled={conversationActionBusy}
                              >
                                Close
                              </button>
                            </li>
                            <li role="none">
                              <button
                                type="button"
                                role="menuitem"
                                className="w-full justify-start text-left font-normal"
                                onClick={() => void runConversationAction("archive")}
                                disabled={conversationActionBusy}
                              >
                                Archive
                              </button>
                            </li>
                          </>
                        ) : (
                          <li role="none">
                            <button
                              type="button"
                              role="menuitem"
                              className="w-full justify-start text-left font-normal"
                              onClick={() => void toggleSnooze()}
                              disabled={conversationActionBusy}
                            >
                              {selectedConversation.snoozedUntil &&
                                new Date(selectedConversation.snoozedUntil).getTime() > Date.now()
                                ? "Unsnooze"
                                : "Snooze 1h"}
                            </button>
                          </li>
                        )}
                        <li role="none">
                          <button
                            type="button"
                            role="menuitem"
                            className="w-full justify-start text-left font-normal"
                            onClick={() => void runConversationAction("read")}
                            disabled={conversationActionBusy}
                          >
                            Mark read
                          </button>
                        </li>
                        <li className="my-1 px-1" role="separator">
                          <hr className="border-base-300" />
                        </li>
                        <li role="none">
                          <button
                            type="button"
                            role="menuitem"
                            className="w-full justify-start text-left font-normal"
                            onClick={() =>
                              void runConversationAction("assign", {
                                userId: assigneeUserId,
                              })
                            }
                            disabled={conversationActionBusy || !assigneeUserId}
                          >
                            Assign
                          </button>
                        </li>
                        <li role="none">
                          <button
                            type="button"
                            role="menuitem"
                            className="w-full justify-start text-left font-normal"
                            onClick={() => void runConversationAction("unassign")}
                            disabled={conversationActionBusy}
                          >
                            Unassign
                          </button>
                        </li>
                        <li className="my-1 px-1" role="separator">
                          <hr className="border-base-300" />
                        </li>
                        <li role="none">
                          <button
                            type="button"
                            role="menuitem"
                            className="w-full justify-start text-left font-normal"
                            onClick={() => {
                              if (
                                window.confirm(
                                  "Hand this conversation to the AI assistant? It will take over replies to new messages, and any human assignment is cleared."
                                )
                              ) {
                                void runConversationAction("handoffAi");
                              }
                            }}
                            disabled={conversationActionBusy}
                          >
                            Hand to AI
                          </button>
                        </li>
                        <li role="none">
                          <button
                            type="button"
                            role="menuitem"
                            className="w-full justify-start text-left font-normal"
                            onClick={() => {
                              if (
                                window.confirm(
                                  "Reset the assistant's context for this conversation? The AI will ignore earlier messages when it replies. The transcript is kept."
                                )
                              ) {
                                void runConversationAction("resetAi");
                              }
                            }}
                            disabled={conversationActionBusy}
                          >
                            Reset AI context
                          </button>
                        </li>
                      </ul>
                    </div>
                    )}
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
                    <CircleUser className="h-6 w-6" />
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

              <div className="relative mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col overflow-hidden pt-2">
                {unreadNewCount > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      unreadNewRef.current = 0;
                      setUnreadNewCount(0);
                      requestAnimationFrame(() => {
                        const container = messagesScrollRef.current;
                        container?.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
                      });
                    }}
                    className="absolute bottom-4 right-4 z-10 btn btn-sm btn-primary shadow-md gap-1"
                  >
                    ↓ {unreadNewCount} new {unreadNewCount === 1 ? "message" : "messages"}
                  </button>
                )}
                {/* Pinned messages banner */}
                {pinnedMessages.length > 0 && (
                  <div className="mx-2 mb-2 rounded-box border border-primary/30 bg-primary/5 text-sm">
                    <button
                      type="button"
                      className="flex w-full items-center justify-between px-3 py-2 font-medium text-primary"
                      onClick={() => setPinnedBannerExpanded((v) => !v)}
                    >
                      <span>📌 {pinnedMessages.length} pinned {pinnedMessages.length === 1 ? "message" : "messages"}</span>
                      <span className="text-xs">{pinnedBannerExpanded ? "▲" : "▼"}</span>
                    </button>
                    {pinnedBannerExpanded && (
                      <ul className="divide-y divide-primary/10 border-t border-primary/20">
                        {pinnedMessages.map((pm) => (
                          <li key={pm.id} className="flex items-center justify-between gap-2 px-3 py-2">
                            <span className="line-clamp-1 text-xs text-base-content/80 flex-1">
                              {pm.text?.trim() || `[${pm.type ?? "media"}]`}
                            </span>
                            <button
                              type="button"
                              className="btn btn-ghost btn-xs text-primary/60"
                              onClick={() => void handlePinMessage(pm)}
                              disabled={messageMutationBusy}
                            >
                              Unpin
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                <div
                  ref={messagesScrollRef}
                  className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-y-contain pr-1"
                >
                  {groupedTimeline.map((group) => (
                    <div key={group.dateKey}>
                      {group.dateLabel && <DateSeparator label={group.dateLabel} />}
                      {group.items.map((item) => {
                        if (item.kind === "message") {
                          const message = item.message;
                          return (
                            <MessageBubble
                              key={`${message.id}-${resolveMediaUrlForUi(message.mediaUrl ?? undefined) ?? ""}-${message.status ?? ""}`}
                              message={message}
                              onPin={handlePinMessage}
                              onStar={handleStarMessage}
                              onReact={handleReactToMessage}
                              onUnreact={handleUnreactToMessage}
                              onRetry={handleRetryFailedMessage}
                              retrying={retryingMessageIds.has(message.id)}
                              onDiscard={handleDiscardFailedMessage}
                              discarding={discardingMessageIds.has(message.id)}
                              onCreateTask={handleOpenCreateTaskForMessage}
                              currentUserId={currentUserId}
                              highlighted={highlightedMessageId === message.id}
                            />
                          );
                        }

                        // Collapsed run of campaign delivery failures. Their
                        // failure is already reported in the campaign; keep the
                        // chat clean and offer an expand-to-inspect affordance.
                        const count = item.messages.length;
                        const campaignIds = Array.from(
                          new Set(
                            item.messages
                              .map((m) => m.campaignId)
                              .filter((id): id is string => !!id)
                          )
                        );
                        const campaignHref =
                          campaignIds.length === 1
                            ? `/campaigns?id=${campaignIds[0]}`
                            : "/campaigns";
                        const expanded = expandedFailureGroups.has(item.id);
                        return (
                          <div key={item.id} className="my-3 flex flex-col items-center gap-2">
                            <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-full border border-base-300 bg-base-200 px-3 py-1 text-xs text-base-content/60">
                              <span>
                                ⚠ {count} campaign {count === 1 ? "message" : "messages"} failed to deliver
                              </span>
                              <a
                                href={campaignHref}
                                className="text-primary underline-offset-2 hover:underline"
                              >
                                View campaign →
                              </a>
                              <button
                                type="button"
                                onClick={() => toggleFailureGroup(item.id)}
                                className="text-base-content/50 hover:text-base-content"
                              >
                                {expanded ? "Hide" : "Show"}
                              </button>
                            </div>
                            {expanded && (
                              <div className="w-full space-y-4">
                                {item.messages.map((message) => (
                                  <MessageBubble
                                    key={`${message.id}-${resolveMediaUrlForUi(message.mediaUrl ?? undefined) ?? ""}-${message.status ?? ""}`}
                                    message={message}
                                    onPin={handlePinMessage}
                                    onStar={handleStarMessage}
                                    onReact={handleReactToMessage}
                                    onUnreact={handleUnreactToMessage}
                                    onRetry={handleRetryFailedMessage}
                                    retrying={retryingMessageIds.has(message.id)}
                                    onDiscard={handleDiscardFailedMessage}
                                    discarding={discardingMessageIds.has(message.id)}
                                    onCreateTask={handleOpenCreateTaskForMessage}
                                    currentUserId={currentUserId}
                                    highlighted={highlightedMessageId === message.id}
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                  <div aria-hidden className="h-px w-full shrink-0" />
                </div>

                {!canSendMessages ? (
                  <div className="mt-3 shrink-0 border-t border-base-300 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]">
                    <p className="text-center text-xs text-base-content/50">
                      You have read-only access to this inbox.
                    </p>
                  </div>
                ) : showTakeOverNotice ? (
                  <div className="mt-3 shrink-0 border-t border-base-300 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]">
                    <div className="flex flex-col items-center gap-2 text-center">
                      <p className="text-sm text-base-content/60">
                        {assigneeName ? `Assigned to ${assigneeName}` : "This conversation is assigned to someone else."}
                      </p>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        disabled={conversationActionBusy}
                        onClick={() => void runConversationAction("assign", { userId: currentUserId })}
                      >
                        {conversationActionBusy ? <span className="loading loading-spinner loading-xs" /> : null}
                        Take over
                      </button>
                    </div>
                  </div>
                ) : (
                <div className="mt-3 shrink-0 space-y-2 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={WHATSAPP_ATTACH_ACCEPT}
                    multiple
                    className="hidden"
                    onChange={handleMediaFileChange}
                  />
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
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
                        <div role="alert" className="rounded-box border border-warning/30 border-l-2 border-l-warning bg-base-200 px-3 py-2 text-sm">
                          {policyError}
                        </div>
                      ) : null}
                      {templateOnlyMode ? (
                        <div
                          className={
                            freeChatPolicyTip
                              ? "tooltip tooltip-top inline-flex max-w-full items-center gap-2"
                              : "inline-flex max-w-full items-center gap-2"
                          }
                          {...(freeChatPolicyTip ? { "data-tip": freeChatPolicyTip } : {})}
                        >
                          <span className="op-tag op-tag-warn shrink-0">Templates only</span>
                          <span className="truncate text-[0.625rem] text-base-content/55">
                            Outside 24h window
                          </span>
                        </div>
                      ) : (
                        <div className="flex min-h-7 items-center justify-between gap-2">
                          <span className="text-[0.625rem] uppercase tracking-wide text-base-content/50">
                            Mode
                          </span>
                          <div className="join join-horizontal">
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
                                className={`btn btn-xs join-item ${!useTemplateSend ? "btn-primary" : "btn-ghost"
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
                      )}
                      <TemplateComposer
                        ref={templateComposerRef}
                        active={useTemplateSend}
                        contactId={activeContactId}
                        channel={activeChannel}
                        workspaceId={workspaceId}
                        templateOnly={templateOnlyMode}
                        onReadyChange={setTemplateReady}
                      />
                    </div>
                  ) : null}
                  {mediaUpload.error ? (
                    <div role="alert" className="rounded-box border border-warning/30 border-l-2 border-l-warning bg-base-200 px-3 py-2 text-sm">
                      {mediaUpload.error}
                    </div>
                  ) : null}
                  {!useTemplateSend && pendingImages.length > 0 ? (
                    <div className="rounded-none bg-base-200 p-3 space-y-2">
                      <div className="flex items-center gap-1 overflow-x-auto pb-1">
                        {pendingImages.map((img, i) => (
                          <div key={i} className="relative h-20 w-20 shrink-0 overflow-hidden rounded-box bg-base-300">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={img.previewUrl} alt="" className="h-full w-full object-cover" />
                            {!img.mediaId ? (
                              <div className="absolute inset-0 flex items-center justify-center bg-base-100/65" aria-hidden>
                                <span className="loading loading-spinner loading-sm text-primary" />
                              </div>
                            ) : null}
                            <button
                              type="button"
                              className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-base-100/80 text-xs hover:bg-base-100"
                              aria-label="Remove image"
                              onClick={() =>
                                setPendingImages((prev) => {
                                  const removed = prev[i];
                                  if (removed) URL.revokeObjectURL(removed.previewUrl);
                                  return prev.filter((_, j) => j !== i);
                                })
                              }
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-base-content/60">
                        {multiImageSendProgress
                          ? `Sending ${multiImageSendProgress.current}/${multiImageSendProgress.total}…`
                          : pendingImages.every((img) => img.mediaId)
                            ? `${pendingImages.length} image${pendingImages.length > 1 ? "s" : ""} ready · caption goes with last image`
                            : `Uploading…`}
                      </p>
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
                  {/* Per-contact scheduled-messages strip. Collapsed by
                      default; the agent can expand to see what's queued
                      for this contact and cancel individual items. The
                      conversation thread itself never renders SCHEDULED
                      messages — they only appear here until they fire. */}
                  {scheduledForActiveContact.length > 0 && (
                    <div className="border-b border-base-300 bg-base-200/60">
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[0.75rem] text-base-content/70 hover:bg-base-300/40"
                        aria-expanded={showScheduledStrip}
                        onClick={() => setShowScheduledStrip((v) => !v)}
                      >
                        <Clock className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
                        <span>
                          {scheduledForActiveContact.length} scheduled message
                          {scheduledForActiveContact.length === 1 ? "" : "s"} for this contact
                        </span>
                        {!showScheduledStrip && scheduledForActiveContact[0]?.sendAt ? (
                          <span className="hidden font-mono-op text-[0.6875rem] text-base-content/55 sm:inline">
                            · next {new Date(scheduledForActiveContact[0].sendAt).toLocaleString([], {
                              weekday: "short",
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        ) : null}
                        <span className="ml-auto text-[0.6875rem] text-base-content/50">
                          {showScheduledStrip ? "hide" : "show"}
                        </span>
                      </button>
                      {showScheduledStrip && (
                        <ul className="max-h-44 divide-y divide-base-300/60 overflow-y-auto border-t border-base-300">
                          {scheduledForActiveContact.map((m) => (
                            <li
                              key={m.id}
                              className="flex items-start gap-2 px-3 py-2 text-[0.75rem]"
                            >
                              <Clock className="mt-0.5 h-3 w-3 shrink-0 text-base-content/45" aria-hidden />
                              <div className="min-w-0 flex-1">
                                <p className="font-mono-op text-[0.6875rem] text-primary">
                                  {m.sendAt
                                    ? new Date(m.sendAt).toLocaleString([], {
                                        weekday: "short",
                                        month: "short",
                                        day: "numeric",
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      })
                                    : "—"}
                                </p>
                                <p className="mt-0.5 line-clamp-2 text-base-content/85">
                                  {m.text?.trim() || `[${m.type ?? "message"}]`}
                                </p>
                              </div>
                              <button
                                type="button"
                                className="btn btn-ghost btn-xs shrink-0 text-error"
                                title="Cancel scheduled send"
                                onClick={() => handleCancelScheduled(m.id)}
                              >
                                <XIcon className="h-3 w-3" aria-hidden />
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                  {/* Schedule strip — collapsible row above the composer.
                      Auto-opens when a time is already set so the agent
                      can see / edit / clear it. */}
                  {(showSchedulePicker || scheduleAt) && (
                    <div className="flex flex-col gap-2 border-b border-base-300 bg-base-200/60 px-3 py-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Clock className="h-3.5 w-3.5 shrink-0 text-base-content/55" aria-hidden />
                        <span className="op-label">Send at</span>
                        <input
                          ref={scheduleInputRef}
                          type="datetime-local"
                          aria-label="Schedule send"
                          className="input input-bordered input-sm h-9 min-w-0 flex-1 font-mono-op text-[0.75rem] sm:flex-none sm:w-56"
                          min={new Date(Date.now() + 60_000).toISOString().slice(0, 16)}
                          value={scheduleAt}
                          onChange={(e) => setScheduleAt(e.target.value)}
                          disabled={!activeContactId || useTemplateSend}
                        />
                        {scheduleAt ? (
                          <span className="hidden text-[0.75rem] text-base-content/70 sm:inline">
                            {new Date(scheduleAt).toLocaleString([], {
                              weekday: "short",
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        ) : null}
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs ml-auto gap-1"
                          title={scheduleAt ? "Clear and close" : "Close"}
                          onClick={() => {
                            setScheduleAt("");
                            setShowSchedulePicker(false);
                          }}
                        >
                          <XIcon className="h-3 w-3" aria-hidden />
                          {scheduleAt ? "Clear" : "Close"}
                        </button>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="op-label shrink-0">Quick pick</span>
                        {schedulePresets.map((p) => (
                          <button
                            key={p.label}
                            type="button"
                            className="btn btn-ghost btn-xs border border-base-300 font-normal hover:border-primary/40 hover:text-primary"
                            disabled={!activeContactId || useTemplateSend}
                            title={p.date.toLocaleString([], {
                              weekday: "short",
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                            onClick={() => setScheduleAt(toLocalInputValue(p.date))}
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="relative flex flex-wrap items-end gap-2">
                    {/* Emoji picker popover */}
                    {showEmojiPicker && (
                      <div
                        ref={emojiPickerRef}
                        className="emoji-mart-scope absolute bottom-full left-0 z-50 mb-2"
                      >
                        <Picker
                          data={emojiData}
                          onEmojiSelect={handleEmojiSelect}
                          theme="auto"
                          previewPosition="none"
                          skinTonePosition="none"
                        />
                      </div>
                    )}
                    {showWhatsAppMediaTools && !useTemplateSend ? (
                      <button
                        type="button"
                        className="btn btn-ghost btn-square shrink-0"
                        aria-label="Attach photo, video, audio, or document"
                        disabled={
                          !activeContactId ||
                          mediaUpload.uploading ||
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
                    ) : activeContactId && !useTemplateSend ? (
                      <span
                        className="tooltip tooltip-top shrink-0 text-xs text-base-content/50"
                        data-tip="Media attachments are only available on WhatsApp for now."
                      >
                        <button
                          type="button"
                          className="btn btn-ghost btn-rounded btn-disabled cursor-not-allowed"
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
                    {/* Camera capture — WhatsApp only */}
                    {showWhatsAppMediaTools && !useTemplateSend ? (
                      <button
                        type="button"
                        className="btn btn-ghost btn-square shrink-0"
                        aria-label="Capture photo"
                        disabled={
                          !activeContactId ||
                          mediaUpload.uploading ||
                          !!pendingMediaId ||
                          voiceRecorder.recording
                        }
                        onClick={() => cameraInputRef.current?.click()}
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
                          <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
                          <circle cx="12" cy="13" r="3" />
                        </svg>
                      </button>
                    ) : null}
                    {/* Emoji button — only in free-chat mode */}
                    {!useTemplateSend && activeContactId ? (
                      <button
                        type="button"
                        className={`btn btn-ghost btn-square shrink-0 ${showEmojiPicker ? "btn-active" : ""}`}
                        aria-label="Emoji"
                        onClick={() => setShowEmojiPicker((v) => !v)}
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
                          <circle cx="12" cy="12" r="10" />
                          <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                          <line x1="9" y1="9" x2="9.01" y2="9" />
                          <line x1="15" y1="9" x2="15.01" y2="9" />
                        </svg>
                      </button>
                    ) : null}
                    {/* Voice note — WhatsApp only, when no other media pending */}
                    {showWhatsAppMediaTools && !useTemplateSend && !pendingMediaId && pendingImages.length === 0 ? (
                      voiceRecorder.recording ? (
                        <div className="flex shrink-0 items-center gap-2">
                          <span className="animate-pulse text-error">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                              <path d="M12 1a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4z" />
                            </svg>
                          </span>
                          <span className="min-w-[3ch] text-xs tabular-nums text-base-content/70">
                            {Math.floor(voiceRecorder.durationMs / 1000)}s
                          </span>
                          <button
                            type="button"
                            className="btn btn-success btn-xs"
                            onClick={() => void handleStopVoiceNote()}
                            aria-label="Stop and send voice note"
                          >
                            Stop
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost btn-xs"
                            onClick={() => voiceRecorder.cancel()}
                            aria-label="Cancel voice note"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-ghost btn-square shrink-0"
                          aria-label="Record voice note"
                          disabled={
                            !activeContactId ||
                            mediaUpload.uploading ||
                            sending
                          }
                          onClick={() => void voiceRecorder.start()}
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
                            <path d="M12 1a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4z" />
                            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                            <line x1="12" y1="19" x2="12" y2="23" />
                            <line x1="8" y1="23" x2="16" y2="23" />
                          </svg>
                        </button>
                      )
                    ) : null}
                      <div className="relative flex min-w-0 flex-1">
                      <textarea
                        ref={draftInputRef}
                        rows={1}
                        title="Enter to send · Shift+Enter for a new line"
                        className="textarea textarea-bordered min-h-10 min-w-0 flex-1 resize-none overflow-y-auto rounded-box py-2.5 leading-snug focus:outline-none focus:[box-shadow:0_0_0_3px_hsl(var(--p)/0.18),0_0_10px_2px_hsl(var(--p)/0.10)]"
                        placeholder={
                          useTemplateSend
                            ? "Template mode: free text is disabled"
                            : pendingMediaId
                              ? "Add a caption (optional)…"
                              : "Type a message…"
                        }
                        value={draft}
                        onChange={(event) => setDraft(event.target.value)}
                        onFocus={() => {
                          draftComposerConversationIdRef.current = selectedId;
                        }}
                        onBlur={persistDraftToStorageMap}
                        onKeyDown={(event) => {
                          // Canned-response popover keyboard handling
                          if (cannedSuggestions.length > 0) {
                            if (event.key === "ArrowDown") {
                              event.preventDefault();
                              setCannedSelectedIdx((i) =>
                                Math.min(i + 1, cannedSuggestions.length - 1),
                              );
                              return;
                            }
                            if (event.key === "ArrowUp") {
                              event.preventDefault();
                              setCannedSelectedIdx((i) => Math.max(i - 1, 0));
                              return;
                            }
                            if (event.key === "Tab") {
                              event.preventDefault();
                              const pick =
                                cannedSuggestions[cannedSelectedIdx] ??
                                cannedSuggestions[0];
                              if (pick) applyCannedResponse(pick);
                              return;
                            }
                            if (event.key === "Enter" && !event.shiftKey) {
                              event.preventDefault();
                              const pick =
                                cannedSuggestions[cannedSelectedIdx] ??
                                cannedSuggestions[0];
                              if (pick) applyCannedResponse(pick);
                              return;
                            }
                          }
                          if (event.key === "Enter" && !event.shiftKey) {
                            event.preventDefault();
                            if (canSend) handleSend();
                          }
                        }}
                        disabled={
                          !activeContactId ||
                          sending ||
                          mediaUpload.uploading ||
                          useTemplateSend ||
                          voiceRecorder.recording
                        }
                      />
                      {cannedSuggestions.length > 0 ? (
                        <div className="absolute bottom-full left-0 right-0 z-30 mb-1 max-h-64 overflow-y-auto rounded-box border border-base-300 bg-base-100 p-1 shadow-lg">
                          <div className="flex items-center justify-between gap-2 px-2 py-1 text-[0.625rem] uppercase tracking-[0.08em] text-base-content/50">
                            <span>Canned responses</span>
                            <span className="font-mono-op">↑↓ · Tab/Enter</span>
                          </div>
                          {cannedSuggestions.map((c, idx) => {
                            const active = idx === cannedSelectedIdx;
                            return (
                              <button
                                key={c.id}
                                type="button"
                                className={`flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-[0.75rem] ${active ? "bg-primary/10 text-primary" : "hover:bg-base-200"}`}
                                onMouseEnter={() => setCannedSelectedIdx(idx)}
                                onMouseDown={(e) => {
                                  // prevent textarea blur which would close popover
                                  e.preventDefault();
                                  applyCannedResponse(c);
                                }}
                              >
                                <span className="shrink-0 font-mono-op text-primary">
                                  /{c.shortcut}
                                </span>
                                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                                  <span className="truncate font-medium">{c.title}</span>
                                  <span className="line-clamp-1 text-base-content/55">
                                    {c.content}
                                  </span>
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      ) : null}
                      </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {/* Schedule toggle — reveals the slim row above the
                          composer where the native datetime picker has
                          enough room to breathe. */}
                      <button
                        type="button"
                        className={`btn btn-ghost btn-square shrink-0 ${
                          showSchedulePicker || scheduleAt ? "btn-active text-primary" : ""
                        }`}
                        aria-label={
                          scheduleAt ? "Edit scheduled send" : "Schedule send"
                        }
                        aria-pressed={showSchedulePicker || !!scheduleAt}
                        title={scheduleAt ? "Edit scheduled send" : "Schedule send"}
                        disabled={!activeContactId || useTemplateSend}
                        onClick={() => setShowSchedulePicker((v) => !v)}
                      >
                        <Clock className="h-5 w-5" aria-hidden />
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary min-w-[4.5rem] px-4 sm:min-w-0"
                        onClick={handleSend}
                        disabled={!canSend}
                      >
                        {sending ? (
                          <span className="loading loading-spinner" />
                        ) : scheduleAt ? (
                          "Schedule"
                        ) : (
                          "Send"
                        )}
                      </button>
                    </div>
                  </div>
                </div>
                )}
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
            <div role="alert" className="mb-3 rounded-box border border-warning/30 border-l-2 border-l-warning bg-base-200 px-3 py-2 text-sm">
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

      <ConfirmDialog
        open={consentAction?.kind === "opt-out"}
        title="Mark contact as opted out"
        description="Future outbound messages to this contact will be refused at send time. The customer can be opted back in if this was a mistake."
        confirmLabel="Mark opted out"
        tone="warning"
        loading={consentBusy}
        onConfirm={() => {
          if (consentAction?.kind === "opt-out") {
            void applyConsent(consentAction.contactId, { isOptedOut: true });
          }
        }}
        onClose={() => {
          setConsentAction(null);
          setConsentError(null);
        }}
      />
      <ConfirmDialog
        open={consentAction?.kind === "restore"}
        title="Restore consent"
        description="The contact will be eligible for outbound messages again."
        confirmLabel="Restore"
        tone="primary"
        loading={consentBusy}
        onConfirm={() => {
          if (consentAction?.kind === "restore") {
            void applyConsent(consentAction.contactId, { isOptedOut: false });
          }
        }}
        onClose={() => {
          setConsentAction(null);
          setConsentError(null);
        }}
      />
      <ConfirmDialog
        open={consentAction?.kind === "block"}
        title="Block contact"
        description="Outbound messages will be refused and inbound messages will be suppressed from the inbox. Use opt-out for compliance requests; use block for abuse."
        confirmLabel="Block"
        tone="danger"
        loading={consentBusy}
        onConfirm={() => {
          if (consentAction?.kind === "block") {
            void applyConsent(consentAction.contactId, { isBlocked: true });
          }
        }}
        onClose={() => {
          setConsentAction(null);
          setConsentError(null);
        }}
      />
      <ConfirmDialog
        open={consentAction?.kind === "unblock"}
        title="Unblock contact"
        description="The contact will be able to receive messages again and their inbound messages will reappear in the inbox."
        confirmLabel="Unblock"
        tone="primary"
        loading={consentBusy}
        onConfirm={() => {
          if (consentAction?.kind === "unblock") {
            void applyConsent(consentAction.contactId, { isBlocked: false });
          }
        }}
        onClose={() => {
          setConsentAction(null);
          setConsentError(null);
        }}
      />

      <CreateTaskFromMessageModal
        open={createTaskFor !== null}
        contactId={
          selectedConversation?.contact?.id ??
          selectedConversation?.contactId ??
          undefined
        }
        conversationId={createTaskFor?.conversationId ?? selectedId ?? undefined}
        messageId={createTaskFor?.id ?? undefined}
        contactName={
          selectedConversation?.contact?.name ??
          selectedConversation?.contact?.phone ??
          undefined
        }
        messageText={createTaskFor?.text ?? undefined}
        onClose={() => setCreateTaskFor(null)}
      />
    </>
  );
}
