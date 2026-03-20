import type { RuntimeSnapshotEntry } from "@agenter/client-sdk";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";

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
};

const meta = {
  title: "Features/Terminal/TerminalPanel",
  component: TerminalPanel,
  args: {
    runtime,
    snapshots,
  },
  render: (args) => (
    <div className="h-[520px] w-[min(960px,100vw)] p-6">
      <TerminalPanel {...args} />
    </div>
  ),
} satisfies Meta<typeof TerminalPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const RichTerminal: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("ERR!")).toBeInTheDocument();
    await expect(canvas.getByText("Terminal")).toBeInTheDocument();

    const coverButton = canvas.getByRole("button", { name: "Cover" });
    await userEvent.click(coverButton);
    await expect(coverButton).toHaveAttribute("aria-pressed", "true");
  },
};
