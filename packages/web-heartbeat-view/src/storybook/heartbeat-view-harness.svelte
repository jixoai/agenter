<script lang="ts">
  import HeartbeatView from "../HeartbeatView.svelte";
  import { createCachedResourceState } from "../cached-resource-state";
  import type {
    HeartbeatCapabilityMode,
    HeartbeatConfigBinding,
    HeartbeatGroupItem,
    HeartbeatPartItem,
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

  const group = (input: {
    id: number;
    kind: HeartbeatGroupItem["kind"];
    items: HeartbeatPartItem[];
  }): HeartbeatGroupItem => ({
    id: input.id,
    groupId: `story:${input.kind}:${input.id}`,
    kind: input.kind,
    aiCallId: 7,
    createdAt: Math.min(...input.items.map((item) => item.createdAt)),
    updatedAt: Math.max(...input.items.map((item) => item.updatedAt)),
    isComplete: input.items.every((item) => item.isComplete),
    items: input.items,
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
    ...createCachedResourceState([
      group({
        id: 1,
        kind: "before-call",
        items: [
          entry({
            id: 1,
            role: "system",
            scope: "request_aux",
            parts: [
              part({
                partId: 1,
                role: "system",
                partType: "systemPrompt",
                payload: { text: "Keep the LoopBus objective and bounded." },
              }),
            ],
          }),
        ],
      }),
      group({
        id: 2,
        kind: "call",
        items: [
          entry({
            id: 2,
            parts: [
              part({ partId: 2, partType: "thinking", payload: { text: "Trace scheduler debt before answering." } }),
              part({ partId: 3, partType: "text", payload: { text: "LoopBus observed a bounded heartbeat cycle." } }),
              part({
                partId: 4,
                partType: "tool_call",
                isComplete: false,
                payload: {
                  invocationId: "tool_1",
                  tool: "shell.exec",
                  input: { command: "bun test" },
                  startedAt: 1_780_000_000_004,
                },
              }),
            ],
            isComplete: false,
          }),
        ],
      }),
      group({
        id: 3,
        kind: "compact",
        items: [
          entry({
            id: 3,
            role: "assistant",
            parts: [part({ partId: 5, partType: "compact", payload: { text: "Compacted LoopBus context." } })],
          }),
        ],
      }),
    ]),
    loaded: true,
    refreshedAt: 1_780_000_001_000,
  };

  const state: HeartbeatViewState = {
    sessionStatus: "running",
    schedulerState: {
      runtimeStatus: "running",
      waitingReason: null,
    },
    groupsState,
    modelCalls: [
      {
        id: 7,
        kind: "chat",
        status: "completed",
        provider: "openai",
        model: "gpt-story",
        roundIndex: 1,
        createdAt: 1_780_000_000_000,
        updatedAt: 1_780_000_002_000,
        isComplete: true,
        providerSnapshot: null,
        request: { usage: { input_tokens: 420, output_tokens: 80 } },
        response: null,
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

<div class="heartbeat-story-frame" style={`inline-size: ${width}px; block-size: ${height}px;`}>
  <HeartbeatView {state} {mode} avatarLabel="Ada" callbacks={callbacks} />
</div>

<style>
  .heartbeat-story-frame {
    min-inline-size: 0;
    overflow: hidden;
    border: 1px solid color-mix(in srgb, currentColor, transparent 84%);
    background: Canvas;
  }
</style>
