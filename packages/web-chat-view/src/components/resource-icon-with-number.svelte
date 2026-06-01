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
    <MessageSquareDot
      class="resource-icon-layer resource-icon-base-layer resource-icon-base resource-icon-comment-base"
      data-resource-icon-layer="base"
      size={24}
      strokeWidth={2}
      role="presentation"
      focusable="false"
    />
  {:else if kind === "image"}
    <ImageIcon
      class="resource-icon-layer resource-icon-base-layer resource-icon-base resource-icon-image-base"
      data-resource-icon-layer="base"
      size={24}
      strokeWidth={2}
      role="presentation"
      focusable="false"
    />
  {:else}
    <FileIcon
      class="resource-icon-layer resource-icon-base-layer resource-icon-base resource-icon-file-base"
      data-resource-icon-layer="base"
      size={24}
      strokeWidth={2}
      role="presentation"
      focusable="false"
    />
  {/if}

  <svg
    class={`resource-icon-layer resource-icon-info-layer ${kind === "file" ? "resource-icon-file-info-layer" : ""}`.trim()}
    data-resource-icon-layer="info"
    viewBox="0 0 24 24"
    role="presentation"
    focusable="false"
  >
    {#if kind === "comment"}
      <text class="resource-icon-info-text resource-icon-comment-number" x="10.2" y="11">
        {displayNumber}
      </text>
    {:else if kind === "image"}
      <g class="resource-icon-image-number-badge">
        <circle class="resource-icon-image-number-badge-fill" cx="18" cy="6" r="4.2" />
        <text class="resource-icon-info-text resource-icon-image-number" x="18" y="5.8">
          {displayNumber}
        </text>
      </g>
    {:else}
      <text class="resource-icon-info-text resource-icon-file-number" x="12" y="13.84">
        {displayNumber}
      </text>
      <g class="resource-icon-file-extension-badge">
        <rect class="resource-icon-file-extension-badge-fill" x="12" y="19.6" width="8.8" height="3.84" rx="0.84" />
        <text
          class="resource-icon-info-text resource-icon-file-extension"
          x="16.4"
          y="21.36"
          style={`--resource-icon-extension-width-scale: ${extensionScale}`}
        >
          {extensionLabel}
        </text>
      </g>
    {/if}
  </svg>
</span>

<style>
  .resource-icon-with-number {
    --resource-icon-size: var(--resource-icon-tile-size, 1.5rem);
    --resource-icon-width: var(--resource-icon-size);
    --resource-icon-height: var(--resource-icon-size);
    --resource-icon-border-radius: 11px;
    --resource-icon-effective-radius: min(
      var(--resource-icon-border-radius),
      var(--resource-icon-width),
      var(--resource-icon-height)
    );
    --resource-icon-safe-padding: calc(var(--resource-icon-effective-radius) / 4);
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
    --resource-icon-comment-number-scale: 0.66;
    --resource-icon-file-number-scale: 0.656;
    --resource-icon-image-number-scale: 0.46;
    --resource-icon-file-extension-scale: 0.24;
    --resource-icon-base-opacity: 0.62;
    --resource-icon-base-layer-z-index: 0;
    --resource-icon-info-layer-z-index: 1;
    display: inline-grid;
    grid-template-areas: "resource-icon-layer";
    place-items: center;
    box-sizing: border-box;
    width: var(--resource-icon-width);
    height: var(--resource-icon-height);
    min-width: var(--resource-icon-width);
    min-height: var(--resource-icon-height);
    padding: var(--resource-icon-safe-padding);
    border: 1px solid var(--resource-icon-border-resolved);
    border-radius: var(--resource-icon-border-radius);
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
    --resource-icon-border-radius: 0.33em;
    --resource-icon-comment-number-scale: 0.46;
    --resource-icon-image-number-scale: 0.28;
    --resource-icon-file-extension-scale: 0.152;
    min-width: var(--resource-icon-size);
    min-height: var(--resource-icon-size);
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

  .resource-icon-with-number :global(.resource-icon-layer) {
    grid-area: resource-icon-layer;
    width: 100%;
    height: 100%;
    display: block;
    color: currentColor;
    pointer-events: none;
  }

  .resource-icon-with-number :global(.resource-icon-base) {
    color: currentColor;
    fill: none;
    opacity: var(--resource-icon-base-opacity);
    stroke: currentColor;
  }

  .resource-icon-with-number :global(.resource-icon-base-layer) {
    z-index: var(--resource-icon-base-layer-z-index);
  }

  .resource-icon-with-number :global(.resource-icon-info-layer) {
    overflow: visible;
    z-index: var(--resource-icon-info-layer-z-index);
  }

  .resource-icon-info-text {
    fill: currentColor;
    font-family: var(--font-sans, system-ui, sans-serif);
    font-size: 1rem;
    font-weight: 800;
    line-height: 1;
    dominant-baseline: central;
    text-anchor: middle;
    transform-box: fill-box;
    transform-origin: center;
    user-select: none;
  }

  .resource-icon-comment-number {
    transform: translateY(0.42px) scale(var(--resource-icon-comment-number-scale));
  }

  .resource-icon-image-number-badge-fill {
    fill: var(--resource-icon-badge-surface-resolved);
    stroke: currentColor;
    stroke-width: 0.5;
  }

  .resource-icon-image-number {
    transform: scale(var(--resource-icon-image-number-scale));
  }

  .resource-icon-file-number {
    font-weight: 850;
    transform: translateY(0.42px) scale(var(--resource-icon-file-number-scale));
  }

  .resource-icon-file-extension-badge-fill {
    fill: var(--resource-icon-badge-surface-resolved);
    stroke: currentColor;
    stroke-width: 0.5;
  }

  .resource-icon-file-extension {
    font-weight: 800;
    text-transform: uppercase;
    transform: scale(var(--resource-icon-file-extension-scale)) scaleX(var(--resource-icon-extension-width-scale));
  }
</style>
