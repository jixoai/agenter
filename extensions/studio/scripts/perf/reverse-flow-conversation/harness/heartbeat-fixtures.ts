import type { HeartbeatGroupItem, HeartbeatPartItem, SessionEntry } from "@agenter/client-sdk";

export type HeartbeatPerfScenarioId = "heartbeat-append" | "heartbeat-growth" | "heartbeat-initial" | "heartbeat-load-older";

export interface HeartbeatPerfScenario {
  appendedGroup: HeartbeatGroupItem;
  grownGroup: HeartbeatGroupItem;
  initialGroups: HeartbeatGroupItem[];
  olderGroups: HeartbeatGroupItem[];
  sessionStatus: SessionEntry["status"];
}

const baseTime = Date.UTC(2026, 3, 17, 10, 0, 0);

const buildNarrative = (index: number, variant: number): string => {
  const repeated = Array.from({ length: 2 + (variant % 5) }, (_unused, lineIndex) => {
    return `- segment ${lineIndex + 1}: reverse-flow sample ${index} keeps the latest viewport anchored while variable-height content expands.`;
  }).join("\n");
  return `Heartbeat group ${index}\n${repeated}\n\n\`\`\`yaml\nload_more: ${index % 2 === 0}\nvariant: ${variant}\n\`\`\``;
};

const buildUserEntry = (groupIndex: number, createdAt: number): HeartbeatPartItem => ({
  id: groupIndex * 10 + 1,
  aiCallId: groupIndex,
  createdAt,
  isComplete: true,
  messageId: `heartbeat-user-${groupIndex}`,
  parts: [
    {
      aiCallId: groupIndex,
      createdAt,
      isComplete: true,
      messageId: `heartbeat-user-${groupIndex}`,
      mimeType: null,
      partId: groupIndex * 100 + 1,
      partIndex: 0,
      partType: "text",
      payload: {
        content: `operator message ${groupIndex}`,
        type: "text",
      },
      role: "user",
      roundIndex: groupIndex,
      scope: "heartbeat_part",
      updatedAt: createdAt,
      windowId: null,
    },
  ],
  role: "user",
  roundIndex: groupIndex,
  scope: "heartbeat_part",
  text: `operator message ${groupIndex}`,
  updatedAt: createdAt,
  windowId: null,
});

const buildAssistantEntry = (groupIndex: number, createdAt: number, variant: number, expanded = false): HeartbeatPartItem => {
  const text = buildNarrative(groupIndex, expanded ? variant + 5 : variant);
  return {
    id: groupIndex * 10 + 2,
    aiCallId: groupIndex,
    createdAt: createdAt + 300,
    isComplete: !expanded,
    messageId: `heartbeat-assistant-${groupIndex}`,
    parts: [
      {
        aiCallId: groupIndex,
        createdAt: createdAt + 300,
        isComplete: true,
        messageId: `heartbeat-assistant-${groupIndex}`,
        mimeType: null,
        partId: groupIndex * 100 + 2,
        partIndex: 0,
        partType: "tool_call",
        payload: {
          input: {
            command: `pnpm --filter runtime-${groupIndex} test -- --grep reverse-flow-${variant}`,
          },
          invocationId: `perf-invocation-${groupIndex}`,
          startedAt: createdAt + 300,
          tool: "root_bash",
        },
        role: "assistant",
        roundIndex: groupIndex,
        scope: "heartbeat_part",
        updatedAt: createdAt + 300,
        windowId: null,
      },
      {
        aiCallId: groupIndex,
        createdAt: createdAt + 450,
        isComplete: true,
        messageId: `heartbeat-assistant-${groupIndex}`,
        mimeType: null,
        partId: groupIndex * 100 + 3,
        partIndex: 1,
        partType: "tool_result",
        payload: {
          error: null,
          finishedAt: createdAt + 450,
          invocationId: `perf-invocation-${groupIndex}`,
          output: {
            stdout: `trace sample ${groupIndex}`,
          },
          tool: "root_bash",
        },
        role: "assistant",
        roundIndex: groupIndex,
        scope: "heartbeat_part",
        updatedAt: createdAt + 450,
        windowId: null,
      },
      {
        aiCallId: groupIndex,
        createdAt: createdAt + 600,
        isComplete: !expanded,
        messageId: `heartbeat-assistant-${groupIndex}`,
        mimeType: null,
        partId: groupIndex * 100 + 4,
        partIndex: 2,
        partType: "text",
        payload: {
          content: text,
          type: "text",
        },
        role: "assistant",
        roundIndex: groupIndex,
        scope: "heartbeat_part",
        updatedAt: createdAt + (expanded ? 1_800 : 750),
        windowId: null,
      },
    ],
    role: "assistant",
    roundIndex: groupIndex,
    scope: "heartbeat_part",
    text,
    updatedAt: createdAt + (expanded ? 1_800 : 750),
    windowId: null,
  };
};

const buildGroup = (groupIndex: number, variant: number, expanded = false): HeartbeatGroupItem => {
  const createdAt = baseTime + groupIndex * 12_000;
  return {
    aiCallId: groupIndex,
    createdAt,
    groupId: `heartbeat-group-${groupIndex}`,
    id: groupIndex,
    isComplete: !expanded,
    items: [buildUserEntry(groupIndex, createdAt), buildAssistantEntry(groupIndex, createdAt, variant, expanded)],
    kind: "call",
    updatedAt: createdAt + (expanded ? 1_800 : 750),
  };
};

const buildGroups = (startIndex: number, count: number, variantOffset = 0): HeartbeatGroupItem[] =>
  Array.from({ length: count }, (_unused, offset) => buildGroup(startIndex + offset, variantOffset + offset));

const baseInitialGroups = buildGroups(101, 32, 1);
const olderGroups = buildGroups(61, 24, 41);
const appendedGroup = buildGroup(200, 91);
const growthSeedGroup = buildGroup(199, 83);
const grownGroup = buildGroup(199, 83, true);

export const getHeartbeatPerfScenario = (scenarioId: HeartbeatPerfScenarioId): HeartbeatPerfScenario => {
  if (scenarioId === "heartbeat-growth") {
    return {
      appendedGroup,
      grownGroup,
      initialGroups: [...baseInitialGroups.slice(0, -1), growthSeedGroup],
      olderGroups,
      sessionStatus: "running",
    };
  }

  return {
    appendedGroup,
    grownGroup,
    initialGroups: baseInitialGroups,
    olderGroups,
    sessionStatus: "running",
  };
};
