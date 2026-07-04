"use client";

import {
  datetimeLocalToUnixMs,
  unixMsToDatetimeLocal,
  type VariableInputKind,
} from "@/lib/template-variables";

/**
 * A single typed input for a template send-time value. The stored `value` is
 * always the wire string the send payload expects — for `datetime` that is Unix
 * epoch **milliseconds**, so this component converts to/from a `datetime-local`
 * control internally. Used by both the inbox composer and the campaign wizard so
 * coupon codes, offer expiries and location coordinates get purpose-built inputs.
 */
export function TemplateValueField({
  kind,
  value,
  onChange,
  size = "sm",
  className = "",
  placeholder,
  disabled,
}: {
  kind: VariableInputKind;
  value: string;
  onChange: (next: string) => void;
  /** daisyUI input size suffix. */
  size?: "xs" | "sm";
  className?: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  const base = `input input-bordered input-${size} ${className}`.trim();

  if (kind === "datetime") {
    return (
      <input
        type="datetime-local"
        className={base}
        value={unixMsToDatetimeLocal(value)}
        disabled={disabled}
        onChange={(e) => onChange(datetimeLocalToUnixMs(e.target.value))}
      />
    );
  }

  if (kind === "latitude" || kind === "longitude") {
    const isLat = kind === "latitude";
    return (
      <input
        type="number"
        step="any"
        min={isLat ? -90 : -180}
        max={isLat ? 90 : 180}
        className={`${base} font-mono-op`}
        value={value}
        disabled={disabled}
        placeholder={placeholder ?? (isLat ? "e.g. 37.4220" : "e.g. -122.0841")}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  if (kind === "coupon") {
    return (
      <input
        type="text"
        maxLength={20}
        className={`${base} font-mono-op uppercase`}
        value={value}
        disabled={disabled}
        placeholder={placeholder ?? "e.g. SAVE20"}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  return (
    <input
      type="text"
      className={base}
      value={value}
      disabled={disabled}
      placeholder={placeholder ?? "value"}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
