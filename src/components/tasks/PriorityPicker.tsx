"use client";

import type { TaskPriority } from "@/lib/api";

/**
 * Three chips for urgency selection. Default to NORMAL. Colors mirror the
 * priority badges shown on task cards so the picker reads the same as the
 * list/card surfaces.
 */
const OPTIONS: Array<{
  value: TaskPriority;
  label: string;
  activeClass: string;
  idleClass: string;
}> = [
  {
    value: "LOW",
    label: "Low",
    activeClass: "border-base-content/30 bg-base-300 text-base-content",
    idleClass: "border-base-300 text-base-content/55 hover:text-base-content",
  },
  {
    value: "NORMAL",
    label: "Normal",
    activeClass: "border-primary/50 bg-primary/15 text-primary",
    idleClass: "border-base-300 text-base-content/65 hover:text-base-content",
  },
  {
    value: "HIGH",
    label: "High",
    activeClass: "border-error/50 bg-error/15 text-error",
    idleClass: "border-base-300 text-base-content/65 hover:text-error",
  },
];

export function PriorityPicker({
  value,
  onChange,
  disabled,
  size = "sm",
}: {
  value: TaskPriority;
  onChange: (next: TaskPriority) => void;
  disabled?: boolean;
  size?: "xs" | "sm";
}) {
  const heightCls = size === "xs" ? "h-6 px-2 text-[0.625rem]" : "h-7 px-2.5 text-[0.6875rem]";
  return (
    <div
      role="radiogroup"
      aria-label="Task priority"
      className="inline-flex items-center gap-1"
    >
      <span className="op-label">Priority</span>
      {OPTIONS.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            className={`inline-flex items-center justify-center rounded border font-mono-op uppercase tracking-[0.04em] transition-colors ${heightCls} ${
              active ? opt.activeClass : opt.idleClass
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
