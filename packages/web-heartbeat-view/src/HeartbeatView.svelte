<script lang="ts">
  import HeartbeatGroup from "./heartbeat-group.svelte";
  import HeartbeatStatusbar from "./heartbeat-statusbar.svelte";
  import {
    buildHeartbeatAttentionFocusSummary,
    buildHeartbeatContextState,
    buildHeartbeatStatusState,
  } from "./heartbeat-statusbar-state";
  import { buildHeartbeatDisplayGroups } from "./heartbeat-parts";
  import type { HeartbeatCapabilityMode, HeartbeatViewCallbacks, HeartbeatViewState } from "./types";

  let {
    state: viewState,
    mode = "readonly",
    avatarLabel = "Avatar",
    sessionIconUrl = null,
    callbacks = {},
  }: {
    state: HeartbeatViewState;
    mode?: HeartbeatCapabilityMode;
    avatarLabel?: string;
    sessionIconUrl?: string | null;
    callbacks?: HeartbeatViewCallbacks;
  } = $props();

  let loadingOlder = $state(false);
  let hasMoreOlder = $state(true);

  // Grouped Heartbeat pages are the truth boundary; the view only projects them.
  const groups = $derived(buildHeartbeatDisplayGroups(viewState.groupsState.data));
  const configuredContextLimit = $derived(
    viewState.configBinding?.draft.maxToken ?? viewState.configBinding?.providerMetadata?.maxContextTokens ?? null,
  );
  const contextState = $derived(buildHeartbeatContextState(viewState.modelCalls ?? [], configuredContextLimit));
  const attentionSummary = $derived(buildHeartbeatAttentionFocusSummary(viewState.attention));
  const statusState = $derived(
    buildHeartbeatStatusState({
      sessionStatus: viewState.sessionStatus,
      schedulerState: viewState.schedulerState,
      heartbeatGroups: viewState.groupsState,
    }),
  );
  const secondaryStatus = $derived.by(() => {
    if (viewState.groupsState.refreshing) {
      return "Refreshing persisted Heartbeat";
    }
    if (viewState.groupsState.loaded && viewState.groupsState.error) {
      return viewState.groupsState.error;
    }
    if (viewState.livePushStatus === "inactive") {
      return "No live push is active";
    }
    return null;
  });
  const emptyState = $derived.by(() => {
    if (viewState.groupsState.error && !viewState.groupsState.loaded) {
      return {
        title: "Heartbeat failed to load",
        description: viewState.groupsState.error,
      };
    }
    if (!viewState.groupsState.loaded) {
      return {
        title: "Loading Heartbeat",
        description: "Replaying persisted prompt facts, attention inputs, and assistant output.",
      };
    }
    return {
      title: "No Heartbeat rows yet",
      description: "This Avatar is still a valid Heartbeat target. Persisted rows will appear when the runtime records them.",
    };
  });

  const loadOlder = async (): Promise<void> => {
    if (loadingOlder || !hasMoreOlder || !callbacks.onLoadOlder) {
      return;
    }
    loadingOlder = true;
    try {
      const result = await callbacks.onLoadOlder();
      hasMoreOlder = result.hasMore;
    } finally {
      loadingOlder = false;
    }
  };
</script>

<section class="ag-heartbeat-view" data-testid="heartbeat-view" data-mode={mode}>
  {#if secondaryStatus}
    <div class="ag-heartbeat-secondary-status" data-testid="heartbeat-secondary-status">{secondaryStatus}</div>
  {/if}

  <div class="ag-heartbeat-stream" data-testid="heartbeat-stream">
    {#if groups.length > 0}
      {#if callbacks.onLoadOlder && hasMoreOlder}
        <button
          type="button"
          class="ag-heartbeat-load-older"
          disabled={loadingOlder}
          onclick={() => void loadOlder()}
          data-testid="heartbeat-load-older"
        >
          {loadingOlder ? "Loading older" : "Load older"}
        </button>
      {/if}
      {#each groups as group (group.groupId)}
        <HeartbeatGroup {group} {avatarLabel} {sessionIconUrl} />
      {/each}
    {:else}
      <div class="ag-heartbeat-empty" data-testid="heartbeat-empty">
        <strong>{emptyState.title}</strong>
        <p>{emptyState.description}</p>
      </div>
    {/if}
  </div>

  <HeartbeatStatusbar
    {mode}
    {statusState}
    {contextState}
    {attentionSummary}
    groupCount={groups.length}
    groupCountVisible={viewState.groupsState.loaded}
    compactPending={viewState.compactPending}
    configBinding={viewState.configBinding}
    configLoading={viewState.configLoading}
    configSaving={viewState.configSaving}
    configError={viewState.configError}
    actions={callbacks.actions}
  />
</section>

<style>
  .ag-heartbeat-view {
    position: relative;
    display: grid;
    grid-template-rows: minmax(0, 1fr) auto;
    min-width: 0;
    block-size: 100%;
    background: linear-gradient(
      180deg,
      color-mix(in srgb, Canvas, currentColor 3%) 0%,
      Canvas 38%,
      color-mix(in srgb, Canvas, currentColor 2%) 100%
    );
    color: CanvasText;
  }

  .ag-heartbeat-stream {
    display: grid;
    align-content: end;
    gap: 0.85rem;
    min-width: 0;
    overflow: auto;
    padding: 0.85rem;
    scrollbar-width: thin;
  }

  .ag-heartbeat-secondary-status {
    position: absolute;
    z-index: 2;
    inset-block-start: 0.7rem;
    inset-inline: 0.75rem;
    justify-self: center;
    border: 1px solid color-mix(in srgb, currentColor, transparent 84%);
    border-radius: 999px;
    background: color-mix(in srgb, Canvas, transparent 9%);
    padding: 0.25rem 0.7rem;
    color: color-mix(in srgb, currentColor, transparent 34%);
    font: 0.74rem/1.25 system-ui, sans-serif;
  }

  .ag-heartbeat-empty {
    align-self: center;
    justify-self: center;
    display: grid;
    max-inline-size: 28rem;
    gap: 0.35rem;
    padding: 2rem 1rem;
    text-align: center;
  }

  .ag-heartbeat-empty strong {
    font: 700 1rem/1.2 system-ui, sans-serif;
  }

  .ag-heartbeat-empty p {
    margin: 0;
    color: color-mix(in srgb, currentColor, transparent 34%);
    font: 0.84rem/1.45 system-ui, sans-serif;
  }

  .ag-heartbeat-load-older {
    justify-self: center;
    border: 1px solid color-mix(in srgb, currentColor, transparent 84%);
    border-radius: 999px;
    background: color-mix(in srgb, Canvas, currentColor 3%);
    color: inherit;
    padding: 0.42rem 0.8rem;
    font: 600 0.78rem/1.1 system-ui, sans-serif;
  }
</style>
