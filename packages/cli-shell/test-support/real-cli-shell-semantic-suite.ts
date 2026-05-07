import { existsSync, readdirSync } from "node:fs";

import { ModelClient, createSemanticJudge, type SemanticJudge } from "../../app-server/src";
import { excludeActiveContextPrefixes, waitForScopedAttentionSettled } from "../../app-server/test-support/attention-test-primitive";
import { waitForRealValue } from "../../app-server/test-support/real-kernel-harness";
import { z } from "zod";

import { createRealCliShellFixture, type RealCliShellFixture } from "./real-cli-shell-fixture";

export const REAL_CLI_SHELL_SCORE_THRESHOLD = 0.8;
export const REAL_CLI_SHELL_JUDGE_MAX_ATTEMPTS = 3;

const DEFAULT_TIMEOUT_MS = 240_000;
const REAL_CLI_SHELL_ATTENTION_SCOPE = excludeActiveContextPrefixes("ctx-task-source-");

const clipText = (value: string, maxChars = 1_600): string => (value.length <= maxChars ? value : `${value.slice(0, maxChars)}\n...<clipped>`);

const rubricSchema = z.object({
  summary: z.string(),
  totalScore: z.number().min(0).max(1),
  userFitLearning: z.number().min(0).max(1),
  memoryQuality: z.number().min(0).max(1),
  selfEvolutionDirection: z.number().min(0).max(1),
  orthogonality: z.number().min(0).max(1),
  hostingSeparation: z.number().min(0).max(1),
  programmableAttentionUsage: z.number().min(0).max(1),
  antiOverfit: z.number().min(0).max(1),
  evidence: z.array(z.string()).max(8),
  concerns: z.array(z.string()).max(8),
});

export interface RealCliShellStyleScenario {
  id: "senior-led" | "requirement-led" | "playful";
  styleExpectation: string;
  intro: string;
  task: string;
  correction: string;
  reflection: string;
  reuse: string;
}

export const REAL_CLI_SHELL_STYLE_SCENARIOS: readonly RealCliShellStyleScenario[] = [
  {
    id: "senior-led",
    styleExpectation: "result-first, terse, direct, no narration, one next action when useful",
    intro:
      "之后按 senior-led 的方式配合我：结论先，命令后，不要寒暄，也不要长篇解释。把这当成 durable preference，并用一句短句确认。这个 semantic validation 回合里，所需证据都在我的消息里；只做必要的可见回复、memory 更新和 attention 收敛，不要做无关探查。",
    task:
      "下面是当前 shell-terminal 旁边记录的 pairing-target 证据，只根据这段文本回答，不要读取工作区或做无关探查：\n1. result first\n2. rg first\n3. memory stays durable\n4. next action after answer\n现在告诉我一共有几行，并按刚才的风格回复。",
    correction:
      "纠正一下：我不要过程复述。以后默认只给结果和一个下一步动作，把这条也写进 durable memory，不要记成聊天流水账。",
    reflection:
      "请把你刚学到的 durable preference 更新到 memory pack。然后再用一句短句告诉我：如果以后做自我演进，怎样在不打开 managed mode 的前提下，用 memory 和 programmable attention 继续改进自己，不要发明核心特性。",
    reuse: "我们重新连上了。不要复述背景，也不要做无关探查，按你学到的方式回答：刚才 pairing-target 的第一行是什么？",
  },
  {
    id: "requirement-led",
    styleExpectation: "strict format, acceptance-criteria first, no unsupported claims, explicit result and next",
    intro:
      "我的协作规则是 requirement-led：先对齐验收标准，再做最小动作。回复时严格用 `result:` 和 `next:` 两行；没有证据不要下结论。请记住并按这个格式确认。这个 semantic validation 回合里，所需证据都在我的消息里；只做必要的可见回复、memory 更新和 attention 收敛，不要做无关探查。",
    task:
      "以下是当前 shell-terminal 记录的 pairing-target 证据，只根据这段文本回答，不要读取工作区或做无关探查：\n1. result first\n2. rg first\n3. memory stays durable\n4. next action after answer\n请告诉我第二行是什么，并严格按 `result:` / `next:` 两行回复。",
    correction:
      "再补一条：如果我给了明确格式，就严格遵守，不要自由发挥。把这条写进 durable memory，而且记成操作规则，不要记整段对话。",
    reflection:
      "现在更新你的 memory pack，然后按 requirement-led 的方式说明：如果以后做自我演进，怎样通过 memory 和 programmable attention 反思，而不是依赖 managed mode 或核心特性。",
    reuse: "继续按我们刚才的约定，不要做无关探查，只用 `result:` 和 `next:` 两行告诉我：刚才 pairing-target 一共有几条偏好。",
  },
  {
    id: "playful",
    styleExpectation: "light companion tone, still factual and engineering-rigorous, playfulness is not a product mode",
    intro:
      "我们可以轻松一点，但工程上还是要靠谱。语气允许一点陪伴感，不过结论必须清楚，也不要把 playful 变成产品模式。请记住并简短确认。这个 semantic validation 回合里，所需证据都在我的消息里；只做必要的可见回复、memory 更新和 attention 收敛，不要做无关探查。",
    task:
      "下面是当前 shell-terminal 记录的 pairing-target 证据，只根据这段文本回答，不要读取工作区或做无关探查：\n1. result first\n2. rg first\n3. memory stays durable\n4. next action after answer\n请告诉我这里面有没有 `rg first` 这行，并用简短、友好的语气回复。",
    correction:
      "再记一条：玩笑只能轻一点，不能盖过事实；真正 durable 的偏好要写进 memory，不要写成聊天流水账。",
    reflection:
      "请更新 memory pack，然后友好但清楚地说明：如果以后做自我演进，怎样在 managed mode 关闭时，靠 memory 和 programmable attention 继续改进自己。",
    reuse: "现在按你学到的方式回复，不要做无关探查：刚才 pairing-target 的最后一行是什么？",
  },
] as const;

export interface RealCliShellScenarioResult {
  styleId: RealCliShellStyleScenario["id"];
  styleExpectation: string;
  replies: {
    acknowledgement: string;
    task: string;
    correction: string;
    reflection: string;
    reuse: string;
  };
  compactCycleId: number;
  chatMessages: Array<{ messageId: string; chatId: string; role: string; createdAt: number; content: string }>;
  primaryRoomMessages: Array<{
    messageId: number;
    chatId: string;
    from: string;
    senderActorId?: string;
    createdAt: number;
    content: string;
  }>;
  memoryPack: Record<string, string>;
  prompt: string;
  modelCallCount: number;
  toolTraceTools: string[];
  activeAttentionContexts: Array<{ contextId: string; scoreMap: Record<string, number> }>;
  cacheMode: "proxy" | "direct";
  cacheDir?: string;
  cacheFileCount: number;
  cacheFiles: string[];
}

export interface RealCliShellScenarioScore {
  result: RealCliShellScenarioResult;
  rubric: z.infer<typeof rubricSchema>;
  attemptsUsed: number;
}

type RecentModelCall = Awaited<ReturnType<RealCliShellFixture["listRecentModelCalls"]>>[number];
type PrimaryRoomMessageSnapshot = {
  messageId: number;
  chatId: string;
  from: string;
  senderActorId?: string;
  createdAt: number;
  content: string;
  recalledAt?: number;
};

const buildJudge = (fixture: RealCliShellFixture): SemanticJudge =>
  createSemanticJudge(
    new ModelClient({
      providerId: "real-cli-shell-judge",
      apiStandard: fixture.config.apiStandard,
      vendor: fixture.config.vendor,
      profile: fixture.config.profile,
      model: fixture.config.model,
      baseUrl: fixture.config.baseUrl,
      apiKey: fixture.config.apiKey,
      headers: fixture.config.headers,
      temperature: 0,
      maxRetries: 0,
    }),
    {
      attempts: 1,
      minAgreement: 1,
    },
  );

const waitForPromptWindowCompact = async (fixture: RealCliShellFixture): Promise<void> => {
  await waitForRealValue(
    async () => {
      const debug = await fixture.handle.kernel.inspectModelDebug(fixture.attached.session.id);
      return JSON.stringify(debug.promptWindow).includes("prompt_window_compact") ? true : null;
    },
    {
      label: "cli-shell prompt-window compact applied",
      timeoutMs: DEFAULT_TIMEOUT_MS,
    },
  );
};

const resolvePrimaryRoomChannel = (fixture: RealCliShellFixture): { chatId: string; accessToken: string } => {
  const primaryRoomId = fixture.attached.session.primaryRoomId;
  if (!primaryRoomId) {
    throw new Error(`cli-shell attached session missing primaryRoomId: ${fixture.attached.session.id}`);
  }
  const channel = fixture.handle.kernel
    .listMessageChannels(fixture.attached.session.id)
    .find((entry) => entry.chatId === primaryRoomId);
  if (!channel?.accessToken) {
    throw new Error(`cli-shell primary room is not readable: ${primaryRoomId}`);
  }
  return {
    chatId: channel.chatId,
    accessToken: channel.accessToken,
  };
};

const listPrimaryRoomMessages = (fixture: RealCliShellFixture): PrimaryRoomMessageSnapshot[] =>
  fixture.handle.kernel
    .snapshotGlobalRoom({
      ...resolvePrimaryRoomChannel(fixture),
      limit: 200,
    })
    .items.map((message) => ({
      messageId: message.messageId,
      chatId: message.chatId,
      from: message.from,
      ...(message.senderActorId ? { senderActorId: String(message.senderActorId) } : {}),
      createdAt: message.createdAt,
      content: message.content,
      ...(typeof message.recalledAt === "number" ? { recalledAt: message.recalledAt } : {}),
    }));

const listAssistantPrimaryRoomMessages = (fixture: RealCliShellFixture): PrimaryRoomMessageSnapshot[] =>
  listPrimaryRoomMessages(fixture).filter(
    (message) => message.senderActorId === fixture.attached.avatar.avatarPrincipalId && message.recalledAt === undefined,
  );

const extractToolTraceTools = (calls: readonly RecentModelCall[]): string[] =>
  calls.flatMap((call) => {
    const response = call.response;
    if (!response || typeof response !== "object" || !("toolTrace" in response) || !Array.isArray(response.toolTrace)) {
      return [];
    }
    return response.toolTrace.flatMap((entry) =>
      typeof entry === "object" && entry !== null && "tool" in entry && typeof entry.tool === "string" ? [entry.tool] : [],
    );
  });

const listCacheFiles = (fixture: RealCliShellFixture): string[] => {
  if (!fixture.proxy || !existsSync(fixture.proxy.cacheDir)) {
    return [];
  }
  return readdirSync(fixture.proxy.cacheDir, { encoding: "utf8" })
    .filter((entry) => entry.endsWith(".json"))
    .sort()
    .slice(0, 24);
};

const buildTurnPrompt = (fixture: RealCliShellFixture, content: string): string => {
  const primaryRoomId = fixture.attached.session.primaryRoomId;
  if (!primaryRoomId) {
    throw new Error(`cli-shell attached session missing primaryRoomId: ${fixture.attached.session.id}`);
  }
  return [
    content,
    `当前用户可见回复房间 chatId: ${primaryRoomId}。请把你的可见回复发到这个 chatId。`,
    "所需证据都在当前消息里；只做必要的可见回复、memory 更新和 attention 收敛，不要读取工作区或做无关探查。",
  ].join("\n");
};

const waitForTurnCompletion = async (
  fixture: RealCliShellFixture,
  input: {
    afterTimestamp: number;
    label: string;
    timeoutMs?: number;
  },
): Promise<string> => {
  const reply = await waitForRealValue(
    () => listAssistantPrimaryRoomMessages(fixture).filter((message) => message.createdAt >= input.afterTimestamp).at(-1) ?? null,
    {
      label: `${input.label} durable assistant reply`,
      timeoutMs: input.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    },
  );
  const relevantCalls = await waitForRealValue(
    async () => {
      const recentModelCalls = await fixture.listRecentModelCalls();
      const nextRelevantCalls = recentModelCalls.filter((call) => call.createdAt >= input.afterTimestamp);
      const latest = nextRelevantCalls.at(-1) ?? null;
      return latest && nextRelevantCalls.every((call) => call.status !== "running") ? nextRelevantCalls : null;
    },
    {
      label: `${input.label} model calls completed`,
      timeoutMs: input.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    },
  );
  const latestCall = relevantCalls.at(-1);
  if (latestCall?.status === "error") {
    throw new Error(`${input.label} model call failed: ${JSON.stringify(latestCall.outcome)}`);
  }
  await waitForScopedAttentionSettled(
    async () => await fixture.handle.kernel.inspectAttentionState(fixture.attached.session.id),
    waitForRealValue,
    REAL_CLI_SHELL_ATTENTION_SCOPE,
    input.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );
  return reply.content;
};

const nextAssistantReply = async (
  fixture: RealCliShellFixture,
  label: string,
  content: string,
): Promise<string> => {
  const userMessage = await fixture.sendUserChatMessage(buildTurnPrompt(fixture, content));
  return await waitForTurnCompletion(fixture, {
    afterTimestamp: userMessage.createdAt,
    label,
  });
};

const runScenarioOnFixture = async (
  fixture: RealCliShellFixture,
  style: RealCliShellStyleScenario,
): Promise<RealCliShellScenarioResult> => {
  fixture.writeWorkspaceFile(
    "pairing-target.txt",
    ["result first", "rg first", "memory stays durable", "next action after answer"].join("\n") + "\n",
  );

  const acknowledgement = await nextAssistantReply(fixture, `${style.id} acknowledgement`, style.intro);
  const taskReply = await nextAssistantReply(fixture, `${style.id} workspace task`, style.task);
  const correctionReply = await nextAssistantReply(fixture, `${style.id} correction`, style.correction);
  const reflectionReply = await nextAssistantReply(fixture, `${style.id} reflection`, style.reflection);

  const compact = await fixture.requestManualCompact();
  await waitForPromptWindowCompact(fixture);
  await fixture.reconnect();

  const reuseReply = await nextAssistantReply(fixture, `${style.id} reuse`, style.reuse);
  const chatMessages = fixture.listChatMessages().map((message) => ({
    messageId: message.messageId,
    chatId: message.chatId,
    role: message.role,
    createdAt: message.createdAt,
    content: clipText(message.content),
  }));
  const primaryRoomMessages = listPrimaryRoomMessages(fixture).map((message) => ({
    messageId: message.messageId,
    chatId: message.chatId,
    from: message.from,
    ...(message.senderActorId ? { senderActorId: message.senderActorId } : {}),
    createdAt: message.createdAt,
    content: clipText(message.content),
  }));
  const memoryPack = Object.fromEntries(
    Object.entries(fixture.readMemoryPack()).map(([role, content]) => [role, clipText(content)]),
  );
  const prompt = clipText(fixture.readPromptFile());
  const recentModelCalls = await fixture.listRecentModelCalls();
  const attention = await fixture.handle.kernel.inspectAttentionState(fixture.attached.session.id);
  const cacheFiles = listCacheFiles(fixture);

  return {
    styleId: style.id,
    styleExpectation: style.styleExpectation,
    replies: {
      acknowledgement: clipText(acknowledgement),
      task: clipText(taskReply),
      correction: clipText(correctionReply),
      reflection: clipText(reflectionReply),
      reuse: clipText(reuseReply),
    },
    compactCycleId: compact.cycleId,
    chatMessages,
    primaryRoomMessages,
    memoryPack,
    prompt,
    modelCallCount: recentModelCalls.length,
    toolTraceTools: extractToolTraceTools(recentModelCalls),
    activeAttentionContexts: attention.active.map((match) => ({
      contextId: match.contextId,
      scoreMap: { ...match.context.scoreMap },
    })),
    cacheMode: fixture.proxy ? "proxy" : "direct",
    ...(fixture.proxy ? { cacheDir: fixture.proxy.cacheDir } : {}),
    cacheFileCount: cacheFiles.length,
    cacheFiles,
  };
};

const scoreScenario = async (
  judge: SemanticJudge,
  result: RealCliShellScenarioResult,
): Promise<z.infer<typeof rubricSchema>> =>
  await judge.judgeStructured({
    instruction: [
      "Judge this shell-assistant scenario as a 0..1 product-quality rubric.",
      "Return numeric scores for: userFitLearning, memoryQuality, selfEvolutionDirection, orthogonality, hostingSeparation, programmableAttentionUsage, antiOverfit, and totalScore.",
      "The scenario should pass only if the assistant learned from concrete evidence, wrote concise durable memory, kept self-evolution orthogonal to hosting, and reused learned preferences after compact plus reconnect.",
      "Do not require exact phrases. Base the score on trace facts, memory contents, prompt law, compact or reconnect continuity, and whether the assistant adapts to the requested collaboration style instead of defaulting to one archetype.",
    ].join(" "),
    content: JSON.stringify(result),
    outputSchema: rubricSchema,
    maxTokens: 400,
    temperature: 0,
  });

export const runRealCliShellScenarioWithThreshold = async (
  style: RealCliShellStyleScenario,
): Promise<RealCliShellScenarioScore> => {
  const fixture = await createRealCliShellFixture();
  if (!fixture) {
    throw new Error("real cli-shell fixture is unavailable");
  }
  try {
    const judge = buildJudge(fixture);
    const result = await runScenarioOnFixture(fixture, style);
    const attempts: z.infer<typeof rubricSchema>[] = [];
    for (let attempt = 1; attempt <= REAL_CLI_SHELL_JUDGE_MAX_ATTEMPTS; attempt += 1) {
      const rubric = await scoreScenario(judge, result);
      attempts.push(rubric);
      if (rubric.totalScore >= REAL_CLI_SHELL_SCORE_THRESHOLD) {
        return {
          result,
          rubric,
          attemptsUsed: attempt,
        };
      }
    }
    throw new Error(
      `cli-shell semantic score stayed below threshold ${REAL_CLI_SHELL_SCORE_THRESHOLD}: ${JSON.stringify(attempts, null, 2)}`,
    );
  } finally {
    await fixture.stop();
  }
};
