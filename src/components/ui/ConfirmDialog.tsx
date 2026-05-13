"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Operator-styled destructive action confirmation dialog.
 * Replaces browser `window.confirm()` across the app.
 *
 * Usage:
 * ```tsx
 * <ConfirmDialog
 *   open={showConfirm}
 *   title="Cancel campaign"
 *   description="This will stop all pending sends. Already-delivered messages are not affected."
 *   confirmLabel="Cancel campaign"
 *   tone="danger"
 *   onConfirm={handleCancel}
 *   onClose={() => setShowConfirm(false)}
 * />
 * ```
 */

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description?: ReactNode;
  /** Label for the confirm button. Defaults to "Confirm". */
  confirmLabel?: string;
  /** Semantic tone for the confirm button. */
  tone?: "danger" | "warning" | "primary";
  /** Whether the confirm action is in progress (shows spinner, disables buttons). */
  loading?: boolean;
  /** Optional: render a text input the user must fill (e.g. suspend reason). Returns value via onConfirm. */
  promptLabel?: string;
  promptPlaceholder?: string;
  onConfirm: (promptValue?: string) => void;
  onClose: () => void;
};

const TONE_CLASS: Record<string, string> = {
  danger: "btn border-error/40 bg-error text-error-content hover:bg-error/90",
  warning: "btn border-warning/40 bg-warning text-warning-content hover:bg-warning/90",
  primary: "btn btn-primary",
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  tone = "danger",
  loading = false,
  promptLabel,
  promptPlaceholder,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const promptRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
      promptRef.current?.focus();
    } else if (!open && el.open) {
      el.close();
    }
  }, [open]);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    const onCloseDlg = () => onClose();
    el.addEventListener("close", onCloseDlg);
    return () => el.removeEventListener("close", onCloseDlg);
  }, [onClose]);

  const handleConfirm = () => {
    onConfirm(promptRef.current?.value);
  };

  return (
    <dialog ref={dialogRef} className="modal modal-middle">
      <div className="modal-box max-w-sm">
        <span className="op-label text-error">confirm action</span>
        <h3 className="mt-1 text-[17px] font-semibold tracking-[-0.015em]">
          {title}
        </h3>
        {description ? (
          <p className="mt-2 text-[13px] leading-relaxed text-base-content/70">
            {description}
          </p>
        ) : null}
        {promptLabel ? (
          <div className="mt-3">
            <label className="op-label mb-1.5 block">{promptLabel}</label>
            <input
              ref={promptRef}
              type="text"
              className="input input-bordered input-sm w-full font-mono-op"
              placeholder={promptPlaceholder}
            />
          </div>
        ) : null}
        <div className="modal-action">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="button"
            className={`btn-sm ${TONE_CLASS[tone]}`}
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading ? (
              <span className="loading loading-spinner loading-xs" />
            ) : null}
            {confirmLabel}
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
