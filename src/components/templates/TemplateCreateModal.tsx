"use client";

import { useState } from "react";

type Props = {
  onClose: () => void;
  onSave: (payload: {
    name: string;
    description?: string;
  }) => void;
  isPending?: boolean;
  errorMessage?: string | null;
  onClearError?: () => void;
};

export function TemplateCreateModal({
  onClose,
  onSave,
  isPending = false,
  errorMessage = null,
  onClearError,
}: Props) {
  const [rawName, setRawName] = useState("");
  const [description, setDescription] = useState("");

  const toMetaTemplateName = (raw: string): string =>
    (raw ?? "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "");

  const metaName = toMetaTemplateName(rawName);

  return (
    <dialog open className="modal modal-middle">
      <div className="modal-box">
        <h3 className="text-lg font-semibold">Create message</h3>
        {errorMessage && (
          <div role="alert" className="alert alert-error mt-3 text-sm">
            <span>{errorMessage}</span>
          </div>
        )}
        <div className="mt-4 space-y-3">
          <label className="label">
            <span className="label-text">Name</span>
          </label>
          <input
            type="text"
            placeholder="e.g. Order update"
            className="input input-bordered w-full"
            value={rawName}
            onChange={(e) => {
              onClearError?.();
              setRawName(e.target.value);
            }}
          />
          <div className="text-xs text-base-content/60">
            Meta template name:{" "}
            <span className="font-mono">{metaName || "—"}</span>
            <span className="ml-2">
              (allowed: lowercase letters, numbers, underscores)
            </span>
          </div>
          <label className="label">
            <span className="label-text">Description (optional)</span>
          </label>
          <input
            type="text"
            placeholder="Description"
            className="input input-bordered w-full"
            value={description}
            onChange={(e) => {
              onClearError?.();
              setDescription(e.target.value);
            }}
          />
        </div>
        <div className="modal-action">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onClose}
            disabled={isPending}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() =>
              onSave({
                name: metaName,
                description: description.trim() || undefined,
              })
            }
            disabled={!metaName || isPending}
          >
            {isPending ? (
              <>
                <span className="loading loading-spinner loading-sm" />
                Saving…
              </>
            ) : (
              "Save"
            )}
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop" onSubmit={onClose}>
        <button type="submit">close</button>
      </form>
    </dialog>
  );
}
