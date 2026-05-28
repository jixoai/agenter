<script lang="ts">
  import { onDestroy } from "svelte";
  import { app } from "framework7-svelte";
  import { useFramework7Runtime } from "./framework7-host";
  import { Link } from "./framework7-components";
  import type { ResolvedMessageAction } from "./message-actions-menu.svelte";

  let {
    actions,
    title = "Message actions",
    open = $bindable(false),
    anchorX = null,
    anchorY = null,
  }: {
    actions: readonly ResolvedMessageAction[];
    title?: string;
    open?: boolean;
    anchorX?: number | null;
    anchorY?: number | null;
  } = $props();

  const runAction = async (action: ResolvedMessageAction): Promise<void> => {
    if (action.disabled) {
      return;
    }
    await action.onSelect?.();
    open = false;
  };
  const framework7Runtime = useFramework7Runtime();
  const useCompactActions = (): boolean => typeof window !== "undefined" && window.innerWidth <= 480;
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

  const openActionSurface = (): void => {
    const framework7App = app.f7 as unknown as Framework7AppWithActions | undefined;
    if (!framework7App || anchorX === null || anchorY === null) {
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
      targetX: anchorX,
      targetY: anchorY,
      targetWidth: 1,
      targetHeight: 1,
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

{#if open}
  {#if !$framework7Runtime}
    <div class="message-actions-context-menu" role="menu" aria-label={title}>
      {#each actions as action (action.id)}
        <Link
          href="#"
          class={`message-actions-context-item ${action.tone === "destructive" ? "message-actions-context-item-destructive" : ""} ${action.disabled ? "message-actions-context-item-disabled" : ""}`}
          aria-disabled={action.disabled}
          tabindex={action.disabled ? -1 : undefined}
          role="menuitem"
          onclick={(event: MouseEvent) => {
            event.preventDefault();
            void runAction(action);
          }}
        >
          <span class="message-actions-context-label">{action.label}</span>
          {#if action.detail}
            <span class="message-actions-context-detail">{action.detail}</span>
          {/if}
        </Link>
      {/each}
    </div>
  {/if}
{/if}

<style>
  .message-actions-context-menu {
    position: absolute;
    inset-inline-start: 0;
    inset-block-start: calc(100% + 0.3rem);
    z-index: 13;
    display: grid;
    min-width: 11.5rem;
    overflow: hidden;
    border-radius: 16px;
    border: 1px solid color-mix(in srgb, var(--f7-list-outline-border-color, #cfd8e3) 88%, transparent);
    background: color-mix(in srgb, var(--f7-card-bg-color, #fff) 97%, transparent);
    box-shadow: 0 12px 32px rgba(15, 23, 42, 0.16);
    backdrop-filter: blur(20px);
  }

  :global(.message-actions-context-item) {
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

  :global(.message-actions-context-item + .message-actions-context-item) {
    border-top: 1px solid color-mix(in srgb, var(--f7-list-outline-border-color, #e5e7eb) 72%, transparent);
  }

  :global(.message-actions-context-item-disabled) {
    opacity: 0.42;
    pointer-events: none;
  }

  :global(.message-actions-context-item-destructive) {
    color: #dc2626;
  }

  .message-actions-context-label {
    font-weight: 600;
  }

  .message-actions-context-detail {
    font-size: 0.62rem;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--f7-text-color-secondary, #94a3b8);
  }
</style>
