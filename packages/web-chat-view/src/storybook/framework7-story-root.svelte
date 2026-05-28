<script lang="ts">
  import { App } from "../framework7-components";
  import { ensureFramework7 } from "../framework7";

  let {
    width = 390,
    height = 844,
    background = "#f2f2f7",
    children,
  }: {
    width?: number;
    height?: number;
    background?: string;
    children?: import("svelte").Snippet;
  } = $props();

  ensureFramework7();
</script>

<div class="story-shell" style={`--story-width:${width}px; --story-height:${height}px; --story-background:${background};`}>
  <div class="story-device">
    <App theme="ios">
      {@render children?.()}
    </App>
  </div>
</div>

<style>
  .story-shell {
    display: grid;
    place-items: center;
    width: 100%;
    min-height: 100%;
    padding: 1.5rem;
    background:
      radial-gradient(circle at top, rgba(255, 255, 255, 0.96), rgba(244, 244, 248, 1) 46%, rgba(232, 235, 241, 1));
  }

  .story-device {
    width: var(--story-width);
    height: var(--story-height);
    overflow: hidden;
    border-radius: 32px;
    background: var(--story-background);
    box-shadow:
      0 18px 42px rgba(15, 23, 42, 0.14),
      inset 0 0 0 1px rgba(255, 255, 255, 0.72);
  }

  .story-device :global(.framework7-root) {
    width: 100%;
    height: 100%;
    background: var(--story-background);
  }
</style>
