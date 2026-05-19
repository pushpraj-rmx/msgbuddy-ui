"use client";

import { useEffect, useRef, useState } from "react";
import {
  webhooksApi,
  type WebhookEndpointResponseDto,
} from "@/lib/api";
import { WebhookEventTypePicker } from "./WebhookEventTypePicker";

function isValidHttpsUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "https:" && u.hostname.length > 0;
  } catch {
    return false;
  }
}
function isValidApiVersion(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/**
 * Edit an existing endpoint's URL, label, event subscriptions, enabled
 * toggle, and apiVersion override. No reveal stage — secrets are not
 * touched by this surface; use the rotate-secret action for that.
 */
export function EditWebhookEndpointDialog({
  open,
  endpoint,
  onClose,
  onSaved,
}: {
  open: boolean;
  endpoint: WebhookEndpointResponseDto | null;
  onClose: () => void;
  onSaved: (updated: WebhookEndpointResponseDto) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [eventTypes, setEventTypes] = useState<string[]>([]);
  const [enabled, setEnabled] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [apiVersion, setApiVersion] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync form to the endpoint being edited every time the dialog opens.
  useEffect(() => {
    if (!open || !endpoint) return;
    setUrl(endpoint.url);
    setDescription(endpoint.description ?? "");
    setEventTypes(endpoint.eventTypes);
    setEnabled(endpoint.enabled);
    setApiVersion(endpoint.apiVersion ?? "");
    setShowAdvanced(false);
    setError(null);
    setSubmitting(false);
  }, [open, endpoint]);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
    } else if (!open && el.open) {
      el.close();
    }
  }, [open]);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    const onCloseEvt = () => onClose();
    el.addEventListener("close", onCloseEvt);
    return () => el.removeEventListener("close", onCloseEvt);
  }, [onClose]);

  const handleSave = async () => {
    if (!endpoint) return;
    if (!isValidHttpsUrl(url)) {
      setError("URL must be HTTPS and resolve to a public host.");
      return;
    }
    if (eventTypes.length === 0) {
      setError("Subscribe to at least one event.");
      return;
    }
    if (apiVersion && !isValidApiVersion(apiVersion)) {
      setError("API version must be YYYY-MM-DD.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      // Only send changed fields. Backend accepts partial updates.
      const patch: Parameters<typeof webhooksApi.update>[1] = {};
      if (url.trim() !== endpoint.url) patch.url = url.trim();
      if (description.trim() !== (endpoint.description ?? ""))
        patch.description = description.trim();
      if (
        eventTypes.length !== endpoint.eventTypes.length ||
        eventTypes.some((v, i) => v !== endpoint.eventTypes[i])
      ) {
        patch.eventTypes = eventTypes;
      }
      if (enabled !== endpoint.enabled) patch.enabled = enabled;
      if (apiVersion && apiVersion !== endpoint.apiVersion)
        patch.apiVersion = apiVersion;

      if (Object.keys(patch).length === 0) {
        // No-op save — close cleanly.
        onClose();
        return;
      }
      const updated = await webhooksApi.update(endpoint.id, patch);
      onSaved(updated);
      onClose();
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } };
      setError(
        err.response?.data?.message ||
          (e instanceof Error ? e.message : "Failed to save changes."),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <dialog ref={dialogRef} className="modal modal-middle">
      <div className="modal-box max-w-xl">
        <span className="op-label">edit endpoint</span>
        <h3 className="mt-1 text-[1.0625rem] font-semibold tracking-[-0.015em]">
          {endpoint?.description || "Endpoint"}
        </h3>

        <div className="mt-5 max-h-[60vh] space-y-5 overflow-y-auto pr-1">
          <div>
            <label className="op-label mb-1.5 block" htmlFor="ew-url">
              url
            </label>
            <input
              id="ew-url"
              type="url"
              className="input input-bordered input-sm w-full font-mono-op"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={submitting}
            />
          </div>

          <div>
            <label className="op-label mb-1.5 block" htmlFor="ew-desc">
              label
            </label>
            <input
              id="ew-desc"
              type="text"
              className="input input-bordered input-sm w-full"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={200}
              disabled={submitting}
            />
          </div>

          <WebhookEventTypePicker
            value={eventTypes}
            onChange={setEventTypes}
            disabled={submitting}
          />

          <div className="rounded-box border border-base-300 bg-base-200 px-3 py-2.5">
            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                className="toggle toggle-sm"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                disabled={submitting}
              />
              <div className="min-w-0 flex-1">
                <div className="text-[0.8125rem] font-medium">
                  {enabled ? "Enabled" : "Disabled"}
                </div>
                <p className="font-mono-op text-[0.6875rem] text-base-content/40">
                  {enabled
                    ? "events are delivered to this endpoint"
                    : "events are NOT delivered; history is preserved"}
                </p>
              </div>
            </label>
          </div>

          <div>
            <button
              type="button"
              className="font-mono-op text-[0.6875rem] tracking-[0.12em] uppercase text-base-content/55 hover:text-base-content"
              onClick={() => setShowAdvanced(!showAdvanced)}
              disabled={submitting}
            >
              {showAdvanced ? "− hide advanced" : "+ show advanced"}
            </button>
            {showAdvanced ? (
              <div className="mt-3 rounded-box border border-base-300 bg-base-200 p-3">
                <label className="op-label mb-1.5 block" htmlFor="ew-apiversion">
                  envelope api-version
                </label>
                <input
                  id="ew-apiversion"
                  type="text"
                  className="input input-bordered input-sm w-full font-mono-op"
                  value={apiVersion}
                  onChange={(e) => setApiVersion(e.target.value)}
                  disabled={submitting}
                />
                <p className="mt-1 font-mono-op text-[0.6875rem] text-base-content/40">
                  Format YYYY-MM-DD. Clear and re-save to fall back to the
                  workspace default.
                </p>
              </div>
            ) : null}
          </div>
        </div>

        {error ? (
          <div
            role="alert"
            className="mt-4 rounded-box border border-error/30 border-l-2 border-l-error bg-base-200 px-3 py-2.5"
          >
            <span className="op-label mb-1 block text-error">error</span>
            <p className="text-[0.8125rem]">{error}</p>
          </div>
        ) : null}

        <div className="modal-action mt-6">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => void handleSave()}
            disabled={submitting}
          >
            {submitting ? (
              <span className="loading loading-spinner loading-xs" />
            ) : null}
            Save changes
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button type="submit" className="sr-only" aria-label="Close">
          close
        </button>
      </form>
    </dialog>
  );
}
