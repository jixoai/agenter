import type { RuntimeClientState } from "@agenter/client-sdk";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { TerminalPanel, buildViewportMetrics } from "../src/features/terminal/TerminalPanel";

const runtime = {
  sessionId: "session-1",
  started: true,
  activityState: "active",
  loopPhase: "waiting_commits",
  stage: "act",
  focusedTerminalId: "iflow",
  focusedTerminalIds: ["iflow"],
  chatMessages: [],
  terminalSnapshots: {},
  terminals: [
    {
      terminalId: "iflow",
      running: true,
      status: "BUSY",
      seq: 8,
      cwd: "/repo/demo",
    },
  ],
  tasks: [],
  loopKernelState: null,
  loopInputSignals: {
    user: { version: 0, timestamp: null },
    terminal: { version: 1, timestamp: null },
    task: { version: 0, timestamp: null },
    attention: { version: 0, timestamp: null },
  },
  apiCallRecording: { enabled: false, refCount: 0 },
  modelCapabilities: { imageInput: false },
  activeCycle: null,
} satisfies RuntimeClientState["runtimes"][string];

const snapshots = {
  iflow: {
    seq: 8,
    timestamp: 1,
    cols: 80,
    rows: 24,
    lines: ["npm ERR! build failed"],
    richLines: [
      {
        spans: [
          { text: "npm ", fg: "#94a3b8" },
          { text: "ERR!", fg: "#f87171", bold: true },
          { text: " build failed", fg: "#e2e8f0" },
        ],
      },
    ],
    cursor: { x: 5, y: 0 },
    cursorVisible: true,
  },
} satisfies RuntimeClientState["terminalSnapshotsBySession"][string];

class TerminalResizeObserverMock {
  constructor(private readonly callback: ResizeObserverCallback) {}

  observe(target: Element): void {
    this.callback(
      [
        {
          target,
          contentRect: {
            width: 1200,
            height: 500,
            top: 0,
            left: 0,
            bottom: 500,
            right: 1200,
            x: 0,
            y: 0,
            toJSON: () => ({}),
          },
        } as ResizeObserverEntry,
      ],
      this as unknown as ResizeObserver,
    );
  }

  unobserve(): void {}
  disconnect(): void {}
}

describe("Feature: terminal viewport scaling", () => {
  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", TerminalResizeObserverMock);
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  test("Scenario: Given fit and cover modes When computing viewport metrics Then cover keeps a larger scale and never shrinks below one", () => {
    const fit = buildViewportMetrics({
      availableWidth: 1192,
      availableHeight: 492,
      cols: 80,
      rows: 24,
      mode: "fit",
    });
    const cover = buildViewportMetrics({
      availableWidth: 1192,
      availableHeight: 492,
      cols: 80,
      rows: 24,
      mode: "cover",
    });

    expect(fit.scale).toBeLessThan(1);
    expect(cover.scale).toBeGreaterThan(1);
    expect(cover.scale).toBeGreaterThan(fit.scale);
  });

  test("Scenario: Given terminal panel When switching to cover mode Then the choice persists and the pressed state updates", () => {
    render(<TerminalPanel runtime={runtime} snapshots={snapshots} />);

    const fitButton = screen.getByRole("button", { name: "Fit" });
    const coverButton = screen.getByRole("button", { name: "Cover" });

    expect(fitButton).toHaveAttribute("aria-pressed", "true");
    expect(coverButton).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(coverButton);

    expect(window.localStorage.getItem("agenter:webui:terminal-scale-mode")).toBe("cover");
    expect(fitButton).toHaveAttribute("aria-pressed", "false");
    expect(coverButton).toHaveAttribute("aria-pressed", "true");
  });

  test("Scenario: Given a rich terminal snapshot When rendering Then ANSI-derived colors stay visible in the browser panel", () => {
    render(<TerminalPanel runtime={runtime} snapshots={snapshots} />);

    expect(screen.getByTestId("terminal-rich-surface")).toBeInTheDocument();
    expect(screen.getByText("ERR!")).toHaveStyle({
      color: "rgb(248, 113, 113)",
      fontWeight: "700",
    });
    expect(screen.getByText((_, element) => element?.tagName === "SPAN" && element.textContent === "npm ")).toHaveStyle(
      {
        color: "rgb(148, 163, 184)",
      },
    );
  });
});
