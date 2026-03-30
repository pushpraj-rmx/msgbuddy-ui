/** Known WhatsApp Cloud API delivery error codes — hints supplement API `errorMessage`, never replace it. */
export const WHATSAPP_DELIVERY_ERROR_HINTS: Record<
  string,
  { hint: string; href?: string }
> = {
  "131042": {
    hint: "Fix billing / currency: open Meta Business Manager and complete currency setup for this WhatsApp Business account.",
    href: "https://business.facebook.com/billing_hub/",
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
