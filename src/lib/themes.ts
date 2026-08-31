/**
 * Theme registry — the single source of truth for every selectable theme.
 *
 * These are the conventional DaisyUI built-in themes. `dark` and `light` are
 * re-skinned in `globals.css` with the house slate/Bootstrap-blue "Operator"
 * look (custom `@plugin "daisyui/theme"` blocks override the stock defs); the
 * rest use DaisyUI's stock palettes. All 35 must also be listed in the
 * `@plugin "daisyui" { themes: … }` line in `globals.css`.
 *
 * The picker (`ThemeToggle`) groups by `colorScheme`, and the FOUC boot script
 * (`app/layout.tsx`) builds its id allow-list from `THEME_IDS` — so nothing
 * drifts out of sync. `swatch` is a static accent color (the theme's DaisyUI
 * `--color-primary`) shown before the theme is applied.
 */
export type ThemeColorScheme = "dark" | "light";

export interface ThemeDef {
  /** Value written to `document.documentElement[data-theme]`. */
  id: string;
  /** Human label shown in the picker. */
  label: string;
  /** `dark` | `light` — used to group the picker. */
  colorScheme: ThemeColorScheme;
  /** Representative accent color for the picker swatch (any CSS color). */
  swatch: string;
}

export const THEMES: ThemeDef[] = [
  // ── House themes (custom-skinned) ──
  { id: "dark", label: "Slate", colorScheme: "dark", swatch: "#6EA8FE" },
  { id: "light", label: "Daylight", colorScheme: "light", swatch: "#0D6EFD" },

  // ── Dark ──
  { id: "synthwave", label: "Synthwave", colorScheme: "dark", swatch: "oklch(71% .202 349.761)" },
  { id: "halloween", label: "Halloween", colorScheme: "dark", swatch: "oklch(77.48% .204 60.62)" },
  { id: "forest", label: "Forest", colorScheme: "dark", swatch: "oklch(68.628% .185 148.958)" },
  { id: "aqua", label: "Aqua", colorScheme: "dark", swatch: "oklch(85.661% .144 198.645)" },
  { id: "black", label: "Black", colorScheme: "dark", swatch: "oklch(35% 0 0)" },
  { id: "luxury", label: "Luxury", colorScheme: "dark", swatch: "oklch(100% 0 0)" },
  { id: "dracula", label: "Dracula", colorScheme: "dark", swatch: "oklch(75.461% .183 346.812)" },
  { id: "business", label: "Business", colorScheme: "dark", swatch: "oklch(41.703% .099 251.473)" },
  { id: "night", label: "Night", colorScheme: "dark", swatch: "oklch(75.351% .138 232.661)" },
  { id: "coffee", label: "Coffee", colorScheme: "dark", swatch: "oklch(71.996% .123 62.756)" },
  { id: "dim", label: "Dim", colorScheme: "dark", swatch: "oklch(86.133% .141 139.549)" },
  { id: "sunset", label: "Sunset", colorScheme: "dark", swatch: "oklch(74.703% .158 39.947)" },
  { id: "abyss", label: "Abyss", colorScheme: "dark", swatch: "oklch(92% .2653 125)" },

  // ── Light ──
  { id: "cupcake", label: "Cupcake", colorScheme: "light", swatch: "oklch(85% .138 181.071)" },
  { id: "bumblebee", label: "Bumblebee", colorScheme: "light", swatch: "oklch(85% .199 91.936)" },
  { id: "emerald", label: "Emerald", colorScheme: "light", swatch: "oklch(76.662% .135 153.45)" },
  { id: "corporate", label: "Corporate", colorScheme: "light", swatch: "oklch(58% .158 241.966)" },
  { id: "retro", label: "Retro", colorScheme: "light", swatch: "oklch(80% .114 19.571)" },
  { id: "cyberpunk", label: "Cyberpunk", colorScheme: "light", swatch: "oklch(74.22% .209 6.35)" },
  { id: "valentine", label: "Valentine", colorScheme: "light", swatch: "oklch(65% .241 354.308)" },
  { id: "garden", label: "Garden", colorScheme: "light", swatch: "oklch(62.45% .278 3.836)" },
  { id: "lofi", label: "Lo-Fi", colorScheme: "light", swatch: "oklch(15.906% 0 0)" },
  { id: "pastel", label: "Pastel", colorScheme: "light", swatch: "oklch(90% .063 306.703)" },
  { id: "fantasy", label: "Fantasy", colorScheme: "light", swatch: "oklch(37.45% .189 325.02)" },
  { id: "wireframe", label: "Wireframe", colorScheme: "light", swatch: "oklch(87% 0 0)" },
  { id: "cmyk", label: "CMYK", colorScheme: "light", swatch: "oklch(71.772% .133 239.443)" },
  { id: "autumn", label: "Autumn", colorScheme: "light", swatch: "oklch(40.723% .161 17.53)" },
  { id: "acid", label: "Acid", colorScheme: "light", swatch: "oklch(71.9% .357 330.759)" },
  { id: "lemonade", label: "Lemonade", colorScheme: "light", swatch: "oklch(58.92% .199 134.6)" },
  { id: "winter", label: "Winter", colorScheme: "light", swatch: "oklch(56.86% .255 257.57)" },
  { id: "nord", label: "Nord", colorScheme: "light", swatch: "oklch(59.435% .077 254.027)" },
  { id: "caramellatte", label: "Caramel Latte", colorScheme: "light", swatch: "oklch(0% 0 0)" },
  { id: "silk", label: "Silk", colorScheme: "light", swatch: "oklch(23.27% .0249 284.3)" },
];

export const DEFAULT_THEME = "light";

export const THEME_IDS: string[] = THEMES.map((t) => t.id);

export function isValidTheme(id: string | null | undefined): id is string {
  return !!id && THEME_IDS.includes(id);
}

export function getTheme(id: string | null | undefined): ThemeDef {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

/** Themes for one scheme, in registry order — used to group the picker. */
export function themesByScheme(scheme: ThemeColorScheme): ThemeDef[] {
  return THEMES.filter((t) => t.colorScheme === scheme);
}
