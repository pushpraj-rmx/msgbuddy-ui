/**
 * Pure helpers for the inbox conversation-list preview line. Extracted from
 * InboxClient so the logic (media/sticker/template labels + reaction-as-latest)
 * is unit-testable without rendering the whole inbox.
 */

export type CursorConversation = {
  id: string;
  lastMessageAt?: string | null;
};

function toTime(v?: string | null): number | null {
  if (!v) return null;
  const t = new Date(v).getTime();
  return Number.isNaN(t) ? null : t;
}

/** True when `a` sorts AFTER `b` under (lastMessageAt DESC NULLS LAST, id DESC). */
function sortsAfterInDbOrder(
  a: CursorConversation,
  b: CursorConversation,
): boolean {
  const at = toTime(a.lastMessageAt);
  const bt = toTime(b.lastMessageAt);
  if (at !== null && bt !== null) {
    if (at !== bt) return at < bt; // earlier timestamp sorts later under DESC
    return a.id < b.id; // smaller id sorts later under id DESC
  }
  if (at === null && bt !== null) return true; // NULLS LAST → a is after b
  if (at !== null && bt === null) return false;
  return a.id < b.id; // both null → id DESC
}

/**
 * The next-page cursor for the conversation list. The server paginates by
 * (lastMessageAt DESC NULLS LAST, id DESC), so the cursor must be the page's
 * item that sorts LAST in that order. That equals `items.at(-1)` for the default
 * sort, but NOT when the server re-sorts a page for display (e.g.
 * `oldestUnreadFirst` puts the oldest-unread at the top) — in which case
 * `items.at(-1)` is a mid-order row and "Load more" skips/repeats. Compute the
 * boundary from the page contents instead of trusting array position.
 */
export function dbOrderBoundaryId(items: CursorConversation[]): string | null {
  let boundary: CursorConversation | null = null;
  for (const c of items) {
    if (!boundary || sortsAfterInDbOrder(c, boundary)) boundary = c;
  }
  return boundary?.id ?? null;
}

export type PreviewLastMessage = {
  text?: string;
  type?: string;
  createdAt?: string;
};

export type PreviewConversation = {
  lastMessage?: PreviewLastMessage;
  lastReactionEmoji?: string | null;
  lastReactionAt?: string | null;
  lastReactionByContact?: boolean | null;
};

/** Subtitle for a conversation's last message (handles non-text types). */
export function lastMessagePreview(lastMessage?: PreviewLastMessage): string {
  if (!lastMessage) return "No messages";
  const t = lastMessage.text?.trim();
  if (t) return t;
  switch (lastMessage.type?.toUpperCase()) {
    case "IMAGE":
      return "Image";
    case "VIDEO":
      return "Video";
    case "AUDIO":
      return "Audio";
    case "DOCUMENT":
      return "Document";
    case "STICKER":
      return "Sticker";
    case "TEMPLATE":
      return "Template message";
    case "INTERACTIVE":
      return "Interactive message";
    default:
      return "No messages";
  }
}

/**
 * Preview line when the latest activity is a reaction — reactions aren't
 * messages, so they're tracked separately on the conversation and shown when
 * at/after the last message. Returns null when the normal last-message preview
 * should be used.
 */
export function reactionPreview(conversation: PreviewConversation): string | null {
  const at = conversation.lastReactionAt;
  const emoji = conversation.lastReactionEmoji;
  if (!at || !emoji) return null;
  const msgAt = conversation.lastMessage?.createdAt;
  if (msgAt && new Date(msgAt).getTime() > new Date(at).getTime()) return null;
  return conversation.lastReactionByContact
    ? `Reacted ${emoji}`
    : `You reacted ${emoji}`;
}
