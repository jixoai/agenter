<script lang="ts">
  import Framework7ActionSurface from "./framework7-action-surface.svelte";
  import type {
    Framework7ActionSurfaceAnchor,
    Framework7ActionSurfaceItem,
  } from "./framework7-action-surface-types";

  let {
    open = $bindable(false),
    selectedText,
    targetEl = undefined,
    onCopy,
    onShare,
    onComment,
  }: {
    open?: boolean;
    selectedText: string;
    targetEl?: HTMLElement | null | undefined;
    onCopy?: (() => void | Promise<void>) | undefined;
    onShare?: (() => void | Promise<void>) | undefined;
    onComment?: (() => void | Promise<void>) | undefined;
  } = $props();

  const hasSelection = $derived(selectedText.trim().length > 0);

  const run = async (callback: (() => void | Promise<void>) | undefined): Promise<void> => {
    if (!callback) {
      return;
    }
    await callback();
    open = false;
  };

  const actionAnchor = $derived.by((): Framework7ActionSurfaceAnchor | null => (targetEl ? { targetEl } : null));
  const actions = $derived.by(
    (): readonly Framework7ActionSurfaceItem[] => [
      {
        id: "copy",
        label: "Copy",
        disabled: !hasSelection,
        onSelect: () => run(onCopy),
      },
      {
        id: "share",
        label: "Share",
        disabled: !hasSelection,
        onSelect: () => run(onShare),
      },
      {
        id: "comment",
        label: "Comment",
        disabled: !hasSelection,
        onSelect: () => run(onComment),
      },
    ],
  );
</script>

<Framework7ActionSurface bind:open {actions} title="Selection actions" anchor={actionAnchor} />
