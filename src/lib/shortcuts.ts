/**
 * Central place for keyboard shortcut names and helpers.
 * Extend here as new shortcuts are added.
 */

export const SHORTCUT_EVENTS = {
  /** Focus global search (desktop inline or mobile overlay consumers listen). */
  OPEN_GLOBAL_SEARCH: "msgbuddy:open-global-search",
  /** Open the keyboard shortcuts help modal. */
  OPEN_SHORTCUTS_HELP: "msgbuddy:open-shortcuts-help",
  /** Toggle the details (right) panel open/closed. */
  TOGGLE_DETAILS_PANEL: "msgbuddy:toggle-details-panel",
} as const;

export function dispatchOpenGlobalSearch(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(SHORTCUT_EVENTS.OPEN_GLOBAL_SEARCH));
}

export function dispatchOpenShortcutsHelp(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(SHORTCUT_EVENTS.OPEN_SHORTCUTS_HELP));
}

export function dispatchToggleDetailsPanel(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(SHORTCUT_EVENTS.TOGGLE_DETAILS_PANEL));
}

/** Single source of truth for the help modal (keep in sync with actual handlers). */
export const KEYBOARD_SHORTCUTS_CATALOG: ReadonlyArray<{
  keys: string;
  description: string;
}> = [
  {
    keys: "?",
    description: "Open this keyboard shortcuts help",
  },
  {
    keys: "Ctrl + K · ⌘ + K",
    description: "Open global search",
  },
  {
    keys: "Esc",
    description:
      "Close the topmost dialog, context menu, or lightbox. In a search input, first press clears the text; second press blurs the field. Composer drafts are never cleared by Esc.",
  },
  {
    keys: "R",
    description: "Focus reply composer in inbox (when not typing in a field)",
  },
  {
    keys: ".",
    description: "Toggle details panel open/closed",
  },
];
