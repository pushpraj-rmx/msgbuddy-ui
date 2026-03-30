"use client";

import { useState, useRef, useCallback } from "react";
import { mediaApi, uploadsApi, type WhatsAppOutboundMediaType } from "@/lib/api";
import {
  inferMimeFromFilenameForWhatsApp,
  maxBytesForWhatsappCloudMediaMime,
  normalizeWhatsappMimeType,
  WHATSAPP_AUDIO_MIMES,
  WHATSAPP_DOCUMENT_MIMES,
  WHATSAPP_IMAGE_MIMES,
  WHATSAPP_VIDEO_MIMES,
} from "@/lib/whatsappCloudMedia";

const DOC_EXT = /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt)$/i;
const IMAGE_EXT = /\.(jpe?g|png|webp)$/i;
const VIDEO_EXT = /\.(mp4|3gp|3gpp)$/i;
const AUDIO_EXT = /\.(mp3|m4a|aac|amr|ogg|opus)$/i;

export function classifyWhatsAppMediaKind(file: File): WhatsAppOutboundMediaType {
  const t = normalizeWhatsappMimeType(file.type || "");
  const name = file.name.toLowerCase();

  if (t.startsWith("image/")) return "IMAGE";
  if (t.startsWith("video/")) return "VIDEO";
  if (t.startsWith("audio/")) return "AUDIO";
  if (WHATSAPP_DOCUMENT_MIMES.has(t)) return "DOCUMENT";
  if (t.startsWith("application/")) {
    if (DOC_EXT.test(name)) return "DOCUMENT";
  }
  if (WHATSAPP_IMAGE_MIMES.has(t)) return "IMAGE";
  if (WHATSAPP_VIDEO_MIMES.has(t)) return "VIDEO";
  if (WHATSAPP_AUDIO_MIMES.has(t)) return "AUDIO";
  if (!t || t === "application/octet-stream") {
    if (IMAGE_EXT.test(name)) return "IMAGE";
    if (VIDEO_EXT.test(name)) return "VIDEO";
    if (AUDIO_EXT.test(name)) return "AUDIO";
    if (DOC_EXT.test(name)) return "DOCUMENT";
  }
  return "DOCUMENT";
}

function effectiveMimeForLimits(file: File): string {
  const raw = file.type?.trim() || "";
  const normalized = normalizeWhatsappMimeType(raw);
  if (normalized && normalized !== "application/octet-stream") {
    return normalized;
  }
  return inferMimeFromFilenameForWhatsApp(file.name) ?? "application/octet-stream";
}

function formatMaxLabel(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    const mb = bytes / (1024 * 1024);
    return mb < 10 ? `${mb.toFixed(1)} MB` : `${Math.round(mb)} MB`;
  }
  return `${Math.round(bytes / 1024)} KB`;
}

function validateMimeForKind(
  file: File,
  kind: WhatsAppOutboundMediaType
): string | null {
  const t = normalizeWhatsappMimeType(file.type || "");
  const name = file.name.toLowerCase();

  const allow = (): boolean => {
    switch (kind) {
      case "IMAGE":
        return (
          WHATSAPP_IMAGE_MIMES.has(t) ||
          (!t && IMAGE_EXT.test(name))
        );
      case "VIDEO":
        return WHATSAPP_VIDEO_MIMES.has(t) || (!t && VIDEO_EXT.test(name));
      case "AUDIO":
        return WHATSAPP_AUDIO_MIMES.has(t) || (!t && AUDIO_EXT.test(name));
      case "DOCUMENT":
        if (WHATSAPP_DOCUMENT_MIMES.has(t)) return true;
        if (t === "application/octet-stream" && DOC_EXT.test(name)) return true;
        if (!t && DOC_EXT.test(name)) return true;
        return false;
      default:
        return false;
    }
  };

  if (!allow()) {
    return "This file type is not supported for WhatsApp. Use JPEG/PNG/WebP images, MP4/3GPP video, supported audio types, or PDF/Office documents.";
  }

  const mimeForMax = effectiveMimeForLimits(file);
  const max = maxBytesForWhatsappCloudMediaMime(mimeForMax);
  if (file.size > max) {
    return `File is too large for this type (max ${formatMaxLabel(max)}).`;
  }

  return null;
}

/**
 * Resumable upload → `mediaId` → `POST /v2/media/:id/prepare-whatsapp` for WhatsApp send.
 * Completion may omit `assetHandle` when Meta Graph resumable was not used; **`mediaId`** is authoritative.
 */
export function useInboxWhatsAppMediaUpload(): {
  upload: (
    file: File
  ) => Promise<{ mediaId: string; kind: WhatsAppOutboundMediaType }>;
  progress: number;
  uploading: boolean;
  error: string | null;
  cancel: () => void;
} {
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const cancelledRef = useRef(false);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    const sid = sessionIdRef.current;
    if (sid) {
      sessionIdRef.current = null;
      uploadsApi.cancelSession(sid).catch(() => {});
    }
    setUploading(false);
    setProgress(0);
  }, []);

  const upload = useCallback(
    async (
      file: File
    ): Promise<{ mediaId: string; kind: WhatsAppOutboundMediaType }> => {
      setError(null);
      setProgress(0);
      cancelledRef.current = false;

      const kind = classifyWhatsAppMediaKind(file);
      const validationError = validateMimeForKind(file, kind);
      if (validationError) {
        setError(validationError);
        throw new Error(validationError);
      }

      setUploading(true);
      sessionIdRef.current = null;

      try {
        const { uploadSessionId } = await uploadsApi.initUpload({
          file_name: file.name,
          file_length: file.size,
          file_type: normalizeWhatsappMimeType(
            file.type || "application/octet-stream"
          ),
        });

        if (cancelledRef.current) throw new Error("Cancelled");

        sessionIdRef.current = uploadSessionId;
        const buffer = await file.arrayBuffer();

        if (cancelledRef.current) throw new Error("Cancelled");

        const result = await uploadsApi.uploadFullFile(
          uploadSessionId,
          buffer,
          (received, total) => {
            if (cancelledRef.current) return;
            setProgress(
              Math.min(99, Math.round((received / Math.max(total, 1)) * 100))
            );
          }
        );

        if (cancelledRef.current) throw new Error("Cancelled");

        if (!result.mediaId) {
          const msg = "File is still processing; try again in a moment.";
          setError(msg);
          throw new Error(msg);
        }

        await mediaApi.prepareWhatsApp(result.mediaId);

        if (cancelledRef.current) throw new Error("Cancelled");

        setProgress(100);
        return { mediaId: result.mediaId, kind };
      } catch (e) {
        const message =
          e instanceof Error ? e.message : "Upload failed";
        if (!cancelledRef.current) setError(message);
        throw e;
      } finally {
        if (!cancelledRef.current) setUploading(false);
        sessionIdRef.current = null;
      }
    },
    []
  );

  return { upload, progress, uploading, error, cancel };
}
