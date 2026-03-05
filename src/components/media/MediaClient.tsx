"use client";

import { useState } from "react";
import { mediaApi } from "@/lib/api";

export type MediaItem = {
  id: string;
  url: string;
  mimeType: string;
  size?: number;
};

const LIMIT = 50;

function getApiError(err: unknown): string {
  return (err as { response?: { data?: { message?: string } } })?.response
    ?.data?.message ?? "Something went wrong.";
}

export function MediaClient({ initialMedia }: { initialMedia: MediaItem[] }) {
  const [media, setMedia] = useState<MediaItem[]>(initialMedia);
  const [cursor, setCursor] = useState<string | null>(
    initialMedia.length ? initialMedia.at(-1)?.id ?? null : null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

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

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <input
            type="file"
            className="file-input file-input-bordered"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                handleUpload(file);
                event.target.value = "";
              }
            }}
          />
          {uploading && <span className="loading loading-spinner" />}
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn btn-ghost" onClick={refresh}>
            Refresh
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={loadMore}
            disabled={!cursor || loading}
          >
            Load more
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="alert alert-error">
          <span>{error}</span>
        </div>
      )}

      {!media.length && !loading && (
        <div className="text-sm text-base-content/60">No media uploaded.</div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {media.map((item) => (
          <div key={item.id} className="card bg-base-200 shadow-sm">
            <figure className="h-40 overflow-hidden bg-base-300">
              {item.mimeType.startsWith("image/") ? (
                // Media URLs are dynamic provider/CDN links; keep plain img preview here.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.url}
                  alt="media"
                  className="h-full w-full object-cover"
                />
              ) : item.mimeType.startsWith("video/") ? (
                <video src={item.url} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-sm text-base-content/60">
                  {item.mimeType}
                </div>
              )}
            </figure>
            <div className="card-body p-3">
              <p className="truncate text-sm">{item.url}</p>
              <div className="flex items-center justify-between text-xs text-base-content/60">
                <span>{item.mimeType}</span>
                {item.size ? <span>{item.size} bytes</span> : null}
              </div>
              <button
                type="button"
                className="btn btn-outline btn-sm mt-2"
                onClick={() => handleDelete(item.id)}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-base-content/60">
          <span className="loading loading-spinner loading-sm" />
          Updating media...
        </div>
      )}
    </div>
  );
}
