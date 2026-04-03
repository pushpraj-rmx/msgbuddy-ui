"use client";

import { useMemo, useState } from "react";
import {
  type InboxMessage,
  formatDeliveryStatusLabel,
  getMessageType,
  getMediaKind,
  isFailedMessage,
  isProcessingMessage,
} from "@/lib/messaging";
import { resolveMediaUrlForUi } from "@/lib/mediaUrls";
import { getWhatsappDeliveryHint } from "@/lib/whatsappDeliveryErrors";

function formatFileSizeForDocument(bytes: number | null | undefined): string | null {
  if (bytes == null || typeof bytes !== "number" || bytes < 0 || !Number.isFinite(bytes)) {
    return null;
  }
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) {
    const kb = bytes / 1024;
    return kb < 10 ? `${kb.toFixed(1)} kB` : `${Math.round(kb)} kB`;
  }
  const mb = bytes / (1024 * 1024);
  return mb < 10 ? `${mb.toFixed(1)} MB` : `${Math.round(mb)} MB`;
}

function extensionFromFilename(name: string): string {
  const i = name.lastIndexOf(".");
  if (i < 0 || i === name.length - 1) return "";
  return name.slice(i + 1).toLowerCase();
}

/** User-facing type for subtitle line (e.g. PDF • 914 kB). */
function documentSubtitleType(filename: string, mime?: string | null): string {
  const ext = extensionFromFilename(filename);
  const m = (mime || "").toLowerCase();
  if (ext === "pdf" || m.includes("pdf")) return "PDF";
  if (ext === "docx") return "DOCX";
  if (ext === "doc") return "DOC";
  if (ext === "xlsx") return "XLSX";
  if (ext === "xls") return "XLS";
  if (ext === "pptx") return "PPTX";
  if (ext === "ppt") return "PPT";
  if (ext === "txt" || m === "text/plain") return "TXT";
  if (ext === "csv") return "CSV";
  if (ext) return ext.length <= 5 ? ext.toUpperCase() : ext.slice(0, 5).toUpperCase();
  if (m.includes("word")) return "DOC";
  if (m.includes("sheet") || m.includes("excel")) return "XLS";
  if (m.includes("presentation")) return "PPT";
  return "FILE";
}

/** Short text inside the square badge (max ~3 chars). */
function documentBadgeText(filename: string, mime?: string | null): string {
  const ext = extensionFromFilename(filename);
  const map: Record<string, string> = {
    pdf: "PDF",
    doc: "DOC",
    docx: "DOC",
    xls: "XLS",
    xlsx: "XLS",
    ppt: "PPT",
    pptx: "PPT",
    txt: "TXT",
    csv: "CSV",
  };
  if (ext && map[ext]) return map[ext];
  return documentSubtitleType(filename, mime).slice(0, 3);
}

/** Badge: WhatsApp-like colored square with short type text. */
function documentBadgeClass(filename: string, mime?: string | null): string {
  const ext = extensionFromFilename(filename);
  if (ext === "pdf" || (mime || "").includes("pdf")) {
    return "bg-error text-error-content";
  }
  if (["doc", "docx"].includes(ext)) {
    return "bg-info text-info-content";
  }
  if (["xls", "xlsx", "csv"].includes(ext)) {
    return "bg-success text-success-content";
  }
  if (["ppt", "pptx"].includes(ext)) {
    return "bg-warning text-warning-content";
  }
  if (ext === "txt" || (mime || "").startsWith("text/")) {
    return "bg-neutral text-neutral-content";
  }
  return "bg-primary text-primary-content";
}

function formatMessageTimeShort(iso?: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function bubbleClassName(message: InboxMessage, failed: boolean): string {
  if (failed) return "chat-bubble-error";
  if (isProcessingMessage(message)) return "chat-bubble-neutral";
  return "chat-bubble-primary";
}

/** 1px frame on images; color matches bubble variant. */
function imageFrameClassForBubble(
  message: InboxMessage,
  failed: boolean
): string {
  const base = "border rounded-box";
  if (failed) return `${base} border-error-content/40`;
  if (isProcessingMessage(message)) return `${base} border-neutral-content/35`;
  return `${base} border-primary-content/35`;
}

function isRichMediaBubble(message: InboxMessage): boolean {
  const k = getMediaKind(message);
  return (
    k === "image" ||
    k === "video" ||
    k === "audio" ||
    k === "document"
  );
}

export function MessageBubble({ message }: { message: InboxMessage }) {
  const failed = isFailedMessage(message);
  const processing = isProcessingMessage(message);
  const hint = getWhatsappDeliveryHint(message.errorCode);
  const kind = getMessageType(message);
  const richMedia = isRichMediaBubble(message);
  const documentBubble = getMediaKind(message) === "document";

  let failedAtLabel: string | null = null;
  if (message.failedAt) {
    const d = new Date(message.failedAt);
    failedAtLabel = Number.isNaN(d.getTime()) ? null : d.toLocaleString();
  }

  const [imgBroken, setImgBroken] = useState(false);
  const [videoBroken, setVideoBroken] = useState(false);

  const resolvedMediaUrl = useMemo(
    () => resolveMediaUrlForUi(message.mediaUrl ?? undefined),
    [message.mediaUrl]
  );

  const imgFrame = imageFrameClassForBubble(message, failed);

  const body = (() => {
    if (kind === "VIDEO") {
      if (processing && !resolvedMediaUrl) {
        return (
          <div className="flex flex-col items-center gap-2 py-2 min-w-[8rem]">
            <span className="loading loading-spinner loading-md" />
            <span className="text-sm">Receiving…</span>
          </div>
        );
      }
      if (resolvedMediaUrl && !videoBroken) {
        return (
          <div className="flex flex-col gap-2">
            <video
              src={resolvedMediaUrl}
              controls
              playsInline
              className={`max-h-64 max-w-full object-contain ${imgFrame}`}
              onError={() => setVideoBroken(true)}
            />
            {message.text?.trim() ? (
              <p className="whitespace-pre-wrap text-sm">{message.text}</p>
            ) : null}
          </div>
        );
      }
      if (resolvedMediaUrl && videoBroken) {
        return (
          <div className="flex flex-col gap-2 text-sm">
            <span className="text-base-content/70">
              Couldn&apos;t load this video. The link may be wrong, expired, or blocked.
            </span>
            {message.text?.trim() ? (
              <p className="whitespace-pre-wrap">{message.text}</p>
            ) : null}
          </div>
        );
      }
      return (
        <div className="text-sm text-base-content/80">
          {message.text?.trim() || "Video"}
        </div>
      );
    }

    if (kind === "AUDIO") {
      if (processing && !resolvedMediaUrl) {
        return (
          <div className="flex flex-col items-center gap-2 py-2 min-w-[8rem]">
            <span className="loading loading-spinner loading-md" />
            <span className="text-sm">Receiving…</span>
          </div>
        );
      }
      if (resolvedMediaUrl) {
        return (
          <div className="flex flex-col gap-2">
            <audio src={resolvedMediaUrl} controls className="w-full max-w-sm" />
            {message.text?.trim() ? (
              <p className="whitespace-pre-wrap text-sm">{message.text}</p>
            ) : null}
          </div>
        );
      }
      return (
        <div className="text-sm text-base-content/80">
          {message.text?.trim() || "Audio"}
        </div>
      );
    }

    if (kind === "DOCUMENT") {
      const docName = message.mediaFilename?.trim() || "Document";
      const sizeStr = formatFileSizeForDocument(message.mediaSize ?? undefined);
      const typeStr = documentSubtitleType(docName, message.mediaMimeType);
      const metaLine =
        sizeStr != null ? `${typeStr} • ${sizeStr}` : typeStr;
      const timeStr = formatMessageTimeShort(message.createdAt);
      const badgeText = documentBadgeText(docName, message.mediaMimeType);
      const badgeClass = documentBadgeClass(docName, message.mediaMimeType);

      if (processing && !resolvedMediaUrl) {
        return (
          <div className="min-w-[12rem] max-w-[18rem] overflow-hidden rounded-box bg-base-300/40">
            <div className="flex gap-3 px-3 pt-3 pb-2">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-box bg-base-300">
                <span className="loading loading-spinner loading-sm text-base-content/70" />
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <p className="truncate text-sm font-medium text-base-content">
                  {docName}
                </p>
                <p className="text-xs text-base-content/55">{metaLine}</p>
              </div>
            </div>
            <div className="flex justify-end border-t border-base-content/10 px-3 py-1.5">
              {timeStr ? (
                <span className="text-xs tabular-nums text-base-content/50">
                  {timeStr}
                </span>
              ) : (
                <span className="text-xs text-base-content/50">Receiving…</span>
              )}
            </div>
          </div>
        );
      }
      if (resolvedMediaUrl) {
        return (
          <div className="flex flex-col gap-2">
            <a
              href={resolvedMediaUrl}
              target="_blank"
              rel="noopener noreferrer"
              download={message.mediaFilename || undefined}
              className="block min-w-[12rem] max-w-[18rem] overflow-hidden rounded-box bg-base-300/45 outline-none ring-primary/0 transition-[box-shadow] hover:bg-base-300/55 focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <div className="flex gap-3 px-3 pt-3 pb-2">
                <div
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-box text-xs font-bold leading-none ${badgeClass}`}
                  aria-hidden
                >
                  {badgeText}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-base-content">
                    {docName}
                  </p>
                  <p className="mt-0.5 text-xs text-base-content/55">{metaLine}</p>
                </div>
              </div>
              <div className="flex justify-end border-t border-base-content/10 px-3 py-1.5">
                <span className="text-xs tabular-nums text-base-content/50">
                  {timeStr ?? "—"}
                </span>
              </div>
            </a>
            {message.text?.trim() ? (
              <p className="whitespace-pre-wrap px-0.5 text-sm text-base-content/90">
                {message.text}
              </p>
            ) : null}
          </div>
        );
      }
      return (
        <div className="text-sm text-base-content/80">
          {message.text?.trim() || docName}
        </div>
      );
    }

    if (kind === "IMAGE") {
      if (processing && !resolvedMediaUrl) {
        return (
          <div className="flex flex-col items-center gap-2 py-2 min-w-[8rem]">
            <span className="loading loading-spinner loading-md" />
            <span className="text-sm">Receiving…</span>
          </div>
        );
      }
      if (processing && resolvedMediaUrl) {
        return (
          <div className="flex flex-col gap-2">
            {!imgBroken ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={resolvedMediaUrl}
                alt=""
                className={`max-h-48 w-full object-contain opacity-70 ${imgFrame}`}
                onError={() => setImgBroken(true)}
              />
            ) : (
              <div className="flex flex-col items-center gap-2 py-2">
                <span className="loading loading-spinner loading-md" />
                <span className="text-sm">Receiving…</span>
              </div>
            )}
            {message.text?.trim() ? (
              <p className="whitespace-pre-wrap text-sm">{message.text}</p>
            ) : null}
          </div>
        );
      }
      if (resolvedMediaUrl && !imgBroken) {
        return (
          <div className="flex flex-col gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={resolvedMediaUrl}
              alt=""
              className={`max-h-64 max-w-full object-contain ${imgFrame}`}
              onError={() => setImgBroken(true)}
            />
            {message.text?.trim() ? (
              <p className="whitespace-pre-wrap text-sm">{message.text}</p>
            ) : null}
          </div>
        );
      }
      if (resolvedMediaUrl && imgBroken) {
        return (
          <div className="flex flex-col gap-2 text-sm">
            <span className="text-base-content/70">
              Couldn&apos;t load this image. The link may be wrong, expired, or blocked.
            </span>
            {message.text?.trim() ? (
              <p className="whitespace-pre-wrap">{message.text}</p>
            ) : null}
          </div>
        );
      }
      return (
        <div className="text-sm text-base-content/80">
          {message.text?.trim() || "Image"}
        </div>
      );
    }

    if (kind === "TEMPLATE") {
      return (
        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-base-content/60">
            WhatsApp template
          </span>
          <div className="whitespace-pre-wrap">
            {message.text?.trim() ?? ""}
          </div>
        </div>
      );
    }

    if (kind === "INTERACTIVE") {
      return (
        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-base-content/60">
            Interactive
          </span>
          <div className="whitespace-pre-wrap">
            {message.text?.trim() || "—"}
          </div>
        </div>
      );
    }

    if (kind === "TEXT") {
      return (
        <div className="whitespace-pre-wrap">
          {message.text?.trim() ?? ""}
        </div>
      );
    }

    return (
      <div className="text-sm text-base-content/80">
        This message type isn&apos;t shown in the app yet.
      </div>
    );
  })();

  return (
    <div
      className={`chat ${
        message.direction === "OUTBOUND" ? "chat-end" : "chat-start"
      }`}
    >
      <div
        className={`chat-bubble max-w-[min(85%,28rem)] rounded-box leading-relaxed ${
          documentBubble ? "p-0" : richMedia ? "p-1" : "px-3 py-2"
        } ${bubbleClassName(message, failed)}`}
      >
        {body}
      </div>
      {failed ? (
        <div
          className={`mt-2 max-w-[min(85%,28rem)] ${
            message.direction === "OUTBOUND" ? "ml-auto" : ""
          }`}
        >
          {hint.hint && (hint.hint.length > 120 || hint.href) ? (
            <details className="rounded-box border border-error/40 bg-error/5 px-3 py-2">
              <summary className="cursor-pointer list-none text-sm font-medium text-error [&::-webkit-details-marker]:hidden">
                {message.errorMessage?.trim() || "Delivery failed"}{" "}
                <span className="text-xs font-normal text-base-content/60">
                  (details)
                </span>
              </summary>
              <div className="mt-2 flex flex-col gap-1 border-t border-error/20 pt-2 text-left text-xs text-base-content/90">
                {hint.hint ? (
                  <span>
                    {hint.hint}
                    {hint.href ? (
                      <>
                        {" "}
                        <a
                          href={hint.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="link link-primary"
                        >
                          Open Business Manager
                        </a>
                      </>
                    ) : null}
                  </span>
                ) : null}
                {message.errorCode ? (
                  <span className="text-base-content/60">
                    Code {message.errorCode}
                  </span>
                ) : null}
                {failedAtLabel ? (
                  <span className="text-base-content/60">{failedAtLabel}</span>
                ) : null}
              </div>
            </details>
          ) : (
            <div
              role="alert"
              className="alert alert-error alert-soft text-sm py-2"
            >
              <div className="flex flex-col gap-1 text-left">
                <span>
                  {message.errorMessage?.trim() || "Delivery failed"}
                </span>
                {hint.hint ? (
                  <span className="text-xs opacity-90">
                    {hint.hint}
                    {hint.href ? (
                      <>
                        {" "}
                        <a
                          href={hint.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="link link-primary"
                        >
                          Open Business Manager
                        </a>
                      </>
                    ) : null}
                  </span>
                ) : null}
                {message.errorCode ? (
                  <span className="text-xs text-base-content/60">
                    Code {message.errorCode}
                  </span>
                ) : null}
                {failedAtLabel ? (
                  <span className="text-xs text-base-content/60">
                    {failedAtLabel}
                  </span>
                ) : null}
              </div>
            </div>
          )}
        </div>
      ) : null}
      <div className="chat-footer mt-1 text-xs text-base-content/55">
        {formatDeliveryStatusLabel(message)}
      </div>
    </div>
  );
}
