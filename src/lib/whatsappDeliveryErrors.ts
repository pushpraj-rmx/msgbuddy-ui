/**
 * Known WhatsApp Cloud API delivery error codes — hints SUPPLEMENT the API's
 * `errorMessage` (never replace it). Codes sourced from Meta's
 * "Error codes for the Cloud API" reference. Keep this list focused on the
 * ~15 codes that account for nearly all support tickets; everything else
 * falls through with raw code + message.
 *
 * https://developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes/
 */
export const WHATSAPP_DELIVERY_ERROR_HINTS: Record<
  string,
  { hint: string; href?: string }
> = {
  // ── Account / billing ────────────────────────────────────────────────
  "131042": {
    hint: "Billing / currency setup incomplete on this WhatsApp Business Account. Open Meta Business Manager and finish payment configuration.",
    href: "https://business.facebook.com/billing_hub/",
  },
  "131031": {
    hint: "Account temporarily locked by Meta — usually a quality-rating drop. Check WhatsApp Manager for the restriction reason.",
    href: "https://business.facebook.com/wa/manage/home/",
  },
  "133000": {
    hint: "Concurrent registration request in flight. Wait a minute and try again — only one registration can be active per number.",
  },

  // ── Recipient / session ──────────────────────────────────────────────
  "131026": {
    hint: "Message undeliverable — recipient may have an outdated WhatsApp version, the number isn't on WhatsApp, or the device is offline for an extended period.",
  },
  "131047": {
    hint: "Free-form 24-hour window expired. Send an approved template to re-engage this contact.",
  },
  "131048": {
    hint: "Spam rate limit hit — Meta paused sends to this contact because too many messages went unanswered. Wait, then re-engage with a template.",
  },
  "131049": {
    hint: "Daily marketing message limit reached for this recipient. Retry tomorrow or send a utility template instead.",
  },
  "131021": {
    hint: "Sender and recipient are the same WhatsApp number — you can't message yourself from this account.",
  },

  // ── Template-specific (the hot path for template failures) ───────────
  "132000": {
    hint: "Template parameter count mismatch — the number of variables you passed doesn't match the approved template's placeholder count. Re-check the template definition.",
  },
  "132001": {
    hint: "Template not found. It may have been deleted, renamed, or not yet replicated by Meta. Re-pick a template from the list.",
  },
  "132005": {
    hint: "Template hydration failure — one of the variable values broke validation (often a URL/phone format inside a button variable).",
  },
  "132007": {
    hint: "Template content violated Meta's character / format policy. Edit the template in your library, resubmit for approval.",
  },
  "132012": {
    hint: "Variable format mismatch — a numeric / currency / date placeholder received a value that doesn't match its format spec.",
  },
  "132015": {
    hint: "Template paused by Meta (low quality rating). Improve message content or wait for the cooldown before retrying.",
  },
  "132016": {
    hint: "Template disabled by Meta after repeated low-quality flags. Submit a new version with revised wording.",
  },
  "132068": {
    hint: "Flow paused by Meta due to low quality. Review the flow definition and resubmit.",
  },

  // ── Media-specific ───────────────────────────────────────────────────
  "131053": {
    hint: "Media upload failed — file may be too large, an unsupported MIME type, or temporarily unreachable from Meta's servers.",
  },
};

export function getWhatsappDeliveryHint(errorCode: string | null | undefined): {
  hint?: string;
  href?: string;
} {
  if (errorCode == null || errorCode === "") return {};
  const entry = WHATSAPP_DELIVERY_ERROR_HINTS[errorCode];
  if (!entry) return {};
  return { hint: entry.hint, href: entry.href };
}
