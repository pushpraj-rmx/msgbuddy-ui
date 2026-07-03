"use client";

import { useId } from "react";
import type { SVGProps } from "react";

export type BrandExpression =
  | "neutral"
  | "thinking"
  | "happy"
  | "sleeping"
  | "success"
  | "error";

export type BrandTone = "brand" | "current" | "white";

const TONE: Record<BrandTone, string> = {
  brand: "#6440F5", // fixed brand indigo — never follows a UI theme
  current: "currentColor",
  white: "#FFFFFF",
};

type BrandIconProps = Omit<SVGProps<SVGSVGElement>, "children"> & {
  /** Face state — pick to match the moment (empty, loading, error, success…). */
  expression?: BrandExpression;
  /** Mark color. `brand` indigo by default; `current` inherits text color. */
  tone?: BrandTone;
  /** Accessible label / tooltip. */
  title?: string;
};

function Face({ expression, c }: { expression: BrandExpression; c: string }) {
  switch (expression) {
    case "thinking":
      return (
        <>
          <circle cx="25.5" cy="32.5" r="2" fill={c} />
          <circle cx="32" cy="32.5" r="2" fill={c} />
          <circle cx="38.5" cy="32.5" r="2" fill={c} />
        </>
      );
    case "happy":
      return (
        <>
          <path d="M21.5 33.5 Q26 28 30.5 33.5" fill="none" stroke={c} strokeWidth="2.6" strokeLinecap="round" />
          <path d="M33.5 33.5 Q38 28 42.5 33.5" fill="none" stroke={c} strokeWidth="2.6" strokeLinecap="round" />
        </>
      );
    case "sleeping":
      return (
        <>
          <rect x="22" y="31.2" width="7.5" height="2.7" rx="1.35" fill={c} />
          <rect x="34.5" y="31.2" width="7.5" height="2.7" rx="1.35" fill={c} />
        </>
      );
    case "success":
      return (
        <path d="M25 32.5 L30 37 L39.5 27.5" fill="none" stroke={c} strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
      );
    case "error":
      return (
        <>
          <rect x="30.65" y="25.5" width="2.7" height="8.5" rx="1.35" fill={c} />
          <circle cx="32" cy="38.5" r="1.9" fill={c} />
        </>
      );
    default:
      return (
        <>
          <rect x="24" y="27.8" width="4.5" height="9.5" rx="2.25" fill={c} />
          <rect x="35.5" y="27.8" width="4.5" height="9.5" rx="2.25" fill={c} />
        </>
      );
  }
}

/**
 * MsgBuddy icon-only mark — the "visor buddy" face, with an optional expression
 * state. Use for collapsed nav, avatars/fallbacks, and product empty / loading /
 * error / success moments. Size via `className` (the viewBox drives the ratio).
 * Sibling of {@link BrandLogo} (the full icon + wordmark lockup).
 */
export function BrandIcon({ expression = "neutral", tone = "brand", title, ...props }: BrandIconProps) {
  const maskId = useId();
  const c = TONE[tone];
  return (
    <svg role="img" aria-label={title ?? "MsgBuddy"} viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" {...props}>
      {title ? <title>{title}</title> : null}
      <defs>
        <mask id={maskId}>
          <rect width="64" height="64" fill="#fff" />
          <rect x="16" y="22.5" width="32" height="20" rx="10" fill="#000" />
        </mask>
      </defs>
      <rect x="10" y="15" width="44" height="36" rx="15" fill={c} mask={`url(#${maskId})`} />
      <rect x="5" y="26" width="7" height="14" rx="3.5" fill={c} />
      <rect x="52" y="26" width="7" height="14" rx="3.5" fill={c} />
      <Face expression={expression} c={c} />
    </svg>
  );
}
