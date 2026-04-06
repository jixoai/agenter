<script lang="ts">
  import MoreHorizontal from "@lucide/svelte/icons/more-horizontal";

  import { Button } from "./ui/button";
  import * as DropdownMenu from "./ui/dropdown-menu";

  export interface ResolvedMessageAction {
    id: string;
    label: string;
    detail?: string;
    tone?: "default" | "destructive";
    disabled?: boolean;
    onSelect?: () => void | Promise<void>;
  }

  let {
    actions,
    title = "Message actions",
    open = $bindable(false),
  }: {
    actions: readonly ResolvedMessageAction[];
    title?: string;
    open?: boolean;
  } = $props();

  const runAction = async (action: ResolvedMessageAction): Promise<void> => {
    if (action.disabled) {
      return;
    }
    await action.onSelect?.();
    open = false;
  };
</script>

<DropdownMenu.Root bind:open>
  <DropdownMenu.Trigger>
    {#snippet child({ props })}
      <Button
        {...props}
        type="button"
        size="icon-sm"
        variant="ghost"
        class="rounded-full text-slate-400 hover:text-slate-900 data-[state=open]:bg-slate-100 data-[state=open]:text-slate-900"
        aria-label={title}
        title={title}
      >
        <MoreHorizontal class="size-4" />
      </Button>
    {/snippet}
  </DropdownMenu.Trigger>
  <DropdownMenu.Content align="end">
    {#each actions as action (action.id)}
      <DropdownMenu.Item
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
      </DropdownMenu.Item>
    {/each}
  </DropdownMenu.Content>
</DropdownMenu.Root>
