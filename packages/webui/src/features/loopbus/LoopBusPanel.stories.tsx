import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import { LoopBusPanel } from "./LoopBusPanel";

const now = Date.now();

const traces = Array.from({ length: 12 }, (_, index) => ({
  id: index + 1,
  cycleId: 40 - Math.floor(index / 3),
  seq: index + 1,
  step: index % 3 === 0 ? "race" : index % 3 === 1 ? "collect" : "persist",
  status: index === 2 ? ("running" as const) : "ok",
  startedAt: now - index * 1_000,
  endedAt: now - index * 1_000 + 240,
  detail: {
    event: index % 2 === 0 ? "user_message" : "terminal_dirty",
    index,
    payload: { size: 512 + index },
  },
}));

const modelCalls = Array.from({ length: 10 }, (_, index) => ({
  id: index + 1,
  cycleId: 40 - Math.floor(index / 2),
  createdAt: now - index * 4_000,
  provider: index % 2 === 0 ? "openai" : "anthropic",
  model: index % 2 === 0 ? "gpt-5.4" : "claude-sonnet-4.5",
  request: {
    input: Array.from({ length: 4 }, (_, lineIndex) => `request line ${index + 1}.${lineIndex + 1}`).join("\n"),
  },
  response: {
    output: Array.from({ length: 3 }, (_, lineIndex) => `response line ${index + 1}.${lineIndex + 1}`).join("\n"),
  },
}));

const meta = {
  title: "Features/LoopBus/LoopBusPanel",
  component: LoopBusPanel,
  args: {
    stage: "act",
    kernel: {
      schemaVersion: 1,
      stateVersion: 8,
      running: true,
      paused: false,
      phase: "collecting_inputs",
      gate: "open",
      queueSize: 0,
      cycle: 40,
      sentBatches: 8,
      updatedAt: now,
      lastMessageAt: now - 4_000,
      lastResponseAt: now - 2_000,
      lastWakeAt: now - 5_000,
      lastWakeSource: "user",
      lastError: null,
    },
    inputSignals: {
      user: { version: 12, timestamp: now - 5_000 },
      terminal: { version: 4, timestamp: now - 7_000 },
      task: { version: 2, timestamp: now - 9_000 },
      attention: { version: 1, timestamp: now - 11_000 },
    },
    logs: [{ id: 1, timestamp: now, stateVersion: 8, event: "cycle", prevHash: "a", stateHash: "b", patch: [] }],
    traces,
    modelCalls,
    apiCalls: [
      {
        id: 1,
        modelCallId: 1,
        createdAt: now - 1_000,
        request: { path: "/v1/chat/completions" },
        response: { ok: true },
      },
    ],
    apiRecording: { enabled: true, refCount: 1 },
    hasMoreTrace: true,
    hasMoreModel: true,
    loadingTrace: false,
    loadingModel: false,
    onLoadMoreTrace: fn(async () => undefined),
    onLoadMoreModel: fn(async () => undefined),
  },
  render: (args) => (
    <div className="h-[720px] w-[min(1100px,100vw)] p-6">
      <LoopBusPanel {...args} />
    </div>
  ),
} satisfies Meta<typeof LoopBusPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const FlowTraceAndModelStayOperable: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText("Collect")).toBeInTheDocument();

    await userEvent.click(canvas.getByRole("tab", { name: /Trace \(12\)/i }));
    await userEvent.click(await canvas.findByRole("button", { name: /#40\.1 race/i }));
    await expect(await canvas.findByText(/user_message/i)).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: /Load older/i }));
    await waitFor(() => {
      expect(args.onLoadMoreTrace).toHaveBeenCalledTimes(1);
    });

    await userEvent.click(canvas.getByRole("tab", { name: /Model \(10\)/i }));
    await userEvent.click((await canvas.findAllByRole("button", { name: /openai \/ gpt-5\.4/i }))[0]!);
    await expect(await canvas.findByText("request")).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: /Load older/i }));
    await waitFor(() => {
      expect(args.onLoadMoreModel).toHaveBeenCalledTimes(1);
    });
  },
};
