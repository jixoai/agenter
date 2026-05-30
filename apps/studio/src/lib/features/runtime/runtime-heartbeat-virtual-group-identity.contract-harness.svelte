<script lang="ts">
  import type { HeartbeatGroupItem, HeartbeatPartItem } from "@agenter/client-sdk";
  import { AnchoredVirtualList, type ScrollVirtualConfig } from "@agenter/svelte-components";

  import { VirtualConversation } from "$lib/components/ai-elements/conversation/index.js";
  import { Button } from "$lib/components/ui/button/index.js";

  import RuntimeHeartbeatGroup from "./runtime-heartbeat-group.svelte";
  import { estimateHeartbeatGroupSize } from "./runtime-heartbeat-parts";

  type HarnessMode = "direct" | "wrapped";

  const baseTimestamp = Date.UTC(2026, 3, 21, 1, 0, 0);

  const createEntry = (id: number): HeartbeatPartItem => ({
    id,
    messageId: `heartbeat-part:virtual-contract:${id}`,
    windowId: null,
    aiCallId: id,
    roundIndex: id,
    scope: "heartbeat_part",
    role: "assistant",
    createdAt: baseTimestamp + id * 1_000,
    updatedAt: baseTimestamp + id * 1_000 + 500,
    isComplete: false,
    text: `echo "virtual contract ${id}"`,
    parts: [
      {
        partId: id,
        partIndex: 0,
        messageId: `heartbeat-part:virtual-contract:${id}`,
        windowId: null,
        aiCallId: id,
        roundIndex: id,
        scope: "heartbeat_part",
        role: "assistant",
        partType: "tool_call",
        mimeType: null,
        payload: {
          invocationId: `virtual-contract-${id}`,
          tool: "root_bash",
          input: {
            workspaceAlias: "root",
            command: `printf '%s\n' 'virtual contract ${id}'`,
            stdin: JSON.stringify({ contract: "runtime-heartbeat-virtual", id }, null, 2),
          },
          startedAt: baseTimestamp + id * 1_000,
        },
        createdAt: baseTimestamp + id * 1_000,
        updatedAt: baseTimestamp + id * 1_000 + 500,
        isComplete: false,
      },
    ],
  });

  const createGroup = (id: number): HeartbeatGroupItem => ({
    id,
    groupId: `runtime-heartbeat-virtual-group:${id}`,
    kind: "call",
    aiCallId: id,
    createdAt: baseTimestamp + id * 1_000,
    updatedAt: baseTimestamp + id * 1_000 + 500,
    isComplete: false,
    items: [createEntry(id)],
  });

  const stableVirtualConfig = {
    estimateSize: (_index, group) => estimateHeartbeatGroupSize(group),
    getItemKey: (_index, group) => group.groupId,
    measureElement: true,
    overscan: 4,
    gap: 12,
    paddingStart: 12,
    paddingEnd: 12,
    useAnimationFrameWithResizeObserver: true,
  } satisfies Omit<ScrollVirtualConfig<HeartbeatGroupItem>, "items">;

  let {
    mode = "direct",
  }: {
    mode?: HarnessMode;
  } = $props();

  let groups = $state<HeartbeatGroupItem[]>(Array.from({ length: 8 }, (_, index) => createGroup(index + 1)));
  let nextId = $state(9);
  let insertMotionByGroupId = $state<Record<string, "latest">>({});

  const harnessState = $derived(
    JSON.stringify({
      itemCount: groups.length,
      latestGroupId: groups.at(-1)?.groupId ?? null,
      mode,
    }),
  );

  const appendLatest = (): void => {
    const nextGroup = createGroup(nextId);
    groups = [...groups, nextGroup];
    insertMotionByGroupId = { [nextGroup.groupId]: "latest" };
    nextId += 1;
  };
</script>

<div class="grid gap-4 rounded-[1.35rem] border border-border/70 bg-background p-4">
  <div class="flex flex-wrap items-center gap-2">
    <Button data-testid="runtime-heartbeat-virtual-append-latest" size="sm" variant="outline" onclick={appendLatest}>
      Append latest
    </Button>
    <div class="text-xs text-muted-foreground" data-testid="runtime-heartbeat-virtual-state">
      {harnessState}
    </div>
  </div>

  <div class="h-[420px] rounded-[1.2rem] border border-border/60 bg-card/60">
    {#if mode === "direct"}
      <AnchoredVirtualList
        class="h-full"
        contentClass="px-3"
        items={groups}
        viewportTestId="runtime-heartbeat-virtual-viewport"
        virtual={stableVirtualConfig}
      >
        {#snippet item(group)}
          <div
            data-insert-motion={insertMotionByGroupId[group.groupId] ?? "none"}
            data-insert-motion-key={group.groupId}
          >
            <RuntimeHeartbeatGroup
              {group}
              avatarLabel="Virtual Contract Avatar"
              sessionIconUrl="https://example.test/runtime-virtual-avatar.webp"
            />
          </div>
        {/snippet}
      </AnchoredVirtualList>
    {:else}
      <VirtualConversation
        class="h-full"
        contentClass="px-3"
        items={groups}
        viewportTestId="runtime-heartbeat-virtual-viewport"
        virtual={stableVirtualConfig}
      >
        {#snippet renderItem(group)}
          <div
            data-insert-motion={insertMotionByGroupId[group.groupId] ?? "none"}
            data-insert-motion-key={group.groupId}
          >
            <RuntimeHeartbeatGroup
              {group}
              avatarLabel="Virtual Contract Avatar"
              sessionIconUrl="https://example.test/runtime-virtual-avatar.webp"
            />
          </div>
        {/snippet}
      </VirtualConversation>
    {/if}
  </div>
</div>
