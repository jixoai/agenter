import type { RuntimeSnapshotEntry } from "@agenter/client-sdk";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor, within } from "storybook/test";

import { TerminalPanel } from "./TerminalPanel";

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
      transportUrl: "",
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
    kind: "terminal-snapshot",
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

const cycles = [
  {
    id: "cycle:8",
    cycleId: 8,
    seq: 8,
    createdAt: 8,
    wakeSource: "user" as const,
    kind: "model" as const,
    status: "done" as const,
    clientMessageIds: ["client-8"],
    inputs: [],
    outputs: [
      {
        id: "tool-call-8",
        role: "assistant" as const,
        channel: "tool_call" as const,
        content: ["```yaml+tool_call", "tool: terminal_read", "input:", "  terminalId: iflow", "```"].join("\n"),
        timestamp: 9,
        tool: { name: "terminal_read" },
      },
      {
        id: "tool-result-8",
        role: "assistant" as const,
        channel: "tool_result" as const,
        content: [
          "```yaml+tool_result",
          "tool: terminal_read",
          "ok: true",
          "output:",
          "  kind: terminal-snapshot",
          "  terminalId: iflow",
          "  seq: 8",
          "  cols: 80",
          "  rows: 24",
          "```",
        ].join("\n"),
        timestamp: 10,
        tool: { name: "terminal_read", ok: true },
      },
    ],
    liveMessages: [],
    streaming: null,
    modelCallId: 12,
  },
  {
    id: "cycle:9",
    cycleId: 9,
    seq: 9,
    createdAt: 9,
    wakeSource: "terminal" as const,
    kind: "model" as const,
    status: "done" as const,
    clientMessageIds: ["client-9"],
    inputs: [],
    outputs: [
      {
        id: "tool-call-9",
        role: "assistant" as const,
        channel: "tool_call" as const,
        content: ["```yaml+tool_call", "tool: terminal_read", "input:", "  terminalId: other-terminal", "```"].join(
          "\n",
        ),
        timestamp: 11,
        tool: { name: "terminal_read" },
      },
    ],
    liveMessages: [],
    streaming: null,
    modelCallId: 13,
  },
];

const meta = {
  title: "Features/Terminal/TerminalPanel",
  component: TerminalPanel,
  args: {
    runtime,
    snapshots,
    terminalReads,
    cycles,
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
    await expect(canvas.getByText("terminal_read")).toBeInTheDocument();
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
