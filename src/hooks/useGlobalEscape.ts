"use client";

import { useEffect } from "react";

/**
 * Standardized Esc cascade. Single window listener that picks **one** action
 * per press based on what's currently open / focused. Priority order (first
 * match wins):
 *
 *   1. Native `<dialog open>` is on screen → no-op (browser closes the
 *      top-most dialog; we don't fight it).
 *   2. The lightbox library handles its own Esc internally (modal portal),
 *      so we similarly defer — no work here.
 *   3. Active element is an opt-in clearable input
 *      (`data-esc-clearable="true"`):
 *        - has text → clear it (set value to "" via the native setter so
 *          React state stays in sync) and stop.
 *        - empty → blur and stop.
 *   4. Active element is *any other* input / textarea / contenteditable →
 *      no-op. Protects the composer and other "typing-sacred" surfaces from
 *      Esc-induced state loss.
 *   5. Otherwise → no-op.
 *
 * Context-menu close (GlobalContextMenu / MessageContextMenu) is owned by
 * those components themselves with capture-mode listeners — they fire before
 * this hook would. We intentionally don't duplicate that logic here.
 *
 * Closing the right panel on Esc was deliberately **removed** — agents
 * found it disruptive (panel disappears while they're navigating with
 * keyboard or after dismissing a menu).
 *
 * Single-step on purpose: each press consumes at most one piece of state.
 * No chained "clear search AND blur" — easier to predict.
 */
export function useGlobalEscape() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;

      // (1) Don't interfere with native <dialog open> Esc handling.
      if (typeof document !== "undefined" && document.querySelector("dialog[open]")) {
        return;
      }

      const active = (typeof document !== "undefined"
        ? (document.activeElement as HTMLElement | null)
        : null);

      const tag = active?.tagName?.toLowerCase();
      const isTextField =
        tag === "input" ||
        tag === "textarea" ||
        (active?.isContentEditable ?? false);

      if (active && isTextField) {
        // (3) Opt-in clearable inputs only — never touch the composer or
        // other unmarked text fields.
        if (active.dataset.escClearable === "true") {
          const input = active as HTMLInputElement | HTMLTextAreaElement;
          if ((input.value ?? "").length > 0) {
            // Use the native setter so React's onChange picks up the change.
            // Plain assignment to .value doesn't trigger React's synthetic
            // events because React tracks value via the property descriptor.
            const proto =
              tag === "input"
                ? window.HTMLInputElement.prototype
                : window.HTMLTextAreaElement.prototype;
            const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
            if (setter) {
              setter.call(input, "");
              input.dispatchEvent(new Event("input", { bubbles: true }));
            } else {
              input.value = "";
            }
            e.preventDefault();
            return;
          }
          // Empty + still focused → blur on this press.
          input.blur();
          e.preventDefault();
          return;
        }
        // (4) Any other typing-target: don't escalate. Composer drafts and
        // similar contexts are sacred.
        return;
      }

      // (5) No further fallback — closing global panels on Esc was found
      // disruptive. Native dialogs, context menus, and lightbox already
      // handle their own Esc, so nothing else needs to happen here.
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
