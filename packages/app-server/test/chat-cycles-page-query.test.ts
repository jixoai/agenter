import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { AppKernel, SessionDb, appRouter, createTrpcContext } from "../src";

const tempDirs: string[] = [];

const makeTempDir = (): string => {
  const dir = mkdtempSync(join(tmpdir(), "agenter-chat-cycles-query-"));
  tempDirs.push(dir);
  return dir;
};

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

const createRootSuperadminCaller = async (kernel: AppKernel) => {
  const anonymousCaller = appRouter.createCaller(await createTrpcContext(kernel));
  const autoLogin = await anonymousCaller.auth.autoLogin();
  if (!autoLogin.ok) {
    throw new Error(`expected daemon auto login to succeed, got ${autoLogin.reason}: ${autoLogin.message}`);
  }
  return appRouter.createCaller(
    await createTrpcContext({
      kernel,
      authorizationHeader: `Bearer ${autoLogin.session.token}`,
    }),
  );
};

const appendCycleCall = (db: SessionDb, index: number): void => {
  const createdAt = 10_000 + index * 10;
  const responseMessageId = `cycle-response-${index}`;
  const aiCallId = db.appendAiCall({
    roundIndex: index,
    kind: "model",
    status: "done",
    provider: "openai/chat",
    model: "gpt-test",
    requestUrl: "https://example.test/v1/chat/completions",
    requestBody: {
      meta: {
        cycleId: index + 1,
        wakeSource: "message",
        collectedInputs: [],
      },
    },
    responseBody: { text: `reply-${index}` },
    requestMessageIds: [],
    responseMessageIds: [responseMessageId],
    auxiliaryMessageIds: [],
    createdAt,
    updatedAt: createdAt + 1,
    completedAt: createdAt + 1,
    isComplete: true,
  }).id;
  db.upsertMessage({
    messageId: responseMessageId,
    roundIndex: index,
    scope: "heartbeat_part",
    role: "assistant",
    aiCallId,
    createdAt: createdAt + 1,
    updatedAt: createdAt + 1,
    parts: [{ partType: "text", payload: { type: "text", content: `reply-${index}` }, isComplete: true }],
  });
};

describe("Feature: Chat cycle page query stays bounded", () => {
  test("Scenario: Given deep cycle history When the latest chat cycles page is queried Then the backend does not replay every heartbeat message to project recent cycles", async () => {
    const root = makeTempDir();
    const kernel = new AppKernel({
      globalSessionRoot: join(root, "sessions"),
      archiveSessionRoot: join(root, "archive", "sessions"),
      workspacesPath: join(root, "workspaces.yaml"),
      homeDir: join(root, "home"),
    });
    await kernel.start();
    const caller = await createRootSuperadminCaller(kernel);
    const created = await caller.session.create({
      cwd: root,
      name: "chat-cycles-deep-history",
      autoStart: false,
    });

    const db = new SessionDb(join(created.session.sessionRoot, "session.db"));
    try {
      for (let index = 0; index < 2_101; index += 1) {
        appendCycleCall(db, index);
      }
    } finally {
      db.close();
    }

    const originalPageMessagesByScope = SessionDb.prototype.pageMessagesByScope;
    let heartbeatPageReads = 0;
    SessionDb.prototype.pageMessagesByScope = function pageMessagesByScopeProxy(scope, input) {
      if (scope === "heartbeat_part") {
        heartbeatPageReads += 1;
      }
      return originalPageMessagesByScope.call(this, scope, input);
    };

    try {
      const page = await caller.runtime.cyclesPage({
        sessionId: created.session.id,
        limit: 5,
      });

      expect(page.items).toHaveLength(5);
      expect(page.items.map((cycle: { cycleId: number | null }) => cycle.cycleId)).toEqual([2_097, 2_098, 2_099, 2_100, 2_101]);
      expect(heartbeatPageReads).toBe(0);
    } finally {
      SessionDb.prototype.pageMessagesByScope = originalPageMessagesByScope;
      await kernel.stop();
    }
  });
});
