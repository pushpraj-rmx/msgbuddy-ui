import { ImageResponse } from "next/og";

// Root social share image (og:image / twitter:image). Applies to any route that
// doesn't define its own opengraph-image. Fixed brand indigo + the visor mark.
import { BRAND_NAME, IS_WHITELABEL } from "@/lib/brand";

export const alt = IS_WHITELABEL ? BRAND_NAME : "MsgBuddy — WhatsApp SaaS";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const MARK =
  '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">' +
  '<defs><mask id="v"><rect width="64" height="64" fill="#fff"/><rect x="16" y="22.5" width="32" height="20" rx="10" fill="#000"/></mask></defs>' +
  '<g fill="#ffffff">' +
  '<rect x="10" y="15" width="44" height="36" rx="15" mask="url(#v)"/>' +
  '<rect x="5" y="26" width="7" height="14" rx="3.5"/><rect x="52" y="26" width="7" height="14" rx="3.5"/>' +
  '<rect x="24" y="27.8" width="4.5" height="9.5" rx="2.25"/><rect x="35.5" y="27.8" width="4.5" height="9.5" rx="2.25"/>' +
  "</g></svg>";

export default function Image() {
  const src = `data:image/svg+xml;utf8,${encodeURIComponent(MARK)}`;
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#6440F5",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} width={216} height={216} alt="" />
        <div style={{ marginTop: 20, fontSize: 88, fontWeight: 700, letterSpacing: "-0.03em" }}>{BRAND_NAME}</div>
        <div style={{ marginTop: 6, fontSize: 34, opacity: 0.85 }}>Run your business from WhatsApp</div>
      </div>
    ),
    { ...size },
  );
}
