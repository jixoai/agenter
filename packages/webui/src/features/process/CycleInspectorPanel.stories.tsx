import type { ModelCallItem, RuntimeAttentionState, RuntimeChatCycle, ObservabilityTraceItem } from "@agenter/client-sdk";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";

import type { AttentionSelectionState } from "../attention/attention-view-model";
import { CycleInspectorPanel } from "./CycleInspectorPanel";

const contextTerminal: RuntimeAttentionState["snapshot"]["contexts"][number] = {
  contextId: "ctx-terminal-iflow",
  owner: "avatar:jane",
  content: "retry burst comes from the deploy watcher retry loop.",
  contentFormat: "text/plain",
  scoreMap: { retry001: 0, answer001: 0 },
  headCommitId: "commit-43",
  createdAt: "2026-03-24T09:00:00.000Z",
  updatedAt: "2026-03-24T09:00:20.000Z",
  commits: [
    {
      commitId: "commit-41",
      contextId: "ctx-terminal-iflow",
      parentCommitIds: [],
      meta: { author: "terminal:iflow", source: "terminal", createdAt: "2026-03-24T09:00:00.000Z" },
      scores: { retry001: 72 },
      summary: "stderr shows repeated retry noise",
      change: { type: "update" as const, value: "Investigate the repeated retry burst in stderr.", format: "text/plain" },
      createdAt: "2026-03-24T09:00:00.000Z",
    },
    {
      commitId: "commit-42",
      contextId: "ctx-terminal-iflow",
      parentCommitIds: ["commit-41"],
      meta: { author: "user:kzf", source: "message", createdAt: "2026-03-24T09:00:10.000Z" },
      scores: { answer001: 18 },
      summary: "User only asked for the root cause",
      change: { type: "update" as const, value: "Keep the answer concise and focused on the root cause.", format: "text/plain" },
      createdAt: "2026-03-24T09:00:10.000Z",
    },
    {
      commitId: "commit-43",
      contextId: "ctx-terminal-iflow",
      parentCommitIds: ["commit-41", "commit-42"],
      meta: {
        author: "avatar:jane",
        source: "attention",
        createdAt: "2026-03-24T09:00:20.000Z",
        replyTarget: { systemId: "message", subjectId: "chat-kzf", channelId: "chat-kzf" },
      },
      scores: { retry001: 0, answer001: 0 },
      summary: "The terminal diff is ready for review.",
      change: { type: "update" as const, value: "The retry burst comes from the deploy watcher retry loop.", format: "text/plain" },
      createdAt: "2026-03-24T09:00:20.000Z",
    },
  ],
};

const contextChat: RuntimeAttentionState["snapshot"]["contexts"][number] = {
  contextId: "ctx-chat-kzf",
  owner: "avatar:jane",
  content: "Need to reply to kzf with the root cause.",
  contentFormat: "text/plain",
  scoreMap: { answer001: 0 },
  headCommitId: "commit-chat-1",
  createdAt: "2026-03-24T09:00:15.000Z",
  updatedAt: "2026-03-24T09:00:18.000Z",
  commits: [
    {
      commitId: "commit-chat-1",
      contextId: "ctx-chat-kzf",
      parentCommitIds: [],
      meta: { author: "avatar:jane", source: "attention", createdAt: "2026-03-24T09:00:18.000Z" },
      scores: { answer001: 0 },
      summary: "Prepare the user-facing reply",
      change: { type: "update" as const, value: "Need to reply to kzf with the root cause.", format: "text/plain" },
      createdAt: "2026-03-24T09:00:18.000Z",
    },
  ],
};

const baseAttention: RuntimeAttentionState = {
  snapshot: {
    contexts: [contextTerminal, contextChat],
  },
  active: [],
  cycleFrames: [
    {
      cycleId: 11,
      seq: 11,
      createdAt: 11,
      wakeSource: "user",
      inputContextIds: ["ctx-terminal-iflow", "ctx-chat-kzf"],
      activeContextIds: [],
      producedCommitRefs: [{ contextId: "ctx-terminal-iflow", commitId: "commit-43" }],
      modelCallIds: [12],
      hookIds: ["hook-11"],
    },
    {
      cycleId: 12,
      seq: 12,
      createdAt: 12,
      wakeSource: "attention",
      inputContextIds: ["ctx-chat-kzf"],
      activeContextIds: ["ctx-chat-kzf"],
      producedCommitRefs: [],
      modelCallIds: [13],
      hookIds: [],
    },
  ],
  hooks: [
    {
      id: "hook-11",
      cycleId: 11,
      hookId: "message-bridge",
      systemId: "message",
      contextId: "ctx-terminal-iflow",
      commitId: "commit-43",
      status: "delivered",
      createdAt: 13,
      target: { chatId: "chat-kzf", to: "user:kzf" },
      output: {
        messageId: "assistant-11",
        attentionContextId: "ctx-terminal-iflow",
        attentionCommitId: "commit-43",
      },
    },
  ],
};

const baseCycles: RuntimeChatCycle[] = [
  {
    id: "cycle:11",
    cycleId: 11,
    seq: 11,
    createdAt: 11,
    wakeSource: "user",
    kind: "model",
    status: "done",
    clientMessageIds: ["client-11"],
    inputs: [
      {
        source: "message",
        role: "user",
        name: "User",
        parts: [{ type: "text", text: "Please inspect the terminal diff." }],
        meta: { clientMessageId: "client-11" },
      },
    ],
    outputs: [
      {
        id: "tool-11",
        role: "assistant",
        channel: "tool",
        content: [
          "```yaml",
          "invocationId: terminal-read-11",
          "tool: terminal_read",
          "status: success",
          "```",
        ].join("\n"),
        timestamp: 12,
        cycleId: 11,
        tool: {
          invocationId: "terminal-read-11",
          name: "terminal_read",
          status: "success",
          startedAt: 12,
          finishedAt: 12,
          call: {
            value: {
              terminalId: "iflow",
            },
          },
          result: {
            value: {
              terminalId: "iflow",
              kind: "diff",
              seq: 18,
              cols: 120,
              rows: 30,
            },
          },
        },
      },
      {
        id: "assistant-11",
        role: "assistant",
        channel: "to_user",
        content: "The retry burst comes from the deploy watcher retry loop.",
        timestamp: 13,
        cycleId: 11,
      },
    ],
    liveMessages: [],
    streaming: null,
    modelCallId: 12,
  },
  {
    id: "cycle:12",
    cycleId: 12,
    seq: 12,
    createdAt: 12,
    wakeSource: "attention",
    kind: "model",
    status: "streaming",
    clientMessageIds: [],
    inputs: [],
    outputs: [],
    liveMessages: [],
    streaming: { content: "Still tracing the remaining answer debt..." },
    modelCallId: 13,
  },
];

const modelCalls: ModelCallItem[] = [
  {
    id: 12,
    cycleId: 11,
    createdAt: 12,
    completedAt: 13,
    status: "done",
    provider: "openai-compatible",
    model: "deepseek-chat",
    request: { prompt: "inspect terminal" },
    response: { ok: true },
    outcome: { code: "done" },
  },
  {
    id: 13,
    cycleId: 12,
    createdAt: 14,
    status: "running",
    provider: "openai-compatible",
    model: "deepseek-chat",
    request: { prompt: "continue" },
  },
];

const traces: ObservabilityTraceItem[] = [
  {
    id: 1,
    cycleId: 11,
    seq: 1,
    traceId: "trace-11",
    spanId: "span-11",
    kind: "attention.commit",
    name: "attention_commit",
    status: "done",
    startedAt: 11,
    endedAt: 13,
    refs: [],
    links: [],
    events: [],
    attributes: {},
    outcome: { code: "done" },
  },
];

const meta = {
  title: "Features/Devtools/CycleInspectorPanel",
  component: CycleInspectorPanel,
  args: {
    cycles: baseCycles,
    attention: baseAttention,
    modelCalls,
    traces,
    loading: false,
    selectedCycleId: "cycle:11",
  },
  render: (args) => {
    const [selection, setSelection] = useState<AttentionSelectionState>({ contextId: null, itemId: null });
    return (
      <div className="space-y-3 p-6">
        <div data-testid="cycle-selection-state" className="text-xs text-slate-500">
          {selection.contextId && selection.itemId ? `${selection.contextId}/${selection.itemId}` : "no-selection"}
        </div>
        <div className="h-[760px]">
          <CycleInspectorPanel {...args} onOpenAttentionRef={setSelection} />
        </div>
      </div>
    );
  },
} satisfies Meta<typeof CycleInspectorPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const CycleDetailsStayInDevtools: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText("Cycles")).toBeInTheDocument();
    await expect(canvas.getByText(/Cycle story/i)).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("tab", { name: /Effects/i }));
    await expect(canvas.getByText(/Visible delivery/i)).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("tab", { name: /Evidence/i }));
    await expect((await canvas.findAllByText(/terminal_read/i)).length).toBeGreaterThan(0);
  },
};

export const StreamingCycleState: Story = {
  args: {
    selectedCycleId: "cycle:12",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByRole("button", { name: /Cycle 12/i })).toBeInTheDocument();
    await expect(await canvas.findByText(/Still tracing the remaining answer debt/i)).toBeInTheDocument();
  },
};

export const CompactCycleDetailSheet: Story = {
  args: {
    detailMode: "sheet",
    selectedCycleId: null,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const documentCanvas = within(document.body);

    await userEvent.click(canvas.getByRole("button", { name: /Cycle 11/i }));
    await expect(await documentCanvas.findByRole("dialog")).toBeInTheDocument();
    await expect(await documentCanvas.findByRole("tab", { name: /Commits/i })).toBeInTheDocument();
  },
};

export const MultiContextAttentionRefsStayReadable: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole("tab", { name: /Contexts/i }));
    await expect(canvas.getByText("ctx-terminal-iflow")).toBeInTheDocument();
    await expect(canvas.getByText("ctx-chat-kzf")).toBeInTheDocument();
  },
};

export const LoadingCycleHistory: Story = {
  args: {
    cycles: [],
    attention: {
      snapshot: { contexts: [] },
      active: [],
      cycleFrames: [],
      hooks: [],
    },
    loading: true,
    selectedCycleId: null,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Loading cycle history...")).toBeInTheDocument();
  },
};
