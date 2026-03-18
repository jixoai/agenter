import type { ModelDebugOutput } from "@agenter/client-sdk";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { ModelPanel } from "../src/features/model/ModelPanel";

vi.mock("../src/components/markdown/MarkdownDocument", () => ({
  MarkdownDocument: ({ value }: { value: string }) => <div data-testid="markdown-document">{value}</div>,
}));

const debug = {
  config: {
    providerId: "deepseek",
    kind: "openai-compatible",
    model: "deepseek-chat",
    baseUrl: "https://api.deepseek.com/v1",
    apiKey: "sk-test",
    temperature: 0.2,
    maxRetries: 1,
    maxToken: 8000,
    compactThreshold: 6000,
    capabilities: {
      imageInput: true,
    },
  },
  history: [
    {
      role: "user",
      name: "User",
      content: [{ type: "text", content: "Please inspect the iflow terminal." }],
    },
  ],
  stats: {
    loops: 2,
    apiCalls: 1,
    lastContextChars: 256,
    totalContextChars: 400,
    lastPromptTokens: 120,
    totalPromptTokens: 240,
  },
  latestModelCall: {
    id: 7,
    cycleId: 4,
    createdAt: 1_709_800_000_000,
    provider: "openai-compatible",
    model: "deepseek-chat",
    request: {
      systemPrompt: "# Agenter\n\nYou are a careful coding assistant.",
      messages: [
        {
          role: "user",
          content: [{ type: "text", content: "Please inspect the iflow terminal." }],
        },
      ],
      tools: [{ name: "terminal_read", description: "Read terminal snapshot." }],
      meta: { cycleId: 4 },
    },
    response: { assistant: { text: "Checking the terminal now." } },
    error: null,
  },
  recentModelCalls: [
    {
      id: 6,
      cycleId: 3,
      createdAt: 1_709_799_000_000,
      provider: "openai-compatible",
      model: "deepseek-chat",
      request: { systemPrompt: "# Previous" },
      response: { assistant: { text: "Previous call" } },
      error: null,
    },
  ],
  recentApiCalls: [
    {
      id: 4,
      modelCallId: 7,
      createdAt: 1_709_800_000_100,
      request: { url: "https://api.deepseek.com/v1/chat/completions" },
      response: { id: "resp_1" },
      error: null,
    },
  ],
} satisfies ModelDebugOutput;

describe("Feature: model panel", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  test("Scenario: Given model debug When switching tabs Then model data stays grouped by intent and text rendering remains scoped to text fields", () => {
    const onRefresh = vi.fn();

    render(<ModelPanel debug={debug} loading={false} error={null} onRefresh={onRefresh} />);

    expect(screen.getByText("Provider")).toBeInTheDocument();
    expect(screen.getByText("Current context")).toBeInTheDocument();
    expect(screen.getByText("Latest summary")).toBeInTheDocument();
    expect(screen.queryByText("Latest model call")).not.toBeInTheDocument();
    expect(screen.queryByText("AI tools")).not.toBeInTheDocument();
    expect(screen.queryByText("Recorded HTTP")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Latest" }));
    expect(screen.getByText("Latest model request")).toBeInTheDocument();
    expect(screen.getByText("Request messages")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /1\. user/i }));
    expect(screen.getByText("Please inspect the iflow terminal.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Tools" }));
    expect(screen.getByText("AI tools")).toBeInTheDocument();
    expect(screen.getByText("Read terminal snapshot.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "History" }));
    fireEvent.click(screen.getByRole("tab", { name: "Context" }));
    expect(screen.getByText("Current context")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /1\. user/i }));
    expect(screen.getByText("Please inspect the iflow terminal.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Calls" }));
    expect(screen.getByText("Recent model calls")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "HTTP" }));
    expect(screen.getByText("Recorded HTTP")).toBeInTheDocument();
    expect(screen.getByText("HTTP #4")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Latest" }));
    fireEvent.click(screen.getByRole("tab", { name: "Request" }));
    fireEvent.click(screen.getByRole("tab", { name: "Raw" }));
    expect(window.localStorage.getItem("agenter:webui:model-text-mode")).toBe("raw");
    expect(window.localStorage.getItem("agenter:webui:model-panel-tab")).toBe("latest");
    expect(window.localStorage.getItem("agenter:webui:model-panel-latest-tab")).toBe("request");
    expect(window.localStorage.getItem("agenter:webui:model-panel-history-tab")).toBe("calls");

    fireEvent.click(screen.getByRole("button", { name: /Refresh/i }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });
});
