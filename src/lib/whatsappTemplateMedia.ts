import { mediaApi } from "@/lib/api";

export const MEDIA_HEADER_TYPES = new Set(["IMAGE", "VIDEO", "DOCUMENT"]);

export function isMediaHeaderType(
  t: string | null | undefined
): t is "IMAGE" | "VIDEO" | "DOCUMENT" {
  return t != null && MEDIA_HEADER_TYPES.has(t);
}

/** Workspace Media upload + WhatsApp prepare — ids are used as template variable values for header/carousel media. */
export type PreparedWhatsAppMedia = {
  /** Our internal `Media.id` (workspace media row id). */
  mediaId: string;
  /** Meta/WhatsApp Cloud API "attachment id" (WABA media id). */
  whatsappMediaId: string;
};

/** Upload to our backend storage and "prepare" in WhatsApp so we get a WABA attachment id. */
export async function uploadMediaAndPrepareWhatsApp(
  file: File
): Promise<PreparedWhatsAppMedia> {
  const res = (await mediaApi.upload(file)) as { id: string };
  const prepared = await mediaApi.prepareWhatsApp(res.id);
  return {
    mediaId: res.id,
    whatsappMediaId: prepared.whatsappMediaId,
  };
}

/** For campaigns: backend expects the internal workspace `Media.id` and resolves WABA id server-side. */
export async function uploadMediaRowIdAndPrepareWhatsApp(file: File): Promise<string> {
  const prepared = await uploadMediaAndPrepareWhatsApp(file);
  return prepared.mediaId;
}

/** For inbox template sends: Cloud API expects the WABA attachment id directly. */
export async function uploadWhatsAppAttachmentIdAndPrepareWhatsApp(
  file: File
): Promise<string> {
  const prepared = await uploadMediaAndPrepareWhatsApp(file);
  return prepared.whatsappMediaId;
}

export function carouselCardFileAccept(card: unknown): string {
  const fmt = String(
    (card as { headerFormat?: string })?.headerFormat ?? "IMAGE"
  ).toUpperCase();
  if (fmt === "VIDEO") return "video/mp4,video/3gpp";
  if (fmt === "DOCUMENT") {
    return "application/pdf,application/*";
  }
  return "image/jpeg,image/png,image/webp,image/gif";
}
