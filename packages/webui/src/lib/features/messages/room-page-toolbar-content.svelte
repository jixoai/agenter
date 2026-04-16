<script lang="ts">
  import SearchIcon from "@lucide/svelte/icons/search";
  import Settings2Icon from "@lucide/svelte/icons/settings-2";
  import UserPlusIcon from "@lucide/svelte/icons/user-plus";

  import ProfileAvatar from "$lib/components/profile-avatar.svelte";
  import { buttonVariants } from "$lib/components/ui/button/index.js";
  import * as Select from "$lib/components/ui/select/index.js";
  import { cn } from "$lib/utils.js";

  import type { MessageSystemRoomSeatState } from "./message-system-surface.types";

  type RoomBodyMode = "chat" | "assets";
  type ViewerOption = {
    value: string;
    label: string;
  };

  let {
    selectedViewer,
    selectedViewerActorId,
    viewerItems,
    selectedViewerLabel,
    canSelectViewer,
    activeMode,
    canSearch = true,
    onSelectViewer,
    onSelectMode,
    onSearchClick,
    onAddUserClick,
    onManageClick,
  }: {
    selectedViewer: MessageSystemRoomSeatState | null;
    selectedViewerActorId: string | null;
    viewerItems: ViewerOption[];
    selectedViewerLabel: string;
    canSelectViewer: boolean;
    activeMode: RoomBodyMode;
    canSearch?: boolean;
    onSelectViewer: (actorId: string) => void;
    onSelectMode: (mode: RoomBodyMode) => void;
    onSearchClick: () => void;
    onAddUserClick: () => void;
    onManageClick: () => void;
  } = $props();

  const viewerAvatarLabel = $derived(selectedViewer?.label ?? selectedViewerLabel ?? "Room user");
</script>

<div
  class="room-page-toolbar"
  data-room-toolbar-mode={activeMode}
>
  <div class="room-page-toolbar__identity">
    <div class="room-page-toolbar__avatar">
      <ProfileAvatar
        label={viewerAvatarLabel}
        src={selectedViewer?.iconUrl ?? null}
        class="room-page-toolbar__avatar-image"
      />
    </div>

    <div class="room-page-toolbar__viewer">
      {#if canSelectViewer}
        <Select.Root
          type="single"
          items={viewerItems}
          value={selectedViewerActorId ?? undefined}
          onValueChange={(value) => {
            onSelectViewer(value);
          }}
        >
          <Select.Trigger
            size="sm"
            aria-label="View room as user"
            class="room-page-toolbar__viewer-trigger"
            title={selectedViewerLabel}
          >
            <span class="truncate">{selectedViewerLabel}</span>
          </Select.Trigger>
          <Select.Content>
            {#each viewerItems as item (item.value)}
              <Select.Item value={item.value} label={item.label}>{item.label}</Select.Item>
            {/each}
          </Select.Content>
        </Select.Root>
      {:else}
        <div class="room-page-toolbar__viewer-fallback" title={selectedViewerLabel}>
          <span class="truncate">{selectedViewerLabel}</span>
        </div>
      {/if}
    </div>
  </div>

  <div class="room-page-toolbar__secondary">
    <div class="room-page-toolbar__actions" aria-label="Room actions">
      <button
        type="button"
        class={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }), "room-page-toolbar__action")}
        aria-label="Search messages"
        title="Search messages"
        disabled={!canSearch}
        onclick={onSearchClick}
      >
        <SearchIcon class="size-4" />
      </button>
      <button
        type="button"
        class={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }), "room-page-toolbar__action")}
        aria-label="Add user"
        title="Add user"
        onclick={onAddUserClick}
      >
        <UserPlusIcon class="size-4" />
      </button>
      <button
        type="button"
        class={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }), "room-page-toolbar__action")}
        aria-label="Manage room"
        title="Manage room"
        onclick={onManageClick}
      >
        <Settings2Icon class="size-4" />
      </button>
    </div>

    <div class="room-page-toolbar__modes" role="tablist" aria-label="Room content mode">
      {#each ["chat", "assets"] as mode (mode)}
        <button
          type="button"
          class="room-page-toolbar__mode-chip"
          data-active={activeMode === mode ? "true" : "false"}
          role="tab"
          aria-selected={activeMode === mode}
          onclick={() => {
            onSelectMode(mode as RoomBodyMode);
          }}
        >
          {mode}
        </button>
      {/each}
    </div>
  </div>
</div>

<style>
  .room-page-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.6rem;
    block-size: 100%;
    min-block-size: 0;
    min-inline-size: 0;
    padding-inline: 0.7rem;
    padding-block: 0.2rem;
    overflow: clip;
  }

  .room-page-toolbar__identity,
  .room-page-toolbar__viewer,
  .room-page-toolbar__secondary,
  .room-page-toolbar__actions,
  .room-page-toolbar__modes {
    min-inline-size: 0;
  }

  .room-page-toolbar__identity {
    flex: 1 1 auto;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    overflow: hidden;
  }

  .room-page-toolbar__avatar {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  :global(.room-page-toolbar__avatar-image) {
    block-size: 1.75rem;
    inline-size: 1.75rem;
    border-radius: 0.8rem;
    border-color: color-mix(in srgb, var(--border), transparent 20%);
    background: color-mix(in srgb, var(--background), transparent 12%);
    box-shadow: inset 0 1px 0 color-mix(in srgb, var(--background), white 78%);
  }

  .room-page-toolbar__viewer {
    flex: 1 1 auto;
    overflow: hidden;
  }

  :global(.room-page-toolbar__viewer-trigger),
  .room-page-toolbar__viewer-fallback {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    inline-size: 100%;
    min-inline-size: 0;
    max-inline-size: 100%;
    min-block-size: 1.15rem;
    block-size: 1.15rem;
    border-radius: 999px;
    border: 0;
    background: transparent;
    padding: 0;
    color: var(--foreground);
    font-size: 0.76rem;
    font-weight: 600;
    line-height: 1;
    white-space: nowrap;
    box-shadow: none;
  }

  :global(.room-page-toolbar__viewer-trigger[data-slot="select-trigger"]) {
    height: 1.15rem;
    min-height: 1.15rem;
    width: 100%;
    min-width: 0;
    gap: 0.25rem;
    padding: 0;
    border: 0;
    background: transparent;
    box-shadow: none;
  }

  :global(.room-page-toolbar__viewer-trigger[data-slot="select-trigger"] > svg) {
    inline-size: 0.8rem;
    block-size: 0.8rem;
    opacity: 0.5;
  }

  .room-page-toolbar__viewer-fallback {
    min-block-size: 1.15rem;
  }

  .room-page-toolbar__secondary {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.35rem;
  }

  .room-page-toolbar__actions {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.15rem;
  }

  :global(.room-page-toolbar__action) {
    block-size: 1.55rem;
    inline-size: 1.55rem;
    border-radius: 0.68rem;
    border: 1px solid transparent;
    color: color-mix(in srgb, var(--foreground), transparent 36%);
  }

  :global(.room-page-toolbar__action:hover:not(:disabled)),
  :global(.room-page-toolbar__action:focus-visible:not(:disabled)) {
    border-color: color-mix(in srgb, var(--border), transparent 15%);
    background: color-mix(in srgb, var(--background), transparent 8%);
    color: var(--foreground);
  }

  .room-page-toolbar__modes {
    flex: none;
    display: flex;
    align-items: center;
    gap: 0.22rem;
    min-block-size: 0;
    white-space: nowrap;
  }

  .room-page-toolbar__mode-chip {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-block-size: 1.45rem;
    border-radius: 999px;
    border: 1px solid color-mix(in srgb, var(--border), transparent 20%);
    background: color-mix(in srgb, var(--background), transparent 14%);
    padding-inline: 0.44rem;
    color: color-mix(in srgb, var(--foreground), transparent 30%);
    font-size: 0.64rem;
    font-weight: 700;
    letter-spacing: 0.01em;
    text-transform: capitalize;
    transition:
      background-color 120ms ease,
      border-color 120ms ease,
      color 120ms ease;
  }

  .room-page-toolbar__mode-chip[data-active="true"] {
    border-color: color-mix(in srgb, var(--foreground), transparent 68%);
    background: color-mix(in srgb, var(--foreground), transparent 92%);
    color: var(--foreground);
  }

  @container (max-width: 43.999rem) {
    .room-page-toolbar {
      padding-inline: 0.55rem;
    }

    :global(.room-page-toolbar__avatar-image) {
      block-size: 1.6rem;
      inline-size: 1.6rem;
      border-radius: 0.72rem;
    }

    :global(.room-page-toolbar__viewer-trigger),
    .room-page-toolbar__viewer-fallback {
      font-size: 0.72rem;
    }

    .room-page-toolbar__secondary {
      gap: 0.25rem;
    }

    :global(.room-page-toolbar__action) {
      block-size: 1.45rem;
      inline-size: 1.45rem;
      border-radius: 0.65rem;
    }

    .room-page-toolbar__mode-chip {
      min-block-size: 1.35rem;
      padding-inline: 0.38rem;
      font-size: 0.61rem;
    }
  }

  @container (max-width: 31.999rem) {
    .room-page-toolbar {
      gap: 0.45rem;
      padding-inline: 0.48rem;
    }

    .room-page-toolbar__identity {
      gap: 0.4rem;
    }

    .room-page-toolbar__modes {
      gap: 0.18rem;
    }

    .room-page-toolbar__mode-chip {
      padding-inline: 0.34rem;
    }
  }
</style>
