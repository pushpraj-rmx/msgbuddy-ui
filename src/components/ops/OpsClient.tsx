"use client";

import { useState } from "react";
import { opsApi, uploadsApi } from "@/lib/api";

function getErr(err: unknown): string {
  return (err as { response?: { data?: { message?: string } } })?.response?.data
    ?.message || "Request failed.";
}

export function OpsClient() {
  const [queueMetrics, setQueueMetrics] = useState<Record<string, unknown> | null>(
    null
  );
  const [uploadSessionId, setUploadSessionId] = useState("");
  const [uploadSessionData, setUploadSessionData] = useState<Record<string, unknown> | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadQueues = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await opsApi.queueMetrics();
      setQueueMetrics((data ?? null) as Record<string, unknown> | null);
    } catch (err: unknown) {
      setError(getErr(err));
    } finally {
      setLoading(false);
    }
  };

  const checkSession = async () => {
    if (!uploadSessionId.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const data = await uploadsApi.getSessionStatus(uploadSessionId.trim());
      setUploadSessionData((data ?? null) as unknown as Record<string, unknown> | null);
    } catch (err: unknown) {
      setError(getErr(err));
    } finally {
      setLoading(false);
    }
  };

  const cancelSession = async () => {
    if (!uploadSessionId.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await uploadsApi.cancelSession(uploadSessionId.trim());
      setUploadSessionData(null);
    } catch (err: unknown) {
      setError(getErr(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {error ? (
        <div role="alert" className="alert alert-error">
          <span>{error}</span>
        </div>
      ) : null}

      <div className="rounded-box border border-base-300 bg-base-100 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Queue metrics</h2>
          <button type="button" className="btn btn-sm btn-primary" onClick={() => void loadQueues()} disabled={loading}>
            {loading ? "Loading…" : "Refresh queues"}
          </button>
        </div>
        <pre className="max-h-80 overflow-auto rounded-box border border-base-300 bg-base-100 p-3 text-xs">
          {queueMetrics == null ? "No data loaded yet." : JSON.stringify(queueMetrics, null, 2)}
        </pre>
      </div>

      <div className="rounded-box border border-base-300 bg-base-100 p-4 space-y-3">
        <h2 className="text-base font-semibold">Upload session monitor</h2>
        <div className="flex flex-wrap items-center gap-2">
          <input
            className="input input-bordered input-sm min-w-[20rem]"
            placeholder="Upload session ID"
            value={uploadSessionId}
            onChange={(e) => setUploadSessionId(e.target.value)}
          />
          <button type="button" className="btn btn-sm btn-outline" onClick={() => void checkSession()} disabled={loading || !uploadSessionId.trim()}>
            Check status
          </button>
          <button type="button" className="btn btn-sm btn-ghost text-error" onClick={() => void cancelSession()} disabled={loading || !uploadSessionId.trim()}>
            Cancel session
          </button>
        </div>
        <pre className="max-h-80 overflow-auto rounded-box border border-base-300 bg-base-100 p-3 text-xs">
          {uploadSessionData == null
            ? "No session loaded."
            : JSON.stringify(uploadSessionData, null, 2)}
        </pre>
      </div>
    </div>
  );
}

