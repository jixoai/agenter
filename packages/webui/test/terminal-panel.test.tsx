import type { RuntimeClientState } from "@agenter/client-sdk";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

vi.mock("@agenter/terminal-view", () => {
  const TERMINAL_VIEW_TAG = "terminal-view";

  class MockTerminalViewElement extends HTMLElement {
    transportUrl = "";
    terminalId = "";
    terminalTitle = "";
    cwd = "";
    status: "IDLE" | "BUSY" = "IDLE";
    viewportMode: "fit" | "cover" = "fit";
    snapshot: unknown = null;
  }

  const defineTerminalView = () => {
    if (!customElements.get(TERMINAL_VIEW_TAG)) {
      customElements.define(TERMINAL_VIEW_TAG, MockTerminalViewElement);
    }
  };

  return { TERMINAL_VIEW_TAG, defineTerminalView };
});

import { TerminalPanel } from "../src/features/terminal/TerminalPanel";
import { DEFAULT_LONG_LIST_PAGING_STATE } from "../src/shared/long-list-paging";

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
  terminalReads: {},
  terminals: [
    {
      terminalId: "iflow",
      running: true,
      status: "BUSY",
      seq: 8,
      cwd: "/repo/demo",
      title: "Flow shell",
      transportUrl: "ws://127.0.0.1:43001/pty/iflow",
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
  modelCapabilities: {
    streaming: true,
    tools: true,
    imageInput: false,
    nativeCompact: false,
    summarizeFallback: true,
    fileUpload: false,
    mcpCatalog: false,
  },
  activeCycle: null,
} satisfies RuntimeClientState["runtimes"][string];

const snapshots = {
  iflow: {
    seq: 8,
    timestamp: 1,
    cols: 80,
    rows: 24,
    lines: [],
    richLines: [
      {
        spans: [{ text: "npm ERR! build failed" }],
      },
    ],
    cursor: { x: 5, y: 0 },
    cursorVisible: true,
  },
} satisfies RuntimeClientState["terminalSnapshotsBySession"][string];

const terminalReads = {
  iflow: {
    kind: "terminal-snapshot",
    representation: "snapshot" as const,
    terminalId: "iflow",
    seq: 8,
    cols: 80,
    rows: 24,
    cursor: { x: 5, y: 0 },
    tail: "npm ERR! build failed",
    status: "BUSY" as const,
  },
} satisfies RuntimeClientState["terminalReadsBySession"][string];

const terminalActivityByTerminal = {
  iflow: [
    {
      id: 21,
      terminalId: "iflow",
      createdAt: 9,
      kind: "terminal_read" as const,
      cycleId: 8,
      title: "terminal_read",
      content: "stdout for iflow",
    },
  ],
  "other-terminal": [
    {
      id: 22,
      terminalId: "other-terminal",
      createdAt: 10,
      kind: "terminal_read" as const,
      cycleId: 9,
      title: "terminal_read",
      content: "stdout for other-terminal",
    },
  ],
} satisfies RuntimeClientState["terminalActivityBySession"][string];

const getTerminalActivityPagingState = (terminalId: string) =>
  terminalId === "iflow"
    ? {
        ...DEFAULT_LONG_LIST_PAGING_STATE,
        hydrated: true,
        hasMore: true,
      }
    : {
        ...DEFAULT_LONG_LIST_PAGING_STATE,
        hydrated: true,
        hasMore: false,
      };

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("Feature: terminal panel uses the standalone renderer host", () => {
  test("Scenario: Given a live terminal entry When rendering Then WebUI passes transport metadata into the standalone terminal-view host", async () => {
    const { container } = render(
      <TerminalPanel
        sessionId="session-1"
        runtime={runtime}
        snapshots={snapshots}
        terminalReads={terminalReads}
        terminalActivityByTerminal={terminalActivityByTerminal}
        getTerminalActivityPagingState={getTerminalActivityPagingState}
        onLoadTerminalActivity={async () => {}}
        onLoadMoreTerminalActivity={async () => {}}
      />,
    );

    await waitFor(() => {
      expect(container.querySelector("terminal-view")).not.toBeNull();
    });

    const terminalView = container.querySelector("terminal-view") as HTMLElement & {
      transportUrl: string;
      terminalId: string;
      terminalTitle: string;
      cwd: string;
      status: "IDLE" | "BUSY";
      viewportMode: "fit" | "cover";
      snapshot: { lines: string[] };
    };

    expect(screen.getByText("Live transport")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Fit" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cover" })).toBeInTheDocument();
    expect(screen.getByText("Activity")).toBeInTheDocument();
    expect(screen.getByText("Latest terminal_read result")).toBeInTheDocument();
    expect(screen.getAllByText("terminal_read").length).toBeGreaterThan(0);
    expect(screen.queryByText("other-terminal")).not.toBeInTheDocument();
    expect(container.querySelector('[data-terminal-panel-scroll-owner="renderer"]')).not.toBeNull();
    expect(container.querySelector('[data-terminal-activity-scroll-owner="inspector"]')).not.toBeNull();
    expect(terminalView.transportUrl).toBe("ws://127.0.0.1:43001/pty/iflow");
    expect(terminalView.terminalId).toBe("iflow");
    expect(terminalView.terminalTitle).toBe("Flow shell");
    expect(terminalView.cwd).toBe("/repo/demo");
    expect(terminalView.status).toBe("BUSY");
    expect(terminalView.viewportMode).toBe("fit");
    expect(terminalView.snapshot.lines).toEqual(["npm ERR! build failed"]);
  });

  test("Scenario: Given a terminal panel When switching viewport mode Then the standalone host receives fit and cover as presentation state", async () => {
    const { container } = render(
      <TerminalPanel
        runtime={{
          ...runtime,
          terminals: [{ ...runtime.terminals[0], transportUrl: "" }],
        }}
        sessionId="session-1"
        snapshots={snapshots}
        terminalReads={terminalReads}
        terminalActivityByTerminal={terminalActivityByTerminal}
        getTerminalActivityPagingState={getTerminalActivityPagingState}
        onLoadTerminalActivity={async () => {}}
        onLoadMoreTerminalActivity={async () => {}}
      />,
    );

    await screen.findByText("Snapshot fallback");
    const terminalView = container.querySelector("terminal-view") as HTMLElement & {
      viewportMode: "fit" | "cover";
    };

    fireEvent.click(screen.getByRole("button", { name: "Cover" }));
    expect(terminalView.viewportMode).toBe("cover");
    expect(window.localStorage.getItem("agenter:webui:terminal-scale-mode")).toBe("cover");

    fireEvent.click(screen.getByRole("button", { name: "Fit" }));
    expect(terminalView.viewportMode).toBe("fit");
    expect(window.localStorage.getItem("agenter:webui:terminal-scale-mode")).toBe("fit");
  });

  test("Scenario: Given legacy single-focus state disagrees with focused ids When rendering Then the ordered focus set still picks the embedded terminal host", async () => {
    const { container } = render(
      <TerminalPanel
        runtime={{
          ...runtime,
          focusedTerminalId: "stale-legacy",
          focusedTerminalIds: ["iflow"],
          terminals: [
            runtime.terminals[0],
            {
              terminalId: "stale-legacy",
              running: true,
              status: "IDLE",
              seq: 3,
              cwd: "/repo/stale",
              title: "Stale shell",
              transportUrl: "ws://127.0.0.1:43001/pty/stale-legacy",
            },
          ],
        }}
        sessionId="session-1"
        snapshots={snapshots}
        terminalReads={terminalReads}
        terminalActivityByTerminal={terminalActivityByTerminal}
        getTerminalActivityPagingState={getTerminalActivityPagingState}
        onLoadTerminalActivity={async () => {}}
        onLoadMoreTerminalActivity={async () => {}}
      />,
    );

    await waitFor(() => {
      expect(container.querySelector("terminal-view")).not.toBeNull();
    });

    const terminalView = container.querySelector("terminal-view") as HTMLElement & {
      terminalId: string;
    };

    expect(terminalView.terminalId).toBe("iflow");
    expect(screen.queryByText("/repo/stale")).not.toBeInTheDocument();
  });
});
