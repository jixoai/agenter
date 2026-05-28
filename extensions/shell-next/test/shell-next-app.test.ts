import type { GlobalRoomEntry, GlobalRoomMessage, GlobalRoomSnapshotOutput } from "@agenter/client-sdk";
import type {
  TerminalTransportOwnerCoordinate,
  TerminalTransportSelectionOverlay,
} from "@agenter/terminal-transport-protocol";
import { MouseButton, TextAttributes } from "@opentui/core";
import { createTestRenderer, type TestRenderer } from "@opentui/core/testing";
import { afterEach, describe, expect, test } from "bun:test";

import { ShellNextApp } from "../src/app/shell-next-app";
import { OpenComposeTerminalFrameRenderable } from "../src/opencompose/terminal-frame/terminal-frame-renderable";
import { SHELL_NEXT_CLIPBOARD_TARGETS, type ShellNextClipboardTarget } from "../src/renderable-mux/host-copy";
import {
  createBunPtyPaneSource,
  createPaneSourceId,
  type PaneSource,
  type TerminalFrameSnapshot,
  type TerminalInputChunk,
  type TerminalPaneSize,
  type TerminalProtocolPaneSource,
} from "../src/renderable-mux/pane-source";
import type { LocalBunTerminalExitEvent } from "../src/sources/bun-terminal-protocol-source";
import type { ShellNextRoomBootstrapResult } from "../src/product/bootstrap";
import type { ShellNextRoomInput, ShellNextStatusProvider } from "../src/app/shell-next-app-types";
import type { ShellNextRoomSurfaceStore } from "../src/surfaces/room-surface";
import type { ShellNextApprovalRequest, ShellNextApprovalStore } from "../src/surfaces/top-layer-surface";

type TestSetup = Awaited<ReturnType<typeof createTestRenderer>>;

interface RecordingSource {
  readonly source: TerminalProtocolPaneSource;
  readonly inputChunks: TerminalInputChunk[];
  readonly resizeCalls: TerminalPaneSize[];
  readonly copyRequests: string[];
  readonly followCursorCalls: () => number;
  readonly selectionEvents: Array<{ type: "start" | "update" | "end"; point: TerminalTransportOwnerCoordinate }>;
  emitFrame(): void;
  emitSelectionText(event: { ownerId?: string; text: string }): void;
  copyResult: boolean | string;
  title: string;
  cursor: TerminalFrameSnapshot["cursor"] | undefined;
  selectionOverlays: readonly TerminalTransportSelectionOverlay[];
  readonly disposed: () => boolean;
}

let setup: TestSetup | null = null;
let activeApp: ShellNextApp | null = null;

afterEach(() => {
  activeApp?.destroy();
  activeApp = null;
  setup?.renderer.destroy();
  setup = null;
});

const createRecordingProtocolSource = (id: string): RecordingSource => {
  const inputChunks: TerminalInputChunk[] = [];
  const resizeCalls: TerminalPaneSize[] = [];
  const copyRequests: string[] = [];
  const selectionEvents: RecordingSource["selectionEvents"] = [];
  const listeners = new Set<() => void>();
  const selectionTextListeners = new Set<(event: { ownerId?: string; text: string }) => void>();
  let copyResult: boolean | string = true;
  let title = id;
  let cursor: TerminalFrameSnapshot["cursor"] | undefined;
  let followCursorCount = 0;
  let selectionOverlays: readonly TerminalTransportSelectionOverlay[] = [];
  let disposed = false;
  let revision = 0;
  const source: TerminalProtocolPaneSource = {
    kind: "terminal-protocol",
    id: createPaneSourceId(id),
    readTitle: () => title,
    readFrame: (): TerminalFrameSnapshot => ({
      size: resizeCalls.at(-1) ?? { cols: 40, rows: 10 },
      lines: [`${id} frame ${revision}`],
      cursor,
      selectionOverlays,
      revision,
    }),
    writeInput: (chunk) => {
      inputChunks.push(chunk);
      revision += 1;
    },
    resize: (size) => {
      resizeCalls.push(size);
    },
    selectionStart: (point) => {
      selectionEvents.push({ type: "start", point });
      return true;
    },
    selectionUpdate: (point) => {
      selectionEvents.push({ type: "update", point });
      return true;
    },
    selectionEnd: (point) => {
      selectionEvents.push({ type: "end", point });
      return true;
    },
    copySelection: (ownerId) => {
      copyRequests.push(ownerId ?? "");
      return copyResult;
    },
    followCursor: () => {
      followCursorCount += 1;
      return true;
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    subscribeSelectionText: (listener) => {
      selectionTextListeners.add(listener);
      return () => {
        selectionTextListeners.delete(listener);
      };
    },
    dispose: () => {
      disposed = true;
    },
  };
  return {
    source,
    inputChunks,
    resizeCalls,
    copyRequests,
    followCursorCalls: () => followCursorCount,
    selectionEvents,
    emitFrame() {
      revision += 1;
      for (const listener of listeners) {
        listener();
      }
    },
    emitSelectionText(event) {
      for (const listener of selectionTextListeners) {
        listener(event);
      }
    },
    get copyResult() {
      return copyResult;
    },
    set copyResult(value: boolean | string) {
      copyResult = value;
    },
    get title() {
      return title;
    },
    set title(value: string) {
      title = value;
    },
    get cursor() {
      return cursor;
    },
    set cursor(value: TerminalFrameSnapshot["cursor"] | undefined) {
      cursor = value;
    },
    get selectionOverlays() {
      return selectionOverlays;
    },
    set selectionOverlays(value: readonly TerminalTransportSelectionOverlay[]) {
      selectionOverlays = value;
    },
    disposed: () => disposed,
  };
};

const pendingApproval: ShellNextApprovalRequest = {
  requestId: "approval-1",
  terminalId: "terminal-1",
  participantId: "auth:assistant",
  status: "pending",
  requestedInput: { mode: "raw", text: "echo hello" },
  createdAt: 1,
};

class RecordingApprovalStore implements ShellNextApprovalStore {
  approval: ShellNextApprovalRequest | null = null;

  getPendingApproval(): ShellNextApprovalRequest | null {
    return this.approval;
  }

  approve(): void {
    this.approval = null;
  }

  deny(): void {
    this.approval = null;
  }
}

class ManualStatusProvider implements ShellNextStatusProvider {
  #state = {
    runtime: { label: "Idle" },
    actions: ["Help", "Chat"],
  };
  readonly #listeners = new Set<() => void>();

  getStatus() {
    return this.#state;
  }

  setRuntime(label: string): void {
    this.#state = {
      ...this.#state,
      runtime: { label },
    };
    for (const listener of this.#listeners) {
      listener();
    }
  }

  subscribe(listener: () => void): () => void {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }
}

class RecordingRoomStore implements ShellNextRoomSurfaceStore {
  readonly sentMessages: string[] = [];
  readonly room: GlobalRoomEntry = {
    chatId: "room-shell-next",
    kind: "room",
    title: "Shell Next Room",
    owner: "ops",
    participants: [],
    metadata: {},
    createdAt: 1,
    updatedAt: 1,
    roomRevision: "1",
    transcriptRevision: "1",
    focused: true,
    accessRole: "admin",
    accessToken: "tok:room-shell-next",
  };
  messages: GlobalRoomMessage[] = [
    {
      rowId: 1,
      messageId: 1,
      chatId: "room-shell-next",
      from: "@bangeel",
      senderActorId: "auth:bangeel" as GlobalRoomMessage["senderActorId"],
      kind: "text",
      content: "hello room",
      createdAt: 1,
      updatedAt: 1,
      readActorIds: [],
      unreadActorIds: [],
    },
  ];

  retainGlobalRoomSnapshot(): () => void {
    return () => undefined;
  }

  async hydrateGlobalRoomSnapshot(): Promise<GlobalRoomSnapshotOutput> {
    return {
      channel: this.room,
      items: this.messages,
      nextBefore: null,
      hasMoreBefore: false,
      headVersion: "1",
      roomRevision: "1",
      transcriptRevision: "1",
    };
  }

  async sendGlobalRoomMessage(input: { text: string }): Promise<{ ok: boolean }> {
    this.sentMessages.push(input.text);
    this.messages = [
      ...this.messages,
      {
        rowId: this.messages.length + 1,
        messageId: this.messages.length + 1,
        chatId: "room-shell-next",
        from: "me",
        kind: "text",
        content: input.text,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        readActorIds: [],
        unreadActorIds: [],
      },
    ];
    return { ok: true };
  }
}

class RecordingAttachedRoomStore extends RecordingRoomStore {
  subscribe(): () => void {
    return () => undefined;
  }

  getState() {
    return {
      globalRoomSnapshotsById: {
        [this.room.chatId]: {
          data: {
            channel: this.room,
            items: this.messages,
            nextBefore: null,
            hasMoreBefore: false,
            headVersion: "1",
            roomRevision: "1",
            transcriptRevision: "1",
          },
          loaded: true,
          loading: false,
          refreshing: false,
          error: null,
          refreshedAt: 1,
        },
      },
      globalTerminalApprovalsById: {},
    };
  }

  retainTerminalPermissionRequests(): () => void {
    return () => undefined;
  }

  async pageGlobalRoomMessages(): Promise<{
    items: GlobalRoomMessage[];
    hasMore: boolean;
    nextBefore: null;
    roomRevision: string;
    transcriptRevision: string;
    headVersion: string;
  }> {
    return {
      items: this.messages,
      hasMore: false,
      nextBefore: null,
      roomRevision: "1",
      transcriptRevision: "1",
      headVersion: "1",
    };
  }

  async hydrateGlobalTerminalApprovals(): Promise<[]> {
    return [];
  }

  async approveGlobalTerminalRequest(): Promise<unknown> {
    return {};
  }

  async denyGlobalTerminalRequest(): Promise<unknown> {
    return {};
  }
}

const createAttachedRoom = (store: RecordingAttachedRoomStore): ShellNextRoomBootstrapResult => {
  const attached = {
    avatar: {
      avatarPrincipalId: "avatar-principal-1",
      nickname: "shell",
      displayName: "Shell Assistant",
      runtimeId: "runtime-1",
    },
    avatarCreated: false,
    session: { id: "session-1" },
    clearedRuntimeSessionIds: [],
    avatarActorId: "avatar-principal-1",
    terminal: {
      created: false,
      entry: {
        terminalId: "terminal-1",
        transportUrl: "ws://127.0.0.1/terminal-1",
      },
    },
    room: {
      created: false,
      entry: store.room,
    },
    binding: {
      productId: "shell-next",
      resourceKey: "shell-next-test",
      terminalId: "terminal-1",
      roomId: store.room.chatId,
      runtimeSessionId: "session-1",
      runtimeId: "runtime-1",
      avatarActorId: "avatar-principal-1",
      hostingContextId: "context-1",
    },
    promptSeeded: false,
    memoryFiles: [],
    managed: {
      managed: false,
      contextId: "context-1",
      contextDir: "/tmp/shell-next-test",
      bindingsPath: "/tmp/shell-next-test/bindings.json",
    },
  };
  return attached as unknown as ShellNextRoomBootstrapResult;
};

const startApp = async (
  input: {
    approvalStore?: RecordingApprovalStore;
    room?: ShellNextRoomInput;
    roomStore?: RecordingRoomStore;
    showTopLayer?: boolean;
    statusProvider?: ShellNextStatusProvider;
  } = {},
) => {
  setup = await createTestRenderer({ width: 64, height: 18, useMouse: true, kittyKeyboard: true });
  const recordings: RecordingSource[] = [];
  const exitCallbacks: Array<(event: LocalBunTerminalExitEvent) => void> = [];
  const createTestTerminalSource = (input: {
    id: string;
    onExit: (event: LocalBunTerminalExitEvent) => void;
  }): PaneSource => {
    const recording = createRecordingProtocolSource(input.id);
    recordings.push(recording);
    exitCallbacks.push(input.onExit);
    return createBunPtyPaneSource({
      id: recording.source.id,
      launch: { command: "mock-shell" },
      protocol: recording.source,
    });
  };
  const app = new ShellNextApp({
    renderer: setup.renderer as TestRenderer,
    terminalSourcePolicy: {
      createInitialSource: createTestTerminalSource,
      createSplitSource: createTestTerminalSource,
    },
    approvalStore: input.approvalStore,
    showTopLayer: input.showTopLayer,
    statusProvider: input.statusProvider,
    room:
      input.room ??
      (input.roomStore
        ? {
            store: input.roomStore,
            chatId: input.roomStore.room.chatId,
            accessToken: input.roomStore.room.accessToken,
            title: input.roomStore.room.title,
          }
        : undefined),
  });
  activeApp = app;
  app.start();
  await setup.renderOnce();
  return { setup, app, recordings, exitCallbacks };
};

const findTextPosition = (frame: string, text: string): { x: number; y: number } | null => {
  const rows = frame.split("\n");
  for (let y = 0; y < rows.length; y += 1) {
    const x = rows[y].indexOf(text);
    if (x >= 0) {
      return { x, y };
    }
  }
  return null;
};

const findSpan = (setup: TestSetup, text: string) =>
  setup
    .captureSpans()
    .lines.flatMap((line) => line.spans)
    .find((span) => span.text.includes(text));

const readTextAttributesAt = (setup: TestSetup, position: { x: number; y: number }, text: string): number => {
  const line = setup.captureSpans().lines[position.y];
  let cursor = 0;
  let attributes = 0;
  for (const span of line?.spans ?? []) {
    const spanStart = cursor;
    const spanEnd = spanStart + span.width;
    const targetStart = position.x;
    const targetEnd = position.x + Bun.stringWidth(text);
    if (spanEnd > targetStart && spanStart < targetEnd) {
      attributes |= span.attributes;
    }
    cursor = spanEnd;
  }
  return attributes;
};

const waitForTerminalResizeDebounce = async (setup: TestSetup): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, 40));
  await setup.renderOnce();
};

describe("Feature: shell-next app runtime", () => {
  test("Scenario: Given shell-next starts When rendered Then it mounts one protocol-backed pane and native statusbar", async () => {
    const { setup, recordings } = await startApp();

    const frame = setup.captureCharFrame();
    const terminalFrame = setup.renderer.root.findDescendantById("pane-1-framebuffer-terminal-frame") as
      | OpenComposeTerminalFrameRenderable
      | undefined;
    expect(frame).toContain("source-1");
    expect(frame).toContain("source-1 frame 0");
    expect(frame).toContain("Idle");
    expect(frame).toContain("source-1 [x]");
    expect(frame).toContain("[Help] [Chat]");
    expect(terminalFrame).toBeInstanceOf(OpenComposeTerminalFrameRenderable);
    expect(terminalFrame?.terminalView.width).toBe(61);
    expect(recordings[0].resizeCalls.at(-1)).toEqual({ cols: 61, rows: 15 });
  });

  test("Scenario: Given focused terminal pane When typing text Then input routes to the owning source", async () => {
    const { recordings, setup } = await startApp();

    await setup.mockInput.typeText("pwd");

    expect(recordings[0].inputChunks).toEqual(["p", "w", "d"]);
  });

  test("Scenario: Given a focused shell pane When Ctrl+B then N is pressed Then shell-next splits and focuses the new pane", async () => {
    const { setup, recordings } = await startApp();

    setup.mockInput.pressKey("b", { ctrl: true });
    setup.mockInput.pressKey("n");
    await setup.renderOnce();

    expect(recordings).toHaveLength(2);
    const frame = setup.captureCharFrame();
    expect(frame).toContain("source-1");
    expect(frame).toContain("source-2");
    expect(frame).toContain("source-2 frame 0");
  });

  test("Scenario: Given a product-bound terminal policy without split capability When Ctrl+B then N is pressed Then shell-next does not create a local terminal substitute", async () => {
    setup = await createTestRenderer({ width: 64, height: 18, useMouse: true, kittyKeyboard: true });
    const recordings: RecordingSource[] = [];
    const notices: string[] = [];
    const createProductBoundSource = (id: string): PaneSource => {
      const recording = createRecordingProtocolSource(id);
      recordings.push(recording);
      return recording.source;
    };
    const app = new ShellNextApp({
      renderer: setup.renderer as TestRenderer,
      terminalSourcePolicy: {
        createInitialSource: (input) => createProductBoundSource(input.id),
        describeSplitUnavailable: () => "Product-bound terminal split is not implemented",
      },
      onTerminalSplitUnavailable: (reason) => {
        notices.push(reason);
      },
    });
    activeApp = app;
    app.start();
    await setup.renderOnce();

    setup.mockInput.pressKey("b", { ctrl: true });
    setup.mockInput.pressKey("n");
    await setup.renderOnce();

    expect(recordings).toHaveLength(1);
    expect(notices).toEqual(["Product-bound terminal split is not implemented"]);
    const frame = setup.captureCharFrame();
    expect(frame).toContain("Product-bound terminal split is not implemented");
    expect(frame).not.toContain("source-2");
  });

  test("Scenario: Given two panes When Ctrl+B then Left moves focus Then terminal input is routed to the adjacent pane", async () => {
    const { setup, recordings } = await startApp();
    setup.mockInput.pressKey("b", { ctrl: true });
    setup.mockInput.pressKey("n");
    await setup.renderOnce();

    setup.mockInput.pressKey("b", { ctrl: true });
    setup.mockInput.pressArrow("left");
    await setup.mockInput.typeText("x");

    expect(recordings[0].inputChunks).toEqual(["x"]);
    expect(recordings[1].inputChunks).toEqual([]);
  });

  test("Scenario: Given a focused terminal pane When bare Shift+Left is pressed Then shell-next forwards it to the terminal instead of moving focus", async () => {
    const { setup, recordings } = await startApp();
    setup.mockInput.pressKey("b", { ctrl: true });
    setup.mockInput.pressKey("n");
    await setup.renderOnce();

    setup.mockInput.pressArrow("left", { shift: true });
    await setup.renderOnce();
    await setup.mockInput.typeText("x");

    expect(recordings[0].inputChunks).toEqual([]);
    expect(recordings[1].inputChunks.at(-1)).toBe("x");
  });

  test("Scenario: Given a focused terminal pane When bare Ctrl+N is pressed Then it is forwarded as terminal input", async () => {
    const { setup, recordings } = await startApp();

    setup.mockInput.pressKey("n", { ctrl: true });
    await setup.renderOnce();

    expect(recordings).toHaveLength(1);
    expect(recordings[0].inputChunks).toEqual(["\u000e"]);
  });

  test("Scenario: Given the host resizes When renderer resize fires Then pane source receives updated geometry", async () => {
    const { setup, recordings } = await startApp();
    const beforeCalls = recordings[0].resizeCalls.length;

    setup.resize(80, 22);
    await setup.renderOnce();

    expect(recordings[0].resizeCalls.length).toBe(beforeCalls);

    await waitForTerminalResizeDebounce(setup);

    expect(recordings[0].resizeCalls.slice(beforeCalls)).toEqual([{ cols: 77, rows: 19 }]);
  });

  test("Scenario: Given a terminal source title changes When the pane refreshes Then shell-next projects the title in pane chrome", async () => {
    const { setup, recordings } = await startApp();

    recordings[0].title = "vim README.md";
    recordings[0].emitFrame();
    await setup.renderOnce();

    expect(setup.captureCharFrame()).toContain("vim README.md [x]");
  });

  test("Scenario: Given live status provider changes When it emits Then shell-next refreshes statusbar and terminal title chrome", async () => {
    const statusProvider = new ManualStatusProvider();
    const { setup, recordings } = await startApp({ statusProvider });

    recordings[0].title = "tail -f app.log";
    statusProvider.setRuntime("Active");
    await setup.renderOnce();

    const frame = setup.captureCharFrame();
    expect(frame).toContain("Active");
    expect(frame).toContain("tail -f app.log [x]");
  });

  test("Scenario: Given a terminal pane title bar When clicking its x affordance Then shell-next opens close confirmation in top layer", async () => {
    const { setup } = await startApp();

    await setup.mockMouse.click(11, 0);
    await setup.renderOnce();

    expect(setup.captureCharFrame()).toContain("[ Run in background ]");
    expect(setup.captureCharFrame()).toContain("[ Terminate terminal ]");
  });

  test("Scenario: Given a terminal cursor is viewport-local When shell-next renders Then it commits the cursor on the first content row", async () => {
    const { setup, recordings } = await startApp();
    const cursorCommits: Array<{ x: number; y: number; visible: boolean }> = [];
    const originalSetCursorPosition = setup.renderer.setCursorPosition.bind(setup.renderer);
    setup.renderer.setCursorPosition = ((x: number, y: number, visible = true) => {
      cursorCommits.push({ x, y, visible });
      originalSetCursorPosition(x, y, visible);
    }) as typeof setup.renderer.setCursorPosition;

    recordings[0].cursor = { x: 4, y: 0, visible: true };
    setup.resize(65, 18);
    await setup.renderOnce();

    expect(cursorCommits.at(-1)).toEqual({ x: 6, y: 2, visible: true });
    setup.renderer.setCursorPosition = originalSetCursorPosition;
  });

  test("Scenario: Given Ctrl+B then H When rendered Then Help opens as a direct OpenTUI surface", async () => {
    const { setup, recordings } = await startApp();

    setup.mockInput.pressKey("b", { ctrl: true });
    setup.mockInput.pressKey("h");
    await setup.renderOnce();
    await setup.mockInput.typeText("ignored");

    expect(setup.captureCharFrame()).toContain("shell-next help");
    expect(recordings[0].inputChunks).toEqual([]);
  });

  test("Scenario: Given Ctrl+B then C When rendered Then Chat opens as a direct OpenTUI surface", async () => {
    const { setup, recordings } = await startApp();

    setup.mockInput.pressKey("b", { ctrl: true });
    setup.mockInput.pressKey("c");
    await setup.renderOnce();
    await setup.mockInput.typeText("ignored");

    expect(setup.captureCharFrame()).toContain("shell-next chat");
    expect(recordings[0].inputChunks).toEqual([]);
  });

  test("Scenario: Given Chat title actions When clicking left and float Then shell-next moves Chat through host layout modes", async () => {
    const { setup } = await startApp();

    setup.mockInput.pressKey("b", { ctrl: true });
    setup.mockInput.pressKey("c");
    await setup.renderOnce();

    expect(setup.captureCharFrame()).toContain("Chat [←] [→] [⿻] [x]");
    expect((findSpan(setup, "[→]")?.attributes ?? 0) & TextAttributes.UNDERLINE).toBe(TextAttributes.UNDERLINE);

    const rightDockedTitle = findTextPosition(setup.captureCharFrame(), "Chat [←] [→] [⿻] [x]");
    expect(rightDockedTitle).not.toBeNull();
    await setup.mockMouse.click((rightDockedTitle?.x ?? 0) + "Chat ".length + 1, rightDockedTitle?.y ?? 0);
    await setup.renderOnce();
    const leftFrame = setup.captureCharFrame();
    expect(leftFrame).toContain("Chat [←] [→] [⿻] [x]");
    const leftDockedTitle = findTextPosition(leftFrame, "Chat [←] [→] [⿻] [x]");
    expect(leftDockedTitle).not.toBeNull();
    expect(
      readTextAttributesAt(
        setup,
        { x: (leftDockedTitle?.x ?? 0) + "Chat ".length, y: leftDockedTitle?.y ?? 0 },
        "[←]",
      ) & TextAttributes.UNDERLINE,
    ).toBe(TextAttributes.UNDERLINE);
    expect(leftFrame.indexOf("Chat [←] [→] [⿻] [x]")).toBeLessThan(leftFrame.indexOf("source-1 [x]"));

    await setup.mockMouse.click((leftDockedTitle?.x ?? 0) + "Chat [←] [→] ".length + 1, leftDockedTitle?.y ?? 0);
    await setup.renderOnce();
    const floatingFrame = setup.captureCharFrame();
    expect(floatingFrame).toContain("Chat [←] [→] [⿻] [x]");
    const floatingTitle = findTextPosition(floatingFrame, "Chat [←] [→] [⿻] [x]");
    expect(floatingTitle).not.toBeNull();
    expect(
      readTextAttributesAt(
        setup,
        { x: (floatingTitle?.x ?? 0) + "Chat [←] [→] ".length, y: floatingTitle?.y ?? 0 },
        "[⿻]",
      ) & TextAttributes.UNDERLINE,
    ).toBe(TextAttributes.UNDERLINE);
    expect(floatingFrame).not.toContain("[Float]");
    expect(floatingFrame).toContain("0 muted");
  });

  test("Scenario: Given Chat title actions When hovering close Then only the hovered bracketed action is bolded", async () => {
    const { setup } = await startApp();

    setup.mockInput.pressKey("b", { ctrl: true });
    setup.mockInput.pressKey("c");
    await setup.renderOnce();
    const title = findTextPosition(setup.captureCharFrame(), "Chat [←] [→] [⿻] [x]");
    expect(title).not.toBeNull();

    await setup.mockMouse.moveTo((title?.x ?? 0) + "Chat [←] [→] [⿻] ".length + 1, title?.y ?? 0);
    await setup.renderOnce();

    expect(
      readTextAttributesAt(
        setup,
        { x: (title?.x ?? 0) + "Chat [←] [→] [⿻] ".length, y: title?.y ?? 0 },
        "[x]",
      ) & TextAttributes.BOLD,
    ).toBe(TextAttributes.BOLD);
    expect(
      readTextAttributesAt(setup, { x: (title?.x ?? 0) + "Chat ".length, y: title?.y ?? 0 }, "[←]") &
        TextAttributes.BOLD,
    ).toBe(0);
  });

  test("Scenario: Given Shell and Chat panes share a border When dragging the border handle Then the terminal pane geometry changes", async () => {
    const { setup, recordings } = await startApp();

    setup.mockInput.pressKey("b", { ctrl: true });
    setup.mockInput.pressKey("c");
    await setup.renderOnce();
    await waitForTerminalResizeDebounce(setup);
    const beforeCols = recordings[0].resizeCalls.at(-1)?.cols ?? 0;
    expect(setup.captureCharFrame()).toContain("◀▶");

    await setup.mockMouse.pressDown(32, 8);
    await setup.mockMouse.emitMouseEvent("drag", 32, 8);
    await setup.mockMouse.emitMouseEvent("drag", 37, 8);
    await setup.mockMouse.release(37, 8);
    await setup.renderOnce();

    expect(recordings[0].resizeCalls.at(-1)?.cols ?? 0).toBe(beforeCols);

    await waitForTerminalResizeDebounce(setup);

    expect(recordings[0].resizeCalls.at(-1)?.cols ?? 0).toBeGreaterThan(beforeCols);
  });

  test("Scenario: Given Shell and Chat panes share a border When clicking the border handle Then the terminal pane grows by one column", async () => {
    const { setup, recordings } = await startApp();

    setup.mockInput.pressKey("b", { ctrl: true });
    setup.mockInput.pressKey("c");
    await setup.renderOnce();
    await waitForTerminalResizeDebounce(setup);
    const beforeCols = recordings[0].resizeCalls.at(-1)?.cols ?? 0;
    const handle = findTextPosition(setup.captureCharFrame(), "◀▶");
    expect(handle).not.toBeNull();

    await setup.mockMouse.click(handle?.x ?? 0, handle?.y ?? 0);
    await new Promise((resolve) => setTimeout(resolve, 0));
    await setup.renderOnce();

    await waitForTerminalResizeDebounce(setup);

    expect(recordings[0].resizeCalls.at(-1)?.cols).toBe(beforeCols + 1);
  });

  test("Scenario: Given rapid Shell pane resize When layout syncs repeatedly Then backend resize delivery is coalesced to the newest size", async () => {
    const { setup, recordings } = await startApp();
    const beforeCalls = recordings[0].resizeCalls.length;

    setup.resize(70, 18);
    setup.resize(72, 18);
    setup.resize(74, 18);
    await setup.renderOnce();

    expect(recordings[0].resizeCalls.length).toBe(beforeCalls);

    await waitForTerminalResizeDebounce(setup);

    expect(recordings[0].resizeCalls.slice(beforeCalls)).toEqual([{ cols: 71, rows: 15 }]);
  });

  test("Scenario: Given a focused shell pane When one bracketed paste event arrives Then it reaches the backend once", async () => {
    const { setup, recordings } = await startApp();

    await setup.mockInput.pasteBracketedText("pasted once");
    await setup.renderOnce();

    expect(recordings[0].inputChunks).toEqual(["pasted once"]);
    expect(recordings[0].followCursorCalls()).toBe(1);
  });

  test("Scenario: Given the mixed statusbar When Help and Chat are clicked Then shell-next toggles the corresponding panes", async () => {
    const { setup } = await startApp();

    await setup.mockMouse.click(55, 17);
    await setup.renderOnce();
    expect(setup.captureCharFrame()).toContain("shell-next help");

    await setup.mockMouse.click(61, 17);
    await setup.renderOnce();
    expect(setup.captureCharFrame()).toContain("shell-next chat");
  });

  test("Scenario: Given product surfaces are open When statusbar renders Then active actions are underlined", async () => {
    const { setup } = await startApp();

    setup.mockInput.pressKey("b", { ctrl: true });
    setup.mockInput.pressKey("h");
    await setup.renderOnce();
    const help = findTextPosition(setup.captureCharFrame(), "[Help]");
    expect(help).not.toBeNull();

    expect(readTextAttributesAt(setup, { x: help?.x ?? 0, y: help?.y ?? 0 }, "[Help]") & TextAttributes.UNDERLINE).toBe(
      TextAttributes.UNDERLINE,
    );

    setup.mockInput.pressKey("b", { ctrl: true });
    setup.mockInput.pressKey("c");
    await setup.renderOnce();
    const chat = findTextPosition(setup.captureCharFrame(), "[Chat]");
    expect(chat).not.toBeNull();

    expect(readTextAttributesAt(setup, { x: chat?.x ?? 0, y: chat?.y ?? 0 }, "[Chat]") & TextAttributes.UNDERLINE).toBe(
      TextAttributes.UNDERLINE,
    );
  });

  for (const shortcut of [
    { label: "Meta+C", options: { meta: true } },
    { label: "Super+C", options: { super: true } },
    { label: "Ctrl+Shift+C", options: { ctrl: true, shift: true } },
  ] as const) {
    test(`Scenario: Given a focused terminal pane When ${shortcut.label} is pressed Then shell-next copies backend terminal selection without forwarding input`, async () => {
      const { setup, recordings } = await startApp();

      setup.mockInput.pressKey("c", shortcut.options);
      await setup.renderOnce();

      expect(recordings[0].copyRequests).toEqual(["terminal"]);
      expect(recordings[0].inputChunks).toEqual([]);
    });
  }

  test("Scenario: Given a local terminal selection string When Super+C is pressed Then shell-next copies it through OSC52", async () => {
    const { setup, recordings } = await startApp();
    const copied: string[] = [];
    recordings[0].copyResult = "selected terminal text";
    setup.renderer.copyToClipboardOSC52 = ((text: string, target?: ShellNextClipboardTarget) => {
      copied.push(`${target ?? SHELL_NEXT_CLIPBOARD_TARGETS.clipboard}:${text}`);
      return true;
    }) as typeof setup.renderer.copyToClipboardOSC52;

    setup.mockInput.pressKey("c", { meta: true });
    await setup.renderOnce();

    expect(recordings[0].copyRequests).toEqual(["terminal"]);
    expect(copied).toEqual([`${SHELL_NEXT_CLIPBOARD_TARGETS.clipboard}:selected terminal text`]);
  });

  test("Scenario: Given a live terminal copies asynchronously When selection text arrives Then shell-next writes OSC52 clipboard data", async () => {
    const { setup, recordings } = await startApp();
    const copied: string[] = [];
    setup.renderer.copyToClipboardOSC52 = ((text: string, target?: ShellNextClipboardTarget) => {
      copied.push(`${target ?? SHELL_NEXT_CLIPBOARD_TARGETS.clipboard}:${text}`);
      return true;
    }) as typeof setup.renderer.copyToClipboardOSC52;

    setup.mockInput.pressKey("c", { meta: true });
    recordings[0].emitSelectionText({ ownerId: "terminal", text: "async selected text" });
    await setup.renderOnce();

    expect(recordings[0].copyRequests).toEqual(["terminal"]);
    expect(copied).toContain(`${SHELL_NEXT_CLIPBOARD_TARGETS.clipboard}:async selected text`);
  });

  test("Scenario: Given a shell pane drag selection When the backend frame receives mouse events Then it routes selection to the terminal source", async () => {
    const { setup, recordings } = await startApp();

    await setup.mockMouse.drag(2, 1, 10, 1);
    await setup.renderOnce();

    expect(recordings[0].selectionEvents.map((event) => event.type)).toContain("start");
    expect(recordings[0].selectionEvents.map((event) => event.type)).toContain("update");
    expect(recordings[0].selectionEvents.map((event) => event.type)).toContain("end");
    expect(recordings[0].selectionEvents.every((event) => event.point.ownerId === "terminal")).toBe(true);
    expect(recordings[0].selectionEvents[0]?.point).toEqual({ ownerId: "terminal", row: 0, col: 1 });
  });

  test("Scenario: Given backend selection overlay changes without text changes When frame refreshes Then ShellPane keeps selection visible", async () => {
    const { setup, recordings } = await startApp();
    const terminalFrame = setup.renderer.root.findDescendantById("pane-1-framebuffer-terminal-frame") as
      | OpenComposeTerminalFrameRenderable
      | undefined;
    expect(terminalFrame).toBeInstanceOf(OpenComposeTerminalFrameRenderable);

    recordings[0].selectionOverlays = [
      {
        ownerId: "terminal",
        ownership: "backend-native",
        rows: [{ row: 0, startCol: 0, endCol: 8 }],
      },
    ];
    recordings[0].emitFrame();
    await setup.renderOnce();

    expect(terminalFrame?.terminalView.hasSelection()).toBe(true);
  });

  test("Scenario: Given a renderer pane selection When Super+C is pressed Then shell-next copies the selected text through OSC52", async () => {
    const { setup } = await startApp();
    const copied: string[] = [];
    const originalCopy = setup.renderer.copyToClipboardOSC52.bind(setup.renderer);
    setup.renderer.copyToClipboardOSC52 = ((text: string, target?: ShellNextClipboardTarget) => {
      copied.push(`${target ?? SHELL_NEXT_CLIPBOARD_TARGETS.clipboard}:${text}`);
      return true;
    }) as typeof setup.renderer.copyToClipboardOSC52;

    setup.mockInput.pressKey("b", { ctrl: true });
    setup.mockInput.pressKey("h");
    await setup.renderOnce();
    await setup.mockMouse.drag(34, 4, 54, 4);
    const selectedText = setup.renderer.getSelection()?.getSelectedText() ?? "";
    setup.mockInput.pressKey("c", { meta: true });
    await setup.renderOnce();

    expect(selectedText.length > 0).toBe(true);
    expect(copied).toContain(`${SHELL_NEXT_CLIPBOARD_TARGETS.primary}:${selectedText}`);
    expect(copied).toContain(`${SHELL_NEXT_CLIPBOARD_TARGETS.clipboard}:${selectedText}`);
    setup.renderer.copyToClipboardOSC52 = originalCopy;
  });

  test("Scenario: Given a renderer pane text selection When the drag finishes Then shell-next mirrors it to the primary selection", async () => {
    const { setup } = await startApp();
    const copied: string[] = [];
    const originalCopy = setup.renderer.copyToClipboardOSC52.bind(setup.renderer);
    setup.renderer.copyToClipboardOSC52 = ((text: string, target?: ShellNextClipboardTarget) => {
      copied.push(`${target ?? SHELL_NEXT_CLIPBOARD_TARGETS.clipboard}:${text}`);
      return true;
    }) as typeof setup.renderer.copyToClipboardOSC52;

    setup.mockInput.pressKey("b", { ctrl: true });
    setup.mockInput.pressKey("c");
    await setup.renderOnce();
    await setup.mockMouse.drag(34, 1, 46, 1);
    await setup.renderOnce();

    expect(copied.some((entry) => entry.startsWith(`${SHELL_NEXT_CLIPBOARD_TARGETS.primary}:`))).toBe(true);
    setup.renderer.copyToClipboardOSC52 = originalCopy;
  });

  test("Scenario: Given renderer pane text is selected When middle-clicking Then shell-next does not clear the visible selection", async () => {
    const { setup } = await startApp();

    setup.mockInput.pressKey("b", { ctrl: true });
    setup.mockInput.pressKey("c");
    await setup.renderOnce();
    await setup.mockMouse.drag(34, 1, 46, 1);
    await setup.renderOnce();
    const selectedText = setup.renderer.getSelection()?.getSelectedText() ?? "";
    expect(selectedText.length > 0).toBe(true);

    await setup.mockMouse.click(36, 3, MouseButton.MIDDLE);
    await setup.renderOnce();

    expect(setup.renderer.getSelection()?.getSelectedText()).toBe(selectedText);
  });

  test("Scenario: Given Room-backed Chat is toggled When the user sends a draft Then MessageSystem store receives the message", async () => {
    const roomStore = new RecordingRoomStore();
    const { setup, recordings } = await startApp({ roomStore });

    setup.mockInput.pressKey("b", { ctrl: true });
    setup.mockInput.pressKey("c");
    await new Promise((resolve) => setTimeout(resolve, 0));
    await setup.renderOnce();
    await setup.mockInput.typeText("hi room");
    setup.mockInput.pressEnter();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await setup.renderOnce();

    const frame = setup.captureCharFrame();
    expect(frame).toContain("Room: Shell Next Room");
    expect(frame).toContain("hello room");
    expect(frame).toContain("hi room");
    expect(roomStore.sentMessages).toEqual(["hi room"]);
    expect(recordings[0].inputChunks).toEqual([]);
  });

  test("Scenario: Given a Room-backed Chat pane and close dialog When Esc cancels the dialog Then Chat remains mounted", async () => {
    const roomStore = new RecordingRoomStore();
    const { setup } = await startApp({ roomStore });

    setup.mockInput.pressKey("b", { ctrl: true });
    setup.mockInput.pressKey("c");
    await new Promise((resolve) => setTimeout(resolve, 0));
    await setup.renderOnce();
    setup.mockInput.pressKey("b", { ctrl: true });
    setup.mockInput.pressKey("q");
    await setup.renderOnce();

    expect(setup.captureCharFrame()).toContain("[ Run in background ]");

    setup.mockInput.pressEscape();
    await setup.renderOnce();

    const frame = setup.captureCharFrame();
    expect(frame).toContain("Room: Shell Next Room");
    expect(frame).not.toContain("[ Run in background ]");
  });

  test("Scenario: Given focused Chat pane has a draft When Esc is pressed Then pane scope consumes it without closing Chat", async () => {
    const roomStore = new RecordingAttachedRoomStore();
    const attached = createAttachedRoom(roomStore);
    const { setup, recordings } = await startApp({
      room: {
        store: roomStore,
        attached,
        shellName: "shell-next-test",
      },
    });

    setup.mockInput.pressKey("b", { ctrl: true });
    setup.mockInput.pressKey("c");
    await new Promise((resolve) => setTimeout(resolve, 0));
    await setup.renderOnce();
    await setup.mockInput.typeText("draft");
    await setup.renderOnce();

    expect(setup.captureCharFrame()).toContain("draft");

    setup.mockInput.pressEscape();
    await setup.renderOnce();

    const frame = setup.captureCharFrame();
    expect(frame).toContain("Chat [←] [→] [⿻] [x]");
    expect(frame).not.toContain("draft");
    expect(recordings.at(-1)?.inputChunks).toEqual([]);
  });

  test("Scenario: Given approval overlay is shown directly When keys are handled Then approval input is not forwarded to terminal pane", async () => {
    const approvalStore = new RecordingApprovalStore();
    approvalStore.approval = pendingApproval;
    const { setup, recordings } = await startApp({ approvalStore, showTopLayer: true });

    await setup.renderOnce();
    setup.mockInput.pressKey("a");
    await new Promise((resolve) => setTimeout(resolve, 0));
    await setup.renderOnce();

    expect(setup.captureCharFrame()).toContain("terminal write approved");
    expect(recordings[0].inputChunks).toEqual([]);
  });

  test("Scenario: Given shell-next is destroyed When a pane exits later Then cleanup remains idempotent", async () => {
    const { app, exitCallbacks } = await startApp();

    app.destroy();
    activeApp = null;

    expect(() =>
      exitCallbacks[0]?.({
        paneId: "source-1",
        ptyExitCode: 0,
        processExitCode: 0,
        signalCode: null,
      }),
    ).not.toThrow();
  });
});
