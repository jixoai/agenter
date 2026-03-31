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

interface ToolResult {
  callId: string;
  name: string;
  content: string;
  data: unknown;
}

const PRIMARY_ROOM_CONTEXT_PREFIX = "ctx-room-main-";
const PRIMARY_ROOM_ID_PREFIX = "room-main-";

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

const attentionFencePattern = /```yaml\+attention_items\s*([\s\S]*?)```/g;

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
      const contextId = typeof record.contextId === "string" ? record.contextId : null;
      const commitsRaw = Array.isArray(record.commits) ? record.commits : [];
      if (!contextId || commitsRaw.length === 0) {
        continue;
      }
      const commits: AttentionCommit[] = commitsRaw
        .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
        .map((item) => ({
          contextId: typeof item.contextId === "string" ? item.contextId : contextId,
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
        }));
      frames.push({ contextId, commits });
    }
  }
  return frames;
};

const extractToolResults = (messages: readonly ChatMessage[]): ToolResult[] => {
  const callNameById = new Map<string, string>();
  const results: ToolResult[] = [];
  for (const message of messages) {
    for (const call of message.tool_calls ?? []) {
      callNameById.set(call.id, call.function.name);
    }
    if (message.role !== "tool" || !message.tool_call_id) {
      continue;
    }
    const name = callNameById.get(message.tool_call_id);
    if (!name) {
      continue;
    }
    const content = message.content ?? "";
    results.push({
      callId: message.tool_call_id,
      name,
      content,
      data: safeJsonParse(content),
    });
  }
  return results;
};

const listAssistantTexts = (messages: readonly ChatMessage[]): string[] =>
  messages
    .filter((message) => message.role === "assistant")
    .map((message) => message.content ?? "")
    .filter((content) => content.length > 0);

const hasToolResult = (results: readonly ToolResult[], name: string): boolean =>
  results.some((result) => result.name === name);

const findLatestToolResult = (results: readonly ToolResult[], name: string): ToolResult | null =>
  [...results].reverse().find((result) => result.name === name) ?? null;

const findGaubeeChatId = (results: readonly ToolResult[]): string | null => {
  const channelList = findLatestToolResult(results, "message_channel_list");
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
  const channelList = findLatestToolResult(results, "message_channel_list");
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
        if (record.metadata?.primaryRoom === true || chatId.startsWith(PRIMARY_ROOM_ID_PREFIX)) {
          return chatId;
        }
      }
    }
  }
  const frame = frames.find((item) => item.contextId.startsWith(PRIMARY_ROOM_CONTEXT_PREFIX));
  return frame ? frame.contextId.slice(4) : null;
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

const buildAttentionCommitToolCalls = (
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
      const toolCall: ChatToolCall = {
        id: randomUUID(),
        type: "function",
        function: {
          name: "attention_commit",
          arguments: JSON.stringify({
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
          }),
        },
      };
      return toolCall;
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

const decideSummary = (request: ChatCompletionRequest) => {
  const history = request.messages.map((message) => message.content ?? "").join("\n");
  const hasLunchConclusion = history.includes(MOCK_GAUBEE_REPLY) || history.includes("蛋炒饭");
  const frames = pickCurrentFrames(extractAttentionFrames(request.messages));
  const toolResults = extractToolResults(request.messages);
  const primaryRoomChatId = findPrimaryRoomChatId(toolResults, frames);
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

const decideChat = (request: ChatCompletionRequest) => {
  const { users, afterUsers } = extractCurrentCycleUserMessages(request.messages);
  const currentText = users.map((message) => message.content ?? "").join("\n");
  const currentFrames = pickCurrentFrames(extractAttentionFrames(users));
  const allFrames = pickCurrentFrames(extractAttentionFrames(request.messages));
  const toolResults = extractToolResults(afterUsers);
  const assistantHistory = listAssistantTexts(request.messages).join("\n");
  const allUserText = request.messages
    .filter((message) => message.role === "user")
    .map((message) => message.content ?? "")
    .join("\n");
  const primaryRoomChatId = findPrimaryRoomChatId(toolResults, allFrames);

  const hasReportedHistory =
    assistantHistory.includes(MOCK_REPORTED_SUMMARY) ||
    assistantHistory.includes(MOCK_FINAL_ANSWER) ||
    (assistantHistory.includes("prompt_window_compact") && assistantHistory.includes("蛋炒饭"));
  const hasWaitingHistory = assistantHistory.includes(MOCK_WAITING_SUMMARY);

  const followUpQuestion = currentText.includes("中午吃什么") && !currentText.includes("gaubee在吗");
  const includesGaubeeReply = allUserText.includes(MOCK_GAUBEE_REPLY);
  const initialQuestion = currentText.includes("gaubee在吗") || currentText.includes(MOCK_WAITING_SUMMARY);

  if (followUpQuestion) {
    if (hasToolResult(toolResults, "message_send") || !primaryRoomChatId) {
      return createResponse(request, { content: "" });
    }
    return createResponse(request, {
      toolCalls: [
        {
          id: randomUUID(),
          type: "function",
          function: {
            name: "message_send",
            arguments: JSON.stringify({
              chatId: primaryRoomChatId,
              content: MOCK_FINAL_ANSWER,
            }),
          },
        },
        ...buildAttentionCommitToolCalls(currentFrames, {
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
    if (hasToolResult(toolResults, "message_send") || !primaryRoomChatId) {
      return createResponse(request, { content: "" });
    }
    return createResponse(request, {
      toolCalls: [
        {
          id: randomUUID(),
          type: "function",
          function: {
            name: "message_send",
            arguments: JSON.stringify({
              chatId: primaryRoomChatId,
              content: MOCK_FINAL_ANSWER,
            }),
          },
        },
        ...buildAttentionCommitToolCalls(currentFrames, {
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
      if (hasToolResult(toolResults, "attention_commit") || currentFrames.length === 0) {
        return createResponse(request, { content: "" });
      }
      return createResponse(request, {
        toolCalls: buildAttentionCommitToolCalls(currentFrames, {
          summary: MOCK_MAIN_RESOLVED_SUMMARY,
          value: MOCK_FINAL_ANSWER,
          stage: "done",
          done: true,
          scoreMode: "done",
        }),
      });
    }

    if (hasWaitingHistory || currentText.includes(MOCK_WAITING_SUMMARY) || hasToolResult(toolResults, "message_send")) {
      if (hasToolResult(toolResults, "attention_commit") || currentFrames.length === 0) {
        return createResponse(request, { content: "" });
      }
      return createResponse(request, {
        toolCalls: buildAttentionCommitToolCalls(currentFrames, {
          summary: MOCK_WAITING_SUMMARY,
          value: "relay sent to gaubee",
          stage: "act",
          done: false,
          scoreMode: "wait",
        }),
      });
    }

    const gaubeeChatId = findGaubeeChatId(toolResults);
    if (gaubeeChatId && currentFrames.length > 0) {
      return createResponse(request, {
        toolCalls: [
          {
            id: randomUUID(),
            type: "function",
            function: {
              name: "message_send",
              arguments: JSON.stringify({
                chatId: gaubeeChatId,
                content: MOCK_RELAY_PROMPT,
              }),
            },
          },
          ...buildAttentionCommitToolCalls(currentFrames, {
            summary: MOCK_WAITING_SUMMARY,
            value: "relay sent to gaubee",
            stage: "act",
            done: false,
            scoreMode: "wait",
          }),
        ],
      });
    }

    if (!hasToolResult(toolResults, "message_channel_list")) {
      return createResponse(request, {
        toolCalls: [
          {
            id: randomUUID(),
            type: "function",
            function: {
              name: "message_channel_list",
              arguments: JSON.stringify({ includeArchived: false }),
            },
          },
        ],
      });
    }
  }

  return createResponse(request, { content: "" });
};

const handleRequest = async (
  request: IncomingMessage,
  response: ServerResponse,
  requests: ChatCompletionRequest[],
): Promise<void> => {
  if (request.method !== "POST" || request.url !== "/v1/chat/completions") {
    response.writeHead(404, { "content-type": "application/json" });
    response.end(JSON.stringify({ error: { message: "not found" } }));
    return;
  }

  const body = await readBody(request);
  const parsed = requestSchema.parse(safeJsonParse(body));
  requests.push(parsed);

  const payload = isSummaryRequest(parsed) ? decideSummary(parsed) : decideChat(parsed);
  response.writeHead(200, { "content-type": "application/json" });
  response.end(JSON.stringify(payload));
};

export const startMockModelServer = async (): Promise<MockModelServerHandle> => {
  const requests: ChatCompletionRequest[] = [];
  const server = createServer((request, response) => {
    void handleRequest(request, response, requests).catch((error) => {
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
