"use client";

import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { feedbackApi, uploadsApi } from "@/lib/api";
import type { CreateFeedbackPayload } from "@/lib/api";
import type { FeedbackAttachment, FeedbackType, FeedbackPriority } from "@/lib/types";
import { RichTextEditor } from "@/components/ui/RichTextEditor";
import { useScreenRecorder } from "@/hooks/use-screen-recorder";

const PRIORITIES: { value: FeedbackPriority; label: string }[] = [
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
  { value: "CRITICAL", label: "Critical" },
];

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

interface FeedbackFormModalProps {
  initialType?: FeedbackType;
  onClose: () => void;
}

export function FeedbackFormModal({ initialType = "BUG", onClose }: FeedbackFormModalProps) {
  const queryClient = useQueryClient();
  const [type, setType] = useState<FeedbackType>(initialType);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<FeedbackPriority>("MEDIUM");
  const [attachments, setAttachments] = useState<FeedbackAttachment[]>([]);
  const [uploading, setUploading] = useState(false);

  const screenshotRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { start, stop, cancel, recording, durationMs, error: recorderError } = useScreenRecorder();

  async function uploadFile(file: File): Promise<FeedbackAttachment> {
    const buffer = await file.arrayBuffer();
    const session = await uploadsApi.initUpload({
      file_name: file.name,
      file_length: buffer.byteLength,
      file_type: file.type,
    });
    const result = await uploadsApi.uploadFullFile(session.uploadSessionId, buffer);
    return {
      url: result.assetHandle,
      name: file.name,
      mimeType: file.type,
      size: file.size,
    };
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const uploaded = await Promise.all(Array.from(files).map(uploadFile));
      setAttachments((prev) => [...prev, ...uploaded]);
    } catch {
      // silently ignore upload errors — attachment is just not added
    } finally {
      setUploading(false);
    }
  }

  async function handleStopRecording() {
    try {
      const file = await stop();
      setUploading(true);
      const att = await uploadFile(file);
      setAttachments((prev) => [...prev, att]);
    } catch {
      // ignore
    } finally {
      setUploading(false);
    }
  }

  const submit = useMutation({
    mutationFn: async () => {
      const metadata: Record<string, unknown> = {
        userAgent: navigator.userAgent,
        pageUrl: window.location.href,
        viewport: `${window.innerWidth}x${window.innerHeight}`,
      };

      const payload: CreateFeedbackPayload = {
        type,
        title: title.trim(),
        description,
        ...(type === "BUG" ? { priority } : {}),
        attachments: attachments.length ? attachments : undefined,
        metadata,
      };

      return feedbackApi.create(payload);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["feedback"] });
      onClose();
    },
  });

  const titleMax = 120;

  return (
    <dialog className="modal modal-open" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
          onClick={onClose}
        >
          ✕
        </button>

        <h3 className="font-semibold text-base mb-4">
          {type === "BUG" ? "Report a Bug" : "Request a Feature"}
        </h3>

        {/* Type toggle */}
        <div className="join mb-4 w-full">
          <button
            type="button"
            className={`btn btn-sm join-item flex-1 ${type === "BUG" ? "btn-primary" : "btn-outline"}`}
            onClick={() => setType("BUG")}
          >
            Bug Report
          </button>
          <button
            type="button"
            className={`btn btn-sm join-item flex-1 ${type === "FEATURE_REQUEST" ? "btn-primary" : "btn-outline"}`}
            onClick={() => setType("FEATURE_REQUEST")}
          >
            Feature Request
          </button>
        </div>

        <div className="space-y-4">
          {/* Title */}
          <div>
            <div className="flex justify-between mb-1">
              <label className="text-sm font-medium">Title</label>
              <span className="text-xs text-base-content/50">{title.length}/{titleMax}</span>
            </div>
            <input
              type="text"
              className="input input-bordered input-sm w-full"
              placeholder={type === "BUG" ? "Brief description of the bug" : "What feature would you like?"}
              value={title}
              maxLength={titleMax}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-sm font-medium block mb-1">Description</label>
            <RichTextEditor
              value={description}
              onChange={setDescription}
              placeholder={
                type === "BUG"
                  ? "Steps to reproduce, expected vs actual behavior…"
                  : "Describe the feature and the problem it solves…"
              }
            />
          </div>

          {/* Priority (bugs only) */}
          {type === "BUG" && (
            <div>
              <label className="text-sm font-medium block mb-1">Priority</label>
              <div className="join">
                {PRIORITIES.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    className={`btn btn-xs join-item ${priority === p.value ? "btn-primary" : "btn-outline"}`}
                    onClick={() => setPriority(p.value)}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Attachments */}
          <div>
            <label className="text-sm font-medium block mb-2">Attachments</label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-xs btn-outline"
                onClick={() => screenshotRef.current?.click()}
                disabled={uploading}
              >
                Add Screenshot
              </button>
              <button
                type="button"
                className="btn btn-xs btn-outline"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
              >
                Attach File
              </button>
              {!recording ? (
                <button
                  type="button"
                  className="btn btn-xs btn-outline"
                  onClick={start}
                  disabled={uploading}
                >
                  Record Screen
                </button>
              ) : (
                <>
                  <span className="btn btn-xs btn-error no-animation">
                    ● {formatDuration(durationMs)}
                  </span>
                  <button
                    type="button"
                    className="btn btn-xs btn-primary"
                    onClick={handleStopRecording}
                  >
                    Stop
                  </button>
                  <button
                    type="button"
                    className="btn btn-xs btn-ghost"
                    onClick={cancel}
                  >
                    Cancel
                  </button>
                </>
              )}
            </div>
            {recorderError && (
              <p className="text-xs text-error mt-1">{recorderError}</p>
            )}
            {uploading && (
              <p className="text-xs text-base-content/60 mt-1">Uploading…</p>
            )}
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {attachments.map((att, i) => (
                  <div
                    key={i}
                    className="relative group rounded border border-base-300 bg-base-200 overflow-hidden"
                    style={{ width: 72, height: 72 }}
                  >
                    {att.mimeType.startsWith("image/") ? (
                      <img
                        src={att.url}
                        alt={att.name}
                        className="w-full h-full object-cover"
                      />
                    ) : att.mimeType.startsWith("video/") ? (
                      <video
                        src={att.url}
                        className="w-full h-full object-cover"
                        muted
                      />
                    ) : (
                      <div className="flex items-center justify-center w-full h-full text-xs text-center p-1 text-base-content/60">
                        {att.name}
                      </div>
                    )}
                    <button
                      type="button"
                      className="absolute top-0.5 right-0.5 btn btn-circle btn-xs btn-error opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() =>
                        setAttachments((prev) => prev.filter((_, idx) => idx !== i))
                      }
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {submit.isError && (
          <p className="text-sm text-error mt-3">
            Failed to submit. Please try again.
          </p>
        )}

        <div className="modal-action mt-5">
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={!title.trim() || !description || description === "<p></p>" || submit.isPending || uploading}
            onClick={() => submit.mutate()}
          >
            {submit.isPending ? "Submitting…" : "Submit"}
          </button>
        </div>
      </div>

      <input
        ref={screenshotRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/*,video/*,application/pdf,.doc,.docx,.xls,.xlsx"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </dialog>
  );
}
