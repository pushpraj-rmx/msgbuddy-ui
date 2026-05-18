"use client";

import { useState } from "react";
import { contactsApi } from "@/lib/api";
import { getApiError } from "@/lib/api-error";

const CONFIRM_PHRASE = "DELETE ALL CONTACTS";

export function PurgeContactsClient({
  workspaceName,
}: {
  workspaceName: string;
}) {
  const [open, setOpen] = useState(false);
  const [phrase, setPhrase] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ deleted: number } | null>(null);

  const phraseOk = phrase.trim() === CONFIRM_PHRASE;

  const handlePurge = async () => {
    if (!phraseOk) return;
    setBusy(true);
    setError(null);
    try {
      const r = await contactsApi.deleteAll();
      setResult(r);
    } catch (err: unknown) {
      setError(getApiError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleClose = () => {
    if (busy) return;
    setOpen(false);
    setPhrase("");
    setError(null);
    setResult(null);
  };

  return (
    <>
      <div className="rounded-box border border-error/20 bg-base-200 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[0.875rem] font-semibold">Delete all contacts</p>
            <p className="mt-0.5 text-[0.75rem] text-base-content/55">
              Soft-deletes every contact in this workspace. Tags, segments, and notes are retained but become unattached. OWNER only.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-sm btn-outline btn-error"
            onClick={() => setOpen(true)}
          >
            Delete all
          </button>
        </div>
      </div>

      {open ? (
        <dialog open className="modal modal-middle">
          <div className="modal-box max-w-md rounded-box border border-error/30 !bg-base-100 p-0">
            <div className="flex items-start justify-between gap-3 border-b border-base-300 px-5 py-4">
              <div>
                <span className="op-label text-error">danger</span>
                <h3 className="mt-0.5 text-[1.0625rem] font-semibold tracking-[-0.015em]">
                  Delete all contacts
                </h3>
                <p className="mt-1 text-[0.78125rem] text-base-content/55">
                  Soft-deletes every contact in <span className="font-semibold text-base-content">{workspaceName}</span>. Real-time list updates push to all sessions.
                </p>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm btn-circle"
                onClick={handleClose}
                disabled={busy}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="space-y-4 px-5 py-4">
              {result ? (
                <div className="rounded-box border border-success/30 border-l-2 border-l-success bg-base-200 px-3 py-2.5">
                  <span className="op-label mb-1 block text-success">done</span>
                  <p className="text-[0.8125rem] text-base-content">
                    <span className="font-mono-op tabular-nums font-semibold">{result.deleted.toLocaleString()}</span> contacts soft-deleted.
                  </p>
                </div>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <span className="op-label block">
                      Type{" "}
                      <span className="font-mono-op rounded-[3px] border border-base-300 bg-base-200 px-1 py-[1px] text-[0.625rem] tracking-[0.04em] text-base-content">
                        {CONFIRM_PHRASE}
                      </span>{" "}
                      to confirm
                    </span>
                    <input
                      type="text"
                      className="input input-bordered input-sm w-full font-mono-op tracking-wider"
                      value={phrase}
                      onChange={(e) => setPhrase(e.target.value)}
                      autoFocus
                      disabled={busy}
                      autoComplete="off"
                    />
                  </div>

                  {error ? (
                    <div role="alert" className="rounded-box border border-error/30 border-l-2 border-l-error bg-base-200 px-3 py-2">
                      <span className="op-label mb-1 block text-error">error</span>
                      <p className="text-[0.8125rem]">{error}</p>
                    </div>
                  ) : null}
                </>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t border-base-300 px-5 py-3">
              {result ? (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={handleClose}
                >
                  Done
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={handleClose}
                    disabled={busy}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-error"
                    onClick={handlePurge}
                    disabled={!phraseOk || busy}
                  >
                    {busy ? (
                      <>
                        <span className="loading loading-spinner loading-xs" />
                        Deleting…
                      </>
                    ) : (
                      "Delete all"
                    )}
                  </button>
                </>
              )}
            </div>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button type="button" onClick={handleClose} aria-label="Close" />
          </form>
        </dialog>
      ) : null}
    </>
  );
}
