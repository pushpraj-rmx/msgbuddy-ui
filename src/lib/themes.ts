/**
 * Theme registry — the single source of truth for every selectable theme.
 *
 * Adding a theme is a 2-step change:
 *   1. Add an entry here (id must be unique + kebab/lowercase).
 *   2. Add a matching `@plugin "daisyui/theme" { name: "<id>"; … }` block AND a
 *      `:root[data-theme="<id>"] { --op-*: … }` block in `globals.css`
 *      (see the existing themes for the full variable set incl. `--op-canvas`).
 *
 * The picker (`ThemeToggle`) and the FOUC boot script (`app/layout.tsx`) both
 * read from this list, so they never drift out of sync.
 */
export type ThemeColorScheme = "dark" | "light";

export interface ThemeDef {
  /** Value written to `document.documentElement[data-theme]`. */
  id: string;
  /** Human label shown in the picker. */
  label: string;
  /** `dark` | `light` — drives which mode the OS/native controls assume. */
  colorScheme: ThemeColorScheme;
  /** Representative accent color for the picker swatch (any CSS color). */
  swatch: string;
}

export const THEMES: ThemeDef[] = [
  { id: "dark", label: "Slate", colorScheme: "dark", swatch: "#6EA8FE" },
  { id: "light", label: "Daylight", colorScheme: "light", swatch: "#0D6EFD" },
  { id: "midnight", label: "Midnight", colorScheme: "dark", swatch: "#A78BFA" },
  { id: "emerald", label: "Emerald", colorScheme: "dark", swatch: "#4ADE80" },
  { id: "sand", label: "Sand", colorScheme: "light", swatch: "#C2410C" },
];

export const DEFAULT_THEME = "dark";

export const THEME_IDS: string[] = THEMES.map((t) => t.id);

export function isValidTheme(id: string | null | undefined): id is string {
  return !!id && THEME_IDS.includes(id);
}

export function getTheme(id: string | null | undefined): ThemeDef {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}
