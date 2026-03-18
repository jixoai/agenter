import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

import { LoopBusPanel } from "../src/features/loopbus/LoopBusPanel";

const inputSignals = {
  user: { version: 1, timestamp: Date.now() },
  terminal: { version: 0, timestamp: null },
  task: { version: 0, timestamp: null },
  attention: { version: 0, timestamp: null },
} as const;

afterEach(() => {
  cleanup();
});

describe("Feature: loopbus timeline loading", () => {
  test("Scenario: Given flow tab When rendering Then compact snake cards reflect the merged collect phase", () => {
    render(
      <LoopBusPanel
        stage="observe"
        kernel={{
          schemaVersion: 1,
          stateVersion: 1,
          running: true,
          paused: false,
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
          lastError: null,
        }}
        inputSignals={inputSignals}
        logs={[]}
        traces={[]}
        modelCalls={[]}
        apiCalls={[]}
        apiRecording={{ enabled: false, refCount: 0 }}
      />,
    );

    expect(screen.getByText("Race")).toBeInTheDocument();
    expect(screen.getByText("Collect")).toBeInTheDocument();
    expect(screen.getByText("Persist")).toBeInTheDocument();
    expect(screen.getByText("Model")).toBeInTheDocument();
    expect(screen.getByText("Apply")).toBeInTheDocument();
  });

  test("Scenario: Given paged trace and model history When user requests older records Then panel calls the matching loaders", async () => {
    const onLoadMoreTrace = vi.fn();
    const onLoadMoreModel = vi.fn();

    render(
      <LoopBusPanel
        stage="observe"
        kernel={null}
        inputSignals={inputSignals}
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

    fireEvent.click(screen.getByRole("tab", { name: /Trace \(0\)/i }));
    fireEvent.click(screen.getByRole("button", { name: "Load older" }));
    expect(onLoadMoreTrace).toHaveBeenCalledTimes(1);
    await Promise.resolve();

    fireEvent.click(screen.getByRole("tab", { name: /Model \(0\)/i }));
    fireEvent.click(screen.getByRole("button", { name: "Load older" }));
    expect(onLoadMoreModel).toHaveBeenCalledTimes(1);
  });
});
