import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

import { ObservabilityPanel } from "../src/features/devtools/observability/ObservabilityPanel";

const inputSignals = {
  user: { version: 1, timestamp: Date.now() },
  terminal: { version: 0, timestamp: null },
  task: { version: 0, timestamp: null },
  attention: { version: 0, timestamp: null },
} as const;

afterEach(() => {
  cleanup();
});

describe("Feature: observability timeline loading", () => {
  test("Scenario: Given the observability panel When rendering Then the event-first trace tab is the primary surface", () => {
    render(
      <ObservabilityPanel
        stage="observe"
        kernel={{
          schemaVersion: 2,
          stateVersion: 1,
          running: true,
          paused: false,
          runtimeStatus: "waiting",
          phase: "collecting_inputs",
          gate: "open",
          queueSize: 0,
          cycle: 3,
          sentBatches: 0,
          updatedAt: Date.now(),
          lastMessageAt: null,
          lastResponseAt: null,
          lastWakeAt: Date.now(),
          lastWakeSource: "user",
          lastWakeCause: "user_input",
          activeContextCount: 1,
          activeItemCount: 1,
          unresolvedScoreCount: 1,
          waitingReason: "attention_debt",
          nextAutoWakeAt: Date.now() + 600,
          backoffMs: 600,
          retryCount: 1,
          blockedReason: null,
          lastProgressAt: Date.now() - 300,
          lastError: null,
        }}
        inputSignals={inputSignals}
        attention={{
          snapshot: {
            contexts: [
              {
                contextId: "ctx-chat-kzf",
                owner: "avatar:jane",
                content: "ask gaubee lunch",
                contentFormat: "text/plain",
                scoreMap: { a1b2c3: 100 },
                headCommitId: "commit-1",
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                commits: [
                  {
                    commitId: "commit-1",
                    contextId: "ctx-chat-kzf",
                    parentCommitIds: [],
                    meta: { author: "user:kzf", source: "message", createdAt: new Date().toISOString() },
                    scores: { a1b2c3: 100 },
                    summary: "Need lunch reply",
                    change: { type: "update", value: "ask gaubee lunch", format: "text/plain" },
                    createdAt: new Date().toISOString(),
                  },
                ],
              },
            ],
          },
          active: [],
          cycleFrames: [],
          hooks: [],
        }}
        logs={[]}
        traces={[]}
        modelCalls={[]}
        apiCalls={[]}
        apiRecording={{ enabled: false, refCount: 0 }}
      />,
    );

    expect(screen.getByText("Observability")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Trace \(2\)/i })).toHaveAttribute("data-active", "");
    expect(screen.getByRole("button", { name: /Need lunch reply/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: /Scheduler/i }));
    expect(screen.getByText(/reason attention_debt/i)).toBeInTheDocument();
  });

  test("Scenario: Given paged observability history When user requests older records Then panel fans out to trace and model loaders", async () => {
    const onLoadMoreTrace = vi.fn();
    const onLoadMoreModel = vi.fn();

    render(
      <ObservabilityPanel
        stage="observe"
        kernel={null}
        inputSignals={inputSignals}
        attention={null}
        logs={[]}
        traces={[]}
        modelCalls={[]}
        apiCalls={[]}
        apiRecording={{ enabled: false, refCount: 0 }}
        hasMoreTrace
        hasMoreModel
        loadingTrace={false}
        loadingModel={false}
        onLoadMoreTrace={onLoadMoreTrace}
        onLoadMoreModel={onLoadMoreModel}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Load older" }));
    expect(onLoadMoreTrace).toHaveBeenCalledTimes(1);
    expect(onLoadMoreModel).toHaveBeenCalledTimes(1);
    await Promise.resolve();
  });
});
