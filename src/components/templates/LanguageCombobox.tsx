"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";

type Option = { value: string; label: string };

/**
 * Lightweight typeahead for the ~90 Meta template locales — a plain <select>
 * with that many options is unusable. Keyboard: type to filter, Enter/click to
 * pick, Esc to close. Falls back gracefully for a saved-but-unknown locale.
 */
export function LanguageCombobox({
  value,
  options,
  onChange,
  disabled,
}: {
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q)
    );
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className="select select-bordered select-sm flex w-full items-center justify-between"
        onClick={() => !disabled && setOpen((o) => !o)}
        disabled={disabled}
      >
        <span className="truncate">
          {selected ? `${selected.label} (${selected.value})` : value || "Select language"}
        </span>
        <ChevronsUpDown className="h-3.5 w-3.5 opacity-50" />
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-full rounded-box border border-base-300 bg-base-100 shadow-lg">
          <input
            autoFocus
            className="input input-bordered input-sm m-1 w-[calc(100%-0.5rem)]"
            placeholder="Search language…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setOpen(false);
              if (e.key === "Enter" && filtered[0]) {
                onChange(filtered[0].value);
                setOpen(false);
                setQuery("");
              }
            }}
          />
          <ul className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-xs text-base-content/50">No match</li>
            ) : (
              filtered.map((o) => (
                <li key={o.value}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[0.8125rem] hover:bg-base-200"
                    onClick={() => {
                      onChange(o.value);
                      setOpen(false);
                      setQuery("");
                    }}
                  >
                    <Check
                      className={`h-3.5 w-3.5 ${o.value === value ? "opacity-100" : "opacity-0"}`}
                    />
                    <span className="flex-1 truncate">{o.label}</span>
                    <span className="font-mono-op text-[0.6875rem] text-base-content/50">
                      {o.value}
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
