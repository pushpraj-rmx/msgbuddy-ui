"use client";

import { useState, useRef, useCallback } from "react";
import { uploadsApi } from "@/lib/api";

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "video/mp4",
  "application/pdf",
] as const;

const MAX_FILE_SIZE_BYTES = 16 * 1024 * 1024; // 16 MB

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

      if (!ALLOWED_TYPES.includes(file.type as (typeof ALLOWED_TYPES)[number])) {
        const msg = `Invalid file type. Allowed: ${ALLOWED_TYPES.join(", ")}`;
        setError(msg);
        throw new Error(msg);
      }
      if (file.size > MAX_FILE_SIZE_BYTES) {
        const msg = "File too large. Maximum size is 16 MB.";
        setError(msg);
        throw new Error(msg);
      }

      setUploading(true);
      sessionIdRef.current = null;

      try {
        const { uploadSessionId, file_length } = await uploadsApi.initUpload({
          file_name: file.name,
          file_length: file.size,
          file_type: file.type,
        });

        if (cancelledRef.current) throw new Error("Cancelled");

        sessionIdRef.current = uploadSessionId;
        const buffer = await file.arrayBuffer();

        if (cancelledRef.current) throw new Error("Cancelled");

        const result = await uploadsApi.uploadBytes(uploadSessionId, buffer);

        if (cancelledRef.current) throw new Error("Cancelled");

        if (result.status === 200) {
          setProgress(100);
          return result.assetHandle;
        }
        // 202 = partial; update progress. Single-shot send usually gets 200; if we get 202 we don't have assetHandle here.
        setProgress(
          Math.min(
            100,
            Math.round((result.bytes_received / file_length) * 100)
          )
        );
        const msg = "Upload incomplete (please retry)";
        setError(msg);
        throw new Error(msg);
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
