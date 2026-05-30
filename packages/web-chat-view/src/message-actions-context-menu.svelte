<script lang="ts">
  import Framework7ActionSurface from "./framework7-action-surface.svelte";
  import type { Framework7ActionSurfaceAnchor } from "./framework7-action-surface-types";
  import type { ResolvedMessageAction } from "./message-actions-menu.svelte";

  let {
    actions,
    title = "Message actions",
    open = $bindable(false),
    anchorX = null,
    anchorY = null,
  }: {
    actions: readonly ResolvedMessageAction[];
    title?: string;
    open?: boolean;
    anchorX?: number | null;
    anchorY?: number | null;
  } = $props();

  const actionAnchor = $derived.by((): Framework7ActionSurfaceAnchor | null =>
    anchorX === null || anchorY === null
      ? null
      : {
          targetX: anchorX,
          targetY: anchorY,
          targetWidth: 1,
          targetHeight: 1,
        },
  );
</script>

<Framework7ActionSurface bind:open actions={actions} {title} anchor={actionAnchor} />
