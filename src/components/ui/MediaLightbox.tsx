"use client";

import Lightbox from "yet-another-react-lightbox";
import Video from "yet-another-react-lightbox/plugins/video";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import Download from "yet-another-react-lightbox/plugins/download";
import "yet-another-react-lightbox/styles.css";

export type ImageSlide = {
  type: "image";
  src: string;
  alt?: string;
};

export type VideoSlide = {
  type: "video";
  sources: { src: string; type: string }[];
};

export type MediaSlide = ImageSlide | VideoSlide;

interface MediaLightboxProps {
  open: boolean;
  slides: MediaSlide[];
  index?: number;
  onClose: () => void;
}

export function MediaLightbox({ open, slides, index = 0, onClose }: MediaLightboxProps) {
  return (
    <Lightbox
      open={open}
      close={onClose}
      slides={slides}
      index={index}
      plugins={[Video, Zoom, Download]}
      zoom={{ maxZoomPixelRatio: 4 }}
      video={{ autoPlay: true }}
    />
  );
}
