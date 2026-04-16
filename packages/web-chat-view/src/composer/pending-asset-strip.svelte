<script lang="ts">
  import FileText from "@lucide/svelte/icons/file-text";
  import ImageIcon from "@lucide/svelte/icons/image";
  import Video from "@lucide/svelte/icons/video";
  import X from "@lucide/svelte/icons/x";

  import { formatAttachmentSize } from "../chat-attachment-utils";
  import { Button } from "../ui/button";
  import type { PendingAsset } from "./pending-assets";

  let {
    assets,
    onRemove,
  }: {
    assets: PendingAsset[];
    onRemove: (assetId: string) => void;
  } = $props();

  const mediaAssets = $derived(assets.filter((asset) => asset.kind === "image" || asset.kind === "video"));
  const fileAssets = $derived(assets.filter((asset) => asset.kind !== "image" && asset.kind !== "video"));

  const iconFor = (kind: PendingAsset["kind"]) => {
    switch (kind) {
      case "image":
        return ImageIcon;
      case "video":
        return Video;
      default:
        return FileText;
    }
  };
</script>

{#if assets.length > 0}
  <div class="grid gap-3 px-1.5 pt-1.5 md:px-2" part="composer-assets">
    {#if mediaAssets.length > 0}
      <div class="pending-media-rail" part="composer-media-assets">
        {#each mediaAssets as asset (asset.id)}
          {@const AssetIcon = iconFor(asset.kind)}
          <article
            class="pending-media-card group"
            part="composer-asset"
            data-kind={asset.kind}
            data-layout="media"
          >
            <a
              href={asset.previewUrl}
              target="_blank"
              rel="noreferrer"
              class="pending-media-preview"
              title={`Preview ${asset.file.name}`}
            >
              {#if asset.kind === "image"}
                <img src={asset.previewUrl} alt={asset.file.name} class="pending-media-image" />
              {:else}
                <AssetIcon class="pending-media-icon" />
                <span class="pending-media-kind">
                  video
                </span>
              {/if}
              <span class="sr-only">
                {asset.file.name} · {asset.kind} · {formatAttachmentSize(asset.file.size)}
              </span>
            </a>

            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              class="pending-media-remove"
              title={`Remove ${asset.file.name}`}
              onclick={() => {
                onRemove(asset.id);
              }}
            >
              <X class="pending-media-remove-icon" />
            </Button>
          </article>
        {/each}
      </div>
    {/if}

    {#if fileAssets.length > 0}
      <div class="pending-file-list" part="composer-file-assets">
        {#each fileAssets as asset (asset.id)}
        {@const AssetIcon = iconFor(asset.kind)}
        <article
          class="pending-file-card group"
          part="composer-asset"
          data-kind={asset.kind}
          data-layout="file"
        >
          <a
            href={asset.previewUrl}
            target="_blank"
            rel="noreferrer"
            class="pending-file-preview"
            title={`Preview ${asset.file.name}`}
          >
            {#if asset.kind === "image"}
              <img src={asset.previewUrl} alt={asset.file.name} class="pending-file-image" />
            {:else}
              <AssetIcon class="pending-file-icon" />
              {#if asset.kind === "video"}
                <span class="pending-file-kind">
                  video
                </span>
              {/if}
            {/if}
          </a>
          <div class="flex min-w-0 flex-1 items-start gap-2 px-3 py-2.5">
            <div class="min-w-0 flex-1">
              <div class="truncate text-sm font-semibold text-slate-900">{asset.file.name}</div>
              <div class="mt-1 inline-flex items-center gap-1 text-[11px] text-slate-500">
                <AssetIcon class="size-3.5 shrink-0" />
                <span class="truncate">{asset.kind}</span>
                <span>·</span>
                <span>{formatAttachmentSize(asset.file.size)}</span>
              </div>
            </div>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              class="rounded-full text-slate-500 hover:text-slate-900"
              title={`Remove ${asset.file.name}`}
              onclick={() => {
                onRemove(asset.id);
              }}
            >
              <X class="size-4" />
            </Button>
          </div>
        </article>
        {/each}
      </div>
    {/if}
  </div>
{/if}

<style>
  .pending-media-rail {
    display: flex;
    align-items: flex-start;
    gap: 0.625rem;
    overflow-x: auto;
    padding-bottom: 0.2rem;
    scrollbar-width: thin;
  }

  .pending-media-card {
    display: block;
    position: relative;
    width: 5.25rem;
    flex: 0 0 auto;
  }

  .pending-media-preview {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    inline-size: 100%;
    aspect-ratio: 1;
    overflow: hidden;
    border: 0;
    border-radius: 0.78rem;
    color: white;
    background:
      radial-gradient(circle at top, rgba(148, 163, 184, 0.14), transparent 56%),
      rgba(15, 23, 42, 0.96);
    box-shadow: none;
  }

  .pending-media-image {
    display: block;
    inline-size: 100%;
    block-size: 100%;
    object-fit: cover;
    object-position: top;
  }

  :global(.pending-media-icon) {
    width: 1.5rem;
    height: 1.5rem;
  }

  .pending-media-kind {
    position: absolute;
    right: 0.5rem;
    bottom: 0.5rem;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.16);
    padding: 0.125rem 0.375rem;
    font-size: 0.5625rem;
    font-weight: 600;
    letter-spacing: 0.18em;
    text-transform: uppercase;
  }

  :global(.pending-media-remove) {
    position: absolute;
    top: 0.35rem;
    right: 0.35rem;
    z-index: 1;
    width: 1.25rem;
    height: 1.25rem;
    border-radius: 0.6rem;
    border: 0;
    background: rgba(15, 23, 42, 0.78);
    padding: 0;
    color: white;
    box-shadow: none;
    backdrop-filter: blur(16px);
  }

  :global(.pending-media-remove:hover) {
    background: rgba(15, 23, 42, 0.88);
    color: white;
  }

  :global(.pending-media-remove-icon) {
    width: 0.75rem;
    height: 0.75rem;
  }

  .pending-file-list {
    display: grid;
    gap: 0.75rem;
  }

  .pending-file-card {
    display: grid;
    grid-template-columns: 5.5rem minmax(0, 1fr);
    min-width: 0;
    max-width: 100%;
    align-items: stretch;
    overflow: hidden;
    border: 0;
    border-radius: 0.82rem;
    background: rgba(248, 250, 252, 0.78);
    box-shadow: none;
  }

  .pending-file-preview {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    inline-size: 100%;
    block-size: 100%;
    min-block-size: 5.5rem;
    aspect-ratio: 1;
    overflow: hidden;
    background: rgba(15, 23, 42, 0.96);
    color: white;
  }

  .pending-file-image {
    display: block;
    inline-size: 100%;
    block-size: 100%;
    object-fit: cover;
  }

  :global(.pending-file-icon) {
    width: 1.25rem;
    height: 1.25rem;
  }

  .pending-file-kind {
    position: absolute;
    right: 0.25rem;
    bottom: 0.25rem;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.16);
    padding: 0.125rem 0.375rem;
    font-size: 0.5625rem;
    font-weight: 600;
    letter-spacing: 0.18em;
    text-transform: uppercase;
  }

  @container (max-width: 34rem) {
    .pending-media-card {
      width: 4.5rem;
    }
  }
</style>
