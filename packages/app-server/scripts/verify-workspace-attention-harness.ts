import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { AttentionStore, AttentionSystem } from "@agenter/attention-system";
import { formatMessageAttentionSrc } from "../src/attention-src";
import { AppKernel, appRouter, createTrpcContext, type AnyRuntimeEvent } from "../src";

const sleep = async (ms: number): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, ms));
};

function assertCondition(value: unknown, message: string): asserts value {
  if (!value) {
    throw new Error(message);
  }
}

const keepTemp = process.argv.includes("--keep-temp");

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

const main = async (): Promise<void> => {
  const root = mkdtempSync(join(tmpdir(), "agenter-workspace-attention-harness-"));
  const workspaceA = join(root, "workspace-a");
  const workspaceB = join(root, "workspace-b");
  mkdirSync(workspaceA, { recursive: true });
  mkdirSync(workspaceB, { recursive: true });

  const kernel = new AppKernel({
    globalSessionRoot: join(root, "sessions"),
    archiveSessionRoot: join(root, "archive", "sessions"),
    workspacesPath: join(root, "workspaces.yaml"),
  });
  const observedEvents: AnyRuntimeEvent[] = [];

  try {
    await kernel.start();
    const unsubscribe = kernel.onEvent((event) => {
      observedEvents.push(event);
    });
    const caller = await createRootSuperadminCaller(kernel);

    const first = await caller.session.create({
      cwd: workspaceA,
      avatar: "architect",
      name: "Architect",
      autoStart: false,
    });
    const second = await caller.session.create({
      cwd: workspaceB,
      avatar: "architect",
      name: "Architect",
      autoStart: false,
    });
    assertCondition(first.session.id === second.session.id, "expected one canonical avatar runtime across workspaces");

    const runtimeId = first.session.id;
    await caller.workspace.grantRuntime({
      runtimeId,
      workspacePath: workspaceA,
      grants: [{ pattern: "/sandbox", mode: "rw" }],
    });
    await caller.workspace.grantRuntime({
      runtimeId,
      workspacePath: workspaceB,
      grants: [{ pattern: "/", mode: "rw" }],
    });
    await kernel.startSession(runtimeId);
    const room = await kernel.createMessageChannel({
      sessionId: runtimeId,
      kind: "room",
      title: "workspace-attention-room",
      participants: [
        { id: `session:${first.session.avatar}`, label: first.session.avatar },
        { id: "auth:kzf", label: "kzf" },
      ],
      focus: true,
    });
    assertCondition(
      kernel.listTerminals(runtimeId).length === 0,
      "expected no implicit terminals after explicit runtime boot",
    );

    const mounts = await caller.workspace.runtimeMounts({ runtimeId });
    const workspaceMounts = mounts.items.filter((item) => item.kind === "workspace");
    assertCondition(workspaceMounts.length === 2, "expected runtime to keep both workspace mounts");

    const assetRoots = await caller.workspace.assetRoots({
      workspacePath: workspaceA,
      avatar: "architect",
    });
    writeFileSync(join(assetRoots.publicRoots.tools, "hello.sh"), "#!/usr/bin/env bash\necho tool-ok\n", "utf8");

    const grants = await caller.workspace.runtimeGrants({
      runtimeId,
      workspacePath: workspaceA,
    });
    assertCondition(
      grants.items.length === 1 && grants.items[0]?.pattern === "/sandbox",
      "expected narrowed sandbox grant",
    );

    const execSuccess = await caller.workspace.exec({
      runtimeId,
      workspacePath: workspaceA,
      avatar: "architect",
      command:
        "mkdir -p /workspace/sandbox && printf harness-ok > /workspace/sandbox/out.txt && tool_hello && cat /workspace/sandbox/out.txt",
    });
    assertCondition(execSuccess.exitCode === 0, "expected granted workspace exec to succeed");

    const execDenied = await caller.workspace.exec({
      runtimeId,
      workspacePath: workspaceA,
      avatar: "architect",
      command: "printf blocked > /workspace/blocked.txt",
    });
    assertCondition(execDenied.exitCode !== 0, "expected write outside grant to fail");

    const stopped = await caller.session.stop({
      sessionId: first.session.id,
    });
    assertCondition(
      stopped.session.status === "stopped",
      "expected runtime to stop before persisted attention verification",
    );

    const sessionMeta = kernel.getSession(first.session.id);
    assertCondition(sessionMeta, "expected persisted session metadata");
    await caller.notification.setChatVisibility({
      sessionId: first.session.id,
      chatId: room.chatId,
      visible: true,
      focused: false,
    });

    const attentionStore = new AttentionStore(join(sessionMeta.sessionRoot, "attention-system"));
    const attentionSystem = AttentionSystem.fromSnapshot(await attentionStore.load());
    const contextId = `ctx-${room.chatId}`;
    if (!attentionSystem.getContext(contextId)) {
      attentionSystem.createContext({
        contextId,
        owner: sessionMeta.avatar,
        focusState: "background",
      });
    } else {
      attentionSystem.setContextFocusState(contextId, "background");
    }
    attentionSystem.commit(contextId, {
      ingressType: "push",
      meta: {
        author: "assistant",
        source: "message",
        src: formatMessageAttentionSrc({ chatId: room.chatId, messageId: 1 }),
      },
      scores: { persisted_ping: 100 },
      summary: "Persisted background ping",
      change: {
        type: "update",
        value: "Persisted background ping",
      },
    });
    await attentionStore.save(attentionSystem.snapshot());
    await sleep(50);

    const unreadSnapshot = await caller.notification.snapshot();
    const unreadBeforeConsume = unreadSnapshot.unreadBySession[first.session.id] ?? 0;
    const roomBucketKey = `msg:${room.chatId}`;
    assertCondition(unreadBeforeConsume > 0, "expected persisted background push to project unread notifications");
    assertCondition(
      (unreadSnapshot.unreadByBucket[first.session.id]?.[roomBucketKey] ?? 0) > 0,
      "expected unread to stay scoped to the persisted chat context",
    );

    const consumedSnapshot = await caller.notification.consume({
      sessionId: first.session.id,
      upToSrc: formatMessageAttentionSrc({ chatId: room.chatId, messageId: 1 }),
    });
    const unreadAfterConsume = consumedSnapshot.unreadBySession[first.session.id] ?? 0;
    assertCondition(
      (consumedSnapshot.unreadByBucket[first.session.id]?.[roomBucketKey] ?? 0) === 0,
      "expected consume to clear the room-scoped background push notification",
    );
    assertCondition(
      unreadAfterConsume < unreadBeforeConsume,
      "expected consume to reduce unread notifications after the room-scoped push is cleared",
    );

    unsubscribe();

    const eventCounts = observedEvents.reduce<Record<string, number>>((acc, event) => {
      acc[event.type] = (acc[event.type] ?? 0) + 1;
      return acc;
    }, {});

    console.log(
      JSON.stringify(
        {
          root,
          runtimeId,
          roomId: room.chatId,
          workspacePaths: workspaceMounts.map((item) => item.workspacePath),
          sandboxGrant: grants.items[0],
          assetRoots,
          execSuccess,
          execDenied,
          unreadBeforeConsume,
          unreadAfterConsume,
          observedEventCounts: {
            "runtime.attention": eventCounts["runtime.attention"] ?? 0,
            "notification.updated": eventCounts["notification.updated"] ?? 0,
          },
        },
        null,
        2,
      ),
    );
  } finally {
    await kernel.stop().catch(() => undefined);
    if (!keepTemp) {
      rmSync(root, { recursive: true, force: true });
    }
  }
};

await main();
