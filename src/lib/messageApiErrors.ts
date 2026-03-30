/** Map axios/API errors from POST /messages and uploads to user-visible copy. */
export function extractApiErrorMessage(err: unknown): string {
  const r = err as {
    response?: {
      data?: { message?: unknown; error?: string; reason?: string; policy?: unknown };
    };
  };
  const data = r.response?.data;
  if (
    data &&
    typeof data === "object" &&
    typeof (data as { reason?: unknown }).reason === "string"
  ) {
    const reason = (data as { reason: string }).reason.trim().toUpperCase();
    if (reason === "TEMPLATE_REQUIRED") {
      return "Template is required for this WhatsApp conversation right now. Select a template and fill variables.";
    }
  }
  if (data && typeof data === "object" && "message" in data) {
    const m = (data as { message?: unknown }).message;
    if (typeof m === "string" && m.trim()) return mapMessageSendHint(m.trim());
    if (Array.isArray(m)) {
      const joined = m.map(String).filter(Boolean).join(", ");
      if (joined) return mapMessageSendHint(joined);
    }
  }
  if (
    data &&
    typeof data === "object" &&
    typeof (data as { error?: string }).error === "string"
  ) {
    const e = (data as { error: string }).error.trim();
    if (e) return mapMessageSendHint(e);
  }
  return "Something went wrong.";
}

function mapMessageSendHint(raw: string): string {
  const lower = raw.toLowerCase();
  if (
    lower.includes("whatsapp") &&
    (lower.includes("image") ||
      lower.includes("video") ||
      lower.includes("audio") ||
      lower.includes("document") ||
      lower.includes("channel") ||
      lower.includes("only"))
  ) {
    return "Media attachments are only available on WhatsApp for now.";
  }
  if (
    lower.includes("media id") ||
    lower.includes("choose an image") ||
    lower.includes("choose a file") ||
    lower.includes("attach")
  ) {
    return "Choose a file to attach first.";
  }
  if (
    lower.includes("processing") ||
    lower.includes("not ready") ||
    lower.includes("whatsappmediaid")
  ) {
    return "File is still processing; try again in a moment.";
  }
  if (lower.includes("unsupported") && lower.includes("type")) {
    return "This message type is not supported yet.";
  }
  return raw;
}
