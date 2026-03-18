import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { AppKernel, SessionDb } from "../src";

const tempDirs: string[] = [];

const createKernel = (): AppKernel => {
  const dir = mkdtempSync(join(tmpdir(), "agenter-kernel-"));
  tempDirs.push(dir);
  return new AppKernel({
    globalSessionRoot: join(dir, "sessions"),
    archiveSessionRoot: join(dir, "archive", "sessions"),
    workspacesPath: join(dir, "workspaces.yaml"),
  });
};

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("Feature: app kernel event replay", () => {
  test("Scenario: Given kernel boot cwd When start called Then workspace is tracked in workspaces.yaml", async () => {
    const dir = mkdtempSync(join(tmpdir(), "agenter-kernel-"));
    tempDirs.push(dir);
    const workspacePath = join(dir, "workspace");
    const workspacesPath = join(dir, "workspaces.yaml");
    const kernel = new AppKernel({
      globalSessionRoot: join(dir, "sessions"),
      archiveSessionRoot: join(dir, "archive", "sessions"),
      workspacesPath,
      initialWorkspace: workspacePath,
    });

    await kernel.start();

    const yaml = readFileSync(workspacesPath, "utf8");
    expect(yaml).toContain(`- ${JSON.stringify(resolve(workspacePath))}`);
    expect(yaml).toContain("favoriteSessions:");
  });

  test("Scenario: Given emitted events When reading getEventsAfter Then return ordered backlog", async () => {
    const kernel = createKernel();
    const first = await kernel.createSession({ cwd: process.cwd(), name: "alpha", autoStart: false });
    const second = await kernel.createSession({ cwd: process.cwd(), name: "beta", autoStart: false });

    const full = kernel.getEventsAfter(0);
    expect(full.length).toBe(2);
    expect(full[0]?.eventId).toBe(1);
    expect(full[1]?.eventId).toBe(2);
    expect((full[0]?.payload as { session: { id: string } }).session.id).toBe(first.id);
    expect((full[1]?.payload as { session: { id: string } }).session.id).toBe(second.id);

    const incremental = kernel.getEventsAfter(1);
    expect(incremental.length).toBe(1);
    expect(incremental[0]?.eventId).toBe(2);
  });

  test("Scenario: Given workspace session stored globally When listing workspaces Then counts still reflect the workspace session", async () => {
    const root = mkdtempSync(join(tmpdir(), "agenter-kernel-"));
    tempDirs.push(root);
    const workspace = join(root, "workspace");
    mkdirSync(workspace, { recursive: true });

    const kernel = new AppKernel({
      globalSessionRoot: join(root, "sessions"),
      archiveSessionRoot: join(root, "archive", "sessions"),
      workspacesPath: join(root, "workspaces.yaml"),
    });
    await kernel.start();

    const session = await kernel.createSession({ cwd: workspace, name: "global-workspace", autoStart: false });
    expect(session.storeTarget).toBe("global");

    const workspaces = kernel.listAllWorkspaces();
    expect(workspaces[0]?.path).toBe(resolve(workspace));
    expect(workspaces[0]?.counts).toEqual({ all: 1, running: 0, stopped: 1, archive: 0 });

    const page = kernel.listWorkspaceSessions({ path: workspace, tab: "all", limit: 20 });
    expect(page.counts).toEqual({ all: 1, running: 0, stopped: 1, archive: 0 });
    expect(page.items[0]?.sessionId).toBe(session.id);
  });

  test("Scenario: Given session runtime When inspecting model debug Then resolved provider config and empty history are returned", async () => {
    const kernel = createKernel();
    await kernel.start();

    const session = await kernel.createSession({ cwd: process.cwd(), name: "model-debug", autoStart: false });
    const debug = await kernel.inspectModelDebug(session.id);

    expect(debug.config?.providerId).toBeTruthy();
    expect(debug.config?.model).toBeTruthy();
    expect(debug.history).toEqual([]);
    expect(debug.latestModelCall).toBeNull();
    expect(debug.recentApiCalls).toEqual([]);
  });

  test("Scenario: Given legacy or broken session preview store When listing workspace sessions Then page still renders without crashing", async () => {
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

    const session = await kernel.createSession({ cwd: workspace, name: "broken-preview", autoStart: false });
    writeFileSync(join(session.sessionRoot, "session.db"), "not-a-sqlite-db", "utf8");

    const page = kernel.listWorkspaceSessions({ path: workspace, tab: "all", limit: 20 });
    expect(page.items[0]?.sessionId).toBe(session.id);
    expect(page.items[0]?.preview).toEqual({ firstUserMessage: null, latestMessages: [] });
  });

  test("Scenario: Given invalid workspace directory When creating session Then kernel rejects the malformed path", async () => {
    const kernel = createKernel();
    await kernel.start();

    await expect(
      kernel.createSession({
        cwd: 'path: "/tmp/agenter-chat-smoke-Rpho"',
        name: "broken",
        autoStart: false,
      }),
    ).rejects.toThrow("invalid workspace directory");
  });

  test("Scenario: Given missing workspaces tracked When cleaning them Then only broken entries are removed", async () => {
    const root = mkdtempSync(join(tmpdir(), "agenter-kernel-"));
    tempDirs.push(root);
    const existingWorkspace = join(root, "workspace-existing");
    const missingWorkspace = join(root, "workspace-missing");
    mkdirSync(existingWorkspace, { recursive: true });
    const workspacesPath = join(root, "workspaces.yaml");
    writeFileSync(
      workspacesPath,
      [
        "version: 2",
        "updatedAt: 2026-03-06T00:00:00.000Z",
        "workspaces:",
        `  - ${JSON.stringify(resolve(existingWorkspace))}`,
        `  - ${JSON.stringify(resolve(missingWorkspace))}`,
        "favoriteWorkspaces:",
        `  - ${JSON.stringify(resolve(missingWorkspace))}`,
        "favoriteSessions:",
        "",
      ].join("\n"),
      "utf8",
    );

    const kernel = new AppKernel({
      globalSessionRoot: join(root, "sessions"),
      archiveSessionRoot: join(root, "archive", "sessions"),
      workspacesPath,
    });
    await kernel.start();

    expect(kernel.listAllWorkspaces().find((item) => item.path === resolve(missingWorkspace))?.missing).toBe(true);
    expect(kernel.removeMissingWorkspaces()).toEqual({ removed: [resolve(missingWorkspace)] });
    expect(kernel.listAllWorkspaces().some((item) => item.path === resolve(missingWorkspace))).toBe(false);
    expect(kernel.listAllWorkspaces().some((item) => item.path === resolve(existingWorkspace))).toBe(true);
    expect(readFileSync(workspacesPath, "utf8")).not.toContain(JSON.stringify(resolve(missingWorkspace)));
  });

  test("Scenario: Given workspace session When creating and archiving Then paths use UTC buckets and archive tab can see it", async () => {
    const root = mkdtempSync(join(tmpdir(), "agenter-kernel-"));
    tempDirs.push(root);
    const workspace = join(root, "workspace");
    mkdirSync(join(workspace, ".agenter"), { recursive: true });
    writeFileSync(
      join(workspace, ".agenter", "settings.json"),
      JSON.stringify({ sessionStoreTarget: "workspace" }, null, 2),
      "utf8",
    );
    const kernel = new AppKernel({
      globalSessionRoot: join(root, "sessions"),
      archiveSessionRoot: join(root, "archive", "sessions"),
      workspacesPath: join(root, "workspaces.yaml"),
    });
    await kernel.start();

    const session = await kernel.createSession({ cwd: workspace, name: "bucketed", autoStart: false });
    const created = new Date(session.createdAt);
    const bucket = [
      String(created.getUTCFullYear()).padStart(4, "0"),
      String(created.getUTCMonth() + 1).padStart(2, "0"),
      String(created.getUTCDate()).padStart(2, "0"),
    ];
    expect(session.sessionRoot).toBe(
      join(workspace, ".agenter", "avatar", session.avatar, "sessions", ...bucket, session.id),
    );

    const archived = await kernel.archiveSession(session.id);
    const archivedDate = new Date(archived.archivedAt!);
    const archiveBucket = [
      String(archivedDate.getUTCFullYear()).padStart(4, "0"),
      String(archivedDate.getUTCMonth() + 1).padStart(2, "0"),
      String(archivedDate.getUTCDate()).padStart(2, "0"),
    ];
    expect(archived.sessionRoot).toBe(join(root, "archive", "sessions", ...archiveBucket, session.id));

    const page = kernel.listWorkspaceSessions({ path: workspace, tab: "archive", limit: 20 });
    expect(page.counts.archive).toBe(1);
    expect(page.items[0]?.sessionId).toBe(session.id);

    const restored = await kernel.restoreSession(session.id);
    expect(restored.storageState).toBe("active");
    expect(restored.sessionRoot).toBe(
      join(workspace, ".agenter", "avatar", session.avatar, "sessions", ...bucket, session.id),
    );
  });

  test("Scenario: Given terminal preset command is missing When auto-starting session Then kernel still accepts chat input", async () => {
    const kernel = createKernel();
    await kernel.start();

    const workspace = mkdtempSync(join(tmpdir(), "agenter-missing-terminal-"));
    tempDirs.push(workspace);
    mkdirSync(join(workspace, ".agenter"), { recursive: true });
    writeFileSync(
      join(workspace, ".agenter", "settings.json"),
      JSON.stringify(
        {
          terminal: {
            presets: {
              shell: {
                command: ["__agenter_missing_binary__"],
              },
            },
            gitLog: false,
          },
          features: {
            terminal: {
              bootTerminals: [{ id: "shell", focus: true, autoRun: true }],
            },
          },
        },
        null,
        2,
      ),
      "utf8",
    );

    const session = await kernel.createSession({
      cwd: workspace,
      autoStart: true,
    });

    expect(session.status).toBe("running");
    await expect(kernel.sendChat(session.id, "hello")).resolves.toEqual({ ok: true });
    await kernel.stop();
  });

  test("Scenario: Given a workspace draft When resolving provider capabilities and fuzzy path completions Then quick-start metadata is ready before a session exists", async () => {
    const root = mkdtempSync(join(tmpdir(), "agenter-kernel-draft-"));
    tempDirs.push(root);
    const workspace = join(root, "workspace");
    mkdirSync(join(workspace, "src"), { recursive: true });
    mkdirSync(join(workspace, "ignored"), { recursive: true });
    writeFileSync(join(workspace, ".gitignore"), "ignored\n", "utf8");
    writeFileSync(join(workspace, "README.md"), "# demo\n", "utf8");
    writeFileSync(join(workspace, "src", "index.ts"), "export const demo = true;\n", "utf8");
    writeFileSync(join(workspace, "ignored", "secret.ts"), "export const secret = true;\n", "utf8");

    const kernel = new AppKernel({
      globalSessionRoot: join(root, "sessions"),
      archiveSessionRoot: join(root, "archive", "sessions"),
      workspacesPath: join(root, "workspaces.yaml"),
    });
    await kernel.start();

    const draft = await kernel.resolveDraft({ cwd: workspace });
    const rootCompletions = kernel.searchWorkspacePaths({ cwd: workspace, query: "@", limit: 10 });
    const nestedCompletions = kernel.searchWorkspacePaths({ cwd: workspace, query: "@src/", limit: 10 });
    const fuzzyCompletions = kernel.searchWorkspacePaths({ cwd: workspace, query: "@idx", limit: 10 });
    const ignoredCompletions = kernel.searchWorkspacePaths({ cwd: workspace, query: "@secret", limit: 10 });

    expect(draft.cwd).toBe(resolve(workspace));
    expect(draft.provider.providerId).toBeTruthy();
    expect(typeof draft.modelCapabilities.imageInput).toBe("boolean");
    expect(rootCompletions).toEqual(
      expect.arrayContaining([
        {
          label: "src/",
          path: "src/",
          isDirectory: true,
        },
        {
          label: "README.md",
          path: "README.md",
          isDirectory: false,
        },
      ]),
    );
    expect(nestedCompletions).toEqual([
      {
        label: "src/index.ts",
        path: "src/index.ts",
        isDirectory: false,
      },
    ]);
    expect(fuzzyCompletions[0]).toEqual({
      label: "src/index.ts",
      path: "src/index.ts",
      isDirectory: false,
    });
    expect(ignoredCompletions).toEqual([]);
  });

  test("Scenario: Given uploaded session images When sending chat and deleting the session Then attachments persist and the asset files follow the session lifecycle", async () => {
    const root = mkdtempSync(join(tmpdir(), "agenter-kernel-images-"));
    tempDirs.push(root);
    const workspace = join(root, "workspace");
    mkdirSync(workspace, { recursive: true });

    const kernel = new AppKernel({
      globalSessionRoot: join(root, "sessions"),
      archiveSessionRoot: join(root, "archive", "sessions"),
      workspacesPath: join(root, "workspaces.yaml"),
    });
    await kernel.start();

    const session = await kernel.createSession({ cwd: workspace, name: "image-chat", autoStart: false });
    const uploads = await kernel.uploadSessionImages(session.id, [
      {
        name: "diagram.png",
        mimeType: "image/png",
        bytes: new Uint8Array([137, 80, 78, 71]),
      },
    ]);
    const attachment = uploads[0];
    if (!attachment) {
      throw new Error("expected uploaded image metadata");
    }

    const media = kernel.getSessionImage(session.id, attachment.assetId);
    expect(media?.mimeType).toBe("image/png");
    expect(media?.name).toBe("diagram.png");

    const sendResult = await kernel.sendChat(session.id, "Please inspect the image.", [attachment.assetId]);
    expect(sendResult).toEqual({ ok: true });

    const messages = kernel.listChatMessages(session.id, 0, 20);
    const userMessage = messages.find((item) => item.role === "user");
    expect(userMessage?.attachments).toHaveLength(1);
    expect(userMessage?.attachments[0]?.assetId).toBe(attachment.assetId);
    expect(userMessage?.attachments[0]?.url).toBe(
      `/media/sessions/${encodeURIComponent(session.id)}/images/${encodeURIComponent(attachment.assetId)}`,
    );

    const sessionRoot = session.sessionRoot;
    expect(media ? readFileSync(media.filePath).byteLength : 0).toBe(4);

    await kernel.deleteSession(session.id);
    expect(existsSync(sessionRoot)).toBe(false);
  });

  test("Scenario: Given projected session cycles When listing chat cycles Then collected inputs client ids and compact kind are preserved", async () => {
    const kernel = createKernel();
    await kernel.start();

    const session = await kernel.createSession({
      cwd: process.cwd(),
      name: "cycles",
      autoStart: false,
    });

    const db = new SessionDb(join(session.sessionRoot, "session.db"));
    const roundA = db.appendCycle({
      wake: { source: "user" },
      collectedInputs: [
        {
          source: "message",
          role: "user",
          name: "User",
          parts: [{ type: "text", text: "hello cycle" }],
          meta: { clientMessageId: "client-cycle-1" },
        },
      ],
      result: { kind: "model" },
    });
    db.appendBlock({
      cycleId: roundA.id,
      role: "assistant",
      channel: "to_user",
      content: "done",
    });
    db.appendModelCall({
      cycleId: roundA.id,
      provider: "openai-compatible",
      model: "test",
      request: {},
      response: { ok: true },
    });

    const roundB = db.appendCycle({
      prevCycleId: roundA.id,
      wake: { source: "user" },
      collectedInputs: [
        {
          source: "message",
          role: "user",
          name: "User",
          parts: [{ type: "text", text: "/compact" }],
          meta: { clientMessageId: "client-compact-1" },
        },
      ],
      result: { kind: "compact" },
    });
    db.setHead(roundB.id);
    db.close();

    const cycles = kernel.listChatCycles(session.id, 20);
    const firstCycle = cycles.find((cycle) => cycle.clientMessageIds.includes("client-cycle-1"));
    const compactCycle = cycles.find((cycle) => cycle.clientMessageIds.includes("client-compact-1"));

    expect(firstCycle?.kind).toBe("model");
    expect(firstCycle?.inputs[0]?.parts[0]).toEqual({ type: "text", text: "hello cycle" });
    expect(firstCycle?.outputs[0]?.content).toBe("done");
    expect(compactCycle?.kind).toBe("compact");

    await kernel.stop();
  });

  test("Scenario: Given legacy orphan user_input blocks When listing chat cycles Then the first matching cycle backfills those user messages", async () => {
    const kernel = createKernel();
    await kernel.start();

    const session = await kernel.createSession({
      cwd: process.cwd(),
      name: "legacy-cycles",
      autoStart: false,
    });

    const db = new SessionDb(join(session.sessionRoot, "session.db"));
    db.appendBlock({
      role: "user",
      channel: "user_input",
      content: "legacy hello",
    });
    const cycle = db.appendCycle({
      wake: { source: "terminal" },
      collectedInputs: [
        {
          source: "terminal",
          sourceId: "iflow",
          role: "user",
          name: "Terminal-iflow",
          parts: [{ type: "text", text: "{\"kind\":\"terminal-diff\"}" }],
        },
      ],
      result: { kind: "model" },
    });
    db.appendBlock({
      cycleId: cycle.id,
      role: "assistant",
      channel: "to_user",
      content: "legacy done",
    });
    db.setHead(cycle.id);
    db.close();

    const cycles = kernel.listChatCycles(session.id, 20);

    expect(cycles).toHaveLength(1);
    expect(cycles[0]?.inputs[0]?.source).toBe("message");
    expect(cycles[0]?.inputs[0]?.parts[0]).toEqual({ type: "text", text: "legacy hello" });
    expect(cycles[0]?.inputs[1]?.source).toBe("terminal");
    expect(cycles[0]?.outputs[0]?.content).toBe("legacy done");

    await kernel.stop();
  });
});
