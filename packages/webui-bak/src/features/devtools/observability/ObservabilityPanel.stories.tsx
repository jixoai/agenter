import type { RuntimeAttentionState } from "@agenter/client-sdk";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";

import type {
  ApiCallItem,
  ModelCallItem,
  SchedulerInputSignals,
  SchedulerKernelState,
  SchedulerStateLogItem,
  RuntimeTraceItem,
} from "./observability-panel-data";
import { ObservabilityPanel } from "./ObservabilityPanel";

const attention: RuntimeAttentionState = {
  snapshot: {
    contexts: [
      {
        contextId: "ctx-chat-kzf",
        owner: "avatar:jane",
        content: "Need to answer kzf about the retry loop.",
        contentFormat: "text/plain",
        scoreMap: { answer001: 40 },
        headCommitId: "commit-1",
        createdAt: "2026-03-24T09:00:00.000Z",
        updatedAt: "2026-03-24T09:00:10.000Z",
        commits: [
          {
            commitId: "commit-1",
            contextId: "ctx-chat-kzf",
            parentCommitIds: [],
            meta: { author: "avatar:jane", source: "attention" },
            scores: { answer001: 40 },
            summary: "Prepare the user-facing answer",
            change: { type: "update", value: "Need to answer kzf about the retry loop.", format: "text/plain" },
            createdAt: "2026-03-24T09:00:10.000Z",
          },
        ],
      },
    ],
  },
  active: [
    {
      contextId: "ctx-chat-kzf",
      context: {
        contextId: "ctx-chat-kzf",
        owner: "avatar:jane",
        content: "Need to answer kzf about the retry loop.",
        contentFormat: "text/plain",
        scoreMap: { answer001: 40 },
        headCommitId: "commit-1",
        createdAt: "2026-03-24T09:00:00.000Z",
        updatedAt: "2026-03-24T09:00:10.000Z",
      },
      recentCommits: [],
    },
  ],
  cycleFrames: [
    {
      cycleId: 11,
      seq: 1,
      createdAt: 11,
      wakeSource: "attention",
      protocolMode: "delta",
      inputContextIds: ["ctx-chat-kzf"],
      inputCommitRefs: [{ contextId: "ctx-chat-kzf", commitId: "commit-1" }],
      activeContextIds: ["ctx-chat-kzf"],
      producedCommitRefs: [{ contextId: "ctx-chat-kzf", commitId: "commit-1" }],
      modelCallIds: [12],
      hookIds: ["hook-1"],
    },
  ],
  hooks: [
    {
      id: "hook-1",
      cycleId: 11,
      hookId: "message-bridge",
      systemId: "message",
      contextId: "ctx-chat-kzf",
      commitId: "commit-1",
      status: "delivered",
      createdAt: 12,
      target: { chatId: "chat-kzf" },
      output: { messageId: "101" },
    },
  ],
};

const kernel: SchedulerKernelState = {
  schemaVersion: 2,
  stateVersion: 5,
  running: true,
  paused: false,
  runtimeStatus: "running",
  phase: "calling_model",
  gate: "open",
  queueSize: 1,
  cycle: 11,
  sentBatches: 3,
  updatedAt: 12,
  lastMessageAt: 10,
  lastResponseAt: 11,
  lastWakeAt: 9,
  lastWakeSource: "attention",
  lastWakeCause: "score debt",
  activeContextCount: 1,
  activeItemCount: 1,
  unresolvedScoreCount: 1,
  waitingReason: null,
  nextAutoWakeAt: null,
  backoffMs: null,
  retryCount: 0,
  blockedReason: null,
  lastProgressAt: 11,
  lastError: null,
};

const inputSignals: SchedulerInputSignals = {
  user: { version: 1, timestamp: 1 },
  terminal: { version: 0, timestamp: null },
  task: { version: 0, timestamp: null },
  attention: { version: 3, timestamp: 11 },
};

const logs: SchedulerStateLogItem[] = [
  {
    id: 1,
    timestamp: 11,
    stateVersion: 5,
    event: "cycle.start",
    prevHash: null,
    stateHash: "hash-1",
    patch: [],
  },
];

const traces: RuntimeTraceItem[] = [
  {
    id: 1,
    cycleId: 11,
    seq: 1,
    traceId: "trace-1",
    spanId: "span-1",
    kind: "model.call",
    name: "respondWithMeta",
    status: "done",
    startedAt: 11,
    endedAt: 12,
    refs: [],
    links: [],
    events: [],
    attributes: {},
    outcome: { code: "done" },
  },
];

const modelCalls: ModelCallItem[] = [
  {
    id: 12,
    cycleId: 11,
    createdAt: 11,
    completedAt: 12,
    status: "done",
    provider: "openai-compatible",
    model: "deepseek-chat",
    request: { prompt: "answer kzf" },
    response: { ok: true },
    outcome: { code: "done" },
  },
];

const apiCalls: ApiCallItem[] = [
  {
    id: 1,
    modelCallId: 12,
    createdAt: 11,
    request: { url: "/v1/chat/completions" },
    response: { status: 200 },
  },
];

const meta = {
  title: "Features/Devtools/ObservabilityPanel",
  component: ObservabilityPanel,
  args: {
    stage: "running",
    kernel,
    inputSignals,
    attention,
    logs,
    traces,
    modelCalls,
    apiCalls,
    apiRecording: { enabled: true, refCount: 1 },
  },
} satisfies Meta<typeof ObservabilityPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const EventsSchedulerAndTransportStayOperable: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText("Observability")).toBeInTheDocument();
    expect(canvas.getAllByText(/Prepare the user-facing answer/i).length).toBeGreaterThan(0);

    await userEvent.click(canvas.getByRole("tab", { name: /Scheduler/i }));
    await expect(canvas.getByText(/Kernel/i)).toBeInTheDocument();

    await userEvent.click(canvas.getByRole("tab", { name: /Transport/i }));
    await expect(await canvas.findByText(/deepseek-chat/i)).toBeInTheDocument();
  },
};
