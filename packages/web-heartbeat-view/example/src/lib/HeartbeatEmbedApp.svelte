<script lang="ts">
  import { onDestroy } from "svelte";
  import { App, View } from "../../../src/framework7-components";

  import HeartbeatAvatarDirectoryPage from "./HeartbeatAvatarDirectoryPage.svelte";
  import HeartbeatConnectionSheet from "./HeartbeatConnectionSheet.svelte";
  import HeartbeatRecordDetailRoutePage from "./HeartbeatRecordDetailRoutePage.svelte";
  import HeartbeatRoutePage from "./HeartbeatRoutePage.svelte";
  import { ensureFramework7 } from "./framework7";
  import { setHeartbeatExampleState } from "./heartbeat-example-context";
  import { HeartbeatExampleState } from "./heartbeat-example-state.svelte";

  ensureFramework7();

  let {
    initialRuntimeId = null,
    initialRecordId = null,
    initialMode = null,
    initialRecordPageSize = null,
    initialWsUrl = null,
    initialSilentConnect = null,
  }: {
    initialRuntimeId?: string | null;
    initialRecordId?: string | number | null;
    initialMode?: string | null;
    initialRecordPageSize?: string | number | null;
    initialSilentConnect?: boolean | string | null;
    initialWsUrl?: string | null;
  } = $props();

  const createInitialState = (): HeartbeatExampleState =>
    new HeartbeatExampleState({
      initialMode,
      initialRecordId,
      initialRecordPageSize,
      initialRuntimeId,
      initialSilentConnect,
      initialWsUrl,
    });
  const state = createInitialState();
  setHeartbeatExampleState(state);

  const f7Params = {
    name: "web-heartbeat-view-embed",
    theme: "ios" as const,
    popup: { closeOnEscape: true },
    sheet: { closeOnEscape: true },
    popover: { closeOnEscape: true },
    actions: { closeOnEscape: true },
  };

  onDestroy(() => {
    state.destroy();
  });
</script>

<App {...f7Params}>
  <View main class="safe-areas" url="/">
    {#if initialRuntimeId && initialRecordId !== null && initialRecordId !== undefined}
      <HeartbeatRecordDetailRoutePage runtimeId={initialRuntimeId} recordId={initialRecordId} />
    {:else if initialRuntimeId}
      <HeartbeatRoutePage runtimeId={initialRuntimeId} />
    {:else}
      <HeartbeatAvatarDirectoryPage />
    {/if}
  </View>
  <HeartbeatConnectionSheet />
</App>
