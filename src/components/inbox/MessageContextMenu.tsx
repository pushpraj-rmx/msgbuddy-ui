"use client";

import { useEffect, useRef } from "react";
import { Star, Pin, Copy, CheckSquare } from "lucide-react";

interface MessageContextMenuProps {
  point: { x: number; y: number };
  isPinned?: boolean;
  isStarred?: boolean;
  text?: string;
  onPin?: () => void;
  onStar?: () => void;
  /** Opens the "Create task" modal pre-linked to this message's conversation. */
  onCreateTask?: () => void;
  onClose: () => void;
}

const MENU_WIDTH = 180;
const ITEM_HEIGHT = 36;

export function MessageContextMenu({
  point,
  isPinned,
  isStarred,
  text,
  onPin,
  onStar,
  onCreateTask,
  onClose,
}: MessageContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onPointerDown = (e: MouseEvent) => {
      if (menuRef.current?.contains(e.target as Node)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("mousedown", onPointerDown, true);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onPointerDown, true);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [onClose]);

  const vw = typeof window !== "undefined" ? window.innerWidth : 1024;
  const vh = typeof window !== "undefined" ? window.innerHeight : 768;
  const itemCount =
    (onStar ? 1 : 0) +
    (onPin ? 1 : 0) +
    (onCreateTask ? 1 : 0) +
    (text ? 1 : 0);
  const menuH = itemCount * ITEM_HEIGHT + 8;
  const left = Math.min(point.x, vw - MENU_WIDTH - 8);
  const top = Math.min(point.y, vh - menuH - 8);

  const handleCopy = () => {
    if (text) void navigator.clipboard.writeText(text);
    onClose();
  };

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label="Message actions"
      className="fixed z-[60] min-w-[11rem] rounded-box border border-base-300 bg-base-200 p-1 shadow-lg"
      style={{ left, top, width: MENU_WIDTH }}
    >
      {onStar && (
        <button
          type="button"
          role="menuitem"
          className="flex w-full items-center gap-2.5 rounded-none px-3 py-2 text-left text-sm hover:bg-base-300/60"
          onClick={() => { onStar(); onClose(); }}
        >
          <Star className={`h-4 w-4 ${isStarred ? "text-warning" : "text-base-content/55"}`} fill={isStarred ? "currentColor" : "none"} />
          <span>{isStarred ? "Unstar" : "Star"}</span>
        </button>
      )}
      {onPin && (
        <button
          type="button"
          role="menuitem"
          className="flex w-full items-center gap-2.5 rounded-none px-3 py-2 text-left text-sm hover:bg-base-300/60"
          onClick={() => { onPin(); onClose(); }}
        >
          <Pin className={`h-4 w-4 ${isPinned ? "text-primary" : "text-base-content/55"}`} fill={isPinned ? "currentColor" : "none"} />
          <span>{isPinned ? "Unpin" : "Pin"}</span>
        </button>
      )}
      {onCreateTask && (
        <button
          type="button"
          role="menuitem"
          className="flex w-full items-center gap-2.5 rounded-none px-3 py-2 text-left text-sm hover:bg-base-300/60"
          onClick={() => { onCreateTask(); onClose(); }}
        >
          <CheckSquare className="h-4 w-4 text-base-content/55" />
          <span>Create task…</span>
        </button>
      )}
      {text && (
        <button
          type="button"
          role="menuitem"
          className="flex w-full items-center gap-2.5 rounded-none px-3 py-2 text-left text-sm hover:bg-base-300/60"
          onClick={handleCopy}
        >
          <Copy className="h-4 w-4 text-base-content/55" />
          <span>Copy text</span>
        </button>
      )}
    </div>
  );
}
