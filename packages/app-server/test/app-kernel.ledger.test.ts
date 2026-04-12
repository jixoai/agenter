import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { AppKernel, SessionDb } from "../src";
import { toHeartbeatMessageUpsertInput } from "../src/session-ledger-view";
import type { ChatMessage } from "../src/types";

const tempDirs: string[] = [];

const createKernel = (): AppKernel => {
  const dir = mkdtempSync(join(tmpdir(), "agenter-kernel-ledger-"));
  tempDirs.push(dir);
  return new AppKernel({
    homeDir: join(dir, "home"),
    globalSessionRoot: join(dir, "sessions"),
    archiveSessionRoot: join(dir, "archive", "sessions"),
    workspacesPath: join(dir, "workspaces.yaml"),
  });
};

const upsertHeartbeat = (db: SessionDb, input: { message: ChatMessage; roundIndex?: number; aiCallId?: number | null }) => {
  db.upsertMessage(
    toHeartbeatMessageUpsertInput({
      message: input.message,
      roundIndex: input.roundIndex ?? 0,
      aiCallId: input.aiCallId ?? null,
    }),
  );
};

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("Feature: app kernel ledger projections", () => {
  test("Scenario: Given a stopped session with prompt-window ledger and ai_call rows When inspecting model debug Then the kernel restores prompt and call history from the ledger", async () => {
    const kernel = createKernel();
    await kernel.start();

    const session = await kernel.createSession({ cwd: process.cwd(), name: "ledger-debug", autoStart: false });
    const db = new SessionDb(join(session.sessionRoot, "session.db"));
    try {
      db.savePromptWindow({
        createdAt: 90,
        messages: [{ role: "user", content: "hello" }],
        setCurrent: true,
      });
      db.appendAiCall({
        roundIndex: 0,
        createdAt: 100,
        updatedAt: 120,
        completedAt: 120,
        status: "done",
        provider: "openai-compatible",
        model: "test-model",
        kind: "attention",
        requestUrl: "https://example.test/v1/chat/completions",
        requestBody: { messages: [{ role: "user", content: "hello" }] },
        responseBody: {
          response: { assistant: { text: "hi" } },
          outcome: { code: "done" },
        },
        outcome: { code: "done" },
        isComplete: true,
      });
    } finally {
      db.close();
    }

    const debug = await kernel.inspectModelDebug(session.id);

    expect(debug.promptWindow).toEqual([{ role: "user", content: "hello" }]);
    expect(debug.latestModelCall?.status).toBe("done");
    expect(debug.latestModelCall?.response).toEqual({ assistant: { text: "hi" } });
    expect(debug.recentModelCalls).toHaveLength(1);
    expect(debug.recentApiCalls).toHaveLength(1);

    await kernel.stop();
  });

  test("Scenario: Given heartbeat chat history with an internal failure bubble When listing workspace sessions Then preview keeps only user-facing conversation", async () => {
    const root = mkdtempSync(join(tmpdir(), "agenter-kernel-preview-"));
    tempDirs.push(root);
    const workspace = join(root, "workspace");
    mkdirSync(workspace, { recursive: true });

    const kernel = new AppKernel({
      globalSessionRoot: join(root, "sessions"),
      archiveSessionRoot: join(root, "archive", "sessions"),
      workspacesPath: join(root, "workspaces.yaml"),
    });
    await kernel.start();

    const session = await kernel.createSession({ cwd: workspace, name: "preview-filter", autoStart: false });
    const db = new SessionDb(join(session.sessionRoot, "session.db"));
    try {
      upsertHeartbeat(db, {
        message: {
          id: "user-1",
          role: "user",
          content: "现在几点？",
          timestamp: 100,
          chatId: session.primaryRoomId,
        },
      });
      upsertHeartbeat(db, {
        message: {
          id: "assistant-fail",
          role: "assistant",
          channel: "to_user",
          content:
            'agenter-ai call failed: openai-chat response failed after 1 attempt(s): 402 status code ({"error":{"message":"Insufficient Balance"}})',
          timestamp: 120,
          chatId: session.primaryRoomId,
        },
      });
      upsertHeartbeat(db, {
        message: {
          id: "assistant-2",
          role: "assistant",
          channel: "to_user",
          content: "北京时间下午四点。",
          timestamp: 140,
          chatId: session.primaryRoomId,
        },
      });
    } finally {
      db.close();
    }

    const page = kernel.listWorkspaceSessions({ path: workspace, tab: "all", limit: 20 });

    expect(page.items[0]?.preview).toEqual({
      firstUserMessage: "现在几点？",
      latestMessages: ["现在几点？", "北京时间下午四点。"],
    });

    await kernel.stop();
  });

  test("Scenario: Given heartbeat messages and ai_call rows When listing chat history Then the kernel projects chat messages and cycles from the ledger", async () => {
    const kernel = createKernel();
    await kernel.start();

    const session = await kernel.createSession({ cwd: process.cwd(), name: "ledger-chat", autoStart: false });
    const db = new SessionDb(join(session.sessionRoot, "session.db"));
    try {
      upsertHeartbeat(db, {
        message: {
          id: "assistant-relay",
          role: "assistant",
          channel: "to_user",
          chatId: "chat-relay",
          content: "好的，那就吃蛋炒饭吧！",
          timestamp: 160,
        },
        aiCallId: 1,
      });
      upsertHeartbeat(db, {
        message: {
          id: "assistant-main",
          role: "assistant",
          channel: "to_user",
          chatId: session.primaryRoomId,
          content: "我问了 kzf，他说今天晚上吃蛋炒饭。",
          timestamp: 180,
        },
        aiCallId: 1,
      });

      db.appendAiCall({
        roundIndex: 0,
        kind: "attention",
        status: "done",
        provider: "openai-compatible",
        model: "test-model",
        requestUrl: "https://example.test/v1/chat/completions",
        requestBody: {
          meta: {
            cycleId: 11,
            wakeSource: "message",
            collectedInputs: [
              {
                source: "message",
                role: "user",
                name: "Gaubee",
                parts: [{ type: "text", text: "ask kzf dinner" }],
                meta: { chatId: session.primaryRoomId ?? "room-main" },
              },
              {
                source: "message",
                role: "user",
                name: "kzf",
                parts: [{ type: "text", text: "eat fried rice" }],
                meta: { chatId: "chat-relay" },
              },
            ],
          },
        },
        responseBody: { response: { assistant: { text: "done" } } },
        responseMessageIds: ["assistant-relay", "assistant-main"],
        isComplete: true,
        completedAt: 200,
        createdAt: 150,
        updatedAt: 200,
      });

      db.appendAiCall({
        roundIndex: 1,
        kind: "compact",
        status: "done",
        provider: "openai-compatible",
        model: "test-model",
        requestUrl: "https://example.test/v1/chat/completions",
        requestBody: {
          meta: {
            cycleId: 12,
            compactTrigger: "manual",
            collectedInputs: [
              {
                source: "message",
                role: "user",
                name: "User",
                parts: [{ type: "text", text: "/compact" }],
                meta: { clientMessageId: "client-compact-1" },
              },
            ],
          },
        },
        responseBody: { response: { assistant: { text: "compacted" } } },
        isComplete: true,
        completedAt: 260,
        createdAt: 220,
        updatedAt: 260,
      });
    } finally {
      db.close();
    }

    const messages = kernel.listChatMessages(session.id, 0, 20);
    expect(messages.map((item) => ({ content: item.content, chatId: item.chatId }))).toEqual([
      { content: "好的，那就吃蛋炒饭吧！", chatId: "chat-relay" },
      { content: "我问了 kzf，他说今天晚上吃蛋炒饭。", chatId: session.primaryRoomId },
    ]);

    const cycles = kernel.listChatCycles(session.id, 20);
    expect(cycles.find((cycle) => cycle.cycleId === 11)?.outputs.map((item) => ({ content: item.content, chatId: item.chatId }))).toEqual([
      { content: "好的，那就吃蛋炒饭吧！", chatId: "chat-relay" },
      { content: "我问了 kzf，他说今天晚上吃蛋炒饭。", chatId: session.primaryRoomId },
    ]);
    expect(cycles.find((cycle) => cycle.cycleId === 12)?.compactTrigger).toBe("manual");

    await kernel.stop();
  });
});
