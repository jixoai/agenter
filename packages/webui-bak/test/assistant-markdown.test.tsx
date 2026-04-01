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

  test("Scenario: Given a tool channel markdown message without structured trace When rendering Then the content stays as raw markdown text", () => {
    render(
      <AssistantMarkdown
        channel="tool"
        tool={{ name: "terminal_read", status: "success", invocationId: "call-terminal-read" }}
        content={[
          "```yaml",
          "invocationId: call-terminal-read",
          "tool: terminal_read",
          "status: success",
          "result:",
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

    expect(screen.getByText(/```yaml/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /terminal_read/i })).not.toBeInTheDocument();
  });

  test("Scenario: Given self-talk content When rendering Then UI keeps the raw body without injecting an extra self-talk label", () => {
    render(<AssistantMarkdown content="Observation: terminal idle" channel="self_talk" />);

    expect(screen.getByText("Observation: terminal idle")).toBeInTheDocument();
    expect(screen.queryByText(/^self-talk$/i)).not.toBeInTheDocument();
  });
});
