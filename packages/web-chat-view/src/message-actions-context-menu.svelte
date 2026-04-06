<script lang="ts">
  import * as ContextMenu from "./ui/context-menu";

  import type { ResolvedMessageAction } from "./message-actions-menu.svelte";

  let {
    actions,
    title = "Message actions",
  }: {
    actions: readonly ResolvedMessageAction[];
    title?: string;
  } = $props();

  const runAction = async (action: ResolvedMessageAction): Promise<void> => {
    if (action.disabled) {
      return;
    }
    await action.onSelect?.();
  };
</script>

<ContextMenu.Content align="end" aria-label={title}>
  {#each actions as action (action.id)}
    <ContextMenu.Item
      variant={action.tone === "destructive" ? "destructive" : "default"}
      disabled={action.disabled}
      onclick={() => {
        void runAction(action);
      }}
    >
      <span class="min-w-0 flex-1 truncate">{action.label}</span>
      {#if action.detail}
        <span class="truncate text-[10px] font-normal uppercase tracking-[0.16em] text-slate-400">
          {action.detail}
        </span>
      {/if}
    </ContextMenu.Item>
  {/each}
</ContextMenu.Content>
