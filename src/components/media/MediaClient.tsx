"use client";

import { useState } from "react";
import { mediaApi } from "@/lib/api";
import { resolveMediaUrlForUi } from "@/lib/mediaUrls";

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
  const [selectedMediaId, setSelectedMediaId] = useState<string | null>(null);
  const [selectedMedia, setSelectedMedia] = useState<Record<string, unknown> | null>(
    null
  );
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);

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

  const handleSync = async (id: string, provider: "whatsapp" | "telegram") => {
    setActionBusyId(id);
    setError(null);
    try {
      await mediaApi.syncToProvider(id, provider);
      await refresh();
    } catch (err: unknown) {
      setError(getApiError(err) || "Sync failed.");
    } finally {
      setActionBusyId(null);
    }
  };

  const handleRetryFailed = async () => {
    setLoading(true);
    setError(null);
    try {
      await mediaApi.retryFailedSyncs();
      await refresh();
    } catch (err: unknown) {
      setError(getApiError(err) || "Failed to retry syncs.");
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
          <button
            type="button"
            className="btn btn-ghost"
            onClick={handleRetryFailed}
            disabled={loading}
          >
            Retry failed syncs
          </button>
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
                  src={resolveMediaUrlForUi(item.url)}
                  alt="media"
                  className="h-full w-full object-cover"
                />
              ) : item.mimeType.startsWith("video/") ? (
                <video
                  src={resolveMediaUrlForUi(item.url)}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-sm text-base-content/60">
                  {item.mimeType}
                </div>
              )}
            </figure>
            <div className="card-body p-3">
              <p className="truncate text-sm">{item.fileName || item.url}</p>
              <div className="flex items-center justify-between text-xs text-base-content/60">
                <span>{item.mimeType}</span>
                {item.size ? <span>{item.size} bytes</span> : null}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <a
                  className="btn btn-sm btn-outline"
                  href={mediaApi.downloadUrl(item.id)}
                  target="_blank"
                  rel="noreferrer"
                >
                  Download
                </a>
                <button
                  type="button"
                  className="btn btn-sm btn-outline"
                  onClick={() => handleDetails(item.id)}
                  disabled={actionBusyId === item.id}
                >
                  Details
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-ghost"
                  onClick={() => handleSync(item.id, "whatsapp")}
                  disabled={actionBusyId === item.id}
                >
                  Sync WA
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-ghost"
                  onClick={() => handleSync(item.id, "telegram")}
                  disabled={actionBusyId === item.id}
                >
                  Sync TG
                </button>
                <button
                  type="button"
                  className="btn btn-outline btn-sm col-span-2"
                  onClick={() => handleDelete(item.id)}
                  disabled={actionBusyId === item.id}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {selectedMediaId && selectedMedia ? (
        <div className="rounded-box border border-base-300 bg-base-100 p-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Media details</h3>
            <button
              type="button"
              className="btn btn-ghost btn-xs"
              onClick={() => {
                setSelectedMediaId(null);
                setSelectedMedia(null);
              }}
            >
              Close
            </button>
          </div>
          <pre className="max-h-64 overflow-auto rounded-box bg-base-100 p-3 text-xs">
            {JSON.stringify(selectedMedia, null, 2)}
          </pre>
        </div>
      ) : null}

      {loading && (
        <div className="flex items-center gap-2 text-sm text-base-content/60">
          <span className="loading loading-spinner loading-sm" />
          Updating media...
        </div>
      )}
    </div>
  );
}
