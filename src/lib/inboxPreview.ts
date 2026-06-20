/**
 * Pure helpers for the inbox conversation-list preview line. Extracted from
 * InboxClient so the logic (media/sticker/template labels + reaction-as-latest)
 * is unit-testable without rendering the whole inbox.
 */

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
