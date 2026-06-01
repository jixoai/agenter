<script lang="ts">
  import HeartbeatExampleApp from "$lib/HeartbeatExampleApp.svelte";

  let { data } = $props();
</script>

<HeartbeatExampleApp initialMode={data.mode} initialWsUrl={data.wsUrl} />
