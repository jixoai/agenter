<script lang="ts">
  import HeartbeatExampleApp from "$lib/HeartbeatExampleApp.svelte";

  let { data } = $props();
</script>

<HeartbeatExampleApp
  initialRuntimeId={data.runtimeId}
  initialRecordId={data.recordId}
  initialMode={data.mode}
  initialRecordPageSize={data.pageSize}
  initialWsUrl={data.wsUrl}
  initialSilentConnect={data.silentConnect}
/>
