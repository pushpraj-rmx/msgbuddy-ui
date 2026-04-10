"use client";

import { useState } from "react";
import {
  Box,
  CircularProgress,
  Dialog,
  DialogContent,
  Divider,
  IconButton,
  ImageList,
  ImageListItem,
  Tooltip,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import AudioFileIcon from "@mui/icons-material/AudioFile";
import DescriptionIcon from "@mui/icons-material/Description";
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
      <Box
        onClick={onClick}
        sx={{
          width: "100%",
          aspectRatio: "1",
          cursor: "pointer",
          overflow: "hidden",
          borderRadius: 1,
          bgcolor: "action.hover",
          "&:hover img": { opacity: 0.85 },
        }}
      >
        <Box
          component="img"
          src={item.mediaUrl ?? ""}
          alt=""
          sx={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      </Box>
    );
  }

  // Audio or document — show icon row
  const isAudio = mime.startsWith("audio/");
  return (
    <Box
      onClick={onClick}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1,
        p: 1,
        borderRadius: 1,
        bgcolor: "action.hover",
        cursor: "pointer",
        "&:hover": { bgcolor: "action.selected" },
      }}
    >
      {isAudio ? (
        <AudioFileIcon color="primary" />
      ) : (
        <DescriptionIcon color="action" />
      )}
      <Typography variant="caption" noWrap sx={{ flex: 1 }}>
        {isAudio ? "Audio" : "Document"}
        {item.mediaSize
          ? ` · ${(item.mediaSize / 1024).toFixed(0)} KB`
          : ""}
      </Typography>
    </Box>
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
      <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  const items = data?.media ?? [];

  if (items.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: "center" }}>
        No shared media yet.
      </Typography>
    );
  }

  // Group by month
  const groups = new Map<string, MediaItem[]>();
  for (const item of items) {
    const key = getMonthKey(item.createdAt);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }

  const visualItems = items.filter((i) => isImageOrVideo(i.mediaMimeType));
  const otherItems = items.filter((i) => !isImageOrVideo(i.mediaMimeType));

  return (
    <Box sx={{ px: 1, pb: 2 }}>
      {visualItems.length > 0 && (
        <>
          <Typography variant="caption" color="text.secondary" sx={{ px: 1, display: "block", mb: 0.5 }}>
            Photos &amp; Videos
          </Typography>
          <ImageList cols={3} gap={4} sx={{ mt: 0 }}>
            {visualItems.map((item) => (
              <ImageListItem key={item.id}>
                <MediaThumbnail item={item} onClick={() => setLightbox(item)} />
              </ImageListItem>
            ))}
          </ImageList>
        </>
      )}

      {otherItems.length > 0 && (
        <>
          {visualItems.length > 0 && <Divider sx={{ my: 1 }} />}
          <Typography variant="caption" color="text.secondary" sx={{ px: 1, display: "block", mb: 0.5 }}>
            Documents &amp; Audio
          </Typography>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
            {otherItems.map((item) => (
              <MediaThumbnail
                key={item.id}
                item={item}
                onClick={() => {
                  if (item.mediaUrl) window.open(item.mediaUrl, "_blank");
                }}
              />
            ))}
          </Box>
        </>
      )}

      {/* Lightbox */}
      <Dialog
        open={!!lightbox}
        onClose={() => setLightbox(null)}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { bgcolor: "grey.900" } }}
      >
        <DialogContent sx={{ p: 0, position: "relative" }}>
          <Tooltip title="Close">
            <IconButton
              onClick={() => setLightbox(null)}
              sx={{ position: "absolute", top: 8, right: 8, zIndex: 1, color: "common.white" }}
            >
              <CloseIcon />
            </IconButton>
          </Tooltip>
          {lightbox?.mediaMimeType?.startsWith("video/") ? (
            <Box
              component="video"
              src={lightbox.mediaUrl ?? ""}
              controls
              sx={{ width: "100%", maxHeight: "80vh", display: "block" }}
            />
          ) : (
            <Box
              component="img"
              src={lightbox?.mediaUrl ?? ""}
              alt=""
              sx={{ width: "100%", maxHeight: "80vh", objectFit: "contain", display: "block" }}
            />
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
}
