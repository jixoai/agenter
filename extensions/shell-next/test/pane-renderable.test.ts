import { afterEach, describe, expect, test } from "bun:test";
import { createTestRenderer, type TestRenderer } from "@opentui/core/testing";

import { createRootLayout } from "../src/renderable-mux/layout";
import { PaneRenderable } from "../src/renderable-mux/pane-renderable";
import {
  createBunPtyPaneSource,
  createCommandTaskPaneSource,
  createPaneSourceId,
  normalizeTerminalPaneSource,
  type TerminalInputChunk,
  type TerminalLikePaneSource,
  type TerminalPaneSize,
} from "../src/renderable-mux/pane-source";

type TestSetup = Awaited<ReturnType<typeof createTestRenderer>>;

let setup: TestSetup | null = null;
let activePane: PaneRenderable | null = null;

afterEach(() => {
  activePane?.destroy();
  activePane = null;
  setup?.renderer.destroy();
  setup = null;
});

const createRecordingProtocolSource = () => {
  const inputChunks: TerminalInputChunk[] = [];
  const resizeCalls: TerminalPaneSize[] = [];
  let disposed = false;
  return {
    source: {
      kind: "terminal-protocol" as const,
      id: createPaneSourceId("protocol-1"),
      readFrame: () => ({
        size: resizeCalls.at(-1) ?? { cols: 80, rows: 24 },
        lines: ["hello from protocol", "second line"],
        revision: 1,
      }),
      writeInput: (chunk: TerminalInputChunk) => {
        inputChunks.push(chunk);
      },
      resize: (size: TerminalPaneSize) => {
        resizeCalls.push(size);
      },
      dispose: () => {
        disposed = true;
      },
    },
    inputChunks,
    resizeCalls,
    get disposed() {
      return disposed;
    },
  };
};

const startPane = async () => {
  setup = await createTestRenderer({ width: 40, height: 10, useMouse: true });
  const layout = createRootLayout({ x: 0, y: 0, width: 40, height: 10 }, [
    { id: "pane-a", sourceKind: "terminal-protocol" },
  ]);
  const recording = createRecordingProtocolSource();
  const pane = new PaneRenderable({
    renderer: setup.renderer as TestRenderer,
    node: layout.children[0],
    source: recording.source,
    title: "Protocol Pane",
  });
  activePane = pane;
  setup.renderer.root.add(pane.root);
  await setup.renderOnce();
  return { setup, layout, pane, recording };
};

describe("Feature: shell-next protocol-backed PaneRenderable", () => {
  test("Scenario: Given a terminal protocol frame When rendered Then pane projects backend-owned lines", async () => {
    const { setup } = await startPane();

    expect(setup.captureCharFrame()).toContain("hello from protocol");
    expect(setup.captureCharFrame()).toContain("second line");
  });

  test("Scenario: Given a bordered terminal pane When rendered Then the first content row touches the top border", async () => {
    const { setup } = await startPane();

    const rows = setup.captureCharFrame().split("\n");

    expect(rows[1]).toContain("hello from protocol");
    expect(rows[2]).toContain("second line");
  });

  test("Scenario: Given layout geometry changes When pane syncs Then resize is routed to the protocol source", async () => {
    const { layout, pane, recording } = await startPane();

    layout.resize({ x: 0, y: 0, width: 30, height: 8 });
    pane.syncNode(layout.children[0]);

    expect(recording.resizeCalls.at(-1)).toEqual({ cols: 28, rows: 6 });
  });

  test("Scenario: Given focused input When written through the pane Then input is forwarded to the source", async () => {
    const { pane, recording } = await startPane();

    pane.writeInput("ls\n");

    expect(recording.inputChunks).toEqual(["ls\n"]);
  });

  test("Scenario: Given pane disposal When destroyed Then the source lifecycle receives dispose", async () => {
    const { pane, recording } = await startPane();

    pane.destroy();
    activePane = null;

    expect(recording.disposed).toBe(true);
  });

  test("Scenario: Given terminal-like source families When mounted Then PaneRenderable consumes the same normalized protocol shape", async () => {
    setup = await createTestRenderer({ width: 40, height: 10, useMouse: true });
    const layout = createRootLayout({ x: 0, y: 0, width: 40, height: 10 }, [
      { id: "pane-a", sourceKind: "terminal-protocol" },
    ]);
    const protocol = createRecordingProtocolSource();
    const families: TerminalLikePaneSource[] = [
      protocol.source,
      createBunPtyPaneSource({
        id: createPaneSourceId("pty-1"),
        launch: { command: "mock-shell" },
        protocol: protocol.source,
      }),
      createCommandTaskPaneSource({
        id: createPaneSourceId("task-1"),
        task: { command: "mock-task" },
        protocol: protocol.source,
      }),
    ];

    for (const source of families) {
      activePane?.destroy();
      activePane = new PaneRenderable({
        renderer: setup.renderer as TestRenderer,
        node: layout.children[0],
        source: normalizeTerminalPaneSource(source),
        title: `source ${source.kind}`,
      });
      setup.renderer.root.add(activePane.root);
      await setup.renderOnce();
      expect(setup.captureCharFrame()).toContain("hello from protocol");
    }
  });

  test("Scenario: Given frame replay debug hook When pane refreshes Then it records source revision without product logger coupling", async () => {
    const events: Array<{ paneId: string; revision: number; cols: number; rows: number; elapsedMs: number }> = [];
    setup = await createTestRenderer({ width: 40, height: 10, useMouse: true });
    const layout = createRootLayout({ x: 0, y: 0, width: 40, height: 10 }, [
      { id: "pane-a", sourceKind: "terminal-protocol" },
    ]);
    const recording = createRecordingProtocolSource();
    activePane = new PaneRenderable({
      renderer: setup.renderer as TestRenderer,
      node: layout.children[0],
      source: recording.source,
      onFrameRendered: (event) => {
        events.push(event);
      },
    });
    setup.renderer.root.add(activePane.root);

    activePane.refresh();

    expect(events.at(-1)).toMatchObject({
      paneId: "pane-a",
      revision: 1,
      cols: 38,
      rows: 8,
    });
    expect(events.at(-1)?.elapsedMs).toBeGreaterThanOrEqual(0);
  });
});
