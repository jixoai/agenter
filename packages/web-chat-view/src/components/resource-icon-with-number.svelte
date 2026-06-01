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
    <span class="resource-icon-image-number">{displayNumber}</span>
  {:else}
    <FileIcon class="resource-icon-base resource-icon-file-base" />
    <span class="resource-icon-file-copy">
      <span class="resource-icon-file-extension" style={`--resource-icon-extension-scale: ${extensionScale}`}>
        {extensionLabel}
      </span>
      <span class="resource-icon-file-number">{displayNumber}</span>
    </span>
  {/if}
</span>

<style>
  .resource-icon-with-number {
    --resource-icon-size: var(--resource-icon-tile-size, 2.28rem);
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    width: var(--resource-icon-size);
    height: var(--resource-icon-size);
    min-width: var(--resource-icon-size);
    min-height: var(--resource-icon-size);
    border: 1px solid rgba(60, 60, 67, 0.16);
    border-radius: 11px;
    background: #f2f2f7;
    color: #111827;
    font-family: var(--font-sans, system-ui, sans-serif);
    font-variant-numeric: tabular-nums;
    line-height: 1;
    overflow: hidden;
    vertical-align: middle;
  }

  .resource-icon-with-number[data-size="inline"] {
    --resource-icon-size: 1.16em;
    min-width: var(--resource-icon-size);
    min-height: var(--resource-icon-size);
    border-radius: 0.33em;
    border-color: color-mix(in srgb, currentColor 20%, transparent);
    background: color-mix(in srgb, currentColor 8%, transparent);
    vertical-align: -0.18em;
  }

  .resource-icon-with-number[data-kind="comment"] {
    background:
      radial-gradient(circle at 50% 44%, rgba(255, 255, 255, 0.78), rgba(255, 255, 255, 0) 54%),
      linear-gradient(180deg, #fbfbfd 0%, #ececf4 100%);
    color: #0f172a;
  }

  .resource-icon-with-number[data-kind="file"] {
    background: #f2f2f7;
    color: #111827;
  }

  .resource-icon-with-number[data-kind="image"] {
    background: #e9edf5;
    color: #475569;
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
    color: #0f172a;
    font-size: calc(var(--resource-icon-size) * 0.36);
    font-weight: 800;
    transform: translateY(calc(var(--resource-icon-size) * 0.018));
  }

  .resource-icon-image-base {
    width: calc(var(--resource-icon-size) * 0.66);
    height: calc(var(--resource-icon-size) * 0.66);
    opacity: 0.78;
  }

  .resource-icon-image-number {
    position: absolute;
    top: calc(var(--resource-icon-size) * 0.1);
    right: calc(var(--resource-icon-size) * 0.1);
    display: flex;
    align-items: center;
    justify-content: center;
    width: calc(var(--resource-icon-size) * 0.38);
    height: calc(var(--resource-icon-size) * 0.38);
    border-radius: 999px;
    background: #0f172a;
    color: white;
    font-size: calc(var(--resource-icon-size) * 0.21);
    font-weight: 800;
    box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.82);
  }

  .resource-icon-file-base {
    width: calc(var(--resource-icon-size) * 0.8);
    height: calc(var(--resource-icon-size) * 0.8);
    opacity: 0.48;
  }

  .resource-icon-file-copy {
    position: absolute;
    inset: calc(var(--resource-icon-size) * 0.2) calc(var(--resource-icon-size) * 0.16)
      calc(var(--resource-icon-size) * 0.14);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: calc(var(--resource-icon-size) * 0.02);
    color: #0f172a;
    text-align: center;
  }

  .resource-icon-file-extension {
    max-width: 100%;
    color: #334155;
    font-size: calc(var(--resource-icon-size) * 0.18);
    font-weight: 800;
    letter-spacing: 0;
    line-height: 0.9;
    text-transform: uppercase;
    transform: scaleX(var(--resource-icon-extension-scale));
    transform-origin: center;
    white-space: nowrap;
  }

  .resource-icon-file-number {
    font-size: calc(var(--resource-icon-size) * 0.31);
    font-weight: 850;
    line-height: 0.95;
  }

  .resource-icon-with-number[data-size="inline"] .resource-icon-image-number {
    top: calc(var(--resource-icon-size) * 0.04);
    right: calc(var(--resource-icon-size) * 0.04);
    width: calc(var(--resource-icon-size) * 0.44);
    height: calc(var(--resource-icon-size) * 0.44);
    font-size: calc(var(--resource-icon-size) * 0.24);
  }
</style>
