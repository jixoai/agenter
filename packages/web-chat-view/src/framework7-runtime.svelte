<script lang="ts">
  import { App } from "./framework7-components";
  import { ensureFramework7 } from "./framework7";
  import { canInitializeFramework7Runtime } from "./framework7-host";

  ensureFramework7();
</script>

{#if canInitializeFramework7Runtime()}
  <div class="web-chat-f7-runtime" aria-hidden="true">
    <App theme="ios" routes={[]} />
  </div>
{/if}

<style>
  .web-chat-f7-runtime {
    position: fixed;
    inset: 0 auto auto 0;
    width: 0;
    height: 0;
    overflow: hidden;
    opacity: 0;
    pointer-events: none;
    z-index: -1;
  }
</style>
