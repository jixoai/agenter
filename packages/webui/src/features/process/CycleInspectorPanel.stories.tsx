import type {
  ModelCallDeltaItem,
  ModelCallItem,
  ObservabilityTraceItem,
  RuntimeAttentionState,
  RuntimeChatCycle,
} from "@agenter/client-sdk";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";

import type { AttentionSelectionState } from "../attention/attention-view-model";
import { CycleInspectorDetail } from "./CycleInspectorDetail";
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
      change: {
        type: "update" as const,
        value: "Investigate the repeated retry burst in stderr.",
        format: "text/plain",
      },
      createdAt: "2026-03-24T09:00:00.000Z",
    },
    {
      commitId: "commit-42",
      contextId: "ctx-terminal-iflow",
      parentCommitIds: ["commit-41"],
      meta: { author: "user:kzf", source: "message", createdAt: "2026-03-24T09:00:10.000Z" },
      scores: { answer001: 18 },
      summary: "User only asked for the root cause",
      change: {
        type: "update" as const,
        value: "Keep the answer concise and focused on the root cause.",
        format: "text/plain",
      },
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
      change: {
        type: "update" as const,
        value: "The retry burst comes from the deploy watcher retry loop.",
        format: "text/plain",
      },
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
      protocolMode: "bootstrap",
      inputContextIds: ["ctx-terminal-iflow", "ctx-chat-kzf"],
      inputCommitRefs: [
        { contextId: "ctx-terminal-iflow", commitId: "commit-42" },
        { contextId: "ctx-chat-kzf", commitId: "commit-chat-1" },
      ],
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
      protocolMode: "delta",
      inputContextIds: ["ctx-chat-kzf"],
      inputCommitRefs: [{ contextId: "ctx-chat-kzf", commitId: "commit-chat-1" }],
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
        content: ["```yaml", "invocationId: terminal-read-11", "tool: terminal_read", "status: success", "```"].join(
          "\n",
        ),
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
    request: {
      systemPrompt: "You are a concise debugging assistant.",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Please inspect the terminal diff." },
            { type: "text", text: "Focus on the retry burst only." },
          ],
        },
        { role: "assistant", content: "Working on it." },
      ],
      tools: [{ name: "terminal_read", description: "Read terminal output" }],
    },
    response: {
      decision: {
        kind: "model",
        attentionRound: true,
        attentionMutation: true,
        toolTraceCount: 2,
        promptWindowText: false,
      },
      usage: {
        promptTokens: 321,
        completionTokens: 74,
        totalTokens: 395,
      },
      assistant: {
        thinking: "Need one terminal read, then summarize the root cause directly.",
        text: "The retry burst comes from the deploy watcher retry loop.",
        finishReason: "stop",
      },
      toolTrace: [
        {
          invocationId: "terminal-read-11",
          tool: "terminal_read",
          input: { terminalId: "iflow" },
          output: {
            terminalId: "iflow",
            kind: "diff",
            seq: 18,
            cols: 120,
            rows: 30,
          },
          startedAt: 12,
          finishedAt: 12,
        },
        {
          invocationId: "media-gen-11",
          tool: "media_generate",
          input: { prompt: "visualize retry burst timeline", formats: ["image", "audio", "video", "file"] },
          output: {
            assets: [
              { kind: "image", url: "image://retry-burst.webp" },
              { kind: "audio", url: "audio://retry-burst.mp3" },
              { kind: "video", url: "video://retry-burst.mp4" },
              { kind: "file", url: "file://retry-burst-report.md" },
            ],
          },
          startedAt: 12,
          finishedAt: 13,
        },
      ],
    },
    outcome: { code: "done" },
  },
  {
    id: 13,
    cycleId: 12,
    createdAt: 14,
    status: "running",
    provider: "openai-compatible",
    model: "deepseek-chat",
    request: {
      systemPrompt: "Continue from attention debt.",
      messages: [{ role: "user", content: "Continue tracing." }],
      tools: [{ name: "terminal_read", description: "Read terminal output" }],
    },
  },
];

const modelCallDeltas: ModelCallDeltaItem[] = [
  {
    id: 1,
    seq: 1,
    modelCallId: 13,
    cycleId: 12,
    timestamp: 15,
    kind: "assistant_draft",
    data: { content: "Still tracing the remaining answer debt..." },
  },
  {
    id: 2,
    seq: 2,
    modelCallId: 13,
    cycleId: 12,
    timestamp: 16,
    kind: "tool_call",
    data: {
      toolCallId: "tool-continue-1",
      toolName: "terminal_read",
      input: { terminalId: "iflow", mode: "diff" },
      argsText: '{"terminalId":"iflow","mode":"diff"}',
    },
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
    modelCallDeltas,
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
    const maybeOpenPanel = canvas.queryByRole("button", { name: /Open Panel/i });
    const panelRoot = maybeOpenPanel ? within(document.body) : canvas;
    if (maybeOpenPanel) {
      await userEvent.click(maybeOpenPanel);
    }

    await expect(canvas.getByText("Cycles")).toBeInTheDocument();
    await expect(canvas.getByText(/Model conversation/i)).toBeInTheDocument();
    const transcript = await canvas.findByTestId("cycle-modelcall-transcript");
    const inputRow = canvas
      .getByText(/Please inspect the terminal diff/i)
      .closest("[data-cycle-transcript-lane='input']");
    await expect(inputRow).toBeInTheDocument();
    await expect(canvas.getByText(/Focus on the retry burst only/i)).toBeInTheDocument();
    await expect(canvas.getByText(/The retry burst comes from the deploy watcher retry loop/i)).toBeInTheDocument();
    const outputRow = canvas
      .getByText(/The retry burst comes from the deploy watcher retry loop/i)
      .closest("[data-cycle-transcript-lane='output']");
    await expect(outputRow).toBeInTheDocument();
    expect(transcript.querySelectorAll("[data-cycle-transcript-kind='tool']").length).toBeGreaterThan(0);
    await expect(canvas.getByText(/image:\/\/retry-burst.webp/i)).toBeInTheDocument();
    await userEvent.click(await panelRoot.findByRole("tab", { name: /Config/i }));
    await expect(await panelRoot.findByText(/System prompt/i)).toBeInTheDocument();
  },
};

export const ConversationPaneCanCollapseToRail: Story = {
  render: (args) => {
    const selectedCycle = args.cycles.find((cycle) => cycle.id === args.selectedCycleId) ?? args.cycles[0];
    if (!selectedCycle) {
      return null;
    }

    return (
      <div className="min-w-[1440px] space-y-3 p-6">
        <div className="h-[760px]">
          <CycleInspectorDetail
            cycle={selectedCycle}
            attention={args.attention}
            modelCalls={args.modelCalls}
            modelCallDeltas={args.modelCallDeltas}
            traces={args.traces}
            compactViewportOverride={false}
          />
        </div>
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const conversationPane = await canvas.findByTestId("cycle-modelcall-pane");
    await expect(conversationPane).toHaveAttribute("data-cycle-conversation-collapsed", "false");

    await userEvent.click(await canvas.findByRole("button", { name: /Collapse model conversation/i }));
    await expect(await canvas.findByTestId("cycle-modelcall-pane")).toHaveAttribute(
      "data-cycle-conversation-collapsed",
      "true",
    );
    await expect(canvas.queryByTestId("cycle-modelcall-transcript")).not.toBeInTheDocument();

    await userEvent.click(await canvas.findByRole("button", { name: /Expand model conversation/i }));
    await expect(await canvas.findByTestId("cycle-modelcall-pane")).toHaveAttribute(
      "data-cycle-conversation-collapsed",
      "false",
    );
    await expect(await canvas.findByTestId("cycle-modelcall-transcript")).toBeInTheDocument();
  },
};

export const StreamingCycleState: Story = {
  args: {
    selectedCycleId: "cycle:12",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByRole("button", { name: /Cycle 12/i })).toBeInTheDocument();
    await expect(await canvas.findByText(/Continue tracing/i)).toBeInTheDocument();
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
    await expect(await documentCanvas.findByText(/Model conversation/i)).toBeInTheDocument();
    await expect(await documentCanvas.findByTestId("cycle-modelcall-transcript")).toBeInTheDocument();
    await userEvent.click(await documentCanvas.findByTestId("sheet-backdrop"));
    await waitFor(() => {
      expect(documentCanvas.queryByRole("dialog")).not.toBeInTheDocument();
    });
  },
};

export const MultiContextAttentionRefsStayReadable: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const maybeOpenPanel = canvas.queryByRole("button", { name: /Open Panel/i });
    const panelRoot = maybeOpenPanel ? within(document.body) : canvas;
    if (maybeOpenPanel) {
      await userEvent.click(maybeOpenPanel);
    }

    await userEvent.click(await panelRoot.findByRole("tab", { name: /Attention I\/O/i }));
    await expect((await panelRoot.findAllByText(/ctx-terminal-iflow/i)).length).toBeGreaterThan(0);
    await expect((await panelRoot.findAllByText(/ctx-chat-kzf/i)).length).toBeGreaterThan(0);
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
