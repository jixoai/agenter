<script lang="ts">
  import { Navbar, NavLeft, NavTitle, Page, PageContent } from "./framework7-components";
  import HeartbeatPageSubnavbar from "./heartbeat-page-subnavbar.svelte";
  import HeartbeatScrollFab from "./heartbeat-scroll-fab.svelte";
  import HeartbeatView from "./HeartbeatView.svelte";
  import HeartbeatStatusbar from "./heartbeat-statusbar.svelte";
  import {
    buildHeartbeatAttentionFocusSummary,
    buildHeartbeatContextState,
    buildHeartbeatStatusState,
    buildHeartbeatSubnavbarTitle,
    resolveHeartbeatConfiguredContextLimit,
  } from "./heartbeat-statusbar-state";
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

  const chromeState = $derived.by(() => {
    const configuredContextLimit = resolveHeartbeatConfiguredContextLimit(viewState.configBinding);
    const contextState = buildHeartbeatContextState(viewState.modelCalls ?? [], configuredContextLimit);
    const attentionSummary = buildHeartbeatAttentionFocusSummary(viewState.attention);
    const recordCount = viewState.recordsState?.data?.totalRecords ?? viewState.groupsState.data.length;
    const recordCountVisible = viewState.recordsState?.loaded ?? viewState.groupsState.loaded;
    const statusState = buildHeartbeatStatusState({
      sessionStatus: viewState.sessionStatus,
      schedulerState: viewState.schedulerState,
      heartbeatGroups: viewState.groupsState,
    });
    return {
      contextState,
      statusTitle: buildHeartbeatSubnavbarTitle({
        statusState,
        contextState,
        attentionSummary,
        recordCount,
        recordCountVisible,
        livePushStatus: viewState.livePushStatus,
      }),
    };
  });
  const scrollFabRefreshKey = $derived(
    `${viewState.recordsState?.data?.records.length ?? viewState.groupsState.data.length}:${viewState.recordsState?.loaded ?? viewState.groupsState.loaded}:${viewState.recordsState?.refreshedAt ?? viewState.groupsState.refreshedAt ?? ""}`,
  );
</script>

<Page name="heartbeat" pageContent={false} withSubnavbar={true}>
  <Navbar>
    <NavLeft backLink={true} backLinkShowText={false} />
    <NavTitle>{avatarLabel} Heartbeat</NavTitle>
    <HeartbeatPageSubnavbar
      title={chromeState.statusTitle}
      {mode}
      sessionStatus={viewState.sessionStatus}
      runtimeActions={callbacks.runtimeActions}
      class="ag-heartbeat-page__status-subnavbar"
    />
  </Navbar>
  <HeartbeatStatusbar
    {mode}
    compactPending={viewState.compactPending}
    configBinding={viewState.configBinding}
    configLoading={viewState.configLoading}
    configSaving={viewState.configSaving}
    configError={viewState.configError}
    contextState={chromeState.contextState}
    actions={callbacks.actions}
  />
  <PageContent class="ag-heartbeat-page__body">
    <HeartbeatView
      state={viewState}
      {mode}
      {avatarLabel}
      {sessionIconUrl}
      {callbacks}
      showToolbar={false}
      showSecondaryStatus={false}
    />
  </PageContent>
  <HeartbeatScrollFab
    contentSelector=".page-current .ag-heartbeat-page__body, .ag-heartbeat-page__body"
    refreshKey={scrollFabRefreshKey}
  />
</Page>

<style>
  :global(.ag-heartbeat-page__body) {
    box-sizing: border-box;
    overflow-x: clip;
  }

  :global(.ag-heartbeat-page__body .ag-heartbeat-view) {
    min-block-size: 100%;
  }

  :global(.ag-heartbeat-page__status-subnavbar) {
    --f7-subnavbar-height: 34px;
  }
</style>
