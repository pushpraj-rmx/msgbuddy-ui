import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MessageStatusIcon } from "./MessageStatusIcon";

describe("MessageStatusIcon", () => {
  it("renders nothing for inbound messages (no per-recipient status)", () => {
    const { container } = render(
      <MessageStatusIcon message={{ direction: "INBOUND", status: "DELIVERED" }} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the Failed icon for a failed outbound message (status)", () => {
    const { getByLabelText } = render(
      <MessageStatusIcon message={{ direction: "OUTBOUND", status: "FAILED" }} />,
    );
    expect(getByLabelText("Failed")).toBeInTheDocument();
  });

  it("treats failedAt as failed even when status isn't FAILED", () => {
    const { getByLabelText } = render(
      <MessageStatusIcon
        message={{ direction: "OUTBOUND", status: "SENT", failedAt: "2026-06-20T00:00:00Z" }}
      />,
    );
    expect(getByLabelText("Failed")).toBeInTheDocument();
  });

  it("maps outbound delivery statuses to their icons", () => {
    const cases: Array<[string, string]> = [
      ["READ", "Read"],
      ["DELIVERED", "Delivered"],
      ["SENT", "Sent"],
      ["SCHEDULED", "Scheduled"],
      ["QUEUED", "Sending"],
    ];
    for (const [status, label] of cases) {
      const { getByLabelText, unmount } = render(
        <MessageStatusIcon message={{ direction: "OUTBOUND", status }} />,
      );
      expect(getByLabelText(label)).toBeInTheDocument();
      unmount();
    }
  });

  it("renders nothing for an unknown/empty outbound status", () => {
    const { container } = render(
      <MessageStatusIcon message={{ direction: "OUTBOUND", status: "" }} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
