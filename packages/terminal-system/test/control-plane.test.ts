import { Database } from "bun:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterEach, describe, expect, test } from "bun:test";

import { TerminalControlPlane, type TerminalTransportServerMessage } from "../src";

const workspaces: string[] = [];

const createPlane = () => {
  const outputRoot = mkdtempSync(join(tmpdir(), "ati-control-plane-"));
  workspaces.push(outputRoot);
  return new TerminalControlPlane({
    dbPath: join(outputRoot, "terminal.db"),
    outputRoot,
    defaultShellCommand: ["sh", "-lc", "cat"],
    initialConfig: {
      defaults: {
        cols: 80,
        rows: 20,
      },
      transport: {
        port: null,
      },
    },
  });
};

afterEach(() => {
  while (workspaces.length > 0) {
    const path = workspaces.pop();
    if (path) {
      rmSync(path, { recursive: true, force: true });
    }
  }
});

describe("Feature: terminal control plane", () => {
  test("Scenario: Given default create When creating and listing terminals Then the control plane starts a shell-backed terminal with profile metadata", async () => {
    const plane = createPlane();
    plane.setConfig({
      processProfiles: {
        shell: {
          title: "Shell",
          icon: "terminal",
          shortcuts: {
            submit: "enter",
          },
        },
      },
    });

    const created = await plane.create();

    expect(created.processKind).toBe("shell");
    expect(created.processPhase).toBe("running");
    expect(created.configuredTitle).toBe("Shell");
    expect(created.icon).toBe("terminal");
    expect(created.shortcuts).toEqual({ submit: "enter" });
    expect(plane.list()).toHaveLength(1);

    await plane.dispose();
  });

  test("Scenario: Given focus set operations When replacing adding removing and clearing Then the control plane preserves a declarative focus set", async () => {
    const plane = createPlane();
    const left = await plane.create({ terminalId: "left" });
    const right = await plane.create({ terminalId: "right" });

    expect(plane.focus("replace", [left.terminalId])).toEqual(["left"]);
    expect(plane.focus("add", [right.terminalId])).toEqual(["left", "right"]);
    expect(plane.focus("remove", [left.terminalId])).toEqual(["right"]);
    expect(plane.focus("clear")).toEqual([]);

    await plane.dispose();
  });

  test("Scenario: Given multiple actor seats When they focus the same terminal independently Then each seat keeps its own focus truth", async () => {
    const plane = createPlane();
    plane.setActorPresence("session:owner", true);
    const created = await plane.create({
      terminalId: "shared",
      bootstrapActorId: "session:owner",
      bootstrapRole: "admin",
    });
    const reviewer = plane.issueGrantAuthorized({
      terminalId: created.terminalId,
      actorId: "session:owner",
      participantId: "session:reviewer",
      role: "writer",
    });

    expect(plane.focusForActor("session:owner", "add", [created.terminalId])).toEqual(["shared"]);
    expect(
      plane.focusAuthorized("add", [
        {
          terminalId: created.terminalId,
          accessToken: reviewer.accessToken,
        },
      ]),
    ).toEqual(["shared"]);
    expect(plane.listForActor("session:owner", { touchPresence: false })[0]?.focused).toBe(true);
    expect(plane.listForActor("session:reviewer", { touchPresence: false })[0]?.focused).toBe(true);

    expect(
      plane.focusAuthorized("remove", [
        {
          terminalId: created.terminalId,
          accessToken: reviewer.accessToken,
        },
      ]),
    ).toEqual([]);
    expect(plane.listForActor("session:owner", { touchPresence: false })[0]?.focused).toBe(true);
    expect(plane.listForActor("session:reviewer", { touchPresence: false })[0]?.focused).toBe(false);

    await plane.dispose();
  });

  test("Scenario: Given one actor seat with two terminal grants When focus is added and removed by access token Then multi-terminal focus stays actor-scoped", async () => {
    const plane = createPlane();
    plane.setActorPresence("session:owner", true);
    const left = await plane.create({
      terminalId: "left-seat",
      bootstrapActorId: "session:owner",
      bootstrapRole: "admin",
    });
    const right = await plane.create({
      terminalId: "right-seat",
      bootstrapActorId: "session:owner",
      bootstrapRole: "admin",
    });
    const reviewerLeft = plane.issueGrantAuthorized({
      terminalId: left.terminalId,
      actorId: "session:owner",
      participantId: "session:reviewer",
      role: "readonly",
    });
    plane.issueGrantAuthorized({
      terminalId: right.terminalId,
      actorId: "session:owner",
      participantId: "session:reviewer",
      role: "readonly",
      accessTokenHint: reviewerLeft.accessToken,
    });

    expect(
      plane.focusAuthorized("add", [
        { terminalId: left.terminalId, accessToken: reviewerLeft.accessToken },
        { terminalId: right.terminalId, accessToken: reviewerLeft.accessToken },
      ]),
    ).toEqual(["left-seat", "right-seat"]);
    expect(plane.getFocusedTerminalIds("session:reviewer")).toEqual(["left-seat", "right-seat"]);

    expect(
      plane.focusAuthorized("remove", [
        { terminalId: left.terminalId, accessToken: reviewerLeft.accessToken },
      ]),
    ).toEqual(["right-seat"]);
    expect(plane.getFocusedTerminalIds("session:reviewer")).toEqual(["right-seat"]);

    await plane.dispose();
  });

  test("Scenario: Given a write with returnRead When the terminal echoes input Then the control plane returns an explicit inspection payload", async () => {
    const plane = createPlane();
    const created = await plane.create({ terminalId: "echo" });

    const result = await plane.write({
      terminalId: created.terminalId,
      text: "hello control plane",
      returnRead: {
        debounceMs: 150,
      },
      readMode: "snapshot",
    });

    expect(result.ok).toBe(true);
    expect(result.read?.representation).toBe("snapshot");
    expect(result.read?.kind).toBe("terminal-snapshot");
    expect(result.read?.snapshot?.lines.join("\n")).toContain("hello control plane");

    await plane.dispose();
  });

  test("Scenario: Given mixed terminal input When the control plane applies it Then the returned approval and activity facts keep the mixed mode", async () => {
    const plane = createPlane();
    plane.setActorPresence("session:admin", true);
    const created = await plane.create({
      terminalId: "mixed-input",
      bootstrapActorId: "session:admin",
      bootstrapRole: "admin",
    });

    const result = await plane.input({
      terminalId: created.terminalId,
      text: '<raw>hello mixed</raw><key data="enter"/>',
      actorId: "session:admin",
      returnRead: {
        debounceMs: 150,
      },
      readMode: "snapshot",
    });

    expect(result.ok).toBe(true);
    expect(result.read?.snapshot?.lines.join("\n")).toContain("hello mixed");

    const events = plane.pageEventsAuthorized({
      terminalId: created.terminalId,
      actorId: "session:admin",
      limit: 10,
    }).items;
    expect(events[0]?.payload.detail).toEqual({ mode: "mixed" });

    await plane.dispose();
  });

  test("Scenario: Given mixed terminal input is rejected by terminal-core When the control plane applies it Then the caller sees failure truth and no synthetic write fact", async () => {
    const plane = createPlane();
    plane.setActorPresence("session:admin", true);
    const created = await plane.create({
      terminalId: "mixed-failure",
      bootstrapActorId: "session:admin",
      bootstrapRole: "admin",
    });

    const result = await plane.input({
      terminalId: created.terminalId,
      text: "<raw>a<raw>b</raw>c</raw>",
      actorId: "session:admin",
      returnRead: {
        debounceMs: 150,
      },
      readMode: "snapshot",
    });

    expect(result.ok).toBe(false);
    expect(result.message).toContain("failed before reaching the PTY");
    expect(result.read).toBeUndefined();

    const events = plane.pageEventsAuthorized({
      terminalId: created.terminalId,
      actorId: "session:admin",
      limit: 10,
    }).items;
    expect(events).toHaveLength(0);

    await plane.dispose();
  });

  test("Scenario: Given terminal output exceeds viewport rows When requesting the runtime snapshot Then the control plane preserves the whole scrollback for frontend restore", async () => {
    const plane = createPlane();
    const created = await plane.create({ terminalId: "scrollback" });

    const output = Array.from({ length: 48 }, (_, index) => `line ${index + 1}`).join("\n");
    await plane.write({
      terminalId: created.terminalId,
      text: `${output}\n`,
    });
    await Bun.sleep(200);

    const result = await plane.snapshot(created.terminalId);
    const snapshot = result.snapshot;
    const rendered = snapshot?.lines.join("\n") ?? "";

    expect(result.representation).toBe("snapshot");
    expect(snapshot?.lines.length).toBeGreaterThan(snapshot?.rows ?? 0);
    expect(rendered).toContain("line 1");
    expect(rendered).toContain("line 48");

    await plane.dispose();
  });

  test("Scenario: Given a stopped terminal When snapshot is requested Then inspection does not auto-start the process", async () => {
    const plane = createPlane();
    const created = await plane.create({
      terminalId: "stopped-read",
      start: false,
    });

    expect(plane.isRunning(created.terminalId)).toBe(false);
    await expect(plane.snapshot(created.terminalId)).rejects.toThrow("terminal is not running");
    expect(plane.isRunning(created.terminalId)).toBe(false);

    await plane.dispose();
  });

  test("Scenario: Given a terminal with no trusted bootstrap grant When read-only inspection runs Then no hidden bootstrap access is created", async () => {
    const outputRoot = mkdtempSync(join(tmpdir(), "ati-control-plane-"));
    workspaces.push(outputRoot);
    const dbPath = join(outputRoot, "terminal.db");
    const plane = new TerminalControlPlane({
      dbPath,
      outputRoot,
      defaultShellCommand: ["sh", "-lc", "cat"],
      initialConfig: {
        defaults: {
          cols: 80,
          rows: 20,
        },
        transport: {
          port: null,
        },
      },
    });
    plane.setActorPresence("session:owner", true);
    const created = await plane.create({
      terminalId: "inspection-no-bootstrap",
      bootstrapActorId: "session:owner",
      bootstrapRole: "admin",
    });

    const countGrants = () => {
      const db = new Database(dbPath, { readonly: true });
      try {
        const row = db
          .query("select count(*) as count from terminal_grant where terminal_id = ? and revoked_at is null")
          .get(created.terminalId) as { count: number };
        return row.count;
      } finally {
        db.close();
      }
    };

    expect(countGrants()).toBe(1);
    await plane.readAuthorized({
      terminalId: created.terminalId,
      actorId: "session:owner",
      mode: "snapshot",
    });
    expect(countGrants()).toBe(1);

    await plane.dispose();
  });

  test("Scenario: Given explicit terminal reads When inspection runs Then activity history records reads by default and only explicit opt-out stays silent", async () => {
    const plane = createPlane();
    plane.setActorPresence("session:owner", true);
    const created = await plane.create({
      terminalId: "read-activity",
      bootstrapActorId: "session:owner",
      bootstrapRole: "admin",
    });

    await plane.readAuthorized({
      terminalId: created.terminalId,
      actorId: "session:owner",
      mode: "snapshot",
    });
    const initialItems = plane.pageEventsAuthorized({
      terminalId: created.terminalId,
      actorId: "session:owner",
      limit: 10,
    }).items;
    expect(initialItems).toHaveLength(1);
    expect(initialItems[0]?.kind).toBe("terminal_read");

    await plane.readAuthorized({
      terminalId: created.terminalId,
      actorId: "session:owner",
      mode: "snapshot",
      recordActivity: false,
    });
    expect(
      plane.pageEventsAuthorized({
        terminalId: created.terminalId,
        actorId: "session:owner",
        limit: 10,
      }).items,
    ).toHaveLength(1);

    await plane.dispose();
  });

  test("Scenario: Given a relative cwd and live output When listing terminals Then the control plane exposes an absolute launch cwd and inline snapshot for global restore", async () => {
    const plane = createPlane();
    const created = await plane.create({
      terminalId: "relative-cwd",
      cwd: ".",
    });

    await plane.write({
      terminalId: created.terminalId,
      text: "pwd\n",
    });
    await Bun.sleep(120);

    const listed = plane.list().find((entry) => entry.terminalId === created.terminalId);

    expect(listed?.launchCwd).toBe(resolve("."));
    expect(listed?.snapshot?.seq).toBeGreaterThan(0);
    expect(listed?.snapshot?.lines.join("\n")).toContain("pwd");

    await plane.dispose();
  });

  test("Scenario: Given config updates When reading config and stopping then deleting terminals Then profile overrides are preserved while runtime stop stays separate from catalog delete", async () => {
    const plane = createPlane();
    const config = plane.setConfig({
      processProfiles: {
        iflow: {
          icon: "sparkles",
          title: "iFlow",
          shortcuts: {
            plan: "shift+tab",
          },
        },
      },
      terminalProfiles: {
        demo: {
          title: "Demo",
        },
      },
    });

    expect(config.processProfiles?.iflow?.icon).toBe("sparkles");
    expect(config.terminalProfiles?.demo?.title).toBe("Demo");

    await plane.create({ terminalId: "demo" });
    expect(plane.list()).toHaveLength(1);
    await expect(plane.stop("demo")).resolves.toEqual({ ok: true, message: "terminal PTY stopped" });
    expect(plane.list().find((entry) => entry.terminalId === "demo")?.processPhase).toBe("stopped");
    expect(plane.list()).toHaveLength(1);
    await expect(plane.deleteTerminal("demo")).resolves.toEqual({ ok: true, message: "terminal deleted" });
    expect(plane.list()).toHaveLength(0);

    await plane.dispose();
  });

  test("Scenario: Given websocket transport is started When a client connects and the terminal is stopped Then endpoint discovery output streaming and lifecycle shutdown stay coherent", async () => {
    const plane = createPlane();
    const created = await plane.create({ terminalId: "stream" });
    const transport = await plane.startTransport({ port: 0 });
    const endpoint = plane.getTransportEndpoint(created.terminalId);

    expect(transport.port).not.toBeNull();
    expect(endpoint?.url).toContain(`/pty/${created.terminalId}`);

    const socket = new WebSocket(endpoint!.url);
    const messages: TerminalTransportServerMessage[] = [];
    const opened = new Promise<void>((resolve, reject) => {
      socket.addEventListener("open", () => resolve(), { once: true });
      socket.addEventListener("error", () => reject(new Error("websocket-open-failed")), { once: true });
    });
    socket.addEventListener("message", (event) => {
      messages.push(JSON.parse(String(event.data)) as TerminalTransportServerMessage);
    });

    await opened;
    socket.send(JSON.stringify({ type: "input", data: "hello transport\n" }));
    await Bun.sleep(150);

    expect(messages.some((message) => message.type === "snapshot")).toBe(true);
    expect(messages.some((message) => message.type === "output" && message.data.includes("hello transport"))).toBe(true);

    const closed = new Promise<void>((resolve) => {
      socket.addEventListener("close", () => resolve(), { once: true });
    });
    await plane.stop(created.terminalId);
    await closed;
    expect(plane.getTransportEndpoint(created.terminalId)).toBeNull();
    plane.stopTransport();
    await plane.dispose();
  });

  test("Scenario: Given a transport client is attached When terminal output changes without a geometry change Then websocket subscribers keep the bootstrap snapshot and stream output instead of receiving a fresh full snapshot every tick", async () => {
    const plane = createPlane();
    const created = await plane.create({ terminalId: "stream-snapshot-updates" });
    const transport = await plane.startTransport({ port: 0 });
    const endpoint = plane.getTransportEndpoint(created.terminalId);

    expect(transport.port).not.toBeNull();
    expect(endpoint?.url).toContain(`/pty/${created.terminalId}`);

    const socket = new WebSocket(endpoint!.url);
    const messages: TerminalTransportServerMessage[] = [];
    const opened = new Promise<void>((resolve, reject) => {
      socket.addEventListener("open", () => resolve(), { once: true });
      socket.addEventListener("error", () => reject(new Error("websocket-open-failed")), { once: true });
    });
    socket.addEventListener("message", (event) => {
      messages.push(JSON.parse(String(event.data)) as TerminalTransportServerMessage);
    });

    await opened;
    await Bun.sleep(80);
    const initialSnapshotCount = messages.filter((message) => message.type === "snapshot").length;
    expect(initialSnapshotCount).toBeGreaterThan(0);

    await plane.write({
      terminalId: created.terminalId,
      text: "snapshot after connect\n",
    });
    await Bun.sleep(150);

    const snapshotMessages = messages.filter(
      (message): message is Extract<TerminalTransportServerMessage, { type: "snapshot" }> => message.type === "snapshot",
    );

    expect(snapshotMessages.length).toBe(initialSnapshotCount);
    expect(messages.some((message) => message.type === "output" && message.data.includes("snapshot after connect"))).toBe(true);

    socket.close();
    plane.stopTransport();
    await plane.dispose();
  });

  test("Scenario: Given requester and readonly grants When writes require approval Then readonly stays blocked and approved leases unlock requester writes", async () => {
    const plane = createPlane();
    plane.setActorPresence("session:admin", true);
    const created = await plane.create({
      terminalId: "collab",
      bootstrapActorId: "session:admin",
      bootstrapRole: "admin",
    });

    const requester = plane.issueGrantAuthorized({
      terminalId: created.terminalId,
      actorId: "session:admin",
      participantId: "session:requester",
      role: "requester",
    });
    plane.issueGrantAuthorized({
      terminalId: created.terminalId,
      actorId: "session:admin",
      participantId: "session:readonly",
      role: "readonly",
    });

    const readonlyWrite = await plane.write({
      terminalId: created.terminalId,
      text: "blocked",
      actorId: "session:readonly",
    });
    expect(readonlyWrite.ok).toBe(false);
    expect(readonlyWrite.message).toContain("readonly");

    const pending = await plane.write({
      terminalId: created.terminalId,
      text: "needs-lease",
      actorId: "session:requester",
    });
    expect(pending.ok).toBe(false);
    expect(pending.approvalRequest?.assignedAdminId).toBe("session:admin");
    expect(pending.approvalRequest?.requestedInput).toEqual({
      mode: "raw",
      text: "needs-lease",
    });

    const requestId = pending.approvalRequest?.requestId;
    if (!requestId) {
      throw new Error("expected approval request");
    }

    const lease = plane.approveRequestAuthorized({
      terminalId: created.terminalId,
      requestId,
      durationMs: 60_000,
      actorId: "session:admin",
    });
    expect(lease.participantId).toBe("session:requester");

    const approved = await plane.write({
      terminalId: created.terminalId,
      text: "needs-lease",
      actorId: "session:requester",
      accessToken: requester.accessToken,
    });
    expect(approved.ok).toBe(true);

    await plane.dispose();
  });

  test("Scenario: Given admin-group failover When higher-priority admins move online Then pending work is reassigned without changing readonly base writes", async () => {
    const plane = createPlane();
    plane.setActorPresence("session:alpha", true);
    const created = await plane.create({
      terminalId: "admin-failover",
      bootstrapActorId: "session:alpha",
      bootstrapRole: "admin",
    });

    plane.issueGrantAuthorized({
      terminalId: created.terminalId,
      actorId: "session:alpha",
      participantId: "session:bravo",
      role: "readonly",
      adminCandidateRank: 1,
    });
    plane.issueGrantAuthorized({
      terminalId: created.terminalId,
      actorId: "session:alpha",
      participantId: "session:charlie",
      role: "requester",
    });

    const initialRequest = await plane.write({
      terminalId: created.terminalId,
      text: "handoff",
      actorId: "session:charlie",
    });
    expect(initialRequest.approvalRequest?.assignedAdminId).toBe("session:alpha");

    plane.setActorPresence("session:bravo", true);
    plane.setActorPresence("session:alpha", false);

    const reassigned = plane.listApprovalRequests({
      terminalId: created.terminalId,
      participantId: "session:charlie",
    });
    expect(reassigned[0]?.assignedAdminId).toBe("session:bravo");

    const bravoView = plane.listForActor("session:bravo")[0];
    expect(bravoView?.access?.currentAdmin).toBe(true);
    const bravoWrite = await plane.write({
      terminalId: created.terminalId,
      text: "still blocked",
      actorId: "session:bravo",
    });
    expect(bravoWrite.ok).toBe(false);
    expect(bravoWrite.message).toContain("readonly");

    plane.setActorPresence("session:alpha", true);
    const preempted = plane.listApprovalRequests({
      terminalId: created.terminalId,
      participantId: "session:charlie",
    });
    expect(preempted[0]?.assignedAdminId).toBe("session:alpha");

    await plane.dispose();
  });

  test("Scenario: Given admin group candidates are updated When persisted Then the canonical table owns the truth without a metadata mirror", async () => {
    const outputRoot = mkdtempSync(join(tmpdir(), "ati-control-plane-"));
    workspaces.push(outputRoot);
    const dbPath = join(outputRoot, "terminal.db");
    const plane = new TerminalControlPlane({
      dbPath,
      outputRoot,
      defaultShellCommand: ["sh", "-lc", "cat"],
      initialConfig: {
        defaults: {
          cols: 80,
          rows: 20,
        },
        transport: {
          port: null,
        },
      },
    });
    plane.setActorPresence("session:alpha", true);
    const created = await plane.create({
      terminalId: "admin-table-only",
      bootstrapActorId: "session:alpha",
      bootstrapRole: "admin",
      start: false,
    });
    plane.issueGrantAuthorized({
      terminalId: created.terminalId,
      actorId: "session:alpha",
      participantId: "session:bravo",
      role: "readonly",
    });
    plane.issueGrantAuthorized({
      terminalId: created.terminalId,
      actorId: "session:alpha",
      participantId: "session:charlie",
      role: "requester",
    });

    plane.updateTerminalAuthorized({
      terminalId: created.terminalId,
      actorId: "session:alpha",
      adminGroupCandidateIds: ["session:alpha", "session:bravo", "session:charlie"],
    });

    const db = new Database(dbPath, { readonly: true });
    try {
      const candidates = db
        .query(
          `select participant_id
           from terminal_admin_candidate
           where terminal_id = ?
           order by priority asc`,
        )
        .all(created.terminalId) as Array<{ participant_id: string }>;
      const terminalRow = db
        .query(`select metadata_json from terminal_catalog where terminal_id = ?`)
        .get(created.terminalId) as { metadata_json: string | null } | null;
      const metadata = JSON.parse(terminalRow?.metadata_json ?? "{}") as Record<string, unknown>;

      expect(candidates.map((candidate) => candidate.participant_id)).toEqual([
        "session:alpha",
        "session:bravo",
        "session:charlie",
      ]);
      expect(Object.prototype.hasOwnProperty.call(metadata, "adminGroupCandidateIds")).toBe(false);
    } finally {
      db.close();
      await plane.dispose();
    }
  });

  test("Scenario: Given approved and denied requests When approval history is queried by status Then durable state transitions remain visible", async () => {
    const plane = createPlane();
    plane.setActorPresence("session:admin", true);
    const created = await plane.create({
      terminalId: "approval-history",
      bootstrapActorId: "session:admin",
      bootstrapRole: "admin",
    });
    plane.issueGrantAuthorized({
      terminalId: created.terminalId,
      actorId: "session:admin",
      participantId: "session:requester-a",
      role: "requester",
    });
    plane.issueGrantAuthorized({
      terminalId: created.terminalId,
      actorId: "session:admin",
      participantId: "session:requester-b",
      role: "requester",
    });

    const pendingA = await plane.write({
      terminalId: created.terminalId,
      text: "approved request",
      actorId: "session:requester-a",
      createApprovalRequest: true,
    });
    const pendingB = await plane.write({
      terminalId: created.terminalId,
      text: "denied request",
      actorId: "session:requester-b",
      createApprovalRequest: true,
    });
    const approvedRequestId = pendingA.approvalRequest?.requestId;
    const deniedRequestId = pendingB.approvalRequest?.requestId;
    if (!approvedRequestId || !deniedRequestId) {
      throw new Error("expected approval requests");
    }

    plane.approveRequestAuthorized({
      terminalId: created.terminalId,
      actorId: "session:admin",
      requestId: approvedRequestId,
      durationMs: 60_000,
    });
    plane.denyRequestAuthorized({
      terminalId: created.terminalId,
      actorId: "session:admin",
      requestId: deniedRequestId,
    });

    expect(
      plane
        .listApprovalRequests({
          terminalId: created.terminalId,
          statuses: ["approved"],
        })
        .map((request) => request.requestId),
    ).toEqual([approvedRequestId]);
    expect(
      plane
        .listApprovalRequests({
          terminalId: created.terminalId,
          statuses: ["denied"],
        })
        .map((request) => request.requestId),
    ).toEqual([deniedRequestId]);
    expect(
      plane.listApprovalRequests({
        terminalId: created.terminalId,
        statuses: ["pending"],
      }),
    ).toHaveLength(0);

    await plane.dispose();
  });

  test("Scenario: Given requester transport input When no lease exists Then websocket input is rejected until an admin approves a write lease", async () => {
    const plane = createPlane();
    plane.setActorPresence("session:admin", true);
    const created = await plane.create({
      terminalId: "transport-acl",
      bootstrapActorId: "session:admin",
      bootstrapRole: "admin",
    });
    const requester = plane.issueGrantAuthorized({
      terminalId: created.terminalId,
      actorId: "session:admin",
      participantId: "session:requester",
      role: "requester",
    });
    const transport = await plane.startTransport({ port: 0 });
    const endpoint = plane.getTransportEndpoint(created.terminalId, requester.accessToken);

    expect(transport.port).not.toBeNull();
    expect(endpoint?.url).toContain("token=");

    const socket = new WebSocket(endpoint!.url);
    const messages: TerminalTransportServerMessage[] = [];
    const opened = new Promise<void>((resolve, reject) => {
      socket.addEventListener("open", () => resolve(), { once: true });
      socket.addEventListener("error", () => reject(new Error("websocket-open-failed")), { once: true });
    });
    socket.addEventListener("message", (event) => {
      messages.push(JSON.parse(String(event.data)) as TerminalTransportServerMessage);
    });
    await opened;

    socket.send(JSON.stringify({ type: "input", data: "blocked transport\n" }));
    await Bun.sleep(120);
    expect(messages.some((message) => message.type === "error" && message.message.includes("approval"))).toBe(true);

    const pending = plane.listApprovalRequests({
      terminalId: created.terminalId,
      participantId: "session:requester",
    })[0];
    if (!pending) {
      throw new Error("expected pending transport request");
    }
    plane.approveRequestAuthorized({
      terminalId: created.terminalId,
      requestId: pending.requestId,
      durationMs: 60_000,
      actorId: "session:admin",
    });

    socket.send(JSON.stringify({ type: "input", data: "allowed transport\n" }));
    await Bun.sleep(150);
    expect(messages.some((message) => message.type === "output" && message.data.includes("allowed transport"))).toBe(true);

    socket.close();
    plane.stopTransport();
    await plane.dispose();
  });

  test("Scenario: Given current local admin When paging events and killing through authorized APIs Then history stays cursor-addressable and lifecycle stays admin-gated", async () => {
    const plane = createPlane();
    plane.setActorPresence("session:admin", true);
    const created = await plane.create({
      terminalId: "event-page",
      bootstrapActorId: "session:admin",
      bootstrapRole: "admin",
    });

    await plane.write({
      terminalId: created.terminalId,
      text: "first event\n",
      actorId: "session:admin",
    });
    await Bun.sleep(80);
    await plane.write({
      terminalId: created.terminalId,
      text: "second event\n",
      actorId: "session:admin",
    });
    await Bun.sleep(80);

    const firstPage = plane.pageEventsAuthorized({
      terminalId: created.terminalId,
      actorId: "session:admin",
      limit: 1,
    });
    expect(firstPage.items).toHaveLength(1);
    expect(firstPage.items[0]?.kind).toBe("terminal_write");
    expect(firstPage.hasMoreBefore).toBeTrue();
    expect(firstPage.nextBefore).not.toBeNull();

    const secondPage = plane.pageEventsAuthorized({
      terminalId: created.terminalId,
      actorId: "session:admin",
      before: firstPage.nextBefore ?? undefined,
      limit: 4,
    });
    expect(secondPage.items.length).toBeGreaterThan(0);
    expect(secondPage.items.at(-1)?.createdAt).toBeLessThanOrEqual(firstPage.items[0]!.createdAt);

    await expect(
      plane.stopAuthorized({
        terminalId: created.terminalId,
        actorId: "session:admin",
      }),
    ).resolves.toEqual({ ok: true, message: "terminal PTY stopped" });
    expect(plane.list().find((entry) => entry.terminalId === created.terminalId)?.processPhase).toBe("stopped");
    expect(plane.list()).toHaveLength(1);

    await plane.dispose();
  });
});
