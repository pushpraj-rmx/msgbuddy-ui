"use client";

import { useMemo, useRef, useState } from "react";
import { FileAudio, X, CloudUpload, Images, Trash2, Download, Image, Info, File, RefreshCw, ChevronsUpDown, FileVideo } from "lucide-react";
import { mediaApi } from "@/lib/api";
import { resolveMediaUrlForUi } from "@/lib/mediaUrls";
import { getApiError } from "@/lib/api-error";
import { roleHasWorkspacePermission } from "@/lib/workspace-role-permissions";
import { MediaLightbox, type MediaSlide } from "@/components/ui/MediaLightbox";

export type MediaItem = {
  id: string;
  url: string;
  mimeType: string;
  size?: number;
  fileName?: string;
  providerStatus?: string;
  createdAt?: string;
};

const LIMIT = 50;
type SortMode = "newest" | "oldest" | "filetype";

function formatBytes(n: number | undefined): string {
  if (n == null || n < 0) return "—";
  if (n < 1024) return `${n} B`;
  const units = ["KB", "MB", "GB", "TB"] as const;
  let v = n / 1024;
  let u = 0;
  while (v >= 1024 && u < units.length - 1) {
    v /= 1024;
    u += 1;
  }
  return `${v < 10 && u > 0 ? v.toFixed(1) : Math.round(v)} ${units[u]}`;
}

function mimeSummary(mime: string): string {
  if (!mime) return "File";
  const [main, sub] = mime.split("/");
  if (main === "image") return sub ? `Image · ${sub}` : "Image";
  if (main === "video") return sub ? `Video · ${sub}` : "Video";
  if (main === "audio") return sub ? `Audio · ${sub}` : "Audio";
  return mime.length > 36 ? `${mime.slice(0, 34)}…` : mime;
}

function MediaTypeIcon({ mimeType }: { mimeType: string }) {
  if (mimeType.startsWith("image/")) {
    return <Image className="h-10 w-10 text-primary/80" aria-hidden />;
  }
  if (mimeType.startsWith("video/")) {
    return <FileVideo className="h-10 w-10 text-secondary/90" aria-hidden />;
  }
  if (mimeType.startsWith("audio/")) {
    return <FileAudio className="h-10 w-10 text-accent/90" aria-hidden />;
  }
  return <File className="h-10 w-10 text-base-content/45" aria-hidden />;
}

function formatDetailValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value);
}

export function MediaClient({ initialMedia, meRole }: { initialMedia: MediaItem[]; meRole: string }) {
  const canWrite = roleHasWorkspacePermission(meRole, "media.write");
  const [media, setMedia] = useState<MediaItem[]>(initialMedia);
  const [cursor, setCursor] = useState<string | null>(
    initialMedia.length ? initialMedia.at(-1)?.id ?? null : null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [selectedMediaId, setSelectedMediaId] = useState<string | null>(null);
  const [selectedMedia, setSelectedMedia] = useState<Record<string, unknown> | null>(
    null
  );
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [retryingFailed, setRetryingFailed] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const totals = useMemo(() => {
    const bytes = media.reduce((acc, m) => acc + (m.size ?? 0), 0);
    return { count: media.length, bytes };
  }, [media]);

  const sortedMedia = useMemo(() => {
    const items = [...media];
    if (sortMode === "oldest") {
      items.sort((a, b) => {
        const at = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return at - bt;
      });
      return items;
    }
    if (sortMode === "filetype") {
      items.sort((a, b) => {
        const aType = a.mimeType.split("/")[0] || "";
        const bType = b.mimeType.split("/")[0] || "";
        const typeCmp = aType.localeCompare(bType);
        if (typeCmp !== 0) return typeCmp;
        const mimeCmp = a.mimeType.localeCompare(b.mimeType);
        if (mimeCmp !== 0) return mimeCmp;
        return (a.fileName || a.id).localeCompare(b.fileName || b.id);
      });
      return items;
    }
    items.sort((a, b) => {
      const at = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bt - at;
    });
    return items;
  }, [media, sortMode]);

  const imageItems = useMemo(
    () => sortedMedia.filter((item) => item.mimeType.startsWith("image/")),
    [sortedMedia]
  );
  const lightboxSlides = useMemo<MediaSlide[]>(
    () =>
      imageItems.map((item) => {
        const src = resolveMediaUrlForUi(item.url) ?? item.url;
        return {
          type: "image",
          src,
          alt: item.fileName || "Media",
        };
      }),
    [imageItems]
  );

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = (await mediaApi.list({ limit: LIMIT })) as MediaItem[];
      setMedia(data);
      setCursor(data.length ? data.at(-1)?.id ?? null : null);
    } catch (err: unknown) {
      setError(getApiError(err) || "Failed to load media.");
    } finally {
      setLoading(false);
    }
  };

  const loadMore = async () => {
    if (!cursor) return;
    setLoading(true);
    setError(null);
    try {
      const data = (await mediaApi.list({
        limit: LIMIT,
        cursor,
      })) as MediaItem[];
      setMedia((prev) => [...prev, ...data]);
      setCursor(data.length ? data.at(-1)?.id ?? null : null);
    } catch (err: unknown) {
      setError(getApiError(err) || "Failed to load more media.");
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      await mediaApi.upload(file);
      await refresh();
    } catch (err: unknown) {
      setError(getApiError(err) || "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      await mediaApi.remove(id);
      await refresh();
    } catch (err: unknown) {
      setError(getApiError(err) || "Delete failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleDetails = async (id: string) => {
    setActionBusyId(id);
    setError(null);
    try {
      const detail = (await mediaApi.getById(id)) as Record<string, unknown>;
      setSelectedMediaId(id);
      setSelectedMedia(detail);
    } catch (err: unknown) {
      setError(getApiError(err) || "Failed to fetch media details.");
    } finally {
      setActionBusyId(null);
    }
  };

  const handleDownload = async (item: MediaItem) => {
    setActionBusyId(item.id);
    setError(null);
    try {
      await mediaApi.downloadFile(item.id, item.fileName);
    } catch (err: unknown) {
      setError(getApiError(err) || "Download failed.");
    } finally {
      setActionBusyId(null);
    }
  };

  const handleRetryFailed = async () => {
    setRetryingFailed(true);
    setError(null);
    try {
      await mediaApi.retryFailedSyncs();
      await refresh();
    } catch (err: unknown) {
      setError(getApiError(err) || "Retry failed syncs failed.");
    } finally {
      setRetryingFailed(false);
    }
  };

  const onDropUpload = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (!canWrite) return;
    const file = e.dataTransfer.files?.[0];
    if (file) void handleUpload(file);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      {/* Page intro */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-transparent text-primary">
            <Images className="h-7 w-7" aria-hidden />
          </div>
          <div className="min-w-0">
            <h2 className="text-xl font-semibold tracking-tight text-base-content sm:text-2xl">
              Media library
            </h2>
            <p className="mt-0.5 max-w-xl text-sm leading-relaxed text-base-content/65">
              Upload assets for templates and campaigns. Preview files quickly and download when you
              need a local copy.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <div className="flex items-center gap-2 rounded-full border border-base-300/80 bg-base-200/50 px-3 py-1.5 text-xs font-medium text-base-content/70">
            <Images className="h-4 w-4 opacity-70" aria-hidden />
            <span>{totals.count} files</span>
            <span className="text-base-content/35">·</span>
            <span>{formatBytes(totals.bytes)}</span>
          </div>
        </div>
      </div>

      {/* Toolbar + upload */}
      <div className="flex flex-col gap-4 rounded-2xl border border-base-300/70 bg-base-200/30 p-4 shadow-sm backdrop-blur-sm md:flex-row md:items-center md:justify-between">
        {canWrite ? (
          <>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  void handleUpload(file);
                  event.target.value = "";
                }
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              onDragEnter={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                if (e.currentTarget === e.target) setDragOver(false);
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={onDropUpload}
              disabled={uploading}
              className={`group flex min-h-[3.5rem] flex-1 items-center gap-3 rounded-xl border-2 border-dashed px-4 py-3 text-left transition ${
                dragOver
                  ? "border-primary bg-primary/10"
                  : "border-base-300/90 bg-base-100/80 hover:border-primary/50 hover:bg-base-100"
              } ${uploading ? "pointer-events-none opacity-60" : ""}`}
            >
              <span
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition ${
                  dragOver ? "bg-primary/20 text-primary" : "bg-base-200 text-base-content/60 group-hover:text-primary"
                }`}
              >
                {uploading ? (
                  <span className="loading loading-spinner loading-md text-primary" />
                ) : (
                  <CloudUpload className="h-6 w-6" aria-hidden />
                )}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-base-content">
                  {uploading ? "Uploading…" : "Drop a file here or click to upload"}
                </p>
                <p className="text-xs text-base-content/55">Images, video, audio, and documents</p>
              </div>
            </button>
          </>
        ) : (
          <p className="flex flex-1 items-center gap-2 text-sm text-base-content/60">
            <Info className="h-5 w-5 shrink-0 opacity-60" aria-hidden />
            You can view and download media; uploads require permission.
          </p>
        )}
        <div className="flex flex-wrap items-center justify-end gap-2 md:pl-4">
          <label className="form-control">
            <div className="label py-0">
              <span className="label-text text-xs text-base-content/60">Sort</span>
            </div>
            <select
              className="select select-bordered select-sm rounded-lg"
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortMode)}
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="filetype">File type</option>
            </select>
          </label>
          <button
            type="button"
            className="btn btn-ghost gap-1.5 rounded-xl border border-transparent hover:border-base-300"
            onClick={() => void refresh()}
            disabled={loading}
          >
            <RefreshCw className="h-5 w-5" aria-hidden />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          {canWrite && (
            <button
              type="button"
              className="btn btn-warning btn-outline gap-1.5 rounded-xl"
              onClick={() => void handleRetryFailed()}
              disabled={retryingFailed || loading}
            >
              {retryingFailed ? (
                <span className="loading loading-spinner loading-xs" />
              ) : (
                <RefreshCw className="h-5 w-5" aria-hidden />
              )}
              <span className="hidden sm:inline">Retry failed</span>
            </button>
          )}
          <button
            type="button"
            className="btn btn-primary gap-1.5 rounded-xl"
            onClick={() => void loadMore()}
            disabled={!cursor || loading}
          >
            <ChevronsUpDown className="h-5 w-5" aria-hidden />
            Load more
          </button>
        </div>
      </div>

      {error ? (
        <div role="alert" className="alert alert-error rounded-xl shadow-sm">
          <span>{error}</span>
        </div>
      ) : null}

      {!media.length && !loading ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-base-300/80 bg-base-200/20 px-6 py-16 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-base-300/40 text-base-content/30">
            <Images className="h-9 w-9" aria-hidden />
          </div>
          <p className="text-base font-medium text-base-content/80">No media yet</p>
          <p className="mt-1 max-w-sm text-sm text-base-content/55">
            {canWrite
              ? "Upload a file to get started — it will appear in this gallery."
              : "When your team uploads files, they will show up here."}
          </p>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {sortedMedia.map((item) => {
          const busy = actionBusyId === item.id;
          return (
            <article
              key={item.id}
              className="group flex flex-col overflow-hidden rounded-2xl border border-base-300/60 bg-base-100 shadow-md transition hover:border-primary/35 hover:shadow-lg"
            >
              <div className="relative aspect-square overflow-hidden bg-gradient-to-b from-base-300/80 to-base-300">
                {item.mimeType.startsWith("image/") ? (
                  // Media URLs are dynamic provider/CDN links; keep plain img preview here.
                  <button
                    type="button"
                    className="h-full w-full"
                    onClick={() => {
                      const imageIndex = imageItems.findIndex((m) => m.id === item.id);
                      if (imageIndex >= 0) {
                        setLightboxIndex(imageIndex);
                        setLightboxOpen(true);
                      }
                    }}
                    aria-label={`Open ${item.fileName || "image"} preview`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={resolveMediaUrlForUi(item.url) ?? item.url}
                      alt=""
                      className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                    />
                  </button>
                ) : item.mimeType.startsWith("video/") ? (
                  <video
                    src={resolveMediaUrlForUi(item.url) ?? item.url}
                    className="h-full w-full object-cover"
                    controls
                    preload="metadata"
                  />
                ) : (
                  <button
                    type="button"
                    className="flex h-full w-full flex-col items-center justify-center gap-2 p-4 text-center"
                    onClick={() => {
                      const src = resolveMediaUrlForUi(item.url) ?? item.url;
                      window.open(src, "_blank", "noopener,noreferrer");
                    }}
                    aria-label={`Open ${item.fileName || "file"}`}
                  >
                    <MediaTypeIcon mimeType={item.mimeType} />
                    <span className="line-clamp-2 text-xs text-base-content/55">{mimeSummary(item.mimeType)}</span>
                  </button>
                )}
                {item.providerStatus ? (
                  <span className="absolute left-2 top-2 rounded-md bg-base-100/90 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-base-content/80 shadow-sm backdrop-blur-sm">
                    {item.providerStatus}
                  </span>
                ) : null}
              </div>
              <div className="flex flex-1 flex-col gap-3 p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-base-content" title={item.fileName || item.id}>
                    {item.fileName || item.id}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-base-content/55">
                    <span>{mimeSummary(item.mimeType)}</span>
                    {item.size != null ? (
                      <>
                        <span className="text-base-content/30">·</span>
                        <span>{formatBytes(item.size)}</span>
                      </>
                    ) : null}
                    {item.createdAt ? (
                      <>
                        <span className="text-base-content/30">·</span>
                        <time dateTime={item.createdAt}>
                          {new Date(item.createdAt).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </time>
                      </>
                    ) : null}
                  </div>
                </div>
                <div className="mt-auto flex flex-wrap gap-1.5 border-t border-base-300/50 pt-3">
                  <button
                    type="button"
                    className="btn btn-sm flex-1 gap-1 rounded-lg border-base-300/80"
                    onClick={() => void handleDownload(item)}
                    disabled={busy}
                  >
                    <Download className="h-4 w-4" aria-hidden />
                    <span className="hidden min-[360px]:inline">Get</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm flex-1 gap-1 rounded-lg border-base-300/80"
                    onClick={() => void handleDetails(item.id)}
                    disabled={busy}
                  >
                    <Info className="h-4 w-4" aria-hidden />
                    <span className="hidden min-[360px]:inline">Info</span>
                  </button>
                  {canWrite ? (
                    <button
                      type="button"
                      className="btn btn-sm btn-ghost gap-1 rounded-lg text-error hover:bg-error/10"
                      onClick={() => void handleDelete(item.id)}
                      disabled={busy}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                      <span className="sr-only">Delete</span>
                    </button>
                  ) : null}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {selectedMediaId && selectedMedia ? (
        <div className="sticky bottom-0 z-10 rounded-2xl border border-base-300/80 bg-base-100 p-4 shadow-2xl ring-1 ring-base-content/5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <Info className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <h3 className="text-sm font-semibold text-base-content">File details</h3>
                <p className="text-xs text-base-content/55">API payload for this media item</p>
              </div>
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-sm btn-square rounded-lg"
              onClick={() => {
                setSelectedMediaId(null);
                setSelectedMedia(null);
              }}
              aria-label="Close details"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <dl className="mb-3 grid gap-2 sm:grid-cols-2">
            {Object.entries(selectedMedia).map(([key, value]) => (
              <div
                key={key}
                className="rounded-lg border border-base-300/50 bg-base-200/40 px-3 py-2"
              >
                <dt className="text-[10px] font-semibold uppercase tracking-wider text-base-content/45">
                  {key}
                </dt>
                <dd className="mt-0.5 break-all font-mono text-xs text-base-content/85">
                  {formatDetailValue(value)}
                </dd>
              </div>
            ))}
          </dl>
          <details className="group rounded-lg border border-dashed border-base-300/70 bg-base-200/20">
            <summary className="cursor-pointer select-none px-3 py-2 text-xs font-medium text-base-content/70">
              Raw JSON
            </summary>
            <pre className="max-h-52 overflow-auto border-t border-base-300/50 p-3 text-[11px] leading-relaxed text-base-content/80">
              {JSON.stringify(selectedMedia, null, 2)}
            </pre>
          </details>
        </div>
      ) : null}

      <MediaLightbox
        open={lightboxOpen && lightboxSlides.length > 0}
        slides={lightboxSlides}
        index={lightboxIndex}
        onClose={() => setLightboxOpen(false)}
      />

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-base-300/60 bg-base-200/30 py-3 text-sm text-base-content/65">
          <span className="loading loading-spinner loading-sm text-primary" />
          Updating library…
        </div>
      ) : null}
    </div>
  );
}
