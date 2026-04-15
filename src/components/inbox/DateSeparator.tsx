"use client";

interface DateSeparatorProps {
  label: string;
}

export function DateSeparator({ label }: DateSeparatorProps) {
  return (
    <div className="flex items-center gap-3 my-3 px-2">
      <div className="flex-1 h-px bg-base-300" />
      <span className="text-xs font-medium text-base-content/50 whitespace-nowrap select-none">
        {label}
      </span>
      <div className="flex-1 h-px bg-base-300" />
    </div>
  );
}

/**
 * Returns a human-readable label for a date:
 * - "Today", "Yesterday", or "Apr 8" / "Apr 8, 2025"
 */
export function formatDateLabel(dateStr: string | undefined): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday.getTime() - 86_400_000);
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (startOfDate.getTime() === startOfToday.getTime()) return "Today";
  if (startOfDate.getTime() === startOfYesterday.getTime()) return "Yesterday";

  const sameYear = date.getFullYear() === now.getFullYear();
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(!sameYear && { year: "numeric" }),
  });
}

/** Returns a date-only key like "2026-04-10" for grouping messages. */
export function getDateKey(dateStr: string | undefined): string {
  if (!dateStr) return "";
  return new Date(dateStr).toISOString().slice(0, 10);
}
