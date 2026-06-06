<script lang="ts">
  import Settings2 from "@lucide/svelte/icons/settings-2";
  import { tick } from "svelte";

  import { Block, BlockTitle, Button, Link, List, ListInput, ListItem, PageContent, Sheet, Toolbar, Toggle } from "./framework7-components";
  import HeartbeatContextUsageSheet from "./heartbeat-context-usage-sheet.svelte";
  import {
    buildHeartbeatContextState,
    formatHeartbeatContextPercentLabel,
    resolveHeartbeatConfiguredContextLimit,
    type HeartbeatContextState,
  } from "./heartbeat-statusbar-state";
  import type {
    HeartbeatCapabilityMode,
    HeartbeatConfigActions,
    HeartbeatConfigBinding,
    HeartbeatConfigDraft,
    ModelCallItem,
  } from "./types";

  let {
    mode,
    compactPending = false,
    configBinding = null,
    configLoading = false,
    configSaving = false,
    configError = null,
    modelCalls = [],
    contextState = null,
    actions = {},
  }: {
    mode: HeartbeatCapabilityMode;
    compactPending?: boolean;
    configBinding?: HeartbeatConfigBinding | null;
    configLoading?: boolean;
    configSaving?: boolean;
    configError?: string | null;
    modelCalls?: ModelCallItem[];
    contextState?: HeartbeatContextState | null;
    actions?: HeartbeatConfigActions;
  } = $props();

  let configOpen = $state(false);
  let contextUsageMounted = $state(false);
  let contextUsageOpen = $state(false);
  let draft = $state<HeartbeatConfigDraft | null>(null);
  let temperatureInput = $state("");
  let topKInput = $state("");
  let maxTokenInput = $state("");
  let thinkingEnabledInput = $state(false);

  const compactVisible = $derived(mode === "configable");
  const configVisible = $derived(mode === "configable");
  const configEnabled = $derived(
    actions.config?.available === true && typeof actions.onSaveConfig === "function" && Boolean(configBinding),
  );
  const resolvedContextState = $derived(
    contextState ?? buildHeartbeatContextState(modelCalls, resolveHeartbeatConfiguredContextLimit(configBinding)),
  );
  const contextUsageLabel = $derived(formatHeartbeatContextPercentLabel(resolvedContextState));
  const contextProgressRatio = $derived(
    resolvedContextState.kind === "available" && resolvedContextState.progress !== null
      ? Math.max(0, Math.min(1, resolvedContextState.progress))
      : 0,
  );
  const contextSafeMixPercent = $derived(`${Math.min(contextProgressRatio * 2, 1) * 100}%`);
  const contextRiskMixPercent = $derived(`${Math.max(0, Math.min((contextProgressRatio - 0.5) * 2, 1)) * 100}%`);
  const contextProgressStyle = $derived(
    [
      `--ag-heartbeat-context-progress:${contextProgressRatio}`,
      `--ag-heartbeat-context-safe-mix:${contextSafeMixPercent}`,
      `--ag-heartbeat-context-risk-mix:${contextRiskMixPercent}`,
    ].join(";"),
  );
  const configInteractive = $derived(configEnabled && !configLoading && !configSaving);
  const configTitle = $derived.by(() => {
    if (configSaving) {
      return "Saving config";
    }
    if (configLoading) {
      return "Loading config";
    }
    if (configInteractive) {
      return "Configure next call";
    }
    return actions.config?.reason ?? "Config action is unavailable for this target";
  });
  const toolbarActionClass = (enabled: boolean): string => (enabled ? "" : "disabled");
  const configActionClass = $derived(
    [
      "ag-heartbeat-toolbar__action",
      "ag-heartbeat-toolbar__action--icon",
      toolbarActionClass(configInteractive),
    ]
      .filter((value) => value.length > 0)
      .join(" "),
  );

  const parseDraftNumber = (value: string): number | null => {
    const trimmed = value.trim();
    return trimmed.length > 0 ? Number(trimmed) : null;
  };

  const syncDraftInputs = (nextDraft: HeartbeatConfigDraft): void => {
    temperatureInput = nextDraft.temperature === null ? "" : String(nextDraft.temperature);
    topKInput = nextDraft.topK === null ? "" : String(nextDraft.topK);
    maxTokenInput = nextDraft.maxToken === null ? "" : String(nextDraft.maxToken);
    thinkingEnabledInput = nextDraft.thinkingEnabled;
  };

  const readDraftInputs = (): HeartbeatConfigDraft | null =>
    draft
      ? {
          ...draft,
          temperature: parseDraftNumber(temperatureInput),
          topK: parseDraftNumber(topKInput),
          maxToken: parseDraftNumber(maxTokenInput),
          thinkingEnabled: thinkingEnabledInput,
        }
      : null;

  const openContextUsage = (): void => {
    contextUsageOpen = false;
    contextUsageMounted = true;
    void tick().then(() => {
      if (contextUsageMounted) {
        contextUsageOpen = true;
      }
    });
  };

  const setThinkingEnabled = (event: Event): void => {
    if (event.currentTarget instanceof HTMLInputElement) {
      thinkingEnabledInput = event.currentTarget.checked;
    }
  };

  const openConfig = (): void => {
    if (!configInteractive || !configBinding) {
      return;
    }
    configOpen = false;
    draft = { ...configBinding.draft };
    syncDraftInputs(configBinding.draft);
    void tick().then(() => {
      if (draft) {
        configOpen = true;
      }
    });
  };

  const saveConfig = async (): Promise<void> => {
    const nextDraft = readDraftInputs();
    if (!nextDraft || !actions.onSaveConfig) {
      return;
    }
    draft = nextDraft;
    const ok = await actions.onSaveConfig(nextDraft);
    if (ok) {
      configOpen = false;
    }
  };
</script>

{#if mode === "configable"}
  <Toolbar
    bottom
    position="bottom"
    class="ag-heartbeat-toolbar"
    role="toolbar"
    aria-label="Heartbeat actions"
    data-testid="heartbeat-statusbar"
  >
    {#if compactVisible}
      <Link
        class="ag-heartbeat-toolbar__action ag-heartbeat-context-trigger"
        title="Context usage"
        aria-label={`Context usage ${contextUsageLabel}`}
        style={contextProgressStyle}
        onClick={openContextUsage}
      >
        <span>{contextUsageLabel}</span>
        <span class="ag-heartbeat-context-trigger__ring" aria-hidden="true"></span>
      </Link>
    {/if}
    {#if configVisible}
      <Link
        iconOnly
        class={configActionClass}
        title={configTitle}
        aria-label={configTitle}
        aria-disabled={configInteractive ? "false" : "true"}
        tabindex={configInteractive ? 0 : -1}
        onClick={openConfig}
      >
        <Settings2 size={20} aria-hidden="true" />
      </Link>
    {/if}
  </Toolbar>

  {#if contextUsageMounted}
    <HeartbeatContextUsageSheet
      opened={contextUsageOpen}
      contextState={resolvedContextState}
      {configBinding}
      {compactPending}
      compactAction={actions.compact}
      onRequestCompact={actions.onRequestCompact}
      onClose={() => {
        contextUsageOpen = false;
        contextUsageMounted = false;
      }}
    />
  {/if}
{/if}

{#if mode === "configable" && draft}
  <Sheet
    class="ag-heartbeat-modal-sheet ag-heartbeat-config-sheet"
    data-testid="heartbeat-config-sheet"
    opened={configOpen}
    backdrop
    push
    style="height: auto; max-height: min(92vh, 560px)"
    onSheetClosed={() => {
      configOpen = false;
      draft = null;
    }}
  >
    <Toolbar class="ag-heartbeat-modal-sheet__toolbar ag-heartbeat-config-sheet__toolbar">
      <div class="left">
        <span class="ag-heartbeat-modal-sheet__title ag-heartbeat-config-sheet__title">Next call config</span>
      </div>
      <div class="right">
        <Link sheetClose iconOnly iconF7="xmark" aria-label="Close config" tooltip="Close" />
      </div>
    </Toolbar>

    {#if draft}
      <PageContent class="ag-heartbeat-modal-sheet__content ag-heartbeat-config-sheet__content">
        <BlockTitle>Provider call parameters</BlockTitle>
        {#if configError}
          <Block strong class="ag-heartbeat-config-error">{configError}</Block>
        {/if}
        <List strongIos insetIos dividersIos>
          <ListInput label="Temperature" type="number" step="0.1" bind:value={temperatureInput} />
          <ListInput label="Top K" type="number" step="1" bind:value={topKInput} />
          <ListInput label="Max tokens" type="number" step="1" bind:value={maxTokenInput} />
          <ListItem title="Thinking">
            {#snippet after()}
              <Toggle
                checked={thinkingEnabledInput}
                onChange={setThinkingEnabled}
              />
            {/snippet}
          </ListItem>
        </List>
        <Block class="ag-heartbeat-config-sheet__actions">
          <Button outline disabled={configLoading} onClick={() => void actions.onRefreshConfig?.()}>Refresh</Button>
          <Button fill disabled={configSaving} onClick={() => void saveConfig()}>Save</Button>
        </Block>
      </PageContent>
    {/if}
  </Sheet>
{/if}

<style>
  :global(.ag-heartbeat-toolbar .toolbar-inner) {
    display: flex;
    gap: 0.5rem;
    padding-inline: max(0.75rem, env(safe-area-inset-left)) max(0.75rem, env(safe-area-inset-right));
  }

  :global(.ag-heartbeat-toolbar .toolbar-inner > .ag-heartbeat-toolbar__action) {
    flex: 1 1 0 !important;
    inline-size: 0 !important;
    min-inline-size: 0 !important;
    padding-inline: 12px !important;
    justify-content: center;
  }

  :global(.ag-heartbeat-toolbar .toolbar-inner > .ag-heartbeat-toolbar__action--icon) {
    inline-size: 0 !important;
    min-inline-size: 0 !important;
    width: 0 !important;
  }

  :global(.ag-heartbeat-context-trigger) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.35rem;
    border: 0;
    background: transparent;
    color: inherit;
    min-inline-size: 0;
    padding: 0;
    font: 700 0.82rem/1 system-ui, sans-serif;
  }

  .ag-heartbeat-context-trigger__ring {
    display: inline-block;
    box-sizing: border-box;
    border-radius: 999px;
    inline-size: 0.82rem;
    block-size: 0.82rem;
    --ag-heartbeat-context-track: color-mix(in oklab, currentColor 14%, transparent);
    --ag-heartbeat-context-mid: color-mix(
      in oklch,
      #1f9d55 calc(100% - var(--ag-heartbeat-context-safe-mix, 0%)),
      #f59e0b var(--ag-heartbeat-context-safe-mix, 0%)
    );
    --ag-heartbeat-context-progress-color: color-mix(
      in oklch,
      var(--ag-heartbeat-context-mid) calc(100% - var(--ag-heartbeat-context-risk-mix, 0%)),
      #d93025 var(--ag-heartbeat-context-risk-mix, 0%)
    );
    background: conic-gradient(
      var(--ag-heartbeat-context-progress-color) calc(var(--ag-heartbeat-context-progress, 0) * 1turn),
      var(--ag-heartbeat-context-track) 0
    );
    -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 2px), #000 0);
    mask: radial-gradient(farthest-side, transparent calc(100% - 2px), #000 0);
  }

  :global(.ag-heartbeat-toolbar .link.disabled) {
    pointer-events: none;
    opacity: 0.48;
  }

  :global(.ag-heartbeat-modal-sheet__toolbar) {
    backdrop-filter: none !important;
    &::before, &::after{
        content: none!important;
    }
  }

  .ag-heartbeat-modal-sheet__title {
    min-inline-size: 0;
    overflow: hidden;
    padding-inline: 16px;
    text-overflow: ellipsis;
    white-space: nowrap;
    font: 700 0.95rem/1.2 system-ui, sans-serif;
  }

  :global(.ag-heartbeat-modal-sheet__content) {
    padding-block-end: max(12px, env(safe-area-inset-bottom));
  }

  :global(.ag-heartbeat-config-sheet__actions) {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.65rem;
  }

  :global(.ag-heartbeat-config-error) {
    color: #a11;
  }

</style>
