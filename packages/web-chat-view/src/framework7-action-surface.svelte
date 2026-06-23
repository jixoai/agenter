<script lang="ts">
  import { onDestroy } from "svelte";
  import { app } from "framework7-svelte";

  import { Link } from "./framework7-components";
  import { useFramework7Runtime } from "./framework7-host";
  import type {
    Framework7ActionSurfaceAnchor,
    Framework7ActionSurfaceItem,
    Framework7ActionsInstance,
    Framework7AppWithActions,
  } from "./framework7-action-surface-types";

  let {
    actions,
    title = "Actions",
    open = $bindable(false),
    anchor = null,
  }: {
    actions: readonly Framework7ActionSurfaceItem[];
    title?: string;
    open?: boolean;
    anchor?: Framework7ActionSurfaceAnchor | null;
  } = $props();

  const framework7Runtime = useFramework7Runtime();
  const useCompactActions = (): boolean => typeof window !== "undefined" && window.innerWidth <= 480;

  let actionSurface: Framework7ActionsInstance | null = null;

  const destroyActionSurface = (): void => {
    actionSurface?.destroy();
    actionSurface = null;
  };

  const closeSurface = (): void => {
    open = false;
  };

  const runAction = async (action: Framework7ActionSurfaceItem): Promise<void> => {
    if (action.disabled) {
      return;
    }
    await action.onSelect?.();
    closeSurface();
  };

  const openActionSurface = (): void => {
    const framework7App = app.f7 as unknown as Framework7AppWithActions | undefined;
    if (!framework7App) {
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
      ...(anchor ?? {}),
      containerEl: "body",
      on: {
        closed: () => {
          destroyActionSurface();
          closeSurface();
        },
      },
    });
    actionSurface.open();
  };

  $effect(() => {
    if (!$framework7Runtime) {
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

{#if open && !$framework7Runtime}
  <div class="framework7-action-surface-fallback" role="menu" aria-label={title}>
    {#each actions as action (action.id)}
      <Link
        href="#"
        class={`framework7-action-surface-fallback-item ${action.tone === "destructive" ? "framework7-action-surface-fallback-item-destructive" : ""}`}
        aria-disabled={action.disabled}
        tabindex={action.disabled ? -1 : undefined}
        role="menuitem"
        onclick={(event: MouseEvent) => {
          event.preventDefault();
          void runAction(action);
        }}
      >
        <span>{action.label}</span>
        {#if action.detail}
          <small>{action.detail}</small>
        {/if}
      </Link>
    {/each}
  </div>
{/if}

<style>
  .framework7-action-surface-fallback {
    display: grid;
    min-width: 11.5rem;
    overflow: hidden;
    border: 1px solid var(--f7-list-outline-border-color, #e5e7eb);
    background: var(--f7-list-bg-color, #fff);
  }

  :global(.framework7-action-surface-fallback-item) {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    min-width: 0;
    color: var(--f7-text-color, #111827);
    padding: 0.72rem 0.85rem;
    text-align: left;
    font-size: 0.84rem;
    font-weight: 600;
    text-decoration: none;
  }

  :global(.framework7-action-surface-fallback-item + .framework7-action-surface-fallback-item) {
    border-top: 1px solid var(--f7-list-outline-border-color, #e5e7eb);
  }

  :global(.framework7-action-surface-fallback-item[aria-disabled="true"]) {
    opacity: 0.42;
    pointer-events: none;
  }

  :global(.framework7-action-surface-fallback-item-destructive) {
    color: #dc2626;
  }

  .framework7-action-surface-fallback small {
    flex: 0 0 auto;
    color: var(--f7-text-color-secondary, #6b7280);
    font-size: 0.62rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
</style>
