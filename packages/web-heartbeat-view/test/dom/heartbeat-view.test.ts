import { flushSync, mount } from "svelte";
import { describe, expect, test } from "vitest";

import {
  createCachedResourceState,
  type HeartbeatConfigBinding,
  type HeartbeatGroupItem,
  type HeartbeatViewState,
} from "../../src";
import HeartbeatView from "../../src/HeartbeatView.svelte";
import { heartbeatEntry, heartbeatGroup, heartbeatPart } from "../heartbeat-fixtures";
import { trackMountedComponent } from "../vitest.setup";
import HeartbeatViewStabilityHarness from "./HeartbeatViewStabilityHarness.svelte";

const loadedGroups = completeLoadedState([
  heartbeatGroup({
    id: 1,
    items: [
      heartbeatEntry({
        id: 1,
        parts: [
          heartbeatPart({
            partId: 1,
            messageId: "text-1",
            partType: "text",
            payload: { text: "Assistant heartbeat text" },
          }),
        ],
      }),
    ],
  }),
]);

function completeLoadedState(data: HeartbeatViewState["groupsState"]["data"]): HeartbeatViewState["groupsState"] {
  return {
    ...createCachedResourceState(data),
    loaded: true,
    refreshedAt: 100,
  };
}

const configBinding: HeartbeatConfigBinding = {
  editableLayerId: "user:avatar",
  editableLayerSource: "user:avatar",
  activeProviderId: "openai",
  providerLabel: "openai · gpt",
  providerMetadata: null,
  draft: {
    temperature: 0.7,
    topK: null,
    maxToken: 1000,
    thinkingEnabled: false,
    thinkingBudgetTokens: null,
  },
};

const structuredGroups = completeLoadedState([
  heartbeatGroup({
    id: 5,
    kind: "call",
    items: [
      heartbeatEntry({
        id: 5,
        parts: [
          heartbeatPart({
            partId: 5,
            messageId: "thinking-5",
            partType: "thinking",
            payload: { text: "Inspect tool state before answering." },
          }),
          heartbeatPart({
            partId: 6,
            messageId: "tool-6",
            partType: "tool_call",
            isComplete: false,
            payload: {
              invocationId: "tool_6",
              tool: "shell.exec",
              input: { command: "bun test" },
              startedAt: 1_000,
            },
          }),
          heartbeatPart({
            partId: 7,
            messageId: "config-7",
            partType: "config",
            payload: { ai: { maxToken: 1000 } },
          }),
        ],
        isComplete: false,
      }),
    ],
  }),
  heartbeatGroup({
    id: 6,
    kind: "compact",
    items: [
      heartbeatEntry({
        id: 6,
        role: "assistant",
        parts: [
          heartbeatPart({
            partId: 8,
            messageId: "compact-8",
            partType: "compact",
            payload: { text: "Compacted memory" },
          }),
        ],
      }),
    ],
  }),
]);

type StabilityHarnessExports = {
  warmRefresh(): void;
  appendGroup(group: HeartbeatGroupItem): void;
  prependGroup(group: HeartbeatGroupItem): void;
};

const wait = (ms = 0): Promise<void> =>
  new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });

describe("Feature: HeartbeatView DOM capability contract", () => {
  test("Scenario: Given readonly mode When rows render Then config and compact actions are not executable", () => {
    const component = mount(HeartbeatView, {
      target: document.body,
      props: {
        mode: "readonly",
        avatarLabel: "Ada",
        state: {
          sessionStatus: "stopped",
          groupsState: loadedGroups,
          livePushStatus: "inactive",
        },
      },
    });
    trackMountedComponent(component);

    expect(document.body.textContent).toContain("Assistant heartbeat text");
    expect(document.body.textContent).toContain("No live push is active");
    expect(document.querySelector('[title="Request compact"]')).toBeNull();
    expect(document.querySelector('[title="Configure next call"]')).toBeNull();
  });

  test("Scenario: Given configable mode When handlers exist Then bottom statusbar exposes formal actions", () => {
    const component = mount(HeartbeatView, {
      target: document.body,
      props: {
        mode: "configable",
        avatarLabel: "Ada",
        state: {
          sessionStatus: "running",
          groupsState: loadedGroups,
          configBinding,
        },
        callbacks: {
          actions: {
            compact: { available: true },
            config: { available: true },
            onRequestCompact: () => undefined,
            onSaveConfig: () => true,
          },
        },
      },
    });
    trackMountedComponent(component);

    expect(document.body.textContent).toContain("Compact");
    expect(document.body.textContent).toContain("Config");
  });

  test("Scenario: Given loaded empty data When rendered Then empty state is honest and not a connection failure", () => {
    const component = mount(HeartbeatView, {
      target: document.body,
      props: {
        mode: "readonly",
        avatarLabel: "Ada",
        state: {
          sessionStatus: "stopped",
          groupsState: completeLoadedState([]),
          livePushStatus: "inactive",
        },
      },
    });
    trackMountedComponent(component);

    expect(document.body.textContent).toContain("No Heartbeat rows yet");
    expect(document.body.textContent).toContain("valid Heartbeat target");
  });

  test("Scenario: Given structured rows When rendered Then reasoning, JSON config, tool running, compact card, and load older are visible through package components", () => {
    const component = mount(HeartbeatView, {
      target: document.body,
      props: {
        mode: "readonly",
        avatarLabel: "Ada",
        state: {
          sessionStatus: "running",
          groupsState: structuredGroups,
        },
        callbacks: {
          onLoadOlder: async () => ({ items: 0, hasMore: false }),
        },
      },
    });
    trackMountedComponent(component);

    expect(document.querySelector('[data-testid="heartbeat-load-older"]')).not.toBeNull();
    expect(document.body.textContent).toContain("Reasoning");
    expect(document.body.textContent).toContain("shell.exec");
    expect(document.body.textContent).toContain("bun test");
    expect(document.body.textContent).toContain("Config");
    expect(document.body.textContent).toContain("Compacted memory");
  });

  test("Scenario: Given warm refresh, live append, older prepend, and load-older in flight When the stream changes Then mounted rows remain stable", async () => {
    const component = mount(HeartbeatViewStabilityHarness, {
      target: document.body,
      props: {
        initialState: {
          sessionStatus: "running",
          groupsState: loadedGroups,
          livePushStatus: "active",
        },
      },
    }) as StabilityHarnessExports;
    trackMountedComponent(component);

    const stream = document.querySelector<HTMLElement>('[data-testid="heartbeat-stream"]');
    const firstGroup = document.querySelector<HTMLElement>('[data-testid="heartbeat-group-1"]');
    expect(stream).not.toBeNull();
    expect(firstGroup).not.toBeNull();
    if (!stream || !firstGroup) {
      return;
    }
    stream.style.blockSize = "80px";
    stream.style.alignContent = "start";
    stream.scrollTop = 12;

    const detailedButton = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(
      (button) => button.textContent?.trim() === "Detailed",
    );
    detailedButton?.click();
    await wait();
    expect(document.querySelector('[data-testid="heartbeat-group-1"]')).toBe(firstGroup);

    component.warmRefresh();
    flushSync();
    expect(document.querySelector('[data-testid="heartbeat-group-1"]')).toBe(firstGroup);
    expect(stream.scrollTop).toBe(12);

    component.appendGroup(
      heartbeatGroup({
        id: 2,
        groupId: "heartbeat-group:call:2",
        items: [
          heartbeatEntry({
            id: 2,
            parts: [
              heartbeatPart({
                partId: 2,
                messageId: "text-2",
                partType: "text",
                payload: { text: "Live append" },
              }),
            ],
          }),
        ],
      }),
    );
    flushSync();
    expect(document.querySelector('[data-testid="heartbeat-group-1"]')).toBe(firstGroup);

    component.prependGroup(
      heartbeatGroup({
        id: 0,
        groupId: "heartbeat-group:call:0",
        items: [
          heartbeatEntry({
            id: 0,
            parts: [
              heartbeatPart({
                partId: 9,
                messageId: "text-0",
                partType: "text",
                payload: { text: "Older prepend" },
              }),
            ],
          }),
        ],
      }),
    );
    flushSync();
    expect(document.querySelector('[data-testid="heartbeat-group-1"]')).toBe(firstGroup);

    const loadOlderButton = document.querySelector<HTMLButtonElement>('[data-testid="heartbeat-load-older"]');
    expect(loadOlderButton).not.toBeNull();
    loadOlderButton?.click();
    await wait();
    expect(loadOlderButton?.disabled).toBe(true);
    await wait(40);
    expect(loadOlderButton?.isConnected).toBe(false);
  });
});
