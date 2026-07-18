import { describe, expect, it } from "vitest";
import {
  lastMessagePreview,
  reactionPreview,
  dbOrderBoundaryId,
} from "./inboxPreview";

describe("dbOrderBoundaryId", () => {
  const c = (id: string, lastMessageAt?: string | null) => ({
    id,
    lastMessageAt,
  });

  it("returns the oldest-timestamp row when the page is already in DB order", () => {
    const page = [
      c("a", "2026-03-03T00:00:00Z"),
      c("b", "2026-03-02T00:00:00Z"),
      c("c", "2026-03-01T00:00:00Z"),
    ];
    expect(dbOrderBoundaryId(page)).toBe("c");
  });

  it("ignores display order (oldestUnreadFirst re-sort) and still returns the DB boundary", () => {
    // Server put the oldest-unread row first for display; the true boundary is
    // the smallest timestamp regardless of array position.
    const page = [
      c("oldUnread", "2026-02-01T00:00:00Z"), // shown first, but oldest overall
      c("newRead", "2026-03-05T00:00:00Z"),
      c("midRead", "2026-03-04T00:00:00Z"),
    ];
    expect(dbOrderBoundaryId(page)).toBe("oldUnread");
  });

  it("sorts NULL lastMessageAt last and breaks ties by descending id", () => {
    const page = [
      c("x", "2026-03-01T00:00:00Z"),
      c("nullB", null),
      c("nullA", null), // both null → smaller id ('nullA') sorts last
    ];
    expect(dbOrderBoundaryId(page)).toBe("nullA");
  });

  it("breaks equal timestamps by descending id (smaller id is the boundary)", () => {
    const t = "2026-03-01T00:00:00Z";
    expect(dbOrderBoundaryId([c("m2", t), c("m1", t)])).toBe("m1");
  });

  it("returns null for an empty page", () => {
    expect(dbOrderBoundaryId([])).toBeNull();
  });
});

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
