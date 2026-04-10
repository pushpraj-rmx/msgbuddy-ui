"use client";

import { Box, Typography } from "@mui/material";

interface DateSeparatorProps {
  label: string;
}

export function DateSeparator({ label }: DateSeparatorProps) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        my: 1.5,
        px: 2,
      }}
    >
      <Box sx={{ flex: 1, height: "1px", bgcolor: "divider" }} />
      <Typography
        variant="caption"
        sx={{
          color: "text.secondary",
          fontWeight: 500,
          whiteSpace: "nowrap",
          userSelect: "none",
        }}
      >
        {label}
      </Typography>
      <Box sx={{ flex: 1, height: "1px", bgcolor: "divider" }} />
    </Box>
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
