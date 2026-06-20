"use client";

import { useState } from "react";
import { getContactInitials } from "@/lib/contactInitials";
import { resolveMediaUrlForUi } from "@/lib/mediaUrls";

const SIZE_CLASS: Record<
  "sm" | "md" | "lg",
  { box: string; text: string }
> = {
  sm: { box: "h-9 w-9 min-h-9 min-w-9",    text: "text-[0.6875rem] font-semibold" },
  md: { box: "h-11 w-11 min-h-11 min-w-11", text: "text-[0.8125rem] font-semibold" },
  lg: { box: "h-14 w-14 min-h-14 min-w-14", text: "text-[1.0625rem] font-semibold" },
};

/**
 * 8 muted Operator-compatible avatar colors.
 * Each pair: [background, text] — designed for dark and light themes.
 */
const AVATAR_COLORS = [
  { bg: "bg-emerald-500/15", fg: "text-emerald-400" },
  { bg: "bg-sky-500/15",     fg: "text-sky-400" },
  { bg: "bg-violet-500/15",  fg: "text-violet-400" },
  { bg: "bg-amber-500/15",   fg: "text-amber-400" },
  { bg: "bg-rose-500/15",    fg: "text-rose-400" },
  { bg: "bg-cyan-500/15",    fg: "text-cyan-400" },
  { bg: "bg-orange-500/15",  fg: "text-orange-400" },
  { bg: "bg-indigo-500/15",  fg: "text-indigo-400" },
] as const;

/** Simple deterministic hash → color index from a string. */
function hashToColorIndex(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % AVATAR_COLORS.length;
}

function AvatarInner({
  resolved,
  initials,
  box,
  text,
  colorIdx,
  className,
}: {
  resolved: string | undefined;
  initials: string;
  box: string;
  text: string;
  colorIdx: number;
  className: string;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const showPhoto = Boolean(resolved) && !imgFailed;
  const color = AVATAR_COLORS[colorIdx];

  return (
    <div
      className={`font-mono-op relative shrink-0 overflow-hidden rounded-md border border-base-300 ${showPhoto ? "bg-base-200" : color.bg} ${box} ${className}`.trim()}
      aria-hidden
    >
      {showPhoto ? (
        // eslint-disable-next-line @next/next/no-img-element -- dynamic user content, dimensions unknown
        <img
          src={resolved}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setImgFailed(true)}
        />
      ) : (
        <div
          className={`flex h-full w-full items-center justify-center ${color.fg} ${text}`}
        >
          {initials}
        </div>
      )}
    </div>
  );
}

export function ContactAvatar({
  name,
  phone,
  avatarUrl,
  size = "sm",
  className = "",
}: {
  name?: string;
  phone?: string;
  avatarUrl?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const resolved = resolveMediaUrlForUi(avatarUrl ?? undefined);
  const initials = getContactInitials(name, phone);
  const { box, text } = SIZE_CLASS[size];
  const colorIdx = hashToColorIndex(name || phone || "");

  return (
    <AvatarInner
      key={resolved ?? "none"}
      resolved={resolved}
      initials={initials}
      box={box}
      text={text}
      colorIdx={colorIdx}
      className={className}
    />
  );
}
