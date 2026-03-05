import { ChatEngine } from "@agenter/chat-system";
import { ResourceLoader } from "@agenter/settings";
import type { TextRenderable, TextareaRenderable } from "@opentui/core";
import { useKeyboard, useRenderer, useTerminalDimensions } from "@opentui/react";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  AgentRuntime,
  AgenterAI,
  FilePromptStore,
  ModelClient,
  SessionStore,
  TaskEngine,
  type AgentRuntimeStats,
  type LoopBusInput,
  type LoopBusPhase,
  type TaskCreateInput,
  type TaskImportItem,
  type TaskUpdateInput,
} from "@agenter/app-server";
import { CommandDispatcher } from "../core/command-dispatcher";
import {
  createEmptySnapshot,
  type AppStatus,
  type ChatMessage,
  type TaskStage,
  type TerminalSnapshot,
} from "../core/protocol";
import { TerminalAdapter } from "../core/terminal-adapter";
import { DebugLogger } from "../infra/logger";
import { StatusBar } from "../ui/components/StatusBar";
import { ChatPanel } from "../ui/panels/ChatPanel";
import { DebugLogPanel } from "../ui/panels/DebugLogPanel";
import { TerminalPanel } from "../ui/panels/TerminalPanel";
import { handleGlobalKey, nextPanel, type FocusPanel } from "./keymap";
import type { RuntimeConfig } from "./runtime-config";

const createId = (): string => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const clamp = (value: number, min: number): number => Math.max(min, value);
const HELP_MAX_CHARS = 8_192;
const STATUS_BAR_HEIGHT = 6;
const DEBUG_PANEL_HEIGHT = 14;
const LOOP_IDLE_COLLECT_INTERVAL_MS = 1_500;
const IDLE_HEARTBEAT_INTERVAL_MS = 12_000;
const LARGE_DIFF_BYTES = 16_000;
const resolveChatAiStatus = (
  stage: TaskStage,
  loopPhase: LoopBusPhase,
  processState: "stopped" | "running",
): string | null => {
  if (loopPhase === "stopped") {
    return null;
  }
  if (loopPhase === "waiting_processor_response") {
    return "等待服务返回";
  }
  if (loopPhase === "waiting_messages") {
    if (stage === "done" || stage === "idle" || stage === "error") {
      return "等待用户输入";
    }
    return processState === "running" ? "等待终端输出" : "等待新消息";
  }
  if (loopPhase === "processing_messages") {
    return "思考中";
  }
  if (loopPhase === "dispatching_tools" || loopPhase === "dispatching_terminal") {
    return "工具调用中";
  }
  if (loopPhase === "dispatching_user") {
    return "生成回复中";
  }
  if (loopPhase === "collecting_inputs") {
    return processState === "running" ? "等待终端输出" : "处理中";
  }

  if (stage === "done" || stage === "error" || stage === "idle") {
    return null;
  }
  if (stage === "observe" || stage === "act") {
    return processState === "running" ? "等待终端输出" : "处理中";
  }
  if (stage === "plan" || stage === "decide") {
    return "思考中";
  }
  return null;
};

const toCommandKey = (command: string): string => {
  const normalized = command.trim().toLowerCase();
  const tail =
    normalized
      .split(/[\\/]/g)
      .filter((part) => part.length > 0)
      .at(-1) ?? normalized;
  return tail.replace(/[^a-z0-9_-]+/g, "");
};

const measureTerminalContentSize = (termWidth: number, termHeight: number): { cols: number; rows: number } => {
  const rootInnerWidth = clamp(termWidth - 2, 20);
  const rootInnerHeight = clamp(termHeight - 2, 12);
  const topAreaHeight = clamp(rootInnerHeight - STATUS_BAR_HEIGHT - DEBUG_PANEL_HEIGHT, 8);
  const terminalPanelOuterWidth = clamp(Math.floor(rootInnerWidth * 0.6), 20);
  const terminalContentWidth = clamp(terminalPanelOuterWidth - 2 - 2, 10);
  const terminalContentHeight = clamp(topAreaHeight - 2 - 2, 4);
  return { cols: terminalContentWidth, rows: terminalContentHeight };
};

const serializeTerminalDiff = (
  terminalId: string,
  input: {
    fromHash: string | null;
    toHash: string | null;
    diff: string;
    bytes: number;
    status: "IDLE" | "BUSY";
  },
): string =>
  JSON.stringify({
    kind: "terminal-diff",
    terminalId,
    fromHash: input.fromHash,
    toHash: input.toHash,
    bytes: input.bytes,
    status: input.status,
    diff: input.diff,
  });

const buildTerminalSnapshotPayload = (terminalId: string, snapshot: TerminalSnapshot) => ({
  kind: "terminal-snapshot",
  terminalId,
  seq: snapshot.seq,
  cols: snapshot.cols,
  rows: snapshot.rows,
  cursor: snapshot.cursor,
  tail: snapshot.lines.slice(-20),
});

const buildTerminalHeartbeatPayload = (
  terminalId: string,
  snapshot: TerminalSnapshot,
  status: "IDLE" | "BUSY",
  reason: "idle-poll" | "large-diff",
) => ({
  kind: "terminal-heartbeat",
  terminalId,
  status,
  seq: snapshot.seq,
  cols: snapshot.cols,
  rows: snapshot.rows,
  cursor: snapshot.cursor,
  reason,
  tail: snapshot.lines.slice(-12),
});

const buildTerminalHelpPayload = (
  terminalId: string,
  help: {
    command: string;
    source: string;
    doc: {
      syntax: "md" | "mdx";
      content: string;
    };
    manuals?: Record<string, string>;
    truncated?: boolean;
    error?: string;
  },
) => ({
  kind: "terminal-help",
  terminalId,
  command: help.command,
  source: help.source,
  truncated: help.truncated ?? false,
  error: help.error,
  doc: help.doc,
  manuals: help.manuals ?? {},
});

interface AppProps {
  runtimeConfig: RuntimeConfig;
}

export const App = ({ runtimeConfig }: AppProps) => {
  const renderer = useRenderer();
  const { width: termWidth, height: termHeight } = useTerminalDimensions();

  const logger = useMemo(() => new DebugLogger("logs", 1200), []);
  const sessionStore = useMemo(
    () =>
      new SessionStore({
        sessionRoot: "logs",
        session: {
          id: `demo-${createId()}`,
          name: "demo",
          cwd: runtimeConfig.agentCwd,
          avatar: "demo",
          storeTarget: "workspace",
        },
      }),
    [runtimeConfig.agentCwd],
  );
  const resourceLoader = useMemo(
    () =>
      new ResourceLoader({
        context: {
          projectRoot: runtimeConfig.agentCwd,
          cwd: runtimeConfig.agentCwd,
        },
      }),
    [runtimeConfig.agentCwd],
  );
  const promptStore = useMemo(
    () =>
      new FilePromptStore({
        lang: runtimeConfig.lang,
        rootDir: runtimeConfig.prompt.rootDir,
        agenterPath: runtimeConfig.prompt.agenterPath,
        agenterSystemPath: runtimeConfig.prompt.agenterSystemPath,
        systemTemplatePath: runtimeConfig.prompt.systemTemplatePath,
        responseContractPath: runtimeConfig.prompt.responseContractPath,
      }),
    [
      runtimeConfig.prompt.rootDir,
      runtimeConfig.lang,
      runtimeConfig.prompt.agenterPath,
      runtimeConfig.prompt.agenterSystemPath,
      runtimeConfig.prompt.systemTemplatePath,
      runtimeConfig.prompt.responseContractPath,
    ],
  );
  const modelClient = useMemo(
    () =>
      new ModelClient({
        providerId: runtimeConfig.ai.providerId,
        kind: runtimeConfig.ai.kind,
        apiKey: runtimeConfig.ai.apiKey,
        model: runtimeConfig.ai.model,
        baseUrl: runtimeConfig.ai.baseUrl,
        temperature: runtimeConfig.ai.temperature,
        maxRetries: runtimeConfig.ai.maxRetries,
        maxToken: runtimeConfig.ai.maxToken,
        compactThreshold: runtimeConfig.ai.compactThreshold,
      }),
    [
      runtimeConfig.ai.providerId,
      runtimeConfig.ai.kind,
      runtimeConfig.ai.apiKey,
      runtimeConfig.ai.model,
      runtimeConfig.ai.baseUrl,
      runtimeConfig.ai.temperature,
      runtimeConfig.ai.maxRetries,
      runtimeConfig.ai.maxToken,
      runtimeConfig.ai.compactThreshold,
    ],
  );
  const terminalAdapters = useMemo(() => {
    const entries = Object.entries(runtimeConfig.terminals).map(([terminalId, terminal]) => {
      const adapter = new TerminalAdapter(logger, {
        terminalId,
        command: terminal.command,
        commandLabel: terminal.commandLabel,
        cwd: terminal.cwd,
        cols: 80,
        rows: 20,
        outputRoot: terminal.outputRoot,
        gitLog: terminal.gitLog,
      });
      return [terminalId, adapter] as const;
    });
    return new Map(entries);
  }, [logger, runtimeConfig.terminals]);

  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [logs, setLogs] = useState(() => logger.getRecent(120));
  const [focus, setFocus] = useState<FocusPanel>("chat");
  const [scrollOffset, setScrollOffset] = useState(0);
  const [stage, setStage] = useState<TaskStage>("idle");
  const [processState, setProcessState] = useState<"stopped" | "running">("stopped");
  const [loopPhase, setLoopPhase] = useState<LoopBusPhase>("waiting_messages");
  const [focusedTerminalId, setFocusedTerminalId] = useState(runtimeConfig.focusedTerminalId);
  const [snapshotView, setSnapshotView] = useState<TerminalSnapshot>(createEmptySnapshot());
  const [terminalSize, setTerminalSize] = useState<{ cols: number; rows: number }>({ cols: 80, rows: 20 });
  const [layoutReady, setLayoutReady] = useState(false);
  const [terminalSizeReady, setTerminalSizeReady] = useState(false);
  const [agentStats, setAgentStats] = useState<AgentRuntimeStats>({
    loops: 0,
    apiCalls: 0,
    lastContextChars: 0,
    totalContextChars: 0,
  });

  const terminalSizeRef = useRef<{ cols: number; rows: number }>({ cols: 80, rows: 20 });
  const focusedTerminalIdRef = useRef(runtimeConfig.focusedTerminalId);
  const terminalSnapshotsRef = useRef<Record<string, TerminalSnapshot>>({});
  const snapshotRef = useRef<TerminalSnapshot>(createEmptySnapshot());
  const loopBusRef = useRef<AgentRuntime | null>(null);
  const terminalDirtyQueuedRef = useRef(new Set<string>());
  const terminalDirtyStateRef = useRef<Record<string, boolean>>({});
  const terminalLatestSeqRef = useRef<Record<string, number>>({});
  const bootInjectedRef = useRef(new Set<string>());
  const bootInProgressRef = useRef(false);
  const stageRef = useRef<TaskStage>("idle");
  const processStateRef = useRef<"stopped" | "running">("stopped");
  const lastIdleHeartbeatAtRef = useRef(0);
  const taskEngineRef = useRef(new TaskEngine());
  const chatEngineRef = useRef(new ChatEngine());

  const chatInputRef = useRef<TextareaRenderable | null>(null);
  const terminalContentRef = useRef<TextRenderable | null>(null);
  const debugContentRef = useRef<TextRenderable | null>(null);
  const chatAiStatus = useMemo(
    () => resolveChatAiStatus(stage, loopPhase, processState),
    [loopPhase, processState, stage],
  );

  const getAdapter = (terminalId: string): TerminalAdapter | null => terminalAdapters.get(terminalId) ?? null;

  useEffect(() => {
    focusedTerminalIdRef.current = focusedTerminalId;
  }, [focusedTerminalId]);

  useEffect(() => {
    stageRef.current = stage;
  }, [stage]);

  useEffect(() => {
    processStateRef.current = processState;
  }, [processState]);

  useEffect(() => {
    setFocusedTerminalId(runtimeConfig.focusedTerminalId);
    focusedTerminalIdRef.current = runtimeConfig.focusedTerminalId;
  }, [runtimeConfig.focusedTerminalId]);

  const dispatchToTerminal = async (
    adapter: TerminalAdapter,
    inputPayload: {
      taskId: string;
      text: string;
      submit: boolean;
      submitKey?: "enter" | "linefeed";
      submitGapMs?: number;
    },
  ): Promise<void> => {
    const dispatcher = new CommandDispatcher(
      {
        writeMixed: async (mixedInput) => {
          const result = await adapter.writeMixed(mixedInput, { wait: true });
          if (!result.ok) {
            throw new Error(result.reason ?? "terminal.writeMixed failed");
          }
        },
      },
      logger,
    );
    await dispatcher.dispatch(inputPayload);
  };

  const pushDirtySignal = (terminalId: string, seq?: number): void => {
    terminalDirtyStateRef.current[terminalId] = true;
    if (typeof seq === "number") {
      terminalLatestSeqRef.current[terminalId] = seq;
    }
    if (terminalDirtyQueuedRef.current.has(terminalId)) {
      return;
    }
    terminalDirtyQueuedRef.current.add(terminalId);
    loopBusRef.current?.pushMessage({
      name: `Terminal-${terminalId}`,
      role: "user",
      type: "text",
      source: "terminal",
      text: "__dirty__",
      meta: {
        signal: true,
        terminalId,
        seq: seq ?? null,
      },
    });
  };

  const readHelp = async (
    commandKey: string,
    helpSource: string | undefined,
  ): Promise<{
    command: string;
    source: string;
    doc: { syntax: "mdx"; content: string };
    manuals?: Record<string, string>;
    truncated?: boolean;
    error?: string;
  } | null> => {
    if (!helpSource) {
      return null;
    }
    const doc = {
      syntax: "mdx" as const,
      content: `<CliHelp command="${commandKey}"/>`,
    };
    try {
      const raw = await resourceLoader.readText(helpSource);
      const trimmed = raw.trim();
      if (trimmed.length <= HELP_MAX_CHARS) {
        return {
          command: commandKey,
          source: helpSource,
          doc,
          manuals: { [commandKey]: trimmed },
          truncated: false,
        };
      }
      return {
        command: commandKey,
        source: helpSource,
        doc,
        manuals: { [commandKey]: trimmed.slice(0, HELP_MAX_CHARS) },
        truncated: true,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { command: commandKey, source: helpSource, doc, error: message };
    }
  };

  const terminalGateway = useMemo(
    () => ({
      list: () =>
        Object.values(runtimeConfig.terminals).map((terminal) => ({
          terminalId: terminal.terminalId,
          running: getAdapter(terminal.terminalId)?.isRunning() ?? false,
          cwd: terminal.cwd,
          cols: terminalSizeRef.current.cols,
          rows: terminalSizeRef.current.rows,
          focused: focusedTerminalIdRef.current === terminal.terminalId,
          dirty: terminalDirtyStateRef.current[terminal.terminalId] ?? false,
          latestSeq: terminalLatestSeqRef.current[terminal.terminalId],
        })),
      run: async ({ terminalId }: { terminalId: string }) => {
        const terminal = runtimeConfig.terminals[terminalId];
        const adapter = getAdapter(terminalId);
        if (!terminal || !adapter) {
          return { ok: false, message: `unknown terminal: ${terminalId}` };
        }
        adapter.resize(terminalSizeRef.current.cols, terminalSizeRef.current.rows);
        if (!adapter.isRunning()) {
          adapter.start();
          if (terminal.gitLog) {
            await adapter.markDirty();
          }
        }
        terminalDirtyStateRef.current[terminalId] = false;
        const commandKey = toCommandKey(terminal.command[0] ?? terminalId);
        const help = await readHelp(commandKey, terminal.helpSource);
        const snapshot = terminalSnapshotsRef.current[terminalId] ?? adapter.getSnapshot();
        return {
          ok: true,
          message: "terminal started",
          terminalId,
          help,
          snapshot: buildTerminalSnapshotPayload(terminalId, snapshot),
        };
      },
      focus: async ({ terminalId, focus = true }: { terminalId: string; focus?: boolean }) => {
        if (!runtimeConfig.terminals[terminalId]) {
          return {
            ok: false,
            message: `unknown terminal: ${terminalId}`,
            focusedTerminalId: focusedTerminalIdRef.current,
          };
        }
        if (!focus) {
          return {
            ok: true,
            message: "focus=false ignored in exclusive mode",
            focusedTerminalId: focusedTerminalIdRef.current,
          };
        }
        focusedTerminalIdRef.current = terminalId;
        setFocusedTerminalId(terminalId);
        const focusedSnapshot = terminalSnapshotsRef.current[terminalId] ?? getAdapter(terminalId)?.getSnapshot();
        if (focusedSnapshot) {
          snapshotRef.current = focusedSnapshot;
          setSnapshotView(focusedSnapshot);
        }
        logger.log({
          channel: "agent",
          level: "info",
          message: "terminal.focus",
          meta: { terminalId },
        });
        return { ok: true, message: "focus updated", focusedTerminalId: terminalId };
      },
      kill: async ({ terminalId }: { terminalId: string }) => {
        const adapter = getAdapter(terminalId);
        if (!adapter) {
          return { ok: false, message: `unknown terminal: ${terminalId}` };
        }
        await adapter.stop();
        return { ok: true, message: "terminal stopped" };
      },
      write: async ({
        terminalId,
        text,
        submit = true,
        submitKey = "enter",
      }: {
        terminalId: string;
        text: string;
        submit?: boolean;
        submitKey?: "enter" | "linefeed";
      }) => {
        const terminal = runtimeConfig.terminals[terminalId];
        const adapter = getAdapter(terminalId);
        if (!terminal || !adapter) {
          return { ok: false, message: `unknown terminal: ${terminalId}` };
        }
        adapter.resize(terminalSizeRef.current.cols, terminalSizeRef.current.rows);
        if (!adapter.isRunning()) {
          adapter.start();
          if (terminal.gitLog) {
            await adapter.markDirty();
          }
        }
        await dispatchToTerminal(adapter, {
          taskId: "tool-terminal-write",
          text,
          submit,
          submitKey,
          submitGapMs: terminal.submitGapMs,
        });
        return { ok: true, message: "written" };
      },
      read: async ({ terminalId }: { terminalId: string }) => {
        const adapter = getAdapter(terminalId);
        if (!adapter) {
          return { ok: false, reason: `unknown terminal: ${terminalId}` };
        }
        const snapshot = terminalSnapshotsRef.current[terminalId] ?? adapter.getSnapshot();
        return buildTerminalSnapshotPayload(terminalId, snapshot);
      },
      markDirty: async ({ terminalId }: { terminalId: string }) => {
        const adapter = getAdapter(terminalId);
        if (!adapter) {
          return { ok: false, hash: null, reason: `unknown terminal: ${terminalId}` };
        }
        return adapter.markDirty();
      },
      sliceDirty: async ({
        terminalId,
        remark,
        wait,
        timeoutMs,
      }: {
        terminalId: string;
        remark?: boolean;
        wait?: boolean;
        timeoutMs?: number;
      }) => {
        const adapter = getAdapter(terminalId);
        if (!adapter) {
          return {
            ok: false,
            changed: false,
            fromHash: null,
            toHash: null,
            diff: "",
            bytes: 0,
            reason: `unknown terminal: ${terminalId}`,
          };
        }
        if (focusedTerminalIdRef.current === terminalId) {
          return {
            ok: true,
            ignored: true,
            changed: false,
            fromHash: null,
            toHash: null,
            diff: "",
            bytes: 0,
            reason: "focused terminal is auto-fed by LoopBus",
          };
        }
        const result = await adapter.sliceDirty({
          remark: remark ?? true,
          wait: wait ?? false,
          timeoutMs: timeoutMs ?? 30_000,
        });
        if (result.ok && remark !== false) {
          terminalDirtyStateRef.current[terminalId] = false;
        }
        return result;
      },
      releaseDirty: async ({ terminalId }: { terminalId: string }) => {
        const adapter = getAdapter(terminalId);
        if (!adapter) {
          return { ok: false, hash: null, reason: `unknown terminal: ${terminalId}` };
        }
        return adapter.markDirty();
      },
    }),
    [runtimeConfig.terminals, terminalAdapters],
  );

  const taskGateway = useMemo(
    () => ({
      list: () => taskEngineRef.current.list(),
      get: ({ source, id }: { source: string; id: string }) => taskEngineRef.current.get(source, id),
      create: (input: TaskCreateInput) => taskEngineRef.current.create(input),
      update: (input: TaskUpdateInput) => taskEngineRef.current.update(input),
      done: ({ source, id }: { source: string; id: string }) => taskEngineRef.current.done(source, id),
      addDependency: ({ source, id, target }: { source: string; id: string; target: string }) =>
        taskEngineRef.current.addDependency(source, id, target),
      removeDependency: ({ source, id, target }: { source: string; id: string; target: string }) =>
        taskEngineRef.current.removeDependency(source, id, target),
      triggerManual: ({ source, id }: { source: string; id: string }) =>
        taskEngineRef.current.triggerManual(source, id),
      emitEvent: ({ topic, payload, source }: { topic: string; payload?: unknown; source?: "api" | "file" | "tool" }) =>
        taskEngineRef.current.emitEvent({ topic, payload, source }),
      import: (items: TaskImportItem[]) => taskEngineRef.current.import(items),
    }),
    [],
  );

  const chatGateway = useMemo(
    () => ({
      list: () => chatEngineRef.current.list(),
      add: async (input: { content: string; from: string; score?: number; remark?: string }) =>
        chatEngineRef.current.add(input),
      remark: async (input: { id: number; score?: number; remark?: string }) => chatEngineRef.current.remark(input),
      query: async (input: { offset?: number; limit?: number; query?: string; includeInactive?: boolean }) =>
        chatEngineRef.current.query(input),
      reply: async (input: {
        replyContent: string;
        from?: string;
        score?: number;
        relationships?: Array<{ id: number; score?: number; remark?: string }>;
      }) => chatEngineRef.current.reply(input),
    }),
    [],
  );

  useEffect(() => {
    const stopLog = logger.subscribe((line) => {
      setLogs((prev) => [...prev.slice(-799), line]);
    });
    bootInjectedRef.current.clear();
    bootInProgressRef.current = false;

    void promptStore
      .reload()
      .then((bundle) => {
        logger.log({
          channel: "agent",
          level: "info",
          message: "prompt bundle loaded",
          meta: {
            loadedAt: bundle.loadedAt,
            cwd: runtimeConfig.agentCwd,
            terminal: runtimeConfig.terminal.commandLabel,
          },
        });
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        logger.log({
          channel: "error",
          level: "error",
          message: `prompt preload failed: ${message}`,
        });
      });

    const stopSnapshotListeners: Array<() => void> = [];
    const stopStatusListeners: Array<() => void> = [];
    for (const [terminalId, adapter] of terminalAdapters) {
      stopSnapshotListeners.push(
        adapter.onSnapshot((snapshot) => {
          terminalSnapshotsRef.current[terminalId] = snapshot;
          if (terminalId === focusedTerminalIdRef.current) {
            snapshotRef.current = snapshot;
            setSnapshotView(snapshot);
          }
          pushDirtySignal(terminalId, snapshot.seq);
        }),
      );
      stopStatusListeners.push(
        adapter.onStatus((running, status) => {
          if (terminalId === focusedTerminalIdRef.current) {
            setProcessState(running ? "running" : "stopped");
          }
          logger.log({
            channel: "ui",
            level: "debug",
            message: "terminal.status",
            meta: { running, status, terminalId },
          });
        }),
      );
    }

    const agent = new AgenterAI({
      modelClient,
      logger,
      promptStore,
      terminalGateway,
      taskGateway,
      chatGateway,
      sessionStore,
    });
    const stopTask = agent.onTaskEvent((event) => {
      setStage(event.stage);
      if (event.stage === "done" || event.stage === "error") {
        const focusedAdapter = getAdapter(focusedTerminalIdRef.current);
        setProcessState(focusedAdapter?.isRunning() ? "running" : "stopped");
      }
    });
    const stopStats = agent.onStats((stats) => {
      setAgentStats(stats);
    });

    const loopBus = new AgentRuntime({
      processor: agent,
      logger,
      idleCollectIntervalMs: LOOP_IDLE_COLLECT_INTERVAL_MS,
      onLoopStateChange: (state) => {
        setLoopPhase(state.phase);
      },
      collectInputs: async () => {
        const pendingIds = Array.from(terminalDirtyQueuedRef.current.values());
        if (pendingIds.length > 0) {
          terminalDirtyQueuedRef.current.clear();
        } else {
          const focusedTerminalId = focusedTerminalIdRef.current;
          const adapter = getAdapter(focusedTerminalId);
          if (!adapter || !adapter.isRunning() || processStateRef.current !== "running") {
            return;
          }
          const now = Date.now();
          if (now - lastIdleHeartbeatAtRef.current < IDLE_HEARTBEAT_INTERVAL_MS) {
            return;
          }
          lastIdleHeartbeatAtRef.current = now;
          const snapshot = terminalSnapshotsRef.current[focusedTerminalId] ?? adapter.getSnapshot();
          const status = adapter.getStatus();
          logger.log({
            channel: "agent",
            level: "debug",
            message: "terminal.heartbeat",
            meta: { terminalId: focusedTerminalId, reason: "idle-poll", seq: snapshot.seq, status },
          });
          return {
            name: `Terminal-${focusedTerminalId}`,
            role: "user",
            type: "text",
            source: "terminal",
            text: JSON.stringify(buildTerminalHeartbeatPayload(focusedTerminalId, snapshot, status, "idle-poll")),
            meta: {
              terminalId: focusedTerminalId,
              heartbeat: true,
              reason: "idle-poll",
              seq: snapshot.seq,
              status,
            },
          };
        }

        const outputs: LoopBusInput[] = [];
        for (const terminalId of pendingIds) {
          const terminal = runtimeConfig.terminals[terminalId];
          const adapter = getAdapter(terminalId);
          if (!terminal || !adapter) {
            continue;
          }

          const isFocused = focusedTerminalIdRef.current === terminalId;
          const latestSeq = terminalLatestSeqRef.current[terminalId] ?? 0;
          const status = adapter.getStatus();

          if (!isFocused) {
            terminalDirtyStateRef.current[terminalId] = false;
            outputs.push({
              name: `Terminal-${terminalId}`,
              role: "user",
              type: "text",
              source: "terminal",
              text: JSON.stringify({
                kind: "terminal-dirty-summary",
                terminalId,
                focused: false,
                dirty: true,
                seq: latestSeq,
                status,
              }),
              meta: {
                terminalId,
                focused: false,
                seq: latestSeq,
                status,
                signal: runtimeConfig.features.terminal.unfocusedSignal,
              },
            });
            continue;
          }

          if (!terminal.gitLog) {
            const snapshot = terminalSnapshotsRef.current[terminalId] ?? adapter.getSnapshot();
            terminalDirtyStateRef.current[terminalId] = false;
            outputs.push({
              name: `Terminal-${terminalId}`,
              role: "user",
              type: "text",
              source: "terminal",
              text: JSON.stringify({
                kind: "terminal-snapshot",
                terminalId,
                seq: snapshot.seq,
                cursor: snapshot.cursor,
                tail: snapshot.lines.slice(-10),
              }),
              meta: { terminalId, seq: snapshot.seq },
            });
            continue;
          }

          const slice = await adapter.sliceDirty({ remark: true });
          if (!slice.ok) {
            logger.log({
              channel: "error",
              level: "error",
              message: "terminal.sliceDirty failed",
              meta: { terminalId, reason: slice.reason ?? "unknown" },
            });
            continue;
          }

          if (!slice.changed || slice.fromHash === slice.toHash) {
            terminalDirtyStateRef.current[terminalId] = false;
            continue;
          }

          terminalDirtyStateRef.current[terminalId] = false;
          outputs.push({
            name: `Terminal-${terminalId}`,
            role: "user",
            type: "text",
            source: "terminal",
            text: serializeTerminalDiff(terminalId, {
              fromHash: slice.fromHash,
              toHash: slice.toHash,
              diff: slice.diff,
              bytes: slice.bytes,
              status,
            }),
            meta: {
              terminalId,
              focused: true,
              bytes: slice.bytes,
              fromHash: slice.fromHash ?? "none",
              toHash: slice.toHash ?? "none",
            },
          });

          if (slice.bytes >= LARGE_DIFF_BYTES) {
            const snapshot = terminalSnapshotsRef.current[terminalId] ?? adapter.getSnapshot();
            outputs.push({
              name: `Terminal-${terminalId}`,
              role: "user",
              type: "text",
              source: "terminal",
              text: JSON.stringify(buildTerminalHeartbeatPayload(terminalId, snapshot, status, "large-diff")),
              meta: {
                terminalId,
                heartbeat: true,
                reason: "large-diff",
                seq: snapshot.seq,
                status,
              },
            });
          }
        }
        if (outputs.length === 0) {
          return;
        }
        return outputs.length === 1 ? outputs[0] : outputs;
      },
      onUserMessage: (message) => {
        setMessages((prev) => [...prev, message]);
      },
      onTerminalDispatch: async (command) => {
        const terminal = runtimeConfig.terminals[command.terminalId];
        const adapter = getAdapter(command.terminalId);
        if (!terminal || !adapter) {
          logger.log({
            channel: "error",
            level: "error",
            message: `unknown terminal dispatch: ${command.terminalId}`,
          });
          return;
        }
        if (!adapter.isRunning()) {
          adapter.start();
          adapter.resize(terminalSizeRef.current.cols, terminalSizeRef.current.rows);
          if (terminal.gitLog) {
            await adapter.markDirty();
          }
        }
        await dispatchToTerminal(adapter, {
          taskId: command.taskId,
          text: command.text,
          submit: command.submit,
          submitKey: command.submitKey,
          submitGapMs: terminal.submitGapMs,
        });
      },
      onToolCall: async (calls) => {
        logger.log({
          channel: "agent",
          level: "warn",
          message: "tool.call not implemented",
          meta: { count: calls.length },
        });
        return calls.map((call) => ({
          name: `Tool-${call.name}`,
          role: "tool" as const,
          source: "tool" as const,
          type: "text" as const,
          text: JSON.stringify({ id: call.id, name: call.name, status: "unimplemented" }),
        }));
      },
    });

    loopBusRef.current = loopBus;
    loopBus.start();

    return () => {
      loopBus.stop();
      loopBusRef.current = null;
      stopStats();
      stopTask();
      for (const stop of stopStatusListeners) {
        stop();
      }
      for (const stop of stopSnapshotListeners) {
        stop();
      }
      stopLog();
      for (const adapter of terminalAdapters.values()) {
        void adapter.stop();
      }
    };
  }, [
    chatGateway,
    logger,
    modelClient,
    promptStore,
    runtimeConfig,
    sessionStore,
    taskGateway,
    terminalAdapters,
    terminalGateway,
  ]);

  useEffect(() => {
    const nextSize = measureTerminalContentSize(termWidth, termHeight);
    setTerminalSize((prev) => (prev.cols === nextSize.cols && prev.rows === nextSize.rows ? prev : nextSize));
    if (termWidth > 0 && termHeight > 0) {
      setLayoutReady(true);
    }
  }, [termHeight, termWidth]);

  useEffect(() => {
    if (!layoutReady) {
      return;
    }
    terminalSizeRef.current = terminalSize;
    for (const adapter of terminalAdapters.values()) {
      adapter.resize(terminalSize.cols, terminalSize.rows);
    }
    setTerminalSizeReady(true);
  }, [layoutReady, terminalAdapters, terminalSize.cols, terminalSize.rows]);

  useEffect(() => {
    if (!layoutReady || !terminalSizeReady || bootInProgressRef.current) {
      return;
    }
    const loopBus = loopBusRef.current;
    if (!loopBus) {
      return;
    }
    const pending = runtimeConfig.bootTerminals
      .filter((entry) => entry.autoRun)
      .map((entry) => entry.terminalId)
      .filter((terminalId) => !bootInjectedRef.current.has(terminalId));
    if (pending.length === 0) {
      return;
    }
    bootInProgressRef.current = true;
    void (async () => {
      try {
        for (const terminalId of pending) {
          const boot = (await terminalGateway.run({ terminalId })) as
            | {
                ok: true;
                terminalId: string;
                help?: {
                  command: string;
                  source: string;
                  doc: { syntax: "mdx"; content: string };
                  manuals?: Record<string, string>;
                  truncated?: boolean;
                  error?: string;
                } | null;
                snapshot?: ReturnType<typeof buildTerminalSnapshotPayload>;
              }
            | { ok: false; message: string };
          if (!boot.ok) {
            loopBus.pushMessage({
              name: `Terminal-${terminalId}`,
              role: "user",
              type: "text",
              source: "terminal",
              text: JSON.stringify({
                kind: "terminal-run",
                terminalId,
                ok: false,
                message: boot.message,
              }),
              meta: { terminalId, boot: true },
            });
            continue;
          }
          if (bootInjectedRef.current.has(terminalId)) {
            continue;
          }
          if (boot.help) {
            loopBus.pushMessage({
              name: `Terminal-${terminalId}`,
              role: "user",
              type: "text",
              source: "terminal",
              text: JSON.stringify(buildTerminalHelpPayload(terminalId, boot.help)),
              meta: { terminalId, boot: true, kind: "help" },
            });
          }
          if (boot.snapshot) {
            if (terminalId === focusedTerminalIdRef.current) {
              const initialSnapshot = terminalSnapshotsRef.current[terminalId] ?? getAdapter(terminalId)?.getSnapshot();
              if (initialSnapshot) {
                snapshotRef.current = initialSnapshot;
                setSnapshotView(initialSnapshot);
              }
            }
            loopBus.pushMessage({
              name: `Terminal-${terminalId}`,
              role: "user",
              type: "text",
              source: "terminal",
              timestamp: Date.now() + 1,
              text: JSON.stringify(boot.snapshot),
              meta: { terminalId, boot: true, kind: "snapshot" },
            });
          }
          bootInjectedRef.current.add(terminalId);
        }
      } finally {
        bootInProgressRef.current = false;
      }
    })();
  }, [layoutReady, runtimeConfig.bootTerminals, terminalGateway, terminalSizeReady]);

  const submit = () => {
    const raw = chatInputRef.current?.plainText ?? input;
    const value = raw.trim();
    if (!value) {
      return;
    }
    const userMessage: ChatMessage = {
      id: createId(),
      role: "user",
      content: value,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    chatInputRef.current?.clear();
    if (value !== "/compact") {
      chatEngineRef.current.add({
        content: value,
        from: "user",
        score: 100,
      });
    }

    if (value === "/reload") {
      void promptStore
        .reload()
        .then((bundle) => {
          logger.log({
            channel: "agent",
            level: "info",
            message: "prompt bundle reloaded",
            meta: { loadedAt: bundle.loadedAt },
          });
          setMessages((prev) => [
            ...prev,
            {
              id: createId(),
              role: "assistant",
              content: `提示词已重载，loadedAt=${bundle.loadedAt}`,
              timestamp: Date.now(),
            },
          ]);
        })
        .catch((error) => {
          const message = error instanceof Error ? error.message : String(error);
          logger.log({
            channel: "error",
            level: "error",
            message: `prompt reload failed: ${message}`,
          });
        });
      return;
    }

    loopBusRef.current?.pushMessage({
      name: "User",
      role: "user",
      type: "text",
      source: "chat",
      text: value,
    });
  };

  const syncChatInput = () => {
    setInput(chatInputRef.current?.plainText ?? "");
  };

  const clearTerminal = () => {
    const empty = {
      ...createEmptySnapshot(),
      cols: terminalSize.cols,
      rows: terminalSize.rows,
      lines: Array.from({ length: terminalSize.rows }, () => ""),
      richLines: Array.from({ length: terminalSize.rows }, () => ({ plain: "", spans: [] })),
    };
    snapshotRef.current = empty;
    setSnapshotView(empty);
    logger.log({ channel: "ui", level: "info", message: "clear terminal view" });
  };

  const exitApp = () => {
    for (const adapter of terminalAdapters.values()) {
      void adapter.stop();
    }
    renderer.destroy();
  };

  const copySelection = () => {
    const orderedPanels: FocusPanel[] =
      focus === "chat"
        ? ["chat", "terminal", "debug"]
        : focus === "terminal"
          ? ["terminal", "chat", "debug"]
          : ["debug", "chat", "terminal"];
    const refs: Record<FocusPanel, TextRenderable | null> = {
      terminal: terminalContentRef.current,
      chat: null,
      debug: debugContentRef.current,
    };
    for (const panel of orderedPanels) {
      const selectedText = refs[panel]?.getSelectedText() ?? "";
      if (!selectedText) {
        if (panel === "chat") {
          const transcript = messages
            .slice(-80)
            .map((item) => `${item.role === "user" ? "U" : "A"}: ${item.content}`)
            .join("\n\n");
          if (!transcript) {
            continue;
          }
          const copiedFallback = renderer.copyToClipboardOSC52(transcript);
          logger.log({
            channel: "ui",
            level: copiedFallback ? "info" : "warn",
            message: copiedFallback ? "copied chat transcript" : "copy failed for chat transcript",
          });
          return;
        }
        continue;
      }
      const copied = renderer.copyToClipboardOSC52(selectedText);
      logger.log({
        channel: "ui",
        level: copied ? "info" : "warn",
        message: copied ? `copied ${panel} selection` : `copy failed for ${panel} selection`,
      });
      return;
    }
  };

  useKeyboard((key) => {
    return handleGlobalKey(key, focus, {
      submit,
      clearTerminal,
      exitApp,
      toggleRenderSource: () => {
        logger.log({ channel: "ui", level: "debug", message: "render source fixed to snapshot" });
      },
      focusNext: () => setFocus((prev) => nextPanel(prev)),
      scrollDebug: (delta) => setScrollOffset((prev) => Math.max(0, prev + delta)),
      copySelection,
    });
  });

  const dirtyTerminalCount = Object.entries(terminalDirtyStateRef.current).filter(
    ([terminalId, dirty]) => dirty && terminalId !== focusedTerminalIdRef.current,
  ).length;

  const status: AppStatus = {
    stage,
    process: processState,
    renderSource: "snapshot",
    cwd: runtimeConfig.agentCwd,
    terminal:
      runtimeConfig.terminals[focusedTerminalIdRef.current]?.commandLabel ?? runtimeConfig.terminal.commandLabel,
    focusedTerminalId: focusedTerminalIdRef.current,
    dirtyTerminalCount,
    terminalSeq: snapshotView.seq,
    terminalCursor: snapshotView.cursor,
    terminalSize,
    loopCount: agentStats.loops,
    aiCallCount: agentStats.apiCalls,
    contextChars: agentStats.lastContextChars,
    totalContextChars: agentStats.totalContextChars,
    promptTokens: agentStats.lastPromptTokens,
    totalPromptTokens: agentStats.totalPromptTokens,
  };

  return (
    <box flexDirection="column" width="100%" height="100%" padding={1}>
      <StatusBar status={status} logsFile={logger.getFilePath()} sessionFile={sessionStore.getFilePath()} />
      <box flexDirection="row" flexGrow={1}>
        <TerminalPanel
          snapshot={snapshotView}
          focused={focus === "terminal"}
          contentRef={terminalContentRef}
          title={focusedTerminalId}
        />
        <ChatPanel
          messages={messages}
          aiStatus={chatAiStatus}
          inputRef={chatInputRef}
          onInputChange={syncChatInput}
          onSubmit={submit}
          focused={focus === "chat"}
        />
      </box>
      <DebugLogPanel logs={logs} focused={focus === "debug"} scrollOffset={scrollOffset} contentRef={debugContentRef} />
    </box>
  );
};
