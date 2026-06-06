<script lang="ts">
  import HeartbeatExampleApp from "$lib/HeartbeatExampleApp.svelte";

  let { data } = $props();
</script>

<HeartbeatExampleApp
  initialMode={data.mode}
  initialRecordPageSize={data.pageSize}
  initialWsUrl={data.wsUrl}
  initialSilentConnect={data.silentConnect}
/>
