/**
 * WhatsApp Cloud API media rules — keep in sync with backend
 * `whatsapp-cloud-api-media.constants.ts` / `FRONTEND_BACKEND_PARITY.md`.
 *
 * Graph resumable (`POST /{app-id}/uploads`) only supports a subset (e.g. JPEG, PNG,
 * MP4, PDF); other MIME types use the same HTTP session flow on our API, then WhatsApp
 * `/{phone-number-id}/media`. Clients should rely on **`mediaId`** (and `prepare-whatsapp`
 * when required); **`assetHandle`** may be absent on completion for non-Graph paths.
 */

export const WHATSAPP_CLOUD_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const WHATSAPP_CLOUD_WEBP_MAX_BYTES = 500 * 1024;
export const WHATSAPP_CLOUD_VIDEO_MAX_BYTES = 16 * 1024 * 1024;
export const WHATSAPP_CLOUD_AUDIO_MAX_BYTES = 16 * 1024 * 1024;
export const WHATSAPP_CLOUD_DOCUMENT_MAX_BYTES = 100 * 1024 * 1024;

/** Inbound/outbound image types (JPEG, PNG, WebP). */
export const WHATSAPP_IMAGE_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export const WHATSAPP_VIDEO_MIMES = new Set(["video/mp4", "video/3gpp"]);

/** WhatsApp Cloud API audio list (AAC, AMR, MPEG, MP4 audio, OGG). */
export const WHATSAPP_AUDIO_MIMES = new Set([
  "audio/aac",
  "audio/amr",
  "audio/mpeg",
  "audio/mp4",
  "audio/ogg",
  "audio/opus",
]);

export const WHATSAPP_DOCUMENT_MIMES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
]);

/** Meta Graph resumable upload (`/{app-id}/uploads`) — subset only. */
export const META_GRAPH_RESUMABLE_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "video/mp4",
  "application/pdf",
]);

/** Full WhatsApp Cloud API media MIME whitelist (union of categories). */
export const WHATSAPP_CLOUD_API_MEDIA_MIME_WHITELIST = new Set<string>([
  ...WHATSAPP_IMAGE_MIMES,
  ...WHATSAPP_VIDEO_MIMES,
  ...WHATSAPP_AUDIO_MIMES,
  ...WHATSAPP_DOCUMENT_MIMES,
]);

export function isWhatsappCloudApiMediaMime(mime: string): boolean {
  return WHATSAPP_CLOUD_API_MEDIA_MIME_WHITELIST.has(
    normalizeWhatsappMimeType(mime)
  );
}

/** Best-effort MIME from extension when `File.type` is empty or generic (parity with backend init). */
export function inferMimeFromFilenameForWhatsApp(name: string): string | null {
  const n = name.toLowerCase();
  if (/\.(jpe?g)$/i.test(n)) return "image/jpeg";
  if (/\.png$/i.test(n)) return "image/png";
  if (/\.webp$/i.test(n)) return "image/webp";
  if (/\.mp4$/i.test(n)) return "video/mp4";
  if (/\.(3gp|3gpp)$/i.test(n)) return "video/3gpp";
  if (/\.aac$/i.test(n)) return "audio/aac";
  if (/\.m4a$/i.test(n)) return "audio/mp4";
  if (/\.mp3$/i.test(n)) return "audio/mpeg";
  if (/\.amr$/i.test(n)) return "audio/amr";
  if (/\.ogg$/i.test(n)) return "audio/ogg";
  if (/\.opus$/i.test(n)) return "audio/opus";
  if (/\.pdf$/i.test(n)) return "application/pdf";
  if (/\.doc$/i.test(n)) return "application/msword";
  if (/\.docx$/i.test(n)) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  if (/\.xls$/i.test(n)) return "application/vnd.ms-excel";
  if (/\.xlsx$/i.test(n)) {
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  }
  if (/\.ppt$/i.test(n)) return "application/vnd.ms-powerpoint";
  if (/\.pptx$/i.test(n)) {
    return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  }
  if (/\.txt$/i.test(n)) return "text/plain";
  return null;
}

export function normalizeWhatsappMimeType(raw: string): string {
  const t = raw.trim().toLowerCase();
  if (t === "image/jpg") return "image/jpeg";
  return t;
}

/** Max upload size for a normalized MIME (matches backend `maxBytesForWhatsappCloudMediaMime`). */
export function maxBytesForWhatsappCloudMediaMime(mime: string): number {
  const m = normalizeWhatsappMimeType(mime);
  if (m === "image/webp") return WHATSAPP_CLOUD_WEBP_MAX_BYTES;
  if (m.startsWith("image/")) return WHATSAPP_CLOUD_IMAGE_MAX_BYTES;
  if (m.startsWith("video/")) return WHATSAPP_CLOUD_VIDEO_MAX_BYTES;
  if (m.startsWith("audio/")) return WHATSAPP_CLOUD_AUDIO_MAX_BYTES;
  return WHATSAPP_CLOUD_DOCUMENT_MAX_BYTES;
}

export function isMetaGraphResumableMime(mime: string): boolean {
  return META_GRAPH_RESUMABLE_MIMES.has(normalizeWhatsappMimeType(mime));
}
