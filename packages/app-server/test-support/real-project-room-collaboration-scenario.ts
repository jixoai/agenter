import { createServer as createNetServer } from "node:net";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import type { PublicRoomMessageRecord, SessionRuntimeAttentionState } from "../src";
import { excludeActiveContextPrefixes, waitForScopedAttentionSettled } from "./attention-test-primitive";
import { waitForRealValue } from "./real-kernel-harness";
import type {
  RealTeamKernelHarness,
  RealTeamParticipant,
  RealTeamProjectRoom,
} from "./real-team-kernel-harness";

const DEFAULT_TIMEOUT_MS = 120_000;
const ROOM_STEP_TIMEOUT_MS = 240_000;
const HTTP_TIMEOUT_MS = 240_000;
const DELIVERY_CHECK_TIMEOUT_MS = 90_000;
const BACKEND_REPORT_TIMEOUT_MS = 180_000;
const FRONTEND_INITIAL_FILE_TIMEOUT_MS = 180_000;
const FRONTEND_RETRY_FILE_TIMEOUT_MS = 120_000;
const PROJECT_ROOM_ATTENTION_SCOPE = excludeActiveContextPrefixes("ctx-task-source-");
const PROJECT_URL_PATTERN = /https?:\/\/(?:127\.0\.0\.1|localhost):\d+\/?/u;
const DESIGN_FILE_PATH = "design.svg";
const INDEX_FILE_PATH = "index.html";
const DESIGN_FILE_MARKER = "DESIGN-SKETCH-V1";
const HTML_MARKERS = ["TEAM-UI-READY", "USES-API:/api/status", "PROJECT-COLLAB-V1"] as const;
const API_MARKERS = ["TEAM-API-READY", "PROJECT-COLLAB-V1"] as const;
const NODE_BINARY_PREFLIGHT_LINES = [
  "启动前先执行 which -a node，确认真正可执行的 node 二进制路径。",
  "不要假设 /usr/bin/node 存在，也不要直接依赖包装器或 shim。",
  "后台启动命令必须使用你刚确认过的那个真实绝对路径，例如 /actual/path/to/node server.js > server.log 2>&1 &。",
  "只要没有看到 LISTEN，或者 server.log 里没有出现 Server running ...，就把这次启动视为失败。",
  "如果 server.log 出现 no such file or directory 或其它启动错误，也先重新 which -a node，再换真实路径重试。",
] as const;

type ParticipantModelCall = Awaited<ReturnType<RealTeamKernelHarness["kernel"]["inspectModelDebug"]>>["recentModelCalls"][number];

const participantLabel = (participant: RealTeamParticipant): string => participant;

const waitForParticipantAttentionSettled = async (
  harness: RealTeamKernelHarness,
  participant: RealTeamParticipant,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<SessionRuntimeAttentionState> =>
  await waitForScopedAttentionSettled(
    async () =>
      await harness.kernel.inspectAttentionState(
        participant === "backend" ? harness.backendSession.id : harness.frontendSession.id,
      ),
    waitForRealValue,
    PROJECT_ROOM_ATTENTION_SCOPE,
    timeoutMs,
  );

const listParticipantModelCalls = async (
  harness: RealTeamKernelHarness,
  participant: RealTeamParticipant,
): Promise<ParticipantModelCall[]> =>
  harness.kernel.listModelCalls(participant === "backend" ? harness.backendSession.id : harness.frontendSession.id, 0, 200);

const waitForParticipantModelCallsAfter = async (
  harness: RealTeamKernelHarness,
  input: {
    participant: RealTeamParticipant;
    afterTimestamp: number;
    label: string;
    timeoutMs?: number;
  },
): Promise<ParticipantModelCall[]> =>
  await waitForRealValue(
    async () => {
      const relevant = (await listParticipantModelCalls(harness, input.participant)).filter(
        (call) => call.createdAt >= input.afterTimestamp,
      );
      const latest = relevant.at(-1) ?? null;
      if (!latest || latest.status === "running") {
        return null;
      }
      return relevant;
    },
    {
      label: input.label,
      timeoutMs: input.timeoutMs ?? ROOM_STEP_TIMEOUT_MS,
    },
  );

const focusLatestParticipantTerminal = async (
  harness: RealTeamKernelHarness,
  participant: RealTeamParticipant,
): Promise<void> => {
  const sessionId = participant === "backend" ? harness.backendSession.id : harness.frontendSession.id;
  const terminals = harness.kernel.listTerminals(sessionId);
  const terminal = terminals.find((entry) => entry.processPhase === "running") ?? terminals.at(-1);
  if (!terminal || terminal.focused) {
    return;
  }
  await harness.kernel.focusTerminal(sessionId, terminal.terminalId);
};

const extractToolTraceTools = (call: { response?: unknown }): string[] => {
  const response = call.response;
  if (!response || typeof response !== "object" || !("toolTrace" in response) || !Array.isArray(response.toolTrace)) {
    return [];
  }
  return response.toolTrace.flatMap((entry) =>
    typeof entry === "object" && entry !== null && "tool" in entry && typeof entry.tool === "string" ? [entry.tool] : [],
  );
};

const readModelOutcomeCode = (call: { outcome?: unknown }): string | null => {
  const outcome = call.outcome;
  if (!outcome || typeof outcome !== "object" || Array.isArray(outcome)) {
    return typeof outcome === "string" ? outcome : null;
  }
  const record = outcome as { code?: unknown };
  return typeof record.code === "string" ? record.code : null;
};

const contentContainsAllMarkers = (content: string, markers: readonly string[]): boolean =>
  markers.every((marker) => content.includes(marker));

const mentionsUnexpectedUptimeField = (content: string): boolean =>
  /(?:^|[\n\r])\s*[-*]?\s*uptime\b/iu.test(content) || /\buptime\b\s*:/iu.test(content);

const usesExpectedApiFieldsOnly = (content: string): boolean =>
  /status/iu.test(content) &&
  /version/iu.test(content) &&
  /timestamp/iu.test(content) &&
  !mentionsUnexpectedUptimeField(content);

export const isSingleSourceApiQuestion = (content: string): boolean =>
  !/```json/iu.test(content) &&
  !/我假设|假设如下/iu.test(content) &&
  !/status\s*:\s*['"]|version\s*:\s*['"]|timestamp\s*:\s*['"]/iu.test(content) &&
  !/完整\s*URL|端口|localhost|127\.0\.0\.1|https?:\/\//iu.test(content) &&
  /\/api\/status/iu.test(content) &&
  /最终/iu.test(content) &&
  /(契约|字段|类型|含义|响应)/iu.test(content);

const isNonSpeculativeBackendContract = (content: string): boolean =>
  !/```json/iu.test(content) &&
  !/localhost/iu.test(content) &&
  !/\b3000\b/u.test(content) &&
  !/\{\s*"status"\s*:/iu.test(content);

export const isSingleSourceApiAnswer = (content: string): boolean =>
  contentContainsAllMarkers(content, API_MARKERS) &&
  usesExpectedApiFieldsOnly(content) &&
  !/https?:\/\//iu.test(content) &&
  !/localhost|127\.0\.0\.1|\b3000\b/iu.test(content);

const waitForRoomMessage = async (
  harness: RealTeamKernelHarness,
  room: Pick<RealTeamProjectRoom, "room">,
  input: {
    label: string;
    predicate: (message: PublicRoomMessageRecord) => boolean;
    timeoutMs?: number;
  },
): Promise<PublicRoomMessageRecord> =>
  await waitForRealValue(
    () => harness.listProjectRoomMessages(room, 120).filter(input.predicate).at(-1) ?? null,
    {
      label: input.label,
      timeoutMs: input.timeoutMs ?? ROOM_STEP_TIMEOUT_MS,
    },
  );

const waitForWorkspaceFile = async (
  harness: RealTeamKernelHarness,
  input: {
    relativePath: string;
    marker?: string;
    markers?: readonly string[];
    label: string;
    timeoutMs?: number;
  },
): Promise<string> =>
  await waitForRealValue(
    async () => {
      try {
        const content = await readFile(join(harness.workspacePath, input.relativePath), "utf8");
        if (input.marker && !content.includes(input.marker)) {
          return null;
        }
        if (input.markers && !contentContainsAllMarkers(content, input.markers)) {
          return null;
        }
        return content;
      } catch {
        return null;
      }
    },
    {
      label: input.label,
      timeoutMs: input.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    },
  );

const readWorkspaceTextIfExists = async (workspacePath: string, relativePath: string): Promise<string | null> => {
  try {
    return await readFile(join(workspacePath, relativePath), "utf8");
  } catch {
    return null;
  }
};

const inspectBackendDeliveryDraft = async (workspacePath: string, expectedUrl: string): Promise<string[]> => {
  const findings: string[] = [];
  const expectedPort = new URL(expectedUrl).port;
  const serverSource = await readWorkspaceTextIfExists(workspacePath, "server.js");
  if (!serverSource) {
    return ["我在工作目录里还没有看到 server.js 真正写到磁盘。"];
  }
  if (/listen\s*\(\s*0\b/u.test(serverSource)) {
    findings.push(`server.js 现在监听的是动态端口 0，这是错误的；必须固定监听 ${expectedPort}。`);
  } else if (!new RegExp(`listen\\s*\\(\\s*${expectedPort}\\b`, "u").test(serverSource)) {
    findings.push(`server.js 还没有明显固定监听 ${expectedPort}。`);
  }
  if (!serverSource.includes("TEAM-API-READY") || !serverSource.includes("PROJECT-COLLAB-V1")) {
    findings.push("server.js 里的 /api/status 还没有明显包含 TEAM-API-READY 和 PROJECT-COLLAB-V1。");
  }
  if (!serverSource.includes("index.html") || !serverSource.includes("design.svg")) {
    findings.push("server.js 还没有明显读取 index.html 和 design.svg。");
  }
  return findings;
};

const fetchTextWithMarkers = async (
  url: string,
  markers: readonly string[],
): Promise<{ ok: true; status: number; body: string } | { ok: false; status?: number; body?: string; error: string }> => {
  try {
    const response = await fetch(url);
    const body = await response.text();
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        body,
        error: `unexpected status ${response.status}`,
      };
    }
    const missingMarkers = markers.filter((marker) => !body.includes(marker));
    if (missingMarkers.length > 0) {
      return {
        ok: false,
        status: response.status,
        body,
        error: `missing markers: ${missingMarkers.join(", ")}`,
      };
    }
    return {
      ok: true,
      status: response.status,
      body,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

const waitForHttpMarkers = async (
  url: string,
  markers: readonly string[],
  input: {
    label: string;
    timeoutMs?: number;
    onObservation?: (observation: { status?: number; body?: string; error: string } | null) => void;
  },
): Promise<{ status: number; body: string }> =>
  await waitForRealValue(
    async () => {
      const observed = await fetchTextWithMarkers(url, markers);
      if (!observed.ok) {
        input.onObservation?.({
          status: observed.status,
          body: observed.body,
          error: observed.error,
        });
        return null;
      }
      input.onObservation?.({
        status: observed.status,
        body: observed.body,
        error: "",
      });
      return {
        status: observed.status,
        body: observed.body,
      };
    },
    {
      label: input.label,
      timeoutMs: input.timeoutMs ?? HTTP_TIMEOUT_MS,
    },
  );

const buildPrimer = (participant: RealTeamParticipant): string =>
  participant === "backend"
    ? [
        "这是私有角色引导，不需要回复这个房间。",
        "你是 backend。",
        "只负责 server.js、/api/status、启动 http 服务。",
        "项目事实只能在共享项目房间里说。",
        "禁止替 frontend 发言。",
        "BACKEND-CONTRACT 只允许说明职责边界，不要提前定义 /api/status 的 JSON 字段、端口或 URL。",
        "你是 /api/status 唯一契约权威，frontend 只能引用你的 API-ANSWER。",
        "进入项目房间后：",
        "1. 第一条消息必须是 BACKEND-CONTRACT:",
        "2. 回答接口问题时用 API-ANSWER:",
        "3. 可验收后用 PROJECT-URL:",
      ].join("\n")
    : [
        "这是私有角色引导，不需要回复这个房间。",
        "你是 frontend。",
        "只负责 index.html 和 design.svg。",
        "项目事实只能在共享项目房间里说。",
        "禁止替 backend 发言。",
        "进入项目房间后：",
        "1. 第一条消息必须是 FRONTEND-PLAN:",
        "2. 至少发一条 API-QUESTION:，只能索取 backend 的最终唯一响应契约，不要猜字段值，不要写示例 JSON，不要问 host/port。",
        `3. 创建 ${DESIGN_FILE_PATH}，内容必须包含 ${DESIGN_FILE_MARKER}，然后发送 DESIGN-FILE: ${DESIGN_FILE_PATH}`,
      ].join("\n");

const buildKickoffPrompt = (): string =>
  [
    "项目启动：你们在同一个 projectRoom 协作，做一个极简全栈示例。",
    "整个项目只能使用原生 node + 静态 html/svg。",
    "不要安装任何依赖，不要使用框架，不要执行 npm/pnpm/bun install。",
    "backend 只负责 server.js、/api/status、启动服务。",
    "frontend 只负责 index.html、design.svg。",
    "项目事实只能留在这个房间。",
    "第 1 步：backend 现在先发一条 BACKEND-CONTRACT:。",
    "这条 BACKEND-CONTRACT 只能说明职责边界，不要提前定义 /api/status 的 JSON 字段、端口或 URL。",
    "frontend 先不要替 backend 发言。",
  ].join("\n");

const buildFrontendPlanningPrompt = (): string =>
  [
    "第 2 步：frontend 现在发一条 FRONTEND-PLAN:。",
    "然后 frontend 再发一条 API-QUESTION: 给 backend。",
    "这条 API-QUESTION 只能索取 /api/status 的最终唯一契约。",
    "前端固定调用相对路径 /api/status，不要问完整 URL 或端口。",
    "不要猜字段值，不要写示例 JSON，不要写 status: ok 这种临时版本。",
    "frontend 不能替 backend 回答。",
  ].join("\n");

const buildBackendAnswerPrompt = (): string =>
  [
    "第 3 步：backend 现在回答 frontend 的接口问题。",
    "请发一条 API-ANSWER:。",
    "这次回答必须直接使用最终要实现的单一接口契约，不要临时编一个别的版本。",
    `约定 /api/status 返回 JSON.stringify({ status: 'TEAM-API-READY', version: 'PROJECT-COLLAB-V1', timestamp: new Date().toISOString() })。`,
    "唯一正确契约只允许三个字段：status、version、timestamp。",
    "你的回答必须显式包含 TEAM-API-READY 和 PROJECT-COLLAB-V1。",
    "不要加入 uptime 或任何其它额外字段。",
    "不要复述 frontend 的猜测，不要再给 status: ok 或 localhost:3000 这种旧版本。",
    "不要提供完整 URL 或端口，frontend 固定调用相对路径 /api/status 即可。",
    "明确说明 frontend 只需要展示这个响应文本即可。",
    "backend 不能让 frontend 代答。",
  ].join("\n");

const buildFrontendQuestionCorrectionPrompt = (): string =>
  [
    "frontend 刚才的 API-QUESTION 不合格。",
    "请重新发送一条 API-QUESTION:。",
    "只能向 backend 索取 /api/status 的最终唯一契约。",
    "前端固定调用相对路径 /api/status，不要问完整 URL 或端口。",
    "不要猜字段值，不要写示例 JSON，不要发布任何临时 payload。",
  ].join("\n");

const buildBackendContractCorrectionPrompt = (): string =>
  [
    "backend 刚才的 BACKEND-CONTRACT 不合格。",
    "请重新发送一条新的 BACKEND-CONTRACT:。",
    "这条消息只能说明 backend 负责的文件、接口和服务职责边界。",
    "不要提前定义 /api/status 的 JSON 字段、端口、localhost 地址或示例 payload。",
  ].join("\n");

const buildBackendAnswerCorrectionPrompt = (): string =>
  [
    "backend 刚才的 API-ANSWER 不合格。",
    "请重新发送一条新的 API-ANSWER:。",
    "唯一正确契约必须显式包含 TEAM-API-READY 和 PROJECT-COLLAB-V1。",
    "唯一正确契约只允许三个字段：status、version、timestamp；不要加入 uptime 或其它字段。",
    "不要提供完整 URL、host 或端口，frontend 固定调用相对路径 /api/status 即可。",
    "frontend 后续只能以你这条答案为准，不要再给 status: ok 或其它临时版本。",
  ].join("\n");

const buildFrontendBuildPrompt = (workspacePath: string): string =>
  [
    "第 4 步：frontend 现在创建 design.svg 和 index.html。",
    "不要安装依赖，不要启动服务，不要修改 server.js。",
    "只写两个最小文件，越简单越好，而且必须真的写到工作目录磁盘。",
    "你现在的直接工具是 workspace_list、root_bash、workspace_bash。",
    `唯一正确的工作目录是：${workspacePath}`,
    "先用 workspace_list 看清已挂载路径，再根据任务选择 root_bash 或 workspace_bash。",
    `如果当前没有 terminal，就先执行 terminal create --help，然后用 JSON 形式创建，例如 terminal create '{"cwd":"${workspacePath}","focus":true}'；如果已有 terminal，就先 terminal list / terminal read 恢复上下文。`,
    "如果你忘了 terminal CLI 的格式，先在 shell 里执行 skill info agenter-terminal。",
    "先确认 pwd；如果当前目录不是这个绝对路径，就先 cd 到这个目录。",
    `design.svg 和 index.html 都必须直接写到 ${workspacePath}，禁止写到 /Users/kzf、~、home 或其它位置。`,
    `design.svg 必须包含 ${DESIGN_FILE_MARKER}。`,
    `index.html 必须包含：${HTML_MARKERS.join(", ")}。`,
    "index.html 只需要 fetch('/api/status') 并展示返回文本即可。",
    "不要先在房间里解释，也不要只贴代码；先把文件写到磁盘，再回房间汇报。",
    `design.svg 必须包含 ${DESIGN_FILE_MARKER}，完成后发送 DESIGN-FILE: ${DESIGN_FILE_PATH}。`,
    `index.html 必须包含：${HTML_MARKERS.join(", ")}`,
  ].join("\n");

const buildFrontendReportPrompt = (): string =>
  [
    "第 4.1 步：frontend 已经完成文件后，现在回到项目房间汇报。",
    `请立即发送一条 DESIGN-FILE: ${DESIGN_FILE_PATH}`,
    "不要解释太多，只要明确汇报设计文件已完成。",
  ].join("\n");

const buildFrontendDiskFeedbackPrompt = (workspacePath: string): string =>
  [
    "前端交付还不合格：我在工作目录里还没有稳定看到 design.svg 和 index.html。",
    "不要只在 room 里说“写好了”；现在必须重新用 terminal 真正落盘。",
    `唯一正确的工作目录就是：${workspacePath}`,
    "先用 root_bash 进入 shell。",
    `如果当前没有 terminal，就先执行 terminal create --help，然后用 JSON 形式创建；如果已有 terminal，就先 terminal list / terminal read 恢复它。`,
    "先执行 pwd；如果不是这个目录，先 cd 到这个目录。",
    `写完后确保 ${DESIGN_FILE_PATH} 包含 ${DESIGN_FILE_MARKER}，${INDEX_FILE_PATH} 包含 ${HTML_MARKERS.join(", ")}。`,
    "先把文件写对，再继续后续汇报。",
  ].join("\n");

const buildPrivateFrontendDiskReminder = (workspacePath: string): string =>
  [
    "这是私有提醒，不要回复这个私有房间。",
    "共享项目房间还没有稳定看到 design.svg 和 index.html 真正落盘。",
    `唯一正确的工作目录是：${workspacePath}`,
    "不要假设系统默认给你 terminal。现在只做这一件事：先用 root_bash 进入 shell。",
    `如果还没有 terminal，就先执行 terminal create --help，然后用 JSON 形式创建；如果已有 terminal，就先 terminal list / terminal read 恢复它。`,
    "然后确认 pwd，必要时 cd 到该目录，再把 design.svg 和 index.html 真正写到这个目录。",
    "不要闲聊，不要先回复房间，不要只说已经完成。先把文件落盘，再回共享项目房间。",
  ].join("\n");

const buildBackendDeliveryPrompt = (url: string, workspacePath: string): string =>
  [
    "第 5 步：backend 现在实现并启动服务。",
    "不要安装依赖，只能使用 node 内置 http/fs/path。",
    "server.js 必须是最小实现：提供 /api/status，根路径返回 index.html，/design.svg 返回 design.svg。",
    "你只能实现并交付已经在 API-ANSWER 中确认的那一个最终契约。",
    "你现在的直接工具是 workspace_list、root_bash、workspace_bash。",
    "长期服务只放在 terminal 里启动；一次性的监听/日志检查放在 root_bash。",
    `唯一正确的工作目录是：${workspacePath}`,
    "先用 workspace_list 看清已挂载路径，再根据任务选择 root_bash 或 workspace_bash。",
    `如果当前没有 terminal，就先执行 terminal create --help，然后用 JSON 形式创建，例如 terminal create '{"cwd":"${workspacePath}","focus":true}'；如果已经有 terminal，就先 terminal list / terminal read 恢复它的上下文。`,
    "如果你忘了 terminal CLI 的格式，先在 shell 里执行 skill info agenter-terminal。",
    "拿到 terminal 后先执行 pwd；如果当前目录不是这个绝对路径，就先 cd 到这个目录。",
    "server.js、index.html、design.svg 都必须从这个目录读取，不允许跑到别的目录。",
    `server.js 必须监听 127.0.0.1:${new URL(url).port}。`,
    ...NODE_BINARY_PREFLIGHT_LINES,
    "不要把 node server.js 前台跑住然后卡在终端里；必须后台运行。",
    "在 terminal 里启动时，把输出重定向到 server.log。",
    `服务地址固定为 ${url}，只能监听 127.0.0.1。`,
    `GET /api/status 必须包含：${API_MARKERS.join(", ")}`,
    "如果 terminal read 只看到你刚输入的命令，不要把它当作失败证据；命令是否生效，要靠客观检查。",
    `启动后立刻用 root_bash 检查 lsof -nP -iTCP:${new URL(url).port} -sTCP:LISTEN 是否看到 LISTEN。`,
    "再用 root_bash 检查工作目录里的 server.log，确认出现 Server running ...。",
    "如果后台 job 显示 running，但没有 LISTEN，或者 server.log 没有成功行，不要继续堆更多 node 后台 job。",
    "遇到这种情况先看 server.log；如果是路径或启动错误，就执行 which -a node，改用列表里真实的 node 二进制路径重试。",
    "不要把 curl 成败当作唯一门槛；如果你还想补一个 HTTP 自检，优先用 node 或 python3 的本地请求。",
    `只要服务已经稳定监听并且 server.log 正常，立刻回共享项目房间发送一条 PROJECT-URL: ${url}。`,
    "不要在发 PROJECT-URL 之前继续刷工具，也不要发额外解释。",
  ].join("\n");

const buildBackendTerminalRecipe = (url: string, workspacePath: string): string[] => [
  "先用 root_bash 进入 shell。",
  "长期服务在 terminal 启动；一次性检查放在 root_bash。",
  `如果当前没有 terminal，就先执行 terminal create --help，然后用 JSON 形式创建，例如 terminal create '{"cwd":"${workspacePath}","focus":true}'；如果已经有 terminal，就先 terminal list / terminal read 恢复它。`,
  `唯一正确的工作目录是：${workspacePath}`,
  "先执行 pwd；如果不是这个目录，先 cd 到这个目录。",
  "写好最小 server.js：根路径返回 index.html，/design.svg 返回 design.svg，/api/status 返回 status/version/timestamp 三个字段。",
  ...NODE_BINARY_PREFLIGHT_LINES,
  `让服务后台监听 127.0.0.1:${new URL(url).port}，并把输出重定向到 server.log。`,
  `如果 terminal read 只回显你自己的命令，不要在 terminal 里反复盲试；回到 root_bash 做客观检查。`,
  `用 root_bash 检查 lsof -nP -iTCP:${new URL(url).port} -sTCP:LISTEN。`,
  "再用 root_bash 检查 server.log 是否出现 Server running ...。",
  "如果没有 LISTEN，或者 server.log 里没有成功行，就先查看 server.log；若是路径或启动错误，再 which -a node 并改用真实 node 二进制路径重试。",
  `确认监听正常后，再回共享项目房间发送 PROJECT-URL: ${url}。`,
];

const buildDeliveryFeedbackPrompt = (input: {
  expectedUrl: string;
  observedUrl: string | null;
  reason: string;
}): string =>
  [
    "交付还不符合约定，请 backend 现在修正并重新交付。",
    input.observedUrl ? `你刚才提供的 URL 是：${input.observedUrl}` : "你刚才没有提供可解析的本地 URL。",
    `优先使用这个固定地址：${input.expectedUrl}`,
    `根页面仍然必须包含：${HTML_MARKERS.join(", ")}`,
    `/api/status 仍然必须包含：${API_MARKERS.join(", ")}`,
    "先用 root_bash 进入 shell；如果当前没有 terminal，就先执行 terminal create --help，然后用 JSON 形式创建显式 cwd 的 terminal；如果已经有 terminal，就先恢复它。",
    "先修好 server.js 和服务，再用 root_bash 检查 LISTEN 与 server.log，最后只发送一条新的 PROJECT-URL。",
    "如果后台 job 已经显示 running，但没有 LISTEN，或者 server.log 里没有成功行，就先看 server.log；若是路径或启动错误，再 which -a node 并改用真实 node 二进制路径重试。",
    `当前失败原因：${input.reason}`,
  ].join("\n");

const buildPrivateDeliveryCorrectionReminder = (input: {
  expectedUrl: string;
  workspacePath: string;
  observedUrl: string | null;
  reason: string;
}): string =>
  [
    "这是私有提醒，不要回复这个私有房间。",
    "你刚才在共享项目房间的交付不合格，现在只修 backend 自己负责的服务。",
    input.observedUrl ? `错误交付 URL：${input.observedUrl}` : "你刚才没有交付出合格 URL。",
    `唯一正确的交付地址是：${input.expectedUrl}`,
    `唯一正确的 /api/status 标记必须包含：${API_MARKERS.join(", ")}`,
    ...buildBackendTerminalRecipe(input.expectedUrl, input.workspacePath),
    "不要继续规划，不要重复解释，修好后只回共享项目房间发送新的 PROJECT-URL。",
    `当前失败原因：${input.reason}`,
  ].join("\n");

const extractProjectUrl = (content: string): string | null => content.match(PROJECT_URL_PATTERN)?.[0] ?? null;
const isProjectUrlMessage = (message: PublicRoomMessageRecord, actorId: string, afterTimestamp: number): boolean =>
  message.createdAt >= afterTimestamp &&
  message.senderActorId === actorId &&
  message.content.includes("PROJECT-URL") &&
  extractProjectUrl(message.content) !== null;

const buildMissingProjectUrlFeedbackPrompt = (expectedUrl: string, workspacePath: string): string =>
  [
    "backend 现在还没有完成最终汇报。",
    "不要把问题理解成“只差发一条 PROJECT-URL”。先确认服务真的完成了。",
    "先用 root_bash 进入 shell；如果当前没有 terminal，就先执行 terminal create --help，然后用 JSON 形式创建一个显式 cwd 的 terminal；如果已有 terminal，就先恢复它。",
    `再次确认当前目录必须是：${workspacePath}`,
    "如果 server.js 还没真正写到磁盘，就先把它写到这个目录；不要前台卡住，必须后台运行，并把输出重定向到 server.log。",
    `然后立刻用 root_bash 检查 lsof -nP -iTCP:${new URL(expectedUrl).port} -sTCP:LISTEN`,
    "再用 root_bash 检查 server.log 是否已经出现 Server running ...。",
    "如果没有 LISTEN，或者 server.log 里没有成功行，就先看 server.log；若是路径或启动错误，再 which -a node 并改用真实 node 二进制路径重试。",
    `只要确认服务已经稳定监听，就回项目房间发送 PROJECT-URL: ${expectedUrl}`,
    "不要继续规划，不要重复解释，也不要只说“马上处理”。",
  ].join("\n");

const formatDeliveryFindings = (findings: string[]): string[] =>
  findings.length === 0 ? [] : ["我已经观察到这些具体问题：", ...findings.map((finding) => `- ${finding}`)];

const buildMissingProjectUrlFeedbackPromptWithFindings = (
  expectedUrl: string,
  workspacePath: string,
  findings: string[],
): string =>
  [...buildMissingProjectUrlFeedbackPrompt(expectedUrl, workspacePath).split("\n"), ...formatDeliveryFindings(findings)].join(
    "\n",
  );

const buildPrivateProjectUrlReminder = (input: {
  expectedUrl: string;
  workspacePath: string;
  serviceReady: boolean;
  findings?: string[];
}): string =>
  [
    "这是私有提醒，不要回复这个私有房间。",
    input.serviceReady
      ? `用户侧已经验证服务地址 ${input.expectedUrl} 可访问。`
      : `共享项目房间还没有收到你的最终交付消息，而且 ${input.expectedUrl} 还没有稳定可用。`,
    input.serviceReady
      ? "你现在唯一要做的，是立刻回到共享项目房间。"
      : `先恢复或创建 terminal，确认 cwd 是 ${input.workspacePath}，确保 server.js 已写好、服务已后台启动；监听和日志检查走 root_bash。`,
    input.serviceReady
      ? `只发送一条 PROJECT-URL: ${input.expectedUrl}`
      : `等你确认 LISTEN 和 server.log 都正常后，只发送一条 PROJECT-URL: ${input.expectedUrl}`,
    ...(input.serviceReady ? [] : buildBackendTerminalRecipe(input.expectedUrl, input.workspacePath)),
    ...formatDeliveryFindings(input.findings ?? []),
    "不要继续使用 terminal 之外的工具解释过程，不要回复别的内容。",
  ].join("\n");

const projectRoomMessagesWithActors = (messages: PublicRoomMessageRecord[]) =>
  messages.map((message) => ({
    messageId: message.messageId,
    senderActorId: message.senderActorId ?? null,
    from: message.from,
    content: message.content,
    createdAt: message.createdAt,
    attachments:
      message.attachments?.map((attachment) => ({
        assetId: attachment.assetId,
        name: attachment.name,
        mimeType: attachment.mimeType,
      })) ?? [],
  }));

export interface RealProjectRoomCollaborationDiagnostics {
  workspacePath: string;
  deliveryUrl: string | null;
  htmlObservation: {
    status?: number;
    body?: string;
    error: string;
  } | null;
  apiObservation: {
    status?: number;
    body?: string;
    error: string;
  } | null;
  workspaceFiles: {
    serverJs: string | null;
    indexHtml: string | null;
    designSvg: string | null;
    serverLog: string | null;
  };
  sharedRoomMessages: ReturnType<typeof projectRoomMessagesWithActors>;
  sharedRoomAssets: Array<{
    assetId: string;
    name: string;
    mimeType: string;
    uploadedByActorId?: string;
  }>;
  backendAttention: SessionRuntimeAttentionState;
  frontendAttention: SessionRuntimeAttentionState;
  backendChannels: Array<{
    chatId: string;
    title: string;
    focused: boolean;
  }>;
  frontendChannels: Array<{
    chatId: string;
    title: string;
    focused: boolean;
  }>;
  backendTerminals: Array<{
    terminalId: string;
    running: boolean;
    cwd?: string;
    focused?: boolean;
    title?: string;
  }>;
  backendTerminalReads: Array<{
    terminalId: string;
    representation?: string;
    status?: string;
    running?: boolean;
    title?: string;
    tail?: string;
    diff?: string;
    error?: string;
  }>;
  frontendTerminals: Array<{
    terminalId: string;
    running: boolean;
    cwd?: string;
    focused?: boolean;
    title?: string;
  }>;
  frontendTerminalReads: Array<{
    terminalId: string;
    representation?: string;
    status?: string;
    running?: boolean;
    title?: string;
    tail?: string;
    diff?: string;
    error?: string;
  }>;
  backendModelCalls: Array<{
    id: number;
    cycleId: number | null;
    status: "running" | "done" | "error" | "cancelled";
    outcome: string | null;
    tools: string[];
  }>;
  frontendModelCalls: Array<{
    id: number;
    cycleId: number | null;
    status: "running" | "done" | "error" | "cancelled";
    outcome: string | null;
    tools: string[];
  }>;
}

export interface RealProjectRoomCollaborationScenarioResult {
  projectRoom: RealTeamProjectRoom;
  backendContract: PublicRoomMessageRecord;
  frontendPlan: PublicRoomMessageRecord;
  apiQuestion: PublicRoomMessageRecord;
  apiAnswer: PublicRoomMessageRecord;
  designAttachmentMessage: PublicRoomMessageRecord;
  projectUrlMessage: PublicRoomMessageRecord;
  userAcceptanceMessage: PublicRoomMessageRecord;
  designSvg: string;
  attachedAssetId: string;
  deliveryUrl: string;
  htmlBody: string;
  apiBody: string;
  backendAttention: SessionRuntimeAttentionState;
  frontendAttention: SessionRuntimeAttentionState;
  backendModelCalls: Array<{
    id: number;
    cycleId: number | null;
    status: "running" | "done" | "error" | "cancelled";
    outcome: string | null;
    tools: string[];
  }>;
  frontendModelCalls: Array<{
    id: number;
    cycleId: number | null;
    status: "running" | "done" | "error" | "cancelled";
    outcome: string | null;
    tools: string[];
  }>;
}

const readParticipantTerminalDiagnostics = async (
  harness: RealTeamKernelHarness,
  participant: RealTeamParticipant,
) => {
  const sessionId = participant === "backend" ? harness.backendSession.id : harness.frontendSession.id;
  const terminals = harness.kernel.listTerminals(sessionId);
  return await Promise.all(
    terminals.map(async (terminal) => {
      try {
        const read = await harness.kernel.readGlobalTerminal({
          terminalId: terminal.terminalId,
          mode: "snapshot",
          remark: false,
          superadminActorId: harness.userActorId,
        });
        return {
          terminalId: terminal.terminalId,
          representation: read.representation,
          status: read.status,
          running: read.running,
          title: read.title,
          tail: read.tail,
          diff: read.diff,
        };
      } catch (error) {
        return {
          terminalId: terminal.terminalId,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }),
  );
};

const collectDiagnostics = async (
  harness: RealTeamKernelHarness,
  room: Pick<RealTeamProjectRoom, "room"> | null,
  state: {
    deliveryUrl: string | null;
    htmlObservation: RealProjectRoomCollaborationDiagnostics["htmlObservation"];
    apiObservation: RealProjectRoomCollaborationDiagnostics["apiObservation"];
  },
): Promise<RealProjectRoomCollaborationDiagnostics> => {
  const [
    backendAttention,
    frontendAttention,
    backendModelCalls,
    frontendModelCalls,
    backendTerminalReads,
    frontendTerminalReads,
    serverJs,
    indexHtml,
    designSvg,
    serverLog,
  ] = await Promise.all([
    harness.kernel.inspectAttentionState(harness.backendSession.id),
    harness.kernel.inspectAttentionState(harness.frontendSession.id),
    listParticipantModelCalls(harness, "backend"),
    listParticipantModelCalls(harness, "frontend"),
    readParticipantTerminalDiagnostics(harness, "backend"),
    readParticipantTerminalDiagnostics(harness, "frontend"),
    readWorkspaceTextIfExists(harness.workspacePath, "server.js"),
    readWorkspaceTextIfExists(harness.workspacePath, "index.html"),
    readWorkspaceTextIfExists(harness.workspacePath, "design.svg"),
    readWorkspaceTextIfExists(harness.workspacePath, "server.log"),
  ]);
  return {
    workspacePath: harness.workspacePath,
    deliveryUrl: state.deliveryUrl,
    htmlObservation: state.htmlObservation,
    apiObservation: state.apiObservation,
    workspaceFiles: {
      serverJs,
      indexHtml,
      designSvg,
      serverLog,
    },
    sharedRoomMessages: room ? projectRoomMessagesWithActors(harness.listProjectRoomMessages(room, 120)) : [],
    sharedRoomAssets:
      room?.room.chatId
        ? harness.listProjectRoomAssets(room).map((asset) => ({
            assetId: asset.assetId,
            name: asset.name,
            mimeType: asset.mimeType,
            uploadedByActorId: asset.uploadedByActorId,
          }))
        : [],
    backendAttention,
    frontendAttention,
    backendChannels: harness.kernel.listMessageChannels(harness.backendSession.id).map((channel) => ({
      chatId: channel.chatId,
      title: channel.title,
      focused: channel.focused,
    })),
    frontendChannels: harness.kernel.listMessageChannels(harness.frontendSession.id).map((channel) => ({
      chatId: channel.chatId,
      title: channel.title,
      focused: channel.focused,
    })),
    backendTerminals: harness.kernel.listTerminals(harness.backendSession.id).map((terminal) => ({
      terminalId: terminal.terminalId,
      running: terminal.processPhase === "running",
      cwd: terminal.launchCwd,
      focused: terminal.focused,
      title: terminal.currentTitle ?? terminal.configuredTitle ?? terminal.terminalId,
    })),
    backendTerminalReads,
    frontendTerminals: harness.kernel.listTerminals(harness.frontendSession.id).map((terminal) => ({
      terminalId: terminal.terminalId,
      running: terminal.processPhase === "running",
      cwd: terminal.launchCwd,
      focused: terminal.focused,
      title: terminal.currentTitle ?? terminal.configuredTitle ?? terminal.terminalId,
    })),
    frontendTerminalReads,
    backendModelCalls: backendModelCalls.map((call) => ({
      id: call.id,
      cycleId: call.cycleId,
      status: call.status,
      outcome: readModelOutcomeCode(call),
      tools: extractToolTraceTools(call),
    })),
    frontendModelCalls: frontendModelCalls.map((call) => ({
      id: call.id,
      cycleId: call.cycleId,
      status: call.status,
      outcome: readModelOutcomeCode(call),
      tools: extractToolTraceTools(call),
    })),
  };
};

const probeExpectedDelivery = async (
  url: string,
  state: {
    deliveryUrl: string | null;
    htmlObservation: RealProjectRoomCollaborationDiagnostics["htmlObservation"];
    apiObservation: RealProjectRoomCollaborationDiagnostics["apiObservation"];
  },
): Promise<boolean> => {
  state.deliveryUrl = url;
  const html = await fetchTextWithMarkers(url, HTML_MARKERS);
  state.htmlObservation = {
    status: html.status,
    body: html.body,
    error: html.ok ? "" : html.error,
  };
  if (!html.ok) {
    return false;
  }

  const api = await fetchTextWithMarkers(`${url.replace(/\/?$/u, "")}/api/status`, API_MARKERS);
  state.apiObservation = {
    status: api.status,
    body: api.body,
    error: api.ok ? "" : api.error,
  };
  return api.ok;
};

export const runRealProjectRoomCollaborationScenario = async (
  harness: RealTeamKernelHarness,
): Promise<RealProjectRoomCollaborationScenarioResult> => {
  const debugState: {
    deliveryUrl: string | null;
    htmlObservation: RealProjectRoomCollaborationDiagnostics["htmlObservation"];
    apiObservation: RealProjectRoomCollaborationDiagnostics["apiObservation"];
  } = {
    deliveryUrl: null,
    htmlObservation: null,
    apiObservation: null,
  };
  let room: RealTeamProjectRoom | null = null;
  try {
    for (const participant of ["backend", "frontend"] as const) {
      const sent = await harness.sendPrivatePrimer(participant, buildPrimer(participant));
      if (!sent.ok) {
        throw new Error(`failed to send ${participantLabel(participant)} primer: ${sent.reason ?? "unknown"}`);
      }
    }

    room = await harness.createProjectRoom({
      title: "real-project-room",
      metadata: { scenario: "real-ai-project-room-collaboration" },
    });
    await harness.focusProjectRoom(room, ["backend"]);

    const expectedUrl = `http://127.0.0.1:${await allocatePort()}/`;
    const kickoffAt = Date.now();
    const kickoffSent = harness.kernel.sendGlobalRoomMessage({
      chatId: room.room.chatId,
      actorId: harness.userActorId,
      text: buildKickoffPrompt(),
    });
    if (!kickoffSent.ok) {
      throw new Error(`failed to send project room kickoff: ${kickoffSent.reason ?? "unknown"}`);
    }

    let backendContract: PublicRoomMessageRecord | null = null;
    let backendContractSearchAfter = kickoffAt;
    let backendContractFailureReason = "";
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const candidate = await waitForRoomMessage(harness, room, {
          label: attempt === 0 ? "backend contract" : "backend corrected contract",
          predicate: (message) =>
            message.createdAt >= backendContractSearchAfter &&
            message.senderActorId === harness.backendActorId &&
            message.content.includes("BACKEND-CONTRACT:"),
        });
        if (isNonSpeculativeBackendContract(candidate.content)) {
          backendContract = candidate;
          break;
        }
        backendContractFailureReason = `backend contract violated single-source contract law: ${candidate.content}`;
      } catch (error) {
        backendContractFailureReason = error instanceof Error ? error.message : String(error);
      }

      if (attempt === 1) {
        break;
      }

      const correctionAt = Date.now();
      const correctionSent = harness.kernel.sendGlobalRoomMessage({
        chatId: room.room.chatId,
        actorId: harness.userActorId,
        text: buildBackendContractCorrectionPrompt(),
      });
      if (!correctionSent.ok) {
        throw new Error(`failed to send backend contract correction: ${correctionSent.reason ?? "unknown"}`);
      }
      backendContractSearchAfter = correctionAt;
    }
    if (!backendContract) {
      throw new Error(backendContractFailureReason || "backend contract missing");
    }
    await harness.blurProjectRoom(room, ["backend"]);
    await harness.focusProjectRoom(room, ["frontend"]);

    const frontendPromptAt = Date.now();
    const frontendPromptSent = harness.kernel.sendGlobalRoomMessage({
      chatId: room.room.chatId,
      actorId: harness.userActorId,
      text: buildFrontendPlanningPrompt(),
    });
    if (!frontendPromptSent.ok) {
      throw new Error(`failed to send frontend planning prompt: ${frontendPromptSent.reason ?? "unknown"}`);
    }

    const frontendPlan = await waitForRoomMessage(harness, room, {
      label: "frontend plan",
      predicate: (message) =>
        message.createdAt >= kickoffAt &&
        message.senderActorId === harness.frontendActorId &&
        message.content.includes("FRONTEND-PLAN:"),
    });
    let apiQuestion: PublicRoomMessageRecord | null = null;
    let apiQuestionSearchAfter = frontendPlan.createdAt;
    let apiQuestionFailureReason = "";
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const candidate = await waitForRoomMessage(harness, room, {
          label: attempt === 0 ? "frontend api question" : "frontend corrected api question",
          predicate: (message) =>
            message.createdAt >= apiQuestionSearchAfter &&
            message.senderActorId === harness.frontendActorId &&
            message.content.includes("API-QUESTION:"),
        });
        if (isSingleSourceApiQuestion(candidate.content)) {
          apiQuestion = candidate;
          break;
        }
        apiQuestionFailureReason = `frontend api question violated single-source contract law: ${candidate.content}`;
      } catch (error) {
        apiQuestionFailureReason = error instanceof Error ? error.message : String(error);
      }

      if (attempt === 1) {
        break;
      }

      const correctionAt = Date.now();
      const correctionSent = harness.kernel.sendGlobalRoomMessage({
        chatId: room.room.chatId,
        actorId: harness.userActorId,
        text: buildFrontendQuestionCorrectionPrompt(),
      });
      if (!correctionSent.ok) {
        throw new Error(`failed to send frontend api question correction: ${correctionSent.reason ?? "unknown"}`);
      }
      apiQuestionSearchAfter = correctionAt;
    }
    if (!apiQuestion) {
      throw new Error(apiQuestionFailureReason || "frontend api question missing");
    }
    await harness.blurProjectRoom(room, ["frontend"]);
    await harness.focusProjectRoom(room, ["backend"]);

    const backendAnswerAt = Date.now();
    const backendAnswerSent = harness.kernel.sendGlobalRoomMessage({
      chatId: room.room.chatId,
      actorId: harness.userActorId,
      text: buildBackendAnswerPrompt(),
    });
    if (!backendAnswerSent.ok) {
      throw new Error(`failed to send backend answer prompt: ${backendAnswerSent.reason ?? "unknown"}`);
    }

    let apiAnswer: PublicRoomMessageRecord | null = null;
    let apiAnswerSearchAfter = apiQuestion.createdAt;
    let apiAnswerFailureReason = "";
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const candidate = await waitForRoomMessage(harness, room, {
          label: attempt === 0 ? "backend api answer" : "backend corrected api answer",
          predicate: (message) =>
            message.createdAt >= apiAnswerSearchAfter &&
            message.senderActorId === harness.backendActorId &&
            message.content.includes("API-ANSWER:"),
        });
        if (isSingleSourceApiAnswer(candidate.content)) {
          apiAnswer = candidate;
          break;
        }
        apiAnswerFailureReason = `backend api answer violated single-source contract law: ${candidate.content}`;
      } catch (error) {
        apiAnswerFailureReason = error instanceof Error ? error.message : String(error);
      }

      if (attempt === 1) {
        break;
      }

      const correctionAt = Date.now();
      const correctionSent = harness.kernel.sendGlobalRoomMessage({
        chatId: room.room.chatId,
        actorId: harness.userActorId,
        text: buildBackendAnswerCorrectionPrompt(),
      });
      if (!correctionSent.ok) {
        throw new Error(`failed to send backend contract correction: ${correctionSent.reason ?? "unknown"}`);
      }
      apiAnswerSearchAfter = correctionAt;
    }
    if (!apiAnswer) {
      throw new Error(apiAnswerFailureReason || "backend api answer missing");
    }
    await harness.blurProjectRoom(room, ["backend"]);
    await harness.focusProjectRoom(room, ["frontend"]);

    const frontendBuildAt = Date.now();
    const frontendBuildSent = harness.kernel.sendGlobalRoomMessage({
      chatId: room.room.chatId,
      actorId: harness.userActorId,
      text: buildFrontendBuildPrompt(harness.workspacePath),
    });
    if (!frontendBuildSent.ok) {
      throw new Error(`failed to send frontend build prompt: ${frontendBuildSent.reason ?? "unknown"}`);
    }

    let designSvg = "";
    let frontendFilesReady = false;
    let frontendFilesFailureReason = "";

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const fileTimeoutMs = attempt === 0 ? FRONTEND_INITIAL_FILE_TIMEOUT_MS : FRONTEND_RETRY_FILE_TIMEOUT_MS;
      try {
        designSvg = await waitForWorkspaceFile(harness, {
          relativePath: DESIGN_FILE_PATH,
          marker: DESIGN_FILE_MARKER,
          label: "frontend design svg",
          timeoutMs: fileTimeoutMs,
        });
        await waitForWorkspaceFile(harness, {
          relativePath: INDEX_FILE_PATH,
          markers: HTML_MARKERS,
          label: "frontend index html",
          timeoutMs: fileTimeoutMs,
        });
        frontendFilesReady = true;
        break;
      } catch (error) {
        frontendFilesFailureReason = error instanceof Error ? error.message : String(error);
      }

      if (attempt === 2) {
        break;
      }

      await focusLatestParticipantTerminal(harness, "frontend");
      const frontendDiskFeedbackSent = harness.kernel.sendGlobalRoomMessage({
        chatId: room.room.chatId,
        actorId: harness.userActorId,
        text: buildFrontendDiskFeedbackPrompt(harness.workspacePath),
      });
      if (!frontendDiskFeedbackSent.ok) {
        throw new Error(`failed to send frontend disk feedback: ${frontendDiskFeedbackSent.reason ?? "unknown"}`);
      }
      const frontendPrivateReminderSent = await harness.sendPrivatePrimer(
        "frontend",
        buildPrivateFrontendDiskReminder(harness.workspacePath),
      );
      if (!frontendPrivateReminderSent.ok) {
        throw new Error(
          `failed to send frontend private disk reminder: ${frontendPrivateReminderSent.reason ?? "unknown"}`,
        );
      }
      await focusLatestParticipantTerminal(harness, "frontend");
      await harness.focusProjectRoom(room, ["frontend"]);
    }

    if (!frontendFilesReady) {
      throw new Error(frontendFilesFailureReason || "frontend files not written to workspace");
    }

    const frontendReportAt = Date.now();
    const frontendReportSent = harness.kernel.sendGlobalRoomMessage({
      chatId: room.room.chatId,
      actorId: harness.userActorId,
      text: buildFrontendReportPrompt(),
    });
    if (!frontendReportSent.ok) {
      throw new Error(`failed to send frontend report prompt: ${frontendReportSent.reason ?? "unknown"}`);
    }

    await waitForRoomMessage(harness, room, {
      label: "frontend design file message",
      predicate: (message) =>
        message.createdAt >= frontendReportAt &&
        message.senderActorId === harness.frontendActorId &&
        message.content.includes(`DESIGN-FILE: ${DESIGN_FILE_PATH}`),
      timeoutMs: BACKEND_REPORT_TIMEOUT_MS / 2,
    }).catch(() => null);

    const bridge = await harness.bridgeWorkspaceFileToProjectRoomAttachment({
      room,
      participant: "frontend",
      relativePath: DESIGN_FILE_PATH,
      mimeType: "image/svg+xml",
      messageText: `DESIGN-ATTACHMENT: ${DESIGN_FILE_PATH}`,
    });
    if (!bridge.sent.ok) {
      throw new Error(`failed to send bridged design attachment: ${bridge.sent.reason ?? "unknown"}`);
    }

    const designAttachmentMessage = await waitForRoomMessage(harness, room, {
      label: "frontend design attachment message",
      predicate: (message) =>
        message.senderActorId === harness.frontendActorId &&
        message.content.includes(`DESIGN-ATTACHMENT: ${DESIGN_FILE_PATH}`) &&
        message.attachments?.some((attachment) => attachment.assetId === bridge.asset.assetId) === true,
    });
    await harness.blurProjectRoom(room, ["frontend"]);
    await harness.focusProjectRoom(room, ["backend"]);

    const backendDeliveryAt = Date.now();
    const backendDeliverySent = harness.kernel.sendGlobalRoomMessage({
      chatId: room.room.chatId,
      actorId: harness.userActorId,
      text: buildBackendDeliveryPrompt(expectedUrl, harness.workspacePath),
    });
    if (!backendDeliverySent.ok) {
      throw new Error(`failed to send backend delivery prompt: ${backendDeliverySent.reason ?? "unknown"}`);
    }
    await focusLatestParticipantTerminal(harness, "backend");

    let projectUrlMessage: PublicRoomMessageRecord | null = null;
    let projectUrlFailureReason = "";
    let projectUrlSearchAfter = designAttachmentMessage.createdAt;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        projectUrlMessage = await waitForRoomMessage(harness, room, {
          label: attempt === 0 ? "backend project url" : "backend final project url",
          predicate: (message) => isProjectUrlMessage(message, harness.backendActorId, projectUrlSearchAfter),
          timeoutMs: BACKEND_REPORT_TIMEOUT_MS,
        });
        break;
      } catch (error) {
        projectUrlFailureReason = error instanceof Error ? error.message : String(error);
      }

      if (attempt === 1) {
        break;
      }

      const reportFeedbackAt = Date.now();
      const deliveryFindings = await inspectBackendDeliveryDraft(harness.workspacePath, expectedUrl);
      const reportFeedbackSent = harness.kernel.sendGlobalRoomMessage({
        chatId: room.room.chatId,
        actorId: harness.userActorId,
        text: buildMissingProjectUrlFeedbackPromptWithFindings(expectedUrl, harness.workspacePath, deliveryFindings),
      });
      if (!reportFeedbackSent.ok) {
        throw new Error(`failed to send backend project url feedback: ${reportFeedbackSent.reason ?? "unknown"}`);
      }
      const privateRecoverySent = await harness.sendPrivatePrimer(
        "backend",
        buildPrivateProjectUrlReminder({
          expectedUrl,
          workspacePath: harness.workspacePath,
          serviceReady: false,
          findings: deliveryFindings,
        }),
      );
      if (!privateRecoverySent.ok) {
        throw new Error(`failed to send backend recovery reminder: ${privateRecoverySent.reason ?? "unknown"}`);
      }
      await focusLatestParticipantTerminal(harness, "backend");
      projectUrlSearchAfter = reportFeedbackAt;
    }

    if (!projectUrlMessage) {
      const serviceReady = await probeExpectedDelivery(expectedUrl, debugState);
      const deliveryFindings = await inspectBackendDeliveryDraft(harness.workspacePath, expectedUrl);
      await focusLatestParticipantTerminal(harness, "backend");
      const privateReminderSent = await harness.sendPrivatePrimer(
        "backend",
        buildPrivateProjectUrlReminder({
          expectedUrl,
          workspacePath: harness.workspacePath,
          serviceReady,
          findings: deliveryFindings,
        }),
      );
      if (!privateReminderSent.ok) {
        throw new Error(`failed to send backend private project url reminder: ${privateReminderSent.reason ?? "unknown"}`);
      }
      await focusLatestParticipantTerminal(harness, "backend");

      const privateReminderAt = Date.now();
      try {
        projectUrlMessage = await waitForRoomMessage(harness, room, {
          label: "backend private-reminded project url",
          predicate: (message) => isProjectUrlMessage(message, harness.backendActorId, privateReminderAt),
          timeoutMs: BACKEND_REPORT_TIMEOUT_MS,
        });
      } catch (error) {
        projectUrlFailureReason = error instanceof Error ? error.message : String(error);
      }
    }

    if (!projectUrlMessage) {
      const serviceReadyAfterReminder = await probeExpectedDelivery(expectedUrl, debugState);
      if (serviceReadyAfterReminder) {
        const secondReminderSent = await harness.sendPrivatePrimer(
          "backend",
          buildPrivateProjectUrlReminder({
            expectedUrl,
            workspacePath: harness.workspacePath,
            serviceReady: true,
          }),
        );
        if (!secondReminderSent.ok) {
          throw new Error(`failed to send backend final report reminder: ${secondReminderSent.reason ?? "unknown"}`);
        }
        const secondReminderAt = Date.now();
        try {
          projectUrlMessage = await waitForRoomMessage(harness, room, {
            label: "backend service-ready project url",
            predicate: (message) => isProjectUrlMessage(message, harness.backendActorId, secondReminderAt),
            timeoutMs: BACKEND_REPORT_TIMEOUT_MS,
          });
        } catch (error) {
          projectUrlFailureReason = error instanceof Error ? error.message : String(error);
        }
      }
    }

    if (!projectUrlMessage) {
      throw new Error(projectUrlFailureReason || "backend project url message missing");
    }

    let deliveryUrl = extractProjectUrl(projectUrlMessage.content);
    let htmlResult: { status: number; body: string } | null = null;
    let apiResult: { status: number; body: string } | null = null;
    let deliveryVerified = false;
    let deliveryFailureReason = "";

    for (let attempt = 0; attempt < 2; attempt += 1) {
      deliveryUrl = extractProjectUrl(projectUrlMessage.content);
      debugState.deliveryUrl = deliveryUrl;
      debugState.htmlObservation = null;
      debugState.apiObservation = null;

      if (!deliveryUrl) {
        deliveryFailureReason = `project url message missing url: ${projectUrlMessage.content}`;
      } else {
        try {
          htmlResult = await waitForHttpMarkers(deliveryUrl, HTML_MARKERS, {
            label: "project html",
            timeoutMs: DELIVERY_CHECK_TIMEOUT_MS,
            onObservation: (observation) => {
              debugState.htmlObservation = observation;
            },
          });
          apiResult = await waitForHttpMarkers(`${deliveryUrl.replace(/\/?$/u, "")}/api/status`, API_MARKERS, {
            label: "project api",
            timeoutMs: DELIVERY_CHECK_TIMEOUT_MS,
            onObservation: (observation) => {
              debugState.apiObservation = observation;
            },
          });
          deliveryVerified = true;
          break;
        } catch (error) {
          deliveryFailureReason = error instanceof Error ? error.message : String(error);
        }
      }

      if (attempt === 1) {
        break;
      }

      const feedbackAt = Date.now();
      const feedbackSent = harness.kernel.sendGlobalRoomMessage({
        chatId: room.room.chatId,
        actorId: harness.userActorId,
        text: buildDeliveryFeedbackPrompt({
          expectedUrl,
          observedUrl: deliveryUrl,
          reason: deliveryFailureReason,
        }),
      });
      if (!feedbackSent.ok) {
        throw new Error(`failed to send delivery feedback: ${feedbackSent.reason ?? "unknown"}`);
      }
      const privateReminderSent = await harness.sendPrivatePrimer(
        "backend",
        buildPrivateDeliveryCorrectionReminder({
          expectedUrl,
          workspacePath: harness.workspacePath,
          observedUrl: deliveryUrl,
          reason: deliveryFailureReason,
        }),
      );
      if (!privateReminderSent.ok) {
        throw new Error(`failed to send backend delivery correction reminder: ${privateReminderSent.reason ?? "unknown"}`);
      }

      projectUrlMessage = await waitForRoomMessage(harness, room, {
        label: "backend corrected project url",
        predicate: (message) => isProjectUrlMessage(message, harness.backendActorId, feedbackAt),
        timeoutMs: BACKEND_REPORT_TIMEOUT_MS,
      });
    }

    if (!deliveryVerified || !deliveryUrl || !htmlResult || !apiResult) {
      throw new Error(deliveryFailureReason || `project delivery not verified: ${projectUrlMessage.content}`);
    }
    await harness.focusProjectRoom(room, ["frontend"]);

    const acceptanceText = `USER-ACCEPTED: verified ${deliveryUrl} and /api/status`;
    const accepted = harness.kernel.sendGlobalRoomMessage({
      chatId: room.room.chatId,
      actorId: harness.userActorId,
      text: acceptanceText,
    });
    if (!accepted.ok) {
      throw new Error(`failed to send user acceptance: ${accepted.reason ?? "unknown"}`);
    }

    const userAcceptanceMessage = await waitForRoomMessage(harness, room, {
      label: "user acceptance message",
      predicate: (message) => message.senderActorId === harness.userActorId && message.content === acceptanceText,
    });

    const [backendAttention, frontendAttention, backendCalls, frontendCalls] = await Promise.all([
      harness.kernel.inspectAttentionState(harness.backendSession.id),
      harness.kernel.inspectAttentionState(harness.frontendSession.id),
      listParticipantModelCalls(harness, "backend"),
      listParticipantModelCalls(harness, "frontend"),
    ]);

    return {
      projectRoom: room,
      backendContract,
      frontendPlan,
      apiQuestion,
      apiAnswer,
      designAttachmentMessage,
      projectUrlMessage,
      userAcceptanceMessage,
      designSvg,
      attachedAssetId: bridge.asset.assetId,
      deliveryUrl,
      htmlBody: htmlResult.body,
      apiBody: apiResult.body,
      backendAttention,
      frontendAttention,
      backendModelCalls: backendCalls.map((call) => ({
        id: call.id,
        cycleId: call.cycleId,
        status: call.status,
        outcome: readModelOutcomeCode(call),
        tools: extractToolTraceTools(call),
      })),
      frontendModelCalls: frontendCalls.map((call) => ({
        id: call.id,
        cycleId: call.cycleId,
        status: call.status,
        outcome: readModelOutcomeCode(call),
        tools: extractToolTraceTools(call),
      })),
    };
  } catch (error) {
    const diagnostics = await collectDiagnostics(harness, room, debugState);
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(
      `real project room collaboration failed: ${reason}\n${JSON.stringify(diagnostics, null, 2)}`,
    );
  }
};
const allocatePort = async (): Promise<number> => {
  const server = createNetServer();
  await new Promise<void>((resolveReady, rejectReady) => {
    server.once("error", rejectReady);
    server.listen(0, "127.0.0.1", () => resolveReady());
  });
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  await new Promise<void>((resolveClose, rejectClose) => {
    server.close((error) => (error ? rejectClose(error) : resolveClose()));
  });
  if (!port) {
    throw new Error("failed to allocate project room delivery port");
  }
  return port;
};
