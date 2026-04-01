import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { ToolInvocationCard } from "../src/components/ui/tool-invocation-card";

describe("Feature: tool invocation card payload visibility", () => {
  test("Scenario: Given an empty string call payload When rendering Then call section is omitted", () => {
    render(
      <ToolInvocationCard
        invocation={{
          invocationId: "invocation-1",
          toolName: "message_channel_get",
          status: "success",
          startedAt: Date.now(),
          call: {
            value: "",
          },
          result: {
            value: {
              channel: {
                chatId: "chat-main",
              },
            },
          },
        }}
      />,
    );

    expect(screen.queryByText("Call")).not.toBeInTheDocument();
    expect(screen.getByText("Result")).toBeInTheDocument();
  });
});

