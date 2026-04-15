/**
 * Wire `type` strings from workspace SSE (`GET /v2/sse/workspace/:workspaceId`).
 * Align with backend docs; support legacy UPPER_SNAKE aliases during transition.
 */

import type { InboxMessage } from "./messaging";

export const SseWireType = {
  messageCreated: "message.created",
  messageStatusUpdated: "message.status_updated",
  conversationUpdated: "conversation.updated",
  conversationPresenceUpdated: "conversation.presence.updated",
  contactUpdated: "contact.updated",
  contactBulkUpdated: "contact.bulk_updated",
  channelTemplateCategoryPending: "channel_template.category.pending",
  whatsappAccountRestriction: "whatsapp.account.restriction",
  notificationCreated: "notification.created",
  campaignRunStarted: "campaign.run.started",
  campaignRunPaused: "campaign.run.paused",
  campaignRunResumed: "campaign.run.resumed",
  campaignRunCancelled: "campaign.run.cancelled",
  campaignRunCompleted: "campaign.run.completed",
  campaignRunProgress: "campaign.run.progress",
} as const;

/** Parse `EventSource` `event.data` JSON — supports flat `{ type, data? }` and nested `{ data: { type, data } }`. */
export function parseWorkspaceSseEvent(raw: string): {
  type: string;
  data: Record<string, unknown>;
} | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const o = parsed as Record<string, unknown>;

  const nested = o.data;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    const n = nested as Record<string, unknown>;
    if (
      typeof n.type === "string" &&
      n.data !== undefined &&
      typeof n.data === "object" &&
      n.data !== null &&
      !Array.isArray(n.data)
    ) {
      return {
        type: n.type,
        data: n.data as Record<string, unknown>,
      };
    }
  }

  if (typeof o.type === "string") {
    const inner =
      o.data !== undefined &&
      typeof o.data === "object" &&
      o.data !== null &&
      !Array.isArray(o.data)
        ? (o.data as Record<string, unknown>)
        : {};
    return { type: o.type, data: inner };
  }

  return null;
}

function optDateString(v: unknown): string | undefined {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "string") return v;
  return undefined;
}

function optDateStringOrNull(v: unknown): string | null {
  if (v == null) return null;
  const s = optDateString(v);
  return s ?? null;
}

/** Map SSE `message` field (GET /messages/conversation list row) into local inbox state. */
export function inboxMessageFromSseWire(raw: unknown): InboxMessage | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== "string" || typeof o.conversationId !== "string") return null;
  const direction =
    o.direction === "OUTBOUND" || o.direction === "INBOUND" ? o.direction : "INBOUND";
  return {
    id: o.id,
    conversationId: o.conversationId,
    direction,
    type: typeof o.type === "string" ? o.type : undefined,
    text: typeof o.text === "string" ? o.text : undefined,
    mediaId: o.mediaId == null ? null : String(o.mediaId),
    mediaUrl: o.mediaUrl == null ? null : String(o.mediaUrl),
    mediaMimeType: o.mediaMimeType == null ? null : String(o.mediaMimeType),
    mediaSize: typeof o.mediaSize === "number" ? o.mediaSize : null,
    mediaFilename:
      o.mediaFilename == null || o.mediaFilename === undefined
        ? null
        : String(o.mediaFilename),
    providerMessageId: o.providerMessageId == null ? null : String(o.providerMessageId),
    status: typeof o.status === "string" ? o.status : undefined,
    createdAt: optDateString(o.createdAt),
    sentAt: optDateStringOrNull(o.sentAt),
    deliveredAt: optDateStringOrNull(o.deliveredAt),
    readAt: optDateStringOrNull(o.readAt),
    errorCode: o.errorCode == null ? null : String(o.errorCode),
    errorMessage: o.errorMessage == null ? null : String(o.errorMessage),
    failedAt: optDateStringOrNull(o.failedAt),
    campaignId: o.campaignId == null ? null : String(o.campaignId),
  };
}

export function isMessageCreated(type: string): boolean {
  return (
    type === SseWireType.messageCreated || type === "MESSAGE_CREATED"
  );
}

export function isMessageStatusUpdated(type: string): boolean {
  return (
    type === SseWireType.messageStatusUpdated ||
    type === "MESSAGE_STATUS_UPDATED" ||
    type === "MESSAGE_UPDATED" ||
    type === "MESSAGE_STATUS_CHANGED"
  );
}

export function isConversationUpdated(type: string): boolean {
  return (
    type === SseWireType.conversationUpdated ||
    type === "CONVERSATION_UPDATED"
  );
}

export function isContactUpdated(type: string): boolean {
  return type === SseWireType.contactUpdated || type === "CONTACT_UPDATED";
}

export function isConversationPresenceUpdated(type: string): boolean {
  return (
    type === SseWireType.conversationPresenceUpdated ||
    type === "CONVERSATION_PRESENCE_UPDATED"
  );
}

export function isContactBulkUpdated(type: string): boolean {
  return (
    type === SseWireType.contactBulkUpdated ||
    type === "CONTACT_BULK_UPDATED"
  );
}

export function isChannelTemplateCategoryPending(type: string): boolean {
  return (
    type === SseWireType.channelTemplateCategoryPending ||
    type === "CHANNEL_TEMPLATE_CATEGORY_PENDING"
  );
}

export function isWhatsAppAccountRestriction(type: string): boolean {
  return (
    type === SseWireType.whatsappAccountRestriction ||
    type === "WHATSAPP_ACCOUNT_RESTRICTION"
  );
}

export function isNotificationCreated(type: string): boolean {
  return (
    type === SseWireType.notificationCreated || type === "NOTIFICATION_CREATED"
  );
}

export function isCampaignRunStarted(type: string): boolean {
  return type === SseWireType.campaignRunStarted;
}

export function isCampaignRunPaused(type: string): boolean {
  return type === SseWireType.campaignRunPaused;
}

export function isCampaignRunResumed(type: string): boolean {
  return type === SseWireType.campaignRunResumed;
}

export function isCampaignRunCancelled(type: string): boolean {
  return type === SseWireType.campaignRunCancelled;
}

export function isCampaignRunCompleted(type: string): boolean {
  return type === SseWireType.campaignRunCompleted;
}

export function isCampaignRunProgress(type: string): boolean {
  return type === SseWireType.campaignRunProgress;
}
