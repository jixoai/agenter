import { createTestRenderer } from "@opentui/core/testing";
import type { KeyEvent } from "@opentui/core";
import { afterEach, describe, expect, test } from "bun:test";

import {
  SHELL_NEXT_APPROVAL_LEASE_MS,
  ShellNextTopLayerSurface,
  type ShellNextApprovalRequest,
  type ShellNextApprovalStore,
} from "../src/surfaces/top-layer-surface";

type TestSetup = Awaited<ReturnType<typeof createTestRenderer>>;

const pendingApproval: ShellNextApprovalRequest = {
  requestId: "approval-1",
  terminalId: "terminal-1",
  participantId: "auth:assistant",
  status: "pending",
  requestedInput: {
    mode: "raw",
    text: "echo hello",
  },
  createdAt: 1,
};

class RecordingApprovalStore implements ShellNextApprovalStore {
  approval: ShellNextApprovalRequest | null = pendingApproval;
  approved: Array<{ terminalId: string; requestId: string; durationMs: number }> = [];
  denied: Array<{ terminalId: string; requestId: string }> = [];

  getPendingApproval(): ShellNextApprovalRequest | null {
    return this.approval;
  }

  approve(input: { terminalId: string; requestId: string; durationMs: number }): void {
    this.approved.push(input);
    this.approval = null;
  }

  deny(input: { terminalId: string; requestId: string }): void {
    this.denied.push(input);
    this.approval = null;
  }
}

let setup: TestSetup | null = null;
let activeSurface: ShellNextTopLayerSurface | null = null;

afterEach(() => {
  activeSurface?.destroy();
  activeSurface = null;
  setup?.renderer.destroy();
  setup = null;
});

const startSurface = async (store = new RecordingApprovalStore()) => {
  setup = await createTestRenderer({ width: 72, height: 18, useMouse: true, kittyKeyboard: true });
  activeSurface = new ShellNextTopLayerSurface({
    renderer: setup.renderer,
    store,
    shellName: "shell-next-test",
  });
  setup.renderer.root.add(activeSurface.root);
  activeSurface.start();
  activeSurface.show();
  await setup.renderOnce();
  return { setup, store, surface: activeSurface };
};

const createKeyEvent = (input: { name: string; sequence?: string; raw?: string }): KeyEvent => {
  let defaultPrevented = false;
  const key = {
    name: input.name,
    sequence: input.sequence ?? input.raw ?? "",
    raw: input.raw ?? input.sequence ?? "",
    ctrl: false,
    meta: false,
    shift: false,
    alt: false,
    option: false,
    number: false,
    eventType: "keypress",
    source: "keyboard",
    path: [],
    code: input.name,
    key: input.name,
    preventDefault: () => {
      defaultPrevented = true;
    },
    get defaultPrevented() {
      return defaultPrevented;
    },
  };
  return key as unknown as KeyEvent;
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

describe("Feature: shell-next OpenTUI top layer", () => {
  test("Scenario: Given a terminal approval is pending When top layer renders Then it shows approval outside mux panes", async () => {
    const { setup } = await startSurface();

    expect(setup.captureCharFrame()).toContain("Terminal write approval");
    expect(setup.captureCharFrame()).toContain("echo hello");
    expect(setup.captureCharFrame()).toContain("[ Deny ]  [ Approve ]");
  });

  test("Scenario: Given a terminal approval is pending When pressing A Then the top layer approves it", async () => {
    const { setup, store, surface } = await startSurface();

    const handled = surface.handleKeypress(createKeyEvent({ name: "a", sequence: "a" }));
    await setup.renderOnce();

    expect(handled).toBe(true);
    expect(store.approved).toEqual([
      { terminalId: "terminal-1", requestId: "approval-1", durationMs: SHELL_NEXT_APPROVAL_LEASE_MS },
    ]);
    expect(store.denied).toEqual([]);
  });

  test("Scenario: Given a terminal approval is pending When pressing D Then the top layer denies it", async () => {
    const { setup, store, surface } = await startSurface();

    const handled = surface.handleKeypress(createKeyEvent({ name: "d", sequence: "d" }));
    await setup.renderOnce();

    expect(handled).toBe(true);
    expect(store.denied).toEqual([{ terminalId: "terminal-1", requestId: "approval-1" }]);
    expect(store.approved).toEqual([]);
  });

  test("Scenario: Given top layer is started standalone When key input fires Then it does not install a parallel global listener", async () => {
    const { setup, store } = await startSurface();

    setup.mockInput.pressKey("a");
    await setup.renderOnce();

    expect(store.approved).toEqual([]);
    expect(store.denied).toEqual([]);
  });

  test("Scenario: Given close confirmation is requested When rendered Then it shows background-run and terminate actions", async () => {
    const { setup, surface } = await startSurface(new RecordingApprovalStore());

    surface.showCloseConfirm({
      title: "demo shell",
      onBackgroundRun: () => undefined,
      onTerminate: () => undefined,
    });
    await setup.renderOnce();

    expect(setup.captureCharFrame()).toContain("Close this shell pane?");
    expect(setup.captureCharFrame()).toContain("demo shell [x]");
    expect(setup.captureCharFrame()).toContain("[ Run in background ]");
    expect(setup.captureCharFrame()).toContain("[ Terminate terminal ]");
  });

  test("Scenario: Given close confirmation is shown When clicking the border x Then it cancels without running close actions", async () => {
    const { setup, surface } = await startSurface(new RecordingApprovalStore());
    const actions: string[] = [];

    surface.showCloseConfirm({
      title: "demo shell",
      onBackgroundRun: () => {
        actions.push("background");
      },
      onTerminate: () => {
        actions.push("terminate");
      },
    });
    await setup.renderOnce();

    await setup.mockMouse.click(15, 2);
    await setup.renderOnce();

    expect(actions).toEqual([]);
    expect(setup.captureCharFrame()).not.toContain("[ Run in background ]");
  });

  test("Scenario: Given close confirmation is shown When clicking action labels Then hit regions trigger the correct callbacks", async () => {
    const { setup, surface } = await startSurface(new RecordingApprovalStore());
    const actions: string[] = [];

    surface.showCloseConfirm({
      title: "demo shell",
      onBackgroundRun: () => {
        actions.push("background");
      },
      onTerminate: () => {
        actions.push("terminate");
      },
    });
    await setup.renderOnce();
    const background = findTextPosition(setup.captureCharFrame(), "[ Run in background ]");
    expect(background).not.toBeNull();

    await setup.mockMouse.click(background?.x ?? 0, Math.max(0, (background?.y ?? 0) - 1));
    await setup.renderOnce();
    expect(actions).toEqual([]);

    await setup.mockMouse.click((background?.x ?? 0) + 2, background?.y ?? 0);
    await setup.renderOnce();

    surface.showCloseConfirm({
      title: "demo shell",
      onBackgroundRun: () => {
        actions.push("background-again");
      },
      onTerminate: () => {
        actions.push("terminate");
      },
    });
    await setup.renderOnce();
    const terminate = findTextPosition(setup.captureCharFrame(), "[ Terminate terminal ]");
    expect(terminate).not.toBeNull();

    await setup.mockMouse.click((terminate?.x ?? 0) + 2, terminate?.y ?? 0);
    await setup.renderOnce();

    expect(actions).toEqual(["background", "terminate"]);
  });
});
