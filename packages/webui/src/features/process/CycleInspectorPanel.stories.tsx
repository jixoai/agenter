import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";

import { CycleInspectorPanel } from "./CycleInspectorPanel";

const meta = {
  title: "Features/Devtools/CycleInspectorPanel",
  component: CycleInspectorPanel,
  args: {
    loading: false,
    detailMode: "split",
    cycles: [
      {
        id: "cycle:11",
        cycleId: 11,
        seq: 11,
        createdAt: 11,
        wakeSource: "user",
        kind: "model" as const,
        status: "done" as const,
        clientMessageIds: ["client-11"],
        inputs: [
          {
            source: "message" as const,
            role: "user" as const,
            name: "User",
            parts: [{ type: "text" as const, text: "Please inspect the terminal diff." }],
            meta: { clientMessageId: "client-11" },
          },
          {
            source: "terminal" as const,
            role: "tool" as const,
            name: "Terminal-iflow",
            parts: [
              {
                type: "text" as const,
                text: JSON.stringify({
                  kind: "terminal-diff",
                  terminalId: "iflow",
                  status: "IDLE",
                  bytes: 128,
                }),
              },
            ],
          },
          {
            source: "attention" as const,
            role: "tool" as const,
            name: "Attention",
            parts: [
              {
                type: "text" as const,
                text: JSON.stringify({
                  kind: "attention-system-list",
                  count: 2,
                  items: [
                    {
                      id: 41,
                      from: "terminal",
                      score: 72,
                      remark: "Investigate the new stderr burst",
                      content: "stderr shows repeated retry noise",
                    },
                    {
                      id: 42,
                      from: "user",
                      score: 18,
                      remark: "Keep user-facing answer concise",
                      content: "User only asked for the root cause",
                    },
                  ],
                }),
              },
            ],
          },
        ],
        outputs: [
          {
            id: "tool-call-1",
            role: "assistant" as const,
            channel: "tool_call" as const,
            content: ["```yaml+tool_call", "tool: terminal_read", "input:", "  terminalId: iflow", "```"].join("\n"),
            timestamp: 12,
            tool: { name: "terminal_read" },
          },
          {
            id: "tool-result-1",
            role: "assistant" as const,
            channel: "tool_result" as const,
            content: [
              "```yaml+tool_result",
              "tool: terminal_read",
              "ok: true",
              "output:",
              "  kind: terminal-snapshot",
              "  terminalId: iflow",
              "  seq: 30",
              "  cols: 80",
              "  rows: 24",
              'timestamp: "2026-03-06T07:12:43.406Z"',
              "```",
            ].join("\n"),
            timestamp: 12,
            tool: { name: "terminal_read", ok: true },
          },
          {
            id: "reply-1",
            role: "assistant" as const,
            channel: "to_user" as const,
            content: "The terminal diff is ready for review.",
            timestamp: 13,
          },
        ],
        liveMessages: [],
        streaming: null,
        modelCallId: 12,
      },
    ],
  },
  render: (args) => (
    <div className="h-[720px] p-6">
      <CycleInspectorPanel {...args} />
    </div>
  ),
} satisfies Meta<typeof CycleInspectorPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const CycleDetailsStayInDevtools: Story = {
  args: {},
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText("Cycles")).toBeInTheDocument();
    await expect(canvas.getAllByText("Cycle 11").length).toBeGreaterThan(0);
    await expect(canvas.getAllByText("#11").length).toBeGreaterThan(0);

    await userEvent.click(canvas.getByRole("button", { name: /Cycle 11/i }));

    await expect(canvas.getByText("Collect")).toBeInTheDocument();
    await expect(canvas.getAllByText("Reply").length).toBeGreaterThan(0);
    await expect(canvas.getByText("Apply")).toBeInTheDocument();
    await expect(canvas.getAllByText("Inputs").length).toBeGreaterThan(0);
    await expect(canvas.getAllByText("Facts").length).toBeGreaterThan(0);
    await expect(canvas.getByText("Attention 1")).toBeInTheDocument();
    await expect(canvas.getByText("score 72")).toBeInTheDocument();
    await expect(canvas.getAllByText("remark").length).toBeGreaterThan(0);
    await expect(canvas.getByText("Investigate the new stderr burst")).toBeInTheDocument();
    await expect(canvas.getByText("Technical records")).toBeInTheDocument();
    await expect(canvas.getByText("terminal_read")).toBeInTheDocument();
    await expect(canvas.getAllByText("terminal_read")).toHaveLength(1);
    await expect(canvas.getAllByText("Please inspect the terminal diff.").length).toBeGreaterThan(0);
    await expect(canvas.getByTestId("cycle-timeline-scroll-viewport")).toBeInTheDocument();
    await expect(canvas.getByTestId("cycle-detail-scroll-viewport")).toBeInTheDocument();

    await userEvent.click(canvas.getByRole("button", { name: /terminal_read/i }));
    await expect(canvas.getByText("call")).toBeInTheDocument();
    await expect(canvas.getByText("result")).toBeInTheDocument();
  },
};

export const StreamingCycleState: Story = {
  args: {
    cycles: [
      {
        id: "cycle:12",
        cycleId: 12,
        seq: 12,
        createdAt: 12,
        wakeSource: "user",
        kind: "model" as const,
        status: "streaming" as const,
        clientMessageIds: ["client-12"],
        inputs: [
          {
            source: "message" as const,
            role: "user" as const,
            name: "User",
            parts: [{ type: "text" as const, text: "Summarize the latest terminal output." }],
            meta: { clientMessageId: "client-12" },
          },
        ],
        outputs: [],
        liveMessages: [],
        streaming: {
          content: "Streaming the operator summary right now...",
        },
        modelCallId: 13,
      },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: /Cycle 12/i }));

    await expect(canvas.getByText("streaming draft")).toBeInTheDocument();
    await expect(canvas.getByText("Streaming draft")).toBeInTheDocument();
    await expect(canvas.getByText("Streaming the operator summary right now...")).toBeInTheDocument();
  },
};

export const CompactCycleDetailSheet: Story = {
  args: {
    detailMode: "sheet",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: /Cycle 11/i }));

    await expect(within(document.body).getByRole("dialog")).toBeInTheDocument();
    await expect(within(document.body).getByText("Technical records")).toBeInTheDocument();
  },
};
