"use client";

import { useState, useRef, useCallback } from "react";
import { uploadsApi } from "@/lib/api";
import {
  inferMimeFromFilenameForWhatsApp,
  maxBytesForWhatsappCloudMediaMime,
  normalizeWhatsappMimeType,
  WHATSAPP_CLOUD_API_MEDIA_MIME_WHITELIST,
} from "@/lib/whatsappCloudMedia";

function formatMaxLabel(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    const mb = bytes / (1024 * 1024);
    return mb < 10 ? `${mb.toFixed(1)} MB` : `${Math.round(mb)} MB`;
  }
  return `${Math.round(bytes / 1024)} KB`;
}

function validateFile(file: File): string | null {
  const raw = file.type?.trim() || "";
  const normalized = normalizeWhatsappMimeType(raw);
  const effective =
    normalized && normalized !== "application/octet-stream"
      ? normalized
      : inferMimeFromFilenameForWhatsApp(file.name) ?? "";
  if (!effective || !WHATSAPP_CLOUD_API_MEDIA_MIME_WHITELIST.has(effective)) {
    return "Invalid file type. Use types supported by WhatsApp Cloud API (images, video, audio, PDF, Office, text).";
  }
  const max = maxBytesForWhatsappCloudMediaMime(effective);
  if (file.size > max) {
    return `File too large for this type (max ${formatMaxLabel(max)}).`;
  }
  return null;
}

/**
 * Resumable upload for template headers / media library.
 * Prefer **`mediaId`** when the API returns it; **`assetHandle`** may be absent for non–Graph-resumable MIME types.
 */
export function useResumableUpload(): {
  upload: (file: File) => Promise<string>;
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
    async (file: File): Promise<string> => {
      setError(null);
      setProgress(0);
      cancelledRef.current = false;

      const validationError = validateFile(file);
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

        const ref = result.mediaId ?? result.assetHandle;
        if (!ref) {
          throw new Error("Upload completed without media reference");
        }

        setProgress(100);
        return ref;
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
