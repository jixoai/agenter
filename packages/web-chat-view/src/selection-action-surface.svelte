<script lang="ts">
  import { onDestroy } from "svelte";
  import { app } from "framework7-svelte";

  import { Link } from "./framework7-components";
  import { useFramework7Runtime } from "./framework7-host";

  let {
    open = $bindable(false),
    selectedText,
    targetEl = undefined,
    onCopy,
    onShare,
    onComment,
  }: {
    open?: boolean;
    selectedText: string;
    targetEl?: HTMLElement | null | undefined;
    onCopy?: (() => void | Promise<void>) | undefined;
    onShare?: (() => void | Promise<void>) | undefined;
    onComment?: (() => void | Promise<void>) | undefined;
  } = $props();

  const hasSelection = $derived(selectedText.trim().length > 0);
  const framework7Runtime = useFramework7Runtime();
  const useCompactActions = (): boolean => typeof window !== "undefined" && window.innerWidth <= 480;
  type Framework7ActionsInstance = {
    open: (animate?: boolean) => void;
    close: (animate?: boolean) => void;
    destroy: () => void;
  };
  type Framework7ActionsButton = {
    text: string;
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
        containerEl?: string;
        on?: {
          closed?: () => void;
        };
      }) => Framework7ActionsInstance;
    };
  };
  let actionSurface: Framework7ActionsInstance | null = null;

  const run = async (callback: (() => void | Promise<void>) | undefined): Promise<void> => {
    if (!callback) {
      return;
    }
    await callback();
    open = false;
  };

  const destroyActionSurface = (): void => {
    actionSurface?.destroy();
    actionSurface = null;
  };

  const openActionSurface = (): void => {
    const framework7App = app.f7 as unknown as Framework7AppWithActions | undefined;
    if (!framework7App || !targetEl) {
      return;
    }
    destroyActionSurface();
    actionSurface = framework7App.actions.create({
      buttons: [
        [
          {
            text: "Copy",
            bold: true,
            disabled: !hasSelection,
            close: hasSelection,
            onClick: () => void run(onCopy),
          },
          {
            text: "Share",
            bold: true,
            disabled: !hasSelection,
            close: hasSelection,
            onClick: () => void run(onShare),
          },
          {
            text: "Comment",
            bold: true,
            disabled: !hasSelection,
            close: hasSelection,
            onClick: () => void run(onComment),
          },
        ],
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
      targetEl,
      containerEl: "body",
      on: {
        closed: () => {
          destroyActionSurface();
          open = false;
        },
      },
    });
    actionSurface.open();
  };

  $effect(() => {
    if (!$framework7Runtime || !targetEl) {
      destroyActionSurface();
      return;
    }
    if (!open) {
      actionSurface?.close();
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
  {#if !$framework7Runtime || !targetEl}
    <div class="selection-action-surface" role="menu" aria-label="Selection actions">
      <Link href="#" role="menuitem" aria-disabled={!hasSelection} tabindex={!hasSelection ? -1 : undefined} onclick={(event: MouseEvent) => {
        event.preventDefault();
        void run(onCopy);
      }}>Copy</Link>
      <Link href="#" role="menuitem" aria-disabled={!hasSelection} tabindex={!hasSelection ? -1 : undefined} onclick={(event: MouseEvent) => {
        event.preventDefault();
        void run(onShare);
      }}>Share</Link>
      <Link href="#" role="menuitem" aria-disabled={!hasSelection} tabindex={!hasSelection ? -1 : undefined} onclick={(event: MouseEvent) => {
        event.preventDefault();
        void run(onComment);
      }}>Comment</Link>
    </div>
  {/if}
{/if}

<style>
  .selection-action-surface {
    position: absolute;
    inset-inline-end: 0;
    inset-block-end: calc(100% + 0.4rem);
    z-index: 120;
    display: flex;
    gap: 0.35rem;
    border-radius: 16px;
    border: 1px solid color-mix(in srgb, var(--f7-list-outline-border-color, #cfd8e3) 88%, transparent);
    background: color-mix(in srgb, var(--f7-card-bg-color, #fff) 96%, transparent);
    padding: 0.42rem;
    box-shadow: 0 12px 32px rgba(15, 23, 42, 0.16);
    backdrop-filter: blur(20px);
  }

  :global(.selection-action-surface .link) {
    border: 0;
    border-radius: 12px;
    background: transparent;
    color: var(--f7-theme-color, #007aff);
    padding: 0.5rem 0.75rem;
    font-size: 0.84rem;
    font-weight: 600;
    text-decoration: none;
  }

  :global(.selection-action-surface .link[aria-disabled="true"]) {
    opacity: 0.42;
    pointer-events: none;
  }
</style>
