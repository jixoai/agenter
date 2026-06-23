<script lang="ts">
  import MoreHorizontal from "@lucide/svelte/icons/more-horizontal";
  import { onDestroy } from "svelte";
  import Framework7ActionSurface from "./framework7-action-surface.svelte";
  import type { Framework7ActionSurfaceAnchor } from "./framework7-action-surface-types";
  import MessageReadIndicator from "./message-read-indicator.svelte";
  import { WEB_CHAT_CLOSE_READ_DISCLOSURES_EVENT } from "./message-read-disclosure-events";
  import type { WebChatMessageReadProgress } from "./types";

  export interface ResolvedMessageAction {
    id: string;
    label: string;
    detail?: string;
    tone?: "default" | "destructive";
    disabled?: boolean;
    onSelect?: () => void | Promise<void>;
  }

  let {
    actions,
    readProgress = null,
    title = "Message actions",
    open = $bindable(false),
    class: className = "",
  }: {
    actions: readonly ResolvedMessageAction[];
    readProgress?: WebChatMessageReadProgress | null;
    title?: string;
    open?: boolean;
    class?: string;
  } = $props();

  let triggerHost = $state<HTMLDivElement | null>(null);
  let triggerButtonRef = $state<HTMLButtonElement | null>(null);
  const targetEl = $derived.by(() => triggerButtonRef ?? undefined);
  let readDisclosureOpen = $state(false);
  let readDisclosureCloseTimer: ReturnType<typeof setTimeout> | null = null;
  let ignoreNextReadDisclosureClose = false;
  const useCompactActions = (): boolean => typeof window !== "undefined" && window.innerWidth <= 480;
  const desktopActionPopoverWidth = 260;
  const readDisclosureCloseDelayMs = 650;
  const readProgressTitle = $derived.by(() => {
    if (!readProgress) {
      return null;
    }
    return readProgress.title ?? `${readProgress.readCount}/${Math.max(readProgress.totalCount, 1)} read`;
  });
  const triggerTitle = $derived(readProgressTitle ? `${title}, ${readProgressTitle}` : title);

  const clearReadDisclosureCloseTimer = (): void => {
    if (!readDisclosureCloseTimer) {
      return;
    }
    clearTimeout(readDisclosureCloseTimer);
    readDisclosureCloseTimer = null;
  };

  const closeReadDisclosure = (): void => {
    clearReadDisclosureCloseTimer();
    readDisclosureOpen = false;
  };

  const openReadDisclosure = (): void => {
    if (!readProgress || open) {
      return;
    }
    if (typeof window !== "undefined" && !readDisclosureOpen) {
      for (const trigger of Array.from(document.querySelectorAll("[data-message-actions-trigger]"))) {
        if (trigger !== triggerButtonRef && trigger instanceof HTMLElement) {
          trigger.blur();
        }
      }
      ignoreNextReadDisclosureClose = true;
      window.dispatchEvent(new Event(WEB_CHAT_CLOSE_READ_DISCLOSURES_EVENT));
      queueMicrotask(() => {
        ignoreNextReadDisclosureClose = false;
      });
    }
    clearReadDisclosureCloseTimer();
    readDisclosureOpen = true;
  };

  const scheduleReadDisclosureClose = (): void => {
    clearReadDisclosureCloseTimer();
    readDisclosureCloseTimer = setTimeout(() => {
      readDisclosureCloseTimer = null;
      readDisclosureOpen = false;
    }, readDisclosureCloseDelayMs);
  };

  const isInsideTriggerHost = (target: EventTarget | null): boolean => {
    return target instanceof Element && Boolean(triggerHost?.contains(target));
  };

  const isInsideReadDisclosure = (target: EventTarget | null): boolean => {
    return target instanceof Element && Boolean(target.closest(".message-read-disclosure"));
  };

  const handleReadDisclosureFocusOut = (event: FocusEvent): void => {
    if (isInsideTriggerHost(event.relatedTarget) || isInsideReadDisclosure(event.relatedTarget)) {
      return;
    }
    scheduleReadDisclosureClose();
  };

  const resolveActionAnchor = (): Framework7ActionSurfaceAnchor | null => {
    if (!targetEl) {
      return null;
    }
    if (useCompactActions()) {
      return null;
    }
    if (!(targetEl instanceof HTMLElement)) {
      return { targetEl };
    }
    const rect = targetEl.getBoundingClientRect();
    const targetWidth = Math.min(desktopActionPopoverWidth, Math.max(180, window.innerWidth - 10));
    return {
      targetX: Math.round(rect.right - targetWidth),
      targetY: Math.round(rect.top),
      targetWidth,
      targetHeight: Math.round(rect.height),
    };
  };

  const actionAnchor = $derived.by(resolveActionAnchor);

  $effect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const handleExternalReadDisclosureClose = (): void => {
      if (ignoreNextReadDisclosureClose) {
        return;
      }
      readDisclosureOpen = false;
    };
    window.addEventListener(WEB_CHAT_CLOSE_READ_DISCLOSURES_EVENT, handleExternalReadDisclosureClose);
    return () => {
      window.removeEventListener(WEB_CHAT_CLOSE_READ_DISCLOSURES_EVENT, handleExternalReadDisclosureClose);
    };
  });

  onDestroy(() => {
    clearReadDisclosureCloseTimer();
  });
</script>

<div
  class={`message-actions-menu ${readProgress ? "message-actions-menu-read" : ""} ${className}`}
  bind:this={triggerHost}
  role="group"
  aria-label={triggerTitle}
  onpointerenter={openReadDisclosure}
  onfocusin={openReadDisclosure}
  onfocusout={handleReadDisclosureFocusOut}
>
  {#if readProgress}
    <MessageReadIndicator
      progress={readProgress}
      triggerMode="manual"
      disclosure={false}
      class="message-actions-read-ring"
    />
  {/if}
  <button
    type="button"
    bind:this={triggerButtonRef}
    data-message-actions-trigger
    class={`message-actions-trigger ${open ? "message-actions-trigger-open" : ""}`}
    aria-label={triggerTitle}
    aria-expanded={open}
    title={triggerTitle}
    onclick={(event: MouseEvent) => {
      event.preventDefault();
      closeReadDisclosure();
      open = !open;
    }}
  >
    <MoreHorizontal class="size-4" />
  </button>
  {#if readProgress}
    <MessageReadIndicator
      progress={readProgress}
      bind:open={readDisclosureOpen}
      triggerMode="manual"
      targetEl={targetEl}
      indicatorVisible={false}
      onDisclosurePointerEnter={openReadDisclosure}
    />
  {/if}
  <Framework7ActionSurface bind:open actions={actions} {title} anchor={actionAnchor} />
</div>

<style>
  .message-actions-menu {
    position: relative;
    display: inline-grid;
    inline-size: var(--message-action-button-size, 1.5rem);
    block-size: var(--message-action-button-size, 1.5rem);
    place-items: center;
    z-index: 1;
    isolation: isolate;
  }

  :global(.message-actions-trigger) {
    position: relative;
    display: inline-flex;
    inline-size: var(--message-action-button-size, 1.5rem);
    block-size: var(--message-action-button-size, 1.5rem);
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    color: var(--f7-text-color-secondary, #94a3b8);
    background: color-mix(in srgb, var(--f7-list-bg-color, #fff) 68%, transparent);
    box-shadow:
      0 3px 10px rgba(15, 23, 42, 0.12),
      inset 0 0 0 1px rgba(60, 60, 67, 0.1);
    z-index: 2;
  }

  .message-actions-menu-read :global(.message-actions-trigger) {
    inline-size: calc(var(--message-action-button-size, 1.5rem) * 0.66);
    block-size: calc(var(--message-action-button-size, 1.5rem) * 0.66);
    background: color-mix(in srgb, var(--f7-list-bg-color, #fff) 84%, transparent);
    box-shadow:
      0 2px 7px rgba(15, 23, 42, 0.12),
      inset 0 0 0 1px rgba(60, 60, 67, 0.08);
  }

  :global(.message-actions-trigger > svg:first-child) {
    position: relative;
    z-index: 1;
    inline-size: 0.68rem;
    block-size: 0.68rem;
    color: color-mix(in srgb, var(--f7-text-color, #0f172a) 58%, transparent);
    stroke-width: 2.6;
    z-index: 3;
  }

  :global(.message-actions-trigger .message-read-disclosure-anchor) {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  :global(.message-actions-menu > .message-read-disclosure-anchor) {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 1;
  }

  :global(.message-actions-trigger-open) {
    background: color-mix(in srgb, var(--f7-theme-color, #007aff) 8%, white);
    color: var(--f7-text-color, #111827);
  }

  :global(.message-actions-read-ring.web-chat-message-read-indicator) {
    --web-chat-message-read-indicator-size: var(--message-action-button-size, 1.5rem);
    position: absolute;
    inset: 50% auto auto 50%;
    margin: 0;
    pointer-events: none;
    color: #0f766e;
    opacity: 1;
    transform: translate(-50%, -50%);
    align-self: auto;
    z-index: 1;
  }

  :global(.message-actions-read-ring .message-read-ring) {
    opacity: 1;
    filter: drop-shadow(0 0 1px rgba(20, 184, 166, 0.46));
  }
</style>
