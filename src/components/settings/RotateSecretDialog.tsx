"use client";

import { useEffect, useRef, useState } from "react";
import {
  webhooksApi,
  type CreatedWebhookEndpointResponseDto,
  type WebhookEndpointResponseDto,
} from "@/lib/api";

type Stage = "confirm" | "reveal";

/**
 * Rotate the HMAC signing secret on an endpoint.
 *
 * Same "secret-as-artifact" reveal as the create flow, but starts on a
 * deliberate confirm step — rotation immediately invalidates the previous
 * secret, so any verification code still loading the old one breaks on
 * the next delivery. We name that consequence up front.
 */
export function RotateSecretDialog({
  open,
  endpoint,
  onClose,
  onRotated,
}: {
  open: boolean;
  endpoint: WebhookEndpointResponseDto | null;
  onClose: () => void;
  onRotated: (rotated: CreatedWebhookEndpointResponseDto) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [stage, setStage] = useState<Stage>("confirm");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rotated, setRotated] = useState<CreatedWebhookEndpointResponseDto | null>(
    null,
  );
  const [copyStamp, setCopyStamp] = useState<string | null>(null);
  const [savedConfirmed, setSavedConfirmed] = useState(false);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  }, [open]);

  // Reset on close
  useEffect(() => {
    if (open) return;
    setStage("confirm");
    setSubmitting(false);
    setError(null);
    setRotated(null);
    setCopyStamp(null);
    setSavedConfirmed(false);
  }, [open]);

  // Reveal exit gate
  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    const onCancel = (e: Event) => {
      if (stage === "reveal") e.preventDefault();
    };
    const onCloseEvt = () => {
      if (stage === "confirm") onClose();
    };
    el.addEventListener("cancel", onCancel);
    el.addEventListener("close", onCloseEvt);
    return () => {
      el.removeEventListener("cancel", onCancel);
      el.removeEventListener("close", onCloseEvt);
    };
  }, [stage, onClose]);

  const handleRotate = async () => {
    if (!endpoint) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await webhooksApi.rotateSecret(endpoint.id);
      setRotated(result);
      setStage("reveal");
    } catch (e) {
      const err = e as { response?: { data?: { message?: string } } };
      setError(
        err.response?.data?.message ||
          (e instanceof Error ? e.message : "Could not rotate the secret."),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopy = async () => {
    if (!rotated) return;
    try {
      await navigator.clipboard.writeText(rotated.plaintextSecret);
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, "0");
      const mm = String(now.getMinutes()).padStart(2, "0");
      const ss = String(now.getSeconds()).padStart(2, "0");
      setCopyStamp(`${hh}:${mm}:${ss}`);
      setTimeout(() => setCopyStamp(null), 4000);
    } catch {
      setError(
        "Clipboard unavailable. Select the secret above and copy it manually.",
      );
    }
  };

  const handleDone = () => {
    if (!rotated || !savedConfirmed) return;
    onRotated(rotated);
    onClose();
  };

  return (
    <dialog ref={dialogRef} className="modal modal-middle">
      <div
        className="modal-box max-w-lg overflow-hidden"
        style={{ animation: "op-panel-fade-in 160ms cubic-bezier(0.2, 0, 0, 1)" }}
      >
        {stage === "confirm" ? (
          <>
            <span className="op-label text-warning">rotating signing secret</span>
            <h3 className="mt-1 text-[1.0625rem] font-semibold tracking-[-0.015em]">
              Rotate the secret for this endpoint?
            </h3>
            <p className="mt-2 text-[0.8125rem] leading-relaxed text-base-content/70">
              The current secret stops accepting signatures{" "}
              <span className="font-mono-op text-base-content">immediately</span>.
              Any verification code in your app that still loads the old
              secret will start rejecting deliveries on the next event. Make
              sure you can deploy the new secret quickly.
            </p>
            {endpoint ? (
              <div className="mt-4 rounded-box border border-base-300 bg-base-200 px-3 py-2.5">
                <span className="op-label mb-1 block">endpoint</span>
                <p className="break-all font-mono-op text-[0.78125rem] text-base-content/80">
                  {endpoint.description || endpoint.url}
                </p>
                <p className="mt-1 font-mono-op text-[0.6875rem] text-base-content/40">
                  current secret · ●●●●●●●● {endpoint.lastFour}
                </p>
              </div>
            ) : null}

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
                className="btn btn-sm border-warning/40 bg-warning text-warning-content hover:bg-warning/90"
                onClick={() => void handleRotate()}
                disabled={submitting}
              >
                {submitting ? (
                  <span className="loading loading-spinner loading-xs" />
                ) : null}
                Rotate now
              </button>
            </div>
          </>
        ) : (
          <>
            <span className="op-label" style={{ color: "var(--op-accent)" }}>
              secret rotated
            </span>
            <h3
              className="mt-1 italic text-[1.25rem] leading-snug tracking-[-0.015em]"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              Here is the new secret.
            </h3>
            <p className="mt-2 break-all font-mono-op text-[0.78125rem] text-base-content/60">
              {rotated?.url}
            </p>

            <div
              className="op-grain mt-5 flex items-center gap-3 rounded-box border border-base-300 bg-[var(--op-bg-2)] px-5 py-4"
              style={{
                animation:
                  "op-panel-fade-in 200ms 60ms cubic-bezier(0.2, 0, 0, 1) backwards",
              }}
            >
              <code
                className="flex-1 select-all break-all font-mono-op text-[1.0625rem] tabular-nums tracking-tight text-base-content/95"
                aria-label="New signing secret"
              >
                {rotated?.plaintextSecret ?? ""}
              </code>
              <button
                type="button"
                onClick={() => void handleCopy()}
                className="btn btn-sm shrink-0 border-base-300 bg-base-100 font-mono-op text-[0.75rem] tracking-[0.04em] hover:bg-[var(--op-bg-hover)]"
                style={{ minWidth: "11ch" }}
              >
                {copyStamp ? (
                  <span style={{ color: "var(--op-accent)" }}>
                    Copied {copyStamp}
                  </span>
                ) : (
                  <>Copy</>
                )}
              </button>
            </div>

            <div
              className="mt-4 rounded-box border border-warning/30 border-l-2 border-l-warning bg-base-200 px-4 py-3"
              style={{
                animation:
                  "op-panel-fade-in 200ms 140ms cubic-bezier(0.2, 0, 0, 1) backwards",
              }}
            >
              <span
                className="op-label mb-1 block"
                style={{ color: "var(--op-warn)" }}
              >
                deploy now
              </span>
              <p className="text-[0.8125rem] leading-relaxed">
                The previous secret is invalid as of this moment. Push the
                new secret to your verification code before more events
                fire.
              </p>
            </div>

            <label
              className="mt-5 flex cursor-pointer items-start gap-3"
              style={{
                animation:
                  "op-panel-fade-in 200ms 220ms cubic-bezier(0.2, 0, 0, 1) backwards",
              }}
            >
              <input
                type="checkbox"
                className="checkbox checkbox-sm mt-0.5"
                checked={savedConfirmed}
                onChange={(e) => setSavedConfirmed(e.target.checked)}
              />
              <span className="text-[0.8125rem] leading-relaxed">
                I&apos;ve saved this secret and updated my verification
                code.
              </span>
            </label>

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
                className="btn btn-primary btn-sm"
                onClick={handleDone}
                disabled={!savedConfirmed}
                style={{ opacity: savedConfirmed ? 1 : 0.4 }}
              >
                Done
              </button>
            </div>
          </>
        )}
      </div>
      {stage === "confirm" ? (
        <form method="dialog" className="modal-backdrop">
          <button type="submit" className="sr-only" aria-label="Close">
            close
          </button>
        </form>
      ) : (
        <div className="modal-backdrop bg-black/60" aria-hidden="true" />
      )}
    </dialog>
  );
}
