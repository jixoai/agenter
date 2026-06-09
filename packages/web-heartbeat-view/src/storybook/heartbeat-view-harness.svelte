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

  const recordsState = {
    ...createCachedResourceState<HeartbeatRecordPage>({
      records: storyRecords,
      pageIndex: 0,
      pageSize: 5,
      pageCount: 2,
      totalRecords: storyRecords.length,
      totalPages: 1,
      windowTotalRecords: storyRecords.length,
      windowTotalPages: 1,
      latestRecordId: storyRecords.at(-1)?.id ?? null,
      anchor: { kind: "latest" },
      hasOlder: false,
      hasNewer: false,
      newRecordsAvailable: false,
    }),
    loaded: true,
    refreshedAt: 1_780_000_002_500,
  };

  const state: HeartbeatViewState = {
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
  };

  const callbacks = $derived<HeartbeatViewCallbacks>({
    onLoadOlder: async () => ({ items: 0, hasMore: false }),
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
  <div class="heartbeat-story-frame" style={`inline-size: ${width}px; block-size: ${height}px;`}>
    <HeartbeatView {state} {mode} avatarLabel="Ada" callbacks={callbacks} />
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
