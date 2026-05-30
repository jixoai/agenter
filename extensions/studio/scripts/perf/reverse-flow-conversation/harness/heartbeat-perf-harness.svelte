<script lang="ts">
  import type { CachedResourceState, HeartbeatGroupItem, RuntimeSchedulerState } from "@agenter/client-sdk";

  import RuntimeStageHeartbeat from "@perf-target-studio-runtime/runtime-stage-heartbeat.svelte";
  import { createEmptyRuntimeHeartbeatConfigBinding } from "@perf-target-studio-runtime/runtime-heartbeat-config-state";

  import { getHeartbeatPerfScenario, type HeartbeatPerfScenarioId } from "./heartbeat-fixtures";
  import { scrollViewportToHistoryStart, waitForAnimationFrames } from "./viewport-helpers";

  declare global {
    interface Window {
      __reverseFlowPerf?: {
        appendHeartbeatLatestGroup?: () => void;
        appendRoomBatch?: () => void;
        growHeartbeatLatestGroup?: () => void;
        loadHeartbeatOlder?: () => Promise<void>;
      };
    }
  }

  let { scenarioId }: { scenarioId: HeartbeatPerfScenarioId } = $props();

  const scenario = $derived(getHeartbeatPerfScenario(scenarioId));
  const cloneGroup = (group: HeartbeatGroupItem): HeartbeatGroupItem => structuredClone(group);
  const configBinding = createEmptyRuntimeHeartbeatConfigBinding();
  const schedulerState: RuntimeSchedulerState | null = null;

  let groups = $state<HeartbeatGroupItem[]>([]);
  let olderLoaded = $state(false);
  let appendSeq = $state(0);
  let growthSeq = $state(0);

  const groupsState = $derived(
    ({
      data: groups,
      error: null,
      loaded: true,
      loading: false,
      refreshedAt: Date.now(),
      refreshing: false,
    }) satisfies CachedResourceState<HeartbeatGroupItem[]>,
  );

  $effect(() => {
    groups = scenario.initialGroups.map(cloneGroup);
    olderLoaded = false;
    appendSeq = 0;
    growthSeq = 0;
  });

  const appendHeartbeatLatestGroup = (): void => {
    groups = [...groups, cloneGroup(scenario.appendedGroup)];
    appendSeq += 1;
  };

  const growHeartbeatLatestGroup = (): void => {
    groups = [...groups.slice(0, -1), cloneGroup(scenario.grownGroup)];
    growthSeq += 1;
  };

  const getHeartbeatViewport = (): HTMLElement | null => {
    const viewport = document.querySelector('[data-testid="runtime-heartbeat-viewport"]');
    return viewport instanceof HTMLElement ? viewport : null;
  };

  const handleLoadOlder = async (): Promise<{ hasMore: boolean; items: number }> => {
    if (olderLoaded) {
      return { items: 0, hasMore: false };
    }
    groups = [...scenario.olderGroups.map(cloneGroup), ...groups];
    olderLoaded = true;
    return { items: scenario.olderGroups.length, hasMore: false };
  };

  const loadHeartbeatOlder = async (): Promise<void> => {
    const viewport = getHeartbeatViewport();
    if (viewport) {
      await scrollViewportToHistoryStart(viewport);
    }
    await handleLoadOlder();
    if (viewport) {
      await waitForAnimationFrames();
      await scrollViewportToHistoryStart(viewport);
    }
  };

  $effect(() => {
    window.__reverseFlowPerf = {
      appendHeartbeatLatestGroup,
      growHeartbeatLatestGroup,
      loadHeartbeatOlder,
    };
    return () => {
      delete window.__reverseFlowPerf;
    };
  });
</script>

<div class="grid h-[48rem] min-h-0 rounded-[1.35rem] border border-border/70 bg-background p-4" data-testid="perf-heartbeat">
  <div class="sr-only" data-testid="perf-heartbeat-group-count">{groups.length}</div>
  <div class="sr-only" data-testid="perf-heartbeat-older-loaded">{olderLoaded ? "yes" : "no"}</div>
  <div class="sr-only" data-testid="perf-heartbeat-append-seq">{appendSeq}</div>
  <div class="sr-only" data-testid="perf-heartbeat-growth-seq">{growthSeq}</div>
  <RuntimeStageHeartbeat
    avatarLabel="Perf Avatar"
    compactDisabled={false}
    compactPending={false}
    configBinding={configBinding}
    groupsState={groupsState}
    modelCalls={[]}
    onLoadOlder={handleLoadOlder}
    onRefreshConfig={() => {}}
    onRequestCompact={() => {}}
    onSaveConfig={() => true}
    providerMetadata={null}
    schedulerState={schedulerState}
    sessionIconUrl={null}
    sessionStatus={scenario.sessionStatus}
  />
</div>
