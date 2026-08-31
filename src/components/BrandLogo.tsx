import type { SVGProps } from "react";
import { BRAND_NAME, IS_WHITELABEL } from "@/lib/brand";

type BrandLogoProps = Omit<SVGProps<SVGSVGElement>, "children"> & {
  alt?: string;
  /** Accepted for call-site compatibility; inline SVG needs no preloading. */
  priority?: boolean;
};

/**
 * MsgBuddy lockup — the "visor buddy" mark + wordmark, drawn entirely in
 * `currentColor` so it inherits the active UI theme's text color (the app ships
 * ~35 themes). The fixed brand indigo is reserved for the standalone app icon /
 * favicon per `branding/kit` rules; in-product the mark is monochrome. Size it
 * via `className` (e.g. `h-7 w-auto`) — the viewBox drives the aspect ratio.
 */
export function BrandLogo({ alt = BRAND_NAME, priority: _priority, ...props }: BrandLogoProps) {
  // White-label builds get a typographic wordmark; the visor mark stays
  // exclusive to MsgBuddy-branded deployments.
  if (IS_WHITELABEL) {
    return (
      <span
        aria-label={alt}
        className={`inline-flex items-center whitespace-nowrap font-serif text-xl leading-none tracking-tight ${props.className ?? ""}`}
      >
        {BRAND_NAME}
      </span>
    );
  }
  return (
    <svg
      role="img"
      aria-label={alt}
      viewBox="0 0 272 64"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <defs>
        <mask id="brandlogo-visor">
          <rect width="64" height="64" fill="#fff" />
          <rect x="16" y="22.5" width="32" height="20" rx="10" fill="#000" />
        </mask>
      </defs>
      <rect x="10" y="15" width="44" height="36" rx="15" mask="url(#brandlogo-visor)" />
      <rect x="5" y="26" width="7" height="14" rx="3.5" />
      <rect x="52" y="26" width="7" height="14" rx="3.5" />
      <rect x="24" y="27.8" width="4.5" height="9.5" rx="2.25" />
      <rect x="35.5" y="27.8" width="4.5" height="9.5" rx="2.25" />
      <text
        x="74"
        y="44"
        fontFamily="Geist, Inter, system-ui, sans-serif"
        fontSize="34"
        letterSpacing="-0.7"
      >
        <tspan fontWeight="700">Msg</tspan>
        <tspan fontWeight="500">Buddy</tspan>
      </text>
    </svg>
  );
}
