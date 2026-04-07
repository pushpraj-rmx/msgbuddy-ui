"use client";

import { useEffect, useState } from "react";

/** Matches Tailwind `xl` (1280px). */
export const XL_MEDIA_QUERY = "(min-width: 1280px)" as const;

/**
 * Subscribes to `matchMedia`. Initial state is `false` until mount so SSR and
 * the first client render match (no hydration mismatch).
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    setMatches(media.matches);
    const listener = (e: MediaQueryListEvent) => setMatches(e.matches);
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, [query]);

  return matches;
}
