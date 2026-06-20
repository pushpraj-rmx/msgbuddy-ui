"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
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
            <span className="op-label mb-1 block">reference</span>
            <h2 className="text-[1.0625rem] font-semibold tracking-[-0.015em]">Keyboard shortcuts</h2>
            <p className="mt-1.5 text-[0.78125rem] text-base-content/65">
              Press <span className="op-kbd">?</span> anytime outside of text fields to
              open this dialog.
            </p>
          </div>
          <form method="dialog">
            <button
              type="submit"
              className="btn btn-ghost btn-sm btn-square"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </form>
        </div>

        <div className="overflow-hidden rounded-box border border-base-300 bg-base-200">
          <table className="w-full text-[0.78125rem]">
            <thead>
              <tr className="border-b border-base-300 bg-base-100">
                <th className="op-label w-[36%] px-3 py-2.5 text-left font-medium">Shortcut</th>
                <th className="op-label px-3 py-2.5 text-left font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {KEYBOARD_SHORTCUTS_CATALOG.map((row, idx) => (
                <tr key={idx} className="border-b border-base-300 last:border-b-0">
                  <td className="whitespace-nowrap px-3 py-2.5 align-top">
                    <span className="op-kbd">{row.keys}</span>
                  </td>
                  <td className="px-3 py-2.5 text-base-content/85">{row.description}</td>
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
