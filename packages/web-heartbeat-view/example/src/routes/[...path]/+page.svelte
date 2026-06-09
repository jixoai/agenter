<script lang="ts">
  import HeartbeatEmbedApp from "$lib/HeartbeatEmbedApp.svelte";
  import HeartbeatExampleApp from "$lib/HeartbeatExampleApp.svelte";

  let { data } = $props();
</script>

{#if data.embed}
  <HeartbeatEmbedApp
    initialRuntimeId={data.runtimeId}
    initialRecordId={data.recordId}
    initialMode={data.mode}
    initialRecordPageSize={data.pageSize}
    initialWsUrl={data.wsUrl}
    initialSilentConnect={data.silentConnect}
  />
{:else}
  <HeartbeatExampleApp
    initialMode={data.mode}
    initialRecordPageSize={data.pageSize}
    initialWsUrl={data.wsUrl}
    initialSilentConnect={data.silentConnect}
  />
{/if}
