/**
 * WhatsApp Cloud API template `language` codes (subset). Default: `en`.
 * @see https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates
 */
export const WHATSAPP_TEMPLATE_LANGUAGE_OPTIONS: ReadonlyArray<{
  value: string;
  label: string;
}> = [
  { value: "en", label: "English" },
  { value: "en_US", label: "English (US)" },
  { value: "en_GB", label: "English (UK)" },
  { value: "en_AU", label: "English (Australia)" },
  { value: "es", label: "Spanish" },
  { value: "es_AR", label: "Spanish (Argentina)" },
  { value: "es_ES", label: "Spanish (Spain)" },
  { value: "es_MX", label: "Spanish (Mexico)" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "it", label: "Italian" },
  { value: "pt_BR", label: "Portuguese (Brazil)" },
  { value: "pt_PT", label: "Portuguese (Portugal)" },
  { value: "hi", label: "Hindi" },
  { value: "id", label: "Indonesian" },
  { value: "ar", label: "Arabic" },
  { value: "tr", label: "Turkish" },
  { value: "ru", label: "Russian" },
  { value: "uk", label: "Ukrainian" },
  { value: "ja", label: "Japanese" },
  { value: "ko", label: "Korean" },
  { value: "zh_CN", label: "Chinese (China)" },
  { value: "zh_HK", label: "Chinese (Hong Kong)" },
  { value: "zh_TW", label: "Chinese (Taiwan)" },
  { value: "nl", label: "Dutch" },
  { value: "pl", label: "Polish" },
  { value: "sv", label: "Swedish" },
  { value: "vi", label: "Vietnamese" },
  { value: "th", label: "Thai" },
  { value: "fil", label: "Filipino" },
];

export const DEFAULT_WHATSAPP_TEMPLATE_LANGUAGE = "en";
