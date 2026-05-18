"use client";

import { useState } from "react";
import { X, FileAudio, FileText } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { conversationsApi } from "../../lib/api";
import type { MediaItem } from "../../lib/messaging";
import { resolveMediaUrlForUi } from "../../lib/mediaUrls";

interface MediaGalleryProps {
  conversationId: string;
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
  const resolvedUrl = resolveMediaUrlForUi(item.mediaUrl ?? undefined);

  if (isVisual) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="aspect-square w-full cursor-pointer overflow-hidden rounded-md border border-base-300 bg-base-200 hover:opacity-85"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- dynamic user content */}
        <img
          src={resolvedUrl ?? ""}
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
      className="flex items-center gap-2 rounded-md border border-base-300 bg-base-200 p-2 text-left hover:bg-base-300"
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
          {visualItems.length > 0 && <div className="my-2 border-t border-base-300" />}
          <span className="op-label mb-1.5 block px-1">
            Documents &amp; Audio
          </span>
          <div className="flex flex-col gap-1">
            {otherItems.map((item) => (
              <MediaThumbnail
                key={item.id}
                item={item}
                onClick={() => {
                  const url = resolveMediaUrlForUi(item.mediaUrl ?? undefined);
                  if (url) window.open(url, "_blank");
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
                className="btn btn-ghost btn-sm btn-circle text-neutral-content"
                onClick={() => setLightbox(null)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {lightbox?.mediaMimeType?.startsWith("video/") ? (
              <video
                src={resolveMediaUrlForUi(lightbox.mediaUrl ?? undefined) ?? ""}
                controls
                className="block max-h-[80vh] w-full"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element -- dynamic user content
              <img
                src={resolveMediaUrlForUi(lightbox?.mediaUrl ?? undefined) ?? ""}
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
