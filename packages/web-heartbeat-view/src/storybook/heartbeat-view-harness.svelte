<script lang="ts">
  import HeartbeatView from "../HeartbeatView.svelte";
  import { createCachedResourceState } from "../cached-resource-state";
  import { ensureFramework7Svelte } from "../framework7-bootstrap";
  import { App } from "../framework7-components";
  import type {
    HeartbeatCapabilityMode,
    HeartbeatConfigBinding,
    HeartbeatPartItem,
    HeartbeatRecordItem,
    HeartbeatRecordPageAnchor,
    HeartbeatRecordPage,
    HeartbeatViewCallbacks,
    HeartbeatViewState,
  } from "../types";

  let {
    width = 390,
    height = 844,
    mode = "readonly",
  }: {
    width?: number;
    height?: number;
    mode?: HeartbeatCapabilityMode;
  } = $props();

  ensureFramework7Svelte();

  const part = (input: {
    partId: number;
    partType: string;
    payload: unknown;
    role?: HeartbeatPartItem["role"];
    isComplete?: boolean;
  }): HeartbeatPartItem["parts"][number] => ({
    partId: input.partId,
    partIndex: input.partId,
    messageId: `story-part-${input.partId}`,
    windowId: null,
    aiCallId: 7,
    roundIndex: 1,
    scope: "heartbeat_part",
    role: input.role ?? "assistant",
    partType: input.partType,
    mimeType: null,
    payload: input.payload,
    createdAt: 1_780_000_000_000 + input.partId,
    updatedAt: 1_780_000_000_500 + input.partId,
    isComplete: input.isComplete ?? true,
  });

  const entry = (input: {
    id: number;
    role?: HeartbeatPartItem["role"];
    scope?: HeartbeatPartItem["scope"];
    parts: HeartbeatPartItem["parts"];
    isComplete?: boolean;
  }): HeartbeatPartItem => ({
    id: input.id,
    messageId: `story-entry-${input.id}`,
    windowId: null,
    aiCallId: 7,
    roundIndex: 1,
    scope: input.scope ?? "heartbeat_part",
    role: input.role ?? "assistant",
    createdAt: 1_780_000_000_000 + input.id,
    updatedAt: 1_780_000_000_500 + input.id,
    isComplete: input.isComplete ?? input.parts.every((item) => item.isComplete),
    parts: input.parts,
    text: "",
  });

  const configBinding: HeartbeatConfigBinding = {
    editableLayerId: "story:avatar",
    editableLayerSource: "story:avatar",
    activeProviderId: "openai",
    providerLabel: "openai · gpt-story",
    providerMetadata: {
      providerId: "openai",
      model: "gpt-story",
      maxContextTokens: 64_000,
      pricingCurrency: "USD",
      pricingBands: [],
    },
    draft: {
      temperature: 0.7,
      topK: null,
      maxToken: 4_000,
      thinkingEnabled: true,
      thinkingBudgetTokens: 2_000,
    },
  };

  const groupsState = {
    ...createCachedResourceState([]),
    loaded: true,
    refreshedAt: 1_780_000_001_000,
  };

  const storyRecordParts: HeartbeatRecordItem["summary"]["parts"] = [
    {
      messageId: "story-input",
      partId: "1",
      role: "user",
      type: "text",
      mimeType: null,
      aiCallId: 7,
      startedAt: 1_780_000_000_000,
      completedAt: 1_780_000_000_060,
      label: "Inspect LoopBus facts",
      isComplete: true,
    },
    {
      messageId: "story-thinking",
      partId: "2",
      role: "assistant",
      type: "thinking",
      mimeType: null,
      aiCallId: 7,
      startedAt: 1_780_000_000_060,
      completedAt: 1_780_000_000_860,
      label: "Trace scheduler debt before answering.",
      isComplete: true,
    },
    {
      messageId: "story-tool",
      partId: "3",
      role: "assistant",
      type: "tool_call",
      mimeType: null,
      aiCallId: 7,
      startedAt: 1_780_000_000_860,
      completedAt: 1_780_000_001_120,
      label: "shell.exec",
      isComplete: true,
    },
    {
      messageId: "story-text",
      partId: "4",
      role: "assistant",
      type: "text",
      mimeType: null,
      aiCallId: 7,
      startedAt: 1_780_000_001_120,
      completedAt: 1_780_000_001_240,
      label: "LoopBus observed a bounded heartbeat cycle.",
      isComplete: true,
    },
  ];

  const storyRecords: HeartbeatRecordItem[] = [
    {
      id: 7,
      recordKey: "story:model-run:7",
      kind: "model_call",
      status: "running",
      primaryAiCallId: 7,
      aiCallIds: [7],
      sourceRefs: [],
      featureFlags: {},
      summary: {
        provider: "openai",
        model: "gpt-story",
        parts: storyRecordParts,
        counts: {
          parts: storyRecordParts.length,
          toolCalls: 1,
          toolResults: 0,
          errors: 0,
        },
        firstFrameMs: 60,
        thinkingDurationMs: 800,
      },
      previewText: "LoopBus observed a bounded heartbeat cycle.",
      startedAt: 1_780_000_000_000,
      updatedAt: 1_780_000_001_500,
      completedAt: null,
      isComplete: false,
    },
    {
      id: 8,
      recordKey: "story:compact:8",
      kind: "compact",
      status: "completed",
      primaryAiCallId: null,
      aiCallIds: [],
      sourceRefs: [],
      featureFlags: {},
      summary: {
        provider: null,
        model: null,
        parts: [],
        counts: { parts: 3, toolCalls: 0, toolResults: 0, errors: 0 },
        firstFrameMs: null,
        thinkingDurationMs: 0,
      },
      previewText: null,
      startedAt: 1_780_000_002_000,
      updatedAt: 1_780_000_002_200,
      completedAt: 1_780_000_002_200,
      isComplete: true,
    },
  ];

  const pagedStoryRecords = [
    {
      ...storyRecords[0],
      id: 1,
      recordKey: "story:model-run:1",
      kind: "model_call" as const,
      status: "completed" as const,
      startedAt: Date.UTC(2026, 0, 1, 23, 58),
      updatedAt: Date.UTC(2026, 0, 1, 23, 58, 30),
      completedAt: Date.UTC(2026, 0, 1, 23, 58, 30),
      isComplete: true,
      previewText: "Older model run",
    },
    {
      ...storyRecords[1],
      id: 2,
      recordKey: "story:compact:2",
      startedAt: Date.UTC(2026, 0, 2, 0, 1),
      updatedAt: Date.UTC(2026, 0, 2, 0, 1, 20),
      completedAt: Date.UTC(2026, 0, 2, 0, 1, 20),
      previewText: "Compact memory",
    },
    {
      ...storyRecords[0],
      id: 3,
      recordKey: "story:model-run:3",
      kind: "config" as const,
      status: "completed" as const,
      primaryAiCallId: null,
      aiCallIds: [],
      summary: {
        provider: null,
        model: null,
        parts: [],
        counts: { parts: 1, toolCalls: 0, toolResults: 0, errors: 0 },
        firstFrameMs: null,
        thinkingDurationMs: 0,
      },
      startedAt: Date.UTC(2026, 0, 2, 0, 2),
      updatedAt: Date.UTC(2026, 0, 2, 0, 2, 20),
      completedAt: Date.UTC(2026, 0, 2, 0, 2, 20),
      isComplete: true,
      previewText: "Config changed",
    },
    {
      ...storyRecords[0],
      id: 4,
      recordKey: "story:model-run:4",
      status: "completed" as const,
      startedAt: Date.UTC(2026, 0, 2, 0, 3),
      updatedAt: Date.UTC(2026, 0, 2, 0, 3, 20),
      completedAt: Date.UTC(2026, 0, 2, 0, 3, 20),
      isComplete: true,
      previewText: "Newest model run",
    },
  ] satisfies HeartbeatRecordItem[];

  const pageSize = 2;
  const buildRecordPage = (anchor: HeartbeatRecordPageAnchor): HeartbeatRecordPage => {
    const totalPages = Math.ceil(pagedStoryRecords.length / pageSize);
    const pageIndex = anchor.kind === "latest" ? totalPages - 1 : Math.max(0, Math.min(anchor.pageIndex, totalPages - 1));
    const start = pageIndex * pageSize;
    const records = pagedStoryRecords.slice(start, start + pageSize);
    return {
      records,
      pageIndex,
      pageSize,
      pageCount: 1,
      totalRecords: pagedStoryRecords.length,
      totalPages,
      windowTotalRecords: pagedStoryRecords.length,
      windowTotalPages: totalPages,
      latestRecordId: pagedStoryRecords.at(-1)?.id ?? null,
      anchor,
      hasOlder: pageIndex > 0,
      hasNewer: pageIndex < totalPages - 1,
      newRecordsAvailable: anchor.kind === "fixed" && pageIndex < totalPages - 1,
    };
  };

  let recordPage: HeartbeatRecordPage = $state(buildRecordPage({ kind: "latest" }));

  const recordsState: HeartbeatViewState["recordsState"] = $derived({
    ...createCachedResourceState<HeartbeatRecordPage>(recordPage),
    loaded: true,
    refreshedAt: 1_780_000_002_500 + recordPage.pageIndex,
  });

  const viewState: HeartbeatViewState = $derived({
    sessionStatus: "running",
    schedulerState: {
      runtimeStatus: "running",
      waitingReason: null,
    },
    groupsState,
    recordsState,
    recordDetailsState: {},
    modelCalls: [
      {
        id: 7,
        kind: "chat",
        status: "done",
        provider: "openai",
        model: "gpt-story",
        roundIndex: 1,
        createdAt: 1_780_000_000_000,
        updatedAt: 1_780_000_002_000,
        isComplete: true,
        providerSnapshot: null,
        request: null,
        response: { usage: { outputTokens: 80 } },
      },
    ],
    attention: { snapshot: { contexts: [{ focusState: "focused" }] } },
    configBinding,
    livePushStatus: "active",
  });

  const callbacks = $derived<HeartbeatViewCallbacks>({
    onLoadOlder: async () => ({ items: 0, hasMore: false }),
    onLoadRecordPage: async (anchor) => {
      recordPage = buildRecordPage(anchor);
    },
    actions:
      mode === "configable"
        ? {
            compact: { available: true },
            config: { available: true },
            onRequestCompact: () => undefined,
            onSaveConfig: () => true,
          }
        : {},
  });
</script>

<App name="web-heartbeat-view-story" theme="ios">
  <div
    class="heartbeat-story-frame"
    data-story-page-index={recordPage.pageIndex}
    data-story-anchor-kind={recordPage.anchor.kind}
    data-story-latest-record-id={recordPage.latestRecordId}
    data-story-tail-record-id={recordPage.records.at(-1)?.id ?? ""}
    style={`inline-size: ${width}px; block-size: ${height}px;`}
  >
    <HeartbeatView state={viewState} {mode} avatarLabel="Ada" callbacks={callbacks} />
  </div>
</App>

<style>
  .heartbeat-story-frame {
    min-inline-size: 0;
    overflow: hidden;
    border: 1px solid color-mix(in srgb, currentColor, transparent 84%);
    background: Canvas;
  }
</style>
