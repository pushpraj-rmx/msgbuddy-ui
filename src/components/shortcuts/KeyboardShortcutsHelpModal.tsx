"use client";

import { useEffect, useRef } from "react";
import CloseRounded from "@mui/icons-material/CloseRounded";
import { KEYBOARD_SHORTCUTS_CATALOG } from "@/lib/shortcuts";

export function KeyboardShortcutsHelpModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    const onCloseDlg = () => onClose();
    el.addEventListener("close", onCloseDlg);
    return () => el.removeEventListener("close", onCloseDlg);
  }, [onClose]);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open) {
      el.showModal();
    } else {
      el.close();
    }
  }, [open]);

  return (
    <dialog ref={dialogRef} className="modal modal-middle">
      <div className="modal-box max-h-[min(85dvh,32rem)] max-w-lg overflow-y-auto">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Keyboard shortcuts</h2>
            <p className="mt-1 text-sm text-base-content/65">
              Press <kbd className="kbd kbd-sm">?</kbd> anytime outside of text fields to
              open this dialog.
            </p>
          </div>
          <form method="dialog">
            <button
              type="submit"
              className="btn btn-ghost btn-sm btn-square"
              aria-label="Close"
            >
              <CloseRounded className="h-5 w-5" />
            </button>
          </form>
        </div>

        <div className="overflow-hidden rounded-box border border-base-300">
          <table className="table table-sm">
            <thead>
              <tr className="border-b border-base-300 bg-base-200/60">
                <th className="w-[36%]">Shortcut</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {KEYBOARD_SHORTCUTS_CATALOG.map((row, idx) => (
                <tr key={idx} className="border-base-300">
                  <td className="align-top font-mono text-sm whitespace-nowrap">
                    <kbd className="kbd kbd-sm">{row.keys}</kbd>
                  </td>
                  <td className="text-sm text-base-content/90">{row.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="modal-action">
          <form method="dialog">
            <button type="submit" className="btn btn-primary">
              Done
            </button>
          </form>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button type="submit" className="sr-only" aria-label="Close help">
          close
        </button>
      </form>
    </dialog>
  );
}
