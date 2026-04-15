"use client";

import { useRef, useState, useCallback } from "react";
import Cropper from "react-easy-crop";
import type { Area } from "react-easy-crop";
import { resolveMediaUrlForUi } from "@/lib/mediaUrls";
import { mediaApi } from "@/lib/api";

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB

async function getCroppedBlob(
  imageSrc: string,
  cropArea: Area
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = cropArea.width;
      canvas.height = cropArea.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas 2d context unavailable"));
      ctx.drawImage(
        image,
        cropArea.x,
        cropArea.y,
        cropArea.width,
        cropArea.height,
        0,
        0,
        cropArea.width,
        cropArea.height
      );
      canvas.toBlob(
        (blob) => {
          if (!blob) return reject(new Error("Failed to create blob"));
          resolve(blob);
        },
        "image/jpeg",
        0.92
      );
    };
    image.onerror = reject;
    image.src = imageSrc;
  });
}

export function AvatarCropUpload({
  currentUrl,
  initials,
  onUploaded,
  size = "lg",
}: {
  currentUrl?: string | null;
  /** Fallback initials when no photo is set */
  initials?: string;
  /** Called with the final URL after upload completes */
  onUploaded: (url: string) => void;
  size?: "sm" | "md" | "lg";
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resolved = resolveMediaUrlForUi(currentUrl ?? undefined);

  const sizeClass = {
    sm: "h-12 w-12",
    md: "h-16 w-16",
    lg: "h-20 w-20",
  }[size];

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file.");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setError("Image must be 2 MB or smaller.");
      return;
    }
    setError(null);
    const reader = new FileReader();
    reader.onload = () => setImageSrc(reader.result as string);
    reader.readAsDataURL(file);
    // Reset input so same file can be re-selected after cancel
    e.target.value = "";
  };

  const onCropComplete = useCallback((_: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  const onConfirm = async () => {
    if (!imageSrc || !croppedAreaPixels) return;
    setUploading(true);
    setError(null);
    try {
      const blob = await getCroppedBlob(imageSrc, croppedAreaPixels);
      const file = new File([blob], "avatar.jpg", { type: "image/jpeg" });
      const result = await mediaApi.upload(file) as { url: string };
      onUploaded(result.url);
      setImageSrc(null);
    } catch {
      setError("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const onCancel = () => {
    setImageSrc(null);
    setError(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
  };

  return (
    <>
      {/* Avatar button */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className={`relative shrink-0 overflow-hidden rounded-box bg-primary text-primary-content ${sizeClass} hover:opacity-80 transition-opacity focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary`}
          title="Change photo"
        >
          {resolved ? (
            <img src={resolved} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-lg font-semibold select-none">
              {initials ?? "?"}
            </div>
          )}
          {/* Camera overlay */}
          <div className="absolute inset-0 flex items-end justify-end p-1 opacity-0 hover:opacity-100 bg-black/30 transition-opacity rounded-box">
            <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
        </button>
        <div className="flex flex-col gap-1">
          <button
            type="button"
            className="btn btn-outline btn-xs"
            onClick={() => fileInputRef.current?.click()}
          >
            Change photo
          </button>
          <p className="text-xs text-base-content/50">
            Recommended: 512×512 px · Max 2 MB
          </p>
        </div>
      </div>

      {error && (
        <p className="text-xs text-error mt-1">{error}</p>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onFileChange}
      />

      {/* Crop modal */}
      {imageSrc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-base-100 rounded-box shadow-xl w-full max-w-sm mx-4 overflow-hidden">
            <div className="px-4 pt-4 pb-2">
              <h3 className="text-sm font-semibold">Crop photo</h3>
              <p className="text-xs text-base-content/60 mt-0.5">Drag to reposition · Scroll to zoom</p>
            </div>

            {/* Cropper container */}
            <div className="relative h-72 bg-black">
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="rect"
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            </div>

            {/* Zoom slider */}
            <div className="px-4 py-3">
              <input
                type="range"
                min={1}
                max={3}
                step={0.01}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="range range-xs range-primary w-full"
              />
            </div>

            <div className="px-4 pb-4 flex justify-end gap-2">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={onCancel}
                disabled={uploading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={onConfirm}
                disabled={uploading}
              >
                {uploading ? (
                  <>
                    <span className="loading loading-spinner loading-xs" />
                    Uploading…
                  </>
                ) : (
                  "Save photo"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
