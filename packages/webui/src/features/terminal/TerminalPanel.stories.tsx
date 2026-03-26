import type { RuntimeSnapshotEntry } from "@agenter/client-sdk";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor, within } from "storybook/test";

import { TerminalPanel } from "./TerminalPanel";
import { DEFAULT_LONG_LIST_PAGING_STATE } from "../../shared/long-list-paging";

const runtime = {
  sessionId: "session-1",
  started: true,
  activityState: "active",
  schedulerPhase: "waiting_commits",
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
      transportUrl: "",
    },
  ],
  tasks: [],
  schedulerState: null,
  schedulerSignals: {
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
} satisfies RuntimeSnapshotEntry;

const snapshots = {
  iflow: {
    seq: 8,
    timestamp: 1,
    cols: 80,
    rows: 24,
    lines: ["npm ERR! build failed", "exit 1"],
    richLines: [],
    cursor: { x: 5, y: 0 },
    cursorVisible: true,
  },
};

const terminalReads = {
  iflow: {
    kind: "terminal-snapshot" as const,
    representation: "snapshot" as const,
    terminalId: "iflow",
    seq: 8,
    cols: 80,
    rows: 24,
    cursor: { x: 5, y: 0 },
    tail: "npm ERR! build failed\nexit 1",
    status: "BUSY" as const,
  },
};

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
};

const meta = {
  title: "Features/Terminal/TerminalPanel",
  component: TerminalPanel,
  args: {
    sessionId: "session-1",
    runtime,
    snapshots,
    terminalReads,
    terminalActivityByTerminal,
    getTerminalActivityPagingState: () => ({
      ...DEFAULT_LONG_LIST_PAGING_STATE,
      hydrated: true,
      hasMore: true,
    }),
    onLoadTerminalActivity: async () => {},
    onLoadMoreTerminalActivity: async () => {},
  },
  render: (args) => (
    <div className="h-[520px] w-[min(960px,100vw)] p-6">
      <TerminalPanel {...args} />
    </div>
  ),
} satisfies Meta<typeof TerminalPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const EmbeddedSnapshotFallback: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Terminal")).toBeInTheDocument();
    await expect(canvas.getByText("Snapshot fallback")).toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: "Fit" })).toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: "Cover" })).toBeInTheDocument();
    await expect(canvas.getByText("Activity")).toBeInTheDocument();
    await expect(canvas.getAllByText("terminal_read").length).toBeGreaterThan(0);
    await expect(canvas.queryByText("other-terminal")).not.toBeInTheDocument();
    await waitFor(() => {
      expect(canvasElement.querySelector("terminal-view")).not.toBeNull();
    });
    await expect(canvasElement.querySelector('[data-terminal-panel-scroll-owner="renderer"]')).not.toBeNull();
    await expect(canvasElement.querySelector('[data-terminal-activity-scroll-owner="inspector"]')).not.toBeNull();
  },
};

export const NarrowViewportSnapshotFallback: Story = {
  args: {
    runtime: {
      ...runtime,
      terminals: [
        {
          ...runtime.terminals[0],
          title: "Flow shell narrow viewport",
        },
      ],
    },
  },
  render: (args) => (
    <div className="h-[667px] w-[375px] p-3">
      <TerminalPanel {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    await waitFor(() => {
      expect(canvasElement.querySelector("terminal-view")).not.toBeNull();
    });
    await expect(canvasElement.querySelector('[data-terminal-panel-scroll-owner="renderer"]')).not.toBeNull();
  },
};
