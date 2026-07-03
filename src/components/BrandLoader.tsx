"use client";

import { useId } from "react";
import type { SVGProps } from "react";
import type { BrandTone } from "./BrandIcon";

const TONE: Record<BrandTone, string> = {
  brand: "#6440F5",
  current: "currentColor",
  white: "#FFFFFF",
};

type BrandLoaderProps = Omit<SVGProps<SVGSVGElement>, "children"> & {
  tone?: BrandTone;
  title?: string;
};

/**
 * Animated MsgBuddy loader — the buddy "thinking" with staggered dots. The
 * animation is self-contained SMIL (no CSS keyframes needed), so it works in
 * route `loading.tsx` and Suspense fallbacks. Size via `className`.
 */
export function BrandLoader({ tone = "brand", title = "Loading", ...props }: BrandLoaderProps) {
  const maskId = useId();
  const c = TONE[tone];
  const dots = [25.5, 32, 38.5];
  return (
    <svg role="img" aria-label={title} viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" {...props}>
      <title>{title}</title>
      <defs>
        <mask id={maskId}>
          <rect width="64" height="64" fill="#fff" />
          <rect x="16" y="22.5" width="32" height="20" rx="10" fill="#000" />
        </mask>
      </defs>
      <rect x="10" y="15" width="44" height="36" rx="15" fill={c} mask={`url(#${maskId})`} />
      <rect x="5" y="26" width="7" height="14" rx="3.5" fill={c} />
      <rect x="52" y="26" width="7" height="14" rx="3.5" fill={c} />
      {dots.map((cx, i) => (
        <circle key={cx} cx={cx} cy="32.5" r="2" fill={c}>
          <animate
            attributeName="opacity"
            values="0.25;1;0.25"
            dur="1.1s"
            begin={`${i * 0.16}s`}
            repeatCount="indefinite"
          />
        </circle>
      ))}
    </svg>
  );
}
