import { randomUUID } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

import { parse as parseYaml } from "yaml";
import { z } from "zod";

export const MOCK_RELAY_PROMPT = "在吗？kzf 问你中午吃什么？";
export const MOCK_GAUBEE_REPLY = "中午吃蛋炒饭。";
export const MOCK_FINAL_ANSWER = "gaubee 说中午吃蛋炒饭。";
export const MOCK_WAITING_SUMMARY = "waiting for gaubee";
export const MOCK_REPORTED_SUMMARY = `reported to kzf: ${MOCK_FINAL_ANSWER}`;
export const MOCK_MAIN_RESOLVED_SUMMARY = "relay resolved after gaubee reply";
export const MOCK_FOLLOW_UP_SUMMARY = `answered from compact memory: ${MOCK_FINAL_ANSWER}`;

const toolCallSchema = z.object({
  id: z.string(),
  type: z.literal("function"),
  function: z.object({
    name: z.string(),
    arguments: z.string(),
  }),
});

const messageSchema = z.object({
  role: z.enum(["system", "user", "assistant", "tool"]),
  content: z.string().nullable().optional(),
  tool_calls: z.array(toolCallSchema).optional(),
  tool_call_id: z.string().optional(),
});

const requestSchema = z.object({
  model: z.string(),
  messages: z.array(messageSchema),
  tools: z
    .array(
      z.object({
        type: z.literal("function"),
        function: z.object({
          name: z.string(),
          description: z.string().optional(),
        }),
      }),
    )
    .optional(),
});

type ChatCompletionRequest = z.infer<typeof requestSchema>;
type ChatMessage = z.infer<typeof messageSchema>;
type ChatToolCall = z.infer<typeof toolCallSchema>;

interface AttentionCommit {
  contextId?: string;
  commitId?: string;
  scores?: Record<string, number>;
  summary?: string;
  change?: {
    type?: string;
    value?: string;
  };
}

interface AttentionFrame {
  contextId: string;
  commits: AttentionCommit[];
}

interface PromptWindowCompactSummary {
  overview?: string;
  decisions: string[];
  keyFacts: string[];
  unresolvedWork: string[];
  nextSteps: string[];
}

interface ToolResult {
  callId: string;
  operation: string;
  content: string;
  data: unknown;
  command?: string;
}

interface RelayProgressState {
  originChatId: string;
  targetChatId: string;
  expectedTargetRowIdAfterRelay: number;
  originContextId?: string;
  originHeadCommitId?: string;
  originScores?: Record<string, number>;
  phase: "awaiting_reply" | "reporting" | "reported";
}

interface MockModelServerState {
  relay: RelayProgressState | null;
}

const PRINCIPAL_ROOM_ID_PATTERN = /^0x[0-9a-f]{40}$/;
const PRIMARY_ROOM_CONTEXT_PATTERN = /^ctx-(0x[0-9a-f]{40})$/;
const promptWindowCompactPattern = /```yaml\+prompt_window_compact\s*([\s\S]*?)```/g;
const attentionSystemSectionPattern = /(?:^|\n)# attention_system\n([\s\S]*)$/;

export interface MockModelServerHandle {
  baseUrl: string;
  stop: () => Promise<void>;
  requests: ChatCompletionRequest[];
}

const readBody = async (request: IncomingMessage): Promise<string> => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
};

const safeJsonParse = (input: string): unknown => {
  try {
    return JSON.parse(input);
  } catch {
    return input;
  }
};

const safeYamlParse = (input: string): unknown => {
  try {
    return parseYaml(input);
  } catch {
    return null;
  }
};

const parseRootWorkspaceShellCommand = (input: string | undefined): string | null => {
  if (typeof input !== "string") {
    return null;
  }
  const command = input.trim();
  return command.length > 0 ? command : null;
};

const toCliCommandFact = (command: string | null): string | null => {
  if (!command) {
    return null;
  }
  if (command === "message list") {
    return "message.list";
  }
  if (command.startsWith("message send ")) {
    return "message.send";
  }
  if (command.startsWith("attention commit ")) {
    return "attention.commit";
  }
  return null;
};

const parseShellToolPayload = (content: string): unknown => {
  const outer = safeJsonParse(content);
  if (!outer || typeof outer !== "object") {
    return outer;
  }
  const stdout = typeof (outer as { stdout?: unknown }).stdout === "string" ? (outer as { stdout: string }).stdout : null;
  if (!stdout) {
    return outer;
  }
  return safeJsonParse(stdout.trim());
};

const findLastIndex = <T>(items: readonly T[], predicate: (item: T) => boolean): number => {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if (predicate(items[index]!)) {
      return index;
    }
  }
  return -1;
};

const extractCurrentCycleUserMessages = (
  messages: readonly ChatMessage[],
): { users: ChatMessage[]; afterUsers: ChatMessage[] } => {
  const lastUserIndex = findLastIndex(messages, (message) => message.role === "user");
  if (lastUserIndex < 0) {
    return { users: [], afterUsers: [] };
  }
  let start = lastUserIndex;
  while (start > 0 && messages[start - 1]?.role === "user") {
    start -= 1;
  }
  return {
    users: messages.slice(start, lastUserIndex + 1),
    afterUsers: messages.slice(lastUserIndex + 1),
  };
};

const extractLatestAttentionMetadata = (
  messages: readonly ChatMessage[],
): { contextId?: string; headCommitId?: string } => {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const content = messages[index]?.content ?? "";
    const contextIdMatch = content.match(/primaryContextId:\s*([^\s]+)/);
    const headCommitMatch = content.match(/headCommitId:\s*([^\s]+)/);
    if (contextIdMatch || headCommitMatch) {
      return {
        contextId: contextIdMatch?.[1],
        headCommitId: headCommitMatch?.[1],
      };
    }
  }
  return {};
};

const attentionFencePattern = /```yaml\+attention_items\s*([\s\S]*?)```/g;

const normalizeAttentionCommit = (
  item: Record<string, unknown>,
  fallbackContextId: string,
): AttentionCommit => ({
  contextId: typeof item.contextId === "string" ? item.contextId : fallbackContextId,
  commitId: typeof item.commitId === "string" ? item.commitId : undefined,
  scores:
    item.scores && typeof item.scores === "object"
      ? Object.fromEntries(
          Object.entries(item.scores as Record<string, unknown>).flatMap(([key, value]) =>
            typeof value === "number" ? ([[key, value]] as const) : [],
          ),
        )
      : undefined,
  summary: typeof item.summary === "string" ? item.summary : undefined,
  change:
    item.change && typeof item.change === "object"
      ? {
          type:
            typeof (item.change as Record<string, unknown>).type === "string"
              ? ((item.change as Record<string, unknown>).type as string)
              : undefined,
          value:
            typeof (item.change as Record<string, unknown>).value === "string"
              ? ((item.change as Record<string, unknown>).value as string)
              : undefined,
        }
      : undefined,
});

const extractAttentionFrames = (messages: readonly ChatMessage[]): AttentionFrame[] => {
  const frames: AttentionFrame[] = [];
  for (const message of messages) {
    const content = message.content ?? "";
    for (const match of content.matchAll(attentionFencePattern)) {
      const yaml = match[1]?.trim();
      if (!yaml) {
        continue;
      }
      const parsed = safeYamlParse(yaml);
      if (!parsed || typeof parsed !== "object") {
        continue;
      }
      const record = parsed as Record<string, unknown>;
      const activeContextsRaw = Array.isArray(record.activeContexts) ? record.activeContexts : [];
      if (activeContextsRaw.length > 0) {
        for (const activeContext of activeContextsRaw) {
          if (!activeContext || typeof activeContext !== "object") {
            continue;
          }
          const activeContextRecord = activeContext as Record<string, unknown>;
          const contextId = typeof activeContextRecord.contextId === "string" ? activeContextRecord.contextId : null;
          const commitsRaw = Array.isArray(activeContextRecord.recentCommits) ? activeContextRecord.recentCommits : [];
          if (!contextId || commitsRaw.length === 0) {
            continue;
          }
          const commits = commitsRaw
            .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
            .map((item) => normalizeAttentionCommit(item, contextId));
          frames.push({ contextId, commits });
        }
        continue;
      }
      const contextId = typeof record.contextId === "string" ? record.contextId : null;
      const commitsRaw = Array.isArray(record.commits) ? record.commits : [];
      if (!contextId || commitsRaw.length === 0) {
        continue;
      }
      const commits = commitsRaw
        .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
        .map((item) => normalizeAttentionCommit(item, contextId));
      frames.push({ contextId, commits });
    }
  }
  return frames;
};

const extractAttentionSystemFrames = (messages: readonly ChatMessage[]): AttentionFrame[] => {
  const frames: AttentionFrame[] = [];
  for (const message of messages) {
    const content = message.content ?? "";
    const match = content.match(attentionSystemSectionPattern);
    const rawPayload = match?.[1]?.trim();
    if (!rawPayload) {
      continue;
    }
    const parsed = safeJsonParse(rawPayload);
    if (!Array.isArray(parsed)) {
      continue;
    }
    for (const item of parsed) {
      if (!item || typeof item !== "object") {
        continue;
      }
      const record = item as Record<string, unknown>;
      const contextId = typeof record.contextId === "string" ? record.contextId : null;
      const commitsRaw = Array.isArray(record.recentCommits) ? record.recentCommits : [];
      if (!contextId || commitsRaw.length === 0) {
        continue;
      }
      const commits = commitsRaw
        .filter((commit): commit is Record<string, unknown> => Boolean(commit) && typeof commit === "object")
        .map((commit) => normalizeAttentionCommit(commit, contextId));
      frames.push({ contextId, commits });
    }
  }
  return frames;
};

const extractPromptWindowCompactSummaries = (messages: readonly ChatMessage[]): PromptWindowCompactSummary[] => {
  const summaries: PromptWindowCompactSummary[] = [];
  for (const message of messages) {
    const content = message.content ?? "";
    for (const match of content.matchAll(promptWindowCompactPattern)) {
      const yaml = match[1]?.trim();
      if (!yaml) {
        continue;
      }
      const parsed = safeYamlParse(yaml);
      if (!parsed || typeof parsed !== "object") {
        continue;
      }
      const record = parsed as Record<string, unknown>;
      const toTextList = (value: unknown): string[] =>
        Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.length > 0) : [];
      summaries.push({
        overview: typeof record.overview === "string" ? record.overview : undefined,
        decisions: toTextList(record.decisions),
        keyFacts: toTextList(record.keyFacts),
        unresolvedWork: toTextList(record.unresolvedWork),
        nextSteps: toTextList(record.nextSteps),
      });
    }
  }
  return summaries;
};

const mergeAttentionFrames = (...groups: readonly AttentionFrame[][]): AttentionFrame[] => {
  const mergedByContextId = new Map<string, AttentionFrame>();
  for (const frames of groups) {
    for (const frame of frames) {
      const existing = mergedByContextId.get(frame.contextId);
      if (!existing) {
        mergedByContextId.set(frame.contextId, {
          contextId: frame.contextId,
          commits: [...frame.commits],
        });
        continue;
      }
      existing.commits.push(...frame.commits);
    }
  }
  return [...mergedByContextId.values()];
};

const appendUniqueText = (texts: string[], value: string | undefined): void => {
  if (!value) {
    return;
  }
  const normalized = value.trim();
  if (normalized.length === 0 || texts.includes(normalized)) {
    return;
  }
  texts.push(normalized);
};

const collectSemanticTexts = (messages: readonly ChatMessage[]): string => {
  const texts: string[] = [];
  for (const message of messages) {
    appendUniqueText(texts, message.content ?? undefined);
  }
  for (const frame of mergeAttentionFrames(extractAttentionFrames(messages), extractAttentionSystemFrames(messages))) {
    for (const commit of frame.commits) {
      appendUniqueText(texts, commit.summary);
      appendUniqueText(texts, commit.change?.value);
    }
  }
  for (const summary of extractPromptWindowCompactSummaries(messages)) {
    appendUniqueText(texts, summary.overview);
    for (const decision of summary.decisions) {
      appendUniqueText(texts, decision);
    }
    for (const keyFact of summary.keyFacts) {
      appendUniqueText(texts, keyFact);
    }
    for (const unresolvedWork of summary.unresolvedWork) {
      appendUniqueText(texts, unresolvedWork);
    }
    for (const nextStep of summary.nextSteps) {
      appendUniqueText(texts, nextStep);
    }
  }
  return texts.join("\n");
};

const extractToolResults = (messages: readonly ChatMessage[]): ToolResult[] => {
  const callMetaById = new Map<string, { name: string; command: string | null }>();
  const results: ToolResult[] = [];
  for (const message of messages) {
    for (const call of message.tool_calls ?? []) {
      const parsedArgs = safeJsonParse(call.function.arguments);
      const shellCommand =
        call.function.name === "root_workspace_bash" && parsedArgs && typeof parsedArgs === "object"
          ? parseRootWorkspaceShellCommand((parsedArgs as { command?: unknown }).command as string | undefined)
          : null;
      callMetaById.set(call.id, {
        name: call.function.name,
        command: shellCommand,
      });
    }
    if (message.role !== "tool" || !message.tool_call_id) {
      continue;
    }
    const callMeta = callMetaById.get(message.tool_call_id);
    if (!callMeta) {
      continue;
    }
    const content = message.content ?? "";
    const commandFact = callMeta.name === "root_workspace_bash" ? toCliCommandFact(callMeta.command) : null;
    results.push({
      callId: message.tool_call_id,
      operation: commandFact ?? callMeta.name,
      content,
      data: commandFact ? parseShellToolPayload(content) : safeJsonParse(content),
      command: callMeta.command ?? undefined,
    });
  }
  return results;
};

const listAssistantTexts = (messages: readonly ChatMessage[]): string[] =>
  messages
    .filter((message) => message.role === "assistant")
    .map((message) => message.content ?? "")
    .filter((content) => content.length > 0);

const assistantHistoryHasCommitSummary = (history: string, summary: string): boolean =>
  history.includes(`summary: "${summary}"`) ||
  history.includes(`summary: '${summary}'`) ||
  history.includes(`"summary":"${summary}"`);

const hasOperationResult = (results: readonly ToolResult[], operation: string): boolean =>
  results.some((result) => result.operation === operation);

const findLatestOperationResult = (results: readonly ToolResult[], operation: string): ToolResult | null =>
  [...results].reverse().find((result) => result.operation === operation) ?? null;

const findGaubeeChatId = (results: readonly ToolResult[]): string | null => {
  const channelList = findLatestOperationResult(results, "message.list");
  if (!channelList || !channelList.data || typeof channelList.data !== "object") {
    return null;
  }
  const channels = (channelList.data as { channels?: unknown }).channels;
  if (!Array.isArray(channels)) {
    return null;
  }
  for (const channel of channels) {
    if (!channel || typeof channel !== "object") {
      continue;
    }
    const record = channel as {
      chatId?: unknown;
      title?: unknown;
      participants?: Array<{ id?: unknown; label?: unknown }>;
    };
    const title = typeof record.title === "string" ? record.title : "";
    const participants = Array.isArray(record.participants) ? record.participants : [];
    const matchesGaubee =
      title.toLowerCase().includes("gaubee") ||
      participants.some((participant) =>
        typeof participant?.label === "string"
          ? participant.label.toLowerCase().includes("gaubee")
          : typeof participant?.id === "string" && participant.id.toLowerCase().includes("gaubee"),
      );
    if (matchesGaubee && typeof record.chatId === "string") {
      return record.chatId;
    }
  }
  return null;
};

const findPrimaryRoomChatId = (results: readonly ToolResult[], frames: readonly AttentionFrame[]): string | null => {
  const channelList = findLatestOperationResult(results, "message.list");
  if (channelList && channelList.data && typeof channelList.data === "object") {
    const channels = (channelList.data as { channels?: unknown }).channels;
    if (Array.isArray(channels)) {
      for (const channel of channels) {
        if (!channel || typeof channel !== "object") {
          continue;
        }
        const record = channel as {
          chatId?: unknown;
          metadata?: Record<string, unknown>;
        };
        const chatId = typeof record.chatId === "string" ? record.chatId : null;
        if (!chatId) {
          continue;
        }
        if (record.metadata?.primaryRoom === true || PRINCIPAL_ROOM_ID_PATTERN.test(chatId)) {
          return chatId;
        }
      }
    }
  }
  const frame = frames.find((item) => PRIMARY_ROOM_CONTEXT_PATTERN.test(item.contextId));
  return frame ? frame.contextId.slice(4) : null;
};

const extractChannelRows = (results: readonly ToolResult[]): Map<string, number> => {
  const rows = new Map<string, number>();
  const channelList = findLatestOperationResult(results, "message.list");
  if (!channelList || !channelList.data || typeof channelList.data !== "object") {
    return rows;
  }
  const channels = (channelList.data as { channels?: unknown }).channels;
  if (!Array.isArray(channels)) {
    return rows;
  }
  for (const channel of channels) {
    if (!channel || typeof channel !== "object") {
      continue;
    }
    const record = channel as {
      chatId?: unknown;
      readProgress?: { latestVisibleMessageRowId?: unknown };
    };
    if (
      typeof record.chatId === "string" &&
      typeof record.readProgress?.latestVisibleMessageRowId === "number"
    ) {
      rows.set(record.chatId, record.readProgress.latestVisibleMessageRowId);
    }
  }
  return rows;
};

const parseMessageSendCommandPayload = (command: string | undefined): { chatId?: string; content?: string } | null => {
  if (!command?.startsWith("message send ")) {
    return null;
  }
  const parsedOuter = safeJsonParse(command.slice("message send ".length));
  const parsedInner = typeof parsedOuter === "string" ? safeJsonParse(parsedOuter) : parsedOuter;
  if (!parsedInner || typeof parsedInner !== "object") {
    return null;
  }
  const record = parsedInner as { chatId?: unknown; content?: unknown };
  return {
    chatId: typeof record.chatId === "string" ? record.chatId : undefined,
    content: typeof record.content === "string" ? record.content : undefined,
  };
};

const buildSeededRelayFrames = (relay: RelayProgressState | null): AttentionFrame[] => {
  if (!relay?.originContextId || !relay.originHeadCommitId) {
    return [];
  }
  return [
    {
      contextId: relay.originContextId,
      commits: [
        {
          contextId: relay.originContextId,
          commitId: relay.originHeadCommitId,
          scores: relay.originScores ? { ...relay.originScores } : undefined,
        },
      ],
    },
  ];
};

const pickCurrentFrames = (frames: readonly AttentionFrame[]): AttentionFrame[] =>
  frames.map((frame) => ({
    contextId: frame.contextId,
    commits: [...frame.commits],
  }));

const buildScores = (scores: Record<string, number> | undefined, mode: "wait" | "done"): Record<string, number> => {
  const source = scores && Object.keys(scores).length > 0 ? scores : { main: 100 };
  return Object.fromEntries(
    Object.entries(source).map(([key, value]) => [key, mode === "done" ? 0 : Math.max(1, Math.floor(value / 2) || 50)]),
  );
};

const buildRootWorkspaceBashToolCall = (command: string): ChatToolCall => ({
  id: randomUUID(),
  type: "function",
  function: {
    name: "root_workspace_bash",
    arguments: JSON.stringify({ command }),
  },
});

const escapeShellJson = (value: unknown): string => JSON.stringify(JSON.stringify(value));

const buildAttentionCommitShellCalls = (
  frames: readonly AttentionFrame[],
  input: {
    summary: string;
    value: string;
    stage: "act" | "done";
    done: boolean;
    scoreMode: "wait" | "done";
  },
): ChatToolCall[] =>
  frames
    .map((frame) => {
      const latestCommit = frame.commits.at(-1);
      if (!latestCommit?.commitId) {
        return null;
      }
      const payload = {
        contextId: frame.contextId,
        parentCommitIds: [latestCommit.commitId],
        meta: {
          author: "assistant",
          source: "mock-model-server",
        },
        ...(input.scoreMode === "wait" ? { scores: buildScores(latestCommit.scores, input.scoreMode) } : {}),
        summary: input.summary,
        change: {
          type: "update",
          value: input.value,
          format: "text/plain",
        },
        done: input.done,
        stage: input.stage,
      };
      return buildRootWorkspaceBashToolCall(`attention commit ${escapeShellJson(payload)}`);
    })
    .filter((call): call is ChatToolCall => call !== null);

const createResponse = (request: ChatCompletionRequest, input: { content?: string; toolCalls?: ChatToolCall[] }) => ({
  id: `mock-${randomUUID()}`,
  object: "chat.completion",
  created: Math.floor(Date.now() / 1_000),
  model: request.model,
  choices: [
    {
      index: 0,
      finish_reason: input.toolCalls && input.toolCalls.length > 0 ? "tool_calls" : "stop",
      message: {
        role: "assistant",
        content: input.content ?? null,
        ...(input.toolCalls && input.toolCalls.length > 0 ? { tool_calls: input.toolCalls } : {}),
      },
    },
  ],
  usage: {
    prompt_tokens: 0,
    completion_tokens: 0,
    total_tokens: 0,
  },
});

const isSummaryRequest = (request: ChatCompletionRequest): boolean => (request.tools?.length ?? 0) === 0;

const decideSummary = (request: ChatCompletionRequest, state: MockModelServerState) => {
  const history = request.messages.map((message) => message.content ?? "").join("\n");
  const hasLunchConclusion =
    state.relay?.phase === "reported" || history.includes(MOCK_GAUBEE_REPLY) || history.includes("蛋炒饭");
  const frames = pickCurrentFrames(extractAttentionFrames(request.messages));
  const toolResults = extractToolResults(request.messages);
  const primaryRoomChatId = state.relay?.originChatId ?? findPrimaryRoomChatId(toolResults, frames);
  return createResponse(request, {
    content: JSON.stringify({
      overview: hasLunchConclusion ? "gaubee lunch relay compacted" : "lunch relay still unresolved",
      decisions: hasLunchConclusion ? ["gaubee said lunch is egg fried rice"] : [],
      keyFiles: [],
      keyFacts: hasLunchConclusion ? [MOCK_GAUBEE_REPLY, MOCK_FINAL_ANSWER] : [],
      readyReplies: hasLunchConclusion && primaryRoomChatId
        ? [
            {
              channelId: primaryRoomChatId,
              topic: "gaubee lunch answer",
              triggerPhrases: ["gaubee在吗？问他中午吃什么？", "中午吃什么"],
              reply: MOCK_FINAL_ANSWER,
              reuseWhen: "Send directly when the primary room asks the same lunch question again after compact.",
            },
          ]
        : [],
      unresolvedWork: hasLunchConclusion ? [] : ["still waiting for gaubee lunch answer"],
      nextSteps: hasLunchConclusion ? ["answer future lunch follow-ups from compact memory"] : ["wait for gaubee reply"],
    }),
  });
};

const decideChat = (request: ChatCompletionRequest, state: MockModelServerState) => {
  const { users, afterUsers } = extractCurrentCycleUserMessages(request.messages);
  const nonSystemMessages = request.messages.filter((message) => message.role !== "system");
  const directCurrentSemanticText = collectSemanticTexts(users);
  const allSemanticText = collectSemanticTexts(nonSystemMessages);
  const taskSemanticText =
    directCurrentSemanticText.includes("gaubee在吗") ||
    directCurrentSemanticText.includes("中午吃什么") ||
    directCurrentSemanticText.includes(MOCK_GAUBEE_REPLY) ||
    directCurrentSemanticText.includes(MOCK_WAITING_SUMMARY)
      ? directCurrentSemanticText
      : allSemanticText;
  const currentFrames = pickCurrentFrames(mergeAttentionFrames(extractAttentionFrames(users), extractAttentionSystemFrames(users)));
  const allFrames = pickCurrentFrames(
    mergeAttentionFrames(extractAttentionFrames(request.messages), extractAttentionSystemFrames(request.messages)),
  );
  const toolResults = extractToolResults(afterUsers);
  const assistantHistory = listAssistantTexts(request.messages).join("\n");
  const latestAttentionMetadata = extractLatestAttentionMetadata(users);
  const channelRows = extractChannelRows(toolResults);
  const latestSentRoomReply = findLatestOperationResult(toolResults, "message.send");
  const latestSentRoomReplyPayload = parseMessageSendCommandPayload(latestSentRoomReply?.command);
  const toolNames = new Set((request.tools ?? []).map((tool) => tool.function.name));
  if (!toolNames.has("root_workspace_bash")) {
    throw new Error("mock-model-server expects CLI-only runtime tools with root_workspace_bash");
  }
  if (
    state.relay?.phase === "reporting" &&
    latestSentRoomReplyPayload?.chatId === state.relay.originChatId &&
    latestSentRoomReplyPayload.content === MOCK_FINAL_ANSWER
  ) {
    const seededFrames = buildSeededRelayFrames(state.relay);
    if (!hasOperationResult(toolResults, "attention.commit") && seededFrames.length > 0) {
      return createResponse(request, {
        toolCalls: buildAttentionCommitShellCalls(seededFrames, {
          summary: MOCK_MAIN_RESOLVED_SUMMARY,
          value: MOCK_FINAL_ANSWER,
          stage: "done",
          done: true,
          scoreMode: "done",
        }),
      });
    }
    state.relay.phase = "reported";
  }
  const commitFrames =
    currentFrames.length > 0
      ? currentFrames
      : allFrames.length > 0
        ? allFrames
        : buildSeededRelayFrames(state.relay);
  if (state.relay?.phase === "reporting") {
    return createResponse(request, { content: "" });
  }
  const primaryRoomChatId = state.relay?.originChatId ?? findPrimaryRoomChatId(toolResults, allFrames);

  const hasReportedHistory =
    assistantHistoryHasCommitSummary(assistantHistory, MOCK_REPORTED_SUMMARY) ||
    assistantHistory.includes(MOCK_FINAL_ANSWER) ||
    (assistantHistory.includes("prompt_window_compact") && assistantHistory.includes("蛋炒饭"));
  const hasWaitingHistory = assistantHistoryHasCommitSummary(assistantHistory, MOCK_WAITING_SUMMARY);

  const followUpQuestion = taskSemanticText.includes("中午吃什么") && !taskSemanticText.includes("gaubee在吗");
  const includesGaubeeReply = allSemanticText.includes(MOCK_GAUBEE_REPLY);
  const initialQuestion = taskSemanticText.includes("gaubee在吗") || taskSemanticText.includes(MOCK_WAITING_SUMMARY);
  const canReuseReportedAnswer = state.relay?.phase === "reported" && taskSemanticText.includes("中午吃什么");
  if (canReuseReportedAnswer) {
    if (hasOperationResult(toolResults, "message.send") || !primaryRoomChatId) {
      return createResponse(request, { content: "" });
    }
    return createResponse(request, {
      toolCalls: [
        buildRootWorkspaceBashToolCall(
          `message send ${escapeShellJson({ chatId: primaryRoomChatId, content: MOCK_FINAL_ANSWER })}`,
        ),
        ...buildAttentionCommitShellCalls(commitFrames, {
          summary: MOCK_FOLLOW_UP_SUMMARY,
          value: MOCK_FINAL_ANSWER,
          stage: "done",
          done: true,
          scoreMode: "done",
        }),
      ],
    });
  }
  if (state.relay?.phase === "reported") {
    return createResponse(request, { content: "" });
  }

  if (state.relay?.phase === "awaiting_reply") {
    const observedTargetRowId = channelRows.get(state.relay.targetChatId);
    if (
      typeof observedTargetRowId === "number" &&
      observedTargetRowId > state.relay.expectedTargetRowIdAfterRelay &&
      primaryRoomChatId
    ) {
      state.relay.phase = "reporting";
      return createResponse(request, {
        toolCalls: [
          buildRootWorkspaceBashToolCall(
            `message send ${escapeShellJson({ chatId: primaryRoomChatId, content: MOCK_FINAL_ANSWER })}`,
          ),
          ...buildAttentionCommitShellCalls(commitFrames, {
            summary: MOCK_REPORTED_SUMMARY,
            value: MOCK_FINAL_ANSWER,
            stage: "done",
            done: true,
            scoreMode: "done",
          }),
        ],
      });
    }
    if (!hasOperationResult(toolResults, "message.list")) {
      return createResponse(request, {
        toolCalls: [buildRootWorkspaceBashToolCall("message list")],
      });
    }
    if (!hasOperationResult(toolResults, "attention.commit") && commitFrames.length > 0) {
      return createResponse(request, {
        toolCalls: buildAttentionCommitShellCalls(commitFrames, {
          summary: MOCK_WAITING_SUMMARY,
          value: "relay sent to gaubee",
          stage: "act",
          done: false,
          scoreMode: "wait",
        }),
      });
    }
    return createResponse(request, { content: "" });
  }

  if (followUpQuestion) {
    if (state.relay?.phase === "reported" && primaryRoomChatId && !hasOperationResult(toolResults, "message.send")) {
      return createResponse(request, {
        toolCalls: [
          buildRootWorkspaceBashToolCall(
            `message send ${escapeShellJson({ chatId: primaryRoomChatId, content: MOCK_FINAL_ANSWER })}`,
          ),
          ...buildAttentionCommitShellCalls(commitFrames, {
            summary: MOCK_FOLLOW_UP_SUMMARY,
            value: MOCK_FINAL_ANSWER,
            stage: "done",
            done: true,
            scoreMode: "done",
          }),
        ],
      });
    }
    if (hasOperationResult(toolResults, "message.send") || !primaryRoomChatId) {
      return createResponse(request, { content: "" });
    }
    return createResponse(request, {
      toolCalls: [
        buildRootWorkspaceBashToolCall(
          `message send ${escapeShellJson({ chatId: primaryRoomChatId, content: MOCK_FINAL_ANSWER })}`,
        ),
        ...buildAttentionCommitShellCalls(commitFrames, {
          summary: MOCK_FOLLOW_UP_SUMMARY,
          value: MOCK_FINAL_ANSWER,
          stage: "done",
          done: true,
          scoreMode: "done",
        }),
      ],
    });
  }

  if (includesGaubeeReply) {
    if (hasOperationResult(toolResults, "message.send") || !primaryRoomChatId) {
      return createResponse(request, { content: "" });
    }
    state.relay = primaryRoomChatId
      ? {
          originChatId: primaryRoomChatId,
          targetChatId: state.relay?.targetChatId ?? findGaubeeChatId(toolResults) ?? primaryRoomChatId,
          expectedTargetRowIdAfterRelay: state.relay?.expectedTargetRowIdAfterRelay ?? 0,
          phase: "reporting",
        }
      : state.relay;
    return createResponse(request, {
      toolCalls: [
        buildRootWorkspaceBashToolCall(
          `message send ${escapeShellJson({ chatId: primaryRoomChatId, content: MOCK_FINAL_ANSWER })}`,
        ),
        ...buildAttentionCommitShellCalls(commitFrames, {
          summary: MOCK_REPORTED_SUMMARY,
          value: MOCK_FINAL_ANSWER,
          stage: "done",
          done: true,
          scoreMode: "done",
        }),
      ],
    });
  }

  if (initialQuestion) {
    if (hasReportedHistory) {
      if (hasOperationResult(toolResults, "attention.commit") || commitFrames.length === 0) {
        return createResponse(request, { content: "" });
      }
      return createResponse(request, {
        toolCalls: buildAttentionCommitShellCalls(commitFrames, {
          summary: MOCK_MAIN_RESOLVED_SUMMARY,
          value: MOCK_FINAL_ANSWER,
          stage: "done",
          done: true,
          scoreMode: "done",
        }),
      });
    }

    if (hasWaitingHistory || hasOperationResult(toolResults, "message.send")) {
      if (hasOperationResult(toolResults, "attention.commit") || commitFrames.length === 0) {
        return createResponse(request, { content: "" });
      }
      return createResponse(request, {
        toolCalls: buildAttentionCommitShellCalls(commitFrames, {
          summary: MOCK_WAITING_SUMMARY,
          value: "relay sent to gaubee",
          stage: "act",
          done: false,
          scoreMode: "wait",
        }),
      });
    }

    const gaubeeChatId = findGaubeeChatId(toolResults);
    if (gaubeeChatId) {
      const originFrame = commitFrames.find((frame) => frame.contextId === `ctx-${primaryRoomChatId}`) ?? commitFrames[0];
      const originCommit = originFrame?.commits.at(-1);
      state.relay = primaryRoomChatId
        ? {
            originChatId: primaryRoomChatId,
            targetChatId: gaubeeChatId,
            expectedTargetRowIdAfterRelay: (channelRows.get(gaubeeChatId) ?? 0) + 1,
            originContextId: originFrame?.contextId ?? latestAttentionMetadata.contextId,
            originHeadCommitId: originCommit?.commitId ?? latestAttentionMetadata.headCommitId,
            originScores: originCommit?.scores,
            phase: "awaiting_reply",
        }
      : state.relay;
      return createResponse(request, {
        toolCalls: [
          buildRootWorkspaceBashToolCall(
            `message send ${escapeShellJson({ chatId: gaubeeChatId, content: MOCK_RELAY_PROMPT })}`,
          ),
          ...buildAttentionCommitShellCalls(commitFrames, {
            summary: MOCK_WAITING_SUMMARY,
            value: "relay sent to gaubee",
            stage: "act",
            done: false,
            scoreMode: "wait",
          }),
        ],
      });
    }

    if (!hasOperationResult(toolResults, "message.list")) {
      return createResponse(request, {
        toolCalls: [buildRootWorkspaceBashToolCall("message list")],
      });
    }
  }

  return createResponse(request, { content: "" });
};

const handleRequest = async (
  request: IncomingMessage,
  response: ServerResponse,
  requests: ChatCompletionRequest[],
  state: MockModelServerState,
): Promise<void> => {
  if (request.method !== "POST" || request.url !== "/v1/chat/completions") {
    response.writeHead(404, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: { message: "not found" } }));
    return;
  }

  const body = await readBody(request);
  const parsed = requestSchema.parse(safeJsonParse(body));
  requests.push(parsed);

  const payload = isSummaryRequest(parsed) ? decideSummary(parsed, state) : decideChat(parsed, state);
  response.writeHead(200, { "content-type": "application/json" });
  response.end(JSON.stringify(payload));
};

export const startMockModelServer = async (): Promise<MockModelServerHandle> => {
  const requests: ChatCompletionRequest[] = [];
  const state: MockModelServerState = {
    relay: null,
  };
  const server = createServer((request, response) => {
    void handleRequest(request, response, requests, state).catch((error) => {
      response.writeHead(500, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          error: {
            message: error instanceof Error ? error.message : String(error),
          },
        }),
      );
    });
  });

  await new Promise<void>((resolveReady, rejectReady) => {
    server.once("error", rejectReady);
    server.listen(0, "127.0.0.1", () => resolveReady());
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("mock model server did not expose an inet address");
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}/v1`,
    requests,
    stop: async () => {
      await new Promise<void>((resolveClose, rejectClose) =>
        server.close((error) => (error ? rejectClose(error) : resolveClose())),
      );
    },
  };
};
