import type { Meta, StoryObj } from "@storybook/sveltekit";
import { expect, userEvent, waitFor, within } from "storybook/test";

import type { HeartbeatGroupItem, HeartbeatPartItem, ModelCallItem, RuntimeAttentionState } from "@agenter/client-sdk";

import RuntimeStageHeartbeatStoryHarness from "./runtime-stage-heartbeat.story-harness.svelte";

const baseTimestamp = Date.UTC(2026, 3, 12, 14, 25, 0);

const initialEntries = [
  {
    id: 21,
    messageId: "request_aux:systemPrompt:1",
    windowId: null,
    aiCallId: 41,
    roundIndex: 7,
    scope: "request_aux",
    role: "system",
    createdAt: baseTimestamp + 10_000,
    updatedAt: baseTimestamp + 10_000,
    isComplete: true,
    text: "You are a Linux expert. Prefer bash and skills before asking for help.",
    parts: [
      {
        partId: 21,
        partIndex: 0,
        messageId: "request_aux:systemPrompt:1",
        windowId: null,
        aiCallId: 41,
        roundIndex: 7,
        scope: "request_aux",
        role: "system",
        partType: "systemPrompt",
        mimeType: null,
        payload: "You are a Linux expert. Prefer bash and skills before asking for help.",
        createdAt: baseTimestamp + 10_000,
        updatedAt: baseTimestamp + 10_000,
        isComplete: true,
      },
    ],
  },
  {
    id: 22,
    messageId: "request_aux:tools:1",
    windowId: null,
    aiCallId: 41,
    roundIndex: 7,
    scope: "request_aux",
    role: "system",
    createdAt: baseTimestamp + 12_000,
    updatedAt: baseTimestamp + 12_000,
    isComplete: true,
    text: '[{"name":"workspace.bash"},{"name":"attention.focus"}]',
    parts: [
      {
        partId: 22,
        partIndex: 0,
        messageId: "request_aux:tools:1",
        windowId: null,
        aiCallId: 41,
        roundIndex: 7,
        scope: "request_aux",
        role: "system",
        partType: "tools",
        mimeType: null,
        payload: [{ name: "workspace.bash" }, { name: "attention.focus" }],
        createdAt: baseTimestamp + 12_000,
        updatedAt: baseTimestamp + 12_000,
        isComplete: true,
      },
    ],
  },
  {
    id: 23,
    messageId: "heartbeat-part:ai-call:41:request:0",
    windowId: null,
    aiCallId: 41,
    roundIndex: 0,
    scope: "heartbeat_part",
    role: "user",
    createdAt: baseTimestamp + 15_000,
    updatedAt: baseTimestamp + 15_000,
    isComplete: true,
    text: 'scoreMap={\"message:room-main\":1} commit=在吗？',
    parts: [
      {
        partId: 23,
        partIndex: 0,
        messageId: "heartbeat-part:ai-call:41:request:0",
        windowId: null,
        aiCallId: 41,
        roundIndex: 7,
        scope: "heartbeat_part",
        role: "user",
        partType: "text",
        mimeType: null,
        payload: {
          type: "text",
          content: 'scoreMap={"message:room-main":1} commit=在吗？',
        },
        createdAt: baseTimestamp + 15_000,
        updatedAt: baseTimestamp + 15_000,
        isComplete: true,
      },
    ],
  },
  {
    id: 24,
    messageId: "heartbeat-part:ai-call:41:compact",
    windowId: null,
    aiCallId: 41,
    roundIndex: 8,
    scope: "heartbeat_part",
    role: "system",
    createdAt: baseTimestamp + 25_000,
    updatedAt: baseTimestamp + 25_000,
    isComplete: true,
    text: "Prompt window compacted (manual). Later Heartbeat rows continue from the rebuilt context.",
    parts: [
      {
        partId: 24,
        partIndex: 0,
        messageId: "heartbeat-part:ai-call:41:compact",
        windowId: null,
        aiCallId: 41,
        roundIndex: 8,
        scope: "heartbeat_part",
        role: "system",
        partType: "compact",
        mimeType: null,
        payload: {
          type: "compact",
          text: "Prompt window compacted (manual). Later Heartbeat rows continue from the rebuilt context.",
          format: "plain",
          heartbeatKind: "compact_separator",
          compactTrigger: "manual",
          callRoundIndex: 7,
          currentRoundIndex: 8,
        },
        createdAt: baseTimestamp + 25_000,
        updatedAt: baseTimestamp + 25_000,
        isComplete: true,
      },
    ],
  },
  {
    id: 25,
    messageId: "heartbeat-part:ai-call:41:response:assistant",
    windowId: null,
    aiCallId: 41,
    roundIndex: 8,
    scope: "heartbeat_part",
    role: "assistant",
    createdAt: baseTimestamp + 45_000,
    updatedAt: baseTimestamp + 50_000,
    isComplete: false,
    text: "Gathered workspace metadata and queued the next attention follow-up.",
    parts: [
      {
        partId: 25,
        partIndex: 0,
        messageId: "heartbeat-part:ai-call:41:response:assistant",
        windowId: null,
        aiCallId: 41,
        roundIndex: 8,
        scope: "heartbeat_part",
        role: "assistant",
        partType: "thinking",
        mimeType: null,
        payload: {
          type: "thinking",
          text: "先看当前房间有没有新的 commit，再决定是否要切去 workspace。",
        },
        createdAt: baseTimestamp + 45_000,
        updatedAt: baseTimestamp + 48_000,
        isComplete: false,
      },
      {
        partId: 26,
        partIndex: 1,
        messageId: "heartbeat-part:ai-call:41:response:assistant",
        windowId: null,
        aiCallId: 41,
        roundIndex: 8,
        scope: "heartbeat_part",
        role: "assistant",
        partType: "tool_call",
        mimeType: null,
        payload: {
          invocationId: "tool-call-1",
          tool: "root_workspace_bash",
          input: {
            command:
              "attention commit '{\"contextId\":\"ctx-0x9d78659d03f3afe8b4bd2b2f48d939cee3d90d16\",\"parentCommitIds\":[\"commit-ca846a55-7bb0-402f-a85f-89e14ca618c7\"],\"egress\":{\"kind\":\"room_reply_sent\",\"chatId\":\"0x9d78659d03f3afe8b4bd2b2f48d939cee3d90d16\",\"done\":true}}'",
          },
          startedAt: baseTimestamp + 46_000,
        },
        createdAt: baseTimestamp + 46_000,
        updatedAt: baseTimestamp + 46_000,
        isComplete: true,
      },
      {
        partId: 27,
        partIndex: 2,
        messageId: "heartbeat-part:ai-call:41:response:assistant",
        windowId: null,
        aiCallId: 41,
        roundIndex: 8,
        scope: "heartbeat_part",
        role: "assistant",
        partType: "tool_result",
        mimeType: null,
        payload: {
          invocationId: "tool-call-1",
          tool: "workspace.bash",
          output: { stdout: "workspace.bash\nattention.focus" },
          error: null,
          finishedAt: baseTimestamp + 47_000,
        },
        createdAt: baseTimestamp + 47_000,
        updatedAt: baseTimestamp + 47_000,
        isComplete: true,
      },
      {
        partId: 28,
        partIndex: 3,
        messageId: "heartbeat-part:ai-call:41:response:assistant",
        windowId: null,
        aiCallId: 41,
        roundIndex: 8,
        scope: "heartbeat_part",
        role: "assistant",
        partType: "text",
        mimeType: null,
        payload: {
          type: "text",
          content: "Gathered workspace metadata and queued the next attention follow-up.",
        },
        createdAt: baseTimestamp + 48_000,
        updatedAt: baseTimestamp + 50_000,
        isComplete: false,
      },
    ],
  },
] satisfies HeartbeatPartItem[];

const olderEntries = [
  {
    id: 19,
    messageId: "request_aux:config:0",
    windowId: null,
    aiCallId: 40,
    roundIndex: 6,
    scope: "request_aux",
    role: "config",
    createdAt: baseTimestamp - 30_000,
    updatedAt: baseTimestamp - 30_000,
    isComplete: true,
    text: '{"temperature":0.2,"maxToken":512}',
    parts: [
      {
        partId: 19,
        partIndex: 0,
        messageId: "request_aux:config:0",
        windowId: null,
        aiCallId: 40,
        roundIndex: 6,
        scope: "request_aux",
        role: "config",
        partType: "config",
        mimeType: null,
        payload: { temperature: 0.2, maxToken: 512 },
        createdAt: baseTimestamp - 30_000,
        updatedAt: baseTimestamp - 30_000,
        isComplete: true,
      },
    ],
  },
  {
    id: 20,
    messageId: "heartbeat-part:ai-call:40:response:assistant",
    windowId: null,
    aiCallId: 40,
    roundIndex: 6,
    scope: "heartbeat_part",
    role: "assistant",
    createdAt: baseTimestamp - 20_000,
    updatedAt: baseTimestamp - 18_000,
    isComplete: true,
    text: "Checkpoint restored.",
    parts: [
      {
        partId: 20,
        partIndex: 0,
        messageId: "heartbeat-part:ai-call:40:response:assistant",
        windowId: null,
        aiCallId: 40,
        roundIndex: 6,
        scope: "heartbeat_part",
        role: "assistant",
        partType: "text",
        mimeType: null,
        payload: {
          type: "text",
          content: "Checkpoint restored.",
        },
        createdAt: baseTimestamp - 20_000,
        updatedAt: baseTimestamp - 18_000,
        isComplete: true,
      },
    ],
  },
] satisfies HeartbeatPartItem[];

const createHeartbeatGroupFixture = (input: {
  id: number;
  groupId: string;
  kind: HeartbeatGroupItem["kind"];
  aiCallId: number | null;
  items: HeartbeatPartItem[];
  isComplete?: boolean;
}): HeartbeatGroupItem => ({
  id: input.id,
  groupId: input.groupId,
  kind: input.kind,
  aiCallId: input.aiCallId,
  createdAt: input.items[0]?.createdAt ?? baseTimestamp,
  updatedAt: Math.max(...input.items.map((item) => item.updatedAt)),
  isComplete: input.isComplete ?? input.items.every((item) => item.isComplete),
  items: input.items,
});

const initialGroups = [
  createHeartbeatGroupFixture({
    id: 410,
    groupId: "heartbeat-group:before-call:41",
    kind: "before-call",
    aiCallId: 41,
    items: [initialEntries[0]!, initialEntries[1]!, initialEntries[2]!],
  }),
  createHeartbeatGroupFixture({
    id: 412,
    groupId: "heartbeat-group:compact:41",
    kind: "compact",
    aiCallId: 41,
    items: [initialEntries[3]!],
  }),
  createHeartbeatGroupFixture({
    id: 411,
    groupId: "heartbeat-group:call:41",
    kind: "call",
    aiCallId: 41,
    items: [initialEntries[4]!],
    isComplete: false,
  }),
] satisfies HeartbeatGroupItem[];

const olderGroups = [
  createHeartbeatGroupFixture({
    id: 400,
    groupId: "heartbeat-group:before-call:40",
    kind: "before-call",
    aiCallId: 40,
    items: [olderEntries[0]!],
  }),
  createHeartbeatGroupFixture({
    id: 401,
    groupId: "heartbeat-group:call:40",
    kind: "call",
    aiCallId: 40,
    items: [olderEntries[1]!],
  }),
] satisfies HeartbeatGroupItem[];

const cloneHeartbeatEntry = (entry: HeartbeatPartItem, cloneIndex: number): HeartbeatPartItem => {
  const offsetMs = cloneIndex * 75_000;
  return {
    ...entry,
    id: entry.id + cloneIndex * 100,
    messageId: `${entry.messageId}:clone:${cloneIndex}`,
    createdAt: entry.createdAt + offsetMs,
    updatedAt: entry.updatedAt + offsetMs,
    parts: entry.parts.map((part, partIndex) => ({
      ...part,
      partId: part.partId + cloneIndex * 1_000 + partIndex,
      messageId: `${part.messageId}:clone:${cloneIndex}`,
      createdAt: part.createdAt + offsetMs,
      updatedAt: part.updatedAt + offsetMs,
      payload: structuredClone(part.payload),
    })),
  };
};

const longStreamEntries = Array.from({ length: 18 }, (_, index) =>
  cloneHeartbeatEntry(index % 2 === 0 ? initialEntries[2] : initialEntries[4], index + 1),
).sort((left, right) => left.createdAt - right.createdAt);

const longStreamGroups = longStreamEntries.map((entry, index) =>
  createHeartbeatGroupFixture({
    id: 700 + index,
    groupId: `heartbeat-group:story:${entry.messageId}`,
    kind: entry.parts.some((part) => part.partType === "compact") ? "compact" : index % 2 === 0 ? "before-call" : "call",
    aiCallId: entry.aiCallId,
    items: [entry],
  }),
);

const streamingToolEntries = [
  {
    ...initialEntries[4],
    id: 26,
    messageId: "heartbeat-part:ai-call:42:response:assistant",
    aiCallId: 42,
    createdAt: baseTimestamp + 55_000,
    updatedAt: baseTimestamp + 56_000,
    isComplete: false,
    text: "",
    parts: [
      {
        partId: 29,
        partIndex: 0,
        messageId: "heartbeat-part:ai-call:42:response:assistant",
        windowId: null,
        aiCallId: 42,
        roundIndex: 9,
        scope: "heartbeat_part",
        role: "assistant",
        partType: "tool_call",
        mimeType: null,
        payload: {
          invocationId: "tool-call-streaming",
          tool: "root_workspace_bash",
          input: "",
          startedAt: baseTimestamp + 55_000,
        },
        createdAt: baseTimestamp + 55_000,
        updatedAt: baseTimestamp + 56_000,
        isComplete: false,
      },
    ],
  },
] satisfies HeartbeatPartItem[];

const streamingToolGroups = [
  createHeartbeatGroupFixture({
    id: 420,
    groupId: "heartbeat-group:call:42",
    kind: "call",
    aiCallId: 42,
    items: [streamingToolEntries[0]!],
    isComplete: false,
  }),
] satisfies HeartbeatGroupItem[];

const overflowingEntry = {
  id: 520,
  messageId: "heartbeat-part:ai-call:52:response:assistant",
  windowId: null,
  aiCallId: 52,
  roundIndex: 12,
  scope: "heartbeat_part",
  role: "assistant",
  createdAt: baseTimestamp + 90_000,
  updatedAt: baseTimestamp + 96_000,
  isComplete: true,
  text: "Long heartbeat explanation",
  parts: [
    {
      partId: 520,
      partIndex: 0,
      messageId: "heartbeat-part:ai-call:52:response:assistant",
      windowId: null,
      aiCallId: 52,
      roundIndex: 12,
      scope: "heartbeat_part",
      role: "assistant",
      partType: "text",
      mimeType: null,
      payload: {
        type: "text",
        content: Array.from({ length: 48 }, (_, index) =>
          `- step ${index + 1}: replayed attention evidence and workspace facts so the operator can audit the full chain without losing any durable message-parts.`,
        ).join("\n"),
      },
      createdAt: baseTimestamp + 90_000,
      updatedAt: baseTimestamp + 96_000,
      isComplete: true,
    },
  ],
} satisfies HeartbeatPartItem;

const overflowingGroups = [
  createHeartbeatGroupFixture({
    id: 520,
    groupId: "heartbeat-group:call:52",
    kind: "call",
    aiCallId: 52,
    items: [overflowingEntry],
  }),
] satisfies HeartbeatGroupItem[];

const settledModelCalls = [
  {
    id: 41,
    cycleId: 8,
    roundIndex: 8,
    kind: "model",
    status: "done",
    provider: "openai/chat",
    model: "gpt-test",
    requestUrl: "https://example.test/v1/chat/completions",
    request: {
      meta: { cycleId: 8 },
    },
    response: {
      assistant: {
        text: "Gathered workspace metadata and queued the next attention follow-up.",
      },
      usage: {
        promptTokens: 320,
        completionTokens: 152,
        totalTokens: 472,
      },
    },
    error: null,
    outcome: { code: "done" },
    createdAt: baseTimestamp + 44_000,
    updatedAt: baseTimestamp + 50_000,
    completedAt: baseTimestamp + 50_000,
    isComplete: true,
  },
] satisfies ModelCallItem[];

const streamingModelCalls = [
  {
    id: 42,
    cycleId: 9,
    roundIndex: 9,
    kind: "model",
    status: "running",
    provider: "openai/chat",
    model: "gpt-test",
    requestUrl: "https://example.test/v1/chat/completions",
    request: {
      meta: { cycleId: 9 },
    },
    response: {
      assistant: {
        text: "Still waiting for the model to settle.",
      },
    },
    error: null,
    outcome: { code: "running" },
    createdAt: baseTimestamp + 60_000,
    updatedAt: baseTimestamp + 62_000,
    completedAt: null,
    isComplete: false,
  },
] satisfies ModelCallItem[];

const attentionContexts: RuntimeAttentionState['snapshot']['contexts'] = [
			{
				contextId: "ctx-room-main",
				owner: "message",
        focusState: "focused",
        content: "Room main context",
        contentFormat: "markdown",
        scoreMap: { "message:room-main": 1 },
        headCommitId: "commit-1",
        createdAt: "2026-04-12T14:25:00.000Z",
        updatedAt: "2026-04-12T14:26:00.000Z",
        commits: [],
        commitCount: 0,
        commitsTruncated: false,
				consumedPushCommitIds: [],
			},
			{
				contextId: "ctx-workspace",
				owner: "workspace",
        focusState: "background",
        content: "Workspace context",
        contentFormat: "markdown",
        scoreMap: { workspace: 0.5 },
        headCommitId: "commit-2",
        createdAt: "2026-04-12T14:25:10.000Z",
        updatedAt: "2026-04-12T14:26:10.000Z",
        commits: [],
        commitCount: 0,
        commitsTruncated: false,
				consumedPushCommitIds: [],
			},
			{
				contextId: "ctx-terminal",
				owner: "terminal",
        focusState: "muted",
        content: "Terminal context",
        contentFormat: "markdown",
        scoreMap: {},
        headCommitId: "commit-3",
        createdAt: "2026-04-12T14:25:20.000Z",
        updatedAt: "2026-04-12T14:26:20.000Z",
        commits: [],
        commitCount: 0,
        commitsTruncated: false,
				consumedPushCommitIds: [],
			},
];

const attentionState = {
	snapshot: {
		contexts: attentionContexts,
	},
	active: [],
	cycleFrames: [],
	hooks: [],
} satisfies RuntimeAttentionState;

const meta = {
  title: "Features/Runtime/Heartbeat Stage",
  component: RuntimeStageHeartbeatStoryHarness,
  render: (args) => ({
    Component: RuntimeStageHeartbeatStoryHarness,
    props: args,
  }),
} satisfies Meta<typeof RuntimeStageHeartbeatStoryHarness>;

export default meta;

type Story = StoryObj<typeof meta>;

export const LoadingOlderKeepsHeartbeatRowsStable = {
  name: "Scenario: Given durable Heartbeat message-parts When older rows are loaded Then folded bootstrap facts compact boundaries and assistant updates stay in one stream",
  args: {
    initialGroups,
    olderGroups,
    modelCalls: settledModelCalls,
    attention: attentionState,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const stage = canvas.getByTestId("runtime-heartbeat-stage");
    const beforeCallGroup = canvas.getByTestId("runtime-heartbeat-group-410");
    const systemPromptEntry = canvas.getByTestId("runtime-heartbeat-entry-21");
    const userEntry = canvas.getByTestId("runtime-heartbeat-entry-23");
    const assistantEntry = canvas.getByTestId("runtime-heartbeat-entry-25");
    const compactEntry = canvas.getByTestId("runtime-heartbeat-entry-24");

    await expect(stage).toBeInTheDocument();
    await expect(beforeCallGroup).toHaveTextContent("Before Call #41");
    await expect(beforeCallGroup).toHaveAttribute("data-layout-mode", "compact");
    await waitFor(() => {
      const userMarkdown = userEntry.querySelector("agenter-markdown-document") as
        | (HTMLElement & { value?: string })
        | null;
      expect(userMarkdown?.value).toContain('scoreMap={"message:room-main":1} commit=在吗？');
    });
    await waitFor(() => {
      expect(compactEntry.textContent).toContain("Prompt window compacted (manual).");
    });
    expect(userEntry.textContent).not.toContain("call #41");
    expect(userEntry.textContent).not.toContain("round 0");
    expect(userEntry.textContent).not.toContain("Text");
    expect(assistantEntry.textContent).not.toContain("Text");
    expect(assistantEntry.textContent).toContain("attention commit");
    expect(within(beforeCallGroup).getAllByRole("button", { name: "Copy section" }).length).toBeGreaterThan(0);
    expect(systemPromptEntry.textContent).not.toContain(
      "You are a Linux expert. Prefer bash and skills before asking for help.",
    );
    await expect(canvas.getByTestId("runtime-heartbeat-context")).toHaveTextContent("P 320");
    await expect(canvas.getByTestId("runtime-heartbeat-shimmer")).toHaveTextContent(
      "1 focused · 1 background · 1 muted",
    );
    const viewport = canvas.getByTestId("runtime-heartbeat-viewport");
    viewport.scrollTop = 0;
    viewport.dispatchEvent(new Event("scroll"));
    const loadOlderButton = canvas.getByRole("button", { name: "Load older" });
    if (!(loadOlderButton instanceof HTMLButtonElement)) {
      throw new Error("Expected Load older button to be rendered as a button.");
    }
    loadOlderButton.click();
    viewport.scrollTop = 0;
    viewport.dispatchEvent(new Event("scroll"));
    await waitFor(() => {
      expect(canvas.getByTestId("runtime-heartbeat-group-400")).toBeInTheDocument();
      expect(canvas.getByText("7 rows")).toBeInTheDocument();
      expect(canvas.getByText("No older messages")).toBeInTheDocument();
    });
  },
} satisfies Story;

export const LayoutActionSwitchesGroupPresentation = {
  name: "Scenario: Given one heartbeat group card When the operator switches layout Then compact summary and detailed ledger views stay attached to the same group",
  args: {
    initialGroups,
    olderGroups: [],
    modelCalls: settledModelCalls,
    attention: attentionState,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const beforeCallGroup = canvas.getByTestId("runtime-heartbeat-group-410");
    const callGroup = canvas.getByTestId("runtime-heartbeat-group-411");
    const systemPromptEntry = canvas.getByTestId("runtime-heartbeat-entry-21");
    const streamingAssistantEntry = canvas.getByTestId("runtime-heartbeat-entry-25");
    const compactToolDetails = Array.from(callGroup.querySelectorAll("details")).find((details) =>
      details.textContent?.includes("root_workspace_bash"),
    );
    const compactToolSummary = compactToolDetails?.querySelector("summary");

    await expect(beforeCallGroup).toHaveAttribute("data-layout-mode", "compact");
    expect(systemPromptEntry.textContent).not.toContain(
      "You are a Linux expert. Prefer bash and skills before asking for help.",
    );
    expect(callGroup.textContent).not.toContain('{"invocationId":"tool-call-1"');
    await expect(streamingAssistantEntry).toHaveTextContent("root_workspace_bash");
    await expect(streamingAssistantEntry).toHaveTextContent("attention commit");
    await expect(canvas.getByTestId("runtime-heartbeat-entry-time-25")).toHaveTextContent(
      "2026/4/12 22:25:45, 5 sec",
    );
    await expect(canvas.getByTestId("runtime-heartbeat-entry-meta-25")).not.toHaveTextContent("Range");
    expect(within(callGroup).getAllByRole("button", { name: "Copy section" }).length).toBeGreaterThan(0);
    if (!(compactToolSummary instanceof HTMLElement) || !(compactToolDetails instanceof HTMLDetailsElement)) {
      throw new Error("Expected compact tool summary to be rendered.");
    }
    expect(compactToolDetails.open).toBe(false);

    await userEvent.click(compactToolSummary);

    await waitFor(() => {
      expect(compactToolDetails.open).toBe(true);
    });
    await expect(callGroup).toHaveTextContent("command:");

    await userEvent.click(within(systemPromptEntry).getByRole("radio", { name: "Detailed" }));

    await expect(beforeCallGroup).toHaveAttribute("data-layout-mode", "detailed");
    await waitFor(() => {
      const systemPromptMarkdown = systemPromptEntry.querySelector("agenter-markdown-document") as
        | (HTMLElement & { value?: string })
        | null;
      expect(systemPromptMarkdown?.value).toContain(
        "You are a Linux expert. Prefer bash and skills before asking for help.",
      );
    });
    await expect(beforeCallGroup).toHaveTextContent("Compact");
  },
} satisfies Story;

export const StickyBottomKeepsLatestRowsReachable = {
  name: "Scenario: Given a long virtualized Heartbeat stream When the operator scrolls away Then the stage exposes Scroll to latest and returns to the newest rows",
  args: {
    initialGroups: longStreamGroups,
    olderGroups: [],
    modelCalls: settledModelCalls,
    attention: attentionState,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const viewport = canvas.getByTestId("runtime-heartbeat-viewport");
    const firstEntry = longStreamEntries[0];
    const lastEntry = longStreamEntries[longStreamEntries.length - 1];
    if (!firstEntry || !lastEntry) {
      throw new Error("Long stream fixtures are missing.");
    }

    await waitFor(() => {
      expect(canvas.queryByTestId(`runtime-heartbeat-entry-${lastEntry.id}`)).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(canvas.queryByTestId(`runtime-heartbeat-entry-${firstEntry.id}`)).not.toBeInTheDocument();
    });
    await waitFor(() => {
      expect(viewport.scrollHeight).toBeGreaterThan(viewport.clientHeight);
    });

    viewport.scrollTop = 0;
    viewport.dispatchEvent(new Event("scroll"));

    await waitFor(() => {
      expect(canvas.getByRole("button", { name: "Scroll to latest" })).toBeInTheDocument();
      expect(canvas.getByTestId(`runtime-heartbeat-entry-${firstEntry.id}`)).toBeInTheDocument();
    });

    await userEvent.click(canvas.getByRole("button", { name: "Scroll to latest" }));

    await waitFor(() => {
      expect(canvas.queryByTestId(`runtime-heartbeat-entry-${lastEntry.id}`)).toBeInTheDocument();
    });
  },
} satisfies Story;

export const RunningFooterShowsShimmerWithoutUsage = {
  name: "Scenario: Given a running AI call without usage When the Heartbeat footer renders Then shimmer stays active while context falls back to disabled",
  args: {
    initialGroups,
    olderGroups: [],
    modelCalls: streamingModelCalls,
    attention: attentionState,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId("runtime-heartbeat-shimmer")).toHaveAttribute("data-running", "true");
    await expect(canvas.getByTestId("runtime-heartbeat-shimmer")).toHaveTextContent("Waiting for AI call");
    await expect(canvas.getByTestId("runtime-heartbeat-context")).toHaveAttribute("data-context-state", "unavailable");
    await expect(canvas.getByTestId("runtime-heartbeat-context")).toHaveTextContent("Latest usage unavailable");
  },
} satisfies Story;

export const StreamingToolCallRemainsVisible = {
  name: "Scenario: Given a running Heartbeat tool call has no result yet When the stage renders Then the tool row stays visible without empty-string parameter chrome",
  args: {
    initialGroups: streamingToolGroups,
    olderGroups: [],
    modelCalls: streamingModelCalls,
    attention: attentionState,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const entry = canvas.getByTestId("runtime-heartbeat-entry-26");
    await expect(entry).toBeInTheDocument();
    await expect(entry).toHaveTextContent("root_workspace_bash");
    await expect(entry).toHaveTextContent("Pending");
    expect(entry.textContent).not.toContain("Completed");
    expect(entry.textContent).not.toContain("Parameters");
  },
} satisfies Story;

export const EmptyLedgerShowsExplicitState = {
  name: "Scenario: Given no persisted Heartbeat rows When the stage opens Then the operator sees an explicit empty state instead of a blank panel",
  args: {
    initialGroups: [],
    olderGroups: [],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const stage = canvas.getByTestId("runtime-heartbeat-stage");

    await expect(stage).toBeInTheDocument();
    await waitFor(() => {
      expect(canvas.getByTestId("runtime-heartbeat-empty")).toBeInTheDocument();
    });
    await expect(canvas.getByText("No Heartbeat rows yet")).toBeInTheDocument();
  },
} satisfies Story;

export const OverflowingCardCanExpand = {
  name: "Scenario: Given an overflowing heartbeat card When the operator expands it Then the card grows beyond the default max height and can collapse back",
  args: {
    initialGroups: overflowingGroups,
    olderGroups: [],
    modelCalls: settledModelCalls,
    attention: attentionState,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const entry = canvas.getByTestId("runtime-heartbeat-entry-520") as HTMLElement;
    const body = canvas.getByTestId("runtime-heartbeat-entry-body-520") as HTMLElement;

    await waitFor(() => {
      expect(body.dataset.overflowState).toBe("collapsed");
    });

    const collapsedHeight = entry.getBoundingClientRect().height;
    const expandButton = within(entry).getByRole("button", { name: "Expand" });
    await userEvent.click(expandButton);

    await waitFor(() => {
      expect(body.dataset.overflowState).toBe("expanded");
      expect(within(entry).getByRole("button", { name: "Collapse" })).toBeInTheDocument();
    });

    const expandedHeight = entry.getBoundingClientRect().height;
    expect(expandedHeight).toBeGreaterThan(collapsedHeight + 32);

    await userEvent.click(within(entry).getByRole("button", { name: "Collapse" }));

    await waitFor(() => {
      expect(body.dataset.overflowState).toBe("collapsed");
      expect(within(entry).getByRole("button", { name: "Expand" })).toBeInTheDocument();
    });
  },
} satisfies Story;
