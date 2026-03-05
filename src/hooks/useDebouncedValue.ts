"use client";

import { useEffect, useState } from "react";

/**
 * Returns a value that updates only after `delayMs` has passed since the last change.
 * Useful for search inputs to avoid filtering on every keystroke.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);

  return debounced;
}
