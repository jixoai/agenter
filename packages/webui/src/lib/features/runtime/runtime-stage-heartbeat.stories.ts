import {
  BOTTOM_ANCHORED_INSERT_MOTION_CLEAR_DELAY_MS,
  BOTTOM_ANCHORED_INSERT_MOTION_DURATION_MS,
  getBottomAnchoredDistanceToLatest,
  getBottomAnchoredDistanceToStart,
  getBottomAnchoredStartScrollTop,
} from "@agenter/svelte-components";
import type { Meta, StoryObj } from "@storybook/sveltekit";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import type {
	HeartbeatGroupItem,
	HeartbeatPartItem,
	ModelCallItem,
	RuntimeAttentionDeliveryState,
	RuntimeAttentionState,
	RuntimeSchedulerState,
} from "@agenter/client-sdk";

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
          tool: "root_bash",
          input: {
            workspaceAlias: "root",
            command:
              'attention commit \'{"contextId":"ctx-0x9d78659d03f3afe8b4bd2b2f48d939cee3d90d16","parentCommitIds":["commit-ca846a55-7bb0-402f-a85f-89e14ca618c7"],"egress":{"kind":"room_reply_sent","chatId":"0x9d78659d03f3afe8b4bd2b2f48d939cee3d90d16","done":true}}\'',
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

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

const createPlaygroundSequenceLabel = (sequence: number): string => `[Playground #${sequence}]`;

const createPlaygroundAiCallId = (sequence: number): number => 1_000 + sequence;

const prefixPlaygroundLabel = (value: string, sequence: number): string =>
  `${createPlaygroundSequenceLabel(sequence)} ${value}`;

const annotateHeartbeatPartPayloadForPlayground = (
  part: HeartbeatPartItem["parts"][number],
  sequence: number,
): HeartbeatPartItem["parts"][number]["payload"] => {
  switch (part.partType) {
    case "text":
    case "thinking": {
      if (
        !isRecord(part.payload) ||
        (typeof part.payload.content !== "string" && typeof part.payload.text !== "string")
      ) {
        return part.payload;
      }
      if (typeof part.payload.content === "string") {
        return {
          ...part.payload,
          content: prefixPlaygroundLabel(part.payload.content, sequence),
        };
      }
      return {
        ...part.payload,
        text: prefixPlaygroundLabel(String(part.payload.text), sequence),
      };
    }
    case "compact": {
      if (!isRecord(part.payload) || typeof part.payload.text !== "string") {
        return part.payload;
      }
      return {
        ...part.payload,
        text: prefixPlaygroundLabel(part.payload.text, sequence),
      };
    }
    case "tool_call": {
      if (!isRecord(part.payload)) {
        return part.payload;
      }
      const input = part.payload.input;
      if (!isRecord(input) || typeof input.command !== "string") {
        return part.payload;
      }
      return {
        ...part.payload,
        input: {
          ...input,
          command: `printf '%s\\n' "${createPlaygroundSequenceLabel(sequence)}";\n${input.command}`,
        },
      };
    }
    case "config": {
      if (!isRecord(part.payload)) {
        return part.payload;
      }
      return {
        ...part.payload,
        playgroundSequence: sequence,
      };
    }
    default:
      return part.payload;
  }
};

const annotateHeartbeatGroupForPlayground = (group: HeartbeatGroupItem, sequence: number): HeartbeatGroupItem => {
  const aiCallId = group.aiCallId === null ? null : createPlaygroundAiCallId(sequence);
  return {
    ...group,
    aiCallId,
    items: group.items.map((item) => ({
      ...item,
      aiCallId,
      text: prefixPlaygroundLabel(item.text, sequence),
      parts: item.parts.map((part) => ({
        ...part,
        aiCallId,
        payload: annotateHeartbeatPartPayloadForPlayground(part, sequence),
      })),
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
    kind: entry.parts.some((part) => part.partType === "compact")
      ? "compact"
      : index % 2 === 0
        ? "before-call"
        : "call",
    aiCallId: entry.aiCallId,
    items: [entry],
  }),
);

const createToolCallEntryFixture = (input: {
  id: number;
  aiCallId: number;
  invocationId: string;
  messageSuffix: string;
  createdAt: number;
  updatedAt: number;
  command: string;
  stdin?: string;
  isComplete?: boolean;
}): HeartbeatPartItem => ({
  id: input.id,
  messageId: `heartbeat-part:ai-call:${input.aiCallId}:response:${input.messageSuffix}`,
  windowId: null,
  aiCallId: input.aiCallId,
  roundIndex: 9,
  scope: "heartbeat_part",
  role: "assistant",
  createdAt: input.createdAt,
  updatedAt: input.updatedAt,
  isComplete: input.isComplete ?? false,
  text: input.command,
  parts: [
    {
      partId: input.id,
      partIndex: 0,
      messageId: `heartbeat-part:ai-call:${input.aiCallId}:response:${input.messageSuffix}`,
      windowId: null,
      aiCallId: input.aiCallId,
      roundIndex: 9,
      scope: "heartbeat_part",
      role: "assistant",
      partType: "tool_call",
      mimeType: null,
      payload: {
        invocationId: input.invocationId,
        tool: "root_bash",
        input: {
          workspaceAlias: "root",
          command: input.command,
          stdin: input.stdin,
        },
        startedAt: input.createdAt,
      },
      createdAt: input.createdAt,
      updatedAt: input.updatedAt,
      isComplete: input.isComplete ?? false,
    },
  ],
});

const largeToolCallCommand = Array.from(
  { length: 36 },
  (_, index) => `echo "scroll-anchor proof line ${index.toString().padStart(2, "0")}";`,
).join("\n");
const largeToolCallStdin = JSON.stringify(
  {
    task: "scroll-anchor-proof",
    checklist: Array.from({ length: 24 }, (_, index) => `step-${index.toString().padStart(2, "0")}`),
    notes: Array.from({ length: 12 }, (_, index) => ({
      index,
      text: `This is a deliberately oversized parameter block for virtual measurement drift ${index}.`,
    })),
  },
  null,
  2,
);

const appendedBottomAnchorGroup = createHeartbeatGroupFixture({
  id: 920,
  groupId: "heartbeat-group:story:append-bottom-anchor",
  kind: "call",
  aiCallId: 92,
  isComplete: false,
  items: [
    createToolCallEntryFixture({
      id: 920,
      aiCallId: 92,
      invocationId: "bottom-anchor-append",
      messageSuffix: "append-bottom-anchor",
      createdAt: baseTimestamp + 9_000_000,
      updatedAt: baseTimestamp + 9_000_000,
      command: largeToolCallCommand,
      stdin: largeToolCallStdin,
    }),
  ],
});

const growingBottomAnchorBaseGroup = createHeartbeatGroupFixture({
  id: 930,
  groupId: "heartbeat-group:story:growing-bottom-anchor",
  kind: "call",
  aiCallId: 93,
  isComplete: false,
  items: [
    createToolCallEntryFixture({
      id: 930,
      aiCallId: 93,
      invocationId: "bottom-anchor-grow",
      messageSuffix: "grow-bottom-anchor",
      createdAt: baseTimestamp + 9_100_000,
      updatedAt: baseTimestamp + 9_100_000,
      command: "echo 'compact preview before growth';",
      stdin: JSON.stringify({ task: "bottom-anchor-grow", mode: "before" }, null, 2),
    }),
  ],
});

const growingBottomAnchorExpandedGroup = createHeartbeatGroupFixture({
  id: growingBottomAnchorBaseGroup.id,
  groupId: growingBottomAnchorBaseGroup.groupId,
  kind: growingBottomAnchorBaseGroup.kind,
  aiCallId: growingBottomAnchorBaseGroup.aiCallId,
  isComplete: false,
  items: [
    createToolCallEntryFixture({
      id: 930,
      aiCallId: 93,
      invocationId: "bottom-anchor-grow",
      messageSuffix: "grow-bottom-anchor",
      createdAt: baseTimestamp + 9_100_000,
      updatedAt: baseTimestamp + 9_101_000,
      command: `${largeToolCallCommand}\necho 'after-growth marker';`,
      stdin: largeToolCallStdin,
    }),
  ],
});

const bottomAnchorGrowthGroups = [...longStreamGroups.slice(0, -1), growingBottomAnchorBaseGroup];

const cloneHeartbeatGroupAtTime = (
  template: HeartbeatGroupItem,
  sequence: number,
  targetCreatedAt: number,
): HeartbeatGroupItem => {
  const timeDelta = targetCreatedAt - template.createdAt;
  const groupClone = structuredClone(template);
  return annotateHeartbeatGroupForPlayground(
    {
      ...groupClone,
      id: groupClone.id + sequence * 10_000,
      groupId: `${groupClone.groupId}:playground:${sequence}`,
      createdAt: groupClone.createdAt + timeDelta,
      updatedAt: groupClone.updatedAt + timeDelta,
      items: groupClone.items.map((item, itemIndex) => ({
        ...item,
        id: item.id + sequence * 10_000 + itemIndex,
        messageId: `${item.messageId}:playground:${sequence}:${itemIndex}`,
        createdAt: item.createdAt + timeDelta,
        updatedAt: item.updatedAt + timeDelta,
        parts: item.parts.map((part, partIndex) => ({
          ...part,
          partId: part.partId + sequence * 100_000 + partIndex,
          messageId: `${part.messageId}:playground:${sequence}:${itemIndex}:${partIndex}`,
          createdAt: part.createdAt + timeDelta,
          updatedAt: part.updatedAt + timeDelta,
        })),
      })),
    },
    sequence,
  );
};

const createInteractiveLatestGroup = ({
  count,
  sequence,
  groups,
}: {
  count: number;
  sequence: number;
  groups: readonly HeartbeatGroupItem[];
}): HeartbeatGroupItem => {
  const latestTimestamp = groups[groups.length - 1]?.updatedAt ?? baseTimestamp;
  return cloneHeartbeatGroupAtTime(appendedBottomAnchorGroup, sequence, latestTimestamp + sequence * 180_000);
};

const createInteractiveOlderGroup = ({
  count,
  sequence,
  groups,
}: {
  count: number;
  sequence: number;
  groups: readonly HeartbeatGroupItem[];
}): HeartbeatGroupItem => {
  const oldestTimestamp = groups[0]?.createdAt ?? baseTimestamp;
  const template = olderGroups[(count - 1) % olderGroups.length] ?? olderGroups[0] ?? appendedBottomAnchorGroup;
  return cloneHeartbeatGroupAtTime(template, sequence, oldestTimestamp - sequence * 180_000);
};

const createInteractiveLatestGrowthGroup = ({
  count,
  sequence,
  groups,
}: {
  count: number;
  sequence: number;
  groups: readonly HeartbeatGroupItem[];
}): HeartbeatGroupItem => {
  const latestGroup = groups[groups.length - 1] ?? growingBottomAnchorBaseGroup;
  const latestTimestamp = latestGroup.updatedAt;
  return annotateHeartbeatGroupForPlayground(
    {
      ...structuredClone(growingBottomAnchorExpandedGroup),
      id: latestGroup.id,
      groupId: latestGroup.groupId,
      createdAt: latestGroup.createdAt,
      updatedAt: latestTimestamp + count * 1_000,
    },
    sequence,
  );
};

const getViewportDistanceToLatest = (viewport: HTMLElement): number => getBottomAnchoredDistanceToLatest(viewport);
const getViewportDistanceToStart = (viewport: HTMLElement): number => getBottomAnchoredDistanceToStart(viewport);
const describeViewportMetrics = (viewport: HTMLElement, root: HTMLElement): string =>
  JSON.stringify({
    scrollTop: viewport.scrollTop,
    clientHeight: viewport.clientHeight,
    scrollHeight: viewport.scrollHeight,
    distanceToLatest: getViewportDistanceToLatest(viewport),
    distanceToStart: getViewportDistanceToStart(viewport),
    storyGroupCount:
      root.querySelector<HTMLElement>('[data-testid="runtime-heartbeat-story-count"]')?.textContent ?? null,
    mountedIndexes: Array.from(root.querySelectorAll<HTMLElement>(".scroll-view-virtual-item[data-source-index]")).map(
      (node) => Number(node.dataset.sourceIndex ?? "-1"),
    ),
  });

const findInsertMotion = (node: HTMLElement | null): string | null =>
  node?.closest<HTMLElement>("[data-insert-motion]")?.dataset.insertMotion ?? null;
const waitForAnimationFrame = async (): Promise<void> =>
  new Promise((resolve) => {
    requestAnimationFrame(() => {
      resolve();
    });
  });
const waitForTwoAnimationFrames = async (): Promise<void> => {
  await waitForAnimationFrame();
  await waitForAnimationFrame();
};
const waitForViewportSettle = async (viewport: HTMLElement): Promise<void> => {
  let stableFrames = 0;
  let lastSignature = "";
  for (let index = 0; index < 12; index += 1) {
    await waitForAnimationFrame();
    const nextSignature = `${viewport.scrollTop}:${viewport.scrollHeight}`;
    if (nextSignature === lastSignature) {
      stableFrames += 1;
      if (stableFrames >= 2) {
        return;
      }
      continue;
    }
    lastSignature = nextSignature;
    stableFrames = 0;
  }
};
const waitForInsertMotionCleanup = async (): Promise<void> =>
  new Promise((resolve) => {
    window.setTimeout(resolve, BOTTOM_ANCHORED_INSERT_MOTION_CLEAR_DELAY_MS + 80);
  });
const playgroundCallPattern = /Call #(\d+)/g;
const getVisibleHeartbeatGroups = (root: HTMLElement, viewport: HTMLElement): HTMLElement[] => {
  const viewportRect = viewport.getBoundingClientRect();
  return Array.from(root.querySelectorAll<HTMLElement>('[data-testid^="runtime-heartbeat-group-"]')).filter((node) => {
    const rect = node.getBoundingClientRect();
    return rect.bottom > viewportRect.top + 8 && rect.top < viewportRect.bottom - 8;
  });
};
const parsePlaygroundCallNumbers = (text: string): number[] =>
  Array.from(text.matchAll(playgroundCallPattern), (match) => Number(match[1])).filter(Number.isFinite);
const readVisiblePlaygroundCallNumbers = (root: HTMLElement, viewport: HTMLElement): number[] =>
  getVisibleHeartbeatGroups(root, viewport)
    .flatMap((node) => parsePlaygroundCallNumbers(node.textContent ?? ""))
    .sort((left, right) => left - right);
const readTrailingVisiblePlaygroundCall = (root: HTMLElement, viewport: HTMLElement): number | null => {
  const viewportRect = viewport.getBoundingClientRect();
  const candidates = getVisibleHeartbeatGroups(root, viewport)
    .map((node) => {
      const callNumbers = parsePlaygroundCallNumbers(node.textContent ?? "");
      if (callNumbers.length === 0) {
        return null;
      }
      const rect = node.getBoundingClientRect();
      return {
        call: Math.max(...callNumbers),
        bottom: Math.min(rect.bottom, viewportRect.bottom),
      };
    })
    .filter((candidate): candidate is { call: number; bottom: number } => candidate !== null)
    .sort((left, right) => right.bottom - left.bottom || right.call - left.call);
  return candidates[0]?.call ?? null;
};
const readCenteredVisibleHeartbeatGroupTestId = (root: HTMLElement, viewport: HTMLElement): string | null => {
  const viewportRect = viewport.getBoundingClientRect();
  const viewportCenter = viewportRect.top + viewportRect.height / 2;
  const candidates = getVisibleHeartbeatGroups(root, viewport)
    .map((node) => {
      const rect = node.getBoundingClientRect();
      const visibleTop = Math.max(rect.top, viewportRect.top);
      const visibleBottom = Math.min(rect.bottom, viewportRect.bottom);
      return {
        testId: node.dataset.testid ?? null,
        centerDistance: Math.abs((visibleTop + visibleBottom) / 2 - viewportCenter),
      };
    })
    .filter((candidate): candidate is { testId: string; centerDistance: number } => candidate.testId !== null)
    .sort((left, right) => left.centerDistance - right.centerDistance);
  return candidates[0]?.testId ?? null;
};
const readHeartbeatGroupTop = (root: HTMLElement, testId: string): number | null => {
  const element = root.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  return element ? element.getBoundingClientRect().top : null;
};
const readHeartbeatGroupNode = (root: HTMLElement, testId: string): HTMLElement | null =>
  root.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
const readHeartbeatEntryNode = (root: HTMLElement, testId: string): HTMLElement | null =>
  readHeartbeatGroupNode(root, testId)?.querySelector<HTMLElement>('[data-testid^="runtime-heartbeat-entry-"]') ?? null;
const readHeartbeatNodeByTestId = (root: HTMLElement, testId: string): HTMLElement | null =>
  root.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
const readHeartbeatNodesByTestId = (root: HTMLElement, testId: string): HTMLElement[] =>
  Array.from(root.querySelectorAll<HTMLElement>(`[data-testid="${testId}"]`));
const readHeartbeatGroupRowTop = (root: HTMLElement, testId: string): number | null => {
  const element = root.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  const row = element?.closest<HTMLElement>("[data-anchored-row-key]");
  return row ? row.getBoundingClientRect().top : null;
};
const captureHeartbeatGroupTopSamples = async (
  root: HTMLElement,
  testId: string,
  frameCount = 32,
): Promise<number[]> => {
  const samples: number[] = [];
  for (let frame = 0; frame < frameCount; frame += 1) {
    const top = readHeartbeatGroupTop(root, testId);
    if (top !== null) {
      samples.push(top);
    }
    await waitForAnimationFrame();
  }
  return samples;
};
const captureDistanceToLatestSamples = async (viewport: HTMLElement, frameCount = 32): Promise<number[]> => {
  const samples: number[] = [];
  for (let frame = 0; frame < frameCount; frame += 1) {
    samples.push(getViewportDistanceToLatest(viewport));
    await waitForAnimationFrame();
  }
  return samples;
};
const waitForPlaygroundAppendSettle = async (input: {
  canvas: ReturnType<typeof within>;
  viewport: HTMLElement;
  appendButton: HTMLElement;
  expectedCall: number;
}): Promise<void> => {
  await waitFor(() => {
    expect(input.canvas.getByText(`Call #${input.expectedCall}`)).toBeInTheDocument();
  });
  await waitFor(() => {
    expect(input.appendButton).not.toBeDisabled();
  });
  await waitFor(
    () => {
      expect(getViewportDistanceToLatest(input.viewport)).toBeLessThanOrEqual(48);
    },
    {
      timeout: BOTTOM_ANCHORED_INSERT_MOTION_DURATION_MS + 1_200,
    },
  );
};
const captureTrailingPlaygroundCallSamples = async (
  root: HTMLElement,
  viewport: HTMLElement,
  expectedCall: number,
): Promise<number[]> => {
  const samples: number[] = [];
  for (let frame = 0; frame < 220; frame += 1) {
    const current = readTrailingVisiblePlaygroundCall(root, viewport);
    if (current !== null) {
      samples.push(current);
    }
    const visibleCalls = readVisiblePlaygroundCallNumbers(root, viewport);
    if (visibleCalls.includes(expectedCall) && getViewportDistanceToLatest(viewport) <= 48) {
      for (let settleFrame = 0; settleFrame < 10; settleFrame += 1) {
        await waitForAnimationFrame();
        const next = readTrailingVisiblePlaygroundCall(root, viewport);
        if (next !== null) {
          samples.push(next);
        }
      }
      return samples;
    }
    await waitForAnimationFrame();
  }
  throw new Error(`Timed out waiting for Call #${expectedCall} to settle: ${describeViewportMetrics(viewport, root)}`);
};

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
          tool: "root_bash",
          input: {
            workspaceAlias: "root",
            command: 'message send --compact \'["room-main","COMPACT-OK"]\'',
          },
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
        content: Array.from(
          { length: 48 },
          (_, index) =>
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
    providerSnapshot: {
      providerId: "default",
      apiStandard: "openai-responses",
      vendor: "openai",
      profile: null,
      model: "gpt-test",
      maxContextTokens: 128_000,
    },
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
    providerSnapshot: {
      providerId: "default",
      apiStandard: "openai-responses",
      vendor: "openai",
      profile: null,
      model: "gpt-test",
      maxContextTokens: 128_000,
    },
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

const attentionContexts: RuntimeAttentionState["snapshot"]["contexts"] = [
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

const dispatchingDeliveryState = {
	projections: [
		{
			contextId: 'ctx-room-main',
			commitId: 'commit-room-main-1',
			state: 'dispatching',
			attemptCount: 1,
			latestDispatchId: 'dispatch-room-main-1',
			latestReceiptId: null,
			agentCallId: 'agent-call-41',
			sessionModelCallId: 42,
			firstAcceptedAt: null,
			latestReceiptAt: null,
			latestError: null,
		},
	],
	dispatches: [
		{
			dispatchId: 'dispatch-room-main-1',
			contextId: 'ctx-room-main',
			commitId: 'commit-room-main-1',
			cycleId: 9,
			attemptIndex: 1,
			agentCallId: 'agent-call-41',
			sessionModelCallId: 42,
			createdAt: baseTimestamp + 44_500,
		},
	],
	receipts: [],
} satisfies RuntimeAttentionDeliveryState;

const firstErrorDeliveryState = {
	projections: [
		{
			contextId: 'ctx-room-main',
			commitId: 'commit-room-main-err',
			state: 'errored',
			attemptCount: 1,
			latestDispatchId: 'dispatch-room-main-err-1',
			latestReceiptId: 'receipt-room-main-err-1',
			agentCallId: 'agent-call-err-1',
			sessionModelCallId: 43,
			firstAcceptedAt: null,
			latestReceiptAt: baseTimestamp + 61_000,
			latestError: {
				code: 'provider.unavailable',
				message: 'provider rejected the first frame',
			},
		},
	],
	dispatches: [
		{
			dispatchId: 'dispatch-room-main-err-1',
			contextId: 'ctx-room-main',
			commitId: 'commit-room-main-err',
			cycleId: 10,
			attemptIndex: 1,
			agentCallId: 'agent-call-err-1',
			sessionModelCallId: 43,
			createdAt: baseTimestamp + 60_000,
		},
	],
	receipts: [
		{
			receiptId: 'receipt-room-main-err-1',
			dispatchId: 'dispatch-room-main-err-1',
			contextId: 'ctx-room-main',
			commitId: 'commit-room-main-err',
			cycleId: 10,
			attemptIndex: 1,
			agentCallId: 'agent-call-err-1',
			sessionModelCallId: 43,
			status: 'errored',
			providerEventKind: 'run_error',
			timestamp: baseTimestamp + 61_000,
			errorCode: 'provider.unavailable',
			errorMessage: 'provider rejected the first frame',
		},
	],
} satisfies RuntimeAttentionDeliveryState;

const retryHistoryDeliveryState = {
	projections: [
		{
			contextId: 'ctx-room-main',
			commitId: 'commit-room-main-retry',
			state: 'accepted',
			attemptCount: 2,
			latestDispatchId: 'dispatch-room-main-retry-2',
			latestReceiptId: 'receipt-room-main-retry-2',
			agentCallId: 'agent-call-retry-2',
			sessionModelCallId: 55,
			firstAcceptedAt: baseTimestamp + 72_000,
			latestReceiptAt: baseTimestamp + 72_000,
			latestError: {
				code: 'provider.unavailable',
				message: 'attempt 1 failed before SSE',
			},
		},
	],
	dispatches: [
		{
			dispatchId: 'dispatch-room-main-retry-1',
			contextId: 'ctx-room-main',
			commitId: 'commit-room-main-retry',
			cycleId: 11,
			attemptIndex: 1,
			agentCallId: 'agent-call-retry-1',
			sessionModelCallId: 54,
			createdAt: baseTimestamp + 70_000,
		},
		{
			dispatchId: 'dispatch-room-main-retry-2',
			contextId: 'ctx-room-main',
			commitId: 'commit-room-main-retry',
			cycleId: 12,
			attemptIndex: 2,
			agentCallId: 'agent-call-retry-2',
			sessionModelCallId: 55,
			createdAt: baseTimestamp + 71_000,
		},
	],
	receipts: [
		{
			receiptId: 'receipt-room-main-retry-1',
			dispatchId: 'dispatch-room-main-retry-1',
			contextId: 'ctx-room-main',
			commitId: 'commit-room-main-retry',
			cycleId: 11,
			attemptIndex: 1,
			agentCallId: 'agent-call-retry-1',
			sessionModelCallId: 54,
			status: 'errored',
			providerEventKind: 'run_error',
			timestamp: baseTimestamp + 70_500,
			errorMessage: 'attempt 1 failed before SSE',
		},
		{
			receiptId: 'receipt-room-main-retry-2',
			dispatchId: 'dispatch-room-main-retry-2',
			contextId: 'ctx-room-main',
			commitId: 'commit-room-main-retry',
			cycleId: 12,
			attemptIndex: 2,
			agentCallId: 'agent-call-retry-2',
			sessionModelCallId: 55,
			status: 'accepted',
			providerEventKind: 'text_delta',
			timestamp: baseTimestamp + 72_000,
		},
	],
} satisfies RuntimeAttentionDeliveryState;

const createSchedulerState = (overrides?: Partial<RuntimeSchedulerState>): RuntimeSchedulerState => ({
  schemaVersion: 2,
  stateVersion: 1,
  running: false,
  paused: false,
  runtimeStatus: "idle",
  phase: "stopped",
  gate: "open",
  queueSize: 0,
  cycle: 0,
  sentBatches: 0,
  updatedAt: 0,
  lastMessageAt: null,
  lastResponseAt: null,
  lastWakeAt: null,
  lastWakeSource: null,
  lastWakeCause: null,
  activeContextCount: 0,
  activeItemCount: 0,
  unresolvedScoreCount: 0,
  waitingReason: null,
  nextAutoWakeAt: null,
  backoffMs: null,
  retryCount: 0,
  blockedReason: null,
  lastProgressAt: null,
  lastError: null,
  ...overrides,
});

const runningSchedulerState = createSchedulerState({
  running: true,
  runtimeStatus: "running",
  phase: "calling_model",
  lastWakeSource: "attention",
  lastWakeCause: "ready_now",
  updatedAt: baseTimestamp + 62_000,
});

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

const requestCompact = fn<() => void>();

const createLiveRunningGroups = (): HeartbeatGroupItem[] => {
  const now = Date.now();
  return [
    {
      id: 730,
      groupId: "heartbeat-group:call:73",
      kind: "call",
      aiCallId: 73,
      createdAt: now - 5_000,
      updatedAt: now - 4_000,
      isComplete: false,
      items: [
        {
          id: 731,
          messageId: "heartbeat-part:assistant:live-running",
          windowId: null,
          aiCallId: 73,
          roundIndex: 3,
          scope: "heartbeat_part",
          role: "assistant",
          createdAt: now - 5_000,
          updatedAt: now - 4_000,
          isComplete: false,
          text: "Streaming draft",
          parts: [
            {
              partId: 731,
              partIndex: 0,
              messageId: "heartbeat-part:assistant:live-running",
              windowId: null,
              aiCallId: 73,
              roundIndex: 3,
              scope: "heartbeat_part",
              role: "assistant",
              partType: "text",
              mimeType: null,
              payload: {
                type: "text",
                content: "Streaming draft",
              },
              createdAt: now - 5_000,
              updatedAt: now - 4_000,
              isComplete: false,
            },
          ],
        },
      ],
    },
  ];
};

export const LoadingOlderKeepsHeartbeatRowsStable = {
  name: "Scenario: Given durable Heartbeat message-parts When older rows are loaded Then folded bootstrap facts compact boundaries and assistant updates stay in one stream",
  args: {
    initialGroups,
    olderGroups,
    modelCalls: settledModelCalls,
    attention: attentionState,
    schedulerState: createSchedulerState({
      runtimeStatus: "waiting",
      waitingReason: "attention_debt",
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const stage = canvas.getByTestId("runtime-heartbeat-stage");
    const compactGroup = canvas.getByTestId("runtime-heartbeat-group-412");
    const systemPromptEntry = canvas.getByTestId("runtime-heartbeat-entry-21");
    const assistantEntry = canvas.getByTestId("runtime-heartbeat-entry-25");

    await expect(stage).toBeInTheDocument();
    await expect(compactGroup).toHaveTextContent("Compact #41");
    await expect(compactGroup).toHaveAttribute("data-layout-mode", "compact");
    await waitFor(() => {
      expect(systemPromptEntry.textContent).toContain("Prompt window compacted (manual).");
    });
    expect(assistantEntry.textContent).not.toContain("Text");
    expect(assistantEntry.textContent).toContain("attention commit");
    expect(within(compactGroup).getAllByRole("button", { name: "Copy section" }).length).toBeGreaterThan(0);
    expect(systemPromptEntry.textContent).not.toContain(
      "You are a Linux expert. Prefer bash and skills before asking for help.",
    );
    await expect(canvas.getByTestId("runtime-heartbeat-context")).toHaveTextContent(/\d+(\.\d+)?%/);
    await expect(canvas.getByTestId("runtime-heartbeat-shimmer")).toHaveTextContent(
      "Waiting · Attention Debt · 1 focused · 1 background · 1 muted",
    );
    const viewport = canvas.getByTestId("runtime-heartbeat-viewport");
    viewport.scrollTop = getBottomAnchoredStartScrollTop(viewport);
    viewport.dispatchEvent(new Event("scroll"));
    const loadOlderButton = await canvas.findByRole("button", { name: "Load older" });
    if (!(loadOlderButton instanceof HTMLButtonElement)) {
      throw new Error("Expected Load older button to be rendered as a button.");
    }
    const preLoadScrollTop = viewport.scrollTop;
    loadOlderButton.click();
    await waitFor(() => {
      expect(canvas.getByTestId("runtime-heartbeat-group-400")).toBeInTheDocument();
      expect(canvas.getByTestId("runtime-heartbeat-story-count")).toHaveTextContent("5");
    });
    const earliestGroup = canvas.getByTestId("runtime-heartbeat-group-400");
    await waitFor(() => {
      const absoluteStart = getBottomAnchoredStartScrollTop(viewport);
      if (viewport.scrollTop === absoluteStart) {
        throw new Error(
          `Older reveal collapsed back to absolute start: ${describeViewportMetrics(viewport, canvasElement)}`,
        );
      }
      if (viewport.scrollTop >= preLoadScrollTop) {
        throw new Error(
          `Older reveal did not move toward history start: ${describeViewportMetrics(viewport, canvasElement)}`,
        );
      }
      expect(findInsertMotion(earliestGroup)).toBe("older");
    });

    const animationHost = await waitFor(() => {
      const host = canvasElement.querySelector<HTMLElement>('[data-insert-motion="older"]');
      if (!host) {
        throw new Error(
          `Older reveal host did not retain insert-motion: ${describeViewportMetrics(viewport, canvasElement)}`,
        );
      }
      return host;
    });
    const animation = await waitFor(() => {
      const runningAnimations = animationHost.getAnimations().filter((candidate) => candidate.playState !== "idle");
      const candidate = runningAnimations[0];
      if (!candidate) {
        throw new Error("Older reveal did not expose a running WAAPI animation.");
      }
      return candidate;
    });
    const beforeTime = Number(animation.currentTime ?? 0);
    await waitFor(
      () => {
        expect(Number(animation.currentTime ?? 0)).toBeGreaterThan(beforeTime);
      },
      {
        timeout: BOTTOM_ANCHORED_INSERT_MOTION_DURATION_MS,
      },
    );
  },
} satisfies Story;

export const LayoutActionSwitchesGroupPresentation = {
  name: "Scenario: Given one heartbeat group card When the operator switches layout Then compact summary and detailed ledger views stay attached to the same group",
  args: {
    initialGroups,
    olderGroups: [],
    modelCalls: settledModelCalls,
    attention: attentionState,
    schedulerState: createSchedulerState({
      runtimeStatus: "waiting",
      waitingReason: "attention_debt",
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const compactGroup = canvas.getByTestId("runtime-heartbeat-group-412");
    const callGroup = canvas.getByTestId("runtime-heartbeat-group-411");
    const systemPromptEntry = canvas.getByTestId("runtime-heartbeat-entry-21");
    const streamingAssistantEntry = canvas.getByTestId("runtime-heartbeat-entry-25");
    const compactToolDetails = Array.from(callGroup.querySelectorAll("details")).find((details) =>
      details.textContent?.includes("root_bash"),
    );
    const compactToolSummary = compactToolDetails?.querySelector("summary");

    await expect(compactGroup).toHaveAttribute("data-layout-mode", "compact");
    expect(systemPromptEntry.textContent).not.toContain(
      "You are a Linux expert. Prefer bash and skills before asking for help.",
    );
    expect(callGroup.textContent).not.toContain('{"invocationId":"tool-call-1"');
    await expect(streamingAssistantEntry).toHaveTextContent("root_bash");
    await expect(streamingAssistantEntry).toHaveTextContent("attention commit");
    await waitFor(() => {
      expect(canvas.getByTestId("runtime-heartbeat-entry-time-25").textContent ?? "").toMatch(
        /^2026\/4\/12 22:25:45, \d+ (?:sec|min|hr)(?: \d+ min)?$/,
      );
    });
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

    await expect(compactGroup).toHaveAttribute("data-layout-mode", "detailed");
    await waitFor(() => {
      const systemPromptMarkdown = systemPromptEntry.querySelector("agenter-markdown-document") as
        | (HTMLElement & { value?: string })
        | null;
      expect(systemPromptMarkdown?.value).toContain(
        "You are a Linux expert. Prefer bash and skills before asking for help.",
      );
    });
    await expect(compactGroup).toHaveTextContent("Compact");
  },
} satisfies Story;

export const StickyBottomKeepsLatestRowsReachable = {
  name: "Scenario: Given a long virtualized Heartbeat stream When the operator scrolls away Then the stage exposes Scroll to latest and returns to the newest rows",
  args: {
    initialGroups: longStreamGroups,
    olderGroups: [],
    modelCalls: settledModelCalls,
    attention: attentionState,
    schedulerState: createSchedulerState({
      runtimeStatus: "waiting",
      waitingReason: "attention_debt",
    }),
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

    viewport.scrollTop = getBottomAnchoredStartScrollTop(viewport);
    viewport.dispatchEvent(new Event("scroll"));

    await waitFor(() => {
      expect(canvas.getByRole("button", { name: "Scroll to latest" })).toBeInTheDocument();
      expect(canvas.getByTestId(`runtime-heartbeat-entry-${firstEntry.id}`)).toBeInTheDocument();
    });
    const scrollButton = canvas.getByRole("button", { name: "Scroll to latest" });
    await waitFor(() => {
      expect(scrollButton.closest<HTMLElement>("[data-visible='true']")).not.toBeNull();
    });
    await waitForViewportSettle(viewport);

    scrollButton.click();

    await waitFor(
      () => {
        if (viewport.scrollTop !== 0) {
          throw new Error(
            `Scroll to latest did not return to zero: ${describeViewportMetrics(viewport, canvasElement)}`,
          );
        }
        expect(getViewportDistanceToLatest(viewport)).toBeLessThanOrEqual(48);
        expect(scrollButton.closest<HTMLElement>("[data-visible='true']")).toBeNull();
      },
      {
        timeout: BOTTOM_ANCHORED_INSERT_MOTION_DURATION_MS + 1_200,
      },
    );
  },
} satisfies Story;

export const BottomAnchorSurvivesLatestAppend = {
  name: "Scenario: Given the Heartbeat viewport is pinned to latest When a new measured group appears Then the shared insert-motion flow keeps latest stable instead of rolling backward first",
  args: {
    initialGroups: longStreamGroups,
    olderGroups: [],
    scheduledUpdates: [
      {
        type: "append-groups" as const,
        afterMs: 900,
        groups: [appendedBottomAnchorGroup],
      },
    ],
    modelCalls: settledModelCalls,
    attention: attentionState,
    schedulerState: createSchedulerState({
      runtimeStatus: "running",
      running: true,
      phase: "calling_model",
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const viewport = canvas.getByTestId("runtime-heartbeat-viewport");

    await waitFor(() => {
      expect(viewport.scrollHeight).toBeGreaterThan(viewport.clientHeight);
    });

    viewport.scrollTop = 0;
    viewport.dispatchEvent(new Event("scroll"));

    await waitFor(() => {
      expect(getViewportDistanceToLatest(viewport)).toBeLessThanOrEqual(48);
    });

    await waitFor(() => {
      const latestEntry = canvas.queryByTestId("runtime-heartbeat-entry-920");
      if (!latestEntry) {
        throw new Error(`Latest append entry not mounted: ${describeViewportMetrics(viewport, canvasElement)}`);
      }
      expect(latestEntry).toBeInTheDocument();
      expect(findInsertMotion(latestEntry)).toBe("latest");
    });

    const animationHost = await waitFor(() => {
      const host = canvasElement.querySelector<HTMLElement>('[data-insert-motion="latest"]');
      if (!host) {
        throw new Error(
          `Latest append entry is missing the current insert-motion host: ${describeViewportMetrics(viewport, canvasElement)}`,
        );
      }
      return host;
    });
    const appendedHeight = Math.round(animationHost.getBoundingClientRect().height);
    expect(appendedHeight).toBeGreaterThan(0);
    const distanceSamples = await captureDistanceToLatestSamples(viewport);
    const maxDistanceToLatest = Math.max(...distanceSamples);
    expect(maxDistanceToLatest).toBeLessThanOrEqual(48);

    await waitForInsertMotionCleanup();
    await waitForViewportSettle(viewport);

    await waitFor(
      () => {
        const distanceToLatest = getViewportDistanceToLatest(viewport);
        expect(distanceToLatest).toBeLessThanOrEqual(48);
        expect(canvas.getByTestId("runtime-heartbeat-entry-920")).toBeInTheDocument();
      },
      {
        timeout: BOTTOM_ANCHORED_INSERT_MOTION_DURATION_MS + 1_200,
      },
    );
  },
} satisfies Story;

export const LatestAppendPlaysInsertMotion = {
  name: "Scenario: Given a new latest Heartbeat group When it mounts Then the shared WAAPI insert motion is actually playing instead of only setting data attributes",
  args: {
    initialGroups: longStreamGroups,
    olderGroups: [],
    scheduledUpdates: [
      {
        type: "append-groups" as const,
        afterMs: 900,
        groups: [appendedBottomAnchorGroup],
      },
    ],
    modelCalls: settledModelCalls,
    attention: attentionState,
    schedulerState: createSchedulerState({
      runtimeStatus: "running",
      running: true,
      phase: "calling_model",
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const viewport = canvas.getByTestId("runtime-heartbeat-viewport");

    await waitFor(() => {
      expect(viewport.scrollHeight).toBeGreaterThan(viewport.clientHeight);
    });

    viewport.scrollTop = 0;
    viewport.dispatchEvent(new Event("scroll"));

    await waitFor(() => {
      expect(getViewportDistanceToLatest(viewport)).toBeLessThanOrEqual(48);
    });

    await waitFor(() => {
      const entry = canvas.queryByTestId("runtime-heartbeat-entry-920");
      if (!entry) {
        throw new Error(`Latest append entry not mounted: ${describeViewportMetrics(viewport, canvasElement)}`);
      }
      if (findInsertMotion(entry) !== "latest") {
        throw new Error(
          `Latest append entry lost insert-motion marker: ${describeViewportMetrics(viewport, canvasElement)}`,
        );
      }
    });

    const animationHost = await waitFor(() => {
      const host = canvasElement.querySelector<HTMLElement>('[data-insert-motion="latest"]');
      if (!host) {
        throw new Error(
          `Latest append entry is missing the current insert-motion host: ${describeViewportMetrics(viewport, canvasElement)}`,
        );
      }
      const hostedEntry = host.querySelector<HTMLElement>('[data-testid="runtime-heartbeat-entry-920"]');
      if (!hostedEntry) {
        throw new Error(
          `Latest append host lost the appended entry before animation sampling: ${describeViewportMetrics(viewport, canvasElement)}`,
        );
      }
      return host;
    });

    const animation = await waitFor(() => {
      const runningAnimations = animationHost.getAnimations().filter((candidate) => candidate.playState !== "idle");
      const candidate = runningAnimations[0];
      if (!candidate) {
        throw new Error("Latest append entry did not expose a running WAAPI animation.");
      }
      return candidate;
    });

    const beforeScrollTop = viewport.scrollTop;
    const beforeTime = Number(animation.currentTime ?? 0);
    await waitFor(
      () => {
        expect(Number(animation.currentTime ?? 0)).toBeGreaterThan(beforeTime);
      },
      {
        timeout: BOTTOM_ANCHORED_INSERT_MOTION_DURATION_MS,
      },
    );
    expect(animation.playState === "running" || animation.playState === "finished").toBe(true);
    expect(beforeScrollTop).toBe(0);
    const distanceSamples = await captureDistanceToLatestSamples(viewport);
    expect(Math.max(...distanceSamples)).toBeLessThanOrEqual(48);

    await waitFor(
      async () => {
        await waitForTwoAnimationFrames();
        expect(animation.playState).toBe("finished");
      },
      { timeout: BOTTOM_ANCHORED_INSERT_MOTION_DURATION_MS * 4 },
    );

    await waitFor(
      () => {
        expect(getViewportDistanceToLatest(viewport)).toBeLessThanOrEqual(48);
      },
      {
        timeout: BOTTOM_ANCHORED_INSERT_MOTION_DURATION_MS * 4,
      },
    );
  },
} satisfies Story;

export const InsertMotionPlayground = {
  name: "Playground: Heartbeat reverse-flow insert motion controls",
  args: {
    initialGroups: longStreamGroups,
    olderGroups: [],
    modelCalls: settledModelCalls,
    attention: attentionState,
    schedulerState: createSchedulerState({
      runtimeStatus: "running",
      running: true,
      phase: "calling_model",
    }),
    interactiveControls: {
      appendLatest: createInteractiveLatestGroup,
      prependOlder: createInteractiveOlderGroup,
      replaceLatest: createInteractiveLatestGrowthGroup,
      hint: "Append latest shows the new-card motion. Scroll to visual top, then use Prepend older to watch the older/load-old reveal. Grow latest replaces the last card in place so you can inspect remeasurement without insertion.",
    },
  },
} satisfies Story;

export const InteractiveAppendUsesUniqueVisibleLabels = {
  name: "Scenario: Given the insert-motion playground When latest groups are appended repeatedly Then each new card exposes a distinct visible sequence label",
  args: InsertMotionPlayground.args,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const viewport = canvas.getByTestId("runtime-heartbeat-viewport");
    const appendButton = canvas.getByTestId("runtime-heartbeat-playground-append-latest");

    await userEvent.click(appendButton);
    await waitFor(() => {
      expect(canvas.getByText("Call #1001")).toBeInTheDocument();
    });
    await waitFor(
      () => {
        expect(getViewportDistanceToLatest(viewport)).toBeLessThanOrEqual(48);
      },
      {
        timeout: BOTTOM_ANCHORED_INSERT_MOTION_DURATION_MS + 1_200,
      },
    );

    await waitFor(() => {
      expect(appendButton).not.toBeDisabled();
    });

    await userEvent.click(appendButton);
    await waitFor(() => {
      expect(canvas.getByText("Call #1002")).toBeInTheDocument();
    });
    await waitFor(
      () => {
        expect(getViewportDistanceToLatest(viewport)).toBeLessThanOrEqual(48);
      },
      {
        timeout: BOTTOM_ANCHORED_INSERT_MOTION_DURATION_MS + 1_200,
      },
    );
  },
} satisfies Story;

export const AppendLatestWhilePinnedKeepsViewportStable = {
  name: "Scenario: Given the insert-motion playground is pinned to latest When Append latest is clicked Then the viewport stays near latest while the new row animates in",
  args: InsertMotionPlayground.args,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const viewport = canvas.getByTestId("runtime-heartbeat-viewport");
    const appendButton = canvas.getByTestId("runtime-heartbeat-playground-append-latest");

    await waitFor(() => {
      expect(viewport.scrollHeight).toBeGreaterThan(viewport.clientHeight);
    });

    viewport.scrollTop = 0;
    viewport.dispatchEvent(new Event("scroll"));

    await waitFor(() => {
      expect(getViewportDistanceToLatest(viewport)).toBeLessThanOrEqual(48);
    });

    await userEvent.click(appendButton);

    await waitFor(() => {
      expect(canvas.getByText("Call #1001")).toBeInTheDocument();
    });

    const animationHost = await waitFor(() => {
      const host = canvasElement.querySelector<HTMLElement>('[data-insert-motion="latest"]');
      if (!host) {
        throw new Error(
          `Interactive latest append host is missing: ${describeViewportMetrics(viewport, canvasElement)}`,
        );
      }
      return host;
    });
    const appendedHeight = Math.round(animationHost.getBoundingClientRect().height);
    expect(appendedHeight).toBeGreaterThan(0);
    const distanceSamples = await captureDistanceToLatestSamples(viewport);
    expect(Math.max(...distanceSamples)).toBeLessThanOrEqual(48);

    await waitForViewportSettle(viewport);

    await waitFor(
      () => {
        expect(getViewportDistanceToLatest(viewport)).toBeLessThanOrEqual(48);
        expect(readTrailingVisiblePlaygroundCall(canvasElement, viewport)).toBe(1001);
      },
      {
        timeout: BOTTOM_ANCHORED_INSERT_MOTION_DURATION_MS + 1_200,
      },
    );
  },
} satisfies Story;

export const AppendLatestWhilePinnedPreservesExistingGroupDomIdentity = {
  name: "Scenario: Given the insert-motion playground is pinned to latest When Append latest is clicked Then an existing visible heartbeat card keeps the same DOM identity",
  args: InsertMotionPlayground.args,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const viewport = canvas.getByTestId("runtime-heartbeat-viewport");
    const appendButton = canvas.getByTestId("runtime-heartbeat-playground-append-latest");

    await waitFor(() => {
      expect(viewport.scrollHeight).toBeGreaterThan(viewport.clientHeight);
    });

    viewport.scrollTop = 0;
    viewport.dispatchEvent(new Event("scroll"));

    await waitFor(() => {
      expect(getViewportDistanceToLatest(viewport)).toBeLessThanOrEqual(48);
    });

    const anchoredGroupTestId = await waitFor(() => {
      const current = readCenteredVisibleHeartbeatGroupTestId(canvasElement, viewport);
      if (!current) {
        throw new Error(
          `Unable to resolve an existing visible Heartbeat card before append: ${describeViewportMetrics(viewport, canvasElement)}`,
        );
      }
      return current;
    });
    const anchoredGroupBefore = readHeartbeatGroupNode(canvasElement, anchoredGroupTestId);
    const anchoredEntryBefore = readHeartbeatEntryNode(canvasElement, anchoredGroupTestId);
    if (!anchoredGroupBefore || !anchoredEntryBefore) {
      throw new Error(
        `Unable to capture the existing Heartbeat card DOM identity before append: ${anchoredGroupTestId}`,
      );
    }
    const anchoredEntryTestId = anchoredEntryBefore.dataset.testid;
    if (!anchoredEntryTestId) {
      throw new Error(`Unable to resolve the entry test id for ${anchoredGroupTestId} before append.`);
    }

    await userEvent.click(appendButton);
    await waitForPlaygroundAppendSettle({
      canvas,
      viewport,
      appendButton,
      expectedCall: 1001,
    });
    await waitForAnimationFrame();
    await waitForAnimationFrame();

    const anchoredGroupAfter = readHeartbeatGroupNode(canvasElement, anchoredGroupTestId);
    const anchoredEntryAfter = readHeartbeatNodeByTestId(canvasElement, anchoredEntryTestId);
    expect(anchoredGroupAfter).not.toBeNull();
    expect(anchoredEntryAfter).not.toBeNull();
    expect(anchoredGroupAfter?.isSameNode(anchoredGroupBefore) ?? false).toBe(true);
    expect(anchoredEntryAfter?.isSameNode(anchoredEntryBefore) ?? false).toBe(true);
  },
} satisfies Story;

export const AppendLatestWhilePinnedKeepsAnchoredEntryLocatorUnique = {
  name: "Scenario: Given the insert-motion playground is pinned to latest When Append latest is clicked Then the anchored heartbeat entry test id remains unique in the live DOM",
  args: InsertMotionPlayground.args,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const viewport = canvas.getByTestId("runtime-heartbeat-viewport");
    const appendButton = canvas.getByTestId("runtime-heartbeat-playground-append-latest");

    await waitFor(() => {
      expect(viewport.scrollHeight).toBeGreaterThan(viewport.clientHeight);
    });

    viewport.scrollTop = 0;
    viewport.dispatchEvent(new Event("scroll"));

    await waitFor(() => {
      expect(getViewportDistanceToLatest(viewport)).toBeLessThanOrEqual(48);
    });

    const anchoredGroupTestId = await waitFor(() => {
      const current = readCenteredVisibleHeartbeatGroupTestId(canvasElement, viewport);
      if (!current) {
        throw new Error(
          `Unable to resolve an existing visible Heartbeat card before append: ${describeViewportMetrics(viewport, canvasElement)}`,
        );
      }
      return current;
    });
    const anchoredEntryBefore = readHeartbeatEntryNode(canvasElement, anchoredGroupTestId);
    if (!anchoredEntryBefore?.dataset.testid) {
      throw new Error(`Unable to resolve the entry test id for ${anchoredGroupTestId} before append.`);
    }
    const anchoredEntryTestId = anchoredEntryBefore.dataset.testid;

    expect(readHeartbeatNodesByTestId(canvasElement, anchoredEntryTestId)).toHaveLength(1);

    await userEvent.click(appendButton);
    await waitForPlaygroundAppendSettle({
      canvas,
      viewport,
      appendButton,
      expectedCall: 1001,
    });
    await waitForAnimationFrame();
    await waitForAnimationFrame();

    expect(readHeartbeatNodesByTestId(canvasElement, anchoredEntryTestId)).toHaveLength(1);
  },
} satisfies Story;

export const AppendLatestWhilePinnedPreservesAnchoredEntryWithinGroupScope = {
  name: "Scenario: Given the insert-motion playground is pinned to latest When Append latest is clicked Then the existing heartbeat entry stays attached to the preserved group subtree",
  args: InsertMotionPlayground.args,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const viewport = canvas.getByTestId("runtime-heartbeat-viewport");
    const appendButton = canvas.getByTestId("runtime-heartbeat-playground-append-latest");

    await waitFor(() => {
      expect(viewport.scrollHeight).toBeGreaterThan(viewport.clientHeight);
    });

    viewport.scrollTop = 0;
    viewport.dispatchEvent(new Event("scroll"));

    await waitFor(() => {
      expect(getViewportDistanceToLatest(viewport)).toBeLessThanOrEqual(48);
    });

    const anchoredGroupTestId = await waitFor(() => {
      const current = readCenteredVisibleHeartbeatGroupTestId(canvasElement, viewport);
      if (!current) {
        throw new Error(
          `Unable to resolve an existing visible Heartbeat card before append: ${describeViewportMetrics(viewport, canvasElement)}`,
        );
      }
      return current;
    });
    const anchoredGroupBefore = readHeartbeatGroupNode(canvasElement, anchoredGroupTestId);
    const anchoredEntryBefore = readHeartbeatEntryNode(canvasElement, anchoredGroupTestId);
    if (!anchoredGroupBefore || !anchoredEntryBefore) {
      throw new Error(
        `Unable to capture the existing Heartbeat card DOM identity before append: ${anchoredGroupTestId}`,
      );
    }
    const anchoredEntryTestId = anchoredEntryBefore.dataset.testid;
    if (!anchoredEntryTestId) {
      throw new Error(`Unable to resolve the entry test id for ${anchoredGroupTestId} before append.`);
    }

    await userEvent.click(appendButton);
    await waitForPlaygroundAppendSettle({
      canvas,
      viewport,
      appendButton,
      expectedCall: 1001,
    });
    await waitForAnimationFrame();
    await waitForAnimationFrame();

    const anchoredGroupAfter = readHeartbeatGroupNode(canvasElement, anchoredGroupTestId);
    const anchoredEntryAfter = anchoredGroupAfter?.querySelector<HTMLElement>(`[data-testid="${anchoredEntryTestId}"]`);
    expect(anchoredGroupAfter).not.toBeNull();
    expect(anchoredEntryAfter).not.toBeNull();
    expect(anchoredGroupAfter?.isSameNode(anchoredGroupBefore) ?? false).toBe(true);
    expect(anchoredEntryAfter?.isSameNode(anchoredEntryBefore) ?? false).toBe(true);
  },
} satisfies Story;

export const AppendLatestWhilePinnedPreservesAnchoredSectionWrapperIdentity = {
  name: "Scenario: Given the insert-motion playground is pinned to latest When Append latest is clicked Then the preserved heartbeat section wrapper keeps the same DOM identity",
  args: InsertMotionPlayground.args,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const viewport = canvas.getByTestId("runtime-heartbeat-viewport");
    const appendButton = canvas.getByTestId("runtime-heartbeat-playground-append-latest");

    await waitFor(() => {
      expect(viewport.scrollHeight).toBeGreaterThan(viewport.clientHeight);
    });

    viewport.scrollTop = 0;
    viewport.dispatchEvent(new Event("scroll"));

    await waitFor(() => {
      expect(getViewportDistanceToLatest(viewport)).toBeLessThanOrEqual(48);
    });

    const anchoredGroupTestId = await waitFor(() => {
      const current = readCenteredVisibleHeartbeatGroupTestId(canvasElement, viewport);
      if (!current) {
        throw new Error(
          `Unable to resolve an existing visible Heartbeat card before append: ${describeViewportMetrics(viewport, canvasElement)}`,
        );
      }
      return current;
    });
    const anchoredEntryBefore = readHeartbeatEntryNode(canvasElement, anchoredGroupTestId);
    const anchoredSectionBefore = anchoredEntryBefore?.closest<HTMLElement>(
      '[data-testid^="runtime-heartbeat-section-"]',
    );
    if (!anchoredEntryBefore || !anchoredSectionBefore?.dataset.testid) {
      throw new Error(`Unable to resolve the section wrapper for ${anchoredGroupTestId} before append.`);
    }
    const anchoredSectionTestId = anchoredSectionBefore.dataset.testid;

    await userEvent.click(appendButton);
    await waitForPlaygroundAppendSettle({
      canvas,
      viewport,
      appendButton,
      expectedCall: 1001,
    });
    await waitForAnimationFrame();
    await waitForAnimationFrame();

    const anchoredSectionAfter = readHeartbeatNodeByTestId(canvasElement, anchoredSectionTestId);
    expect(anchoredSectionAfter).not.toBeNull();
    expect(anchoredSectionAfter?.isSameNode(anchoredSectionBefore) ?? false).toBe(true);
  },
} satisfies Story;

export const AppendLatestWhileAwayKeepsViewportAnchored = {
  name: "Scenario: Given the Heartbeat viewport is reading older rows When a new latest group arrives Then the viewport preserves the current reading position instead of snapping to latest",
  args: InsertMotionPlayground.args,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const viewport = canvas.getByTestId("runtime-heartbeat-viewport");
    const appendButton = canvas.getByTestId("runtime-heartbeat-playground-append-latest");
    const scrollButtonShell = canvasElement.querySelector<HTMLElement>(".conversation-scroll-button");
    if (!scrollButtonShell) {
      throw new Error("Scroll-to-latest shell is missing from the Heartbeat story.");
    }

    await waitFor(() => {
      expect(viewport.scrollHeight).toBeGreaterThan(viewport.clientHeight);
    });

    const awayScrollTop = Math.round(getBottomAnchoredStartScrollTop(viewport) * 0.55);
    viewport.scrollTop = awayScrollTop;
    viewport.dispatchEvent(new Event("scroll"));

    await waitFor(() => {
      expect(scrollButtonShell.dataset.visible).toBe("true");
    });
    await waitForViewportSettle(viewport);
    await waitForAnimationFrame();

    const anchoredGroupTestId = await waitFor(() => {
      const current = readCenteredVisibleHeartbeatGroupTestId(canvasElement, viewport);
      if (!current) {
        throw new Error(
          `Unable to resolve the centered reading anchor: ${describeViewportMetrics(viewport, canvasElement)}`,
        );
      }
      return current;
    });
    const anchoredGroupTopBeforeAppend = readHeartbeatGroupTop(canvasElement, anchoredGroupTestId);
    const anchoredGroupRowTopBeforeAppend = readHeartbeatGroupRowTop(canvasElement, anchoredGroupTestId);
    if (anchoredGroupTopBeforeAppend === null) {
      throw new Error(
        `Unable to resolve the reading anchor rect before append: ${describeViewportMetrics(viewport, canvasElement)}`,
      );
    }

    await userEvent.click(appendButton);

    await waitFor(() => {
      expect(canvas.getByTestId("runtime-heartbeat-story-count")).toHaveTextContent("19");
    });
    await waitFor(() => {
      expect(appendButton).not.toBeDisabled();
    });
    await waitForAnimationFrame();
    const anchorTopSamples = await captureHeartbeatGroupTopSamples(canvasElement, anchoredGroupTestId);
    const maxAnchorDrift = anchorTopSamples.length
      ? Math.max(...anchorTopSamples.map((top) => Math.abs(top - anchoredGroupTopBeforeAppend)))
      : Number.POSITIVE_INFINITY;
    if (maxAnchorDrift > 16) {
      throw new Error(
        `Away append drifted too far before settle: before=${anchoredGroupTopBeforeAppend}; samples=${anchorTopSamples
          .slice(0, 12)
          .join(",")}; rowBefore=${anchoredGroupRowTopBeforeAppend}; rowAfter=${readHeartbeatGroupRowTop(
          canvasElement,
          anchoredGroupTestId,
        )}; max=${maxAnchorDrift}; anchorKey=${viewport.dataset.anchoredVisibleKey ?? ""}; anchorTop=${
          viewport.dataset.anchoredVisibleTop ?? ""
        }; appendAnchorStatus=${viewport.dataset.anchoredAppendAnchorStatus ?? ""}; appendAnchorKey=${
          viewport.dataset.anchoredAppendAnchorKey ?? ""
        }; appendAnchorTop=${viewport.dataset.anchoredAppendAnchorTop ?? ""}; appendAnchorDrift=${
          viewport.dataset.anchoredAppendAnchorDrift ?? ""
        }; ${describeViewportMetrics(viewport, canvasElement)}`,
      );
    }
    await waitForViewportSettle(viewport);

    await waitFor(
      () => {
        const distanceToLatest = getViewportDistanceToLatest(viewport);
        if (distanceToLatest <= 48) {
          throw new Error(`Away append snapped back to latest: ${describeViewportMetrics(viewport, canvasElement)}`);
        }
        expect(scrollButtonShell.dataset.visible).toBe("true");
        expect(canvasElement.querySelector(`[data-testid="${anchoredGroupTestId}"]`)).not.toBeNull();
        const anchoredGroupTopAfterAppend = readHeartbeatGroupTop(canvasElement, anchoredGroupTestId);
        expect(anchoredGroupTopAfterAppend).not.toBeNull();
        expect(Math.abs((anchoredGroupTopAfterAppend ?? 0) - anchoredGroupTopBeforeAppend)).toBeLessThanOrEqual(16);
      },
      {
        timeout: BOTTOM_ANCHORED_INSERT_MOTION_DURATION_MS + 1_200,
      },
    );
  },
} satisfies Story;

export const ScrollToLatestInterruptedByWheelKeepsViewportAway = {
  name: "Scenario: Given the Heartbeat viewport is away from latest When Scroll to latest is interrupted by wheel input Then the viewport remains under user ownership",
  args: {
    initialGroups: longStreamGroups,
    olderGroups: [],
    modelCalls: settledModelCalls,
    attention: attentionState,
    schedulerState: createSchedulerState({
      runtimeStatus: "waiting",
      waitingReason: "attention_debt",
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const viewport = canvas.getByTestId("runtime-heartbeat-viewport");
    const scrollButtonShell = canvasElement.querySelector<HTMLElement>(".conversation-scroll-button");
    const scrollButton = scrollButtonShell?.querySelector<HTMLButtonElement>('button[aria-label="Scroll to latest"]');
    if (!scrollButtonShell || !scrollButton) {
      throw new Error("Scroll-to-latest control is missing from the Heartbeat story.");
    }

    await waitFor(() => {
      expect(viewport.scrollHeight).toBeGreaterThan(viewport.clientHeight);
    });

    const awayScrollTop = Math.round(getBottomAnchoredStartScrollTop(viewport) * 0.8);
    viewport.scrollTop = awayScrollTop;
    viewport.dispatchEvent(new Event("scroll"));

    await waitFor(() => {
      expect(scrollButtonShell.dataset.visible).toBe("true");
    });

    scrollButton.click();
    await waitForAnimationFrame();

    viewport.dispatchEvent(new Event("wheel"));
    viewport.scrollTop = awayScrollTop;
    viewport.dispatchEvent(new Event("scroll"));

    await waitForViewportSettle(viewport);
    await waitFor(
      () => {
        const distanceToLatest = getViewportDistanceToLatest(viewport);
        if (distanceToLatest <= 48) {
          throw new Error(
            `Wheel interrupt still let Scroll to latest win: ${describeViewportMetrics(viewport, canvasElement)}`,
          );
        }
        expect(scrollButtonShell.dataset.visible).toBe("true");
      },
      {
        timeout: BOTTOM_ANCHORED_INSERT_MOTION_DURATION_MS * 2,
      },
    );
  },
} satisfies Story;

export const RepeatedLatestAppendKeepsTrailingSequenceMonotonic = {
  name: "Scenario: Given the insert-motion playground has already appended several latest groups When one more latest group arrives Then the trailing visible sequence never regresses to an older card mid-animation",
  args: InsertMotionPlayground.args,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const viewport = canvas.getByTestId("runtime-heartbeat-viewport");
    const appendButton = canvas.getByTestId("runtime-heartbeat-playground-append-latest");

    await waitFor(() => {
      expect(viewport.scrollHeight).toBeGreaterThan(viewport.clientHeight);
    });

    for (const expectedCall of [1001, 1002, 1003, 1004, 1005, 1006]) {
      await userEvent.click(appendButton);
      await waitForPlaygroundAppendSettle({
        canvas,
        viewport,
        appendButton,
        expectedCall,
      });
    }

    const baselineTrailingCall = readTrailingVisiblePlaygroundCall(canvasElement, viewport);
    expect(baselineTrailingCall).toBe(1006);

    await userEvent.click(appendButton);
    const samples = await captureTrailingPlaygroundCallSamples(canvasElement, viewport, 1007);

    expect(samples.length).toBeGreaterThan(0);
    expect(samples.at(-1)).toBe(1007);
    expect(Math.min(...samples)).toBeGreaterThanOrEqual(baselineTrailingCall ?? 0);
  },
} satisfies Story;

export const BottomAnchorSurvivesLatestGrowth = {
  name: "Scenario: Given the Heartbeat viewport is pinned to bottom When the last group grows without changing item count Then the viewport keeps the latest rows anchored",
  args: {
    initialGroups: bottomAnchorGrowthGroups,
    olderGroups: [],
    scheduledUpdates: [
      {
        type: "replace-last-group" as const,
        afterMs: 900,
        group: growingBottomAnchorExpandedGroup,
      },
    ],
    modelCalls: settledModelCalls,
    attention: attentionState,
    schedulerState: createSchedulerState({
      runtimeStatus: "running",
      running: true,
      phase: "calling_model",
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const viewport = canvas.getByTestId("runtime-heartbeat-viewport");

    await waitFor(() => {
      expect(viewport.scrollHeight).toBeGreaterThan(viewport.clientHeight);
    });

    viewport.scrollTop = 0;
    viewport.dispatchEvent(new Event("scroll"));

    await waitFor(() => {
      expect(getViewportDistanceToLatest(viewport)).toBeLessThanOrEqual(48);
    });

    await waitFor(() => {
      const distanceToLatest = getViewportDistanceToLatest(viewport);
      if (distanceToLatest > 48) {
        throw new Error(`Viewport drifted after growth: ${describeViewportMetrics(viewport, canvasElement)}`);
      }
      const latestEntry = canvas.queryByTestId("runtime-heartbeat-entry-930");
      if (!latestEntry) {
        throw new Error(`Latest growth marker not mounted: ${describeViewportMetrics(viewport, canvasElement)}`);
      }
      expect(latestEntry.textContent ?? "").toMatch(/after-growth marker/);
      expect(findInsertMotion(latestEntry)).toBe("none");
    });

    await waitForInsertMotionCleanup();

    await waitFor(() => {
      expect(getViewportDistanceToLatest(viewport)).toBeLessThanOrEqual(48);
      expect(canvas.getByTestId("runtime-heartbeat-entry-930")).toBeInTheDocument();
    });
  },
} satisfies Story;

export const LatestGrowthPreservesExistingGroupDomIdentity = {
  name: "Scenario: Given the Heartbeat viewport is pinned to bottom When the latest group grows without changing item count Then that card keeps the same DOM identity",
  args: BottomAnchorSurvivesLatestGrowth.args,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const viewport = canvas.getByTestId("runtime-heartbeat-viewport");

    await waitFor(() => {
      expect(viewport.scrollHeight).toBeGreaterThan(viewport.clientHeight);
    });

    viewport.scrollTop = 0;
    viewport.dispatchEvent(new Event("scroll"));

    await waitFor(() => {
      expect(getViewportDistanceToLatest(viewport)).toBeLessThanOrEqual(48);
    });

    const latestGroupBefore = canvas.getByTestId("runtime-heartbeat-group-930");
    const latestEntryBefore = canvas.getByTestId("runtime-heartbeat-entry-930");
    expect(latestEntryBefore.textContent).toContain("compact preview before growth");

    await waitFor(() => {
      expect(canvas.getByTestId("runtime-heartbeat-entry-930").textContent ?? "").toContain("after-growth marker");
    });
    await waitForViewportSettle(viewport);

    const latestGroupAfter = canvas.getByTestId("runtime-heartbeat-group-930");
    const latestEntryAfter = canvas.getByTestId("runtime-heartbeat-entry-930");
    expect(latestGroupAfter.isSameNode(latestGroupBefore)).toBe(true);
    expect(latestEntryAfter.isSameNode(latestEntryBefore)).toBe(true);
  },
} satisfies Story;

export const RunningFooterShowsShimmerWithoutUsage = {
  name: "Scenario: Given a running AI call without usage When the Heartbeat footer renders Then shimmer stays active while context falls back to disabled",
  args: {
    initialGroups,
    olderGroups: [],
    modelCalls: streamingModelCalls,
    attention: attentionState,
    schedulerState: runningSchedulerState,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const context = canvas.getByTestId("runtime-heartbeat-context");
    await expect(canvas.getByTestId("runtime-heartbeat-shimmer")).toHaveAttribute("data-running", "true");
    await expect(canvas.getByTestId("runtime-heartbeat-shimmer")).toHaveTextContent("Running");
    await expect(context).toHaveAttribute("data-context-state", "unavailable");
    await expect(context).toHaveTextContent("—");
    await expect(within(context).getByRole("button", { name: /Model context usage/ })).toBeDisabled();
  },
} satisfies Story;

export const MessageReadDoesNotImplyAccepted = {
  name: "Scenario: Given a room message is already read and ai_call is running When delivery has no receipt yet Then Heartbeat keeps the attempt in dispatching instead of accepted",
  args: {
    initialGroups,
    olderGroups: [],
    modelCalls: streamingModelCalls,
    attention: attentionState,
    attentionDelivery: dispatchingDeliveryState,
    schedulerState: runningSchedulerState,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const summary = canvas.getByTestId("runtime-heartbeat-delivery-summary");

    await expect(summary).toBeInTheDocument();
    await expect(summary).toHaveTextContent("Attention delivery");
    await expect(summary).toHaveTextContent("separate from read + running");
    await expect(summary).toHaveTextContent("Message read-state and ai_call running stay observable");
    await expect(summary).toHaveTextContent("dispatching 1");
    await expect(summary).toHaveTextContent("accepted 0");
    await expect(summary).toHaveTextContent("attempt 1");
    await expect(summary).toHaveTextContent("ai_call #42");
    await expect(summary).toHaveTextContent("dispatching");
  },
} satisfies Story;

export const FirstReceiptErrorStaysErrored = {
  name: "Scenario: Given the first delivery receipt is a provider error When Heartbeat renders the delivery ledger Then the attempt stays errored without any accepted badge",
  args: {
    initialGroups,
    olderGroups: [],
    modelCalls: [],
    attention: attentionState,
    attentionDelivery: firstErrorDeliveryState,
    schedulerState: createSchedulerState({
      runtimeStatus: "blocked",
      phase: "waiting_commits",
      lastError: "provider rejected the first frame",
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const summary = canvas.getByTestId("runtime-heartbeat-delivery-summary");

    await expect(summary).toHaveTextContent("errored 1");
    await expect(summary).toHaveTextContent("accepted 0");
    await expect(summary).toHaveTextContent("run_error");
    await expect(summary).toHaveTextContent("attempt 1");
    await expect(summary).toHaveTextContent("errored");
  },
} satisfies Story;

export const RetryHistoryKeepsAttemptLedger = {
  name: "Scenario: Given the same attention commit retries after an earlier provider failure When Heartbeat renders the delivery ledger Then both attempts remain inspectable in order",
  args: {
    initialGroups,
    olderGroups: [],
    modelCalls: settledModelCalls,
    attention: attentionState,
    attentionDelivery: retryHistoryDeliveryState,
    schedulerState: createSchedulerState({
      runtimeStatus: "waiting",
      waitingReason: "attention_debt",
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const summary = canvas.getByTestId("runtime-heartbeat-delivery-summary");

    await expect(summary).toHaveTextContent("accepted 1");
    await expect(summary).toHaveTextContent("errored 0");
    await expect(summary).toHaveTextContent("attempt 1");
    await expect(summary).toHaveTextContent("attempt 2");
    await expect(summary).toHaveTextContent("run_error");
    await expect(summary).toHaveTextContent("text_delta");
    await expect(summary).toHaveTextContent("ai_call #54");
    await expect(summary).toHaveTextContent("ai_call #55");
  },
} satisfies Story;

export const RunningDurationTicks = {
  name: "Scenario: Given a running Heartbeat group header When wall-clock time advances Then the elapsed duration label updates without new Heartbeat rows",
  args: {
    initialGroups: createLiveRunningGroups(),
    olderGroups: [],
    modelCalls: streamingModelCalls,
    attention: attentionState,
    schedulerState: runningSchedulerState,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const timeNode = await canvas.findByTestId("runtime-heartbeat-entry-time-731");
    const initialLabel = timeNode.textContent;

    await new Promise((resolve) => window.setTimeout(resolve, 1_200));

    await waitFor(() => {
      expect(timeNode.textContent).not.toBe(initialLabel);
    });
  },
} satisfies Story;

export const ColdLoadingShowsExplicitState = {
  name: "Scenario: Given grouped Heartbeat history has not loaded yet When the stage opens Then the operator sees an explicit loading state instead of an empty ledger",
  args: {
    initialGroups: [],
    olderGroups: [],
    loaded: false,
    loading: true,
    schedulerState: createSchedulerState({
      runtimeStatus: "waiting",
      waitingReason: "room_inputs",
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId("runtime-heartbeat-empty")).toBeInTheDocument();
    await expect(canvas.getByText("Loading Heartbeat…")).toBeInTheDocument();
    expect(canvas.queryByText("No Heartbeat rows yet")).toBeNull();
    expect(canvas.queryByText(/groups$/)).toBeNull();
  },
} satisfies Story;

export const AsyncInitialLoadPinsLatest = {
  name: "Scenario: Given Heartbeat history hydrates after the stage shell opens When the first loaded groups arrive Then the viewport restores latest ownership and keeps Scroll to latest hidden",
  args: {
    initialGroups: [],
    olderGroups: [],
    loaded: false,
    loading: true,
    scheduledUpdates: [
      {
        type: "hydrate-groups" as const,
        afterMs: 80,
        groups: longStreamGroups,
        loaded: true,
        loading: false,
      },
    ],
    modelCalls: settledModelCalls,
    attention: attentionState,
    schedulerState: createSchedulerState({
      runtimeStatus: "waiting",
      waitingReason: "attention_debt",
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const viewport = canvas.getByTestId("runtime-heartbeat-viewport");
    const firstEntry = longStreamEntries[0];
    const lastEntry = longStreamEntries[longStreamEntries.length - 1];
    if (!firstEntry || !lastEntry) {
      throw new Error("Long stream fixtures are missing.");
    }

    await expect(canvas.getByText("Loading Heartbeat…")).toBeInTheDocument();

    await waitFor(() => {
      expect(canvas.queryByTestId(`runtime-heartbeat-entry-${lastEntry.id}`)).toBeInTheDocument();
      expect(canvas.queryByTestId(`runtime-heartbeat-entry-${firstEntry.id}`)).not.toBeInTheDocument();
      expect(viewport.scrollHeight).toBeGreaterThan(viewport.clientHeight);
    });
    await waitForViewportSettle(viewport);

    await waitFor(() => {
      if (viewport.scrollTop !== 0) {
        throw new Error(
          `Async initial load did not land at latest: ${describeViewportMetrics(viewport, canvasElement)}`,
        );
      }
      expect(getViewportDistanceToLatest(viewport)).toBeLessThanOrEqual(48);
      expect(canvas.queryByRole("button", { name: "Scroll to latest" })).toBeNull();
    });
  },
} satisfies Story;

export const WarmRefreshKeepsVisibleRows = {
  name: "Scenario: Given persisted Heartbeat rows are already mounted When a refresh starts Then the rows stay visible while the stage shows a secondary refresh signal",
  args: {
    initialGroups,
    olderGroups: [],
    loaded: true,
    refreshing: true,
    modelCalls: settledModelCalls,
    attention: attentionState,
    schedulerState: createSchedulerState({
      runtimeStatus: "waiting",
      waitingReason: "attention_debt",
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId("runtime-heartbeat-group-412")).toBeInTheDocument();
    await expect(canvas.getByText("Refreshing persisted Heartbeat…")).toBeInTheDocument();
    expect(canvas.queryByTestId("runtime-heartbeat-empty")).toBeNull();
  },
} satisfies Story;

export const CompactActionForwardsRequest = {
  name: "Scenario: Given the footer Compact action is available When the operator clicks it Then the manual runtime compact callback fires without injecting transcript content",
  args: {
    initialGroups,
    olderGroups: [],
    loaded: true,
    modelCalls: settledModelCalls,
    attention: attentionState,
    schedulerState: createSchedulerState({
      runtimeStatus: "waiting",
      waitingReason: "attention_debt",
    }),
    onRequestCompact: requestCompact,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const compactButton = canvas.getByRole("button", { name: "Compact" });
    await userEvent.click(compactButton);
    await expect(requestCompact).toHaveBeenCalledTimes(1);
  },
} satisfies Story;

export const StreamingToolCallRemainsVisible = {
  name: "Scenario: Given a running Heartbeat tool call has no result yet When the stage renders Then the tool row stays visible without empty-string parameter chrome",
  args: {
    initialGroups: streamingToolGroups,
    olderGroups: [],
    modelCalls: streamingModelCalls,
    attention: attentionState,
    schedulerState: runningSchedulerState,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const entry = canvas.getByTestId("runtime-heartbeat-entry-26");
    await expect(entry).toBeInTheDocument();
    await expect(entry).toHaveTextContent("root_bash");
    await expect(entry).toHaveTextContent("Running");
    await expect(entry).toHaveTextContent("message send --compact");
    await expect(entry).toHaveTextContent("Parameters");
    expect(entry.textContent).not.toContain("Pending");
    expect(entry.textContent).not.toContain("Completed");
  },
} satisfies Story;

export const EmptyLedgerShowsExplicitState = {
  name: "Scenario: Given no persisted Heartbeat rows When the stage opens Then the operator sees an explicit empty state instead of a blank panel",
  args: {
    initialGroups: [],
    olderGroups: [],
    loaded: true,
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
    schedulerState: createSchedulerState({
      runtimeStatus: "waiting",
      waitingReason: "attention_debt",
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const entry = canvas.getByTestId("runtime-heartbeat-entry-520") as HTMLElement;
    const body = canvas.getByTestId("runtime-heartbeat-entry-body-520") as HTMLElement;

    await waitFor(() => {
      expect(body.dataset.overflowState).toBe("collapsed");
      expect(body.style.maxHeight).toBe("12rem");
      expect(body.style.overflow).toBe("hidden");
    });

    const collapsedHeight = entry.getBoundingClientRect().height;
    await userEvent.click(within(entry).getByRole("radio", { name: "Detailed" }));

    await waitFor(() => {
      expect(body.dataset.overflowState).toBe("expanded");
      expect(within(entry).getByRole("button", { name: "Collapse" })).toBeInTheDocument();
    });

    const expandedHeight = entry.getBoundingClientRect().height;
    expect(expandedHeight).toBeGreaterThan(collapsedHeight + 32);

    await userEvent.click(within(entry).getByRole("radio", { name: "Compact" }));

    await waitFor(() => {
      expect(body.dataset.overflowState).toBe("collapsed");
      expect(within(entry).getByRole("button", { name: "Expand" })).toBeInTheDocument();
    });

    await userEvent.click(within(entry).getByRole("button", { name: "Expand" }));

    await waitFor(() => {
      expect(body.dataset.overflowState).toBe("expanded");
      expect(within(entry).getByRole("button", { name: "Collapse" })).toBeInTheDocument();
    });

    await userEvent.click(within(entry).getByRole("button", { name: "Collapse" }));

    await waitFor(() => {
      expect(body.dataset.overflowState).toBe("collapsed");
      expect(within(entry).getByRole("button", { name: "Expand" })).toBeInTheDocument();
    });
  },
} satisfies Story;
