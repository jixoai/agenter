<script lang="ts">
  import Shredder from "@lucide/svelte/icons/shredder";
  import { app } from "framework7-svelte";

  import { BlockTitle, Link, List, ListButton, ListItem, PageContent, Progressbar, Sheet, Toolbar } from "./framework7-components";
  import {
    buildHeartbeatModelConfigSummary,
    formatHeartbeatContextPercentLabel,
    formatHeartbeatContextUsedLimitLabel,
    formatHeartbeatTokenCount,
    type HeartbeatContextState,
  } from "./heartbeat-statusbar-state";
  import type { HeartbeatCapabilityAction, HeartbeatConfigBinding } from "./types";

  type Framework7DialogApp = {
    dialog?: {
      confirm: (text: string, title: string, callback: () => void) => void;
    };
  };

  let {
    opened,
    contextState,
    configBinding = null,
    compactPending = false,
    compactAction,
    onRequestCompact,
    onClose,
  }: {
    opened: boolean;
    contextState: HeartbeatContextState;
    configBinding?: HeartbeatConfigBinding | null;
    compactPending?: boolean;
    compactAction?: HeartbeatCapabilityAction;
    onRequestCompact?: () => void | Promise<void>;
    onClose?: () => void;
  } = $props();

  const percentLabel = $derived(formatHeartbeatContextPercentLabel(contextState));
  const usedLimitLabel = $derived(formatHeartbeatContextUsedLimitLabel(contextState));
  const progressPercent = $derived(
    contextState.kind === "available" && contextState.progress !== null ? Math.max(0, Math.min(100, contextState.progress * 100)) : 0,
  );
  const progressRatio = $derived(progressPercent / 100);
  const safeMixPercent = $derived(`${Math.min(progressRatio * 2, 1) * 100}%`);
  const riskMixPercent = $derived(`${Math.max(0, Math.min((progressRatio - 0.5) * 2, 1)) * 100}%`);
  const progressStyle = $derived(
    [
      `--ag-heartbeat-context-progress:${progressRatio}`,
      `--ag-heartbeat-context-safe-mix:${safeMixPercent}`,
      `--ag-heartbeat-context-risk-mix:${riskMixPercent}`,
    ].join(";"),
  );
  const inputTokenLabel = $derived(
    contextState.kind === "available" ? formatHeartbeatTokenCount(contextState.inputTokens) : "--",
  );
  const outputTokenLabel = $derived(
    contextState.kind === "available" ? formatHeartbeatTokenCount(contextState.outputTokens) : "--",
  );
  const remainingTokenLabel = $derived(
    contextState.kind === "available" && contextState.remainingTokens !== null
      ? formatHeartbeatTokenCount(contextState.remainingTokens)
      : "--",
  );
  const modelSummary = $derived(buildHeartbeatModelConfigSummary(configBinding, contextState));
  const compactEnabled = $derived(compactAction?.available === true && typeof onRequestCompact === "function");
  const compactInteractive = $derived(compactEnabled && !compactPending);
  const compactTitle = $derived.by(() => {
    if (compactPending) {
      return "Compacting";
    }
    if (compactInteractive) {
      return "Request compact";
    }
    return compactAction?.reason ?? "Compact action is unavailable for this target";
  });

  const requestCompact = (): void => {
    if (!compactInteractive) {
      return;
    }
    const runCompact = (): void => {
      void onRequestCompact?.();
    };
    const framework7App = app.f7 as unknown as Framework7DialogApp | undefined;
    if (framework7App?.dialog?.confirm) {
      framework7App.dialog.confirm(
        "Request a manual compact for this Avatar runtime?",
        "Compact Heartbeat",
        runCompact,
      );
      return;
    }
    if (typeof window !== "undefined" && window.confirm("Request a manual compact for this Avatar runtime?")) {
      runCompact();
    }
  };
</script>

{#snippet compactButtonTitle()}
  <span class="ag-heartbeat-context-compact__label">
    <span class={compactPending ? "ag-heartbeat-context-compact__icon ag-heartbeat-context-spin" : "ag-heartbeat-context-compact__icon"}>
      <Shredder size={18} aria-hidden="true" />
    </span>
    <span>Request compact</span>
  </span>
{/snippet}

<Sheet
  class="ag-heartbeat-modal-sheet ag-heartbeat-context-sheet"
  data-testid="heartbeat-context-usage-sheet"
  {opened}
  backdrop
  push
  style="height: auto; max-height: min(92vh, 560px)"
  onSheetClosed={() => onClose?.()}
>
  <Toolbar class="ag-heartbeat-modal-sheet__toolbar ag-heartbeat-context-sheet__toolbar">
    <div class="left">
      <span class="ag-heartbeat-modal-sheet__title ag-heartbeat-context-sheet__title">Context usage</span>
    </div>
    <div class="right">
      <Link sheetClose iconOnly iconF7="xmark" aria-label="Close context usage" tooltip="Close" />
    </div>
  </Toolbar>

  <PageContent class="ag-heartbeat-modal-sheet__content ag-heartbeat-context-sheet__content">
    <BlockTitle>Context window</BlockTitle>
    <List strongIos insetIos dividersIos class="ag-heartbeat-context-summary-list">
      <ListItem mediaList title="Context usage" after={percentLabel} text={usedLimitLabel}>
        {#snippet innerEnd()}
          <Progressbar
            class="ag-heartbeat-context-progressbar"
            progress={progressPercent}
            style={progressStyle}
            aria-label={`Context usage ${percentLabel}`}
          />
        {/snippet}
      </ListItem>
      <ListItem title="Input" after={inputTokenLabel} />
      <ListItem title="Output" after={outputTokenLabel} />
      <ListItem title="Remaining" after={remainingTokenLabel} />
    </List>

    <BlockTitle>Runtime and model</BlockTitle>
    <List strongIos insetIos dividersIos class="ag-heartbeat-context-model-list">
      <ListButton
        title={compactButtonTitle}
        class={compactInteractive ? "ag-heartbeat-context-compact" : "ag-heartbeat-context-compact disabled"}
        text={compactPending ? "Compacting" : undefined}
        aria-label={compactTitle}
        onClick={requestCompact}
      />
      <ListItem mediaList title={modelSummary.modelLabel} text={modelSummary.configLabel} />
    </List>
  </PageContent>
</Sheet>

<style>
  :global(.ag-heartbeat-modal-sheet__toolbar) {
    backdrop-filter: none !important;
    &::before, &::after {
      content: none !important;
    }
  }

  :global(.ag-heartbeat-modal-sheet__title) {
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

  :global(.ag-heartbeat-context-progressbar) {
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
    margin-block-start: 0.45rem;
    background: var(--ag-heartbeat-context-track);
  }

  :global(.ag-heartbeat-context-progressbar span) {
    background: var(--ag-heartbeat-context-progress-color);
  }

  :global(.ag-heartbeat-context-compact .list-button) {
    justify-content: center;
  }

  :global(.ag-heartbeat-context-compact.disabled) {
    opacity: 0.48;
  }

  .ag-heartbeat-context-compact__label {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.45rem;
  }

  .ag-heartbeat-context-compact__icon {
    display: inline-grid;
    color: var(--f7-theme-color);
    place-items: center;
  }

  .ag-heartbeat-context-spin {
    animation: ag-heartbeat-context-spin 1s linear infinite;
  }

  @keyframes ag-heartbeat-context-spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
