<script lang="ts">
  import type { Snippet } from "svelte";

  let { page }: { page: Snippet } = $props();
</script>

{@render page()}
