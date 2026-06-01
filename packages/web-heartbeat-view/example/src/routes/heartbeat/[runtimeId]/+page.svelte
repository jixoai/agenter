<script lang="ts">
  import HeartbeatExampleApp from "$lib/HeartbeatExampleApp.svelte";

  let { data } = $props();
</script>

<HeartbeatExampleApp initialRuntimeId={data.runtimeId} initialMode={data.mode} initialWsUrl={data.wsUrl} />
