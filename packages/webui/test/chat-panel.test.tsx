import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

import { ChatPanel } from "../src/features/chat/ChatPanel";
import { resolveVisibleCycleState } from "../src/features/chat/cycle-visibility";

vi.mock("../src/features/chat/AIInput", () => ({
  AIInput: ({ onSubmit }: { onSubmit: (payload: { text: string; images: File[] }) => void }) => (
    <button type="button" onClick={() => onSubmit({ text: "draft", images: [] })}>
      Mock Send
    </button>
  ),
}));

vi.mock("../src/features/chat/AssistantMarkdown", () => ({
  AssistantMarkdown: ({
    content,
    toolTrace,
  }: {
    content?: string;
    toolTrace?: { toolName: string; status: string; callContent?: string; resultContent?: string };
  }) => (
    <div data-assistant-markdown="">
      {toolTrace ? (
        <>
          <span>{toolTrace.toolName}</span>
          <span>{toolTrace.status}</span>
          <span>{toolTrace.callContent}</span>
          <span>{toolTrace.resultContent}</span>
        </>
      ) : (
        <span>{content}</span>
      )}
    </div>
  ),
}));

vi.mock("../src/components/markdown/MarkdownDocument", () => ({
  MarkdownDocument: ({ value }: { value: string }) => <div data-markdown-document="">{value}</div>,
}));

afterEach(() => {
  cleanup();
  IntersectionObserverMock.instances = [];
});

class IntersectionObserverMock {
  static instances: IntersectionObserverMock[] = [];

  readonly observe = vi.fn((element: Element) => {
    this.elements.add(element);
  });
  readonly unobserve = vi.fn((element: Element) => {
    this.elements.delete(element);
  });
  readonly disconnect = vi.fn(() => {
    this.elements.clear();
  });

  private readonly elements = new Set<Element>();

  constructor(private readonly callback: IntersectionObserverCallback) {
    IntersectionObserverMock.instances.push(this);
  }

  trigger(entries: Array<Partial<IntersectionObserverEntry> & { target: Element }>): void {
    this.callback(
      entries.map((entry) => ({
        time: 0,
        isIntersecting: true,
        intersectionRatio: 1,
        boundingClientRect: new DOMRect(0, 0, 0, 0),
        intersectionRect: new DOMRect(0, 0, 0, 0),
        rootBounds: new DOMRect(0, 0, 320, 640),
        ...entry,
      })) as IntersectionObserverEntry[],
      this as unknown as IntersectionObserver,
    );
  }
}

vi.stubGlobal("IntersectionObserver", IntersectionObserverMock);

const buildCycle = () => ({
  id: "cycle:3",
  cycleId: 3,
  seq: 3,
  createdAt: 3,
  wakeSource: "user",
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
    {
      source: "terminal" as const,
      role: "tool" as const,
      name: "Terminal-iflow",
      parts: [
        {
          type: "text" as const,
          text: JSON.stringify({
            kind: "terminal-diff",
            terminalId: "iflow",
            status: "IDLE",
            bytes: 332,
            diff: "diff --git a/output/latest.log.html",
          }),
        },
      ],
    },
  ],
  outputs: [
    {
      id: "tool-1",
      role: "assistant" as const,
      content: ["```yaml+tool_call", "tool: terminal_read", "input:", "  terminalId: iflow", "```"].join("\n"),
      timestamp: 4,
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
        "  seq: 30",
        "  cols: 80",
        "  rows: 24",
        "```",
      ].join("\n"),
      timestamp: 5,
      channel: "tool_result" as const,
      tool: { name: "terminal_read", ok: true },
    },
    {
      id: "thought-1",
      role: "assistant" as const,
      content: "internal reasoning should stay hidden",
      timestamp: 5,
      channel: "self_talk" as const,
    },
    {
      id: "reply-1",
      role: "assistant" as const,
      content: "visible reply",
      timestamp: 6,
      channel: "to_user" as const,
    },
  ],
  liveMessages: [],
  streaming: null,
  modelCallId: 8,
});

describe("Feature: chat panel cycle contract", () => {
  test("Scenario: Given a completed cycle When rendering Then collect inputs and merged tool outputs are shown together", () => {
    render(
      <ChatPanel
        activeSessionName="demo"
        workspacePath="/repo/demo"
        cycles={[buildCycle()]}
        aiStatus="idle"
        disabled={false}
        onSubmit={vi.fn(async () => undefined)}
      />,
    );

    expect(screen.getByLabelText("Jump to cycle #3")).toBeInTheDocument();
    expect(screen.getByText("hello")).toBeInTheDocument();
    expect(screen.getByText("Collected facts")).toBeInTheDocument();
    expect(screen.getAllByText("terminal_read")).toHaveLength(1);
    expect(screen.getByText("visible reply")).toBeInTheDocument();
    expect(screen.queryByText("internal reasoning should stay hidden")).not.toBeInTheDocument();
  });

  test("Scenario: Given the runtime is streaming When rendering Then the live AI status stays visible and the submit hook remains callable", () => {
    const onSubmit = vi.fn(async () => undefined);

    const { container } = render(
      <ChatPanel
        activeSessionName="demo"
        workspacePath="/repo/demo"
        cycles={[
          {
            ...buildCycle(),
            id: "cycle:4",
            cycleId: 4,
            seq: 4,
            status: "streaming",
            outputs: [],
            liveMessages: [
              {
                id: "live-tool-call",
                role: "assistant" as const,
                content: ["```yaml+tool_call", "tool: terminal_read", "input:", "  terminalId: iflow", "```"].join(
                  "\n",
                ),
                timestamp: 4,
                channel: "tool_call" as const,
                tool: { name: "terminal_read" },
              },
            ],
            streaming: {
              content: "I am still checking the terminal output.",
            },
          },
        ]}
        aiStatus="thinking"
        loopPhase="calling_model"
        disabled={false}
        onSubmit={onSubmit}
      />,
    );

    expect(container.querySelector("[data-chat-status='live']")).toHaveTextContent("AI thinking");
    expect(container).toHaveTextContent("I am still checking the terminal output.");
    expect(container).toHaveTextContent("terminal_read");

    fireEvent.click(screen.getByRole("button", { name: "Mock Send" }));

    expect(onSubmit).toHaveBeenCalledWith({ text: "draft", images: [] });
  });

  test("Scenario: Given queued and collected cycles When rendering Then pending user input and waiting-model states are visually distinguished", () => {
    const queuedCycle = {
      ...buildCycle(),
      id: "pending:client-queued",
      cycleId: null,
      seq: null,
      status: "pending" as const,
      outputs: [],
      liveMessages: [],
      streaming: null,
      inputs: [
        {
          source: "message" as const,
          role: "user" as const,
          name: "User",
          parts: [{ type: "text" as const, text: "queued question" }],
          meta: { clientMessageId: "client-queued" },
        },
      ],
    };

    const collectedCycle = {
      ...buildCycle(),
      id: "cycle:9",
      cycleId: 9,
      seq: 9,
      status: "collecting" as const,
      outputs: [],
      liveMessages: [],
      streaming: null,
      inputs: [
        {
          source: "message" as const,
          role: "user" as const,
          name: "User",
          parts: [{ type: "text" as const, text: "collected question" }],
          meta: { clientMessageId: "client-collected" },
        },
      ],
    };

    render(
      <ChatPanel
        activeSessionName="demo"
        workspacePath="/repo/demo"
        cycles={[queuedCycle, collectedCycle]}
        aiStatus="waiting model"
        loopPhase="calling_model"
        disabled={false}
        onSubmit={vi.fn(async () => undefined)}
      />,
    );

    expect(screen.getByText("queued")).toBeInTheDocument();
    expect(screen.getByText("Waiting to collect this cycle.")).toBeInTheDocument();
    expect(screen.getByText("wait model")).toBeInTheDocument();
    expect(screen.getByText("Collected facts. Waiting for model output.")).toBeInTheDocument();
  });

  test("Scenario: Given many cycles When rendering Then the cycle rail exposes direct navigation markers and stays scroll-snap capable", () => {
    const { container } = render(
      <ChatPanel
        activeSessionName="demo"
        workspacePath="/repo/demo"
        cycles={Array.from({ length: 60 }, (_, index) => ({
          ...buildCycle(),
          id: `cycle:${index + 1}`,
          cycleId: index + 1,
          seq: index + 1,
          createdAt: index + 1,
        }))}
        aiStatus="idle"
        disabled={false}
        onSubmit={vi.fn(async () => undefined)}
      />,
    );

    expect(screen.getByLabelText("Jump to cycle #1")).toBeInTheDocument();
    expect(screen.getByLabelText("Jump to cycle #60")).toBeInTheDocument();
    expect(container.querySelector("[data-cycle-rail]")).toHaveClass("snap-mandatory");
  });

  test("Scenario: Given visible cycle metrics When resolving rail state Then every visible cycle stays highlighted and the anchor uses the median visible cycle", () => {
    expect(
      resolveVisibleCycleState(
        [
          { id: "cycle:1", ratio: 0.8, distance: 220 },
          { id: "cycle:2", ratio: 0.2, distance: 40 },
          { id: "cycle:3", ratio: 0.6, distance: 60 },
        ],
        ["cycle:1", "cycle:2", "cycle:3"],
      ),
    ).toEqual({
      visibleIds: ["cycle:1", "cycle:2", "cycle:3"],
      anchorId: "cycle:2",
    });
  });

  test("Scenario: Given multiple visible cycles When the viewport observer reports them Then the cycle rail highlights all visible cycle points instead of only one", async () => {
    const cycles = Array.from({ length: 5 }, (_, index) => ({
      ...buildCycle(),
      id: `cycle:${index + 1}`,
      cycleId: index + 1,
      seq: index + 1,
      createdAt: index + 1,
    }));

    const { container } = render(
      <ChatPanel
        activeSessionName="demo"
        workspacePath="/repo/demo"
        cycles={cycles}
        aiStatus="idle"
        disabled={false}
        onSubmit={vi.fn(async () => undefined)}
      />,
    );

    const observedCycles = Array.from(container.querySelectorAll("[data-chat-cycle]"));
    const observer = IntersectionObserverMock.instances[0];
    if (!observer) {
      throw new Error("expected IntersectionObserver instance");
    }

    observer.trigger([
      {
        target: observedCycles[1]!,
        intersectionRatio: 0.7,
        boundingClientRect: new DOMRect(0, 120, 320, 120),
      },
      {
        target: observedCycles[2]!,
        intersectionRatio: 0.9,
        boundingClientRect: new DOMRect(0, 260, 320, 120),
      },
      {
        target: observedCycles[3]!,
        intersectionRatio: 0.6,
        boundingClientRect: new DOMRect(0, 420, 320, 120),
      },
    ]);

    await waitFor(() => {
      expect(screen.getByLabelText("Jump to cycle #2").parentElement).toHaveAttribute("data-visible", "true");
      expect(screen.getByLabelText("Jump to cycle #3").parentElement).toHaveAttribute("data-visible", "true");
      expect(screen.getByLabelText("Jump to cycle #4").parentElement).toHaveAttribute("data-visible", "true");
      expect(screen.getByLabelText("Jump to cycle #3")).toHaveAttribute("aria-current", "step");
    });
  });
});
