<script lang="ts">
  import HeartbeatGroup from "./heartbeat-group.svelte";
  import HeartbeatRecordCard from "./heartbeat-record-card.svelte";
  import HeartbeatRecordDetail from "./heartbeat-record-detail.svelte";
  import HeartbeatStatusbar from "./heartbeat-statusbar.svelte";
  import { buildHeartbeatDisplayGroups } from "./heartbeat-parts";
  import type { HeartbeatCapabilityMode, HeartbeatRecordPageAnchor, HeartbeatViewCallbacks, HeartbeatViewState } from "./types";

  let {
    state: viewState,
    mode = "readonly",
    avatarLabel = "Avatar",
    sessionIconUrl = null,
    callbacks = {},
    showToolbar = true,
    showSecondaryStatus = true,
  }: {
    state: HeartbeatViewState;
    mode?: HeartbeatCapabilityMode;
    avatarLabel?: string;
    sessionIconUrl?: string | null;
    callbacks?: HeartbeatViewCallbacks;
    showToolbar?: boolean;
    showSecondaryStatus?: boolean;
  } = $props();

  let loadingOlder = $state(false);
  let hasMoreOlder = $state(true);
  let loadingRecordPage = $state(false);
  let selectedRecordId = $state<number | null>(null);

  const recordsResource = $derived(viewState.recordsState ?? null);
  const recordsPage = $derived(recordsResource?.data ?? null);
  const records = $derived(recordsPage?.records ?? []);
  const displayRecords = $derived([...records].reverse());
  const hasRecordResource = $derived(Boolean(recordsResource));
  const groups = $derived(buildHeartbeatDisplayGroups(viewState.groupsState.data));
  const selectedRecord = $derived(callbacks.onOpenRecordDetail ? null : records.find((record) => record.id === selectedRecordId) ?? null);
  const selectedRecordDetail = $derived(
    selectedRecordId === null ? undefined : viewState.recordDetailsState?.[selectedRecordId],
  );
  const secondaryStatus = $derived.by(() => {
    if (!showSecondaryStatus) {
      return null;
    }
    if (recordsResource?.refreshing) {
      return "Refreshing Heartbeat records";
    }
    if (recordsResource?.loaded && recordsResource.error) {
      return recordsResource.error;
    }
    if (recordsPage?.newRecordsAvailable) {
      return "New Heartbeat records available";
    }
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
    if (hasRecordResource) {
      if (recordsResource?.error && !recordsResource.loaded) {
        return {
          title: "Heartbeat failed to load",
          description: recordsResource.error,
        };
      }
      if (!recordsResource?.loaded) {
        return {
          title: "Loading Heartbeat",
          description: "Loading paged Heartbeat records.",
        };
      }
      return {
        title: "No Heartbeat records yet",
        description: "This Avatar is still a valid Heartbeat target. Records will appear when runtime facts are persisted.",
      };
    }
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

  const loadRecordPage = async (anchor: HeartbeatRecordPageAnchor): Promise<void> => {
    if (loadingRecordPage || !callbacks.onLoadRecordPage) {
      return;
    }
    loadingRecordPage = true;
    try {
      await callbacks.onLoadRecordPage(anchor);
    } finally {
      loadingRecordPage = false;
    }
  };

  const selectRecord = async (recordId: number): Promise<void> => {
    // Detail navigation is host-owned; the package emits intent and only falls back to inline detail without a route adapter.
    if (callbacks.onOpenRecordDetail) {
      await callbacks.onOpenRecordDetail(recordId);
      return;
    }
    selectedRecordId = selectedRecordId === recordId ? null : recordId;
    if (selectedRecordId !== null) {
      await callbacks.onLoadRecordDetail?.(selectedRecordId);
    }
  };
</script>

<section class="ag-heartbeat-view" data-testid="heartbeat-view" data-mode={mode}>
  {#if secondaryStatus}
    <div class="ag-heartbeat-secondary-status" data-testid="heartbeat-secondary-status">{secondaryStatus}</div>
  {/if}

  <div class="ag-heartbeat-stream" data-testid="heartbeat-stream">
    {#if hasRecordResource}
      {#if recordsPage && callbacks.onLoadRecordPage}
        <div class="ag-heartbeat-record-pager" data-testid="heartbeat-record-pager">
          <button
            type="button"
            disabled={loadingRecordPage || !recordsPage.hasOlder}
            onclick={() =>
              void loadRecordPage({
                kind: "fixed",
                pageIndex: Math.max(0, recordsPage.pageIndex - recordsPage.pageCount),
                latestRecordId: recordsPage.latestRecordId,
              })}
          >
            Older
          </button>
          <span>{recordsPage.totalRecords} records</span>
          <button
            type="button"
            disabled={loadingRecordPage || (!recordsPage.hasNewer && !recordsPage.newRecordsAvailable)}
            onclick={() => void loadRecordPage({ kind: "latest" })}
          >
            Latest
          </button>
        </div>
      {/if}
      {#if records.length > 0}
        <div class="ag-heartbeat-record-list" data-testid="heartbeat-record-list">
          {#each displayRecords as record (record.id)}
            {@const recordHref = callbacks.recordDetailHref?.(record.id)}
            <HeartbeatRecordCard
              {record}
              selected={record.id === selectedRecordId}
              href={recordHref}
              selectRecord={callbacks.onOpenRecordDetail || !recordHref ? (recordId) => void selectRecord(recordId) : undefined}
            />
          {/each}
        </div>
        {#if selectedRecord}
          <HeartbeatRecordDetail record={selectedRecord} detailState={selectedRecordDetail} />
        {/if}
      {:else}
        <div class="ag-heartbeat-empty" data-testid="heartbeat-empty">
          <strong>{emptyState.title}</strong>
          <p>{emptyState.description}</p>
        </div>
      {/if}
    {:else if groups.length > 0}
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

  {#if showToolbar}
    <HeartbeatStatusbar
      {mode}
      compactPending={viewState.compactPending}
      configBinding={viewState.configBinding}
      configLoading={viewState.configLoading}
      configSaving={viewState.configSaving}
      configError={viewState.configError}
      modelCalls={viewState.modelCalls ?? []}
      actions={callbacks.actions}
    />
  {/if}
</section>

<style>
  .ag-heartbeat-view {
    position: relative;
    display: block;
    box-sizing: border-box;
    inline-size: 100%;
    max-inline-size: 100%;
    min-width: 0;
    min-block-size: 100%;
    overflow-x: clip;
    color: CanvasText;
  }

  .ag-heartbeat-stream {
    display: grid;
    box-sizing: border-box;
    grid-template-columns: minmax(0, 1fr);
    align-content: start;
    inline-size: 100%;
    max-inline-size: 100%;
    gap: 0.85rem;
    min-width: 0;
    overflow-x: clip;
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

  .ag-heartbeat-record-list,
  .ag-heartbeat-record-pager {
    display: grid;
    box-sizing: border-box;
    grid-template-columns: minmax(0, 1fr);
    inline-size: 100%;
    max-inline-size: 100%;
    min-width: 0;
    gap: 0.65rem;
  }

  .ag-heartbeat-record-pager {
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    border: 1px solid color-mix(in srgb, currentColor, transparent 88%);
    border-radius: 12px;
    padding: 0.45rem;
    color: color-mix(in srgb, currentColor, transparent 34%);
    font: 0.76rem/1.2 system-ui, sans-serif;
  }

  .ag-heartbeat-record-pager span {
    overflow: hidden;
    text-align: center;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .ag-heartbeat-record-pager button {
    border: 1px solid color-mix(in srgb, currentColor, transparent 84%);
    border-radius: 999px;
    background: transparent;
    color: inherit;
    padding: 0.28rem 0.6rem;
    font: 600 0.72rem/1.1 system-ui, sans-serif;
  }

  .ag-heartbeat-record-pager button:disabled {
    opacity: 0.45;
  }
</style>
