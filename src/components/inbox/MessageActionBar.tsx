"use client";

import { Star, Pin, Copy } from "lucide-react";

interface MessageActionBarProps {
  isPinned?: boolean;
  isStarred?: boolean;
  text?: string;
  onPin: () => void;
  onStar: () => void;
  /** "outbound" messages appear on the right, bar floats left; inbound floats right */
  direction?: "INBOUND" | "OUTBOUND";
  disabled?: boolean;
}

export function MessageActionBar({
  isPinned,
  isStarred,
  text,
  onPin,
  onStar,
  direction = "INBOUND",
  disabled = false,
}: MessageActionBarProps) {
  const handleCopy = () => {
    if (text) {
      void navigator.clipboard.writeText(text);
    }
  };

  return (
    <div className="msg-action-bar flex items-center gap-0.5 rounded-lg border border-base-300 bg-base-100 px-1 py-0.5 shadow-sm">
      <div className="tooltip tooltip-top" data-tip={isStarred ? "Unstar" : "Star"}>
        <button
          type="button"
          className={`btn btn-ghost btn-xs btn-square ${isStarred ? "text-warning" : "text-base-content/50"}`}
          onClick={onStar}
          disabled={disabled}
        >
          <Star className="h-4 w-4" fill={isStarred ? "currentColor" : "none"} />
        </button>
      </div>

      <div className="tooltip tooltip-top" data-tip={isPinned ? "Unpin" : "Pin"}>
        <button
          type="button"
          className={`btn btn-ghost btn-xs btn-square ${isPinned ? "text-primary" : "text-base-content/50"}`}
          onClick={onPin}
          disabled={disabled}
        >
          <Pin className="h-4 w-4" fill={isPinned ? "currentColor" : "none"} />
        </button>
      </div>

      {text && (
        <div className="tooltip tooltip-top" data-tip="Copy text">
          <button
            type="button"
            className="btn btn-ghost btn-xs btn-square text-base-content/50"
            onClick={handleCopy}
            disabled={disabled}
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
