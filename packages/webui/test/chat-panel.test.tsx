import type { RuntimeChatCycle, RuntimeChatMessage } from "@agenter/client-sdk";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";

import { ChatPanel } from "../src/features/chat/ChatPanel";

vi.mock("../src/features/chat/AIInput", () => ({
  AIInput: ({ onSubmit }: { onSubmit: (payload: { text: string; assets: File[] }) => void }) => (
    <button type="button" onClick={() => onSubmit({ text: "draft", assets: [] })}>
      Mock Send
    </button>
  ),
}));

vi.mock("../src/features/chat/AssistantMarkdown", () => ({
  AssistantMarkdown: ({ content }: { content: string }) => <div data-assistant-markdown="">{content}</div>,
}));

vi.mock("../src/components/markdown/MarkdownDocument", () => ({
  MarkdownDocument: ({ value }: { value: string }) => <div data-markdown-document="">{value}</div>,
}));

afterEach(() => {
  cleanup();
});

const buildMessages = (extra: RuntimeChatMessage[] = []): RuntimeChatMessage[] => [
  {
    id: "101",
    role: "user",
    content: "hello",
    timestamp: 3,
    cycleId: null,
  },
  {
    id: "102",
    role: "assistant",
    content: "visible reply",
    timestamp: 6,
    cycleId: 3,
    channel: "to_user",
  },
  ...extra,
];

const buildLongMessages = (start: number, count: number): RuntimeChatMessage[] =>
  Array.from({ length: count }, (_, index) => {
    const value = start + index;
    return {
      id: `msg-${value}`,
      role: value % 2 === 0 ? ("user" as const) : ("assistant" as const),
      content: `message-${value}`,
      timestamp: value + 1,
      cycleId: Math.floor(value / 2) + 1,
      channel: value % 2 === 0 ? undefined : ("to_user" as const),
    };
  });

const buildCycle = (input?: Partial<RuntimeChatCycle>): RuntimeChatCycle => ({
  ...buildBaseCycle(),
  ...input,
});

const buildBaseCycle = (): RuntimeChatCycle => ({
  id: "cycle:3",
  cycleId: 3,
  seq: 3,
  createdAt: 3,
  wakeSource: "user" as const,
  kind: "model" as const,
  status: "done" as const,
  clientMessageIds: ["client-1"],
  inputs: [
    {
      source: "message" as const,
      role: "user" as const,
      name: "User",
      parts: [{ type: "text" as const, text: "hello" }],
      meta: { clientMessageId: "client-1" },
    },
  ],
  outputs: [
    {
      id: "tool-1",
      role: "assistant" as const,
      content: ["```yaml+tool_call", "tool: terminal_read", "input:", "  terminalId: iflow", "```"].join("\n"),
      timestamp: 4,
      cycleId: 3,
      channel: "tool_call" as const,
      tool: { name: "terminal_read" },
    },
    {
      id: "tool-2",
      role: "assistant" as const,
      content: [
        "```yaml+tool_result",
        "tool: terminal_read",
        "ok: true",
        "output:",
        "  kind: terminal-snapshot",
        "  terminalId: iflow",
        "```",
      ].join("\n"),
      timestamp: 5,
      cycleId: 3,
      channel: "tool_result" as const,
      tool: { name: "terminal_read", ok: true },
    },
    {
      id: "thought-1",
      role: "assistant" as const,
      content: "internal reasoning should stay hidden",
      timestamp: 5,
      cycleId: 3,
      channel: "self_talk" as const,
    },
  ],
  liveMessages: [],
  streaming: null,
  modelCallId: 8,
});

describe("Feature: conversation-first chat panel", () => {
  test("Scenario: Given completed history When rendering Then the chat surface shows only user-facing message rows", () => {
    render(
      <ChatPanel
        workspacePath="/repo/demo"
        messages={buildMessages()}
        cycles={[buildCycle()]}
        aiStatus="idle"
        sessionStateLabel="Session stopped"
        disabled={false}
        sessionActionLabel="Start session"
        onSessionAction={vi.fn()}
        onSubmit={vi.fn(async () => undefined)}
      />,
    );

    expect(screen.getAllByText("hello").length).toBeGreaterThan(0);
    expect(screen.getAllByText("visible reply").length).toBeGreaterThan(0);
    expect(screen.queryByText(/Cycle 3/i)).not.toBeInTheDocument();
    expect(screen.queryByText("terminal_read")).not.toBeInTheDocument();
    expect(screen.queryByText("internal reasoning should stay hidden")).not.toBeInTheDocument();
  });

  test("Scenario: Given the runtime is streaming When rendering Then the live reply stays visible and submission still works", () => {
    const onSubmit = vi.fn(async () => undefined);

    render(
      <ChatPanel
        workspacePath="/repo/demo"
        messages={buildMessages()}
        cycles={[
          buildCycle({
            id: "cycle:4",
            cycleId: 4,
            seq: 4,
            status: "streaming",
            outputs: [],
            liveMessages: [
              {
                id: "live-thought-1",
                role: "assistant" as const,
                content: "hidden trace",
                timestamp: 4,
                cycleId: 4,
                channel: "self_talk" as const,
              },
            ],
            streaming: {
              content: "I am still checking the terminal output.",
            },
          }),
        ]}
        aiStatus="waiting model"
        sessionStateLabel="Session running"
        sessionStateTone="active"
        disabled={false}
        sessionActionLabel="Stop session"
        onSessionAction={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    expect(screen.getAllByText("I am still checking the terminal output.").length).toBeGreaterThan(0);
    expect(screen.queryByText(/Cycle 4/i)).not.toBeInTheDocument();
    expect(screen.queryByText("hidden trace")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Stop session" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Mock Send" }));

    expect(onSubmit).toHaveBeenCalledWith({ text: "draft", assets: [] });
  });

  test("Scenario: Given a stopped session notice When the conversation is empty Then the route summary stays actionable", () => {
    render(
      <ChatPanel
        workspacePath="/repo/demo"
        messages={[]}
        cycles={[]}
        aiStatus="stopped"
        sessionStateLabel="Session stopped"
        routeNotice={{
          tone: "warning",
          message: "Session is stopped. Start it to continue.",
        }}
        disabled={false}
        sessionActionLabel="Start session"
        onSessionAction={vi.fn()}
        onSubmit={vi.fn(async () => undefined)}
      />,
    );

    expect(screen.getAllByText("Session is stopped. Start it to continue.")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Start session" })).toBeInTheDocument();
    expect(screen.queryByText("Use the primary session action to begin or continue working.")).not.toBeInTheDocument();
  });

  test("Scenario: Given a long conversation When the viewport virtualizes Then the scroll viewport still owns the available width", () => {
    render(
      <ChatPanel
        workspacePath="/repo/demo"
        messages={buildLongMessages(0, 24)}
        cycles={[]}
        aiStatus="idle"
        sessionStateLabel="Session running"
        disabled={false}
        sessionActionLabel="Stop session"
        onSessionAction={vi.fn()}
        onSubmit={vi.fn(async () => undefined)}
      />,
    );

    expect(screen.getByTestId("chat-scroll-viewport")).toHaveClass("flex-1");
    expect(screen.getByText("message-23")).toBeInTheDocument();
  });

  test("Scenario: Given older pages are prepended When load more runs Then the viewport keeps the current reading position", async () => {
    let scrollHeight = 1200;

    const Harness = () => {
      const [messages, setMessages] = useState(() => buildLongMessages(10, 24));
      return (
        <ChatPanel
          workspacePath="/repo/demo"
          messages={messages}
          cycles={[]}
          aiStatus="idle"
          sessionStateLabel="Session running"
          disabled={false}
          sessionActionLabel="Stop session"
          onSessionAction={vi.fn()}
          hasMore
          onLoadMore={() => {
            scrollHeight = 1800;
            setMessages((current) => [...buildLongMessages(0, 10), ...current]);
          }}
          onSubmit={vi.fn(async () => undefined)}
        />
      );
    };

    render(<Harness />);

    const viewport = screen.getByTestId("chat-scroll-viewport");
    Object.defineProperty(viewport, "clientHeight", { configurable: true, value: 480 });
    Object.defineProperty(viewport, "scrollHeight", {
      configurable: true,
      get: () => scrollHeight,
    });
    Object.defineProperty(viewport, "scrollTop", {
      configurable: true,
      writable: true,
      value: 120,
    });

    fireEvent.scroll(viewport);

    expect(await screen.findByText("message-0")).toBeInTheDocument();
    expect(viewport.scrollTop).toBe(720);
  });
});
