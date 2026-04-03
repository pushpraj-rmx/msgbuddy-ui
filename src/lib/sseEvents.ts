/**
 * Wire `type` strings from workspace SSE (`GET /v2/sse/workspace/:workspaceId`).
 * Align with backend docs; support legacy UPPER_SNAKE aliases during transition.
 */

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
