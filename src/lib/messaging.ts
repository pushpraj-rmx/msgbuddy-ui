/** Wire values from GET /messages/conversation/:id — align with OpenAPI when it changes. */
export type MessageType =
  | "TEXT"
  | "IMAGE"
  | "VIDEO"
  | "AUDIO"
  | "DOCUMENT"
  | "TEMPLATE"
  | "INTERACTIVE";

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
      return "text";
    default:
      return "unknown";
  }
}

export function isFailedMessage(message: InboxMessage): boolean {
  const s = message.status?.toUpperCase();
  if (s === "FAILED") return true;
  if (message.failedAt) return true;
  return false;
}

export function isProcessingMessage(message: InboxMessage): boolean {
  return message.status?.toUpperCase() === "PROCESSING";
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
      return "Delivered";
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
