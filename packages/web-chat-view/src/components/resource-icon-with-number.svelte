<script lang="ts">
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
  <svg
    class="resource-icon-layer resource-icon-base-layer"
    data-resource-icon-layer="base"
    viewBox="0 0 24 24"
    role="presentation"
    focusable="false"
  >
    {#if kind === "comment"}
      <g class="resource-icon-base resource-icon-comment-base">
        <path d="M5.2 4.7h13.6a2.1 2.1 0 0 1 2.1 2.1v9a2.1 2.1 0 0 1-2.1 2.1H9l-5.9 3.8V6.8a2.1 2.1 0 0 1 2.1-2.1Z" />
        <circle cx="17.35" cy="7.75" r="1.55" />
      </g>
    {:else if kind === "image"}
      <g class="resource-icon-base resource-icon-image-base">
        <rect x="4.25" y="4.25" width="15.5" height="15.5" rx="2.6" />
        <circle cx="8.85" cy="8.85" r="1.55" />
        <path d="m4.9 17.8 5.35-5.35 3.1 3.1 2.3-2.3 3.45 3.45" />
      </g>
    {:else}
      <g class="resource-icon-base resource-icon-file-base">
        <path d="M7.15 2.9h7.65l4.05 4.05v14.15H7.15a2 2 0 0 1-2-2V4.9a2 2 0 0 1 2-2Z" />
        <path d="M14.65 3.1v4.15h4.1" />
      </g>
    {/if}
  </svg>

  <svg
    class="resource-icon-layer resource-icon-info-layer"
    data-resource-icon-layer="info"
    viewBox="0 0 24 24"
    role="presentation"
    focusable="false"
  >
    {#if kind === "comment"}
      <text class="resource-icon-info-text resource-icon-comment-number" x="12" y="12.35">
        {displayNumber}
      </text>
    {:else if kind === "image"}
      <g class="resource-icon-image-number-badge">
        <circle class="resource-icon-image-number-badge-fill" cx="17.55" cy="6.45" r="4.05" />
        <text class="resource-icon-info-text resource-icon-image-number" x="17.55" y="6.55">
          {displayNumber}
        </text>
      </g>
    {:else}
      <text class="resource-icon-info-text resource-icon-file-number" x="12" y="12.5">
        {displayNumber}
      </text>
      <g class="resource-icon-file-extension-badge">
        <rect class="resource-icon-file-extension-badge-fill" x="16.1" y="18.35" width="7" height="4.65" rx="1.05" />
        <text
          class="resource-icon-info-text resource-icon-file-extension"
          x="19.6"
          y="20.75"
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

  .resource-icon-layer {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    display: block;
    color: currentColor;
    pointer-events: none;
  }

  .resource-icon-base {
    fill: none;
    stroke: currentColor;
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-width: 1.75;
  }

  .resource-icon-comment-base {
    opacity: 0.24;
    transform: translateY(-0.6px);
  }

  .resource-icon-image-base {
    opacity: 0.78;
  }

  .resource-icon-file-base {
    opacity: 0.48;
  }

  .resource-icon-info-layer {
    overflow: visible;
  }

  .resource-icon-info-text {
    fill: currentColor;
    font-family: var(--font-sans, system-ui, sans-serif);
    font-size: 1rem;
    font-weight: 800;
    line-height: 1;
    dominant-baseline: middle;
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
    stroke: var(--resource-icon-badge-border-resolved);
    stroke-width: 1;
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
    stroke: var(--resource-icon-badge-border-resolved);
    stroke-width: 1;
  }

  .resource-icon-file-extension {
    font-weight: 800;
    text-transform: uppercase;
    transform: scale(var(--resource-icon-file-extension-scale)) scaleX(var(--resource-icon-extension-width-scale));
  }

  .resource-icon-with-number[data-size="inline"] .resource-icon-file-extension-badge {
    transform: translate(0.75px, 0.55px);
  }
</style>
