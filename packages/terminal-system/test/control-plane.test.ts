import { Database } from "bun:sqlite";
import { createHash, randomUUID } from "node:crypto";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { signManagedInvitationAcceptProof } from "@agenter/managed-seat-invitation-handshake";
import { generatePrincipalKeyPair } from "@agenter/principal-crypto";
import {
  applyTerminalFramePatch,
  createTerminalTransportClientSession,
  createTerminalTransportRowCacheDecoder,
  decodeTerminalTransportServerMessage,
  encodeTerminalTransportClientMessage,
  getTerminalTransportDirectRegistry,
  type TerminalTransportClientMessage,
  type TerminalTransportFramePayload,
  type TerminalTransportRowCacheDecoder,
} from "@agenter/terminal-transport-protocol";
import { afterEach, describe, expect, test } from "bun:test";

import {
  chooseTerminalFramePatch,
  DEFAULT_TERMINAL_BACKEND,
  projectTerminalSnapshotFramePayload,
  TerminalControlPlane,
  type ManagedTerminalSnapshot,
  type TerminalRuntime,
  type TerminalTransportServerMessage,
} from "../src";
import { TerminalDb } from "../src/terminal-db";

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

const seedRunningTerminalRecord = (input: { outputRoot: string; terminalId: string; stoppedAt?: number }): void => {
  const db = new TerminalDb(join(input.outputRoot, "terminal.db"));
  db.createTerminal({
    terminalId: input.terminalId,
    processKind: "shell",
    backend: DEFAULT_TERMINAL_BACKEND,
    command: ["sh", "-lc", "cat"],
    launchCwd: input.outputRoot,
    profile: {},
    metadata: {},
    processPhase: "running",
    lastStopReason: null,
    lastExitCode: null,
    lastExitSignal: null,
    lastStoppedAt: input.stoppedAt ?? null,
    archivedAt: null,
  });
  db.close();
};

const seedTerminalGrant = (input: {
  outputRoot: string;
  terminalId: string;
  participantId: string;
  role: "admin" | "writer" | "guard" | "readonly";
  accessToken?: string;
}): string => {
  const accessToken = input.accessToken ?? `test-token-${randomUUID().replaceAll("-", "")}`;
  const db = new Database(join(input.outputRoot, "terminal.db"), { create: true, strict: true });
  db.query(
    `insert into terminal_grant (
      grant_id, terminal_id, role, label, participant_id, access_token, token_hash, created_at, revoked_at
    ) values (?, ?, ?, null, ?, ?, ?, ?, null)`,
  ).run(
    `term-grant-${randomUUID()}`,
    input.terminalId,
    input.role,
    input.participantId,
    accessToken,
    createHash("sha256").update(accessToken).digest("hex"),
    Date.now(),
  );
  db.close();
  return accessToken;
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

const rowCacheDecodersBySocket = new WeakMap<WebSocket, TerminalTransportRowCacheDecoder>();

const resolveRowCacheDecoder = (
  socket: WebSocket,
  decoder?: TerminalTransportRowCacheDecoder,
): TerminalTransportRowCacheDecoder => {
  if (decoder) {
    return decoder;
  }
  const existing = rowCacheDecodersBySocket.get(socket);
  if (existing) {
    return existing;
  }
  const next = createTerminalTransportRowCacheDecoder();
  rowCacheDecodersBySocket.set(socket, next);
  return next;
};

const pullLatestFrame = async (input: {
  socket: WebSocket;
  messages: TerminalTransportServerMessage[];
  lastFrame: TerminalTransportFramePayload | null;
  rowCacheDecoder?: TerminalTransportRowCacheDecoder;
  cols?: number;
  rows?: number;
}): Promise<TerminalTransportFramePayload> => {
  const messageStart = input.messages.length;
  input.socket.send(
    encodeClientFrame({
      type: "pullFrame",
      lastAppliedFrameSeq: input.lastFrame?.seq ?? 0,
      cols: input.cols ?? input.lastFrame?.cols ?? 80,
      rows: input.rows ?? input.lastFrame?.rows ?? 20,
    }),
  );
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await Bun.sleep(20);
    const frameMessage = input.messages
      .slice(messageStart)
      .findLast(
        (message): message is Extract<TerminalTransportServerMessage, { type: "frame" }> => message.type === "frame",
      );
    if (!frameMessage) {
      continue;
    }
    const frame = applyTerminalFramePatch(
      input.lastFrame,
      frameMessage.patch,
      frameMessage.frameSeq,
      resolveRowCacheDecoder(input.socket, input.rowCacheDecoder),
    );
    if (!frame) {
      throw new Error("terminal frame patch did not apply");
    }
    return frame;
  }
  throw new Error("timed out waiting for terminal frame");
};

const waitForServerTrace = async <T extends Extract<TerminalTransportServerMessage, { type: "trace" }>>(
  messages: TerminalTransportServerMessage[],
  predicate: (message: Extract<TerminalTransportServerMessage, { type: "trace" }>) => message is T,
): Promise<T> => {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const trace = messages.findLast((message): message is T => message.type === "trace" && predicate(message));
    if (trace) {
      return trace;
    }
    await Bun.sleep(25);
  }
  throw new Error("timed out waiting for terminal trace");
};

const createSnapshotForFrameProjection = (input: {
  lineCount: number;
  rows: number;
  viewportOffset: number;
  cursorY: number;
  mouseTracking?: NonNullable<ManagedTerminalSnapshot["interaction"]>["mouseTracking"];
}): ManagedTerminalSnapshot => ({
  seq: 7,
  timestamp: 10,
  cols: 80,
  rows: input.rows,
  lines: Array.from({ length: input.lineCount }, (_, index) => `line-${index}`),
  richLines: Array.from({ length: input.lineCount }, (_, index) => ({
    spans: [{ text: `line-${index}` }],
  })),
  cursor: {
    x: 3,
    y: input.cursorY,
    visible: true,
  },
  scrollback: {
    viewportOffset: input.viewportOffset,
    totalLines: input.lineCount,
    screenLines: input.rows,
  },
  interaction: input.mouseTracking
    ? {
        mouseTracking: input.mouseTracking,
      }
    : undefined,
});

const listInvitations = (plane: TerminalControlPlane, terminalId: string) => {
  const db = Reflect.get(plane, "db") as {
    listInvitations: (
      terminalId: string,
      input?: { statuses?: Array<"pending" | "accepted" | "revoked" | "expired"> },
    ) => Array<{
      invitationId: string;
      status: "pending" | "accepted" | "revoked" | "expired";
      supersededByInvitationId?: string | null;
      expiresAt: number;
    }>;
  };
  return db.listInvitations(terminalId);
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
  test("Scenario: Given a large terminal scrollback When projecting a transport frame Then the frame carries only the requested viewport rows and local cursor coordinates", () => {
    const snapshot = createSnapshotForFrameProjection({
      lineCount: 200,
      rows: 20,
      viewportOffset: 150,
      cursorY: 169,
    });

    const frame = projectTerminalSnapshotFramePayload(snapshot, {
      cols: 80,
      rows: 20,
      viewportStart: 150,
    });

    expect(frame.lines).toHaveLength(20);
    expect(frame.richLines).toHaveLength(20);
    expect(frame.lines[0]).toBe("line-150");
    expect(frame.lines[19]).toBe("line-169");
    expect(frame.scrollback).toEqual({
      viewportOffset: 150,
      totalLines: 200,
      screenLines: 20,
    });
    expect(frame.cursor).toEqual({
      x: 3,
      y: 19,
      absY: 169,
      visible: true,
    });
  });

  test("Scenario: Given a composed terminal snapshot already carries one viewport canvas When projecting a transport frame Then viewport metadata cannot slice the canvas blank", () => {
    const lines = Array.from({ length: 12 }, (_, index) => (index === 11 ? "bottom status" : `canvas-${index}`));
    const snapshot: ManagedTerminalSnapshot = {
      seq: 4,
      timestamp: 4,
      cols: 80,
      rows: 12,
      lines,
      richLines: lines.map((line) => ({
        spans: line.length > 0 ? [{ text: line }] : [],
      })),
      cursor: {
        x: 6,
        y: 11,
        visible: true,
      },
      scrollback: {
        viewportOffset: 30,
        totalLines: 40,
        screenLines: 12,
      },
    };

    const frame = projectTerminalSnapshotFramePayload(snapshot, {
      cols: 80,
      rows: 12,
      viewportStart: 30,
    });

    expect(frame.lines).toHaveLength(12);
    expect(frame.lines[0]).toBe("canvas-0");
    expect(frame.lines[11]).toBe("bottom status");
    expect(frame.cursor).toEqual({
      x: 6,
      y: 0,
      absY: 11,
      visible: false,
    });
    expect(frame.scrollback).toEqual({
      viewportOffset: 30,
      totalLines: 42,
      screenLines: 12,
    });
  });

  test("Scenario: Given backend selection is anchored to a scrollback row When projecting a scrolled viewport Then overlay rows stay absolute", () => {
    const lines = Array.from({ length: 10 }, (_, index) => `line-${index}`);
    const snapshot: ManagedTerminalSnapshot = {
      seq: 5,
      timestamp: 5,
      cols: 20,
      rows: 4,
      lines,
      richLines: lines.map((line) => ({ spans: [{ text: line }] })),
      cursor: { x: 0, y: 5, visible: true },
      scrollback: {
        viewportOffset: 0,
        totalLines: lines.length,
        screenLines: 4,
      },
      interaction: {
        activeOwnerId: "terminal",
        selectionOverlays: [
          {
            ownerId: "terminal",
            ownership: "backend-native",
            rows: [{ row: 5, startCol: 10, endCol: 12 }],
            selectedText: "ne",
          },
        ],
      },
    };

    const frame = projectTerminalSnapshotFramePayload(snapshot, {
      cols: 20,
      rows: 4,
      viewportStart: 2,
    });

    expect(frame.lines).toEqual(["line-2", "line-3", "line-4", "line-5"]);
    expect(frame.interaction?.selectionOverlays?.[0]?.rows).toEqual([{ row: 5, startCol: 10, endCol: 12 }]);
  });

  test("Scenario: Given backend mouse tracking is active When projecting a scrolled transport frame Then selection and mouse truth both survive projection", () => {
    const snapshot = createSnapshotForFrameProjection({
      lineCount: 12,
      rows: 4,
      viewportOffset: 2,
      cursorY: 5,
      mouseTracking: { protocol: "drag", encoding: "sgr" },
    });
    snapshot.interaction = {
      ...snapshot.interaction,
      activeOwnerId: "terminal",
      selectionOverlays: [
        {
          ownerId: "terminal",
          ownership: "backend-native",
          rows: [{ row: 5, startCol: 0, endCol: 6 }],
          selectedText: "line-5",
        },
      ],
    };

    const frame = projectTerminalSnapshotFramePayload(snapshot, {
      cols: 80,
      rows: 4,
      viewportStart: 4,
    });

    expect(frame.lines).toEqual(["line-4", "line-5", "line-6", "line-7"]);
    expect(frame.interaction?.mouseTracking).toEqual({ protocol: "drag", encoding: "sgr" });
    expect(frame.interaction?.selectionOverlays?.[0]?.rows).toEqual([{ row: 5, startCol: 0, endCol: 6 }]);
  });

  test("Scenario: Given a rows frame patch contains only selection truth changes When encoded as rows patch Then interaction state is preserved", () => {
    const baseFrame: TerminalTransportFramePayload = {
      seq: 1,
      timestamp: 1,
      cols: 20,
      rows: 2,
      lines: ["row-0", "row-1"],
      richLines: [{ spans: [{ text: "row-0" }] }, { spans: [{ text: "row-1" }] }],
      cursor: { x: 0, y: 0, visible: true },
      scrollback: { viewportOffset: 0, totalLines: 2, screenLines: 2 },
    };
    const currentFrame: TerminalTransportFramePayload = {
      ...baseFrame,
      seq: 2,
      interaction: {
        activeOwnerId: "terminal",
        selectionOverlays: [
          {
            ownerId: "terminal",
            ownership: "backend-native",
            rows: [{ row: 1, startCol: 0, endCol: 5 }],
            selectedText: "row-1",
          },
        ],
      },
    };

    const patch = chooseTerminalFramePatch({
      baseFrame,
      currentFrame,
      lastAppliedFrameSeq: baseFrame.seq,
    });

    expect(patch.type).toBe("rows");
    if (patch.type !== "rows") {
      throw new Error("expected rows patch");
    }
    expect(patch.interaction?.selectionOverlays?.[0]).toMatchObject({
      ownerId: "terminal",
      rows: [{ row: 1, startCol: 0, endCol: 5 }],
    });
  });

  test("Scenario: Given a scrollRows frame patch also changes selection truth When encoded as scrollRows patch Then interaction state is preserved", () => {
    const baseFrame: TerminalTransportFramePayload = {
      seq: 10,
      timestamp: 10,
      cols: 20,
      rows: 3,
      lines: ["row-0", "row-1", "row-2"],
      richLines: [{ spans: [{ text: "row-0" }] }, { spans: [{ text: "row-1" }] }, { spans: [{ text: "row-2" }] }],
      cursor: { x: 0, y: 2, visible: true },
      scrollback: { viewportOffset: 0, totalLines: 3, screenLines: 3 },
    };
    const currentFrame: TerminalTransportFramePayload = {
      ...baseFrame,
      seq: 11,
      lines: ["row-1", "row-2", "row-3"],
      richLines: [{ spans: [{ text: "row-1" }] }, { spans: [{ text: "row-2" }] }, { spans: [{ text: "row-3" }] }],
      interaction: {
        activeOwnerId: "terminal",
        selectionOverlays: [
          {
            ownerId: "terminal",
            ownership: "backend-native",
            rows: [{ row: 2, startCol: 0, endCol: 5 }],
            selectedText: "row-2",
          },
        ],
      },
    };

    const patch = chooseTerminalFramePatch({
      baseFrame,
      currentFrame,
      lastAppliedFrameSeq: baseFrame.seq,
    });

    expect(patch.type).toBe("scrollRows");
    if (patch.type !== "scrollRows") {
      throw new Error("expected scrollRows patch");
    }
    expect(patch.interaction?.selectionOverlays?.[0]).toMatchObject({
      ownerId: "terminal",
      rows: [{ row: 2, startCol: 0, endCol: 5 }],
    });
  });

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
      plane.focusAuthorized("remove", [{ terminalId: left.terminalId, accessToken: reviewerLeft.accessToken }]),
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
          item.reason === "transition" && item.processPhase === "running" && item.lifecycleTransition === "killing",
      ),
    ).toBe(true);
    expect(plane.list().find((item) => item.terminalId === created.terminalId)?.lifecycleTransition).toBeUndefined();
    const historyEntry = plane.listHistory().find((item) => item.terminalId === created.terminalId);
    expect(historyEntry?.processPhase).toBe("killed");
    expect(historyEntry?.lifecycleTransition).toBeNull();

    await plane.dispose();
  });

  test("Scenario: Given live and killed terminal instances When listing the index Then live records stay in front and killed records sort by stop time descending", async () => {
    const plane = createPlane();
    const liveOlder = await plane.create({ terminalId: "index-live-older" });
    await Bun.sleep(5);
    const liveNewer = await plane.create({ terminalId: "index-live-newer" });
    const killedOlder = await plane.create({ terminalId: "index-killed-older" });
    await Bun.sleep(5);
    await plane.stop(killedOlder.terminalId);
    await Bun.sleep(5);
    const killedNewer = await plane.create({ terminalId: "index-killed-newer" });
    await Bun.sleep(5);
    await plane.stop(killedNewer.terminalId);

    const index = plane.listIndex();
    const history = plane.listHistory();

    expect(index.map((entry) => entry.terminalId)).toEqual([
      liveNewer.terminalId,
      liveOlder.terminalId,
      killedNewer.terminalId,
      killedOlder.terminalId,
    ]);
    expect(history.map((entry) => entry.terminalId)).toEqual([killedNewer.terminalId, killedOlder.terminalId]);
    expect(index.slice(0, 2).every((entry) => entry.processPhase !== "killed")).toBe(true);
    expect(index.slice(2).every((entry) => entry.processPhase === "killed")).toBe(true);
    expect(history.every((entry) => entry.processPhase === "killed")).toBe(true);

    await plane.dispose();
  });

  test("Scenario: Given daemon cold-start finds a stale running terminal When recovery is replayed after observers bind Then killed lifecycle leaves live projection", async () => {
    const outputRoot = mkdtempSync(join(tmpdir(), "ati-control-plane-recovery-"));
    workspaces.push(outputRoot);
    seedRunningTerminalRecord({
      outputRoot,
      terminalId: "daemon-recovered",
    });
    const plane = new TerminalControlPlane({
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
    const observed: Array<{
      reason: string;
      processPhase: string | undefined;
    }> = [];
    plane.onChanged(({ terminalId, reason }) => {
      if (terminalId !== "daemon-recovered") {
        return;
      }
      observed.push({
        reason,
        processPhase: plane.listIndex().find((entry) => entry.terminalId === terminalId)?.processPhase,
      });
    });

    const recovered = plane.replayRecoveredLifecycle();
    const replayAgain = plane.replayRecoveredLifecycle();

    expect(recovered.map((entry) => entry.terminalId)).toEqual(["daemon-recovered"]);
    expect(replayAgain).toEqual([]);
    expect(plane.list().find((entry) => entry.terminalId === "daemon-recovered")).toBeUndefined();
    expect(plane.listHistory().find((entry) => entry.terminalId === "daemon-recovered")?.processPhase).toBe("killed");
    expect(observed).toEqual([
      {
        reason: "lifecycle",
        processPhase: "killed",
      },
    ]);

    await plane.dispose();
  });

  test("Scenario: Given daemon recovery kills a focused terminal When lifecycle replay runs Then actor focus is cleaned with one lifecycle consequence", async () => {
    const outputRoot = mkdtempSync(join(tmpdir(), "ati-control-plane-recovery-focus-"));
    workspaces.push(outputRoot);
    const actorId = "session:daemon-owner";
    seedRunningTerminalRecord({
      outputRoot,
      terminalId: "daemon-focused",
    });
    const accessToken = seedTerminalGrant({
      outputRoot,
      terminalId: "daemon-focused",
      participantId: actorId,
      role: "admin",
    });
    const plane = new TerminalControlPlane({
      dbPath: join(outputRoot, "terminal.db"),
      outputRoot,
      defaultShellCommand: ["sh", "-lc", "cat"],
      initialConfig: {
        transport: {
          port: null,
        },
      },
    });
    const focusEvents: string[][] = [];
    const changeReasons: string[] = [];
    plane.onFocus((event) => {
      if (event.actorId === actorId) {
        focusEvents.push(event.terminalIds);
      }
    });
    plane.onChanged(({ terminalId, reason }) => {
      if (terminalId === "daemon-focused") {
        changeReasons.push(reason);
      }
    });

    expect(plane.focusAuthorized("replace", [{ terminalId: "daemon-focused", accessToken }])).toEqual([
      "daemon-focused",
    ]);
    expect(plane.getFocusedTerminalIds(actorId)).toEqual(["daemon-focused"]);

    plane.replayRecoveredLifecycle();

    expect(plane.getFocusedTerminalIds(actorId)).toEqual([]);
    expect(focusEvents.at(-1)).toEqual([]);
    expect(changeReasons.filter((reason) => reason === "lifecycle")).toHaveLength(1);
    expect(changeReasons).not.toContain("updated");

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
    expect(() => plane.bootstrap({ terminalId: created.terminalId })).toThrow("already killing");

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

  test(
    "Scenario: Given a default shell terminal When mixed input submits a command Then the control plane observes executed output instead of a stuck echoed line",
    async () => {
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
      const matched = await plane.awaitAuthorized({
        terminalId: created.terminalId,
        wait: { until: "match", timeoutMs: 10_000, idleMs: 0 },
        match: { pattern: "__AGT_EXEC__=ok", contextLines: 1 },
        recordActivity: false,
      });
      expect(matched.outcome).toBe("matched");
      expect(matched.snapshot.lines.join("\n")).toContain("__AGT_EXEC__=ok");

      await plane.dispose();
    },
    { timeout: 16_000 },
  );

  test("Scenario: Given a projection terminal metadata source When the source terminal changes Then the projection terminal reuses the same snapshot and live output truth", async () => {
    const plane = createPlane();
    const source = await plane.create({ terminalId: "shell-1:terminal-1" });
    const projection = await plane.create({
      terminalId: "shell-1:terminal-2",
      metadata: {
        projectionSourceTerminalId: source.terminalId,
      },
    });

    const sourceRuntime = plane.getManagedTerminal(source.terminalId);
    const projectionRuntime = plane.getManagedTerminal(projection.terminalId);
    if (!sourceRuntime || !projectionRuntime) {
      throw new Error("expected source and projection runtimes");
    }

    await sourceRuntime.write("echo projection\n");
    await Bun.sleep(200);

    const sourceSnapshot = sourceRuntime.getSnapshot();
    const projectionSnapshot = projectionRuntime.getSnapshot();
    expect(projectionSnapshot.lines).toEqual(sourceSnapshot.lines);
    expect(projectionSnapshot.scrollback.viewportOffset).toBe(sourceSnapshot.scrollback.viewportOffset);
    expect(projectionRuntime.getStatus()).toBe(sourceRuntime.getStatus());

    await plane.dispose();
  });

  test("Scenario: Given a composed terminal-2 runtime When shell truth changes and backend later publishes product surface Then terminal-2 changes only through the composed runtime publication seam", async () => {
    const plane = createPlane();
    const source = await plane.create({ terminalId: "shell-1:terminal-1" });
    const composed = await plane.create({
      terminalId: "shell-1:terminal-2",
      metadata: {
        terminalRuntimeKind: "composed",
        composedShellTerminalId: source.terminalId,
      },
      profile: {
        cols: 80,
        rows: 20,
      },
    });

    const sourceRuntime = plane.getManagedTerminal(source.terminalId);
    const composedRuntime = plane.getManagedTerminal(composed.terminalId);
    if (!sourceRuntime || !composedRuntime) {
      throw new Error("expected source and composed runtimes");
    }

    const initialSnapshot = composedRuntime.getSnapshot();
    expect(initialSnapshot.lines[0]?.includes("shell-1:terminal-2")).toBe(true);

    await sourceRuntime.write("echo should-not-directly-project\n");
    await Bun.sleep(200);

    const afterSourceWrite = composedRuntime.getSnapshot();
    expect(afterSourceWrite.lines.join("\n")).not.toContain("should-not-directly-project");
    expect(afterSourceWrite.lines).toEqual(initialSnapshot.lines);

    const updated = plane.publishComposedSurfaceAuthorized({
      terminalId: composed.terminalId,
      surface: {
        shellTerminalId: source.terminalId,
        terminalId: composed.terminalId,
        seq: sourceRuntime.getSnapshot().seq,
        cols: 80,
        rows: 20,
        lines: ["$ agenter shell", "shell-1:~/project $", "", "dialogue right", "", "托管 off  ✉ 0 M-J"],
        richLines: [
          { spans: [{ text: "$ agenter shell", fg: "#00ff00" }] },
          { spans: [{ text: "shell-1:~/project $", fg: "#ffffff" }] },
          { spans: [] },
          { spans: [{ text: "dialogue right", fg: "#6ee7ff" }] },
          { spans: [] },
          { spans: [{ text: "托管 off  ✉ 0 M-J", fg: "#facc15" }] },
        ],
        cursor: { x: 5, y: 1, visible: true },
        scrollback: {
          viewportOffset: 0,
          totalLines: 20,
          screenLines: 20,
        },
      },
    });

    expect(updated.terminalId).toBe(composed.terminalId);
    const composedSnapshot = composedRuntime.getSnapshot();
    expect(composedSnapshot.lines.join("\n")).toContain("dialogue right");
    expect(composedSnapshot.lines.join("\n")).toContain("托管 off");
    expect(composedSnapshot.richLines?.[0]?.spans[0]?.fg).toBe("#00ff00");

    const read = await plane.read(composed.terminalId, "snapshot", { recordActivity: false });
    expect(read.representation).toBe("snapshot");
    expect(read.snapshot?.lines.join("\n")).toContain("dialogue right");
    expect(read.snapshot?.lines.join("\n")).not.toContain("should-not-directly-project");

    await plane.dispose();
  });

  test("Scenario: Given a composed terminal is the current TerminalSystem target When writing through it without a host publish Then read returns the shell result through the same terminal id", async () => {
    const plane = createDefaultShellPlane();
    plane.setActorPresence("session:guard", true);
    plane.setActorPresence("session:admin", true);
    const source = await plane.create({
      terminalId: "shell-current:terminal-1",
      bootstrapActorId: "session:admin",
      bootstrapRole: "admin",
    });
    const composed = await plane.create({
      terminalId: "shell-current:terminal-2",
      metadata: {
        terminalRuntimeKind: "composed",
        composedShellTerminalId: source.terminalId,
      },
      bootstrapActorId: "session:guard",
      bootstrapRole: "guard",
      adminGroupCandidateIds: ["session:admin"],
      profile: {
        cols: 80,
        rows: 20,
      },
    });

    const pending = await plane.write({
      terminalId: composed.terminalId,
      actorId: "session:guard",
      text: "printf 'composed-current-marker\\n'\n",
      returnRead: true,
      readMode: "snapshot",
    });

    expect(pending.ok).toBe(false);
    expect(pending.message).toBe("terminal write requires approval");
    expect(pending.approvalRequest?.terminalId).toBe(composed.terminalId);

    plane.approveRequestAuthorized({
      terminalId: composed.terminalId,
      requestId: pending.approvalRequest!.requestId,
      superadminActorId: "session:admin",
      durationMs: 60_000,
    });

    const written = await plane.write({
      terminalId: composed.terminalId,
      actorId: "session:guard",
      text: "printf 'composed-current-marker\\n'\n",
      returnRead: {
        debounceMs: 100,
      },
      readMode: "snapshot",
    });
    expect(written.ok).toBe(true);
    expect(written.read?.terminalId).toBe(composed.terminalId);
    expect(written.read?.snapshot?.lines.join("\n")).toContain("composed-current-marker");

    const read = await plane.read(composed.terminalId, "snapshot", { recordActivity: false });
    expect(read.terminalId).toBe(composed.terminalId);
    expect(read.snapshot?.lines.join("\n")).toContain("composed-current-marker");

    await plane.dispose();
  });

  test("Scenario: Given a composed terminal-2 runtime When it is created without a child PTY command Then it still publishes terminal screen truth through the composed seam", async () => {
    const plane = createPlane();
    const source = await plane.create({ terminalId: "shell-no-pty:terminal-1" });
    const composed = await plane.create({
      terminalId: "shell-no-pty:terminal-2",
      metadata: {
        terminalRuntimeKind: "composed",
        composedShellTerminalId: source.terminalId,
      },
      profile: {
        command: [],
        cols: 32,
        rows: 8,
      },
    });

    const composedRuntime = plane.getManagedTerminal(composed.terminalId);
    if (!composedRuntime) {
      throw new Error("expected composed runtime");
    }

    expect(composedRuntime.getSnapshot().lines.join("\n")).toContain("shell-no-pty:terminal-2");

    plane.publishComposedSurfaceAuthorized({
      terminalId: composed.terminalId,
      surface: {
        shellTerminalId: source.terminalId,
        terminalId: composed.terminalId,
        seq: 0,
        cols: 32,
        rows: 8,
        lines: ["terminal-2 composed screen", "no child PTY process", "Avatar started"],
        richLines: [
          { spans: [{ text: "terminal-2 composed screen", fg: "#f8fafc" }] },
          { spans: [{ text: "no child PTY process", fg: "#93c5fd" }] },
          { spans: [{ text: "Avatar started", fg: "#facc15" }] },
        ],
        cursor: { x: 0, y: 0, visible: false },
        scrollback: {
          viewportOffset: 0,
          totalLines: 8,
          screenLines: 8,
        },
      },
    });

    const snapshot = composedRuntime.getSnapshot();
    expect(snapshot.lines.join("\n")).toContain("terminal-2 composed screen");
    expect(snapshot.lines.join("\n")).toContain("no child PTY process");
    expect(snapshot.richLines?.[1]?.spans[0]?.text).toBe("no child PTY process");

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
    }) satisfies TerminalRuntime["onSnapshot"];
    managed.onStatus = ((listener) => {
      activeStatusListeners += 1;
      const release = originalOnStatus(listener);
      return () => {
        activeStatusListeners -= 1;
        release();
      };
    }) satisfies TerminalRuntime["onStatus"];
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
    }) satisfies TerminalRuntime["waitCommitted"];

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

  test("Scenario: Given an actor read cursor When cursor hash is inspected Then no output is consumed and no activity is appended", async () => {
    const plane = createPlane();
    const owner = "session:owner" as const;
    const reviewer = "session:reviewer" as const;
    const observer = "session:observer" as const;
    plane.setActorPresence(owner, true);
    plane.setActorPresence(reviewer, true);
    plane.setActorPresence(observer, true);
    const created = await plane.create({
      terminalId: "cursor-inspection",
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
    plane.issueGrantAuthorized({
      terminalId: created.terminalId,
      actorId: owner,
      participantId: observer,
      role: "readonly",
    });
    const reviewerMark = await plane.markDirty(created.terminalId, reviewer);
    const beforeEvents = plane.pageEvents(created.terminalId, { limit: 10 }).items;

    const inspected = plane.getReadCursorHashAuthorized({
      terminalId: created.terminalId,
      actorId: reviewer,
    });
    const missingActor = plane.getReadCursorHashAuthorized({
      terminalId: created.terminalId,
      actorId: observer,
    });
    const afterEvents = plane.pageEvents(created.terminalId, { limit: 10 }).items;

    expect(inspected).toBe(reviewerMark.hash);
    expect(missingActor).toBeNull();
    expect(afterEvents).toHaveLength(beforeEvents.length);

    const consumed = await plane.readAuthorized({
      terminalId: created.terminalId,
      actorId: reviewer,
      mode: "snapshot",
      remark: true,
      recordActivity: false,
    });
    expect(consumed.readCursor).toBeDefined();
    expect(plane.getReadCursorHashAuthorized({ terminalId: created.terminalId, actorId: reviewer })).toBe(
      consumed.readCursor?.toHash ?? null,
    );

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
    expect(plane.list().find((entry) => entry.terminalId === "demo")).toBeUndefined();
    expect(plane.list()).toHaveLength(0);
    expect(plane.listHistory().find((entry) => entry.terminalId === "demo")?.processPhase).toBe("killed");
    await expect(plane.deleteTerminal("demo")).resolves.toEqual({ ok: true, message: "terminal deleted" });
    expect(plane.list()).toHaveLength(0);
    expect(plane.listHistory().find((entry) => entry.terminalId === "demo")).toBeUndefined();

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
    expect(initialConfig.backend).toBe("xterm");
    expect(initialConfig.processPhase).toBe("running");
    expect(initialConfig.launchCwd).toBe(created.launchCwd);
    expect(Object.prototype.hasOwnProperty.call(initialConfig, "currentPath")).toBe(false);

    const mutation = plane.setTerminalConfigAuthorized({
      terminalId: created.terminalId,
      actorId: "session:owner",
      backend: "ghostty-native",
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
    expect(mutation.nextBootstrapFields).toEqual(expect.arrayContaining(["backend", "command", "launchCwd"]));
    expect(mutation.config.backend).toBe("ghostty-native");
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
      recoveryIntent: "killed-history",
    });
    await Bun.sleep(120);
    const restarted = await plane.snapshot(created.terminalId);
    expect(restarted.snapshot?.lines.join("\n")).toContain(nextCwd);

    await plane.dispose();
  });

  test("Scenario: Given websocket transport is started When a client connects pulls frames and the terminal is stopped Then endpoint discovery projection and lifecycle shutdown stay coherent", async () => {
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
    const frame = await pullLatestFrame({ socket, messages, lastFrame: null });

    expect(messages.some((message) => message.type === "frameDirty")).toBe(true);
    expect(frame.lines.join("\n")).toContain("hello transport");

    const closed = new Promise<void>((resolve) => {
      socket.addEventListener("close", () => resolve(), { once: true });
    });
    await plane.stop(created.terminalId);
    await closed;
    expect(plane.getTransportEndpoint(created.terminalId)).not.toBeNull();
    plane.stopTransport();
    await plane.dispose();
  });

  test("Scenario: Given a Bun client in the same process When transport hello negotiates direct mode Then control plane uses WebSocket only for handshake and direct functions for frame/input data", async () => {
    const plane = createPlane();
    const created = await plane.create({ terminalId: "stream-direct-data-plane" });
    await plane.startTransport({ port: 0 });
    const endpoint = plane.getTransportEndpoint(created.terminalId);
    expect(endpoint?.url).toContain(`/pty/${created.terminalId}`);

    const websocketFrames: TerminalTransportServerMessage[] = [];
    const directFrames: TerminalTransportServerMessage[] = [];
    const traces: Array<{ kind: string; messageType?: string; dataPlane?: string; reason?: string }> = [];
    const session = createTerminalTransportClientSession({
      transportUrl: endpoint!.url,
      geometryRole: "authority",
      debugTrace: true,
      events: {
        onMessage(message) {
          if (message.type === "helloAck" || message.type === "status") {
            websocketFrames.push(message);
          } else {
            directFrames.push(message);
          }
        },
        onTrace(event) {
          traces.push(event);
        },
      },
    });

    await session.connect();
    const directAck = await new Promise<Extract<TerminalTransportServerMessage, { type: "helloAck" }>>(
      (resolveAck, rejectAck) => {
        const startedAt = Date.now();
        const poll = () => {
          const found = websocketFrames.findLast(
            (message): message is Extract<TerminalTransportServerMessage, { type: "helloAck" }> =>
              message.type === "helloAck" && message.direct?.accepted === true,
          );
          if (found) {
            resolveAck(found);
            return;
          }
          if (Date.now() - startedAt > 2_000) {
            rejectAck(new Error("timeout waiting for direct helloAck"));
            return;
          }
          setTimeout(poll, 20);
        };
        poll();
      },
    );
    expect(directAck?.direct).toMatchObject({
      accepted: true,
      upgradeId: expect.any(String),
      registryKey: "@agenter/terminal-transport/direct-registry/v1",
      serverToken: expect.any(String),
    });
    expect(
      getTerminalTransportDirectRegistry()?.claim(directAck!.direct!.upgradeId!, directAck!.direct!.serverToken!),
    ).toBeNull();

    session.sendInputBytes(new TextEncoder().encode("direct transport\n"));
    await Bun.sleep(80);
    session.pullFrame({
      lastAppliedFrameSeq: 0,
      cols: 80,
      rows: 20,
    });
    const frame = await new Promise<Extract<TerminalTransportServerMessage, { type: "frame" }>>((resolve, reject) => {
      const startedAt = Date.now();
      const poll = () => {
        const found = directFrames.findLast(
          (message): message is Extract<TerminalTransportServerMessage, { type: "frame" }> => message.type === "frame",
        );
        if (found) {
          resolve(found);
          return;
        }
        if (Date.now() - startedAt > 2_000) {
          reject(new Error("timeout waiting for direct frame"));
          return;
        }
        setTimeout(poll, 20);
      };
      poll();
    });
    const decodedFrame = applyTerminalFramePatch(
      null,
      frame.patch,
      frame.frameSeq,
      createTerminalTransportRowCacheDecoder(),
    );

    expect(decodedFrame?.lines.join("\n")).toContain("direct transport");
    expect(traces).toContainEqual({
      kind: "client-direct-upgrade",
      reason: "connected",
      dataPlane: "direct",
    });
    expect(traces).toContainEqual({
      kind: "client-send",
      messageType: "pullFrame",
      dataPlane: "direct",
    });
    expect(directFrames.some((message) => message.type === "frameDirty")).toBe(true);

    session.disconnect();
    plane.stopTransport();
    await plane.dispose();
  });

  test("Scenario: Given transport selection events When a client pulls a frame Then backend-owned overlay and copy text are published", async () => {
    const plane = createPlane();
    const created = await plane.create({ terminalId: "stream-backend-selection" });
    const transport = await plane.startTransport({ port: 0 });
    const endpoint = plane.getTransportEndpoint(created.terminalId);

    expect(transport.port).not.toBeNull();
    expect(endpoint?.url).toContain(`/pty/${created.terminalId}`);

    await plane.write({
      terminalId: created.terminalId,
      text: "alpha beta\n",
    });

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
    const initialFrame = await pullLatestFrame({ socket, messages, lastFrame: null, rows: 6 });
    const targetRow = initialFrame.lines.findIndex((line) => line.includes("alpha beta"));
    expect(targetRow).toBeGreaterThanOrEqual(0);
    const backendRow = initialFrame.scrollback.viewportOffset + targetRow;

    socket.send(
      encodeClientFrame({
        type: "selectionStart",
        point: { ownerId: "terminal", row: backendRow, col: 0 },
      }),
    );
    socket.send(
      encodeClientFrame({
        type: "selectionUpdate",
        point: { ownerId: "terminal", row: backendRow, col: 4 },
      }),
    );
    socket.send(
      encodeClientFrame({
        type: "selectionEnd",
        point: { ownerId: "terminal", row: backendRow, col: 4 },
      }),
    );
    socket.send(encodeClientFrame({ type: "copySelection", ownerId: "terminal" }));
    await Bun.sleep(80);

    const selectedFrame = await pullLatestFrame({ socket, messages, lastFrame: initialFrame, rows: 6 });
    const selectionText = messages.findLast(
      (message): message is Extract<TerminalTransportServerMessage, { type: "selectionText" }> =>
        message.type === "selectionText",
    );

    expect(selectionText).toEqual({
      type: "selectionText",
      terminalId: created.terminalId,
      ownerId: "terminal",
      text: "alpha",
    });
    expect(selectedFrame.interaction?.activeOwnerId).toBe("terminal");
    expect(selectedFrame.interaction?.selectionOverlays?.[0]).toMatchObject({
      ownerId: "terminal",
      ownership: "backend-adapter-owned",
      rows: [{ row: targetRow, startCol: 0, endCol: 5 }],
      selectedText: "alpha",
    });

    socket.close();
    plane.stopTransport();
    await plane.dispose();
  });

  test("Scenario: Given transport cursor-follow is requested When the client has scrolled away Then the pulled frame uses backend cursor truth", async () => {
    const plane = createPlane();
    const created = await plane.create({ terminalId: "stream-follow-cursor" });
    const transport = await plane.startTransport({ port: 0 });
    const endpoint = plane.getTransportEndpoint(created.terminalId);

    expect(transport.port).not.toBeNull();
    expect(endpoint?.url).toContain(`/pty/${created.terminalId}`);

    await plane.write({
      terminalId: created.terminalId,
      text: `${Array.from({ length: 50 }, (_, index) => `follow-line-${index}`).join("\n")}\n`,
    });

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
    const bottomFrame = await pullLatestFrame({ socket, messages, lastFrame: null, rows: 8 });
    expect(bottomFrame.scrollback.viewportOffset).toBeGreaterThan(0);

    socket.send(encodeClientFrame({ type: "viewportTarget", viewportStart: 0 }));
    await Bun.sleep(100);
    const topFrame = await pullLatestFrame({ socket, messages, lastFrame: bottomFrame, rows: 8 });
    expect(topFrame.scrollback.viewportOffset).toBe(0);
    expect(topFrame.cursor.visible).toBe(false);

    socket.send(encodeClientFrame({ type: "followCursor" }));
    await Bun.sleep(100);
    const followedFrame = await pullLatestFrame({ socket, messages, lastFrame: topFrame, rows: 8 });

    expect(followedFrame.scrollback.viewportOffset).toBeGreaterThan(topFrame.scrollback.viewportOffset);
    expect(followedFrame.scrollback.screenLines).toBe(8);
    expect(followedFrame.cursor.visible).toBe(true);
    expect(followedFrame.cursor.y).toBeGreaterThanOrEqual(0);
    expect(followedFrame.cursor.y).toBeLessThan(followedFrame.rows);

    socket.close();
    plane.stopTransport();
    await plane.dispose();
  });

  test("Scenario: Given direct transport interaction methods When semantic selection is sent Then structured messages reach backend without websocket data frames", async () => {
    const plane = createPlane();
    const created = await plane.create({ terminalId: "stream-direct-interaction" });
    await plane.write({
      terminalId: created.terminalId,
      text: "word jump\n",
    });
    await plane.startTransport({ port: 0 });
    const endpoint = plane.getTransportEndpoint(created.terminalId);
    expect(endpoint?.url).toContain(`/pty/${created.terminalId}`);

    const websocketFrames: TerminalTransportServerMessage[] = [];
    const directFrames: TerminalTransportServerMessage[] = [];
    const traces: Array<{ kind: string; messageType?: string; dataPlane?: string; reason?: string }> = [];
    const session = createTerminalTransportClientSession({
      transportUrl: endpoint!.url,
      geometryRole: "authority",
      debugTrace: true,
      events: {
        onMessage(message) {
          if (message.type === "helloAck" || message.type === "status") {
            websocketFrames.push(message);
          } else {
            directFrames.push(message);
          }
        },
        onTrace(event) {
          traces.push(event);
        },
      },
    });

    await session.connect();
    const directAck = await new Promise<Extract<TerminalTransportServerMessage, { type: "helloAck" }>>(
      (resolveAck, rejectAck) => {
        const startedAt = Date.now();
        const poll = () => {
          const found = websocketFrames.findLast(
            (message): message is Extract<TerminalTransportServerMessage, { type: "helloAck" }> =>
              message.type === "helloAck" && message.direct?.accepted === true,
          );
          if (found) {
            resolveAck(found);
            return;
          }
          if (Date.now() - startedAt > 2_000) {
            rejectAck(new Error("timeout waiting for direct helloAck"));
            return;
          }
          setTimeout(poll, 20);
        };
        poll();
      },
    );
    expect(directAck.direct?.accepted).toBe(true);

    session.selectWordAt({ ownerId: "terminal", row: 0, col: 1 });
    session.copySelection("terminal");
    session.pullFrame({ lastAppliedFrameSeq: 0, cols: 80, rows: 6 });

    const frame = await new Promise<Extract<TerminalTransportServerMessage, { type: "frame" }>>((resolve, reject) => {
      const startedAt = Date.now();
      const poll = () => {
        const found = directFrames.findLast(
          (message): message is Extract<TerminalTransportServerMessage, { type: "frame" }> => message.type === "frame",
        );
        if (found) {
          resolve(found);
          return;
        }
        if (Date.now() - startedAt > 2_000) {
          reject(new Error("timeout waiting for direct interaction frame"));
          return;
        }
        setTimeout(poll, 20);
      };
      poll();
    });
    const decodedFrame = applyTerminalFramePatch(
      null,
      frame.patch,
      frame.frameSeq,
      createTerminalTransportRowCacheDecoder(),
    );
    const selectionText = directFrames.findLast(
      (message): message is Extract<TerminalTransportServerMessage, { type: "selectionText" }> =>
        message.type === "selectionText",
    );

    expect(selectionText?.text).toBe("word");
    expect(decodedFrame?.interaction?.selectionOverlays?.[0]).toMatchObject({
      ownerId: "terminal",
      ownership: "backend-adapter-owned",
      selectedText: "word",
    });
    expect(traces).toContainEqual({
      kind: "client-send",
      messageType: "selectWordAt",
      dataPlane: "direct",
    });
    expect(traces).toContainEqual({
      kind: "client-send",
      messageType: "copySelection",
      dataPlane: "direct",
    });

    session.disconnect();
    plane.stopTransport();
    await plane.dispose();
  });

  test("Scenario: Given default local transport When terminal output changes without a geometry change Then websocket subscribers pull row-cache frames without running the diff path", async () => {
    const plane = createPlane();
    const created = await plane.create({ terminalId: "stream-snapshot-updates" });
    const transport = await plane.startTransport({ port: 0 });
    const endpoint = plane.getTransportEndpoint(created.terminalId);

    expect(transport.port).not.toBeNull();
    expect(transport.framePatchMode).toBe("rowCache");
    expect(endpoint?.url).toContain(`/pty/${created.terminalId}`);

    const socket = new WebSocket(endpoint!.url);
    const messages: TerminalTransportServerMessage[] = [];
    const rowCacheDecoder = createTerminalTransportRowCacheDecoder();
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
    let latestFrame = await pullLatestFrame({ socket, messages, lastFrame: null, rowCacheDecoder });
    const initialDirtyCount = messages.filter((message) => message.type === "frameDirty").length;
    expect(initialDirtyCount).toBeGreaterThan(0);

    await plane.write({
      terminalId: created.terminalId,
      text: "snapshot after connect\n",
    });
    await Bun.sleep(150);
    latestFrame = await pullLatestFrame({ socket, messages, lastFrame: latestFrame, rowCacheDecoder });

    const frameMessages = messages.filter(
      (message): message is Extract<TerminalTransportServerMessage, { type: "frame" }> => message.type === "frame",
    );

    expect(messages.filter((message) => message.type === "frameDirty").length).toBeGreaterThanOrEqual(
      initialDirtyCount,
    );
    expect(latestFrame.lines.join("\n")).toContain("snapshot after connect");
    expect(frameMessages.every((message) => message.patch.type === "rowCache")).toBe(true);
    expect(
      frameMessages.some(
        (message) =>
          message.patch.type === "rowCache" &&
          message.patch.cachedRows.some((row) => row.cid > 0 && row.line === undefined && row.richLine === undefined),
      ),
    ).toBe(true);

    socket.close();
    plane.stopTransport();
    await plane.dispose();
  });

  test("Scenario: Given row-cache transport has already serialized one viewport When the next pull observes identical cells Then the backend returns a codec-level notModified frame", async () => {
    const plane = createPlane();
    const created = await plane.create({ terminalId: "stream-row-cache-not-modified" });
    const transport = await plane.startTransport({ port: 0 });
    const endpoint = plane.getTransportEndpoint(created.terminalId);

    expect(transport.framePatchMode).toBe("rowCache");
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
    const firstFrame = await pullLatestFrame({ socket, messages, lastFrame: null });
    const firstFrameMessage = messages.findLast(
      (message): message is Extract<TerminalTransportServerMessage, { type: "frame" }> => message.type === "frame",
    );
    expect(firstFrameMessage?.patch.type).toBe("rowCache");

    socket.send(
      encodeClientFrame({
        type: "pullFrame",
        lastAppliedFrameSeq: firstFrame.seq,
        cols: firstFrame.cols,
        rows: firstFrame.rows,
      }),
    );
    for (let attempt = 0; attempt < 20; attempt += 1) {
      await Bun.sleep(20);
      const latestFrameMessage = messages.findLast(
        (message): message is Extract<TerminalTransportServerMessage, { type: "frame" }> => message.type === "frame",
      );
      if (latestFrameMessage && latestFrameMessage !== firstFrameMessage) {
        expect(latestFrameMessage.patch).toEqual({
          type: "notModified",
          baseFrameSeq: firstFrame.seq,
          timestamp: expect.any(Number),
        });
        socket.close();
        plane.stopTransport();
        await plane.dispose();
        return;
      }
    }
    throw new Error("timed out waiting for notModified frame");
  });

  test("Scenario: Given debug trace is requested in hello When the client pulls a frame Then backend timing breakdown and aggregate diagnostics are sent as transport trace sideband", async () => {
    const plane = createPlane();
    const created = await plane.create({ terminalId: "stream-debug-trace" });
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
    socket.send(encodeClientFrame({ type: "hello", geometryRole: "authority", debugTrace: true }));
    const frame = await pullLatestFrame({ socket, messages, lastFrame: null, rows: 8 });

    const trace = messages.findLast(
      (message): message is Extract<TerminalTransportServerMessage, { type: "trace" }> =>
        message.type === "trace" && message.event === "pull-frame-server",
    );
    const rawTrace = messages.find(
      (message): message is Extract<TerminalTransportServerMessage, { type: "trace" }> =>
        message.type === "trace" && message.event === "client-message-raw",
    );
    const decodedTrace = messages.find(
      (message): message is Extract<TerminalTransportServerMessage, { type: "trace" }> =>
        message.type === "trace" &&
        message.event === "client-message-decoded" &&
        message.fields.messageType === "pullFrame",
    );
    const pullStartTrace = messages.find(
      (message): message is Extract<TerminalTransportServerMessage, { type: "trace" }> =>
        message.type === "trace" && message.event === "pull-frame-start",
    );
    const diagnosticsTrace = await waitForServerTrace(
      messages,
      (message): message is Extract<TerminalTransportServerMessage, { type: "trace" }> =>
        message.event === "transport-diagnostics",
    );
    expect(trace).toBeDefined();
    expect(rawTrace).toBeUndefined();
    expect(decodedTrace).toBeUndefined();
    expect(pullStartTrace).toBeUndefined();
    expect(diagnosticsTrace?.fields).toMatchObject({
      tcpNoDelayAttempted: true,
      tcpNoDelayEnabled: expect.any(Boolean),
      eventLoopLagMs: expect.any(Number),
      queuedMessages: expect.any(Number),
      scrollMessages: expect.any(Number),
      nonScrollMessages: expect.any(Number),
      pullMessages: expect.any(Number),
      totalDecodeMs: expect.any(Number),
      maxQueueDepthBeforeDrain: expect.any(Number),
      inputDrains: expect.any(Number),
      pullFrames: expect.any(Number),
      lastPullTotalMs: expect.any(Number),
      maxPullTotalMs: expect.any(Number),
      lastPullPatchType: "rowCache",
      outputBytes: expect.any(Number),
      outputEvents: expect.any(Number),
      snapshots: expect.any(Number),
      dirtyTicks: expect.any(Number),
      dirtySignals: expect.any(Number),
      dirtyCheckMs: expect.any(Number),
    });
    expect(diagnosticsTrace?.fields).toHaveProperty("oldestQueueAgeMs");
    expect(diagnosticsTrace?.fields).toHaveProperty("oldestRawQueueAgeMs");
    expect(diagnosticsTrace?.fields).toHaveProperty("lastDrainMs");
    expect(diagnosticsTrace?.fields).toHaveProperty("maxDrainMs");
    expect(trace?.terminalId).toBe(created.terminalId);
    expect(trace?.fields).toMatchObject({
      frameSeq: frame.seq,
      lastAppliedFrameSeq: 0,
      patchType: "rowCache",
      patchRows: 8,
      queuedMessages: expect.any(Number),
      viewportStart: frame.scrollback.viewportOffset,
      totalLines: frame.scrollback.totalLines,
      screenLines: frame.scrollback.screenLines,
    });
    expect(typeof trace?.fields.encodedBytes).toBe("number");
    expect(typeof trace?.fields.snapshotMs).toBe("number");
    expect(typeof trace?.fields.projectionMs).toBe("number");
    expect(typeof trace?.fields.patchMs).toBe("number");
    expect(typeof trace?.fields.statusMs).toBe("number");
    expect(typeof trace?.fields.encodeMs).toBe("number");
    expect(typeof trace?.fields.sendMs).toBe("number");
    expect(typeof trace?.fields.totalMs).toBe("number");

    socket.close();
    plane.stopTransport();
    await plane.dispose();
  });

  test("Scenario: Given debug trace is not requested When the client pulls a frame Then backend timing sideband stays disabled by default", async () => {
    const plane = createPlane();
    const created = await plane.create({ terminalId: "stream-debug-trace-default-off" });
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
    await pullLatestFrame({ socket, messages, lastFrame: null, rows: 8 });
    await Bun.sleep(40);

    expect(messages.some((message) => message.type === "trace")).toBe(false);

    socket.close();
    plane.stopTransport();
    await plane.dispose();
  });

  test("Scenario: Given diff transport mode When terminal output changes without a geometry change Then websocket subscribers may receive row diffs", async () => {
    const plane = createPlane();
    plane.setConfig({ transport: { framePatchMode: "diff" } });
    const created = await plane.create({ terminalId: "stream-row-diff-updates" });
    const transport = await plane.startTransport({ port: 0 });
    const endpoint = plane.getTransportEndpoint(created.terminalId);

    expect(transport.framePatchMode).toBe("diff");
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
    let latestFrame = await pullLatestFrame({ socket, messages, lastFrame: null });

    await plane.write({
      terminalId: created.terminalId,
      text: "diff after connect\n",
    });
    await Bun.sleep(150);
    latestFrame = await pullLatestFrame({ socket, messages, lastFrame: latestFrame });

    const frameMessages = messages.filter(
      (message): message is Extract<TerminalTransportServerMessage, { type: "frame" }> => message.type === "frame",
    );

    expect(latestFrame.lines.join("\n")).toContain("diff after connect");
    expect(frameMessages.some((message) => message.patch.type === "rows" || message.patch.type === "scrollRows")).toBe(
      true,
    );

    socket.close();
    plane.stopTransport();
    await plane.dispose();
  });

  test("Scenario: Given a shared transport attachment When the client scrolls the viewport Then websocket subscribers pull an authoritative frame with updated viewport truth", async () => {
    const plane = createPlane();
    const created = await plane.create({ terminalId: "shared-viewport" });
    const transport = await plane.startTransport({ port: 0 });
    const endpoint = plane.getTransportEndpoint(created.terminalId);

    expect(transport.port).not.toBeNull();
    expect(endpoint?.url).toContain(`/pty/${created.terminalId}`);

    await plane.write({
      terminalId: created.terminalId,
      text: "line-1\nline-2\nline-3\nline-4\nline-5\nline-6\nline-7\nline-8\nline-9\nline-10\nline-11\nline-12\nline-13\nline-14\nline-15\nline-16\nline-17\nline-18\nline-19\nline-20\nline-21\nline-22\nline-23\nline-24\nline-25\nline-26\n",
    });

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
    await Bun.sleep(120);

    const initialFrame = await pullLatestFrame({ socket, messages, lastFrame: null });

    socket.send(encodeClientFrame({ type: "viewportDelta", deltaRows: -3 }));
    await Bun.sleep(120);
    const latestFrame = await pullLatestFrame({ socket, messages, lastFrame: initialFrame });

    expect(latestFrame.scrollback.viewportOffset).toBeLessThan(initialFrame.scrollback.viewportOffset);

    socket.close();
    plane.stopTransport();
    await plane.dispose();
  });

  test("Scenario: Given a shared transport attachment When viewport input changes backend scroll Then input stays objective and pull reads backend truth", async () => {
    const plane = createPlane();
    const created = await plane.create({ terminalId: "shared-viewport-objective-input" });
    const transport = await plane.startTransport({ port: 0 });
    const endpoint = plane.getTransportEndpoint(created.terminalId);

    expect(transport.port).not.toBeNull();
    expect(endpoint?.url).toContain(`/pty/${created.terminalId}`);

    await plane.write({
      terminalId: created.terminalId,
      text: `${Array.from({ length: 80 }, (_, index) => `line-${index}`).join("\n")}\n`,
    });

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
    const initialFrame = await pullLatestFrame({ socket, messages, lastFrame: null, rows: 12 });
    const initialDirtyCount = messages.filter((message) => message.type === "frameDirty").length;

    socket.send(encodeClientFrame({ type: "viewportDelta", deltaRows: -4 }));
    await Bun.sleep(5);

    const dirtyMessages = messages.filter(
      (message): message is Extract<TerminalTransportServerMessage, { type: "frameDirty" }> =>
        message.type === "frameDirty",
    );
    expect(
      dirtyMessages
        .slice(initialDirtyCount)
        .every((message) => message.reason !== "viewport-delta" && message.reason !== "viewport-target"),
    ).toBe(true);

    const latestFrame = await pullLatestFrame({ socket, messages, lastFrame: initialFrame, rows: 12 });
    expect(latestFrame.scrollback.viewportOffset).toBeLessThan(initialFrame.scrollback.viewportOffset);

    const targetInitialDirtyCount = messages.filter((message) => message.type === "frameDirty").length;
    const targetViewportStart = Math.max(0, latestFrame.scrollback.viewportOffset - 2);
    socket.send(encodeClientFrame({ type: "viewportTarget", viewportStart: targetViewportStart }));
    await Bun.sleep(5);

    const targetDirtyMessages = messages.filter(
      (message): message is Extract<TerminalTransportServerMessage, { type: "frameDirty" }> =>
        message.type === "frameDirty",
    );
    expect(
      targetDirtyMessages
        .slice(targetInitialDirtyCount)
        .every((message) => message.reason !== "viewport-delta" && message.reason !== "viewport-target"),
    ).toBe(true);
    const targetFrame = await pullLatestFrame({ socket, messages, lastFrame: latestFrame, rows: 12 });
    expect(targetFrame.scrollback.viewportOffset).toBe(targetViewportStart);
    expect(
      messages.some(
        (message) =>
          message.type === "frameDirty" &&
          (message.reason === "viewport-delta" || message.reason === "viewport-target"),
      ),
    ).toBe(false);

    socket.close();
    plane.stopTransport();
    await plane.dispose();
  });

  test("Scenario: Given websocket buffers many scroll inputs When backend drains one turn Then only consecutive scroll runs are merged and semantic events keep order", async () => {
    const plane = createPlane();
    const created = await plane.create({ terminalId: "backend-scroll-drain" });
    const managed = plane.getManagedTerminal(created.terminalId);
    if (!managed) {
      throw new Error("expected managed terminal");
    }
    const operations: string[] = [];
    const originalScrollViewport = managed.scrollViewport.bind(managed);
    const originalWriteRawBytes = managed.writeRawBytes.bind(managed);
    managed.scrollViewport = ((deltaRows: number) => {
      operations.push(`scroll:${deltaRows}`);
      originalScrollViewport(deltaRows);
    }) satisfies TerminalRuntime["scrollViewport"];
    managed.writeRawBytes = ((bytes: Uint8Array) => {
      operations.push(`input:${new TextDecoder().decode(bytes)}`);
      originalWriteRawBytes(bytes);
    }) satisfies TerminalRuntime["writeRawBytes"];

    const transport = await plane.startTransport({ port: 0 });
    const endpoint = plane.getTransportEndpoint(created.terminalId);
    expect(transport.port).not.toBeNull();
    expect(endpoint?.url).toContain(`/pty/${created.terminalId}`);

    const socket = new WebSocket(endpoint!.url);
    const opened = new Promise<void>((resolve, reject) => {
      socket.addEventListener("open", () => resolve(), { once: true });
      socket.addEventListener("error", () => reject(new Error("websocket-open-failed")), { once: true });
    });
    await opened;

    for (let index = 0; index < 12; index += 1) {
      socket.send(encodeClientFrame({ type: "viewportDelta", deltaRows: 1 }));
    }
    await Bun.sleep(80);
    expect(operations.filter((operation) => operation.startsWith("scroll:"))).toEqual(["scroll:12"]);

    operations.length = 0;
    for (let index = 0; index < 3; index += 1) {
      socket.send(encodeClientFrame({ type: "viewportDelta", deltaRows: -1 }));
    }
    socket.send(encodeClientFrame({ type: "inputBytes", data: new TextEncoder().encode("x") }));
    for (let index = 0; index < 2; index += 1) {
      socket.send(encodeClientFrame({ type: "viewportDelta", deltaRows: 1 }));
    }
    await Bun.sleep(120);
    expect(operations).toEqual(["scroll:-3", "input:x", "scroll:2"]);

    socket.close();
    plane.stopTransport();
    await plane.dispose();
  });

  test("Scenario: Given one websocket consumer is already dirty When terminal text changes repeatedly Then the shared dirty loop waits until that connection pulls again", async () => {
    const plane = createPlane();
    const created = await plane.create({ terminalId: "backend-dirty-loop" });
    const transport = await plane.startTransport({ port: 0 });
    const endpoint = plane.getTransportEndpoint(created.terminalId);
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
    await Bun.sleep(120);
    const initialDirtyCount = messages.filter((message) => message.type === "frameDirty").length;
    expect(initialDirtyCount).toBe(1);

    await plane.write({ terminalId: created.terminalId, text: "dirty one\n" });
    await plane.write({ terminalId: created.terminalId, text: "dirty two\n" });
    await Bun.sleep(180);
    expect(messages.filter((message) => message.type === "frameDirty")).toHaveLength(initialDirtyCount);

    const latestFrame = await pullLatestFrame({ socket, messages, lastFrame: null });
    await plane.write({ terminalId: created.terminalId, text: "dirty three\n" });
    await Bun.sleep(180);
    expect(messages.filter((message) => message.type === "frameDirty")).toHaveLength(initialDirtyCount + 1);
    expect(latestFrame.lines.join("\n")).toContain("dirty two");

    socket.close();
    plane.stopTransport();
    await plane.dispose();
  });

  test("Scenario: Given terminal output exceeds the client viewport When websocket client targets then pulls a frame Then transport sends only backend authoritative viewport rows", async () => {
    const plane = createPlane();
    const created = await plane.create({ terminalId: "viewport-frame" });
    const transport = await plane.startTransport({ port: 0 });
    const endpoint = plane.getTransportEndpoint(created.terminalId);

    expect(transport.port).not.toBeNull();
    expect(endpoint?.url).toContain(`/pty/${created.terminalId}`);

    await plane.write({
      terminalId: created.terminalId,
      text: `${Array.from({ length: 80 }, (_, index) => `viewport-line-${index}`).join("\n")}\n`,
    });

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
    await Bun.sleep(120);
    const initialFrame = await pullLatestFrame({
      socket,
      messages,
      lastFrame: null,
      cols: 80,
      rows: 12,
    });
    socket.send(encodeClientFrame({ type: "viewportTarget", viewportStart: 30 }));
    await Bun.sleep(120);
    const frame = await pullLatestFrame({
      socket,
      messages,
      lastFrame: initialFrame,
      cols: 80,
      rows: 12,
    });

    expect(frame.lines).toHaveLength(12);
    expect(frame.scrollback.viewportOffset).toBe(30);
    expect(frame.scrollback.screenLines).toBe(12);
    expect(frame.scrollback.totalLines).toBeGreaterThan(12);
    expect(frame.lines[0]?.trimEnd()).toBe("viewport-line-30");
    expect(frame.lines.join("\n")).not.toContain("viewport-line-0");
    expect(frame.lines.join("\n")).not.toContain("viewport-line-79");

    socket.close();
    plane.stopTransport();
    await plane.dispose();
  });

  test("Scenario: Given a shared transport attachment When the client targets an absolute viewport start Then websocket subscribers pull the authoritative republished viewport truth", async () => {
    const plane = createPlane();
    const created = await plane.create({ terminalId: "shared-viewport-target" });
    const transport = await plane.startTransport({ port: 0 });
    const endpoint = plane.getTransportEndpoint(created.terminalId);

    expect(transport.port).not.toBeNull();
    expect(endpoint?.url).toContain(`/pty/${created.terminalId}`);

    await plane.write({
      terminalId: created.terminalId,
      text: "line-1\nline-2\nline-3\nline-4\nline-5\nline-6\nline-7\nline-8\nline-9\nline-10\nline-11\nline-12\nline-13\nline-14\nline-15\nline-16\nline-17\nline-18\nline-19\nline-20\nline-21\nline-22\nline-23\nline-24\nline-25\nline-26\n",
    });

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
    await Bun.sleep(120);
    const initialFrame = await pullLatestFrame({ socket, messages, lastFrame: null });

    socket.send(encodeClientFrame({ type: "viewportTarget", viewportStart: 5 }));
    await Bun.sleep(120);
    const latestFrame = await pullLatestFrame({ socket, messages, lastFrame: initialFrame });

    expect(latestFrame.scrollback.viewportOffset).toBe(5);

    socket.close();
    plane.stopTransport();
    await plane.dispose();
  });

  test("Scenario: Given transport was stopped When endpoint discovery runs Then the control plane does not project a stale websocket URL", async () => {
    const plane = createPlane();
    const created = await plane.create({ terminalId: "stale-transport-endpoint" });
    await plane.startTransport({ port: 0 });

    expect(plane.getTransportEndpoint(created.terminalId)?.url).toContain(`/pty/${created.terminalId}`);

    plane.stopTransport();

    expect(plane.getTransportEndpoint(created.terminalId)).toBeNull();

    await plane.dispose();
  });

  test("Scenario: Given a projection-only transport attachment When it tries to resize backend geometry Then the control plane rejects last-resizer-wins behavior", async () => {
    const plane = createPlane();
    const created = await plane.create({ terminalId: "projection-only-resize" });
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
    socket.send(encodeClientFrame({ type: "resize", cols: 101, rows: 19 }));
    await Bun.sleep(80);

    const latestError = messages.findLast(
      (message): message is Extract<TerminalTransportServerMessage, { type: "error" }> => message.type === "error",
    );
    expect(latestError?.message).toContain("projection-only");
    expect(plane.getSnapshot(created.terminalId).cols).not.toBe(101);
    expect(plane.getSnapshot(created.terminalId).rows).not.toBe(19);

    socket.close();
    plane.stopTransport();
    await plane.dispose();
  });

  test("Scenario: Given two authority-capable attachments with explicit geometry order When backend arbitrates Then lower order wins and loser resize is rejected", async () => {
    const plane = createPlane();
    const created = await plane.create({ terminalId: "authority-explicit-order" });
    await plane.startTransport({ port: 0 });
    const endpoint = plane.getTransportEndpoint(created.terminalId);
    const first = new WebSocket(endpoint!.url);
    const second = new WebSocket(endpoint!.url);
    const firstMessages: TerminalTransportServerMessage[] = [];
    const secondMessages: TerminalTransportServerMessage[] = [];
    const waitOpen = (socket: WebSocket) =>
      new Promise<void>((resolve, reject) => {
        socket.addEventListener("open", () => resolve(), { once: true });
        socket.addEventListener("error", () => reject(new Error("websocket-open-failed")), { once: true });
      });
    first.addEventListener("message", (event) => {
      const frame = decodeServerFrame(event.data);
      if (frame) {
        firstMessages.push(frame);
      }
    });
    second.addEventListener("message", (event) => {
      const frame = decodeServerFrame(event.data);
      if (frame) {
        secondMessages.push(frame);
      }
    });

    await Promise.all([waitOpen(first), waitOpen(second)]);
    first.send(encodeClientFrame({ type: "hello", geometryRole: "authority", geometryOrder: 5 }));
    second.send(encodeClientFrame({ type: "hello", geometryRole: "authority", geometryOrder: 1 }));
    await Bun.sleep(120);

    const secondHelloAck = secondMessages.findLast(
      (message): message is Extract<TerminalTransportServerMessage, { type: "helloAck" }> =>
        message.type === "helloAck",
    );
    expect(secondHelloAck?.effectiveGeometryRole).toBe("authority");
    expect(secondHelloAck?.authorityReason).toBe("explicit-geometry-order");

    const attachments = plane.getTransportAttachments(created.terminalId);
    expect(attachments).toHaveLength(2);
    const authority = attachments.find((attachment) => attachment.effectiveGeometryRole === "authority");
    const loser = attachments.find((attachment) => attachment.effectiveGeometryRole === "projection-only");
    expect(authority?.geometryOrder).toBe(1);
    expect(authority?.authorityReason).toBe("explicit-geometry-order");
    expect(loser?.geometryAuthorityAttachmentId).toBe(authority?.attachmentId);

    first.send(encodeClientFrame({ type: "resize", cols: 101, rows: 19 }));
    await Bun.sleep(80);
    const firstError = firstMessages.findLast(
      (message): message is Extract<TerminalTransportServerMessage, { type: "error" }> => message.type === "error",
    );
    expect(firstError?.message).toContain("projection-only");

    second.send(encodeClientFrame({ type: "resize", cols: 91, rows: 22 }));
    await Bun.sleep(80);
    expect(plane.getSnapshot(created.terminalId).cols).toBe(91);
    expect(plane.getSnapshot(created.terminalId).rows).toBe(22);

    first.close();
    second.close();
    plane.stopTransport();
    await plane.dispose();
  });

  test("Scenario: Given authority-capable attachments without explicit order When backend arbitrates Then attach order wins until winner disconnects", async () => {
    const plane = createPlane();
    const created = await plane.create({ terminalId: "authority-attach-order" });
    await plane.startTransport({ port: 0 });
    const endpoint = plane.getTransportEndpoint(created.terminalId);
    const first = new WebSocket(endpoint!.url);
    const second = new WebSocket(endpoint!.url);
    const waitOpen = (socket: WebSocket) =>
      new Promise<void>((resolve, reject) => {
        socket.addEventListener("open", () => resolve(), { once: true });
        socket.addEventListener("error", () => reject(new Error("websocket-open-failed")), { once: true });
      });

    await Promise.all([waitOpen(first), waitOpen(second)]);
    first.send(encodeClientFrame({ type: "hello", geometryRole: "authority" }));
    second.send(encodeClientFrame({ type: "hello", geometryRole: "authority" }));
    await Bun.sleep(120);

    let attachments = plane.getTransportAttachments(created.terminalId);
    expect(attachments).toHaveLength(2);
    let authority = attachments.find((attachment) => attachment.effectiveGeometryRole === "authority");
    expect(authority?.authorityReason).toBe("backend-attach-order-fallback");
    const initialAuthorityId = authority?.attachmentId;

    first.close();
    await Bun.sleep(120);

    attachments = plane.getTransportAttachments(created.terminalId);
    expect(attachments).toHaveLength(1);
    authority = attachments[0];
    expect(authority?.effectiveGeometryRole).toBe("authority");
    expect(authority?.attachmentId).not.toBe(initialAuthorityId);

    second.close();
    plane.stopTransport();
    await plane.dispose();
  });

  test("Scenario: Given one attachment later drops explicit geometry order When backend reevaluates Then attach-order fallback becomes the visible authority reason", async () => {
    const plane = createPlane();
    const created = await plane.create({ terminalId: "authority-order-cleared" });
    await plane.startTransport({ port: 0 });
    const endpoint = plane.getTransportEndpoint(created.terminalId);
    const first = new WebSocket(endpoint!.url);
    const second = new WebSocket(endpoint!.url);
    const firstMessages: TerminalTransportServerMessage[] = [];
    const waitOpen = (socket: WebSocket) =>
      new Promise<void>((resolve, reject) => {
        socket.addEventListener("open", () => resolve(), { once: true });
        socket.addEventListener("error", () => reject(new Error("websocket-open-failed")), { once: true });
      });
    first.addEventListener("message", (event) => {
      const frame = decodeServerFrame(event.data);
      if (frame) {
        firstMessages.push(frame);
      }
    });

    await Promise.all([waitOpen(first), waitOpen(second)]);
    first.send(encodeClientFrame({ type: "hello", geometryRole: "authority", geometryOrder: 1 }));
    second.send(encodeClientFrame({ type: "hello", geometryRole: "authority", geometryOrder: 10 }));
    await Bun.sleep(120);

    first.send(encodeClientFrame({ type: "hello", geometryRole: "authority" }));
    second.send(encodeClientFrame({ type: "hello", geometryRole: "authority" }));
    await Bun.sleep(120);

    const authority = plane
      .getTransportAttachments(created.terminalId)
      .find((attachment) => attachment.effectiveGeometryRole === "authority");
    expect(authority?.authorityReason).toBe("backend-attach-order-fallback");

    const latestHelloAck = firstMessages.findLast(
      (message): message is Extract<TerminalTransportServerMessage, { type: "helloAck" }> =>
        message.type === "helloAck",
    );
    expect(latestHelloAck?.authorityReason).toBe("backend-attach-order-fallback");

    first.close();
    second.close();
    plane.stopTransport();
    await plane.dispose();
  });

  test("Scenario: Given guard and readonly grants When writes require approval Then readonly stays blocked and approved leases unlock guard writes", async () => {
    const plane = createPlane();
    plane.setActorPresence("session:admin", true);
    const created = await plane.create({
      terminalId: "collab",
      bootstrapActorId: "session:admin",
      bootstrapRole: "admin",
    });

    const guard = plane.issueGrantAuthorized({
      terminalId: created.terminalId,
      actorId: "session:admin",
      participantId: "session:guard",
      role: "guard",
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
      actorId: "session:guard",
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
    expect(lease.participantId).toBe("session:guard");

    const approved = await plane.write({
      terminalId: created.terminalId,
      text: "needs-lease",
      actorId: "session:guard",
      accessToken: guard.accessToken,
    });
    expect(approved.ok).toBe(true);

    await plane.dispose();
  });

  test("Scenario: Given a guard seat with a direct managed lease When it writes and later the lease is revoked Then terminal write events keep avatar actor identity and lease provenance", async () => {
    const plane = createPlane();
    plane.setActorPresence("session:admin", true);
    const created = await plane.create({
      terminalId: "managed-lease-direct",
      bootstrapActorId: "session:admin",
      bootstrapRole: "admin",
    });

    plane.issueGrantAuthorized({
      terminalId: created.terminalId,
      actorId: "session:admin",
      participantId: "session:avatar",
      role: "guard",
    });

    const lease = plane.grantWriteLeaseAuthorized({
      terminalId: created.terminalId,
      participantId: "session:avatar",
      durationMs: 60_000,
      actorId: "session:admin",
    });

    const written = await plane.write({
      terminalId: created.terminalId,
      text: "lease-backed write\n",
      actorId: "session:avatar",
    });
    expect(written.ok).toBe(true);
    expect(written.leaseId).toBe(lease.leaseId);
    expect(written.eventId).toBeDefined();

    const event = written.eventId ? plane.getEvent(written.eventId) : undefined;
    expect(event?.payload.actorId).toBe("session:avatar");
    expect(event?.payload.detail).toMatchObject({
      mode: "raw",
      leaseId: lease.leaseId,
    });
    expect(
      plane
        .listForActor("session:avatar", { touchPresence: false })
        .find((item) => item.terminalId === created.terminalId)
        ?.actors?.find((actor) => actor.actorId === "session:avatar"),
    ).toMatchObject({
      actorId: "session:avatar",
      role: "guard",
      leaseId: lease.leaseId,
    });

    expect(
      plane.revokeWriteLeaseAuthorized({
        terminalId: created.terminalId,
        participantId: "session:avatar",
        actorId: "session:admin",
      }),
    ).toEqual({
      ok: true,
      revokedCount: 1,
    });

    const blockedAgain = await plane.write({
      terminalId: created.terminalId,
      text: "needs approval again",
      actorId: "session:avatar",
      createApprovalRequest: false,
    });
    expect(blockedAgain.ok).toBe(false);
    expect(blockedAgain.message).toContain("approval");

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
      role: "guard",
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
      role: "guard",
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
      participantId: "session:guard-a",
      role: "guard",
    });
    plane.issueGrantAuthorized({
      terminalId: created.terminalId,
      actorId: "session:admin",
      participantId: "session:guard-b",
      role: "guard",
    });

    const pendingA = await plane.write({
      terminalId: created.terminalId,
      text: "approved request",
      actorId: "session:guard-a",
      createApprovalRequest: true,
    });
    const pendingB = await plane.write({
      terminalId: created.terminalId,
      text: "denied request",
      actorId: "session:guard-b",
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

  test("Scenario: Given live guard approval requests When listeners subscribe globally or by terminal Then each listener receives only its requested terminal scope", async () => {
    const plane = createPlane();
    plane.setActorPresence("session:admin", true);
    const alpha = await plane.create({
      terminalId: "approval-scope-alpha",
      bootstrapActorId: "session:admin",
      bootstrapRole: "admin",
    });
    const bravo = await plane.create({
      terminalId: "approval-scope-bravo",
      bootstrapActorId: "session:admin",
      bootstrapRole: "admin",
    });
    plane.issueGrantAuthorized({
      terminalId: alpha.terminalId,
      actorId: "session:admin",
      participantId: "session:guard",
      role: "guard",
    });
    plane.issueGrantAuthorized({
      terminalId: bravo.terminalId,
      actorId: "session:admin",
      participantId: "session:guard",
      role: "guard",
    });

    const globalEvents: Array<{ terminalId: string; requestId?: string }> = [];
    const alphaEvents: Array<{ terminalId: string; requestId?: string }> = [];
    const releaseGlobal = plane.onApprovalRequest((event) => {
      globalEvents.push({ terminalId: event.terminalId, requestId: event.request.requestId });
    });
    const releaseAlpha = plane.onApprovalRequest(
      (event) => {
        alphaEvents.push({ terminalId: event.terminalId, requestId: event.request.requestId });
      },
      { terminalId: alpha.terminalId },
    );

    const alphaWrite = await plane.write({
      terminalId: alpha.terminalId,
      text: "alpha approval",
      actorId: "session:guard",
    });
    const bravoWrite = await plane.write({
      terminalId: bravo.terminalId,
      text: "bravo approval",
      actorId: "session:guard",
    });

    expect(globalEvents).toEqual([
      { terminalId: alpha.terminalId, requestId: alphaWrite.approvalRequest?.requestId },
      { terminalId: bravo.terminalId, requestId: bravoWrite.approvalRequest?.requestId },
    ]);
    expect(alphaEvents).toEqual([{ terminalId: alpha.terminalId, requestId: alphaWrite.approvalRequest?.requestId }]);

    releaseGlobal();
    releaseAlpha();
    await plane.dispose();
  });

  test("Scenario: Given observable approval requests When callers lack terminal read access Then unauthorized previews are filtered before delivery", async () => {
    const plane = createPlane();
    plane.setActorPresence("session:admin", true);
    const alpha = await plane.create({
      terminalId: "approval-visible-alpha",
      bootstrapActorId: "session:admin",
      bootstrapRole: "admin",
    });
    const bravo = await plane.create({
      terminalId: "approval-visible-bravo",
      bootstrapActorId: "session:admin",
      bootstrapRole: "admin",
    });
    plane.issueGrantAuthorized({
      terminalId: alpha.terminalId,
      actorId: "session:admin",
      participantId: "session:observer",
      role: "readonly",
    });
    plane.issueGrantAuthorized({
      terminalId: alpha.terminalId,
      actorId: "session:admin",
      participantId: "session:guard",
      role: "guard",
    });
    plane.issueGrantAuthorized({
      terminalId: bravo.terminalId,
      actorId: "session:admin",
      participantId: "session:guard",
      role: "guard",
    });

    const alphaWrite = await plane.write({
      terminalId: alpha.terminalId,
      text: "observable alpha",
      actorId: "session:guard",
    });
    if (!alphaWrite.approvalRequest) {
      throw new Error("expected alpha guard write to create an approval request");
    }
    await plane.write({
      terminalId: bravo.terminalId,
      text: "hidden bravo",
      actorId: "session:guard",
    });

    expect(
      plane
        .listObservableApprovalRequests({
          actorId: "session:observer",
          statuses: ["pending"],
        })
        .map((request) => request.requestId),
    ).toEqual([alphaWrite.approvalRequest.requestId]);
    expect(() =>
      plane.listObservableApprovalRequests({
        terminalId: bravo.terminalId,
        actorId: "session:observer",
        statuses: ["pending"],
      }),
    ).toThrow("terminal access denied");

    await plane.dispose();
  });

  test("Scenario: Given repeated equivalent guard writes When a request is still pending Then the control plane refreshes one approval row", async () => {
    const plane = createPlane();
    plane.setActorPresence("session:admin", true);
    const created = await plane.create({
      terminalId: "approval-coalesced",
      bootstrapActorId: "session:admin",
      bootstrapRole: "admin",
    });
    plane.issueGrantAuthorized({
      terminalId: created.terminalId,
      actorId: "session:admin",
      participantId: "session:guard",
      role: "guard",
    });

    const events: Array<string | undefined> = [];
    const release = plane.onApprovalRequest((event) => {
      events.push(event.request.requestId);
    });
    const first = await plane.input({
      terminalId: created.terminalId,
      text: "\r",
      actorId: "session:guard",
    });
    const second = await plane.input({
      terminalId: created.terminalId,
      text: "\r",
      actorId: "session:guard",
    });
    const changed = await plane.input({
      terminalId: created.terminalId,
      text: "different\r",
      actorId: "session:guard",
    });

    expect(second.approvalRequest?.requestId).toBe(first.approvalRequest?.requestId);
    expect(changed.approvalRequest?.requestId).not.toBe(first.approvalRequest?.requestId);
    expect(
      plane.listApprovalRequests({
        terminalId: created.terminalId,
        statuses: ["pending"],
      }),
    ).toHaveLength(2);
    expect(events).toEqual([
      first.approvalRequest?.requestId,
      first.approvalRequest?.requestId,
      changed.approvalRequest?.requestId,
    ]);

    release();
    await plane.dispose();
  });

  test("Scenario: Given a pending guard approval When the terminal is killed and bootstrapped Then the stale request cannot mint a lease for the new live instance", async () => {
    const plane = createPlane();
    plane.setActorPresence("session:admin", true);
    const created = await plane.create({
      terminalId: "approval-stale-after-rebootstrap",
      bootstrapActorId: "session:admin",
      bootstrapRole: "admin",
    });
    plane.issueGrantAuthorized({
      terminalId: created.terminalId,
      actorId: "session:admin",
      participantId: "session:guard",
      role: "guard",
    });
    const pending = await plane.write({
      terminalId: created.terminalId,
      text: "old live input",
      actorId: "session:guard",
    });
    const requestId = pending.approvalRequest?.requestId;
    if (!requestId) {
      throw new Error("expected approval request");
    }

    await plane.stop(created.terminalId);
    plane.bootstrap({ terminalId: created.terminalId, recoveryIntent: "killed-history" });

    expect(
      plane
        .listApprovalRequests({
          terminalId: created.terminalId,
          statuses: ["expired"],
        })
        .map((request) => request.requestId),
    ).toContain(requestId);
    expect(() =>
      plane.approveRequestAuthorized({
        terminalId: created.terminalId,
        actorId: "session:admin",
        requestId,
        durationMs: 60_000,
      }),
    ).toThrow("unknown pending terminal approval request");

    await plane.dispose();
  });

  test("Scenario: Given killed terminal history When bootstrap lacks recovery intent Then it stays dead until explicit killed-history recovery", async () => {
    const plane = createPlane();
    plane.setActorPresence("session:admin", true);
    const created = await plane.create({
      terminalId: "explicit-history-recovery",
      bootstrapActorId: "session:admin",
      bootstrapRole: "admin",
    });

    await plane.stop(created.terminalId);

    expect(() =>
      plane.bootstrapAuthorized({
        terminalId: created.terminalId,
        actorId: "session:admin",
      }),
    ).toThrow("explicit killed-history recovery intent");
    expect(plane.list().some((entry) => entry.terminalId === created.terminalId)).toBeFalse();
    expect(plane.listHistory().find((entry) => entry.terminalId === created.terminalId)?.processPhase).toBe("killed");

    const recovered = plane.bootstrapAuthorized({
      terminalId: created.terminalId,
      actorId: "session:admin",
      recoveryIntent: "killed-history",
    });

    expect(recovered.processPhase).toBe("running");
    expect(plane.list().find((entry) => entry.terminalId === created.terminalId)?.processPhase).toBe("running");
    expect(plane.listHistory().some((entry) => entry.terminalId === created.terminalId)).toBeFalse();

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

  test("Scenario: Given guard transport input When no lease exists Then websocket input is rejected until an admin approves a write lease through the durable path", async () => {
    const plane = createPlane();
    plane.setActorPresence("session:admin", true);
    const created = await plane.create({
      terminalId: "transport-acl",
      bootstrapActorId: "session:admin",
      bootstrapRole: "admin",
    });
    const guard = plane.issueGrantAuthorized({
      terminalId: created.terminalId,
      actorId: "session:admin",
      participantId: "session:guard",
      role: "guard",
    });
    const transport = await plane.startTransport({ port: 0 });
    const endpoint = plane.getTransportEndpoint(created.terminalId, guard.accessToken);

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
        participantId: "session:guard",
      }),
    ).toHaveLength(0);

    const writePending = await plane.write({
      terminalId: created.terminalId,
      text: "lease me",
      actorId: "session:guard",
      accessToken: guard.accessToken,
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
    const frame = await pullLatestFrame({ socket, messages, lastFrame: null });
    expect(frame.lines.join("\n")).toContain("allowed transport");

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

  test("Scenario: Given a deleted deterministic terminal id When creating it again Then the tombstone does not block recreation or leak old grants", async () => {
    const plane = createPlane();
    const terminalId = "reusable-terminal-id";
    const created = await plane.create({
      terminalId,
      bootstrapActorId: "session:admin-a",
      bootstrapRole: "admin",
      start: false,
    });
    plane.issueGrantAuthorized({
      terminalId: created.terminalId,
      actorId: "session:admin-a",
      participantId: "session:guard",
      role: "guard",
    });

    const stopped = await plane.stopAuthorized({
      terminalId: created.terminalId,
      actorId: "session:admin-a",
    });
    const deleted = await plane.deleteAuthorized({
      terminalId: created.terminalId,
      actorId: "session:admin-a",
    });
    const recreated = await plane.create({
      terminalId,
      bootstrapActorId: "session:admin-b",
      bootstrapRole: "admin",
      start: false,
    });

    expect(stopped).toEqual({ ok: true, message: "terminal PTY stopped" });
    expect(deleted.ok).toBe(true);
    expect(recreated.terminalId).toBe(terminalId);
    expect(plane.listForActor("session:guard", { touchPresence: false })).toHaveLength(0);
    expect(plane.listForActor("session:admin-b", { touchPresence: false }).map((entry) => entry.terminalId)).toEqual([
      terminalId,
    ]);

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
    const sawTransportEcho = async (): Promise<TerminalTransportFramePayload> => {
      const startAt = Date.now();
      let latestFrame: TerminalTransportFramePayload | null = null;
      while (Date.now() - startAt <= 2_000) {
        latestFrame = await pullLatestFrame({ socket, messages, lastFrame: latestFrame });
        if (latestFrame.lines.join("\n").includes("typed raw transport")) {
          return latestFrame;
        }
        await Bun.sleep(25);
      }
      throw new Error("timeout waiting transport echo");
    };
    const latestFrame = await sawTransportEcho();

    expect(latestFrame.lines.join("\n")).toContain("typed raw transport");
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

  test("Scenario: Given guard transport live input bytes When no write lease exists Then the client receives an error without creating approval work", async () => {
    const plane = createPlane();
    plane.setActorPresence("session:admin", true);
    const created = await plane.create({
      terminalId: "transport-raw-acl",
      bootstrapActorId: "session:admin",
      bootstrapRole: "admin",
    });
    const guard = plane.issueGrantAuthorized({
      terminalId: created.terminalId,
      actorId: "session:admin",
      participantId: "session:guard",
      role: "guard",
    });
    await plane.startTransport({ port: 0 });
    const endpoint = plane.getTransportEndpoint(created.terminalId, guard.accessToken);
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
        participantId: "session:guard",
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
    expect(plane.list().find((entry) => entry.terminalId === created.terminalId)).toBeUndefined();
    expect(plane.list()).toHaveLength(0);
    expect(plane.listHistory().find((entry) => entry.terminalId === created.terminalId)?.processPhase).toBe("killed");

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

  test("Scenario: Given terminal invitations expire refresh or revoke while pending When acceptance uses old descriptors Then only the fresh pending descriptor can activate authority", async () => {
    const plane = createPlane();
    const admin = generatePrincipalKeyPair();
    const invitee = generatePrincipalKeyPair();
    plane.setActorPresence(admin.principalId, true);
    plane.setActorPresence(invitee.principalId, true);
    const created = await plane.create({
      terminalId: "managed-seat-expiry",
      bootstrapActorId: admin.principalId,
      bootstrapRole: "admin",
    });

    const expired = plane.inviteSeatAuthorized({
      terminalId: created.terminalId,
      actorId: admin.principalId,
      participantId: invitee.principalId,
      seatClass: "RW",
      label: "Expired writer",
      expiresAt: Date.now() - 1,
    });
    await expect(
      plane.acceptSeat({
        descriptor: expired.descriptor.deepLink,
        proof: await signManagedInvitationAcceptProof({
          privateKey: invitee.privateKey,
          payload: {
            invitationId: expired.invitationId,
            resourceKind: expired.resourceKind,
            resourceId: expired.resourceId,
            inviteePrincipalId: invitee.principalId,
            payloadDigest: expired.payloadDigest,
            expiresAt: expired.expiresAt,
          },
        }),
      }),
    ).rejects.toThrow(/expired|not pending/u);
    expect(listInvitations(plane, created.terminalId)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          invitationId: expired.invitationId,
          status: "expired",
        }),
      ]),
    );

    const firstPending = plane.inviteSeatAuthorized({
      terminalId: created.terminalId,
      actorId: admin.principalId,
      participantId: invitee.principalId,
      seatClass: "RW",
      label: "First pending",
      expiresAt: Date.now() + 10_000,
    });
    await Bun.sleep(5);
    const renewedPending = plane.inviteSeatAuthorized({
      terminalId: created.terminalId,
      actorId: admin.principalId,
      participantId: invitee.principalId,
      seatClass: "RW",
      label: "Renewed pending",
      expiresAt: Date.now() + 60_000,
    });
    expect(renewedPending.expiresAt).toBeGreaterThan(firstPending.expiresAt);
    const revokedSuperseded = listInvitations(plane, created.terminalId).find(
      (item) => item.invitationId === firstPending.invitationId,
    );
    expect(revokedSuperseded).toMatchObject({
      invitationId: firstPending.invitationId,
      status: "revoked",
      supersededByInvitationId: renewedPending.invitationId,
    });

    await expect(
      plane.acceptSeat({
        descriptor: firstPending.descriptor.deepLink,
        proof: await signManagedInvitationAcceptProof({
          privateKey: invitee.privateKey,
          payload: {
            invitationId: firstPending.invitationId,
            resourceKind: firstPending.resourceKind,
            resourceId: firstPending.resourceId,
            inviteePrincipalId: invitee.principalId,
            payloadDigest: firstPending.payloadDigest,
            expiresAt: firstPending.expiresAt,
          },
        }),
      }),
    ).rejects.toThrow(/not pending: revoked/u);

    expect(
      plane.revokeSeatAuthorized({
        terminalId: created.terminalId,
        actorId: admin.principalId,
        participantId: invitee.principalId,
      }),
    ).toEqual({ ok: true });

    await expect(
      plane.acceptSeat({
        descriptor: renewedPending.descriptor.deepLink,
        proof: await signManagedInvitationAcceptProof({
          privateKey: invitee.privateKey,
          payload: {
            invitationId: renewedPending.invitationId,
            resourceKind: renewedPending.resourceKind,
            resourceId: renewedPending.resourceId,
            inviteePrincipalId: invitee.principalId,
            payloadDigest: renewedPending.payloadDigest,
            expiresAt: renewedPending.expiresAt,
          },
        }),
      }),
    ).rejects.toThrow(/not pending: revoked/u);

    await plane.dispose();
  });

  test("Scenario: Given TerminalSystem source is inspected When composed surface code is checked Then cli-shell chrome tokens stay outside core", () => {
    const sourceRoot = resolve(import.meta.dir, "..", "src");
    const sourceText = readdirSync(sourceRoot, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith(".ts"))
      .map((entry) => readFileSync(join(sourceRoot, entry.name), "utf8"))
      .join("\n");

    expect(sourceText).not.toContain("managedLabel");
    expect(sourceText).not.toContain("dialogueDraft");
    expect(sourceText).not.toContain("unreadLabel");
    expect(sourceText).not.toContain("heartbeatLabel");
    expect(sourceText).not.toContain("托管 off");
    expect(sourceText).not.toContain("composedDialogue");
    expect(sourceText).not.toContain("composedManaged");
    expect(sourceText).not.toContain("composedUnread");
    expect(sourceText).not.toContain("composedHeartbeat");
  });
});
