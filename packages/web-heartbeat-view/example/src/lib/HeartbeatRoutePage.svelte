<script lang="ts">
  import {
    HeartbeatPageSubnavbar,
    HeartbeatScrollFab,
    HeartbeatStatusbar,
    HeartbeatView,
    buildHeartbeatAttentionFocusSummary,
    buildHeartbeatContextState,
    buildHeartbeatStatusState,
    buildHeartbeatSubnavbarTitle,
    resolveHeartbeatConfiguredContextLimit,
    type HeartbeatViewCallbacks,
    type HeartbeatViewState,
  } from "@agenter/web-heartbeat-view";
  import RefreshIcon from "@lucide/svelte/icons/refresh-cw";
  import { onMount } from "svelte";
  import { Block, Link, Navbar, NavLeft, NavRight, NavTitle, Page, PageContent } from "../../../src/framework7-components";

  import HeartbeatAvatarMedia from "./heartbeat-avatar-media.svelte";
  import { useHeartbeatExampleState } from "./heartbeat-example-context";

  type Framework7RouteProps = {
    f7route?: {
      params?: {
        runtimeId?: string;
      };
    };
    f7router?: {
      navigate: (url: string, options?: { animate?: boolean }) => void;
    };
    runtimeId?: string;
  };

  let { runtimeId: runtimeIdProp, f7route, f7router }: Framework7RouteProps = $props();

  const state = useHeartbeatExampleState();
  const readRuntimeIdFromLocation = (): string | null => {
    const match = /^\/heartbeat\/([^/?#]+)/u.exec(window.location.pathname);
    return match ? decodeURIComponent(match[1]) : null;
  };
  const runtimeId = $derived(
    runtimeIdProp ?? f7route?.params?.runtimeId ?? readRuntimeIdFromLocation() ?? state.initialRuntimeId ?? "",
  );
  const avatarsHref = $derived(runtimeId ? state.buildHeartbeatListHref(runtimeId) : "/");
  const openRecordDetail = (recordId: number): void => {
    const href = state.buildHeartbeatRecordHref(runtimeId, recordId);
    if (f7router) {
      f7router.navigate(href);
      return;
    }
    window.location.assign(href);
  };

  const activeHeartbeat = $derived.by<HeartbeatViewState | null>(() => {
    const heartbeat = state.connectionState.selectedHeartbeat;
    const target = state.selectedTarget;
    return target?.runtimeId === runtimeId ? heartbeat : null;
  });
  const heartbeatCallbacks = $derived.by<HeartbeatViewCallbacks | null>(() => {
    if (!activeHeartbeat) {
      return null;
    }
    return {
      onLoadOlder: () => state.loadOlderSelectedHeartbeat(),
      onLoadRecordPage: (anchor) => state.loadSelectedHeartbeatRecordPage(anchor),
      onLoadRecordDetail: (recordId) => state.loadSelectedHeartbeatRecordDetail(recordId),
      onOpenRecordDetail: openRecordDetail,
      actions: {
        compact: {
          available: state.mode === "configable" && typeof state.connection?.requestCompact === "function",
          reason: state.mode === "readonly" ? "Readonly presentation mode" : null,
        },
        config: {
          available:
            state.mode === "configable" &&
            typeof state.connection?.saveConfig === "function" &&
            Boolean(activeHeartbeat.configBinding?.editableLayerId),
          reason:
            state.mode === "readonly"
              ? "Readonly presentation mode"
              : activeHeartbeat.configBinding?.editableLayerId
                ? null
                : "No editable config layer is available for this target",
        },
        onRequestCompact: () => state.compactSelectedHeartbeat(),
        onRefreshConfig: () => state.refreshSelectedHeartbeat(),
        onSaveConfig: (draft) => state.saveSelectedConfig(draft),
      },
      runtimeActions: {
        start: {
          available:
            state.mode === "configable" &&
            typeof state.connection?.startRuntime === "function" &&
            activeHeartbeat.sessionStatus !== "running" &&
            activeHeartbeat.sessionStatus !== "starting",
          reason: state.mode === "readonly" ? "Readonly presentation mode" : null,
        },
        stop: {
          available:
            state.mode === "configable" &&
            typeof state.connection?.stopRuntime === "function" &&
            (activeHeartbeat.sessionStatus === "running" || activeHeartbeat.sessionStatus === "starting"),
          reason: state.mode === "readonly" ? "Readonly presentation mode" : null,
        },
        onStartRuntime: () => state.startSelectedRuntime(),
        onStopRuntime: () => state.stopSelectedRuntime(),
      },
    };
  });
  const chromeState = $derived.by(() => {
    if (!activeHeartbeat) {
      return {
        statusTitle: "Loading Heartbeat target",
      };
    }
    const configuredContextLimit = resolveHeartbeatConfiguredContextLimit(activeHeartbeat.configBinding);
    const contextState = buildHeartbeatContextState(activeHeartbeat.modelCalls ?? [], configuredContextLimit);
    const attentionSummary = buildHeartbeatAttentionFocusSummary(activeHeartbeat.attention);
    const recordCount = activeHeartbeat.recordsState?.data?.totalRecords ?? activeHeartbeat.groupsState.data.length;
    const recordCountVisible = activeHeartbeat.recordsState?.loaded ?? activeHeartbeat.groupsState.loaded;
    const statusState = buildHeartbeatStatusState({
      sessionStatus: activeHeartbeat.sessionStatus,
      schedulerState: activeHeartbeat.schedulerState,
      heartbeatGroups: activeHeartbeat.groupsState,
    });
    return {
      contextState,
      statusTitle: buildHeartbeatSubnavbarTitle({
        statusState,
        contextState,
        attentionSummary,
        recordCount,
        recordCountVisible,
        livePushStatus: activeHeartbeat.livePushStatus,
      }),
    };
  });
  const scrollFabRefreshKey = $derived(
    activeHeartbeat
      ? `${activeHeartbeat.recordsState?.data?.records.length ?? activeHeartbeat.groupsState.data.length}:${
          activeHeartbeat.recordsState?.loaded ?? activeHeartbeat.groupsState.loaded
        }:${activeHeartbeat.recordsState?.refreshedAt ?? activeHeartbeat.groupsState.refreshedAt ?? ""}`
      : "pending",
  );

  onMount(() => {
    if (runtimeId) {
      void state.openRuntimeId(runtimeId);
    }
  });
</script>

<Page name="heartbeat" pageContent={false} withSubnavbar={true}>
  <Navbar>
    <NavLeft>
      <Link iconOnly iconF7="chevron_left_ios" href={avatarsHref} aria-label="Back to Avatars" />
    </NavLeft>
    <NavTitle>
      <span class="heartbeat-example-navbar-title">
        {#if state.selectedTarget}
          <HeartbeatAvatarMedia
            label={state.selectedTarget.displayName ?? state.selectedTarget.avatar}
            src={state.selectedTarget.iconUrl ?? null}
          />
          <span>{state.selectedTarget.displayName ?? state.selectedTarget.avatar} Heartbeat</span>
        {:else}
          <span>Heartbeat</span>
        {/if}
      </span>
    </NavTitle>
    <NavRight>
      <Link
        iconOnly
        aria-label="Refresh Heartbeat"
        tooltip="Refresh"
        class={activeHeartbeat ? "" : "disabled"}
        onClick={() => {
          if (activeHeartbeat) {
            void state.refreshSelectedHeartbeat();
          }
        }}
      >
        <RefreshIcon size={20} aria-hidden="true" />
      </Link>
    </NavRight>
    <HeartbeatPageSubnavbar
      title={chromeState.statusTitle}
      mode={state.mode}
      sessionStatus={activeHeartbeat?.sessionStatus ?? "stopped"}
      runtimeActions={heartbeatCallbacks?.runtimeActions}
      class="heartbeat-example-status-subnavbar"
    />
  </Navbar>

  {#if activeHeartbeat}
    <HeartbeatStatusbar
      mode={state.mode}
      compactPending={activeHeartbeat.compactPending}
      configBinding={activeHeartbeat.configBinding}
      configLoading={activeHeartbeat.configLoading}
      configSaving={activeHeartbeat.configSaving}
      configError={activeHeartbeat.configError}
      contextState={chromeState.contextState}
      actions={heartbeatCallbacks?.actions}
    />
  {/if}

  <PageContent class="heartbeat-example-heartbeat-content">
    {#if state.error}
      <Block strong>{state.error}</Block>
    {:else if activeHeartbeat}
      {#if state.loadedEmptyEvidence()}
        <Block strong class="heartbeat-example-db-evidence">{state.loadedEmptyEvidence()}</Block>
      {/if}
      <HeartbeatView
        state={activeHeartbeat}
        mode={state.mode}
        avatarLabel={state.selectedTarget?.displayName ?? state.selectedTarget?.avatar ?? "Avatar"}
        sessionIconUrl={state.selectedTarget?.iconUrl ?? null}
        callbacks={heartbeatCallbacks ?? {}}
        showToolbar={false}
        showSecondaryStatus={false}
      />
    {:else}
      <Block strong>Loading Heartbeat target...</Block>
    {/if}
  </PageContent>
  <HeartbeatScrollFab
    contentSelector=".page-current .heartbeat-example-heartbeat-content, .heartbeat-example-heartbeat-content"
    refreshKey={scrollFabRefreshKey}
  />
</Page>
