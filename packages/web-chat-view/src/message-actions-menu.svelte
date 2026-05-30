<script lang="ts">
  import MoreHorizontal from "@lucide/svelte/icons/more-horizontal";
  import Framework7ActionSurface from "./framework7-action-surface.svelte";
  import type { Framework7ActionSurfaceAnchor } from "./framework7-action-surface-types";
  import { Link } from "./framework7-components";

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

  let triggerHost = $state<HTMLDivElement | null>(null);
  const targetEl = $derived.by(() => triggerHost?.querySelector("[data-message-actions-trigger]") ?? undefined);
  const useCompactActions = (): boolean => typeof window !== "undefined" && window.innerWidth <= 480;
  const desktopActionPopoverWidth = 260;

  const resolveActionAnchor = (): Framework7ActionSurfaceAnchor | null => {
    if (!targetEl) {
      return null;
    }
    if (useCompactActions() || !(targetEl instanceof HTMLElement)) {
      return { targetEl };
    }
    const rect = targetEl.getBoundingClientRect();
    const targetWidth = Math.min(desktopActionPopoverWidth, Math.max(180, window.innerWidth - 10));
    return {
      targetX: Math.round(rect.right - targetWidth),
      targetY: Math.round(rect.top),
      targetWidth,
      targetHeight: Math.round(rect.height),
    };
  };

  const actionAnchor = $derived.by(resolveActionAnchor);
</script>

<div class="message-actions-menu" bind:this={triggerHost}>
  <Link
    href="#"
    iconOnly
    data-message-actions-trigger
    role="button"
    class={`message-actions-trigger ${open ? "message-actions-trigger-open" : ""}`}
    aria-label={title}
    aria-expanded={open}
    title={title}
    onclick={(event: MouseEvent) => {
      event.preventDefault();
      open = !open;
    }}
  >
    <MoreHorizontal class="size-4" />
  </Link>
  <Framework7ActionSurface bind:open actions={actions} {title} anchor={actionAnchor} />
</div>

<style>
  .message-actions-menu {
    position: relative;
  }

  :global(.message-actions-trigger) {
    color: var(--f7-text-color-secondary, #94a3b8);
  }

  :global(.message-actions-trigger-open) {
    background: color-mix(in srgb, var(--f7-theme-color, #007aff) 8%, white);
    color: var(--f7-text-color, #111827);
  }

</style>
