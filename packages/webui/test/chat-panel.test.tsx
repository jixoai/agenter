import { describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { ChatPanel } from "../src/features/chat/ChatPanel";

describe("Feature: chat panel message filtering", () => {
  test("Scenario: Given mixed assistant channels When rendering Then only user-facing messages are shown in main chat", () => {
    const onInputChange = vi.fn();
    const onSend = vi.fn();

    render(
      <ChatPanel
        activeSessionName="demo"
        messages={[
          {
            id: "u-1",
            role: "user",
            content: "hello",
            timestamp: 1,
          },
          {
            id: "a-1",
            role: "assistant",
            content: "thinking hidden",
            timestamp: 2,
            channel: "self_talk",
          },
          {
            id: "a-2",
            role: "assistant",
            content: "visible reply",
            timestamp: 3,
            channel: "to_user",
          },
        ]}
        input=""
        aiStatus="idle"
        disabled={false}
        onInputChange={onInputChange}
        onSend={onSend}
      />,
    );

    expect(screen.getByText("hello")).toBeInTheDocument();
    expect(screen.getByText("visible reply")).toBeInTheDocument();
    expect(screen.queryByText("thinking hidden")).not.toBeInTheDocument();
  });
});
