/**
 * The Meta category of a template's WhatsApp channel template. Used to filter
 * which templates appear in each surface (Campaigns → MARKETING only; Chat →
 * MARKETING + UTILITY, hiding AUTHENTICATION) so the UI matches Meta's intended
 * usage and OTP/auth templates aren't accidentally sent.
 *
 * Category is included on the templates list response (the backend `include`s
 * channelTemplates with all fields), so no extra request is needed.
 */
type ChannelTemplateLike = {
  channel: string;
  deletedAt?: string | null;
  category?: string | null;
};

/** The non-deleted WhatsApp channel template's category, or null. */
export function getWaCategory(
  channelTemplates?: ChannelTemplateLike[] | null,
): string | null {
  const wa = (channelTemplates ?? []).find(
    (ct) => ct.channel === "WHATSAPP" && !ct.deletedAt,
  );
  return wa?.category ?? null;
}
