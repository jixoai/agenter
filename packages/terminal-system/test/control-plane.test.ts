import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

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
    expect(created.running).toBe(true);
    expect(created.title).toBe("Shell");
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
      submit: false,
      returnRead: {
        debounceMs: 150,
      },
      readMode: "snapshot",
    });

    expect(result.ok).toBe(true);
    expect(result.read?.representation).toBe("snapshot");
    expect(result.read?.kind).toBe("terminal-snapshot");

    await plane.dispose();
  });

  test("Scenario: Given terminal output exceeds viewport rows When requesting the runtime snapshot Then the control plane preserves the whole scrollback for frontend restore", async () => {
    const plane = createPlane();
    const created = await plane.create({ terminalId: "scrollback" });

    const output = Array.from({ length: 48 }, (_, index) => `line ${index + 1}`).join("\n");
    await plane.write({
      terminalId: created.terminalId,
      text: `${output}\n`,
      submit: false,
    });
    await Bun.sleep(200);

    const snapshot = plane.getSnapshot(created.terminalId);
    const rendered = snapshot.lines.join("\n");

    expect(snapshot.lines.length).toBeGreaterThan(snapshot.rows);
    expect(rendered).toContain("line 1");
    expect(rendered).toContain("line 48");

    await plane.dispose();
  });

  test("Scenario: Given config updates When reading config and killing terminals Then profile overrides are preserved and killed terminals disappear from list", async () => {
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
    await expect(plane.kill("demo")).resolves.toEqual({ ok: true, message: "terminal stopped" });
    expect(plane.list()).toHaveLength(0);

    await plane.dispose();
  });

  test("Scenario: Given websocket transport is started When a client connects and the terminal is killed Then endpoint discovery output streaming and lifecycle shutdown stay coherent", async () => {
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
    await plane.kill(created.terminalId);
    await closed;
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
      submit: false,
      actorId: "session:readonly",
    });
    expect(readonlyWrite.ok).toBe(false);
    expect(readonlyWrite.message).toContain("readonly");

    const pending = await plane.write({
      terminalId: created.terminalId,
      text: "needs-lease",
      submit: false,
      actorId: "session:requester",
    });
    expect(pending.ok).toBe(false);
    expect(pending.approvalRequest?.assignedAdminId).toBe("session:admin");

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
      submit: false,
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
      submit: false,
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
      submit: false,
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
      submit: false,
      actorId: "session:admin",
    });
    await Bun.sleep(80);
    await plane.write({
      terminalId: created.terminalId,
      text: "second event\n",
      submit: false,
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
      plane.killAuthorized({
        terminalId: created.terminalId,
        actorId: "session:admin",
      }),
    ).resolves.toEqual({ ok: true, message: "terminal stopped" });
    expect(plane.list()).toHaveLength(0);

    await plane.dispose();
  });
});
