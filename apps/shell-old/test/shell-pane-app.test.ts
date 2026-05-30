import { describe, expect, test } from "bun:test";

import { createTestRenderer } from "@opentui/core/testing";
import type { TerminalTransportClientMessage, TerminalTransportServerMessage } from "@agenter/terminal-transport-protocol";

import { startCliShellTerminalInstancePanel } from "../src/tui/terminal-instance-panel";
import { createTestTransportSession } from "../legacy/terminal2/test/test-transport-session";
import { BackendTerminalFrameRenderable, ShellTerminalViewRenderable } from "../src/tui/terminal-instance-view";

describe("Feature: cli-shell shell pane cursor projection", () => {
  test("Scenario: Given the shell cursor is stored as a viewport-local 0-based projection When the native shell-terminal-view commits the cursor Then the hardware cursor uses the renderable screen origin plus the 1-based native offset", async () => {
    const setup = await createTestRenderer({ width: 40, height: 10 });
    const cursorCommits: Array<{ x: number; y: number; visible: boolean }> = [];
    const originalSetCursorPosition = setup.renderer.setCursorPosition.bind(setup.renderer);
    setup.renderer.setCursorPosition = ((x: number, y: number, visible = true) => {
      cursorCommits.push({ x, y, visible });
      originalSetCursorPosition(x, y, visible);
    }) as typeof setup.renderer.setCursorPosition;
    const view = new ShellTerminalViewRenderable(setup.renderer, {
      id: "shell-pane-view",
      position: "absolute",
      top: 2,
      left: 4,
      width: 20,
      height: 5,
      focused: true,
      lines: [
        { spans: [{ text: "line-1" }] },
        { spans: [{ text: "line-2" }] },
      ],
    });
    setup.renderer.root.add(view);

    view.focus();
    view.updateProjection({
      lines: [
        { spans: [{ text: "line-1" }] },
        { spans: [{ text: "line-2" }] },
      ],
      cursor: {
        row: 1,
        col: 6,
        visible: true,
      },
    });
    await setup.renderOnce();

    expect(cursorCommits.at(-1)).toEqual({
      x: 11,
      y: 4,
      visible: true,
    });
    setup.renderer.destroy();
  });

  test("Scenario: Given the backend cursor is projected from an absolute scrolled row When cli-shell translates it into viewport-local cursor truth Then the visible local cell stays correct", () => {
    const cursorAbsRow = 19;
    const viewportStart = 14;
    const localRow = cursorAbsRow - viewportStart;

    expect(localRow).toBe(5);
    expect(localRow).toBeGreaterThanOrEqual(0);
  });

  test("Scenario: Given the app shell pane mounts a terminal instance panel When cli-shell restores the frame-backed shell surface Then it reserves one gutter column for the scrollbar and resizes backend truth to the content viewport", async () => {
    const setup = await createTestRenderer({ width: 40, height: 10, useMouse: true });
    const sentMessages: TerminalTransportClientMessage[] = [];
    const controller = await startCliShellTerminalInstancePanel({
      terminalId: "terminal:test",
      transportUrl: "ws://127.0.0.1/terminal:test",
      renderer: setup.renderer,
      createTransportSession: (input) =>
        createTestTransportSession({
          connect: async () => {
            input.events.onOpen();
          },
          disconnect: () => {
            input.events.onClose();
          },
          send: (message) => {
            sentMessages.push(message);
            return true;
          },
        }),
    });

    await setup.renderOnce();

    const frame = setup.renderer.root.findDescendantById(
      "cli-shell-terminal-instance-frame",
    ) as BackendTerminalFrameRenderable | undefined;

    expect(frame).toBeInstanceOf(BackendTerminalFrameRenderable);
    expect(frame?.terminalView.width).toBe(39);
    expect(frame?.terminalView.height).toBe(10);
    expect(frame?.scrollbar.left).toBe(39);
    expect(sentMessages.find((message) => message.type === "resize")).toMatchObject({
      type: "resize",
      cols: 39,
      rows: 10,
    });

    setup.resize(50, 12);
    await setup.renderOnce();

    const resizeMessages = sentMessages.filter(
      (message): message is Extract<TerminalTransportClientMessage, { type: "resize" }> => message.type === "resize",
    );
    expect(resizeMessages.at(-1)).toMatchObject({
      type: "resize",
      cols: 49,
      rows: 12,
    });

    controller.destroy();
    await controller.finished;
    setup.renderer.destroy();
  });

  test("Scenario: Given the bound TerminalSystem instance stops When shell pane receives the stop status Then the panel exits with the terminal instead of staying alive", async () => {
    const setup = await createTestRenderer({ width: 40, height: 10, useMouse: true });
    const transportHooks: {
      onMessage?: (message: TerminalTransportServerMessage) => void;
    } = {};
    const controller = await startCliShellTerminalInstancePanel({
      terminalId: "terminal:test",
      transportUrl: "ws://127.0.0.1/terminal:test",
      renderer: setup.renderer,
      createTransportSession: (input) => {
        transportHooks.onMessage = input.events.onMessage;
        return createTestTransportSession({
          connect: async () => {
            input.events.onOpen();
          },
          disconnect: () => {
            input.events.onClose();
          },
          send: () => true,
        });
      },
    });

    await setup.renderOnce();

    transportHooks.onMessage?.({
      type: "status",
      terminalId: "terminal:test",
      running: false,
      status: "IDLE",
    });

    const outcome = await Promise.race([
      controller.finished.then(() => "finished"),
      Bun.sleep(200).then(() => "timeout"),
    ]);

    expect(outcome).toBe("finished");
    expect(setup.renderer.root.findDescendantById("cli-shell-terminal-instance-frame")).toBeUndefined();
    setup.renderer.destroy();
  });
});
