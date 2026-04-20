<script lang="ts">
  import { AnchoredVirtualList, type ScrollVirtualConfig } from "@agenter/svelte-components";

  import { VirtualConversation } from "$lib/components/ai-elements/conversation/index.js";
  import { Button } from "$lib/components/ui/button/index.js";

  import IdentityRowCard from "./anchored-virtual-list-identity-row.svelte";

  type HarnessMode = "direct" | "wrapped";
  type RenderMode = "component" | "markup";
  type VirtualConfigMode = "inline" | "stable";

  type IdentityRow = {
    id: number;
    title: string;
    body: string;
    estimateSize: number;
  };

  const createRow = (id: number): IdentityRow => ({
    id,
    title: `Row ${id}`,
    body: `Identity contract row ${id} keeps a stable inner subtree while the latest edge grows.`,
    estimateSize: 132 + (id % 3) * 20,
  });

  const createInitialRows = (): IdentityRow[] => Array.from({ length: 8 }, (_, index) => createRow(index + 1));

  const stableVirtualConfig = {
    estimateSize: (_index, row) => row.estimateSize,
    getItemKey: (_index, row) => row.id,
    measureElement: true,
    overscan: 3,
    gap: 12,
    paddingStart: 12,
    paddingEnd: 12,
    useAnimationFrameWithResizeObserver: true,
  } satisfies Omit<ScrollVirtualConfig<IdentityRow>, "items">;

  let {
    mode = "direct",
    renderMode = "markup",
    virtualConfigMode = "stable",
  }: {
    mode?: HarnessMode;
    renderMode?: RenderMode;
    virtualConfigMode?: VirtualConfigMode;
  } = $props();

  let rows = $state<IdentityRow[]>(createInitialRows());
  let nextId = $state(9);

  const harnessState = $derived(
    JSON.stringify({
      itemCount: rows.length,
      latestRowId: rows.at(-1)?.id ?? null,
      mode,
      renderMode,
      virtualConfigMode,
    }),
  );

  const appendLatest = (): void => {
    rows = [...rows, createRow(nextId)];
    nextId += 1;
  };
</script>

<div
  class="grid gap-4 rounded-[1.35rem] border border-border/70 bg-background p-4"
  data-harness-mode={mode}
  data-virtual-config-mode={virtualConfigMode}
  data-testid="anchored-virtual-list-identity-harness"
>
  <div class="flex flex-wrap items-center gap-2">
    <Button data-testid="avl-identity-append-latest" size="sm" variant="outline" onclick={appendLatest}>
      Append latest
    </Button>
    <div class="text-xs text-muted-foreground" data-testid="avl-identity-state">
      {harnessState}
    </div>
  </div>

  {#snippet identityRow(row: IdentityRow)}
    {#if renderMode === "component"}
      <IdentityRowCard {row} />
    {:else}
      <article class="grid gap-3 rounded-[1rem] border border-border/60 bg-background px-4 py-3 shadow-sm" data-testid={`identity-row-${row.id}`}>
        <div class="grid gap-2" data-testid={`identity-row-section-${row.id}`}>
          <div class="font-medium text-foreground" data-testid={`identity-row-leaf-${row.id}`}>
            {row.title}
          </div>
          <p class="text-sm text-muted-foreground">{row.body}</p>
        </div>
      </article>
    {/if}
  {/snippet}

  <div class="h-[420px] min-h-0 rounded-[1.2rem] border border-border/60 bg-card/60">
    {#if mode === "direct"}
      {#if virtualConfigMode === "stable"}
        <AnchoredVirtualList
          class="h-full"
          contentClass="px-3"
          items={rows}
          viewportTestId="anchored-virtual-identity-viewport"
          virtual={stableVirtualConfig}
        >
          {#snippet item(row)}
            {@render identityRow(row)}
          {/snippet}
        </AnchoredVirtualList>
      {:else}
        <AnchoredVirtualList
          class="h-full"
          contentClass="px-3"
          items={rows}
          viewportTestId="anchored-virtual-identity-viewport"
          virtual={{
            estimateSize: (_index, row) => row.estimateSize,
            getItemKey: (_index, row) => row.id,
            measureElement: true,
            overscan: 3,
            gap: 12,
            paddingStart: 12,
            paddingEnd: 12,
            useAnimationFrameWithResizeObserver: true,
          }}
        >
          {#snippet item(row)}
            {@render identityRow(row)}
          {/snippet}
        </AnchoredVirtualList>
      {/if}
    {:else if virtualConfigMode === "stable"}
      <VirtualConversation
        class="h-full"
        contentClass="px-3"
        items={rows}
        viewportTestId="anchored-virtual-identity-viewport"
        virtual={stableVirtualConfig}
      >
        {#snippet renderItem(row)}
          {@render identityRow(row)}
        {/snippet}
      </VirtualConversation>
    {:else}
      <VirtualConversation
        class="h-full"
        contentClass="px-3"
        items={rows}
        viewportTestId="anchored-virtual-identity-viewport"
        virtual={{
          estimateSize: (_index, row) => row.estimateSize,
          getItemKey: (_index, row) => row.id,
          measureElement: true,
          overscan: 3,
          gap: 12,
          paddingStart: 12,
          paddingEnd: 12,
          useAnimationFrameWithResizeObserver: true,
        }}
      >
        {#snippet renderItem(row)}
          {@render identityRow(row)}
        {/snippet}
      </VirtualConversation>
    {/if}
  </div>
</div>
