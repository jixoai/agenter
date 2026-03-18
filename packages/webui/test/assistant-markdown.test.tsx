import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

import { AssistantMarkdown } from "../src/features/chat/AssistantMarkdown";

vi.mock("../src/components/markdown/MarkdownDocument", () => ({
  MarkdownDocument: ({ value }: { value: string }) => <div data-testid="markdown-document">{value}</div>,
}));

afterEach(() => {
  cleanup();
});

describe("Feature: assistant markdown tool traces", () => {
  test("Scenario: Given fenced merged tool trace When expanding row Then code fences are stripped and yaml body stays readable", () => {
    render(
      <AssistantMarkdown
        content=""
        toolTrace={{
          id: "tool-terminal-read",
          toolName: "terminal_read",
          status: "done",
          meta: "iflow · terminal-snapshot · #30 · 80x24",
          callContent: ["tool: terminal_read", "input:", "  terminalId: iflow"].join("\n"),
          resultContent: ["tool: terminal_read", "output:", "  kind: terminal-snapshot"].join("\n"),
        }}
      />,
    );

    expect(screen.getByText("terminal_read")).toBeInTheDocument();
    expect(screen.getByText("iflow · terminal-snapshot · #30 · 80x24")).toBeInTheDocument();
    expect(screen.queryByText(/kind: terminal-snapshot/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /terminal_read/i }));

    expect(screen.getByText("call")).toBeInTheDocument();
    expect(screen.getByText("result")).toBeInTheDocument();
    expect(screen.getByText("kind")).toBeInTheDocument();
    expect(screen.getByText("terminal-snapshot")).toBeInTheDocument();
  });

  test("Scenario: Given a fenced tool_result message When rendering Then the accordion header keeps the tool meta compact until expanded", () => {
    render(
      <AssistantMarkdown
        channel="tool_result"
        tool={{ name: "terminal_read", ok: true }}
        content={[
          "```yaml+tool_result",
          "tool: terminal_read",
          "ok: true",
          "output:",
          "  kind: terminal-snapshot",
          "  terminalId: iflow",
          "  seq: 30",
          "  cols: 80",
          "  rows: 24",
          'timestamp: "2026-03-06T07:12:43.406Z"',
          "```",
        ].join("\n")}
      />,
    );

    expect(screen.getByText("terminal_read")).toBeInTheDocument();
    expect(screen.getByText("iflow · terminal-snapshot · #30 · 80x24")).toBeInTheDocument();
    expect(screen.queryByText("timestamp")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /terminal_read/i }));

    expect(screen.getByText("timestamp")).toBeInTheDocument();
    expect(screen.getByText("2026-03-06T07:12:43.406Z")).toBeInTheDocument();
  });

  test("Scenario: Given self-talk content When rendering Then UI keeps the raw body without injecting an extra self-talk label", () => {
    render(<AssistantMarkdown content="Observation: terminal idle" channel="self_talk" />);

    expect(screen.getByText("Observation: terminal idle")).toBeInTheDocument();
    expect(screen.queryByText(/^self-talk$/i)).not.toBeInTheDocument();
  });
});
