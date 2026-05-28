<script lang="ts">
  import { onDestroy } from "svelte";
  import MoreHorizontal from "@lucide/svelte/icons/more-horizontal";
  import { app } from "framework7-svelte";
  import { useFramework7Runtime } from "./framework7-host";
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

  const runAction = async (action: ResolvedMessageAction): Promise<void> => {
    if (action.disabled) {
      return;
    }
    await action.onSelect?.();
    open = false;
  };

  let triggerHost = $state<HTMLDivElement | null>(null);
  const targetEl = $derived.by(() => triggerHost?.querySelector("[data-message-actions-trigger]") ?? undefined);
  const framework7Runtime = useFramework7Runtime();
  const useCompactActions = (): boolean => typeof window !== "undefined" && window.innerWidth <= 480;
  const desktopActionPopoverWidth = 260;
  type Framework7ActionsAnchor =
    | {
        targetEl: Element | string;
      }
    | {
        targetX: number;
        targetY: number;
        targetWidth: number;
        targetHeight: number;
      };
  type Framework7ActionsInstance = {
    open: (animate?: boolean) => void;
    close: (animate?: boolean) => void;
    destroy: () => void;
  };
  type Framework7ActionsButton = {
    text: string;
    color?: string;
    bold?: boolean;
    disabled?: boolean;
    close?: boolean;
    onClick?: () => void;
  };
  type Framework7AppWithActions = {
    actions: {
      create: (params: {
        buttons: Framework7ActionsButton[][];
        backdrop?: boolean;
        closeByBackdropClick?: boolean;
        closeByOutsideClick?: boolean;
        convertToPopover?: boolean;
        forceToPopover?: boolean;
        targetEl?: Element | string;
        targetX?: number;
        targetY?: number;
        targetWidth?: number;
        targetHeight?: number;
        containerEl?: string;
        on?: {
          closed?: () => void;
        };
      }) => Framework7ActionsInstance;
    };
  };
  let actionSurface: Framework7ActionsInstance | null = null;

  const destroyActionSurface = (): void => {
    actionSurface?.destroy();
    actionSurface = null;
  };

  const resolveActionAnchor = (): Framework7ActionsAnchor | null => {
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

  const openActionSurface = (): void => {
    const framework7App = app.f7 as unknown as Framework7AppWithActions | undefined;
    const actionAnchor = resolveActionAnchor();
    if (!framework7App || !actionAnchor) {
      return;
    }
    destroyActionSurface();
    actionSurface = framework7App.actions.create({
      buttons: [
        actions.map((action) => ({
          text: action.detail ? `${action.label} · ${action.detail}` : action.label,
          color: action.tone === "destructive" ? "red" : undefined,
          bold: action.tone !== "destructive",
          disabled: action.disabled,
          close: action.disabled ? false : true,
          onClick: () => {
            void runAction(action);
          },
        })),
        [
          {
            text: "Cancel",
            bold: true,
          },
        ],
      ],
      backdrop: true,
      closeByBackdropClick: true,
      closeByOutsideClick: true,
      convertToPopover: true,
      forceToPopover: !useCompactActions(),
      ...actionAnchor,
      containerEl: "body",
      on: {
        closed: () => {
          destroyActionSurface();
          open = false;
        },
      },
    }) as Framework7ActionsInstance;
    actionSurface.open();
  };

  $effect(() => {
    if (!$framework7Runtime) {
      destroyActionSurface();
      return;
    }
    if (!open) {
      if (actionSurface) {
        actionSurface.close();
      }
      return;
    }
    if (!actionSurface) {
      openActionSurface();
    }
  });

  onDestroy(() => {
    destroyActionSurface();
  });
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

  {#if open && !$framework7Runtime}
    <div class="message-actions-popover" data-state="open" role="menu" aria-label={title}>
      {#each actions as action (action.id)}
        <Link
          href="#"
          class={`message-actions-item ${action.tone === "destructive" ? "message-actions-item-destructive" : ""} ${action.disabled ? "message-actions-item-disabled" : ""}`}
          aria-disabled={action.disabled}
          tabindex={action.disabled ? -1 : undefined}
          role="menuitem"
          onclick={(event: MouseEvent) => {
            event.preventDefault();
            void runAction(action);
          }}
        >
          <span class="message-actions-item-label">{action.label}</span>
          {#if action.detail}
            <span class="message-actions-item-detail">{action.detail}</span>
          {/if}
        </Link>
      {/each}
    </div>
  {/if}
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

  .message-actions-popover {
    position: absolute;
    top: calc(100% + 0.35rem);
    right: 0;
    z-index: 12;
    display: grid;
    min-width: 12rem;
    overflow: hidden;
    border-radius: 16px;
    background: color-mix(in srgb, var(--f7-card-bg-color, #fff) 96%, transparent);
    border: 1px solid color-mix(in srgb, var(--f7-list-outline-border-color, #cfd8e3) 88%, transparent);
    box-shadow: 0 12px 32px rgba(15, 23, 42, 0.16);
    backdrop-filter: blur(20px);
  }

  :global(.message-actions-item) {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    min-width: 0;
    background: transparent;
    color: var(--f7-text-color, #111827);
    padding: 0.78rem 0.9rem;
    text-align: left;
    font-size: 0.84rem;
    text-decoration: none;
  }

  :global(.message-actions-item + .message-actions-item) {
    border-top: 1px solid color-mix(in srgb, var(--f7-list-outline-border-color, #e5e7eb) 72%, transparent);
  }

  :global(.message-actions-item-disabled) {
    opacity: 0.42;
    pointer-events: none;
  }

  :global(.message-actions-item-destructive) {
    color: #dc2626;
  }

  .message-actions-item-label {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: 600;
  }

  .message-actions-item-detail {
    flex: 0 0 auto;
    font-size: 0.62rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--f7-text-color-secondary, #94a3b8);
  }
</style>
