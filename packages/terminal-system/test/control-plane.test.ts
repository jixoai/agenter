import { Database } from "bun:sqlite";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterEach, describe, expect, test } from "bun:test";
import { signManagedInvitationAcceptProof } from "@agenter/managed-seat-invitation-handshake";
import { generatePrincipalKeyPair } from "@agenter/principal-crypto";
import {
  decodeTerminalTransportServerMessage,
  encodeTerminalTransportClientMessage,
  type TerminalTransportClientMessage,
} from "@agenter/terminal-transport-protocol";

import { TerminalControlPlane, type ManagedTerminal, type TerminalTransportServerMessage } from "../src";

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

const createDefaultShellPlane = () => {
  const outputRoot = mkdtempSync(join(tmpdir(), "ati-control-plane-"));
  workspaces.push(outputRoot);
  return new TerminalControlPlane({
    dbPath: join(outputRoot, "terminal.db"),
    outputRoot,
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

const decodeServerFrame = (data: MessageEvent["data"]): TerminalTransportServerMessage | null => {
  if (typeof data === "string") {
    return null;
  }
  if (data instanceof ArrayBuffer) {
    return decodeTerminalTransportServerMessage(data);
  }
  if (ArrayBuffer.isView(data)) {
    return decodeTerminalTransportServerMessage(data);
  }
  return null;
};

const encodeClientFrame = (message: TerminalTransportClientMessage): ArrayBuffer => {
  const bytes = encodeTerminalTransportClientMessage(message);
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
};

const utf8Decoder = new TextDecoder();
const outputIncludes = (message: TerminalTransportServerMessage, text: string): boolean =>
  message.type === "outputBytes" && utf8Decoder.decode(message.data).includes(text);

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

  test("Scenario: Given create auto-bootstrap and stop When control-plane listeners observe lifecycle truth Then transient transitions stay separate from durable processPhase", async () => {
    const plane = createPlane();
    const observed: Array<{
      reason: string;
      processPhase: string;
      lifecycleTransition: string | null;
    }> = [];
    plane.onChanged(({ terminalId, reason }) => {
      if (terminalId !== "transition-law" || (reason !== "transition" && reason !== "lifecycle")) {
        return;
      }
      const entry = plane.list().find((item) => item.terminalId === terminalId);
      if (!entry) {
        return;
      }
      observed.push({
        reason,
        processPhase: entry.processPhase,
        lifecycleTransition: entry.lifecycleTransition ?? null,
      });
    });

    const created = await plane.create({ terminalId: "transition-law" });
    await plane.stop(created.terminalId);

    expect(
      observed.some(
        (item) =>
          item.reason === "transition" &&
          item.processPhase === "not_started" &&
          item.lifecycleTransition === "bootstrapping",
      ),
    ).toBe(true);
    expect(
      observed.some(
        (item) =>
          item.reason === "transition" &&
          item.processPhase === "running" &&
          item.lifecycleTransition === "killing",
      ),
    ).toBe(true);
    expect(plane.list().find((item) => item.terminalId === created.terminalId)?.lifecycleTransition).toBeNull();
    expect(plane.list().find((item) => item.terminalId === created.terminalId)?.processPhase).toBe("stopped");

    await plane.dispose();
  });

  test("Scenario: Given a kill transition is in flight When another lifecycle or config mutation arrives Then the control plane rejects the overlap", async () => {
    const plane = createPlane();
    plane.setActorPresence("session:owner", true);
    const created = await plane.create({
      terminalId: "transition-conflict",
      bootstrapActorId: "session:owner",
      bootstrapRole: "admin",
    });
    const managed = plane.getManagedTerminal(created.terminalId);
    if (!managed) {
      throw new Error("expected managed terminal");
    }
    const originalStop = managed.stop.bind(managed);
    managed.stop = async () => {
      await Bun.sleep(40);
      await originalStop();
    };

    const stopPromise = plane.stop(created.terminalId);
    await Bun.sleep(5);

    expect(() =>
      plane.setTerminalConfigAuthorized({
        terminalId: created.terminalId,
        actorId: "session:owner",
        title: "Blocked during kill",
      }),
    ).toThrow("already killing");
    expect(() => plane.bootstrap(created.terminalId)).toThrow("already killing");

    await stopPromise;
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

  test("Scenario: Given a default shell terminal When mixed input submits a command Then the control plane observes executed output instead of a stuck echoed line", async () => {
    const plane = createDefaultShellPlane();
    const created = await plane.create({ terminalId: "default-shell-exec" });

    const result = await plane.input({
      terminalId: created.terminalId,
      text: '<raw>printf "__AGT_EXEC__=%s\\n" "ok"</raw><key data="enter"/>',
      returnRead: {
        debounceMs: 250,
      },
      readMode: "snapshot",
    });

    expect(result.ok).toBe(true);
    const lines = result.read?.snapshot?.lines ?? [];
    const visible = lines.join("\n");
    expect(visible).toContain("__AGT_EXEC__=ok");

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

  test("Scenario: Given terminal await match absent idle changed timeout and stopped flows When awaiting snapshots Then bounded evidence is returned", async () => {
    const plane = createPlane();
    const created = await plane.create({ terminalId: "await-flows" });

    await plane.write({
      terminalId: created.terminalId,
      text: "ready line\n",
    });
    await Bun.sleep(120);

    const matched = await plane.awaitAuthorized({
      terminalId: created.terminalId,
      wait: { until: "match", timeoutMs: 1_000, idleMs: 0 },
      match: { pattern: "ready", contextLines: 1 },
      view: { lines: 5 },
      recordActivity: false,
    });
    expect(matched.outcome).toBe("matched");
    expect(matched.snapshot.lines.join("\n")).toContain("ready line");
    expect(matched.match?.matches[0]?.text).toContain("ready line");

    const absent = await plane.awaitAuthorized({
      terminalId: created.terminalId,
      wait: { until: "absent", timeoutMs: 1_000, idleMs: 0 },
      match: { pattern: "Loading forever" },
      recordActivity: false,
    });
    expect(absent.outcome).toBe("absent");

    const idle = await plane.awaitAuthorized({
      terminalId: created.terminalId,
      wait: { until: "idle", timeoutMs: 3_000, idleMs: 0 },
      recordActivity: false,
    });
    expect(idle.outcome).toBe("idle");
    expect(idle.status).toBe("IDLE");

    const changedPromise = plane.awaitAuthorized({
      terminalId: created.terminalId,
      wait: {
        until: "changed",
        fromHash: plane.getHeadHash(created.terminalId),
        timeoutMs: 2_000,
        idleMs: 0,
      },
      view: { lines: 5 },
      recordActivity: false,
    });
    await Bun.sleep(20);
    await plane.write({
      terminalId: created.terminalId,
      text: "changed line\n",
    });
    const changed = await changedPromise;
    expect(changed.outcome).toBe("changed");
    expect(changed.snapshot.lines.join("\n")).toContain("changed line");

    const timeout = await plane.awaitAuthorized({
      terminalId: created.terminalId,
      wait: { until: "match", timeoutMs: 25, idleMs: 0 },
      match: { pattern: "never appears" },
      recordActivity: false,
    });
    expect(timeout.outcome).toBe("timeout");
    expect(timeout.snapshot.lines.join("\n")).toContain("ready line");

    const stoppedPromise = plane.awaitAuthorized({
      terminalId: created.terminalId,
      wait: { until: "match", timeoutMs: 2_000, idleMs: 0 },
      match: { pattern: "still waiting" },
      recordActivity: false,
    });
    await Bun.sleep(20);
    await plane.stop(created.terminalId);
    const stopped = await stoppedPromise;
    expect(stopped.outcome).toBe("stopped");
    expect(stopped.running).toBe(false);

    await plane.dispose();
  });

  test("Scenario: Given terminal await activity controls When await records and then probes silently Then only the explicit observation is persisted", async () => {
    const plane = createPlane();
    plane.setActorPresence("session:owner", true);
    const created = await plane.create({
      terminalId: "await-activity",
      bootstrapActorId: "session:owner",
      bootstrapRole: "admin",
    });

    await plane.write({
      terminalId: created.terminalId,
      actorId: "session:owner",
      text: "await activity line\n",
    });
    await Bun.sleep(120);

    const recorded = await plane.awaitAuthorized({
      terminalId: created.terminalId,
      actorId: "session:owner",
      wait: { until: "match", timeoutMs: 1_000, idleMs: 0 },
      match: { pattern: "await activity" },
    });

    expect(recorded.eventId).toBeDefined();
    expect(recorded.recordedActivity).toBe(true);
    const initialItems = plane.pageEventsAuthorized({
      terminalId: created.terminalId,
      actorId: "session:owner",
      limit: 10,
    }).items;
    expect(initialItems.some((item) => item.payload.title === "Terminal await")).toBe(true);

    await plane.awaitAuthorized({
      terminalId: created.terminalId,
      actorId: "session:owner",
      wait: { until: "match", timeoutMs: 1_000, idleMs: 0 },
      match: { pattern: "await activity" },
      recordActivity: false,
    });
    const afterProbeItems = plane.pageEventsAuthorized({
      terminalId: created.terminalId,
      actorId: "session:owner",
      limit: 10,
    }).items;
    expect(afterProbeItems).toHaveLength(initialItems.length);

    await plane.dispose();
  });

  test("Scenario: Given terminal await cancellation When the abort signal fires Then waiters listeners and timers are released", async () => {
    const plane = createPlane();
    const created = await plane.create({ terminalId: "await-cancel" });
    const managed = plane.getManagedTerminal(created.terminalId);
    if (!managed) {
      throw new Error("expected managed terminal");
    }

    let activeSnapshotListeners = 0;
    let activeStatusListeners = 0;
    let activeCommitWaiters = 0;
    const originalOnSnapshot = managed.onSnapshot.bind(managed);
    const originalOnStatus = managed.onStatus.bind(managed);
    const originalWaitCommitted = managed.waitCommitted.bind(managed);

    managed.onSnapshot = ((listener) => {
      activeSnapshotListeners += 1;
      const release = originalOnSnapshot(listener);
      return () => {
        activeSnapshotListeners -= 1;
        release();
      };
    }) satisfies ManagedTerminal["onSnapshot"];
    managed.onStatus = ((listener) => {
      activeStatusListeners += 1;
      const release = originalOnStatus(listener);
      return () => {
        activeStatusListeners -= 1;
        release();
      };
    }) satisfies ManagedTerminal["onStatus"];
    managed.waitCommitted = ((input) => {
      activeCommitWaiters += 1;
      const handle = originalWaitCommitted(input);
      return {
        promise: handle.promise,
        reject: (reason) => {
          activeCommitWaiters -= 1;
          handle.reject(reason);
        },
      };
    }) satisfies ManagedTerminal["waitCommitted"];

    const abort = new AbortController();
    const waiting = plane.awaitAuthorized({
      terminalId: created.terminalId,
      wait: {
        until: "changed",
        fromHash: plane.getHeadHash(created.terminalId),
        timeoutMs: 5_000,
        idleMs: 0,
      },
      signal: abort.signal,
      recordActivity: false,
    });
    await Bun.sleep(20);
    expect(activeSnapshotListeners).toBe(1);
    expect(activeStatusListeners).toBe(1);
    expect(activeCommitWaiters).toBe(1);

    abort.abort();
    const result = await waiting;

    expect(result.outcome).toBe("cancelled");
    expect(activeSnapshotListeners).toBe(0);
    expect(activeStatusListeners).toBe(0);
    expect(activeCommitWaiters).toBe(0);

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

  test("Scenario: Given two actor seats share one terminal When each consumes terminal diff Then each seat keeps an independent read cursor", async () => {
    const plane = createPlane();
    const owner = "session:owner" as const;
    const reviewer = "session:reviewer" as const;
    plane.setActorPresence(owner, true);
    plane.setActorPresence(reviewer, true);
    const created = await plane.create({
      terminalId: "actor-read-cursor",
      bootstrapActorId: owner,
      bootstrapRole: "admin",
      profile: {
        gitLog: "normal",
      },
    });
    plane.issueGrantAuthorized({
      terminalId: created.terminalId,
      actorId: owner,
      participantId: reviewer,
      role: "readonly",
    });
    const ownerMark = await plane.markDirty(created.terminalId, owner);
    const reviewerMark = await plane.markDirty(created.terminalId, reviewer);

    await plane.write({
      terminalId: created.terminalId,
      actorId: owner,
      text: "cursor-line\n",
    });
    await Bun.sleep(200);

    const ownerRead = await plane.readAuthorized({
      terminalId: created.terminalId,
      actorId: owner,
      mode: "diff",
      remark: true,
      recordActivity: false,
    });
    const reviewerRead = await plane.readAuthorized({
      terminalId: created.terminalId,
      actorId: reviewer,
      mode: "diff",
      remark: true,
      recordActivity: false,
    });

    expect(ownerRead.representation).toBe("diff");
    expect(reviewerRead.representation).toBe("diff");
    expect(ownerRead.diff).toContain("cursor-line");
    expect(reviewerRead.diff).toContain("cursor-line");
    expect(ownerRead.readCursor).toMatchObject({
      readerActorId: owner,
      fromHash: ownerMark.hash,
      consumed: true,
    });
    expect(reviewerRead.readCursor).toMatchObject({
      readerActorId: reviewer,
      fromHash: reviewerMark.hash,
      consumed: true,
    });

    const ownerNext = await plane.readAuthorized({
      terminalId: created.terminalId,
      actorId: owner,
      mode: "diff",
      remark: false,
      recordActivity: false,
    });
    expect(ownerNext.readCursor?.fromHash).toBe(ownerRead.readCursor?.toHash);

    await plane.dispose();
  });

  test("Scenario: Given a seat token reads without remark When it later consumes Then the actor cursor advances only on consumption", async () => {
    const plane = createPlane();
    const owner = "session:owner" as const;
    const reviewer = "session:reviewer" as const;
    plane.setActorPresence(owner, true);
    plane.setActorPresence(reviewer, true);
    const created = await plane.create({
      terminalId: "token-read-cursor",
      bootstrapActorId: owner,
      bootstrapRole: "admin",
      profile: {
        gitLog: "normal",
      },
    });
    const grant = plane.issueGrantAuthorized({
      terminalId: created.terminalId,
      actorId: owner,
      participantId: reviewer,
      role: "readonly",
    });
    const reviewerMark = await plane.markDirty(created.terminalId, reviewer);

    await plane.write({
      terminalId: created.terminalId,
      actorId: owner,
      text: "token-cursor-line\n",
    });
    await Bun.sleep(200);

    const inspection = await plane.readAuthorized({
      terminalId: created.terminalId,
      accessToken: grant.accessToken,
      mode: "diff",
      remark: false,
      recordActivity: false,
    });
    expect(inspection.representation).toBe("diff");
    expect(inspection.diff).toContain("token-cursor-line");
    expect(inspection.readCursor).toMatchObject({
      readerActorId: reviewer,
      fromHash: reviewerMark.hash,
      consumed: false,
    });

    const consumed = await plane.readAuthorized({
      terminalId: created.terminalId,
      accessToken: grant.accessToken,
      mode: "diff",
      remark: true,
      recordActivity: false,
    });
    expect(consumed.representation).toBe("diff");
    expect(consumed.diff).toContain("token-cursor-line");
    expect(consumed.readCursor).toMatchObject({
      readerActorId: reviewer,
      fromHash: reviewerMark.hash,
      consumed: true,
    });

    const next = await plane.readAuthorized({
      terminalId: created.terminalId,
      accessToken: grant.accessToken,
      mode: "diff",
      remark: false,
      recordActivity: false,
    });
    expect(next.readCursor?.fromHash).toBe(consumed.readCursor?.toHash);

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

  test("Scenario: Given durable config inspection and mutation When geometry and launch truth change Then live fields apply now and launch fields apply on next bootstrap", async () => {
    const plane = createPlane();
    plane.setActorPresence("session:owner", true);
    const nextCwd = mkdtempSync(join(tmpdir(), "ati-control-plane-next-cwd-"));
    workspaces.push(nextCwd);
    const created = await plane.create({
      terminalId: "config-surface",
      bootstrapActorId: "session:owner",
      bootstrapRole: "admin",
    });

    const initialConfig = plane.getTerminalConfigAuthorized({
      terminalId: created.terminalId,
      actorId: "session:owner",
    });
    expect(initialConfig.processPhase).toBe("running");
    expect(initialConfig.launchCwd).toBe(created.launchCwd);
    expect(Object.prototype.hasOwnProperty.call(initialConfig, "currentPath")).toBe(false);

    const mutation = plane.setTerminalConfigAuthorized({
      terminalId: created.terminalId,
      actorId: "session:owner",
      command: ["sh", "-lc", "pwd; cat"],
      launchCwd: nextCwd,
      cols: 100,
      rows: 28,
      title: "Ops shell",
      metadata: {
        owner: "ops",
      },
    });

    expect(mutation.appliedLiveFields).toEqual(expect.arrayContaining(["cols", "rows"]));
    expect(mutation.nextBootstrapFields).toEqual(expect.arrayContaining(["command", "launchCwd"]));
    expect(mutation.config.profile.title).toBe("Ops shell");
    expect(mutation.config.metadata).toEqual({ owner: "ops" });

    const liveRead = await plane.write({
      terminalId: created.terminalId,
      text: "geometry refresh\n",
      actorId: "session:owner",
      returnRead: {
        debounceMs: 120,
      },
      readMode: "snapshot",
    });
    expect(liveRead.ok).toBe(true);
    expect(liveRead.read?.snapshot?.cols).toBe(100);
    expect(liveRead.read?.snapshot?.rows).toBe(28);

    await plane.stopAuthorized({
      terminalId: created.terminalId,
      actorId: "session:owner",
    });
    plane.bootstrapAuthorized({
      terminalId: created.terminalId,
      actorId: "session:owner",
    });
    await Bun.sleep(120);
    const restarted = await plane.snapshot(created.terminalId);
    expect(restarted.snapshot?.lines.join("\n")).toContain(nextCwd);

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
      const frame = decodeServerFrame(event.data);
      if (frame) {
        messages.push(frame);
      }
    });

    await opened;
    socket.send(encodeClientFrame({ type: "inputBytes", data: new TextEncoder().encode("hello transport\n") }));
    await Bun.sleep(150);

    expect(messages.some((message) => message.type === "snapshot")).toBe(true);
    expect(messages.some((message) => outputIncludes(message, "hello transport"))).toBe(true);

    const closed = new Promise<void>((resolve) => {
      socket.addEventListener("close", () => resolve(), { once: true });
    });
    await plane.stop(created.terminalId);
    await closed;
    expect(plane.getTransportEndpoint(created.terminalId)).not.toBeNull();
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
      const frame = decodeServerFrame(event.data);
      if (frame) {
        messages.push(frame);
      }
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
    expect(messages.some((message) => outputIncludes(message, "snapshot after connect"))).toBe(true);

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

  test("Scenario: Given a legacy terminal catalog still keeps cwd When a new terminal is created and updated Then launch_cwd and cwd stay aligned without insert failures", async () => {
    const outputRoot = mkdtempSync(join(tmpdir(), "ati-control-plane-"));
    workspaces.push(outputRoot);
    const dbPath = join(outputRoot, "terminal.db");
    const seed = new Database(dbPath);
    try {
      seed.exec(`
        create table terminal_catalog (
          terminal_id text primary key,
          process_kind text not null,
          command_json text not null,
          cwd text not null,
          profile_json text,
          metadata_json text,
          created_at integer not null,
          updated_at integer not null,
          removed_at integer
        );
      `);
    } finally {
      seed.close();
    }

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

    const created = await plane.create({
      terminalId: "legacy-cwd-create",
      cwd: outputRoot,
      start: false,
    });
    expect(created.launchCwd).toBe(resolve(outputRoot));

    plane.setTerminalConfigAuthorized({
      terminalId: created.terminalId,
      launchCwd: resolve(outputRoot, "next"),
      superadminActorId: "system:test",
    });

    const db = new Database(dbPath, { readonly: true });
    try {
      const row = db
        .query(`select cwd, launch_cwd from terminal_catalog where terminal_id = ?`)
        .get(created.terminalId) as { cwd: string; launch_cwd: string } | null;
      expect(row).not.toBeNull();
      expect(row?.cwd).toBe(resolve(outputRoot, "next"));
      expect(row?.launch_cwd).toBe(resolve(outputRoot, "next"));
    } finally {
      db.close();
      await plane.dispose();
    }
  });

  test("Scenario: Given requester transport input When no lease exists Then websocket input is rejected until an admin approves a write lease through the durable path", async () => {
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
      const frame = decodeServerFrame(event.data);
      if (frame) {
        messages.push(frame);
      }
    });
    await opened;

    socket.send(encodeClientFrame({ type: "inputBytes", data: new TextEncoder().encode("blocked transport\n") }));
    await Bun.sleep(120);
    expect(messages.some((message) => message.type === "error" && message.message.includes("approval"))).toBe(true);
    expect(
      plane.listApprovalRequests({
        terminalId: created.terminalId,
        participantId: "session:requester",
      }),
    ).toHaveLength(0);

    const writePending = await plane.write({
      terminalId: created.terminalId,
      text: "lease me",
      actorId: "session:requester",
      accessToken: requester.accessToken,
    });
    const pending = writePending.approvalRequest;
    if (!pending) {
      throw new Error("expected pending durable approval request");
    }
    plane.approveRequestAuthorized({
      terminalId: created.terminalId,
      requestId: pending.requestId,
      durationMs: 60_000,
      actorId: "session:admin",
    });

    socket.send(encodeClientFrame({ type: "inputBytes", data: new TextEncoder().encode("allowed transport\n") }));
    await Bun.sleep(150);
    expect(messages.some((message) => outputIncludes(message, "allowed transport"))).toBe(true);

    socket.close();
    plane.stopTransport();
    await plane.dispose();
  });

  test("Scenario: Given an actor-created terminal When a superadmin lists the catalog Then trusted live transport access is projected even without a preexisting bootstrap grant", async () => {
    const plane = createPlane();
    plane.setActorPresence("session:owner", true);
    const created = await plane.create({
      terminalId: "superadmin-live-access",
      bootstrapActorId: "session:owner",
      bootstrapRole: "admin",
    });
    await plane.startTransport({ port: 0 });

    expect(created.access?.participantId).toBe("session:owner");

    const listed = plane.listForTrustedBootstrap().find((entry) => entry.terminalId === created.terminalId);
    expect(listed).toBeDefined();
    expect(listed?.access?.participantId).toBe("system:trusted-terminal-bootstrap");
    expect(listed?.access?.role).toBe("admin");
    expect(listed?.transportUrl ?? "").toContain(`/pty/${created.terminalId}?token=`);

    const endpoint = plane.getTransportEndpoint(created.terminalId);
    expect(endpoint?.url).toContain(`/pty/${created.terminalId}?token=`);

    await plane.dispose();
  });

  test("Scenario: Given interactive transport live input bytes When the client types Then bytes reach the PTY without pending-file or activity truth", async () => {
    const plane = createPlane();
    plane.setActorPresence("session:admin", true);
    const created = await plane.create({
      terminalId: "transport-raw-input",
      bootstrapActorId: "session:admin",
      bootstrapRole: "admin",
    });
    const transport = await plane.startTransport({ port: 0 });
    const endpoint = plane.getTransportEndpoint(created.terminalId, created.access?.accessToken);

    expect(transport.port).not.toBeNull();
    const socket = new WebSocket(endpoint!.url);
    const messages: TerminalTransportServerMessage[] = [];
    const opened = new Promise<void>((resolve, reject) => {
      socket.addEventListener("open", () => resolve(), { once: true });
      socket.addEventListener("error", () => reject(new Error("websocket-open-failed")), { once: true });
    });
    socket.addEventListener("message", (event) => {
      const frame = decodeServerFrame(event.data);
      if (frame) {
        messages.push(frame);
      }
    });
    await opened;

    const workspace = plane.getManagedTerminal(created.terminalId)?.getWorkspace();
    if (!workspace) {
      throw new Error("expected terminal workspace");
    }
    const pendingDir = join(workspace, "input", "pending");

    socket.send(encodeClientFrame({ type: "inputBytes", data: new TextEncoder().encode("typed raw transport\n") }));
    await Bun.sleep(150);

    expect(messages.some((message) => outputIncludes(message, "typed raw transport"))).toBe(true);
    expect(readdirSync(pendingDir)).toHaveLength(0);
    expect(
      plane.pageEventsAuthorized({
        terminalId: created.terminalId,
        actorId: "session:admin",
        limit: 10,
      }).items,
    ).toHaveLength(0);

    socket.close();
    plane.stopTransport();
    await plane.dispose();
  });

  test("Scenario: Given requester transport live input bytes When no write lease exists Then the client receives an error without creating approval work", async () => {
    const plane = createPlane();
    plane.setActorPresence("session:admin", true);
    const created = await plane.create({
      terminalId: "transport-raw-acl",
      bootstrapActorId: "session:admin",
      bootstrapRole: "admin",
    });
    const requester = plane.issueGrantAuthorized({
      terminalId: created.terminalId,
      actorId: "session:admin",
      participantId: "session:requester",
      role: "requester",
    });
    await plane.startTransport({ port: 0 });
    const endpoint = plane.getTransportEndpoint(created.terminalId, requester.accessToken);
    const socket = new WebSocket(endpoint!.url);
    const messages: TerminalTransportServerMessage[] = [];
    const opened = new Promise<void>((resolve, reject) => {
      socket.addEventListener("open", () => resolve(), { once: true });
      socket.addEventListener("error", () => reject(new Error("websocket-open-failed")), { once: true });
    });
    socket.addEventListener("message", (event) => {
      const frame = decodeServerFrame(event.data);
      if (frame) {
        messages.push(frame);
      }
    });
    await opened;

    socket.send(encodeClientFrame({ type: "inputBytes", data: new TextEncoder().encode("blocked raw transport\n") }));
    await Bun.sleep(120);

    expect(messages.some((message) => message.type === "error" && message.message.includes("approval"))).toBe(true);
    expect(
      plane.listApprovalRequests({
        terminalId: created.terminalId,
        participantId: "session:requester",
      }),
    ).toHaveLength(0);

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

  test("Scenario: Given a pending terminal RW invitation When the invited principal accepts Then the seat activates and later config and revoke remain unilateral", async () => {
    const plane = createPlane();
    const admin = generatePrincipalKeyPair();
    const invitee = generatePrincipalKeyPair();
    plane.setActorPresence(admin.principalId, true);
    plane.setActorPresence(invitee.principalId, true);
    const created = await plane.create({
      terminalId: "managed-seat-rw",
      bootstrapActorId: admin.principalId,
      bootstrapRole: "admin",
    });

    const invitation = plane.inviteSeatAuthorized({
      terminalId: created.terminalId,
      actorId: admin.principalId,
      participantId: invitee.principalId,
      seatClass: "RW",
      label: "Writer seat",
    });

    expect(plane.listForActor(invitee.principalId, { touchPresence: false })).toHaveLength(0);

    const accepted = await plane.acceptSeat({
      descriptor: invitation.descriptor.httpUrl ?? invitation.descriptor.deepLink,
      proof: await signManagedInvitationAcceptProof({
        privateKey: invitee.privateKey,
        payload: {
          invitationId: invitation.invitationId,
          resourceKind: invitation.resourceKind,
          resourceId: invitation.resourceId,
          inviteePrincipalId: invitee.principalId,
          payloadDigest: invitation.payloadDigest,
          expiresAt: invitation.expiresAt,
        },
      }),
    });

    expect(accepted.invitation.status).toBe("accepted");
    expect(accepted.access.role).toBe("writer");
    expect(accepted.seat).toMatchObject({
      actorId: invitee.principalId,
      role: "writer",
      label: "Writer seat",
    });
    expect(
      plane
        .listForActor(invitee.principalId, { touchPresence: false })[0]
        ?.actors?.find((actor) => actor.actorId === invitee.principalId),
    ).toMatchObject({
      actorId: invitee.principalId,
      role: "writer",
      label: "Writer seat",
    });

    const reconfigured = plane.configSeatAuthorized({
      terminalId: created.terminalId,
      actorId: admin.principalId,
      participantId: invitee.principalId,
      seatClass: "RO",
      label: "Readonly seat",
    });

    expect("role" in reconfigured ? reconfigured.role : null).toBe("readonly");
    expect(
      plane
        .listForActor(invitee.principalId, { touchPresence: false })[0]
        ?.actors?.find((actor) => actor.actorId === invitee.principalId),
    ).toMatchObject({
      actorId: invitee.principalId,
      role: "readonly",
      label: "Readonly seat",
    });

    const deniedWrite = await plane.write({
      terminalId: created.terminalId,
      actorId: invitee.principalId,
      text: "echo blocked\r",
      createApprovalRequest: false,
    });
    expect(deniedWrite).toMatchObject({
      ok: false,
      message: expect.stringMatching(/readonly|requires approval/u),
    });

    expect(
      plane.revokeSeatAuthorized({
        terminalId: created.terminalId,
        actorId: admin.principalId,
        participantId: invitee.principalId,
      }),
    ).toEqual({ ok: true });
    expect(plane.listForActor(invitee.principalId, { touchPresence: false })).toHaveLength(0);
    await expect(
      plane.write({
        terminalId: created.terminalId,
        actorId: invitee.principalId,
        text: "echo gone\r",
        createApprovalRequest: false,
      }),
    ).rejects.toThrow(`terminal access denied for actor: ${invitee.principalId}`);

    await plane.dispose();
  });

  test("Scenario: Given a terminal TM invitation When the invited principal accepts Then terminal-native admin-candidate truth is materialized", async () => {
    const plane = createPlane();
    const admin = generatePrincipalKeyPair();
    const manager = generatePrincipalKeyPair();
    plane.setActorPresence(admin.principalId, true);
    plane.setActorPresence(manager.principalId, true);
    const created = await plane.create({
      terminalId: "managed-seat-tm",
      bootstrapActorId: admin.principalId,
      bootstrapRole: "admin",
    });

    const invitation = plane.inviteSeatAuthorized({
      terminalId: created.terminalId,
      actorId: admin.principalId,
      participantId: manager.principalId,
      seatClass: "TM",
      label: "Terminal manager",
    });

    const accepted = await plane.acceptSeat({
      descriptor: invitation.descriptor.deepLink,
      proof: await signManagedInvitationAcceptProof({
        privateKey: manager.privateKey,
        payload: {
          invitationId: invitation.invitationId,
          resourceKind: invitation.resourceKind,
          resourceId: invitation.resourceId,
          inviteePrincipalId: manager.principalId,
          payloadDigest: invitation.payloadDigest,
          expiresAt: invitation.expiresAt,
        },
      }),
    });

    expect(accepted.access.role).toBe("admin");
    expect(accepted.seat).toMatchObject({
      actorId: manager.principalId,
      role: "admin",
      label: "Terminal manager",
      adminCandidateRank: expect.any(Number),
    });
    expect(
      plane
        .listForActor(admin.principalId, { touchPresence: false })[0]
        ?.actors?.find((actor) => actor.actorId === manager.principalId),
    ).toMatchObject({
      actorId: manager.principalId,
      role: "admin",
      label: "Terminal manager",
      adminCandidateRank: expect.any(Number),
    });

    await plane.dispose();
  });
});
