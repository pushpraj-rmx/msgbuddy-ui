"use client";

import { useState } from "react";
import { X, FileAudio, FileText } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { conversationsApi } from "../../lib/api";
import type { MediaItem } from "../../lib/messaging";

interface MediaGalleryProps {
  conversationId: string;
}

function getMonthKey(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function isImageOrVideo(mime?: string | null): boolean {
  if (!mime) return false;
  return mime.startsWith("image/") || mime.startsWith("video/");
}

function MediaThumbnail({
  item,
  onClick,
}: {
  item: MediaItem;
  onClick: () => void;
}) {
  const mime = item.mediaMimeType ?? "";
  const isVisual = isImageOrVideo(mime);

  if (isVisual) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="aspect-square w-full cursor-pointer overflow-hidden rounded-lg bg-base-200 hover:opacity-85"
      >
        <img
          src={item.mediaUrl ?? ""}
          alt=""
          className="h-full w-full object-cover"
        />
      </button>
    );
  }

  // Audio or document — show icon row
  const isAudio = mime.startsWith("audio/");
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 rounded-lg bg-base-200 p-2 text-left hover:bg-base-300"
    >
      {isAudio ? (
        <FileAudio className="h-5 w-5 shrink-0 text-primary" />
      ) : (
        <FileText className="h-5 w-5 shrink-0 text-base-content/60" />
      )}
      <span className="flex-1 truncate text-xs text-base-content/70">
        {isAudio ? "Audio" : "Document"}
        {item.mediaSize
          ? ` · ${(item.mediaSize / 1024).toFixed(0)} KB`
          : ""}
      </span>
    </button>
  );
}

export function MediaGallery({ conversationId }: MediaGalleryProps) {
  const [lightbox, setLightbox] = useState<MediaItem | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["conversation-media", conversationId],
    queryFn: () => conversationsApi.listConversationMedia(conversationId),
    enabled: !!conversationId,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-4">
        <span className="loading loading-spinner loading-sm" />
      </div>
    );
  }

  const items = data?.media ?? [];

  if (items.length === 0) {
    return (
      <p className="p-2 text-center text-sm text-base-content/60">
        No shared media yet.
      </p>
    );
  }

  const visualItems = items.filter((i) => isImageOrVideo(i.mediaMimeType));
  const otherItems = items.filter((i) => !isImageOrVideo(i.mediaMimeType));

  return (
    <div className="px-1 pb-2">
      {visualItems.length > 0 && (
        <>
          <span className="mb-1 block px-1 text-xs text-base-content/60">
            Photos &amp; Videos
          </span>
          <div className="grid grid-cols-3 gap-1">
            {visualItems.map((item) => (
              <MediaThumbnail key={item.id} item={item} onClick={() => setLightbox(item)} />
            ))}
          </div>
        </>
      )}

      {otherItems.length > 0 && (
        <>
          {visualItems.length > 0 && <div className="divider my-1" />}
          <span className="mb-1 block px-1 text-xs text-base-content/60">
            Documents &amp; Audio
          </span>
          <div className="flex flex-col gap-1">
            {otherItems.map((item) => (
              <MediaThumbnail
                key={item.id}
                item={item}
                onClick={() => {
                  if (item.mediaUrl) window.open(item.mediaUrl, "_blank");
                }}
              />
            ))}
          </div>
        </>
      )}

      {/* Lightbox */}
      <dialog className={`modal ${lightbox ? "modal-open" : ""}`}>
        <div className="modal-box max-w-3xl bg-neutral p-0">
          <div className="relative">
            <div className="tooltip tooltip-left absolute right-2 top-2 z-10" data-tip="Close">
              <button
                type="button"
                className="btn btn-ghost btn-sm btn-circle text-white"
                onClick={() => setLightbox(null)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {lightbox?.mediaMimeType?.startsWith("video/") ? (
              <video
                src={lightbox.mediaUrl ?? ""}
                controls
                className="block max-h-[80vh] w-full"
              />
            ) : (
              <img
                src={lightbox?.mediaUrl ?? ""}
                alt=""
                className="block max-h-[80vh] w-full object-contain"
              />
            )}
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button type="button" onClick={() => setLightbox(null)}>close</button>
        </form>
      </dialog>
    </div>
  );
}
