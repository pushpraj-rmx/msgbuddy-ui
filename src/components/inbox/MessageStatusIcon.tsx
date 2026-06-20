"use client";

import { AlertCircle, CheckCheck, Clock, Eye, Send } from "lucide-react";
import type { MessageStatusLike } from "@/lib/messaging";
import { isFailedMessage } from "@/lib/messaging";

/**
 * Renders the same visual language the marketing site uses for the message
 * delivery flow (Send → CheckCheck → Eye, color-graduated). Outbound-only —
 * inbound messages don't have a per-recipient delivery status to indicate.
 *
 * Keep this and `MESSAGE_LIFECYCLE` in `src/app/page.tsx` in sync — the
 * marketing copy and the live inbox should always feel like the same product.
 */
export function MessageStatusIcon({
  message,
  className = "h-3 w-3",
}: {
  message: MessageStatusLike;
  className?: string;
}) {
  if (message.direction !== "OUTBOUND") return null;

  if (isFailedMessage(message)) {
    return <AlertCircle className={`${className} text-error`} aria-label="Failed" />;
  }

  const status = (message.status ?? "").toUpperCase();

  switch (status) {
    case "READ":
      return <Eye className={`${className} text-success`} aria-label="Read" />;
    case "DELIVERED":
      return <CheckCheck className={`${className} text-info`} aria-label="Delivered" />;
    case "SENT":
      return <Send className={`${className} text-base-content/60`} aria-label="Sent" />;
    case "SCHEDULED":
      return <Clock className={`${className} text-warning`} aria-label="Scheduled" />;
    case "QUEUED":
    case "PROCESSING":
    case "PENDING":
      return <Send className={`${className} text-base-content/40`} aria-label="Sending" />;
    default:
      return null;
  }
}
