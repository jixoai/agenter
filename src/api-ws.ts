#!/usr/bin/env bun
/**
 * Agenter WebSocket API Server
 * Functional architecture with @tanstack/ai
 */
import { MemoryManager } from "./memory-manager.js";
import { Rememberer } from "./rememberer.js";
import { createFact } from "./utils.js";
import { CognitiveState } from "./types.js";
import {
  createChat,
  getAdapter,
  parseResponderOutput,
  buildResponderPrompt,
  loadRuntimeConfig,
  streamWithCallback,
  type LLMConfig,
} from "./llm/index.js";
import type { Message } from "./llm/chat.js";
import path from "path";

// ============================================================================
// Types
// ============================================================================

interface WsMessage {
  id: number;
  type: "recall" | "respond" | "reset" | "ping" | "chat" | "history_prev" | "history_next";
  tab_id?: number;
  message?: string;
  cognitive_state?: CognitiveState;
  agent?: "deepseek" | "mock";
  current_draft?: string;
}

interface WsResponse {
  id: number;
  type: string;
  tab_id?: number;
  [key: string]: unknown;
}

// ============================================================================
// State (managed outside pure functions)
// ============================================================================

type WS = import("bun").ServerWebSocket<undefined>;

// Session-based input history (per WebSocket connection)
interface HistorySession {
  entries: string[];
  currentIndex: number;
  tempEntry: string; // Store current draft when navigating
}

const state = {
  cognitiveStates: new Map<number, CognitiveState>(),
  clients: new Map<WS, boolean>(),
  historySessions: new Map<WS, HistorySession>(),
  config: null as { provider: "deepseek" | "mock"; llmConfig?: LLMConfig; storageDir?: string } | null,
  memory: null as MemoryManager | null,
  rememberer: null as Rememberer | null,
  chat: null as ReturnType<typeof createChat> | null,
};

// ============================================================================
// Pure Functions - Message Handling
// ============================================================================

const createResponse = (id: number, type: string, data: Record<string, unknown>): WsResponse => ({
  id,
  type,
  ...data,
});

const createError = (id: number, message: string, tabId?: number): WsResponse => ({
  id,
  type: "error",
  tab_id: tabId,
  message,
});

const formatMemoryText = (result: {
  trace: { tool_calls: string[] };
  cognitiveState: CognitiveState;
}): string => {
  return [
    `tool: ${result.trace.tool_calls.join(" | ")}`,
    `current_goal: ${result.cognitiveState.current_goal}`,
    `plan_status: ${JSON.stringify(result.cognitiveState.plan_status)}`,
    `key_facts: ${JSON.stringify(result.cognitiveState.key_facts)}`,
    `last_action_result: ${result.cognitiveState.last_action_result}`,
  ].join("\n");
};

// ============================================================================
// Handlers
// ============================================================================

const handleRecall = async (ws: WS, msg: WsMessage): Promise<void> => {
  if (!state.memory || !state.rememberer) {
    ws.send(JSON.stringify(createError(msg.id, "Server not initialized", msg.tab_id)));
    return;
  }

  const tabId = msg.tab_id ?? 1;
  const userMessage = msg.message ?? "";

  try {
    await state.memory.appendFact(createFact("USER_MSG", userMessage));
    const recall = await state.rememberer.recallWithTrace(userMessage);
    state.cognitiveStates.set(tabId, recall.cognitiveState);

    const response = createResponse(msg.id, "recall_result", {
      tab_id: tabId,
      memory_text: formatMemoryText(recall),
      cognitive_state: recall.cognitiveState,
    });

    ws.send(JSON.stringify(response));
  } catch (error) {
    ws.send(JSON.stringify(createError(msg.id, String(error), tabId)));
  }
};

const handleRespond = async (ws: WS, msg: WsMessage): Promise<void> => {
  if (!state.memory || !state.chat) {
    ws.send(JSON.stringify(createError(msg.id, "Server not initialized", msg.tab_id)));
    return;
  }

  const tabId = msg.tab_id ?? 1;
  const userMessage = msg.message ?? "";
  const cognitiveState = msg.cognitive_state ?? state.cognitiveStates.get(tabId);

  if (!cognitiveState) {
    ws.send(JSON.stringify(createError(msg.id, "Missing cognitive state", tabId)));
    return;
  }

  try {
    const messages: Message[] = [
      buildResponderPrompt(cognitiveState),
      { role: "user", content: userMessage },
    ];

    let summary = "(summary unavailable)";
    let tools: string[] = [];
    let answerStarted = false;
    let bufferText = "";
    let fullResponse = "";

    const stream = state.chat(messages);

    await streamWithCallback(stream, (chunk) => {
      fullResponse += chunk;

      if (!answerStarted) {
        bufferText += chunk;
        while (true) {
          const newlineIndex = bufferText.indexOf("\n");
          if (newlineIndex === -1) break;

          const line = bufferText.slice(0, newlineIndex).trim();
          bufferText = bufferText.slice(newlineIndex + 1);

          if (line.toUpperCase().startsWith("SUMMARY:")) {
            summary = line.slice("SUMMARY:".length).trim() || summary;
            continue;
          }
          if (line.toUpperCase().startsWith("TOOLS:")) {
            const toolsRaw = line.slice("TOOLS:".length).trim();
            tools = toolsRaw && toolsRaw !== "NONE" ? toolsRaw.split(/\s*,\s*/) : [];
            continue;
          }
          if (line.toUpperCase().startsWith("ANSWER:")) {
            answerStarted = true;
            ws.send(
              JSON.stringify(createResponse(msg.id, "respond_meta", { tab_id: tabId, summary, tools }))
            );
            const rest = line.slice("ANSWER:".length).trim();
            if (rest) {
              ws.send(
                JSON.stringify(createResponse(msg.id, "respond_delta", { tab_id: tabId, delta: rest + "\n" }))
              );
            }
            break;
          }
        }
        if (answerStarted && bufferText.length > 0) {
          ws.send(
            JSON.stringify(createResponse(msg.id, "respond_delta", { tab_id: tabId, delta: bufferText }))
          );
        }
        return;
      }

      ws.send(
        JSON.stringify(createResponse(msg.id, "respond_delta", { tab_id: tabId, delta: chunk }))
      );
    });

    const parsed = parseResponderOutput(fullResponse);
    await state.memory.appendFact(createFact("AI_THOUGHT", parsed.reply, { kind: "chat_reply" }));

    ws.send(
      JSON.stringify(
        createResponse(msg.id, "respond_done", {
          tab_id: tabId,
          reply: parsed.reply,
          summary: parsed.summary,
          tools: parsed.tools,
        })
      )
    );
  } catch (error) {
    ws.send(JSON.stringify(createError(msg.id, String(error), tabId)));
  }
};

const handleReset = async (ws: WS, msg: WsMessage): Promise<void> => {
  if (!state.memory) {
    ws.send(JSON.stringify(createError(msg.id, "Server not initialized")));
    return;
  }

  try {
    await state.memory.reset();
    state.cognitiveStates.clear();
    ws.send(JSON.stringify(createResponse(msg.id, "reset_done", {})));
  } catch (error) {
    ws.send(JSON.stringify(createError(msg.id, String(error))));
  }
};

import { recallStream, RecallFrame } from "./recall-orchestrator.js";

const handleChat = async (ws: WS, msg: WsMessage): Promise<void> => {
  if (!state.memory) {
    ws.send(JSON.stringify(createError(msg.id, "Server not initialized", msg.tab_id)));
    return;
  }

  const tabId = msg.tab_id ?? 1;
  const userMessage = msg.message ?? "";

  if (!userMessage.trim()) {
    ws.send(JSON.stringify(createError(msg.id, "Empty message", tabId)));
    return;
  }

  try {
    // 1. Store user message
    await state.memory.appendFact(createFact("USER_MSG", userMessage, { kind: "chat" }));

    // 2. STREAMING RECALL: 流式回忆过程
    for await (const frame of recallStream(userMessage)) {
      const response = convertFrameToResponse(msg.id, tabId, frame);
      ws.send(JSON.stringify(response));
    }

    // 3. RESPOND: Generate response based on cognitive state
    // (简化版，实际应该用 frame.complete.state)
    const messages: Message[] = [
      { role: "system" as const, content: "You are a helpful assistant." },
      { role: "user" as const, content: userMessage },
    ];

    const stream = state.chat!(messages);
    let fullResponse = "";

    await streamWithCallback(stream, (chunk) => {
      fullResponse += chunk;
      ws.send(
        JSON.stringify(createResponse(msg.id, "respond_delta", { tab_id: tabId, delta: chunk }))
      );
    });

    // Store AI response
    await state.memory.appendFact(createFact("AI_THOUGHT", fullResponse, { kind: "chat_reply" }));

    ws.send(
      JSON.stringify(
        createResponse(msg.id, "respond_done", {
          tab_id: tabId,
          reply: fullResponse,
          summary: "",
          tools: [],
        })
      )
    );
  } catch (error) {
    ws.send(JSON.stringify(createError(msg.id, String(error), tabId)));
  }
};

// 将回忆帧转换为 WebSocket 响应
function convertFrameToResponse(
  id: number,
  tabId: number,
  frame: RecallFrame
): WsResponse {
  switch (frame.type) {
    case "start":
      return createResponse(id, "recall_start", { tab_id: tabId, trigger: frame.trigger });
    case "activate":
      return createResponse(id, "recall_activate", {
        tab_id: tabId,
        round: frame.round,
        memories: frame.data.memories,
        pattern: frame.data.activation_pattern,
      });
    case "hold":
      return createResponse(id, "recall_hold", {
        tab_id: tabId,
        slots: frame.data.slots,
        operations: frame.data.operations,
      });
    case "feel":
      return createResponse(id, "recall_feel", {
        tab_id: tabId,
        valence: frame.data.valence,
        arousal: frame.data.arousal,
        priority: frame.data.priority,
      });
    case "state_update":
      return createResponse(id, "recall_state_update", {
        tab_id: tabId,
        field: frame.field,
        value: frame.value,
        reason: frame.reason,
      });
    case "complete":
      return createResponse(id, "recall_result", {
        tab_id: tabId,
        cognitive_state: frame.state,
        recall_trace: frame.trace,
      });
    default:
      return createResponse(id, "recall_progress", { tab_id: tabId, frame });
  }
}

const handlePing = (ws: WS, msg: WsMessage): void => {
  ws.send(JSON.stringify(createResponse(msg.id, "pong", {})));
};

// ============================================================================
// History Management
// ============================================================================

const getHistorySession = (ws: WS): HistorySession => {
  if (!state.historySessions.has(ws)) {
    state.historySessions.set(ws, { entries: [], currentIndex: -1, tempEntry: "" });
  }
  return state.historySessions.get(ws)!;
};

const addToHistory = (ws: WS, entry: string): void => {
  if (!entry.trim()) return;
  const session = getHistorySession(ws);
  // Avoid duplicates at the end
  if (session.entries.length > 0 && session.entries[session.entries.length - 1] === entry) {
    return;
  }
  session.entries.push(entry);
  // Limit history size
  if (session.entries.length > 100) {
    session.entries.shift();
  }
  session.currentIndex = -1;
  session.tempEntry = "";
};

const handleHistoryPrev = (ws: WS, msg: WsMessage): void => {
  const session = getHistorySession(ws);
  const currentDraft = msg.current_draft ?? "";
  
  // Save current draft if at bottom
  if (session.currentIndex === -1) {
    session.tempEntry = currentDraft;
  }
  
  if (session.entries.length === 0) {
    ws.send(JSON.stringify(createResponse(msg.id, "history_result", {
      tab_id: msg.tab_id,
      text: currentDraft,
      has_more: false,
    })));
    return;
  }
  
  // Move up in history
  const newIndex = session.currentIndex === -1 
    ? session.entries.length - 1 
    : Math.max(0, session.currentIndex - 1);
  
  session.currentIndex = newIndex;
  
  ws.send(JSON.stringify(createResponse(msg.id, "history_result", {
    tab_id: msg.tab_id,
    text: session.entries[newIndex],
    has_more: newIndex > 0,
  })));
};

const handleHistoryNext = (ws: WS, msg: WsMessage): void => {
  const session = getHistorySession(ws);
  
  if (session.currentIndex === -1 || session.entries.length === 0) {
    // Already at bottom, return temp entry or current draft
    ws.send(JSON.stringify(createResponse(msg.id, "history_result", {
      tab_id: msg.tab_id,
      text: session.tempEntry,
      has_more: session.entries.length > 0,
    })));
    return;
  }
  
  // Move down in history
  const newIndex = session.currentIndex + 1;
  
  if (newIndex >= session.entries.length) {
    // Back to bottom
    session.currentIndex = -1;
    ws.send(JSON.stringify(createResponse(msg.id, "history_result", {
      tab_id: msg.tab_id,
      text: session.tempEntry,
      has_more: true,
    })));
  } else {
    session.currentIndex = newIndex;
    ws.send(JSON.stringify(createResponse(msg.id, "history_result", {
      tab_id: msg.tab_id,
      text: session.entries[newIndex],
      has_more: newIndex < session.entries.length - 1,
    })));
  }
};

const routeMessage = (ws: WS, msg: WsMessage): void => {
  switch (msg.type) {
    case "ping":
      handlePing(ws, msg);
      break;
    case "recall":
      handleRecall(ws, msg);
      break;
    case "respond":
      handleRespond(ws, msg);
      break;
    case "reset":
      handleReset(ws, msg);
      break;
    case "chat":
      handleChat(ws, msg);
      // Add successful message to history
      if (msg.message) {
        addToHistory(ws, msg.message);
      }
      break;
    case "history_prev":
      handleHistoryPrev(ws, msg);
      break;
    case "history_next":
      handleHistoryNext(ws, msg);
      break;
    default:
      ws.send(
        JSON.stringify(createError(msg.id, `Unknown type: ${(msg as { type: string }).type}`))
      );
  }
};

// ============================================================================
// Main
// ============================================================================

async function main() {
  // Initialize configuration
  const runtimeConfig = await loadRuntimeConfig(path.resolve(".env"));
  state.config = runtimeConfig;

  // Initialize services
  state.memory = new MemoryManager(runtimeConfig.storageDir);
  state.rememberer = new Rememberer(state.memory, runtimeConfig.provider, runtimeConfig.llmConfig);
  
  const adapter = getAdapter(runtimeConfig.provider, runtimeConfig.llmConfig);
  state.chat = createChat(adapter);

  const port = process.env.AGENTER_WS_PORT ? parseInt(process.env.AGENTER_WS_PORT) : 3457;

  const server = Bun.serve({
    port,
    hostname: "127.0.0.1",

    fetch(request: Request, server) {
      const url = new URL(request.url);

      if (url.pathname === "/health") {
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              status: "ok",
              provider: state.config?.provider,
              websocket: true,
            },
          }),
          { headers: { "Content-Type": "application/json" } }
        );
      }

      if (url.pathname === "/ws") {
        const success = server.upgrade(request);
        if (success) {
          return undefined as unknown as Response;
        }
        return new Response("WebSocket upgrade failed", { status: 400 });
      }

      return new Response("Not found", { status: 404 });
    },

    websocket: {
      open(ws: WS) {
        state.clients.set(ws, true);
        console.log(`Client connected. Total: ${state.clients.size}`);

        ws.send(
          JSON.stringify({
            type: "connected",
            message: "Welcome to Agenter WebSocket API",
            version: "0.1.0",
          })
        );
      },

      message(ws: WS, message: string | Buffer) {
        try {
          const text = typeof message === "string" ? message : message.toString("utf-8");
          const data = JSON.parse(text) as WsMessage;
          routeMessage(ws, data);
        } catch (error) {
          ws.send(
            JSON.stringify({
              type: "error",
              message: String(error),
            })
          );
        }
      },

      close(ws: WS) {
        state.clients.delete(ws);
        state.historySessions.delete(ws);
        console.log(`Client disconnected. Total: ${state.clients.size}`);
      },
    },
  });

  console.log(`🚀 Agenter WebSocket Server running at ws://${server.hostname}:${server.port}/ws`);
  console.log(`   Provider: ${state.config.provider}`);
}

main().catch(console.error);
