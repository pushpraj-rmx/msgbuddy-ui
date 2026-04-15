"use client";

import { useEffect, useState } from "react";
import { getContactInitials } from "@/lib/contactInitials";
import { resolveMediaUrlForUi } from "@/lib/mediaUrls";

const SIZE_CLASS: Record<
  "sm" | "md" | "lg",
  { box: string; text: string }
> = {
  sm: { box: "h-9 w-9 min-h-9 min-w-9", text: "text-xs font-medium" },
  md: { box: "h-11 w-11 min-h-11 min-w-11", text: "text-sm font-medium" },
  lg: { box: "h-14 w-14 min-h-14 min-w-14", text: "text-xl font-semibold" },
};

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
  const [imgFailed, setImgFailed] = useState(false);
  const initials = getContactInitials(name, phone);
  const { box, text } = SIZE_CLASS[size];

  useEffect(() => {
    setImgFailed(false);
  }, [resolved]);

  const showPhoto = Boolean(resolved) && !imgFailed;

  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-box bg-primary text-primary-content ${box} ${className}`.trim()}
      aria-hidden
    >
      {showPhoto ? (
        <img
          src={resolved}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setImgFailed(true)}
        />
      ) : (
        <div
          className={`flex h-full w-full items-center justify-center ${text}`}
        >
          {initials}
        </div>
      )}
    </div>
  );
}
