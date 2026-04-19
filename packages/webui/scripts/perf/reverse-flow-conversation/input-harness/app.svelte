<script lang="ts">
  import AnchoredScrollEvidenceHarness from "./anchored-scroll-evidence-harness.svelte";

  let { scenarioId }: { scenarioId: string } = $props();

  const anchoredEvidenceScenarioIds = new Set([
    "anchored-desktop-keyboard-sequence",
    "anchored-desktop-wheel-sequence",
    "anchored-mobile-momentum-sequence",
    "anchored-mobile-touch-sequence",
  ]);
</script>

<svelte:head>
  <title>{scenarioId}</title>
</svelte:head>

<main class="min-h-screen bg-background p-6 text-foreground" data-testid="perf-root">
  {#if anchoredEvidenceScenarioIds.has(scenarioId)}
    <AnchoredScrollEvidenceHarness />
  {:else}
    <div class="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
      Unknown anchored input scenario: {scenarioId}
    </div>
  {/if}
</main>
