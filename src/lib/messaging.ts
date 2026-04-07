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
  | "PENDING"
  | "PROCESSING"
  | "QUEUED"
  | "SENT"
  | "DELIVERED"
  | "READ"
  | "FAILED";

/** Shape returned by GET /messages/conversation/:id */
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
export function formatDeliveryStatusLabel(message: InboxMessage): string {
  if (isFailedMessage(message)) return "Failed";
  const raw = message.status?.trim();
  if (!raw) return "Sent";
  const upper = raw.toUpperCase();
  switch (upper) {
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
    default:
      return upper
        .replace(/_/g, " ")
        .toLowerCase()
        .replace(/\b\w/g, (c) => c.toUpperCase());
  }
}
