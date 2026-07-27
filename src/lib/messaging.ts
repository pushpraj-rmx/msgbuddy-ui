/** Wire values from GET /messages/conversation/:id — align with OpenAPI when it changes. */
export type MessageType =
  | "TEXT"
  | "IMAGE"
  | "VIDEO"
  | "AUDIO"
  | "DOCUMENT"
  | "TEMPLATE"
  | "INTERACTIVE"
  | "LOCATION";

export type MessageStatus =
  | "SCHEDULED"
  | "PENDING"
  | "PROCESSING"
  | "QUEUED"
  | "SENT"
  | "DELIVERED"
  | "READ"
  | "FAILED"
  | "CANCELLED";

/** Shape returned by GET /messages/conversation/:id */
/** Reaction row as returned over the wire by /messages/:id/react and SSE. */
export type MessageReactionWire = {
  id: string;
  emoji: string;
  /** Set when the reaction came from a customer; otherwise null. */
  actorContactId: string | null;
  /** Set when the reaction came from an agent; otherwise null. */
  actorUserId: string | null;
  createdAt: string;
  updatedAt: string;
};

/**
 * Hydrated template version (v2 list-endpoint enrichment) so the inbox can
 * render the same WhatsApp-styled preview the template builder shows, header
 * media / buttons / footer included. Only present on TEMPLATE-direction
 * messages where the version row still exists; legacy rows fall back to plain
 * text rendering.
 */
export type InboxMessageTemplateVersion = {
  id: string;
  body: string;
  headerType?: "NONE" | "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT" | null;
  headerContent?: string | null;
  headerPreviewUrl?: string | null;
  footer?: string | null;
  buttons?: unknown;
  layoutType?: "STANDARD" | "CAROUSEL" | null;
  carouselCards?: unknown;
  category?: "MARKETING" | "UTILITY" | "AUTHENTICATION" | null;
  language?: string | null;
};

export type InboxMessage = {
  id: string;
  conversationId: string;
  direction: "INBOUND" | "OUTBOUND";
  /** Defaults to TEXT when omitted (legacy payloads). */
  type?: MessageType | string;
  text?: string;
  mediaId?: string | null;
  mediaUrl?: string | null;
  mediaMimeType?: string | null;
  mediaSize?: number | null;
  /** Original filename for documents when provided by API. */
  mediaFilename?: string | null;
  providerMessageId?: string | null;
  status?: MessageStatus | string;
  createdAt?: string;
  sentAt?: string | null;
  deliveredAt?: string | null;
  readAt?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  failedAt?: string | null;
  campaignId?: string | null;
  isPinned?: boolean;
  pinnedAt?: string | null;
  isStarred?: boolean;
  starredAt?: string | null;
  sendAt?: string | null;
  reactions?: MessageReactionWire[];
  /** Flat map: keys positional ("1","2") OR named ("first_name"). */
  templateVariables?: Record<string, string> | null;
  /** Set when the message is a TEMPLATE and the linked version was hydrated. */
  channelTemplateVersion?: InboxMessageTemplateVersion | null;
  /**
   * Free-form JSON blob persisted alongside the message. LOCATION messages
   * carry their coordinates here under `location` — see {@link getMessageLocation}.
   */
  metadata?: Record<string, unknown> | null;
  /** Count of OPEN + SNOOZED tasks anchored to this message. Drives the
   *  small task badge on the bubble; 0 (or omitted on legacy payloads)
   *  hides the badge. */
  taskCount?: number;
};

/** Shape returned by GET /messages/conversation/:id/media */
export type MediaItem = {
  id: string;
  mediaId?: string | null;
  mediaUrl?: string | null;
  mediaMimeType?: string | null;
  mediaSize?: number | null;
  type: MessageType | string;
  direction: "INBOUND" | "OUTBOUND";
  createdAt: string;
};

/** Infer wire `type` from MIME when `message.type` is missing (legacy rows). */
export function inferMessageTypeFromMime(
  mime: string | null | undefined
): MessageType {
  if (!mime || typeof mime !== "string" || !mime.trim()) return "DOCUMENT";
  const m = mime.trim().toLowerCase();
  if (m.startsWith("image/")) return "IMAGE";
  if (m.startsWith("video/")) return "VIDEO";
  if (m.startsWith("audio/")) return "AUDIO";
  if (
    m === "application/pdf" ||
    m.includes("application/vnd.openxmlformats") ||
    m.includes("application/msword") ||
    m.includes("application/vnd.ms-excel") ||
    m.includes("application/vnd.ms-powerpoint") ||
    m.includes("text/plain")
  ) {
    return "DOCUMENT";
  }
  if (m === "application/octet-stream" || m === "") return "DOCUMENT";
  return "DOCUMENT";
}

export function getMessageType(message: InboxMessage): MessageType | string {
  const t = message.type;
  if (t && String(t).trim() !== "") return String(t).toUpperCase();
  if (message.mediaId || message.mediaUrl) {
    return inferMessageTypeFromMime(message.mediaMimeType ?? undefined);
  }
  return "TEXT";
}

/** Coordinates a contact shared, as persisted in `Message.metadata.location`. */
export type MessageLocation = {
  latitude: number;
  longitude: number;
  name: string | null;
  address: string | null;
};

/**
 * Read a LOCATION message's coordinates out of its untyped metadata blob.
 * Returns null when the message isn't a location or the blob is malformed —
 * callers should fall back to plain text rendering rather than showing a pin.
 */
export function getMessageLocation(
  message: Pick<InboxMessage, "metadata">
): MessageLocation | null {
  const metadata = message.metadata;
  if (!metadata || typeof metadata !== "object") return null;
  const raw = (metadata as Record<string, unknown>).location;
  if (!raw || typeof raw !== "object") return null;

  const { latitude, longitude, name, address } = raw as Record<string, unknown>;
  if (
    typeof latitude !== "number" ||
    !Number.isFinite(latitude) ||
    typeof longitude !== "number" ||
    !Number.isFinite(longitude)
  ) {
    return null;
  }
  return {
    latitude,
    longitude,
    name: typeof name === "string" && name.trim() ? name : null,
    address: typeof address === "string" && address.trim() ? address : null,
  };
}

/** Google Maps deep link for a shared pin. Opens the native app on mobile. */
export function googleMapsSearchUrl(
  latitude: number,
  longitude: number
): string {
  return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
}

export type MediaKind =
  | "text"
  | "image"
  | "video"
  | "audio"
  | "document"
  | "sticker"
  | "unknown";

/** Normalized kind for UI (bubbles, icons). */
export function getMediaKind(message: InboxMessage): MediaKind {
  const raw = getMessageType(message);
  const u = String(raw).toUpperCase();
  switch (u) {
    case "TEXT":
      return "text";
    case "IMAGE":
      return "image";
    case "VIDEO":
      return "video";
    case "AUDIO":
      return "audio";
    case "DOCUMENT":
      return "document";
    case "STICKER":
      return "sticker";
    case "TEMPLATE":
    case "INTERACTIVE":
    // A location pin renders as a card inside the normal (non-media) bubble
    // chrome — there is no media row behind it.
    case "LOCATION":
      return "text";
    default:
      return "unknown";
  }
}

/**
 * Minimal structural shape for delivery-status helpers/icons. Both full
 * {@link InboxMessage} and the lighter conversation-list `lastMessage` summary
 * satisfy it, so the same status logic can be reused in the conversation list.
 */
export type MessageStatusLike = {
  direction?: "INBOUND" | "OUTBOUND" | string;
  status?: MessageStatus | string | null;
  failedAt?: string | null;
};

export function isFailedMessage(message: MessageStatusLike): boolean {
  const s = message.status?.toUpperCase();
  if (s === "FAILED") return true;
  if (message.failedAt) return true;
  return false;
}

export function isProcessingMessage(message: InboxMessage): boolean {
  return message.status?.toUpperCase() === "PROCESSING";
}

/**
 * An outbound message that (a) failed to deliver AND (b) originated from a
 * campaign. Their failure is already surfaced in the campaign report, so the
 * conversation timeline collapses them into a single summary line rather than
 * rendering one red bubble each. Manual/hand-typed send failures (no
 * campaignId) are NOT collapsed — the agent still needs to see and retry them.
 */
export function isCampaignFailure(message: InboxMessage): boolean {
  return (
    message.direction === "OUTBOUND" &&
    !!message.campaignId &&
    isFailedMessage(message)
  );
}

/** A rendered timeline entry: either a normal message bubble, or a collapsed
 *  run of consecutive campaign delivery failures. */
export type TimelineItem =
  | { kind: "message"; message: InboxMessage }
  | { kind: "campaignFailures"; id: string; messages: InboxMessage[] };

/**
 * Collapse consecutive campaign-send failures into a single summary item so
 * they don't spam the conversation. Everything else (including manual send
 * failures and successfully-sent campaign messages) passes through untouched,
 * preserving chronological order. The summary item's id is derived from the
 * first collapsed message so React keys stay stable across re-renders.
 */
export function collapseCampaignFailures(
  messages: InboxMessage[]
): TimelineItem[] {
  const items: TimelineItem[] = [];
  for (const message of messages) {
    if (isCampaignFailure(message)) {
      const last = items[items.length - 1];
      if (last && last.kind === "campaignFailures") {
        last.messages.push(message);
      } else {
        items.push({
          kind: "campaignFailures",
          id: `cf-${message.id}`,
          messages: [message],
        });
      }
    } else {
      items.push({ kind: "message", message });
    }
  }
  return items;
}

/** Footer label for delivery pipeline — avoids showing "Sent" when status is explicit. */
/**
 * Human-readable absolute time for a future schedule. Pegs the relative
 * window so "in 35 minutes" reads better than "Today 03:00 PM" for short
 * horizons; longer ones get a date + time. Returns null when unparseable.
 */
function formatScheduledForLabel(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow =
    d.getFullYear() === tomorrow.getFullYear() &&
    d.getMonth() === tomorrow.getMonth() &&
    d.getDate() === tomorrow.getDate();

  const timeStr = d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (diffMs > 0 && diffMs < 60 * 60 * 1000) {
    const mins = Math.max(1, Math.round(diffMs / 60_000));
    return `in ${mins} min`;
  }
  if (sameDay) return `today · ${timeStr}`;
  if (isTomorrow) return `tomorrow · ${timeStr}`;
  // Within a week → weekday name; further → date.
  const withinWeek = diffMs > 0 && diffMs < 7 * 24 * 60 * 60 * 1000;
  const dateStr = withinWeek
    ? d.toLocaleDateString(undefined, { weekday: "short" })
    : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `${dateStr} · ${timeStr}`;
}

/**
 * Substitutes `{{N}}` / `{{name}}` placeholders in a WhatsApp template body
 * with the values from `templateVariables`. Mirrors the substitution the
 * Cloud API performs at delivery time, so the inbox bubble shows the same
 * thing the contact saw.
 *
 * - Whitespace inside braces is tolerated: `{{ 1 }}` matches key "1".
 * - Keys can be positional ("1","2") or named ("first_name") — backend DTO
 *   accepts both, often mixed in one payload, so the helper does too.
 * - Placeholders WITHOUT a matching value are left intact (NOT replaced with
 *   "undefined"). Better to surface the unresolved placeholder than to lie.
 */
export function substituteTemplateVariables(
  text: string | null | undefined,
  variables: Record<string, string> | null | undefined,
): string {
  if (!text) return "";
  if (!variables) return text;
  return text.replace(/\{\{\s*([\w-]+)\s*\}\}/g, (full, key: string) => {
    const v = variables[key];
    return typeof v === "string" ? v : full;
  });
}

export function formatDeliveryStatusLabel(message: InboxMessage): string {
  if (isFailedMessage(message)) return "Failed";
  const raw = message.status?.trim();
  if (!raw) return "Sent";
  const upper = raw.toUpperCase();
  switch (upper) {
    case "SCHEDULED": {
      const when = formatScheduledForLabel(message.sendAt);
      return when ? `Scheduled · ${when}` : "Scheduled";
    }
    case "PROCESSING":
      return message.direction === "INBOUND"
        ? "Receiving…"
        : "Processing…";
    case "PENDING":
      return "Pending";
    case "QUEUED":
      return "Sending…";
    case "SENT":
      return "Sent";
    case "DELIVERED":
      // Inbound deliveries are messages WE received — "Delivered" reads as if
      // the contact got something from us, which is misleading. Surface
      // "Received" instead.
      return message.direction === "INBOUND" ? "Received" : "Delivered";
    case "READ":
      return "Read";
    case "CANCELLED":
      return "Cancelled";
    default:
      return upper
        .replace(/_/g, " ")
        .toLowerCase()
        .replace(/\b\w/g, (c) => c.toUpperCase());
  }
}
