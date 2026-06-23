<script lang="ts">
  import MessageSquareDot from "@lucide/svelte/icons/message-square-dot";
  import { onMount } from "svelte";
  import type { Action } from "svelte/action";

  import { Link } from "./framework7-components";
  import { WEB_CHAT_CLOSE_COMMENT_ACTION_POPOVERS_EVENT } from "./message-comment-action-events";

  /**
   * Viewport-space comment affordance anchor. `x`/`y` are the action origin:
   * selected text center or context-menu point.
   */
  export interface MessageCommentActionAnchor {
    x: number;
    y: number;
    width: number;
    height: number;
  }

  let {
    open = $bindable(false),
    anchor = null,
    disabled = false,
    onComment,
  }: {
    open?: boolean;
    anchor?: MessageCommentActionAnchor | null;
    disabled?: boolean;
    onComment?: (() => void | Promise<void>) | undefined;
  } = $props();

  let ignoreNextExternalClose = false;
  const anchorStyle = $derived.by(() => {
    if (!anchor) {
      return "";
    }
    const width = Math.max(1, Math.round(anchor.width));
    return [
      `--message-comment-action-x: ${Math.round(anchor.x)}px`,
      `--message-comment-action-y: ${Math.round(anchor.y)}px`,
      `--message-comment-action-anchor-left: ${Math.round(anchor.x - width / 2)}px`,
      `--message-comment-action-width: ${width}px`,
      `--message-comment-action-height: ${Math.max(1, Math.round(anchor.height))}px`,
    ].join("; ");
  });

  const runComment = async (event: MouseEvent): Promise<void> => {
    event.preventDefault();
    event.stopPropagation();
    if (disabled) {
      return;
    }
    await onComment?.();
    open = false;
  };

  const portalToBody: Action<HTMLElement> = (node) => {
    if (typeof document === "undefined") {
      return {};
    }
    document.body.append(node);
    return {
      destroy: () => {
        node.remove();
      },
    };
  };

  $effect(() => {
    if (open) {
      ignoreNextExternalClose = true;
      queueMicrotask(() => {
        ignoreNextExternalClose = false;
      });
    }
  });

  onMount(() => {
    const handleExternalClose = (): void => {
      if (ignoreNextExternalClose) {
        return;
      }
      open = false;
    };
    const handleDocumentPointerDown = (event: PointerEvent): void => {
      if (!open) {
        return;
      }
      const target = event.target;
      if (target instanceof Element && target.closest("[data-testid='message-comment-action-popover']")) {
        return;
      }
      open = false;
    };
    const handleDocumentKeydown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        open = false;
      }
    };
    window.addEventListener(WEB_CHAT_CLOSE_COMMENT_ACTION_POPOVERS_EVENT, handleExternalClose);
    document.addEventListener("pointerdown", handleDocumentPointerDown);
    document.addEventListener("keydown", handleDocumentKeydown);
    return () => {
      window.removeEventListener(WEB_CHAT_CLOSE_COMMENT_ACTION_POPOVERS_EVENT, handleExternalClose);
      document.removeEventListener("pointerdown", handleDocumentPointerDown);
      document.removeEventListener("keydown", handleDocumentKeydown);
    };
  });
</script>

{#if open && anchor}
  {#snippet actionButton()}
    <Link
      href="#"
      iconOnly
      class="message-comment-action-button"
      data-testid="message-comment-action"
      aria-label="Comment on selection"
      title="Comment"
      aria-disabled={disabled}
      onclick={(event: MouseEvent) => {
        void runComment(event);
      }}
    >
      <MessageSquareDot class="message-comment-action-icon" />
    </Link>
  {/snippet}

  <div use:portalToBody class="message-comment-action-layer" style={anchorStyle}>
    <span class="message-comment-action-anchor" aria-hidden="true"></span>
    <div class="message-comment-action-popover message-comment-action-popover-fallback" data-testid="message-comment-action-popover">
      {@render actionButton()}
    </div>
  </div>
{/if}

<style>
  .message-comment-action-layer {
    display: contents;
  }

  .message-comment-action-anchor {
    position: fixed;
    left: var(--message-comment-action-anchor-left);
    top: var(--message-comment-action-y);
    inline-size: var(--message-comment-action-width);
    block-size: var(--message-comment-action-height);
    pointer-events: none;
  }

  .message-comment-action-popover {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.22rem;
    border-radius: 999px;
    background: color-mix(in srgb, var(--f7-list-bg-color, #fff) 74%, transparent);
    box-shadow: 0 10px 26px rgba(15, 23, 42, 0.18);
    backdrop-filter: blur(14px);
  }

  .message-comment-action-popover-fallback {
    position: fixed;
    left: min(
      calc(100vw - 2.75rem),
      max(0.35rem, calc(var(--message-comment-action-x) - 1.1rem))
    );
    top: max(0.35rem, calc(var(--message-comment-action-y) - 2.4rem));
    z-index: 12500;
  }

  :global(.message-comment-action-button) {
    display: inline-flex;
    inline-size: 2rem;
    block-size: 2rem;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    color: var(--f7-theme-color, #007aff);
    text-decoration: none;
  }

  :global(.message-comment-action-button[aria-disabled="true"]) {
    opacity: 0.44;
    pointer-events: none;
  }

  :global(.message-comment-action-icon) {
    inline-size: 1rem;
    block-size: 1rem;
  }
</style>
