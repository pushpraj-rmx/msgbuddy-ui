"use client";

import { useEffect, useState } from "react";
import { extractApiErrorMessage } from "@/lib/messageApiErrors";
import { internalApi, type InternalMessage } from "@/lib/api";

export function InternalMessagesPanel({
  conversationId,
}: {
  conversationId: string;
}) {
  const [items, setItems] = useState<InternalMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await internalApi.listMessages(conversationId);
      setItems(rows ?? []);
    } catch (err: unknown) {
      setError(extractApiErrorMessage(err) || "Failed to load internal messages.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  const send = async () => {
    if (!draft.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await internalApi.sendMessage({
        conversationId,
        text: draft.trim(),
      });
      setDraft("");
      await load();
    } catch (err: unknown) {
      setError(
        extractApiErrorMessage(err) || "Failed to send internal message."
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-base-300 bg-base-100 p-3 space-y-2">
      <h3 className="text-sm font-medium">Internal messages</h3>
      <div className="flex items-center gap-2">
        <input
          className="input input-bordered input-sm w-full"
          placeholder="Send team-only message"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !busy) {
              e.preventDefault();
              void send();
            }
          }}
        />
        <button
          type="button"
          className="btn btn-sm btn-primary"
          onClick={() => void send()}
          disabled={busy || !draft.trim()}
        >
          Send
        </button>
      </div>

      {error ? (
        <div role="alert" className="alert alert-error alert-soft py-2 text-sm">
          {error}
        </div>
      ) : null}

      {loading ? (
        <span className="loading loading-spinner loading-sm" />
      ) : items.length ? (
        <ul className="max-h-40 space-y-2 overflow-y-auto pr-1">
          {items.map((item) => (
            <li key={item.id} className="rounded-lg border border-base-300 p-2">
              <p className="text-xs">{item.text}</p>
              <p className="mt-1 text-[11px] text-base-content/60">
                {item.senderUserId || "unknown"}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-base-content/60">
          No internal messages yet.
        </p>
      )}
    </div>
  );
}

