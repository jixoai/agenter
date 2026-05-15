import { afterEach, describe, expect, test } from "bun:test";

import type { ProductTerminalComposedSurfaceState } from "@agenter/client-sdk";
import type {
  TerminalTransportClientMessage,
  TerminalTransportServerMessage,
  TerminalTransportSnapshot,
} from "@agenter/terminal-transport-protocol";

import type { CliShellBootstrapResult, CliShellLiveTerminalTransportSessionFactory } from "../src";
import { resolveCliShellTuiKeybindings } from "../src";
import { startCliShellWebHost } from "../src/web";
import { startCliShellWebProductHost } from "../src/web/web-product-host";
import { createFakeCliShellProductHostStore } from "./fake-cli-shell-store";
import { createTestTransportSession } from "./test-transport-session";

const stopControllers: Array<{ stop(): Promise<void> }> = [];

const createAttachedFixture = (input: {
  sessionId: string;
  shellTerminalId: string;
  visibleTerminalId: string;
  roomChatId: string;
  created?: boolean;
}): CliShellBootstrapResult =>
  ({
    avatar: { nickname: "shell-assistant", runtimeId: "runtime:shell-assistant" },
    session: { id: input.sessionId },
    avatarActorId: "auth:shell-assistant",
    shellTruthTerminal: {
      entry: {
        terminalId: input.shellTerminalId,
      },
      created: input.created ?? true,
    },
    visibleTerminal: {
      entry: {
        terminalId: input.visibleTerminalId,
      },
      created: input.created ?? true,
    },
    room: {
      entry: {
        chatId: input.roomChatId,
      },
      created: input.created ?? true,
    },
    promptSeeded: false,
    memoryFiles: [],
    managed: {
      managed: false,
      hostingActive: false,
      activeDelegation: null,
      contextId: `ctx-hosting-${input.visibleTerminalId}`,
      hostingMatches: [],
    },
  }) as unknown as CliShellBootstrapResult;

const createSurfaceFixture = (input: {
  terminalId: string;
  shellTerminalId: string;
  dialogueOpen: boolean;
  bodyLine: string;
  dialogueLine?: string;
}): ProductTerminalComposedSurfaceState => {
  const lines = [
    input.bodyLine,
    input.dialogueOpen ? (input.dialogueLine ?? "│ dialogue frame │") : "shell-only row",
    "◉ terminal-2 bottom",
  ].concat(Array.from({ length: 21 }, () => ""));
  return {
    shellTerminalId: input.shellTerminalId,
    terminalId: input.terminalId,
    shellSnapshotSeq: 7,
    cols: 80,
    rows: 24,
    bottomLine: "◉ terminal-2 bottom",
    dialogueOpen: input.dialogueOpen,
    dialoguePlacement: input.dialogueOpen ? "right" : null,
    dialogueDraft: input.dialogueOpen ? "draft" : "",
    managedLabel: "托管 off",
    unreadLabel: "✉ 0",
    heartbeatLabel: "ready",
    terminalLines: lines,
    terminalRichLines: lines.map((text) => ({ spans: text.length > 0 ? [{ text }] : [] })),
    cursor: { x: input.dialogueOpen ? 4 : 0, y: input.dialogueOpen ? 1 : 0, visible: true },
    scrollback: {
      viewportOffset: 0,
      totalLines: 24,
      screenLines: 24,
    },
  };
};

const createShellSnapshotFixture = (input: {
  lines: string[];
  cols?: number;
  rows?: number;
  viewportOffset?: number;
  seq?: number;
}): TerminalTransportSnapshot & { timestamp: number } => ({
  seq: input.seq ?? 2,
  timestamp: Date.now(),
  cols: input.cols ?? 80,
  rows: input.rows ?? 24,
  lines: [...input.lines],
  richLines: input.lines.map((text) => ({
    spans: text.length > 0 ? [{ text }] : [],
  })),
  cursor: { x: 0, y: Math.max(0, input.lines.length - 1), visible: true },
  scrollback: {
    viewportOffset: input.viewportOffset ?? Math.max(0, input.lines.length - (input.rows ?? 24)),
    totalLines: input.lines.length,
    screenLines: input.rows ?? 24,
  },
});

const createProductHostTransportHarness = (initialSnapshot: TerminalTransportSnapshot): {
  sent: TerminalTransportClientMessage[];
  createTransportSession: CliShellLiveTerminalTransportSessionFactory;
} => {
  let snapshot = structuredClone(initialSnapshot);
  const sent: TerminalTransportClientMessage[] = [];
  const publish = (
    terminalId: string | undefined,
    events: { onMessage: (message: TerminalTransportServerMessage) => void },
  ): void => {
    events.onMessage({
      type: "frame",
      terminalId: terminalId ?? "shell-transport:terminal-1",
      frameSeq: snapshot.seq,
      status: "IDLE",
      patch: {
        type: "full",
        frame: snapshot,
      },
    });
  };
  return {
    sent,
    createTransportSession(input) {
      return createTestTransportSession({
        async connect(): Promise<void> {
          input.events.onOpen();
          publish(input.terminalId, input.events);
        },
        disconnect(): void {
          input.events.onClose();
        },
        send(message: TerminalTransportClientMessage): boolean {
          sent.push(message);
          if (message.type === "viewportTarget") {
            snapshot = {
              ...snapshot,
              seq: snapshot.seq + 1,
              scrollback: {
                ...snapshot.scrollback,
                viewportOffset: Math.max(0, message.viewportStart),
              },
            };
            publish(input.terminalId, input.events);
          }
          if (message.type === "viewportDelta") {
            snapshot = {
              ...snapshot,
              seq: snapshot.seq + 1,
              scrollback: {
                ...snapshot.scrollback,
                viewportOffset: Math.max(0, snapshot.scrollback.viewportOffset + message.deltaRows),
              },
            };
            publish(input.terminalId, input.events);
          }
          return true;
        },
        getConnectionState() {
          return "connected";
        },
      });
    },
  };
};

afterEach(async () => {
  while (stopControllers.length > 0) {
    const controller = stopControllers.pop();
    await controller?.stop();
  }
});

describe("Feature: cli-shell web host", () => {
  test("Scenario: Given an attached backend terminal When starting cli-shell web host Then it serves terminal-2 product host assets and browser facts for the final product truth", async () => {
    const store = createFakeCliShellProductHostStore();
    await store.createGlobalTerminal({
      terminalId: "shell-1",
      backend: "xterm",
      command: ["/bin/bash"],
      cwd: "/repo",
    });
    await store.createGlobalTerminal({
      terminalId: "shell-1:terminal-1",
      backend: "xterm",
      command: ["/bin/bash"],
      cwd: "/repo",
    });
    await store.setGlobalTerminalConfig({
      terminalId: "shell-1",
      metadata: {
        terminalRuntimeKind: "composed",
        composedShellTerminalId: "shell-1:terminal-1",
      },
    });

    const attached = {
      avatar: { nickname: "shell-assistant", runtimeId: "runtime:shell-assistant" },
      session: { id: "session-1" },
      avatarActorId: "auth:shell-assistant",
      shellTruthTerminal: {
        entry: {
          terminalId: "shell-1:terminal-1",
        },
        created: true,
      },
      visibleTerminal: {
        entry: {
          terminalId: "shell-1",
        },
        created: true,
      },
      room: {
        entry: {
          chatId: "room-shell-1",
        },
        created: true,
      },
      promptSeeded: false,
      memoryFiles: [],
      managed: {
        managed: false,
        hostingActive: false,
        activeDelegation: null,
        contextId: "ctx-hosting-shell-1",
        hostingMatches: [],
      },
    } as unknown as CliShellBootstrapResult;

    const controller = await startCliShellWebHost({
      store,
      attached,
      requestedPort: 0,
    });
    stopControllers.push(controller);

    const pageResponse = await fetch(controller.url);
    expect(pageResponse.status).toBe(200);
    expect(pageResponse.headers.get("content-type")).toContain("text/html");
    const pageHtml = await pageResponse.text();
    expect(pageHtml).toContain('<div id="app"></div>');
    expect(pageHtml).toContain("window.__CLI_SHELL_WEB_HOST__");
    expect(pageHtml).toContain('"terminalId":"shell-1"');
    expect(pageHtml).toContain('"rendererPreference":"auto"');
    expect(pageHtml).toContain('"snapshotUrl":"/terminal-snapshot.json"');
    expect(pageHtml).toContain('"productStateUrl":"/product-state.json"');
    expect(pageHtml).toContain('"productEventUrl":"/product-event"');
    expect(pageHtml).not.toContain("<header");
    expect(pageHtml).not.toContain("sidebar");
    expect(pageHtml).not.toContain('"lines":["');

    const scriptMatch = pageHtml.match(/<script type="module" src="([^"]+)"/);
    expect(scriptMatch?.[1]).toBeTruthy();
    const scriptResponse = await fetch(new URL(scriptMatch![1], controller.url));
    expect(scriptResponse.status).toBe(200);
    expect(scriptResponse.headers.get("content-type")).toMatch(/javascript/);
    const scriptBody = await scriptResponse.text();
    expect(scriptBody.length).toBeGreaterThan(0);

    const snapshotResponse = await fetch(new URL("/terminal-snapshot.json", controller.url));
    expect(snapshotResponse.status).toBe(200);
    expect(snapshotResponse.headers.get("content-type")).toContain("application/json");
    const snapshot = await snapshotResponse.json();
    expect(snapshot.cols).toBe(80);
    expect(snapshot.rows).toBe(24);

    const productStateResponse = await fetch(new URL("/product-state.json", controller.url));
    expect(productStateResponse.status).toBe(200);
    const productState = await productStateResponse.json();
    expect(productState).toHaveProperty("textEvidence");
    expect(productState).toHaveProperty("surface");
    expect(productState.textEvidence).toContain("terminal");

    const stylesheetMatch = pageHtml.match(/<link rel="stylesheet" href="([^"]+)"/);
    if (stylesheetMatch?.[1]) {
      const stylesheetResponse = await fetch(new URL(stylesheetMatch[1], controller.url));
      expect(stylesheetResponse.status).toBe(200);
      expect(stylesheetResponse.headers.get("content-type")).toContain("text/css");
    }
  });

  test("Scenario: Given a bootstrap attachment with a stale transportUrl When starting cli-shell web host Then it resolves transport discovery from the refreshed terminal catalog", async () => {
    const store = createFakeCliShellProductHostStore();
    const created = await store.createGlobalTerminal({
      terminalId: "shell-stale",
      backend: "xterm",
      command: ["/bin/bash"],
      cwd: "/repo",
    });
    const catalogEntry = created.terminal;
    if (!catalogEntry) {
      throw new Error("expected terminal fixture");
    }
    const staleTransportUrl = "ws://127.0.0.1:63289/pty/shell-1?token=stale-token";
    const freshTransportUrl = "ws://127.0.0.1/pty/shell-stale?token=tok:shell-stale";
    store.hydrateGlobalTerminals = async () => [
      {
        ...catalogEntry,
        transportUrl: freshTransportUrl,
      },
    ];

    const attached = {
      avatar: { nickname: "shell-assistant", runtimeId: "runtime:shell-assistant" },
      session: { id: "session-stale" },
      avatarActorId: "auth:shell-assistant",
      shellTruthTerminal: {
        entry: {
          terminalId: "shell-stale:terminal-1",
          transportUrl: staleTransportUrl,
        },
        created: true,
      },
      visibleTerminal: {
        entry: {
          terminalId: "shell-stale",
          transportUrl: staleTransportUrl,
        },
        created: true,
      },
      room: {
        entry: {
          chatId: "room-shell-stale",
        },
        created: true,
      },
      promptSeeded: false,
      memoryFiles: [],
      managed: {
        managed: false,
        hostingActive: false,
        activeDelegation: null,
        contextId: "ctx-hosting-shell-stale",
        hostingMatches: [],
      },
    } as unknown as CliShellBootstrapResult;

    const controller = await startCliShellWebHost({
      store,
      attached,
      requestedPort: 0,
    });
    stopControllers.push(controller);

    const pageResponse = await fetch(controller.url);
    const pageHtml = await pageResponse.text();
    expect(pageHtml).toContain('"terminalId":"shell-stale"');
    expect(pageHtml).toContain(freshTransportUrl);
    expect(pageHtml).not.toContain(staleTransportUrl);
  });

  test("Scenario: Given Web product events When dialogue and resize actions are posted Then terminal-2 composed state changes through the product host", async () => {
    const store = createFakeCliShellProductHostStore();
    await store.createGlobalTerminal({
      terminalId: "shell-web-events:terminal-1",
      backend: "xterm",
      command: ["/bin/bash"],
      cwd: "/repo",
    });
    await store.createGlobalTerminal({
      terminalId: "shell-web-events:terminal-2",
      backend: "xterm",
      command: [],
      cwd: "/repo",
      metadata: {
        terminalRuntimeKind: "composed",
        composedShellTerminalId: "shell-web-events:terminal-1",
      },
    });
    const attached = createAttachedFixture({
      sessionId: "session-web-events",
      shellTerminalId: "shell-web-events:terminal-1",
      visibleTerminalId: "shell-web-events:terminal-2",
      roomChatId: "room-shell-web-events",
    });

    const controller = await startCliShellWebHost({
      store,
      shellName: "shell-web-events",
      attached,
      requestedPort: 0,
    });
    stopControllers.push(controller);

    const openResponse = await fetch(new URL("/product-event", controller.url), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "open-dialogue" }),
    });
    expect(openResponse.status).toBe(200);

    const draftResponse = await fetch(new URL("/product-event", controller.url), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "set-dialogue-draft", draft: "web says hi" }),
    });
    expect(draftResponse.status).toBe(200);

    const resizeResponse = await fetch(new URL("/product-event", controller.url), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "resize", cols: 96, rows: 28 }),
    });
    expect(resizeResponse.status).toBe(200);

    const stateResponse = await fetch(new URL("/product-state.json", controller.url));
    expect(stateResponse.status).toBe(200);
    const productState = await stateResponse.json();
    expect(productState.surface.dialogueOpen).toBe(true);
    expect(productState.surface.dialogueDraft).toBe("web says hi");
    expect(productState.surface.cols).toBe(96);
    expect(productState.surface.rows).toBe(28);
    expect(productState.textEvidence).toContain("web says hi");
    expect(store.lastPublishedComposedSurface?.terminalId).toBe("shell-web-events:terminal-2");
    expect(store.lastPublishedComposedSurface?.dialogueOpen).toBe(true);
  });

  test("Scenario: Given a projection-only browser host When the page boots Then it advertises DOM renderer law and shell viewport sizing", async () => {
    const store = createFakeCliShellProductHostStore();
    await store.createGlobalTerminal({
      terminalId: "shell-2",
      backend: "xterm",
      command: ["/bin/bash"],
      cwd: "/repo",
    });

    const attached = {
      avatar: { nickname: "shell-assistant", runtimeId: "runtime:shell-assistant" },
      session: { id: "session-2" },
      avatarActorId: "auth:shell-assistant",
      shellTruthTerminal: {
        entry: {
          terminalId: "shell-2:terminal-1",
        },
        created: true,
      },
      visibleTerminal: {
        entry: {
          terminalId: "shell-2",
        },
        created: true,
      },
      room: {
        entry: {
          chatId: "room-shell-2",
        },
        created: true,
      },
      promptSeeded: false,
      memoryFiles: [],
      managed: {
        managed: false,
        hostingActive: false,
        activeDelegation: null,
        contextId: "ctx-hosting-shell-2",
        hostingMatches: [],
      },
    } as unknown as CliShellBootstrapResult;

    const controller = await startCliShellWebHost({
      store,
      attached,
      requestedPort: 0,
    });
    stopControllers.push(controller);

    const pageResponse = await fetch(controller.url);
    const pageHtml = await pageResponse.text();
    expect(pageHtml).toContain('"rendererPreference":"auto"');
    expect(pageHtml).toContain('requestedGeometryRole":"projection-only"');
    expect(pageHtml).toContain('"geometryAuthority":{"enabled":true');
    expect(pageHtml).toContain('"claimUrl":"/geometry-authority/claim"');
    expect(pageHtml).toContain('"releaseUrl":"/geometry-authority/release"');
    expect(pageHtml).toContain('"snapshotUrl":"/terminal-snapshot.json"');
    expect(pageHtml).toContain('"productStateUrl":"/product-state.json"');
    expect(pageHtml).toContain('"productEventUrl":"/product-event"');
    expect(pageHtml).toContain('<script type="module" src="/browser-entry.ts"');
  });

  test("Scenario: Given terminal-2 already carries backend-published composed surface When cli-shell web host starts Then terminal-snapshot endpoint serves that terminal-2 product truth directly", async () => {
    const store = createFakeCliShellProductHostStore();
    await store.createGlobalTerminal({
      terminalId: "shell-2-product:terminal-1",
      backend: "xterm",
      command: ["/bin/bash"],
      cwd: "/repo",
    });
    await store.createGlobalTerminal({
      terminalId: "shell-2-product",
      backend: "xterm",
      command: ["/bin/bash"],
      cwd: "/repo",
      metadata: {
        terminalRuntimeKind: "composed",
        composedShellTerminalId: "shell-2-product:terminal-1",
      },
    });
    await store.setGlobalTerminalConfig({
      terminalId: "shell-2-product",
      metadata: {
        terminalRuntimeKind: "composed",
        composedShellTerminalId: "shell-2-product:terminal-1",
      },
    });
    await store.publishGlobalTerminalComposedSurface({
      terminalId: "shell-2-product",
      surface: {
        shellTerminalId: "shell-2-product:terminal-1",
        terminalId: "shell-2-product",
        shellSnapshotSeq: 1,
        cols: 80,
        rows: 24,
        bottomLine: "◉ terminal-2 bottom",
        dialogueOpen: true,
        dialoguePlacement: "right",
        dialogueDraft: "draft from backend",
        managedLabel: "托管 off",
        unreadLabel: "✉ 0",
        heartbeatLabel: "ready",
        terminalLines: [
          "terminal-2 top line",
          "┌layout M-L M-R M-F │ right                                              x",
          "│ backend dialogue body                                                  │",
          "│ > draft from backend                                           [Send] │",
          "◉ terminal-2 bottom",
        ].concat(Array.from({ length: 19 }, () => "")),
        terminalRichLines: [
          { spans: [{ text: "terminal-2 top line" }] },
          { spans: [{ text: "┌layout M-L M-R M-F │ right                                              x" }] },
          { spans: [{ text: "│ backend dialogue body                                                  │" }] },
          { spans: [{ text: "│ > draft from backend                                           [Send] │" }] },
          { spans: [{ text: "◉ terminal-2 bottom" }] },
          ...Array.from({ length: 19 }, () => ({ spans: [] })),
        ],
        cursor: { x: 18, y: 3, visible: true },
        scrollback: {
          viewportOffset: 0,
          totalLines: 24,
          screenLines: 24,
        },
      },
    });

    const attached = {
      avatar: { nickname: "shell-assistant", runtimeId: "runtime:shell-assistant" },
      session: { id: "session-product" },
      avatarActorId: "auth:shell-assistant",
      shellTruthTerminal: {
        entry: {
          terminalId: "shell-2-product:terminal-1",
        },
        created: true,
      },
      visibleTerminal: {
        entry: {
          terminalId: "shell-2-product",
        },
        created: true,
      },
      room: {
        entry: {
          chatId: "room-shell-2-product",
        },
        created: true,
      },
      promptSeeded: false,
      memoryFiles: [],
      managed: {
        managed: false,
        hostingActive: false,
        activeDelegation: null,
        contextId: "ctx-hosting-shell-2-product",
        hostingMatches: [],
      },
    } as unknown as CliShellBootstrapResult;

    const controller = await startCliShellWebHost({
      store,
      attached,
      requestedPort: 0,
    });
    stopControllers.push(controller);

    const snapshotResponse = await fetch(new URL("/terminal-snapshot.json", controller.url));
    expect(snapshotResponse.status).toBe(200);
    const snapshot = await snapshotResponse.json();
    expect(snapshot.lines.join("\n")).toContain("terminal-2 top line");
    expect(snapshot.lines.join("\n")).toContain("backend dialogue body");
    expect(snapshot.lines.join("\n")).toContain("◉ terminal-2 bottom");
    expect(snapshot.richLines?.[1]?.spans?.[0]?.text).toContain("┌layout");
  });

  test("Scenario: Given terminal-2 publishes collapsed and dialogue-open product screens When cli-shell web host starts Then web consumes the same terminal-2 snapshots as native host adapters", async () => {
    for (const mode of ["collapsed", "dialogue-open"] as const) {
      const store = createFakeCliShellProductHostStore();
      const visibleTerminalId = `shell-web-${mode}:terminal-2`;
      const shellTerminalId = `shell-web-${mode}:terminal-1`;
      await store.createGlobalTerminal({
        terminalId: visibleTerminalId,
        backend: "xterm",
        command: ["/bin/bash"],
        cwd: "/repo",
        metadata: {
          terminalRuntimeKind: "composed",
          composedShellTerminalId: shellTerminalId,
        },
      });
      await store.setGlobalTerminalConfig({
        terminalId: visibleTerminalId,
        metadata: {
          terminalRuntimeKind: "composed",
          composedShellTerminalId: shellTerminalId,
        },
      });
      const terminal2Surface = createSurfaceFixture({
        terminalId: visibleTerminalId,
        shellTerminalId,
        dialogueOpen: mode === "dialogue-open",
        bodyLine: `terminal-2 ${mode} shell body`,
        dialogueLine: `terminal-2 ${mode} dialogue body`,
      });
      await store.publishGlobalTerminalComposedSurface({
        terminalId: visibleTerminalId,
        surface: terminal2Surface,
      });
      const attached = createAttachedFixture({
        sessionId: `session-${mode}`,
        shellTerminalId,
        visibleTerminalId,
        roomChatId: `room-shell-web-${mode}`,
      });

      const controller = await startCliShellWebHost({
        store,
        attached,
        requestedPort: 0,
      });
      stopControllers.push(controller);

      const snapshotResponse = await fetch(new URL("/terminal-snapshot.json", controller.url));
      expect(snapshotResponse.status).toBe(200);
      const snapshot = await snapshotResponse.json();
      expect(snapshot.cols).toBe(terminal2Surface.cols);
      expect(snapshot.rows).toBe(terminal2Surface.rows);
      expect(snapshot.lines).toEqual(terminal2Surface.terminalLines);
      expect(snapshot.cursor).toEqual(terminal2Surface.cursor);
      expect(snapshot.scrollback).toEqual(terminal2Surface.scrollback);
      expect(snapshot.lines.join("\n")).toContain(`terminal-2 ${mode} shell body`);
      expect(snapshot.lines.join("\n")).toContain("◉ terminal-2 bottom");
      if (mode === "dialogue-open") {
        expect(snapshot.lines.join("\n")).toContain("dialogue body");
      } else {
        expect(snapshot.lines.join("\n")).not.toContain("dialogue body");
      }
    }
  });

  test("Scenario: Given Web product host owns terminal-2 When dialogue submit and shell scroll are dispatched Then events bridge to dialogue backend and shell backend owners", async () => {
    const shellLines = Array.from({ length: 60 }, (_, index) =>
      index === 0 ? "$ agenter shell" : `scrollback-${index.toString().padStart(2, "0")}`,
    );
    const shellSnapshot = createShellSnapshotFixture({
      lines: shellLines,
      rows: 18,
      viewportOffset: 20,
    });
    const transport = createProductHostTransportHarness(shellSnapshot);
    const store = createFakeCliShellProductHostStore();
    await store.createGlobalTerminal({
      terminalId: "shell-owner:terminal-1",
      backend: "xterm",
      command: ["/bin/bash"],
      cwd: "/repo",
    });
    const shellEntry = store.terminals.find((entry) => entry.terminalId === "shell-owner:terminal-1");
    if (shellEntry) {
      shellEntry.snapshot = shellSnapshot;
    }
    await store.createGlobalTerminal({
      terminalId: "shell-owner:terminal-2",
      backend: "xterm",
      command: [],
      cwd: "/repo",
      metadata: {
        terminalRuntimeKind: "composed",
        composedShellTerminalId: "shell-owner:terminal-1",
      },
    });
    const attached = createAttachedFixture({
      sessionId: "session-owner",
      shellTerminalId: "shell-owner:terminal-1",
      visibleTerminalId: "shell-owner:terminal-2",
      roomChatId: "room-shell-owner",
    });
    const host = startCliShellWebProductHost({
      store,
      shellName: "shell-owner",
      attached,
      keybindings: resolveCliShellTuiKeybindings(null),
      initialCols: 96,
      initialRows: 24,
      createTransportSession: transport.createTransportSession,
    });
    host.start();
    try {
      host.renderNow();
      await host.dispatch({ type: "open-dialogue" });
      await host.dispatch({ type: "set-dialogue-draft", draft: "backend-owned message" });
      await host.dispatch({ type: "submit-dialogue" });
      await host.dispatch({ type: "shell-scroll-target", viewportStart: 33 });
      host.renderNow();

      expect(store.sentMessages).toEqual([
        { chatId: "room-shell-owner", text: "backend-owned message" },
      ]);
      expect(transport.sent.some((message) => message.type === "viewportTarget" && message.viewportStart === 33)).toBe(true);
      expect(host.getSnapshot().surface?.terminalId).toBe("shell-owner:terminal-2");
      expect(host.getSnapshot().model?.terminalView.viewportStart).toBe(33);
      expect(host.getSnapshot().textEvidence).toContain("scrollback-33");
    } finally {
      host.dispose();
    }
  });

  test("Scenario: Given a newly created cli-shell web host When pages claim geometry participation Then the host only returns requested role intent and never local final authority truth", async () => {
    const store = createFakeCliShellProductHostStore();
    await store.createGlobalTerminal({
      terminalId: "shell-3",
      backend: "xterm",
      command: ["/bin/bash"],
      cwd: "/repo",
    });

    const attached = {
      avatar: { nickname: "shell-assistant", runtimeId: "runtime:shell-assistant" },
      session: { id: "session-3" },
      avatarActorId: "auth:shell-assistant",
      shellTruthTerminal: {
        entry: {
          terminalId: "shell-3:terminal-1",
        },
        created: true,
      },
      visibleTerminal: {
        entry: {
          terminalId: "shell-3",
        },
        created: true,
      },
      room: {
        entry: {
          chatId: "room-shell-3",
        },
        created: true,
      },
      promptSeeded: false,
      memoryFiles: [],
      managed: {
        managed: false,
        hostingActive: false,
        activeDelegation: null,
        contextId: "ctx-hosting-shell-3",
        hostingMatches: [],
      },
    } as unknown as CliShellBootstrapResult;

    const controller = await startCliShellWebHost({
      store,
      attached,
      requestedPort: 0,
    });
    stopControllers.push(controller);

    const firstClaim = await fetch(new URL("/geometry-authority/claim", controller.url), {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ pageId: "page-1" }),
    });
    expect(firstClaim.status).toBe(200);
    expect(await firstClaim.json()).toEqual({
      requestedGeometryRole: "authority",
    });

    const secondClaim = await fetch(new URL("/geometry-authority/claim", controller.url), {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ pageId: "page-2" }),
    });
    expect(secondClaim.status).toBe(200);
    expect(await secondClaim.json()).toEqual({
      requestedGeometryRole: "authority",
    });

    const release = await fetch(new URL("/geometry-authority/release", controller.url), {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ pageId: "page-1" }),
    });
    expect(release.status).toBe(200);
    expect(await release.json()).toEqual({ requestedGeometryRole: "projection-only" });

    const thirdClaim = await fetch(new URL("/geometry-authority/claim", controller.url), {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ pageId: "page-2" }),
    });
    expect(thirdClaim.status).toBe(200);
    expect(await thirdClaim.json()).toEqual({
      requestedGeometryRole: "authority",
    });
  });

  test("Scenario: Given a reused backend terminal When starting cli-shell web host Then browser pages stay projection-only and cannot implicitly become geometry authority", async () => {
    const store = createFakeCliShellProductHostStore();
    await store.createGlobalTerminal({
      terminalId: "shell-4",
      backend: "xterm",
      command: ["/bin/bash"],
      cwd: "/repo",
    });

    const attached = {
      avatar: { nickname: "shell-assistant", runtimeId: "runtime:shell-assistant" },
      session: { id: "session-4" },
      avatarActorId: "auth:shell-assistant",
      shellTruthTerminal: {
        entry: {
          terminalId: "shell-4:terminal-1",
        },
        created: false,
      },
      visibleTerminal: {
        entry: {
          terminalId: "shell-4",
        },
        created: false,
      },
      room: {
        entry: {
          chatId: "room-shell-4",
        },
        created: false,
      },
      promptSeeded: false,
      memoryFiles: [],
      managed: {
        managed: false,
        hostingActive: false,
        activeDelegation: null,
        contextId: "ctx-hosting-shell-4",
        hostingMatches: [],
      },
    } as unknown as CliShellBootstrapResult;

    const controller = await startCliShellWebHost({
      store,
      attached,
      requestedPort: 0,
    });
    stopControllers.push(controller);

    const pageResponse = await fetch(controller.url);
    const pageHtml = await pageResponse.text();
    expect(pageHtml).toContain('"geometryAuthority":{"enabled":false');

    const claim = await fetch(new URL("/geometry-authority/claim", controller.url), {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ pageId: "page-1" }),
    });
    expect(claim.status).toBe(200);
    expect(await claim.json()).toEqual({
      requestedGeometryRole: "projection-only",
    });
  });
});
