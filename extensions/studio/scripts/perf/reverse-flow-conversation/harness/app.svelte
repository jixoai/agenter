<script lang="ts">
  import HeartbeatPerfHarness from "./heartbeat-perf-harness.svelte";
  import RoomChatPerfHarness from "./room-chat-perf-harness.svelte";

  import type { HeartbeatPerfScenarioId } from "./heartbeat-fixtures";
  import type { RoomChatPerfScenarioId } from "./web-chat-fixtures";

  let { scenarioId }: { scenarioId: string } = $props();

  const heartbeatScenarioIds = new Set<HeartbeatPerfScenarioId>([
    "heartbeat-append",
    "heartbeat-growth",
    "heartbeat-initial",
    "heartbeat-load-older",
  ]);

  const roomChatScenarioIds = new Set<RoomChatPerfScenarioId>([
    "room-chat-append-away",
    "room-chat-append-pinned",
    "room-chat-initial",
    "room-chat-load-older",
  ]);
</script>

<svelte:head>
  <title>{scenarioId}</title>
</svelte:head>

<main class="min-h-screen bg-background p-6 text-foreground" data-testid="perf-root">
  {#if heartbeatScenarioIds.has(scenarioId as HeartbeatPerfScenarioId)}
    <HeartbeatPerfHarness scenarioId={scenarioId as HeartbeatPerfScenarioId} />
  {:else if roomChatScenarioIds.has(scenarioId as RoomChatPerfScenarioId)}
    <RoomChatPerfHarness scenarioId={scenarioId as RoomChatPerfScenarioId} />
  {:else}
    <div class="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
      Unknown reverse-flow scenario: {scenarioId}
    </div>
  {/if}
</main>
