<script lang="ts">
  import HeartbeatView from "../../src/HeartbeatView.svelte";
  import type { HeartbeatGroupItem, HeartbeatViewState } from "../../src";

  let {
    initialState,
  }: {
    initialState: HeartbeatViewState;
  } = $props();

  let overriddenState = $state<HeartbeatViewState | null>(null);
  const viewState = $derived(overriddenState ?? initialState);

  export const warmRefresh = (): void => {
    overriddenState = {
      ...viewState,
      groupsState: {
        ...viewState.groupsState,
        refreshing: true,
      },
    };
  };

  export const appendGroup = (group: HeartbeatGroupItem): void => {
    overriddenState = {
      ...viewState,
      groupsState: {
        ...viewState.groupsState,
        refreshing: false,
        data: [...viewState.groupsState.data, group],
      },
    };
  };

  export const prependGroup = (group: HeartbeatGroupItem): void => {
    overriddenState = {
      ...viewState,
      groupsState: {
        ...viewState.groupsState,
        refreshing: false,
        data: [group, ...viewState.groupsState.data],
      },
    };
  };

  const loadOlder = async (): Promise<{ items: number; hasMore: boolean }> => {
    await new Promise<void>((resolve) => {
      window.setTimeout(resolve, 30);
    });
    return { items: 0, hasMore: false };
  };
</script>

<HeartbeatView state={viewState} mode="readonly" callbacks={{ onLoadOlder: loadOlder }} />
