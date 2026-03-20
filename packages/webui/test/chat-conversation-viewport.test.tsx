import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";

import { ChatConversationViewport } from "../src/features/chat/ChatConversationViewport";
import type { ConversationRow } from "../src/features/chat/chat-projection";

afterEach(() => {
  cleanup();
});

describe("Feature: chat transcript scroll ownership", () => {
  test("Scenario: Given conversation rows When the viewport renders Then one primary scroll viewport owns transcript overflow", () => {
    const rows: ConversationRow[] = [
      {
        key: "message:1",
        type: "message",
        message: {
          id: "1",
          role: "assistant",
          cycleId: 1,
          channel: "to_user",
          content: "Ready when you are.",
          timestamp: Date.now(),
        },
      },
    ];

    const { container } = render(
      <div className="h-[420px]">
        <ChatConversationViewport
          rows={rows}
          sessionStateLabel="Session running"
          hasMore={false}
          loadingMore={false}
          onPreviewAttachment={() => undefined}
        />
      </div>,
    );

    expect(screen.getByRole("log", { name: "Conversation" })).toBeInTheDocument();
    expect(container.querySelectorAll("[data-overflow-role='scroll-viewport']")).toHaveLength(1);
    expect(container.firstElementChild?.firstElementChild).toHaveClass("grid-rows-[minmax(0,1fr)]");
  });

  test("Scenario: Given a route notice When the viewport renders Then the notice and transcript occupy separate grid rows", () => {
    const rows: ConversationRow[] = [];

    const { container } = render(
      <div className="h-[420px]">
        <ChatConversationViewport
          rows={rows}
          sessionStateLabel="Session stopped"
          routeNotice={{ tone: "warning", message: "Start the session to continue." }}
          hasMore={false}
          loadingMore={false}
          onPreviewAttachment={() => undefined}
        />
      </div>,
    );

    expect(screen.getAllByText("Start the session to continue.").length).toBeGreaterThan(0);
    expect(container.firstElementChild?.firstElementChild).toHaveClass("grid-rows-[auto_minmax(0,1fr)]");
  });
});
