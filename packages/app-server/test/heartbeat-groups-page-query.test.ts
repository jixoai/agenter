import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { AppKernel, SessionDb, appRouter, createTrpcContext } from "../src";

const tempDirs: string[] = [];

const makeTempDir = (): string => {
  const dir = mkdtempSync(join(tmpdir(), "agenter-heartbeat-groups-query-"));
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

const appendHeartbeatCall = (db: SessionDb, index: number): number => {
  const createdAt = 10_000 + index * 10;
  const configMessageId = `config-${index}`;
  const responseMessageId = `response-${index}`;
  db.upsertMessage({
    messageId: configMessageId,
    roundIndex: index,
    scope: "request_aux",
    role: "config",
    createdAt: createdAt - 2,
    updatedAt: createdAt - 2,
    parts: [{ partType: "config", payload: { temperature: index }, isComplete: true }],
  });
  const aiCallId = db.appendAiCall({
    roundIndex: index,
    kind: "model",
    status: "done",
    provider: "openai/chat",
    model: "gpt-test",
    requestUrl: "https://example.test/v1/chat/completions",
    requestBody: { messages: [] },
    responseBody: { text: `reply-${index}` },
    requestMessageIds: [],
    responseMessageIds: [responseMessageId],
    auxiliaryMessageIds: [configMessageId],
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
  return aiCallId;
};

describe("Feature: Heartbeat grouped page query stays bounded", () => {
  test(
    "Scenario: Given deep Heartbeat history When the first grouped page is queried Then the backend does not page through the entire ai_call and inspection ledger",
    async () => {
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
        name: "heartbeat-deep-history",
        autoStart: false,
      });

      const db = new SessionDb(join(created.session.sessionRoot, "session.db"));
      try {
        for (let index = 0; index < 2_101; index += 1) {
          appendHeartbeatCall(db, index);
        }
      } finally {
        db.close();
      }

      const originalPageAiCalls = SessionDb.prototype.pageAiCalls;
      const originalPageMessagesByScopes = SessionDb.prototype.pageMessagesByScopes;
      let aiCallPageReads = 0;
      let inspectionPageReads = 0;
      SessionDb.prototype.pageAiCalls = function pageAiCallsProxy(input) {
        aiCallPageReads += 1;
        return originalPageAiCalls.call(this, input);
      };
      SessionDb.prototype.pageMessagesByScopes = function pageMessagesByScopesProxy(scopes, input) {
        if (scopes.length === 2 && scopes.includes("heartbeat_part") && scopes.includes("request_aux")) {
          inspectionPageReads += 1;
        }
        return originalPageMessagesByScopes.call(this, scopes, input);
      };

      try {
        const page = await caller.runtime.heartbeatGroupsPage({
          sessionId: created.session.id,
          limit: 5,
        });

        expect(page.items).toHaveLength(5);
        expect(aiCallPageReads).toBeLessThanOrEqual(2);
        expect(inspectionPageReads).toBeLessThanOrEqual(3);
      } finally {
        SessionDb.prototype.pageAiCalls = originalPageAiCalls;
        SessionDb.prototype.pageMessagesByScopes = originalPageMessagesByScopes;
        await kernel.stop();
      }
    },
    { timeout: 15_000 },
  );

  test("Scenario: Given the newest page ends on a call group When loading older grouped history Then the same ai_call can still return its older before-call group", async () => {
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
      name: "heartbeat-cursor-window",
      autoStart: false,
    });

    const db = new SessionDb(join(created.session.sessionRoot, "session.db"));
    try {
      appendHeartbeatCall(db, 0);
      appendHeartbeatCall(db, 1);
    } finally {
      db.close();
    }

    try {
      const latestPage = await caller.runtime.heartbeatGroupsPage({
        sessionId: created.session.id,
        limit: 1,
      });
      expect(latestPage.items.map((group) => group.kind)).toEqual(["call"]);
      expect(latestPage.nextBefore).not.toBeNull();

      const olderPage = await caller.runtime.heartbeatGroupsPage({
        sessionId: created.session.id,
        before: latestPage.nextBefore ?? undefined,
        limit: 1,
      });
      expect(olderPage.items.map((group) => group.kind)).toEqual(["before-call"]);
      expect(olderPage.items[0]?.aiCallId).toBe(latestPage.items[0]?.aiCallId);
    } finally {
      await kernel.stop();
    }
  });
});
