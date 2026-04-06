<script lang="ts">
  import { ScrollView } from "@agenter/svelte-components";
  import ClapperboardIcon from "@lucide/svelte/icons/clapperboard";
  import DownloadIcon from "@lucide/svelte/icons/download";
  import FileIcon from "@lucide/svelte/icons/file";
  import ImageIcon from "@lucide/svelte/icons/image";

  import ProfileAvatar from "$lib/components/profile-avatar.svelte";

  import type { CachedResourceState } from "@agenter/client-sdk";

  import type { MessageSystemRoomAssetItem } from "./message-system-surface.types";

  let {
    state,
  }: {
    state: CachedResourceState<MessageSystemRoomAssetItem[]>;
  } = $props();

  const formatBytes = (value: number): string => {
    if (value < 1024) {
      return `${value} B`;
    }
    if (value < 1024 * 1024) {
      return `${(value / 1024).toFixed(1)} KB`;
    }
    if (value < 1024 * 1024 * 1024) {
      return `${(value / (1024 * 1024)).toFixed(1)} MB`;
    }
    return `${(value / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  const formatTimestamp = (value: number): string => new Date(value).toLocaleString();
</script>

{#if state.loading && state.data.length === 0}
  <div class="room-assets-pane__empty" data-testid="room-assets-pane-loading">
    <h2>Loading room assets...</h2>
    <p>Fetching durable uploads for this room.</p>
  </div>
{:else if state.error && state.data.length === 0}
  <div class="room-assets-pane__empty" data-testid="room-assets-pane-error">
    <h2>Unable to load room assets</h2>
    <p>{state.error}</p>
  </div>
{:else if state.data.length === 0}
  <div class="room-assets-pane__empty" data-testid="room-assets-pane-empty">
    <h2>No assets yet</h2>
    <p>Files, images, and screenshots sent into this room will appear here.</p>
  </div>
{:else}
  <ScrollView
    class="h-full"
    contentClass="room-assets-pane__content"
    viewportTestId="room-assets-pane-viewport"
  >
    {#if state.error}
      <div class="room-assets-pane__notice" data-testid="room-assets-pane-notice">{state.error}</div>
    {/if}

    {#each state.data as asset (asset.assetId)}
      <a
        class="room-assets-pane__row"
        href={asset.url}
        target="_blank"
        rel="noreferrer"
        data-testid={`room-asset-row-${asset.assetId}`}
      >
        <div class="room-assets-pane__kind" aria-hidden="true">
          {#if asset.kind === "image"}
            <ImageIcon class="size-4" />
          {:else if asset.kind === "video"}
            <ClapperboardIcon class="size-4" />
          {:else}
            <FileIcon class="size-4" />
          {/if}
        </div>

        <div class="room-assets-pane__main">
          <div class="room-assets-pane__title-row">
            <span class="room-assets-pane__name">{asset.name}</span>
            <span class="room-assets-pane__meta">{asset.mimeType}</span>
          </div>

          <div class="room-assets-pane__facts">
            <span>{formatBytes(asset.sizeBytes)}</span>
            <span>{formatTimestamp(asset.createdAt)}</span>
          </div>

          <div class="room-assets-pane__uploader">
            <ProfileAvatar
              label={asset.uploaderLabel}
              src={asset.uploaderIconUrl ?? null}
              class="room-assets-pane__uploader-avatar"
            />
            <div class="min-w-0">
              <div class="room-assets-pane__uploader-name">{asset.uploaderLabel}</div>
              <div class="room-assets-pane__uploader-subtitle">
                {asset.uploaderSubtitle ?? "Uploader unavailable"}
              </div>
            </div>
          </div>
        </div>

        <div class="room-assets-pane__download" aria-hidden="true">
          <DownloadIcon class="size-4" />
        </div>
      </a>
    {/each}
  </ScrollView>
{/if}

<style>
  .room-assets-pane__empty {
    display: grid;
    place-content: center;
    gap: 0.45rem;
    block-size: 100%;
    min-block-size: 0;
    padding: 2rem;
    text-align: center;
  }

  .room-assets-pane__empty h2 {
    font-size: 1rem;
    font-weight: 600;
    color: var(--foreground);
  }

  .room-assets-pane__empty p {
    color: var(--muted-foreground);
  }

  :global(.room-assets-pane__content) {
    display: grid;
    gap: 0.75rem;
    padding: 0.9rem;
  }

  .room-assets-pane__notice {
    border-radius: 1rem;
    border: 1px solid color-mix(in srgb, var(--destructive), transparent 62%);
    background: color-mix(in srgb, var(--destructive), transparent 94%);
    padding: 0.75rem 0.9rem;
    color: color-mix(in srgb, var(--destructive), black 18%);
    font-size: 0.88rem;
  }

  .room-assets-pane__row {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    gap: 0.85rem;
    align-items: start;
    border-radius: 1.15rem;
    border: 1px solid color-mix(in srgb, var(--border), transparent 18%);
    background: color-mix(in srgb, var(--card), white 4%);
    padding: 0.9rem;
    color: inherit;
    text-decoration: none;
    box-shadow:
      inset 0 1px 0 color-mix(in srgb, var(--background), white 78%),
      0 20px 36px -34px color-mix(in srgb, var(--foreground), transparent 22%);
    transition:
      border-color 120ms ease,
      background-color 120ms ease,
      transform 120ms ease;
  }

  .room-assets-pane__row:hover,
  .room-assets-pane__row:focus-visible {
    border-color: color-mix(in srgb, var(--foreground), transparent 74%);
    background: color-mix(in srgb, var(--card), white 8%);
    transform: translateY(-1px);
  }

  .room-assets-pane__kind {
    display: grid;
    place-items: center;
    block-size: 2.1rem;
    inline-size: 2.1rem;
    border-radius: 0.9rem;
    border: 1px solid color-mix(in srgb, var(--border), transparent 18%);
    background: color-mix(in srgb, var(--background), transparent 8%);
    color: color-mix(in srgb, var(--foreground), transparent 28%);
  }

  .room-assets-pane__main {
    display: grid;
    gap: 0.45rem;
    min-inline-size: 0;
  }

  .room-assets-pane__title-row,
  .room-assets-pane__facts,
  .room-assets-pane__uploader {
    display: flex;
    min-inline-size: 0;
    align-items: center;
    gap: 0.55rem;
    flex-wrap: wrap;
  }

  .room-assets-pane__name {
    min-inline-size: 0;
    font-size: 0.94rem;
    font-weight: 600;
    color: var(--foreground);
  }

  .room-assets-pane__meta,
  .room-assets-pane__facts,
  .room-assets-pane__uploader-subtitle {
    color: var(--muted-foreground);
    font-size: 0.78rem;
  }

  :global(.room-assets-pane__uploader-avatar) {
    block-size: 1.55rem;
    inline-size: 1.55rem;
    border-radius: 0.72rem;
  }

  .room-assets-pane__uploader-name {
    font-size: 0.82rem;
    font-weight: 600;
    color: var(--foreground);
  }

  .room-assets-pane__download {
    display: grid;
    place-items: center;
    color: color-mix(in srgb, var(--foreground), transparent 42%);
  }

  @container (max-width: 43.999rem) {
    :global(.room-assets-pane__content) {
      padding: 0.7rem;
    }

    .room-assets-pane__row {
      gap: 0.7rem;
      padding: 0.8rem;
    }
  }
</style>
