"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CheckSquare } from "lucide-react";
import {
  type InboxMessage,
  formatDeliveryStatusLabel,
  getMessageType,
  getMediaKind,
  isFailedMessage,
  isProcessingMessage,
  substituteTemplateVariables,
} from "@/lib/messaging";
import { resolveMediaUrlForUi } from "@/lib/mediaUrls";
import { getWhatsappDeliveryHint } from "@/lib/whatsappDeliveryErrors";
import { MessageContextMenu } from "@/components/inbox/MessageContextMenu";
import { MessageStatusIcon } from "@/components/inbox/MessageStatusIcon";
import { MediaLightbox } from "@/components/ui/MediaLightbox";
import {
  WhatsAppTemplatePreview,
  type WhatsAppTemplatePreviewProps,
} from "@/components/templates/WhatsAppTemplatePreview";

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

/**
 * Tinted-background variant of daisyUI's chat-bubble. Replaces the fully-
 * saturated `chat-bubble-primary` / `chat-bubble-secondary` (signal-green and
 * blue) with low-opacity backgrounds + soft same-color borders. Side meaning
 * (you vs them) still reads at a glance, but the bubbles no longer fight the
 * rest of the inbox. Aligns with the "borders-over-shadows, dark-first"
 * design language captured in MEMORY.
 */
function bubbleClassName(message: InboxMessage, failed: boolean): string {
  if (failed) {
    // Soft red wash + muted border — the dedicated error card under the bubble
    // does the heavy signalling, so the bubble itself just needs a tint.
    return "!bg-error/10 !border !border-error/30 !text-base-content";
  }
  if (isProcessingMessage(message)) {
    return "!bg-base-300/40 !border !border-base-content/15 !text-base-content";
  }
  // Stickers render transparent (no colored background) — WebP often carries
  // alpha and a tinted bubble fights the artwork.
  if (getMediaKind(message) === "sticker") return "!bg-transparent !p-0";
  if (message.direction === "OUTBOUND") {
    return "!bg-primary/12 !border !border-primary/25 !text-base-content";
  }
  return "!bg-secondary/10 !border !border-secondary/25 !text-base-content";
}

/** 1px frame on images; color matches bubble variant. */
function imageFrameClassForBubble(
  message: InboxMessage,
  failed: boolean
): string {
  const base = "border rounded-box";
  if (failed) return `${base} border-error-content/40`;
  if (isProcessingMessage(message)) return `${base} border-neutral-content/35`;
  if (message.direction === "OUTBOUND") return `${base} border-primary/30`;
  return `${base} border-secondary/30`;
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

interface MessageBubbleProps {
  message: InboxMessage;
  onPin?: (message: InboxMessage) => void;
  onStar?: (message: InboxMessage) => void;
  onReact?: (message: InboxMessage, emoji: string) => void;
  onUnreact?: (message: InboxMessage) => void;
  /** Re-enqueues a FAILED outbound message. Only shown when provided. */
  onRetry?: (message: InboxMessage) => void;
  /** Reflects the in-flight state of the parent's retry mutation. */
  retrying?: boolean;
  /** Soft-deletes a FAILED outbound message — hides it from the timeline. */
  onDiscard?: (message: InboxMessage) => void;
  /** Reflects the in-flight state of the parent's discard mutation. */
  discarding?: boolean;
  /** Opens the "Create task" modal pre-linked to this message's conversation/contact. */
  onCreateTask?: (message: InboxMessage) => void;
  /** Used to identify which reaction belongs to the current agent for "remove on click own". */
  currentUserId?: string | null;
  highlighted?: boolean;
}

const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"] as const;

export function MessageBubble({
  message,
  onPin,
  onStar,
  onReact,
  onUnreact,
  onRetry,
  retrying = false,
  onDiscard,
  discarding = false,
  onCreateTask,
  currentUserId,
  highlighted = false,
}: MessageBubbleProps) {
  const failed = isFailedMessage(message);
  const processing = isProcessingMessage(message);
  const hint = getWhatsappDeliveryHint(message.errorCode);
  const kind = getMessageType(message);
  const richMedia = isRichMediaBubble(message);
  const documentBubble = getMediaKind(message) === "document";
  const [menuPoint, setMenuPoint] = useState<{ x: number; y: number } | null>(null);

  let failedAtLabel: string | null = null;
  if (message.failedAt) {
    const d = new Date(message.failedAt);
    failedAtLabel = Number.isNaN(d.getTime()) ? null : d.toLocaleString();
  }

  const [imgBroken, setImgBroken] = useState(false);
  const [videoBroken, setVideoBroken] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const resolvedMediaUrl = useMemo(
    () => resolveMediaUrlForUi(message.mediaUrl ?? undefined),
    [message.mediaUrl]
  );

  const imgFrame = imageFrameClassForBubble(message, failed);
  const isAnimatedGif = (message.mediaMimeType ?? "").toLowerCase().includes("gif");

  const body = (() => {
    if (kind === "VIDEO") {
      if (processing && !resolvedMediaUrl) {
        return (
          <div className="flex flex-col items-center gap-2 py-2 min-w-[8rem]">
            <span className="loading loading-spinner loading-md" />
            <span>Receiving…</span>
          </div>
        );
      }
      if (resolvedMediaUrl && !videoBroken) {
        const mimeType = message.mediaMimeType?.trim() || "video/mp4";
        return (
          <>
            <div className="flex flex-col gap-2">
              {isAnimatedGif ? (
                <video
                  src={resolvedMediaUrl}
                  autoPlay
                  loop
                  muted
                  playsInline
                  className={`max-h-64 max-w-full object-contain ${imgFrame}`}
                  onError={() => setVideoBroken(true)}
                />
              ) : (
                <button
                  type="button"
                  className={`relative max-h-64 max-w-full overflow-hidden ${imgFrame}`}
                  onClick={() => setLightboxOpen(true)}
                  aria-label="Play video"
                >
                  <video
                    src={resolvedMediaUrl}
                    muted
                    playsInline
                    className="max-h-64 max-w-full object-contain"
                    onError={() => setVideoBroken(true)}
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-base-content/25">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-base-content/55 text-base-100">
                      <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5 translate-x-0.5">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </div>
                  </div>
                </button>
              )}
              {message.text?.trim() ? (
                <p className="whitespace-pre-wrap">{message.text}</p>
              ) : null}
            </div>
            {!isAnimatedGif && (
              <MediaLightbox
                open={lightboxOpen}
                slides={[{ type: "video", sources: [{ src: resolvedMediaUrl, type: mimeType }] }]}
                onClose={() => setLightboxOpen(false)}
              />
            )}
          </>
        );
      }
      if (resolvedMediaUrl && videoBroken) {
        return (
          <div className="flex flex-col gap-2">
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
        <div className="text-base-content/80">
          {message.text?.trim() || "Video"}
        </div>
      );
    }

    if (kind === "AUDIO") {
      if (processing && !resolvedMediaUrl) {
        return (
          <div className="flex flex-col items-center gap-2 py-2 min-w-[8rem]">
            <span className="loading loading-spinner loading-md" />
            <span>Receiving…</span>
          </div>
        );
      }
      if (resolvedMediaUrl) {
        return (
          <div className="flex flex-col gap-2">
            <audio src={resolvedMediaUrl} controls className="w-full max-w-sm" />
            {message.text?.trim() ? (
              <p className="whitespace-pre-wrap">{message.text}</p>
            ) : null}
          </div>
        );
      }
      return (
        <div className="text-base-content/80">
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
                <p className="truncate font-medium text-base-content">
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
                  <p className="truncate font-medium text-base-content">
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
              <p className="whitespace-pre-wrap text-base-content/90">
                {message.text}
              </p>
            ) : null}
          </div>
        );
      }
      return (
        <div className="text-base-content/80">
          {message.text?.trim() || docName}
        </div>
      );
    }

    if (kind === "STICKER") {
      // Stickers render small (~140px), no frame/background — WebP often has
      // an alpha channel and the bubble would compete visually. Skip the
      // lightbox affordance (stickers aren't meant to be inspected).
      if (processing && !resolvedMediaUrl) {
        return (
          <div className="flex flex-col items-center gap-2 py-2 min-w-[6rem]">
            <span className="loading loading-spinner loading-sm" />
            <span className="text-xs">Receiving sticker…</span>
          </div>
        );
      }
      if (resolvedMediaUrl && !imgBroken) {
        return (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={resolvedMediaUrl}
            alt="Sticker"
            className="max-h-36 max-w-36 object-contain"
            onError={() => setImgBroken(true)}
          />
        );
      }
      return (
        <div className="text-xs text-base-content/55">Sticker unavailable</div>
      );
    }

    if (kind === "IMAGE") {
      if (processing && !resolvedMediaUrl) {
        return (
          <div className="flex flex-col items-center gap-2 py-2 min-w-[8rem]">
            <span className="loading loading-spinner loading-md" />
            <span>Receiving…</span>
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
                <span>Receiving…</span>
              </div>
            )}
            {message.text?.trim() ? (
              <p className="whitespace-pre-wrap">{message.text}</p>
            ) : null}
          </div>
        );
      }
      if (resolvedMediaUrl && !imgBroken) {
        return (
          <>
            <div className="flex flex-col gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={resolvedMediaUrl}
                alt=""
                className={`max-h-64 max-w-full cursor-zoom-in object-contain ${imgFrame}`}
                onClick={() => setLightboxOpen(true)}
                onError={() => setImgBroken(true)}
              />
              {message.text?.trim() ? (
                <p className="whitespace-pre-wrap">{message.text}</p>
              ) : null}
            </div>
            <MediaLightbox
              open={lightboxOpen}
              slides={[{ type: "image", src: resolvedMediaUrl }]}
              onClose={() => setLightboxOpen(false)}
            />
          </>
        );
      }
      if (resolvedMediaUrl && imgBroken) {
        return (
          <div className="flex flex-col gap-2">
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
        <div className="text-base-content/80">
          {message.text?.trim() || "Image"}
        </div>
      );
    }

    if (kind === "TEMPLATE") {
      // Render with variables substituted so the agent sees exactly what the
      // contact saw — not the raw `{{1}}, {{2}}` placeholders. When the list
      // endpoint hydrates `channelTemplateVersion` we render the full
      // WhatsApp-styled preview (header media / footer / buttons); otherwise
      // we fall back to substituted body text only (legacy rows + cases where
      // the version was deleted).
      const version = message.channelTemplateVersion;
      const variables = message.templateVariables;
      const substitutedBody = substituteTemplateVariables(
        version?.body ?? message.text,
        variables,
      ).trim();
      return (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-base-content/60">
            WhatsApp template
          </span>
          {version ? (
            <WhatsAppTemplatePreview
              headerType={
                (version.headerType ?? null) as WhatsAppTemplatePreviewProps["headerType"]
              }
              headerContent={substituteTemplateVariables(
                version.headerContent,
                variables,
              )}
              body={substitutedBody}
              footer={version.footer ?? null}
              buttons={
                (version.buttons ?? null) as WhatsAppTemplatePreviewProps["buttons"]
              }
              layoutType={
                (version.layoutType ?? "STANDARD") as WhatsAppTemplatePreviewProps["layoutType"]
              }
              carouselCards={
                (version.carouselCards ?? null) as WhatsAppTemplatePreviewProps["carouselCards"]
              }
              category={
                (version.category ?? null) as WhatsAppTemplatePreviewProps["category"]
              }
              language={version.language ?? null}
            />
          ) : (
            <div className="whitespace-pre-wrap">{substitutedBody}</div>
          )}
          {message.campaignId && (
            <a
              href={`/campaigns?id=${message.campaignId}`}
              className="text-xs text-primary underline-offset-2 hover:underline self-start"
            >
              View campaign →
            </a>
          )}
        </div>
      );
    }

    if (kind === "INTERACTIVE") {
      return (
        <div className="flex flex-col gap-2">
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
      <div className="text-base-content/80">
        This message type isn&apos;t shown in the app yet.
      </div>
    );
  })();

  const canStar = !!onStar;
  const canPin = !!onPin;
  const canCopy = !!message.text;
  const canCreateTask = !!onCreateTask;
  const hasContextMenu = canStar || canPin || canCopy || canCreateTask;

  return (
    <div
      className={`relative rounded-box transition-[box-shadow,background-color] duration-500 ${
        highlighted ? "bg-warning/15 [box-shadow:0_0_0_3px_hsl(var(--wa)/0.45)]" : ""
      }`}
      data-message-id={message.id}
      data-local-context-menu={hasContextMenu ? "" : undefined}
      onContextMenu={
        hasContextMenu
          ? (e) => {
              e.preventDefault();
              setMenuPoint({ x: e.clientX, y: e.clientY });
            }
          : undefined
      }
    >
      {menuPoint && (
        <MessageContextMenu
          point={menuPoint}
          isPinned={message.isPinned}
          isStarred={message.isStarred}
          text={message.text ?? undefined}
          onPin={onPin ? () => onPin(message) : undefined}
          onStar={onStar ? () => onStar(message) : undefined}
          onCreateTask={onCreateTask ? () => onCreateTask(message) : undefined}
          onClose={() => setMenuPoint(null)}
        />
      )}

      <div
        className={`chat ${
          message.direction === "OUTBOUND" ? "chat-end" : "chat-start"
        }`}
      >
        <div
          className={`chat-bubble max-w-[min(85%,28rem)] !rounded-box before:hidden text-sm leading-relaxed group/bubble relative break-words [overflow-wrap:anywhere] ${
            documentBubble ? "p-0" : richMedia ? "p-1.5" : "px-3 py-2.5"
          } ${bubbleClassName(message, failed)}`}
        >
          {body}
          {/* Quick-react picker — visible on hover; positioned just above the
              bubble. Click your existing reaction to remove; click another to
              switch. Hidden on touch devices to avoid taking up real estate. */}
          {onReact ? (
            <div
              className={`absolute -top-3 z-10 hidden md:group-hover/bubble:flex items-center gap-0.5 rounded-full border border-base-300 bg-base-100 px-1.5 py-0.5 shadow-sm ${
                message.direction === "OUTBOUND" ? "right-2" : "left-2"
              }`}
              role="toolbar"
              aria-label="React to message"
            >
              {QUICK_REACTIONS.map((e) => {
                const mine = (message.reactions ?? []).find(
                  (r) => r.actorUserId === currentUserId,
                );
                const isOwn = mine?.emoji === e;
                return (
                  <button
                    key={e}
                    type="button"
                    className={`px-1 text-sm leading-none transition-transform hover:scale-125 ${
                      isOwn ? "scale-110" : ""
                    }`}
                    onClick={(ev) => {
                      ev.stopPropagation();
                      if (isOwn && onUnreact) onUnreact(message);
                      else onReact(message, e);
                    }}
                    title={isOwn ? "Remove your reaction" : `React with ${e}`}
                  >
                    {e}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
        {/* Reaction chips — grouped by emoji, count + own-highlight. Single
            row that wraps when several distinct emojis are present. Sits
            inside the chat-* container so it inherits left/right alignment. */}
        {(message.reactions ?? []).length > 0 ? (
          <div
            className={`mt-1 flex flex-wrap gap-1 text-xs ${
              message.direction === "OUTBOUND"
                ? "justify-end"
                : "justify-start"
            }`}
          >
            {(() => {
              // Group reactions by emoji so multiple reactors of the same
              // emoji collapse to a single "👍 3" chip.
              const groups = new Map<
                string,
                { count: number; ownReactionId: string | null }
              >();
              for (const r of message.reactions ?? []) {
                const g = groups.get(r.emoji) ?? {
                  count: 0,
                  ownReactionId: null,
                };
                g.count += 1;
                if (r.actorUserId && r.actorUserId === currentUserId) {
                  g.ownReactionId = r.id;
                }
                groups.set(r.emoji, g);
              }
              return Array.from(groups.entries()).map(([emoji, g]) => (
                <button
                  key={emoji}
                  type="button"
                  className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 transition-colors ${
                    g.ownReactionId
                      ? "border-primary/40 bg-primary/10 text-primary hover:bg-primary/15"
                      : "border-base-300 bg-base-100 hover:bg-base-200"
                  }`}
                  onClick={() => {
                    if (g.ownReactionId && onUnreact) onUnreact(message);
                    else if (!g.ownReactionId && onReact) onReact(message, emoji);
                  }}
                  title={
                    g.ownReactionId
                      ? "Click to remove your reaction"
                      : `Click to react with ${emoji}`
                  }
                >
                  <span>{emoji}</span>
                  {g.count > 1 ? (
                    <span className="tabular-nums text-[0.6875rem]">
                      {g.count}
                    </span>
                  ) : null}
                </button>
              ));
            })()}
          </div>
        ) : null}
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
                    <span className="font-mono-op tabular-nums text-base-content/60">{failedAtLabel}</span>
                  ) : null}
                </div>
              </details>
            ) : (
              <div
                role="alert"
                className="rounded-box border border-error/30 border-l-2 border-l-error bg-base-200 px-3 py-2 text-sm"
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
                    <span className="font-mono-op text-[0.6875rem] tabular-nums text-base-content/60">
                      {failedAtLabel}
                    </span>
                  ) : null}
                </div>
              </div>
            )}
            {message.direction === "OUTBOUND" && (onRetry || onDiscard) ? (
              <div
                className={`mt-1.5 flex items-center gap-2 ${
                  message.direction === "OUTBOUND" ? "justify-end" : "justify-start"
                }`}
              >
                {onDiscard ? (
                  <button
                    type="button"
                    className="btn btn-xs btn-ghost text-base-content/60 hover:text-base-content"
                    onClick={() => onDiscard(message)}
                    disabled={discarding || retrying}
                    title="Hide this failed message from the inbox (keeps it in analytics)"
                  >
                    {discarding ? (
                      <span className="loading loading-spinner loading-xs" />
                    ) : null}
                    Discard
                  </button>
                ) : null}
                {onRetry ? (
                  <button
                    type="button"
                    className="btn btn-xs btn-outline btn-error"
                    onClick={() => onRetry(message)}
                    disabled={retrying || discarding}
                  >
                    {retrying ? (
                      <span className="loading loading-spinner loading-xs" />
                    ) : null}
                    Retry send
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
        {(() => {
          const timeStr = formatMessageTimeShort(message.createdAt);
          const statusLabel = formatDeliveryStatusLabel(message);
          const taskCount = message.taskCount ?? 0;
          return (
            <div className="chat-footer font-mono-op mt-1 flex items-center gap-1 text-[0.625rem] tracking-[0.04em] text-base-content/45 tabular-nums">
              {timeStr ? <span>{timeStr}</span> : null}
              {timeStr && statusLabel ? <span aria-hidden="true">·</span> : null}
              <MessageStatusIcon message={message} />
              {statusLabel ? <span>{statusLabel}</span> : null}
              {taskCount > 0 ? (
                <>
                  <span aria-hidden="true">·</span>
                  <Link
                    href={`/tasks?messageId=${message.id}`}
                    className="inline-flex items-center gap-0.5 rounded-[3px] border border-primary/30 bg-primary/10 px-1 py-[1px] text-primary transition-colors hover:bg-primary/20"
                    title={`${taskCount} open task${taskCount === 1 ? "" : "s"} — view`}
                  >
                    <CheckSquare className="h-2.5 w-2.5" aria-hidden />
                    <span>{taskCount}</span>
                  </Link>
                </>
              ) : null}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
