import type { CachedResourceState, GlobalTerminalApprovalRequest, RuntimeClientState } from "@agenter/client-sdk";
import { afterEach, describe, expect, test } from "bun:test";
import { createTestRenderer, type TestRenderer } from "@opentui/core/testing";

import { startCliShellTopLayerApp, type CliShellTopLayerAppStore } from "../src/tui/top-layer-app";

type TestSetup = Awaited<ReturnType<typeof createTestRenderer>>;

const cached = <T>(data: T): CachedResourceState<T> => ({
  data,
  loaded: true,
  loading: false,
  refreshing: false,
  error: null,
  refreshedAt: 1,
});

const pendingApproval: GlobalTerminalApprovalRequest = {
  requestId: "approval-1",
  terminalId: "terminal-1",
  participantId: "auth:assistant",
  assignedAdminId: "auth:admin",
  status: "pending",
  requestedInput: {
    mode: "raw",
    text: "echo hello",
  },
  createdAt: 1,
  expiresAt: 60_000,
};

class TopLayerStore implements CliShellTopLayerAppStore {
  approvals: GlobalTerminalApprovalRequest[] = [pendingApproval];
  approved: Array<{ terminalId: string; requestId: string; durationMs: number }> = [];
  denied: Array<{ terminalId: string; requestId: string }> = [];

  getState(): Pick<RuntimeClientState, "globalTerminalApprovalsById"> {
    return {
      globalTerminalApprovalsById: {
        "terminal-1": cached(this.approvals),
      },
    };
  }

  subscribe(): () => void {
    return () => {};
  }

  retainTerminalPermissionRequests(): () => void {
    return () => {};
  }

  async hydrateGlobalTerminalApprovals(): Promise<GlobalTerminalApprovalRequest[]> {
    return this.approvals;
  }

  async approveGlobalTerminalRequest(input: { terminalId: string; requestId: string; durationMs: number }): Promise<unknown> {
    this.approved.push(input);
    this.approvals = this.approvals.filter((request) => request.requestId !== input.requestId);
    return {};
  }

  async denyGlobalTerminalRequest(input: { terminalId: string; requestId: string }): Promise<unknown> {
    this.denied.push(input);
    this.approvals = this.approvals.filter((request) => request.requestId !== input.requestId);
    return {};
  }
}

let setup: TestSetup | null = null;

afterEach(() => {
  setup?.renderer.destroy();
  setup = null;
});

const startTopLayer = async (store = new TopLayerStore()): Promise<{ setup: TestSetup; store: TopLayerStore }> => {
  setup = await createTestRenderer({ width: 72, height: 14, useMouse: true });
  await startCliShellTopLayerApp({
    store,
    shellName: "shell-5",
    terminalId: "terminal-1",
    renderer: setup.renderer as TestRenderer,
  });
  await setup.renderOnce();
  return { setup, store };
};

describe("Feature: cli-shell OpenTUI top layer", () => {
  test("Scenario: Given a terminal approval is pending When shell top renders Then it shows the approval outside Room", async () => {
    const { setup: topLayer } = await startTopLayer();

    expect(topLayer.captureCharFrame()).toContain("Terminal write approval");
    expect(topLayer.captureCharFrame()).toContain("echo hello");
    expect(topLayer.captureCharFrame()).toContain("[ Deny ]  [ Approve ]");
  });

  test("Scenario: Given a terminal approval is pending When the user clicks Approve Then shell top approves it", async () => {
    const { setup: topLayer, store } = await startTopLayer();

    await topLayer.mockMouse.click(13, 7);

    expect(store.approved).toEqual([{ terminalId: "terminal-1", requestId: "approval-1", durationMs: 300_000 }]);
    expect(store.denied).toEqual([]);
  });

  test("Scenario: Given a terminal approval is pending When the user presses D Then shell top denies it", async () => {
    const { setup: topLayer, store } = await startTopLayer();

    topLayer.mockInput.pressKey("d");
    await topLayer.renderOnce();

    expect(store.denied).toEqual([{ terminalId: "terminal-1", requestId: "approval-1" }]);
    expect(store.approved).toEqual([]);
  });
});
