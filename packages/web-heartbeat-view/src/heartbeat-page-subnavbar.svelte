<script lang="ts">
  import LoaderCircle from "@lucide/svelte/icons/loader-circle";
  import Play from "@lucide/svelte/icons/play";
  import StopCircle from "@lucide/svelte/icons/stop-circle";

  import { Link, Subnavbar } from "./framework7-components";
  import type {
    HeartbeatCapabilityMode,
    HeartbeatRuntimeActionIntent,
    HeartbeatRuntimeActions,
    SessionStatus,
  } from "./types";

  let {
    title,
    mode = "readonly",
    sessionStatus = "stopped",
    runtimeActions = {},
    class: className = "",
  }: {
    title: string;
    mode?: HeartbeatCapabilityMode;
    sessionStatus?: SessionStatus;
    runtimeActions?: HeartbeatRuntimeActions;
    class?: string;
  } = $props();

  let pendingIntent = $state<HeartbeatRuntimeActionIntent | null>(null);

  const runtimeActionIntent = $derived<HeartbeatRuntimeActionIntent>(
    sessionStatus === "running" || sessionStatus === "starting" ? "stop" : "start",
  );
  const runtimeAction = $derived.by(() =>
    runtimeActionIntent === "start" ? runtimeActions.start : runtimeActions.stop,
  );
  const runtimeHandler = $derived.by(() =>
    runtimeActionIntent === "start" ? runtimeActions.onStartRuntime : runtimeActions.onStopRuntime,
  );
  const runtimeControlVisible = $derived(mode === "configable");
  const runtimeControlEnabled = $derived(
    runtimeControlVisible &&
      pendingIntent === null &&
      runtimeAction?.available === true &&
      typeof runtimeHandler === "function",
  );
  const runtimeControlLabel = $derived.by(() => {
    if (pendingIntent === "start") {
      return "Starting runtime";
    }
    if (pendingIntent === "stop") {
      return "Stopping runtime";
    }
    return runtimeActionIntent === "start" ? "Start runtime" : "Stop runtime";
  });
  const runtimeControlTitle = $derived.by(() => {
    if (runtimeControlEnabled || pendingIntent) {
      return runtimeControlLabel;
    }
    return runtimeAction?.reason ?? `${runtimeControlLabel} is unavailable for this target`;
  });

  const subnavbarClass = $derived(["ag-heartbeat-page-subnavbar", className].filter(Boolean).join(" "));
  const controlClass = (enabled: boolean): string =>
    enabled ? "ag-heartbeat-page-subnavbar__button" : "ag-heartbeat-page-subnavbar__button disabled";

  const runRuntimeAction = async (): Promise<void> => {
    if (!runtimeControlEnabled || !runtimeHandler) {
      return;
    }
    const intent = runtimeActionIntent;
    pendingIntent = intent;
    try {
      await runtimeHandler();
    } finally {
      pendingIntent = null;
    }
  };
</script>

<Subnavbar class={subnavbarClass}>
  <div class="ag-heartbeat-page-subnavbar__content">
    <div class="ag-heartbeat-page-subnavbar__title" title={title}>{title}</div>
    <div class="ag-heartbeat-page-subnavbar__controls" role="toolbar" aria-label="Heartbeat page controls">
      {#if runtimeControlVisible}
        <Link
          iconOnly
          class={controlClass(runtimeControlEnabled)}
          title={runtimeControlTitle}
          aria-label={runtimeControlTitle}
          aria-disabled={runtimeControlEnabled ? "false" : "true"}
          tabindex={runtimeControlEnabled ? 0 : -1}
          onClick={() => void runRuntimeAction()}
        >
          {#if pendingIntent === runtimeActionIntent}
            <span class="ag-heartbeat-page-subnavbar__spin" aria-hidden="true">
              <LoaderCircle size={15} />
            </span>
          {:else if runtimeActionIntent === "start"}
            <Play size={15} aria-hidden="true" />
          {:else}
            <StopCircle size={15} aria-hidden="true" />
          {/if}
        </Link>
      {/if}
    </div>
  </div>
</Subnavbar>

<style>
  :global(.ag-heartbeat-page-subnavbar) {
    --f7-subnavbar-height: 34px;
  }

  :global(.ag-heartbeat-page-subnavbar .subnavbar-inner) {
    box-sizing: border-box;
    padding-inline: max(8px, env(safe-area-inset-left)) max(8px, env(safe-area-inset-right));
  }

  .ag-heartbeat-page-subnavbar__content {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    inline-size: 100%;
    min-inline-size: 0;
    align-items: center;
    gap: 0.45rem;
  }

  .ag-heartbeat-page-subnavbar__title {
    min-inline-size: 0;
    overflow: hidden;
    color: color-mix(in srgb, currentColor, transparent 24%);
    text-overflow: ellipsis;
    white-space: nowrap;
    font: 600 11.5px/1.18 system-ui, sans-serif;
    /*font-size: 9px;
    font-weight: 600;
    white-space: normal;*/
  }

  .ag-heartbeat-page-subnavbar__controls {
    display: inline-flex;
    min-inline-size: 0;
    align-items: center;
    gap: 4px;
  }

  :global(.ag-heartbeat-page-subnavbar__button) {
    display: inline-grid!important;
    min-height: 22px!important;
    place-items: center;
    border: 1px solid color-mix(in srgb, currentColor, transparent 84%);
    border-radius: 999px;
    color: inherit;
  }

  :global(.ag-heartbeat-page-subnavbar__button.disabled) {
    pointer-events: none;
    opacity: 0.44;
  }

  .ag-heartbeat-page-subnavbar__spin {
    display: inline-grid;
    place-items: center;
    animation: ag-heartbeat-page-subnavbar-spin 1s linear infinite;
  }

  @keyframes ag-heartbeat-page-subnavbar-spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
