import { describe, expect, it } from "vitest";
import { lastMessagePreview, reactionPreview } from "./inboxPreview";

describe("lastMessagePreview", () => {
  it("returns trimmed text when present", () => {
    expect(lastMessagePreview({ text: "  hi there " })).toBe("hi there");
  });

  it("labels non-text media/sticker/template/interactive (no more 'No messages')", () => {
    expect(lastMessagePreview({ type: "IMAGE" })).toBe("Image");
    expect(lastMessagePreview({ type: "sticker" })).toBe("Sticker");
    expect(lastMessagePreview({ type: "TEMPLATE" })).toBe("Template message");
    expect(lastMessagePreview({ type: "INTERACTIVE" })).toBe("Interactive message");
  });

  it("falls back to 'No messages' for empty / unknown", () => {
    expect(lastMessagePreview(undefined)).toBe("No messages");
    expect(lastMessagePreview({ type: "WHO_KNOWS" })).toBe("No messages");
  });
});

describe("reactionPreview", () => {
  it("returns null when there is no reaction", () => {
    expect(reactionPreview({ lastMessage: { text: "hi" } })).toBeNull();
  });

  it("shows the customer reaction when it is the latest activity", () => {
    expect(
      reactionPreview({
        lastReactionEmoji: "👍",
        lastReactionAt: "2026-06-20T10:00:00Z",
        lastReactionByContact: true,
        lastMessage: { text: "hi", createdAt: "2026-06-20T09:00:00Z" },
      }),
    ).toBe("Reacted 👍");
  });

  it("distinguishes an agent's own reaction", () => {
    expect(
      reactionPreview({
        lastReactionEmoji: "🎉",
        lastReactionAt: "2026-06-20T10:00:00Z",
        lastReactionByContact: false,
      }),
    ).toBe("You reacted 🎉");
  });

  it("defers to the message when a newer message arrived after the reaction", () => {
    expect(
      reactionPreview({
        lastReactionEmoji: "👍",
        lastReactionAt: "2026-06-20T09:00:00Z",
        lastReactionByContact: true,
        lastMessage: { text: "newer", createdAt: "2026-06-20T10:00:00Z" },
      }),
    ).toBeNull();
  });
});
