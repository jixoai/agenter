<script lang="ts">
  import FileIcon from "@lucide/svelte/icons/file";
  import ImageIcon from "@lucide/svelte/icons/image";
  import MessageSquareDot from "@lucide/svelte/icons/message-square-dot";

  import {
    getResourceIconExtensionScale,
    normalizeResourceIconExtension,
    normalizeResourceIconNumber,
    type ResourceIconNumber,
  } from "./resource-icon-number";

  export type ResourceIconWithNumberKind = "comment" | "file" | "image";
  export type ResourceIconWithNumberSize = "inline" | "tile";

  let {
    kind,
    number = "*",
    extension,
    fileName,
    size = "tile",
    class: className = "",
  }: {
    kind: ResourceIconWithNumberKind;
    number?: ResourceIconNumber | string | number;
    extension?: string | null | undefined;
    fileName?: string | null | undefined;
    size?: ResourceIconWithNumberSize;
    class?: string;
  } = $props();

  const displayNumber = $derived(normalizeResourceIconNumber(number));
  const extensionLabel = $derived(normalizeResourceIconExtension(extension, fileName));
  const extensionScale = $derived(getResourceIconExtensionScale(extensionLabel));
</script>

<span
  class={`resource-icon-with-number ${className}`.trim()}
  data-kind={kind}
  data-size={size}
  data-resource-number={displayNumber}
  part="resource-icon-with-number"
  aria-hidden="true"
>
  {#if kind === "comment"}
    <MessageSquareDot class="resource-icon-base resource-icon-comment-base" />
    <span class="resource-icon-comment-number">{displayNumber}</span>
  {:else if kind === "image"}
    <ImageIcon class="resource-icon-base resource-icon-image-base" />
    <span class="resource-icon-image-number-badge">
      <span class="resource-icon-image-number">{displayNumber}</span>
    </span>
  {:else}
    <FileIcon class="resource-icon-base resource-icon-file-base" />
    <span class="resource-icon-file-number">{displayNumber}</span>
    <span class="resource-icon-file-extension-badge">
      <span class="resource-icon-file-extension" style={`--resource-icon-extension-width-scale: ${extensionScale}`}>
        {extensionLabel}
      </span>
    </span>
  {/if}
</span>

<style>
  .resource-icon-with-number {
    --resource-icon-size: var(--resource-icon-tile-size, 1.5rem);
    --resource-icon-default-ink: #111827;
    --resource-icon-default-surface: #f2f2f7;
    --resource-icon-default-border: rgba(60, 60, 67, 0.16);
    --resource-icon-default-badge-surface: color-mix(in srgb, white 82%, var(--resource-icon-surface-resolved) 18%);
    --resource-icon-surface-resolved: var(--resource-icon-surface, var(--resource-icon-default-surface));
    --resource-icon-ink-resolved: var(--resource-icon-ink, var(--resource-icon-default-ink));
    --resource-icon-border-resolved: var(--resource-icon-border, var(--resource-icon-default-border));
    --resource-icon-badge-surface-resolved: var(
      --resource-icon-badge-surface,
      var(--resource-icon-default-badge-surface)
    );
    --resource-icon-badge-border-resolved: var(
      --resource-icon-badge-border,
      color-mix(in srgb, var(--resource-icon-ink-resolved) 20%, transparent)
    );
    --resource-icon-number-scale: 0.82;
    --resource-icon-comment-number-scale: var(--resource-icon-number-scale);
    --resource-icon-file-number-scale: var(--resource-icon-number-scale);
    --resource-icon-image-number-scale: 0.46;
    --resource-icon-file-extension-scale: 0.24;
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    width: var(--resource-icon-size);
    height: var(--resource-icon-size);
    min-width: var(--resource-icon-size);
    min-height: var(--resource-icon-size);
    border: 1px solid var(--resource-icon-border-resolved);
    border-radius: 11px;
    background: var(--resource-icon-surface-resolved);
    color: var(--resource-icon-ink-resolved);
    font-family: var(--font-sans, system-ui, sans-serif);
    font-variant-numeric: tabular-nums;
    line-height: 1;
    overflow: hidden;
    vertical-align: middle;
  }

  .resource-icon-with-number[data-size="inline"] {
    --resource-icon-size: 1.16em;
    --resource-icon-number-scale: 0.58;
    --resource-icon-image-number-scale: 0.28;
    --resource-icon-file-extension-scale: 0.15;
    min-width: var(--resource-icon-size);
    min-height: var(--resource-icon-size);
    border-radius: 0.33em;
    border-color: color-mix(in srgb, currentColor 20%, transparent);
    background: color-mix(in srgb, currentColor 8%, transparent);
    vertical-align: -0.18em;
  }

  .resource-icon-with-number[data-kind="comment"] {
    --resource-icon-default-ink: #0f172a;
    --resource-icon-default-surface:
      radial-gradient(circle at 50% 44%, rgba(255, 255, 255, 0.78), rgba(255, 255, 255, 0) 54%),
      linear-gradient(180deg, #fbfbfd 0%, #ececf4 100%);
  }

  .resource-icon-with-number[data-kind="file"] {
    --resource-icon-default-ink: #111827;
    --resource-icon-default-surface: #f2f2f7;
  }

  .resource-icon-with-number[data-kind="image"] {
    --resource-icon-default-ink: #334155;
    --resource-icon-default-surface: #e9edf5;
  }

  .resource-icon-base {
    width: calc(var(--resource-icon-size) * 0.68);
    height: calc(var(--resource-icon-size) * 0.68);
    stroke-width: 1.8;
  }

  .resource-icon-comment-base {
    width: calc(var(--resource-icon-size) * 0.7);
    height: calc(var(--resource-icon-size) * 0.7);
    opacity: 0.24;
    transform: translateY(calc(var(--resource-icon-size) * -0.025));
  }

  .resource-icon-comment-number {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    color: currentColor;
    font-size: 1rem;
    font-weight: 800;
    transform: translateY(calc(var(--resource-icon-size) * 0.018))
      scale(var(--resource-icon-comment-number-scale));
  }

  .resource-icon-image-base {
    width: calc(var(--resource-icon-size) * 0.66);
    height: calc(var(--resource-icon-size) * 0.66);
    opacity: 0.78;
  }

  .resource-icon-image-number-badge {
    position: absolute;
    top: calc(var(--resource-icon-size) * 0.1);
    right: calc(var(--resource-icon-size) * 0.1);
    display: flex;
    align-items: center;
    justify-content: center;
    width: calc(var(--resource-icon-size) * 0.38);
    height: calc(var(--resource-icon-size) * 0.38);
    border-radius: 999px;
    border: 1px solid var(--resource-icon-badge-border-resolved);
    background: var(--resource-icon-badge-surface-resolved);
    color: currentColor;
    box-shadow: 0 0 0 1px color-mix(in srgb, white 55%, transparent);
  }

  .resource-icon-image-number {
    color: currentColor;
    font-size: 1rem;
    font-weight: 800;
    line-height: 1;
    transform: scale(var(--resource-icon-image-number-scale));
  }

  .resource-icon-file-base {
    width: calc(var(--resource-icon-size) * 0.8);
    height: calc(var(--resource-icon-size) * 0.8);
    opacity: 0.48;
  }

  .resource-icon-file-number {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    color: currentColor;
    font-size: 1rem;
    font-weight: 850;
    line-height: 1;
    text-align: center;
    transform: translateY(calc(var(--resource-icon-size) * 0.018)) scale(var(--resource-icon-file-number-scale));
    z-index: 1;
  }

  .resource-icon-file-extension-badge {
    position: absolute;
    right: calc(var(--resource-icon-size) * 0.04);
    bottom: calc(var(--resource-icon-size) * 0.04);
    display: flex;
    align-items: center;
    justify-content: center;
    width: calc(var(--resource-icon-size) * 0.38);
    height: calc(var(--resource-icon-size) * 0.22);
    border: 1px solid var(--resource-icon-badge-border-resolved);
    border-radius: calc(var(--resource-icon-size) * 0.07);
    background: var(--resource-icon-badge-surface-resolved);
    color: currentColor;
    overflow: hidden;
    padding-inline: calc(var(--resource-icon-size) * 0.01);
    z-index: 2;
  }

  .resource-icon-file-extension {
    position: absolute;
    top: 50%;
    left: 50%;
    max-width: none;
    color: currentColor;
    display: block;
    font-size: 1rem;
    font-weight: 800;
    letter-spacing: 0;
    line-height: 1;
    text-transform: uppercase;
    transform: translate(-50%, -50%) scale(var(--resource-icon-file-extension-scale))
      scaleX(var(--resource-icon-extension-width-scale));
    transform-origin: center;
    white-space: nowrap;
  }

  .resource-icon-with-number[data-size="inline"] .resource-icon-image-number-badge {
    top: calc(var(--resource-icon-size) * 0.04);
    right: calc(var(--resource-icon-size) * 0.04);
    width: calc(var(--resource-icon-size) * 0.44);
    height: calc(var(--resource-icon-size) * 0.44);
  }

  .resource-icon-with-number[data-size="inline"] .resource-icon-file-extension-badge {
    right: 0;
    bottom: 0;
    width: calc(var(--resource-icon-size) * 0.38);
    height: calc(var(--resource-icon-size) * 0.22);
    border-radius: calc(var(--resource-icon-size) * 0.06);
  }
</style>
