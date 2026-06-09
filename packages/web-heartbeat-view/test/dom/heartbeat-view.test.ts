import { flushSync, mount } from "svelte";
import { describe, expect, test } from "vitest";

import {
  createCachedResourceState,
  type CachedResourceState,
  type HeartbeatConfigBinding,
  type HeartbeatGroupItem,
  type HeartbeatRecordDetail,
  type HeartbeatRecordItem,
  type HeartbeatRecordPage,
  type HeartbeatViewState,
  type ModelCallItem,
} from "../../src";
import HeartbeatView from "../../src/HeartbeatView.svelte";
import { heartbeatEntry, heartbeatGroup, heartbeatPart } from "../heartbeat-fixtures";
import { trackMountedComponent } from "../vitest.setup";
import HeartbeatViewFramework7Harness from "./HeartbeatViewFramework7Harness.svelte";
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
  return completeLoadedResource(data);
}

function completeLoadedResource<T>(data: T): CachedResourceState<T> {
  return {
    ...createCachedResourceState(data),
    loaded: true,
    refreshedAt: 100,
  };
}

const recordPart = (input: {
  messageId: string;
  partId: string;
  role: "user" | "assistant" | "tool" | "config";
  type: string;
  startedAt: number;
  completedAt?: number | null;
  label?: string;
  isComplete?: boolean;
}) => ({
  messageId: input.messageId,
  partId: input.partId,
  role: input.role,
  type: input.type,
  mimeType: null,
  aiCallId: 77,
  startedAt: input.startedAt,
  completedAt: input.completedAt ?? input.startedAt + 100,
  label: input.label ?? input.type,
  isComplete: input.isComplete ?? true,
});

const heartbeatRecord = (input: {
  id: number;
  kind: HeartbeatRecordItem["kind"];
  status?: HeartbeatRecordItem["status"];
  previewText?: string | null;
  parts?: HeartbeatRecordItem["summary"]["parts"];
}): HeartbeatRecordItem => ({
  id: input.id,
  recordKey: `test-record:${input.id}`,
  kind: input.kind,
  status: input.status ?? "completed",
  primaryAiCallId: input.kind === "model_call" ? 77 : null,
  aiCallIds: input.kind === "model_call" ? [77] : [],
  sourceRefs: [],
  featureFlags: {},
  summary: {
    provider: input.kind === "model_call" ? "openai" : null,
    model: input.kind === "model_call" ? "gpt-test" : null,
    parts: input.parts ?? [],
    counts: {
      parts: input.parts?.length ?? 1,
      toolCalls: input.parts?.filter((part) => part.type === "tool_call").length ?? 0,
      toolResults: input.parts?.filter((part) => part.type === "tool_result").length ?? 0,
      errors: input.status === "error" ? 1 : 0,
    },
    firstFrameMs: input.kind === "model_call" ? 180 : null,
    thinkingDurationMs: 620,
  },
  previewText: input.previewText ?? null,
  startedAt: 1_780_000_000_000 + input.id,
  updatedAt: 1_780_000_001_000 + input.id,
  completedAt: input.status === "running" ? null : 1_780_000_001_000 + input.id,
  isComplete: input.status !== "running",
});

const recordsPage = (records: HeartbeatRecordItem[]): HeartbeatRecordPage => ({
  records,
  pageIndex: 0,
  pageSize: 20,
  totalRecords: records.length,
  totalPages: records.length > 0 ? 1 : 0,
  windowTotalRecords: records.length,
  windowTotalPages: records.length > 0 ? 1 : 0,
  latestRecordId: records[0]?.id ?? null,
  anchor: { kind: "latest" },
  hasOlder: false,
  hasNewer: false,
  newRecordsAvailable: false,
});

const recordDetail = (
  record: HeartbeatRecordItem,
  messages: HeartbeatRecordDetail["messages"],
): HeartbeatRecordDetail => ({
  record,
  aiCalls: [],
  messages,
  sourceRefs: record.sourceRefs,
});

const configBinding: HeartbeatConfigBinding = {
  editableLayerId: "user:avatar",
  editableLayerSource: "user:avatar",
  activeProviderId: "openai",
  providerLabel: "openai · gpt",
  providerMetadata: {
    providerId: "openai",
    model: "gpt-test",
    maxContextTokens: 128_000,
    pricingCurrency: null,
    pricingBands: [],
  },
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

const contextModelCalls: ModelCallItem[] = [
  {
    id: 41,
    kind: "chat",
    status: "done",
    provider: "openai",
    model: "gpt-test",
    roundIndex: 1,
    createdAt: 1_000,
    updatedAt: 1_100,
    isComplete: true,
    providerSnapshot: null,
    request: null,
    response: { usage: { outputTokens: 32_000 } },
  },
  {
    id: 42,
    kind: "chat",
    status: "done",
    provider: "openai",
    model: "gpt-test",
    roundIndex: 2,
    createdAt: 1_200,
    updatedAt: 1_300,
    isComplete: true,
    providerSnapshot: null,
    request: null,
    response: { usage: { outputTokens: 8_000 } },
  },
];

type StabilityHarnessExports = {
  warmRefresh(): void;
  appendGroup(group: HeartbeatGroupItem): void;
  prependGroup(group: HeartbeatGroupItem): void;
};

const wait = (ms = 0): Promise<void> =>
  new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });

const documentTextIncludingShadow = (): string => {
  const chunks = [document.body.textContent ?? ""];
  const collectShadowText = (root: ParentNode): void => {
    for (const element of Array.from(root.querySelectorAll("*"))) {
      if (element.shadowRoot) {
        chunks.push(element.shadowRoot.textContent ?? "");
        collectShadowText(element.shadowRoot);
      }
    }
  };
  collectShadowText(document.body);
  return chunks.join(" ");
};

const waitForDocumentText = async (text: string): Promise<void> => {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (documentTextIncludingShadow().includes(text)) {
      return;
    }
    await wait();
  }
  throw new Error(`Timed out waiting for text: ${text}\nBody: ${documentTextIncludingShadow()}`);
};

describe("Feature: HeartbeatView DOM capability contract", () => {
  test("Scenario: Given readonly mode When rows render Then config and compact actions are not executable", async () => {
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

    await waitForDocumentText("Assistant heartbeat text");
    expect(document.body.textContent).toContain("No live push is active");
    expect(document.querySelector('[aria-label="Heartbeat row layout"]')).toBeNull();
    expect(document.querySelector('[title="Request compact"]')).toBeNull();
    expect(document.querySelector('[title="Configure next call"]')).toBeNull();
  });

  test("Scenario: Given configable mode When handlers exist Then bottom statusbar exposes formal actions", () => {
    const component = mount(HeartbeatViewFramework7Harness, {
      target: document.body,
      props: {
        mode: "configable",
        avatarLabel: "Ada",
        state: {
          sessionStatus: "running",
          groupsState: loadedGroups,
          modelCalls: contextModelCalls,
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

    const toolbar = document.querySelector('[role="toolbar"][data-testid="heartbeat-statusbar"]');
    expect(toolbar).not.toBeNull();
    expect(toolbar?.querySelector('[title="Context usage"]')).not.toBeNull();
    expect(toolbar?.textContent).toContain("31.3%");
    const toolbarActions = Array.from(toolbar?.querySelectorAll<HTMLElement>(".ag-heartbeat-toolbar__action") ?? []);
    expect(toolbarActions).toHaveLength(2);
    expect(toolbarActions.every((action) => action.classList.contains("link"))).toBe(true);
    expect(
      toolbar
        ?.querySelector<HTMLElement>(".ag-heartbeat-context-trigger")
        ?.style.getPropertyValue("--ag-heartbeat-context-progress"),
    ).toBe("0.3125");
    expect(toolbar?.querySelector(".ag-heartbeat-context-trigger__ring")).not.toBeNull();
    expect(toolbar?.querySelector('[title="Request compact"]')).toBeNull();
    expect(toolbar?.querySelector('[title="Configure next call"]')).not.toBeNull();
  });

  test("Scenario: Given configable mode When context usage is tapped Then the Sheet shows usage details and moved compact action", async () => {
    let compactRequests = 0;
    const component = mount(HeartbeatViewFramework7Harness, {
      target: document.body,
      props: {
        mode: "configable",
        avatarLabel: "Ada",
        state: {
          sessionStatus: "running",
          groupsState: loadedGroups,
          modelCalls: contextModelCalls,
          configBinding: {
            ...configBinding,
            providerMetadata: {
              providerId: "openai",
              model: "gpt-test",
              maxContextTokens: 128_000,
              pricingCurrency: null,
              pricingBands: [],
            },
          },
        },
        callbacks: {
          actions: {
            compact: { available: true },
            config: { available: true },
            onRequestCompact: () => {
              compactRequests += 1;
            },
            onSaveConfig: () => true,
          },
        },
      },
    });
    trackMountedComponent(component);

    await waitForDocumentText("31.3%");
    const contextUsageButton = document.querySelector<HTMLElement>('[title="Context usage"]');
    expect(contextUsageButton).not.toBeNull();
    contextUsageButton?.click();
    await waitForDocumentText("Context usage");
    expect(document.body.textContent).toContain("31.3%");
    expect(document.body.textContent).toContain("40K / 128K");
    expect(document.body.textContent).toContain("Input");
    expect(document.body.textContent).toContain("32K");
    expect(document.body.textContent).toContain("Output");
    expect(document.body.textContent).toContain("8K");
    expect(document.body.textContent).toContain("openai · gpt");
    expect(document.body.textContent).toContain("temperature:0.7");
    expect(document.body.textContent).toContain("thinking:false");
    expect(document.body.textContent).not.toContain("Cost");
    const sheet = document.querySelector<HTMLElement>('[data-testid="heartbeat-context-usage-sheet"]');
    expect(sheet?.classList.contains("ag-heartbeat-modal-sheet")).toBe(true);
    expect(sheet?.querySelector(".ag-heartbeat-modal-sheet__toolbar")).not.toBeNull();
    expect(sheet?.querySelector(".ag-heartbeat-modal-sheet__title")).not.toBeNull();
    expect(sheet?.querySelectorAll(".list").length).toBeGreaterThanOrEqual(2);
    expect(sheet?.querySelectorAll(".item-content").length).toBeGreaterThanOrEqual(5);
    expect(sheet?.querySelector(".ag-heartbeat-context-meter")).toBeNull();
    const progressbar = sheet?.querySelector<HTMLElement>(".ag-heartbeat-context-progressbar.progressbar");
    expect(progressbar).not.toBeNull();
    expect(progressbar?.dataset.progress).toBe("31.25");
    expect(sheet?.querySelector(".ag-heartbeat-context-sheet__ring")).toBeNull();
    expect(sheet?.querySelector(".ag-heartbeat-context-compact .list-button")).not.toBeNull();

    const compactAction = Array.from(document.querySelectorAll<HTMLElement>("a, button")).find((element) =>
      element.textContent?.includes("Request compact"),
    );
    expect(compactAction).not.toBeNull();
    compactAction?.click();
    await waitForDocumentText("Compact Heartbeat");
    const confirmButton = Array.from(document.querySelectorAll<HTMLElement>(".dialog-button")).find((button) =>
      button.textContent?.includes("OK"),
    );
    confirmButton?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    await wait();
    expect(compactRequests).toBe(1);
  });

  test("Scenario: Given configable mode When authority is missing Then bottom toolbar keeps disabled action affordances", async () => {
    let compactRequests = 0;
    const component = mount(HeartbeatViewFramework7Harness, {
      target: document.body,
      props: {
        mode: "configable",
        avatarLabel: "Ada",
        state: {
          sessionStatus: "stopped",
          groupsState: loadedGroups,
        },
        callbacks: {
          actions: {
            compact: { available: false, reason: "No compact authority" },
            config: { available: false, reason: "No config authority" },
            onRequestCompact: () => {
              compactRequests += 1;
            },
            onSaveConfig: () => {
              throw new Error("disabled config must not save");
            },
          },
        },
      },
    });
    trackMountedComponent(component);

    const toolbar = document.querySelector('[role="toolbar"][data-testid="heartbeat-statusbar"]');
    expect(toolbar).not.toBeNull();
    expect(toolbar?.querySelector('[title="Context usage"]')).not.toBeNull();
    expect(toolbar?.querySelector('[title="Compact action is unavailable for this target"]')).toBeNull();
    const configAction = toolbar?.querySelector<HTMLElement>('[title="No config authority"]');
    expect(configAction).not.toBeNull();
    expect(configAction?.getAttribute("aria-disabled")).toBe("true");
    configAction?.click();
    await wait();
    expect(document.querySelector('[data-testid="heartbeat-config-sheet"]')).toBeNull();

    toolbar?.querySelector<HTMLElement>('[title="Context usage"]')?.click();
    await waitForDocumentText("Context usage");
    const compactAction = Array.from(document.querySelectorAll<HTMLElement>("a, button")).find((element) =>
      element.textContent?.includes("Request compact"),
    );
    expect(document.querySelector(".ag-heartbeat-context-compact.disabled")).not.toBeNull();
    compactAction?.click();
    await wait();
    expect(compactRequests).toBe(0);
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

  test("Scenario: Given record resources When model-run rows render Then bounded metro cards drive detail without preview placeholders", async () => {
    const modelRecord = heartbeatRecord({
      id: 101,
      kind: "model_call",
      previewText: null,
      parts: [
        recordPart({
          messageId: "record-user-101",
          partId: "record-user-101:1",
          role: "user",
          type: "text",
          startedAt: 1_780_000_000_000,
          completedAt: 1_780_000_000_050,
          label: "Please inspect the current runtime facts.",
        }),
        recordPart({
          messageId: "record-thinking-101",
          partId: "record-thinking-101:2",
          role: "assistant",
          type: "thinking",
          startedAt: 1_780_000_000_050,
          completedAt: 1_780_000_000_650,
          label: "Trace the source refs.",
        }),
        recordPart({
          messageId: "record-tool-101",
          partId: "record-tool-101:3",
          role: "assistant",
          type: "tool_call",
          startedAt: 1_780_000_000_650,
          completedAt: 1_780_000_000_900,
          label: "shell.exec",
        }),
        recordPart({
          messageId: "record-tool-result-101",
          partId: "record-tool-result-101:4",
          role: "user",
          type: "tool_result",
          startedAt: 1_780_000_000_900,
          completedAt: 1_780_000_001_000,
          label: "tool result",
        }),
        recordPart({
          messageId: "record-text-101",
          partId: "record-text-101:5",
          role: "assistant",
          type: "text",
          startedAt: 1_780_000_001_000,
          completedAt: 1_780_000_001_120,
          label: "Runtime facts are visible.",
        }),
      ],
    });
    let detailLoads = 0;
    const component = mount(HeartbeatView, {
      target: document.body,
      props: {
        mode: "readonly",
        avatarLabel: "Ada",
        state: {
          sessionStatus: "running",
          groupsState: completeLoadedState([]),
          recordsState: completeLoadedResource(recordsPage([modelRecord])),
          recordDetailsState: {
            [modelRecord.id]: completeLoadedResource(
              recordDetail(modelRecord, [
                heartbeatEntry({
                  id: 101,
                  messageId: "record-thinking-101",
                  parts: [
                    heartbeatPart({
                      partId: 2,
                      messageId: "record-thinking-101",
                      partType: "thinking",
                      payload: { text: "Trace the source refs." },
                    }),
                    heartbeatPart({
                      partId: 3,
                      messageId: "record-tool-101",
                      partType: "tool_call",
                      payload: { tool: "shell.exec", input: { command: "bun test" } },
                    }),
                    heartbeatPart({
                      partId: 5,
                      messageId: "record-text-101",
                      partType: "text",
                      payload: { text: "Runtime facts are visible." },
                    }),
                  ],
                }),
              ]),
            ),
          },
        },
        callbacks: {
          onLoadRecordDetail: async () => {
            detailLoads += 1;
          },
        },
      },
    });
    trackMountedComponent(component);

    await waitForDocumentText("Model run");
    expect(document.body.textContent).not.toContain("No summary");
    expect(document.querySelector('[data-testid="heartbeat-group-101"]')).toBeNull();
    expect(document.querySelector('[data-chip-kind="input"]')).not.toBeNull();
    expect(document.querySelector('[data-chip-kind="tool"], [data-chip-kind="combo"]')).not.toBeNull();
    expect(document.querySelector('[data-chip-kind="text"]')).not.toBeNull();
    const card = document.querySelector<HTMLElement>('[data-testid="heartbeat-record-101"]');
    expect(card).not.toBeNull();
    expect(card ? card.scrollWidth <= card.clientWidth + 1 : false).toBe(true);

    card?.click();
    await waitForDocumentText("Model run detail");
    expect(detailLoads).toBe(1);
    expect(document.querySelector('[data-testid="heartbeat-record-detail"]')?.getAttribute("data-kind")).toBe(
      "model_call",
    );
    expect(document.body.textContent).toContain("Trace the source refs.");
    expect(document.body.textContent).toContain("shell.exec");
    expect(document.querySelector(".station-heartbeat-entries .ag-heartbeat-entry")).not.toBeNull();
    expect(document.querySelector(".station-payload")).toBeNull();
    const detailTrack = document.querySelector<HTMLElement>('[data-testid="heartbeat-record-detail-track"]');
    expect(detailTrack?.style.gridTemplateRows).not.toContain("1fr");
    expect(detailTrack?.style.gridTemplateRows).not.toContain("min-content");
    expect(document.querySelector<HTMLElement>(".ag-heartbeat-record-detail__chip-link-vertical")?.style.gridRow).toBe(
      document.querySelector<HTMLElement>(".ag-heartbeat-record-detail-track__station-link")?.style.gridRow,
    );
    const detailInputChip = document.querySelector<HTMLElement>(
      '[data-testid="heartbeat-record-detail-track"] [data-chip-kind="input"]',
    );
    expect(detailInputChip?.querySelectorAll(".ag-heartbeat-record-chip__token").length).toBe(1);
    expect(detailInputChip?.querySelector(".ag-heartbeat-record-chip__label")).toBeNull();
    expect(document.querySelector(".ag-heartbeat-record-detail__time-label")).not.toBeNull();
    expect(document.querySelector(".ag-heartbeat-record-detail__time-label .time-bridge-label__content")).not.toBeNull();
    expect(document.querySelector(".ag-heartbeat-record-detail__time-crossline")).not.toBeNull();
    expect(
      document.querySelector(".ag-heartbeat-record-detail__time-bridge .ag-heartbeat-record-detail__time-svg-main"),
    ).not.toBeNull();
    expect(
      document.querySelector(".ag-heartbeat-record-detail__time-bridge .time-svg")?.getAttribute("viewBox"),
    ).toBeNull();
    expect(document.querySelector<HTMLElement>('[data-time-bridge-kind="first"]')?.style.gridRow).toBe("1");
    expect(document.querySelector('[data-time-bridge-kind="after"]')).not.toBeNull();
    expect(document.querySelector(".ag-heartbeat-record-detail__chip-link-vertical")).not.toBeNull();
    expect(
      getComputedStyle(document.querySelector<HTMLElement>(".ag-heartbeat-record-detail__step-chip")!).position,
    ).toBe("sticky");
  });

  test("Scenario: Given a host route adapter When a record row is selected Then detail opens through host navigation instead of inline expansion", async () => {
    const modelRecord = heartbeatRecord({
      id: 104,
      kind: "model_call",
      previewText: "Route detail row",
      parts: [
        recordPart({
          messageId: "record-user-104",
          partId: "1",
          role: "user",
          type: "text",
          startedAt: 1_780_000_000_000,
          completedAt: 1_780_000_000_050,
          label: "Open the route detail.",
        }),
        recordPart({
          messageId: "record-text-104",
          partId: "2",
          role: "assistant",
          type: "text",
          startedAt: 1_780_000_000_050,
          completedAt: 1_780_000_000_150,
          label: "Route detail is host owned.",
        }),
      ],
    });
    const openedRecordIds: number[] = [];
    let inlineDetailLoads = 0;
    const component = mount(HeartbeatView, {
      target: document.body,
      props: {
        mode: "readonly",
        avatarLabel: "Ada",
        state: {
          sessionStatus: "running",
          groupsState: completeLoadedState([]),
          recordsState: completeLoadedResource(recordsPage([modelRecord])),
          recordDetailsState: {
            [modelRecord.id]: completeLoadedResource(recordDetail(modelRecord, [])),
          },
        },
        callbacks: {
          onOpenRecordDetail: (recordId) => {
            openedRecordIds.push(recordId);
          },
          onLoadRecordDetail: async () => {
            inlineDetailLoads += 1;
          },
        },
      },
    });
    trackMountedComponent(component);

    await waitForDocumentText("Route detail row");
    document.querySelector<HTMLElement>('[data-testid="heartbeat-record-104"]')?.click();
    await wait();

    expect(openedRecordIds).toEqual([104]);
    expect(inlineDetailLoads).toBe(0);
    expect(document.querySelector('[data-testid="heartbeat-record-detail"]')).toBeNull();
  });

  test("Scenario: Given compact record without usage payload When the list card renders Then sample compression numbers are not invented", async () => {
    const compactRecord = heartbeatRecord({
      id: 105,
      kind: "compact",
      parts: [
        recordPart({
          messageId: "record-compact-105",
          partId: "1",
          role: "assistant",
          type: "compact",
          startedAt: 1_780_000_000_000,
          completedAt: 1_780_000_000_120,
          label: "compact",
        }),
      ],
    });
    const component = mount(HeartbeatView, {
      target: document.body,
      props: {
        mode: "readonly",
        avatarLabel: "Ada",
        state: {
          sessionStatus: "running",
          groupsState: completeLoadedState([]),
          recordsState: completeLoadedResource(recordsPage([compactRecord])),
        },
      },
    });
    trackMountedComponent(component);

    await waitForDocumentText("Compact");
    expect(document.body.textContent).not.toContain("63.4");
    expect(document.body.textContent).not.toContain("24.1");
    expect(document.querySelector('[data-object-kind="compact"]')).not.toBeNull();
  });

  test("Scenario: Given compact record detail When rendered inline Then new context stays primary and tabs stay host-owned", async () => {
    const compactRecord = heartbeatRecord({
      id: 102,
      kind: "compact",
      status: "running",
      parts: [
        recordPart({
          messageId: "record-compact-102",
          partId: "1",
          role: "assistant",
          type: "compact",
          startedAt: 1_780_000_000_000,
          completedAt: null,
          label: "compact",
        }),
      ],
    });
    const component = mount(HeartbeatView, {
      target: document.body,
      props: {
        mode: "readonly",
        avatarLabel: "Ada",
        state: {
          sessionStatus: "running",
          groupsState: completeLoadedState([]),
          recordsState: completeLoadedResource(recordsPage([compactRecord])),
          recordDetailsState: {
            [compactRecord.id]: completeLoadedResource(
              recordDetail(compactRecord, [
                heartbeatEntry({
                  id: 1010,
                  messageId: "record-compact-prompt-102",
                  scope: "request_aux",
                  role: "system",
                  parts: [
                    heartbeatPart({
                      partId: 10,
                      messageId: "record-compact-prompt-102",
                      scope: "request_aux",
                      role: "system",
                      partType: "text",
                      payload: { text: "Old prompt fact folded into compact." },
                    }),
                  ],
                }),
                heartbeatEntry({
                  id: 102,
                  messageId: "record-compact-102",
                  parts: [
                    heartbeatPart({
                      partId: 1,
                      messageId: "record-compact-102",
                      partType: "compact",
                      payload: { text: "New compact context is streaming." },
                    }),
                  ],
                }),
              ]),
            ),
          },
        },
      },
    });
    trackMountedComponent(component);

    await waitForDocumentText("Compact");
    document.querySelector<HTMLElement>('[data-testid="heartbeat-record-102"]')?.click();
    await waitForDocumentText("New compact context is streaming.");
    expect(document.querySelector(".ag-heartbeat-record-compact-detail__tabs.segmented")).toBeNull();
    expect(document.body.textContent).not.toContain("Old context snapshot.");
    expect(document.querySelector('[data-testid="heartbeat-record-detail"] [data-object-kind="compact"]')).not.toBeNull();
    expect(document.querySelector(".ag-heartbeat-record-compact-detail__entries .ag-heartbeat-entry")).not.toBeNull();
    expect(document.body.textContent).toContain("Compact prompt facts");
    expect(document.body.textContent).toContain("streaming");
  });

  test("Scenario: Given config record detail When rendered inline Then YAML diff is first and tabs stay host-owned", async () => {
    const configRecord = heartbeatRecord({
      id: 103,
      kind: "config",
      parts: [
        recordPart({
          messageId: "record-config-103",
          partId: "1",
          role: "config",
          type: "config",
          startedAt: 1_780_000_000_000,
          label: "config",
        }),
      ],
    });
    const component = mount(HeartbeatView, {
      target: document.body,
      props: {
        mode: "readonly",
        avatarLabel: "Ada",
        state: {
          sessionStatus: "running",
          groupsState: completeLoadedState([]),
          recordsState: completeLoadedResource(recordsPage([configRecord])),
          recordDetailsState: {
            [configRecord.id]: completeLoadedResource(
              recordDetail(configRecord, [
                heartbeatEntry({
                  id: 103,
                  messageId: "record-config-103",
                  role: "config",
                  parts: [
                    heartbeatPart({
                      partId: 1,
                      messageId: "record-config-103",
                      role: "config",
                      partType: "config",
                      payload: {
                        oldConfig: null,
                        newConfig: { thinking: "auto", maxToken: "adaptive" },
                      },
                    }),
                  ],
                }),
              ]),
            ),
          },
        },
      },
    });
    trackMountedComponent(component);

    await waitForDocumentText("Config");
    document.querySelector<HTMLElement>('[data-testid="heartbeat-record-103"]')?.click();
    await waitForDocumentText("Diff Config");
    expect(document.querySelector(".ag-heartbeat-record-config-detail__tabs.segmented")).toBeNull();
    expect(document.querySelector('[data-testid="heartbeat-record-detail"] [data-object-kind="config"]')).toBeNull();
    expect(document.querySelector(".ag-heartbeat-record-config-detail__syntax-line[data-control='thinking']")).not.toBeNull();
    expect(document.querySelector(".ag-heartbeat-record-config-detail__syntax-line[data-control='maxtoken']")).not.toBeNull();
    expect(document.querySelector(".ag-heartbeat-record-config-detail__syntax-icon svg")).not.toBeNull();
    expect(document.body.textContent).toContain("auto");
    expect(document.body.textContent).toContain("adaptive");
    expect(document.body.textContent).not.toContain("0t");
    expect(document.querySelector(".ag-heartbeat-record-config-detail__syntax-line[data-control='topk']")).toBeNull();
    expect(document.querySelector(".ag-heartbeat-record-config-detail__syntax-line[data-control='budget']")).toBeNull();
    expect(document.body.textContent).toContain("--- old-config");
    expect(document.body.textContent).toContain("+++ new-config");
    expect(document.body.textContent).toContain("-null");
    expect(document.body.textContent).toContain("+thinking: auto");
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
    expect(document.querySelector('[aria-label="Heartbeat row layout"]')).not.toBeNull();
    expect(document.body.textContent).toContain("Reasoning");
    expect(document.body.textContent).toContain("shell.exec");
    expect(document.body.textContent).toContain("bun test");
    expect(document.body.textContent).toContain("Config");
    expect(document.body.textContent).toContain("Compacted memory");
    expect(document.querySelector(".ag-heartbeat-entry__summary")).toBeNull();
    expect(document.querySelector(".ag-heartbeat-tool__state")).toBeNull();
    expect(document.querySelector('[aria-label="Tool running"]')).not.toBeNull();
  });

  test("Scenario: Given a user Heartbeat row When rendered Then the user avatar is placed on the right", () => {
    const component = mount(HeartbeatView, {
      target: document.body,
      props: {
        mode: "readonly",
        avatarLabel: "Ada",
        state: {
          sessionStatus: "running",
          groupsState: completeLoadedState([
            heartbeatGroup({
              id: 7,
              items: [
                heartbeatEntry({
                  id: 7,
                  role: "user",
                  parts: [
                    heartbeatPart({
                      partId: 17,
                      messageId: "user-17",
                      role: "user",
                      partType: "text",
                      payload: { text: "User request text" },
                    }),
                  ],
                }),
              ],
            }),
          ]),
        },
      },
    });
    trackMountedComponent(component);

    const userSection = document.querySelector<HTMLElement>('.ag-heartbeat-section[data-role="user"]');
    const avatar = userSection?.querySelector<HTMLElement>(".ag-heartbeat-avatar");
    expect(userSection).not.toBeNull();
    expect(avatar).not.toBeNull();
    expect(avatar ? getComputedStyle(avatar).gridColumnStart : "").toBe("2");
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
    stream.style.overflow = "auto";
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
