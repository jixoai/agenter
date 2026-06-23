<script module lang="ts">
  let nextMessageReadDisclosureId = 0;
</script>

<script lang="ts">
  import Check from "@lucide/svelte/icons/check";
  import { onDestroy } from "svelte";

  import ChatAvatar from "./chat-avatar.svelte";
  import { WEB_CHAT_CLOSE_READ_DISCLOSURES_EVENT } from "./message-read-disclosure-events";
  import type { WebChatMessageReadActor, WebChatMessageReadProgress } from "./types";

  type NativePopoverElement = HTMLDivElement & {
    showPopover?: () => void;
    hidePopover?: () => void;
  };

  let {
    progress,
    open = $bindable(false),
    triggerMode = "click",
    targetEl = undefined,
    class: className = "",
    disclosure = true,
    indicatorVisible = true,
    onDisclosurePointerEnter,
    onDisclosurePointerLeave,
  }: {
    progress: WebChatMessageReadProgress;
    open?: boolean;
    triggerMode?: "click" | "hover" | "manual";
    targetEl?: Element | null | undefined;
    class?: string;
    disclosure?: boolean;
    indicatorVisible?: boolean;
    onDisclosurePointerEnter?: (() => void) | undefined;
    onDisclosurePointerLeave?: (() => void) | undefined;
  } = $props();

  const disclosureId = `message-read-disclosure-${nextMessageReadDisclosureId++}`;
  const disclosureAnchorName = `--${disclosureId}`;
  const disclosureAnchorStyle = `anchor-name: ${disclosureAnchorName};`;
  const totalCount = $derived(Math.max(progress.totalCount, 1));
  const readCount = $derived(Math.max(0, Math.min(progress.readCount, totalCount)));
  const ratio = $derived(totalCount > 0 ? readCount / totalCount : 0);
  const complete = $derived(readCount >= totalCount);
  const title = $derived(progress.title ?? `${readCount}/${totalCount} read`);
  const circumference = 2 * Math.PI * 7;
  const dashOffset = $derived(circumference * (1 - ratio));
  const readActors = $derived(progress.readActors ?? []);
  const unreadActors = $derived(progress.unreadActors ?? []);
  const canDisclose = $derived(readActors.length > 0 || unreadActors.length > 0);
  const showUnreadColumn = $derived(unreadActors.length > 0);
  let triggerHost = $state<HTMLDivElement | null>(null);
  let disclosurePopoverRef = $state<NativePopoverElement | null>(null);
  let closeTimer: ReturnType<typeof setTimeout> | null = null;
  let ignoreNextExternalClose = false;
  let nativePopoverFallbackInlineStart = $state(0);
  let nativePopoverFallbackBlockStart = $state(0);
  const resolvedTargetEl = $derived.by(() => targetEl ?? triggerHost ?? undefined);
  const disclosurePopoverStyle = $derived(
    [
      `position-anchor: ${disclosureAnchorName}`,
      "--popover-inline-size: 19rem",
      "--popover-max-inline-size: calc(100vw - 1rem)",
      `--message-read-popover-x: ${nativePopoverFallbackInlineStart}px`,
      `--message-read-popover-y: ${nativePopoverFallbackBlockStart}px`,
    ].join("; "),
  );

  const clearCloseTimer = (): void => {
    if (!closeTimer) {
      return;
    }
    clearTimeout(closeTimer);
    closeTimer = null;
  };

  const showDisclosure = (): void => {
    if (!canDisclose) {
      return;
    }
    if (typeof window !== "undefined" && !open) {
      ignoreNextExternalClose = true;
      window.dispatchEvent(new Event(WEB_CHAT_CLOSE_READ_DISCLOSURES_EVENT));
      queueMicrotask(() => {
        ignoreNextExternalClose = false;
      });
    }
    clearCloseTimer();
    open = true;
  };

  const hideDisclosure = (): void => {
    clearCloseTimer();
    open = false;
  };

  const scheduleHideDisclosure = (): void => {
    clearCloseTimer();
    closeTimer = setTimeout(() => {
      closeTimer = null;
      open = false;
    }, 180);
  };

  const toggleDisclosure = (): void => {
    if (!canDisclose) {
      return;
    }
    open = !open;
  };

  const handleKeydown = (event: KeyboardEvent): void => {
    if (triggerMode === "manual") {
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggleDisclosure();
    }
    if (event.key === "Escape") {
      hideDisclosure();
    }
  };

  const isNativePopoverOpen = (element: HTMLElement): boolean => {
    return element.matches(":popover-open");
  };

  const updateNativePopoverFallbackGeometry = (): void => {
    if (typeof window === "undefined") {
      return;
    }
    const anchor = resolvedTargetEl instanceof HTMLElement ? resolvedTargetEl : triggerHost;
    if (!anchor) {
      return;
    }
    const rect = anchor.getBoundingClientRect();
    nativePopoverFallbackInlineStart = Math.round(rect.left + rect.width / 2);
    nativePopoverFallbackBlockStart = Math.round(rect.bottom + 8);
  };

  const showNativePopover = (): void => {
    const popover = disclosurePopoverRef;
    if (!popover || !popover.isConnected) {
      return;
    }
    updateNativePopoverFallbackGeometry();
    if (typeof popover.showPopover !== "function" || isNativePopoverOpen(popover)) {
      return;
    }
    popover.showPopover();
  };

  const handleNativePopoverToggle = (event: Event): void => {
    const target = event.currentTarget;
    if (target instanceof HTMLElement && !isNativePopoverOpen(target)) {
      open = false;
    }
  };

  onDestroy(() => {
    clearCloseTimer();
  });

  $effect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const handleExternalClose = (): void => {
      if (ignoreNextExternalClose) {
        return;
      }
      open = false;
    };
    window.addEventListener(WEB_CHAT_CLOSE_READ_DISCLOSURES_EVENT, handleExternalClose);
    return () => {
      window.removeEventListener(WEB_CHAT_CLOSE_READ_DISCLOSURES_EVENT, handleExternalClose);
    };
  });

  $effect(() => {
    if (!open || !disclosure) {
      return;
    }
    showNativePopover();
  });
</script>

{#snippet indicatorGlyph()}
  <svg viewBox="0 0 20 20" class="message-read-ring">
    <circle cx="10" cy="10" r="7" class="message-read-track" />
    <circle
      cx="10"
      cy="10"
      r="7"
      class="message-read-progress"
      stroke-dasharray={circumference}
      stroke-dashoffset={dashOffset}
    />
  </svg>
  {#if complete}
    <Check class="message-read-check" />
  {/if}
{/snippet}

{#snippet actorList(
  actors: readonly WebChatMessageReadActor[],
  tone: "read" | "unread",
  emptyCopy: string,
)}
  {#if actors.length === 0}
    <p class="message-read-empty">
      {emptyCopy}
    </p>
  {:else}
    <div class="message-read-list" role="list">
      {#each actors as actor (actor.actorId)}
        <div class="message-read-row" data-tone={tone} role="listitem">
          <ChatAvatar
            label={actor.label}
            subtitle={actor.subtitle}
            src={actor.iconUrl ?? null}
            class="message-read-avatar"
            part="message-read-actor-avatar"
          />
          <span class="message-read-actor-copy">
            <span class="message-read-actor-label">{actor.label}</span>
            {#if actor.subtitle}
              <span class="message-read-actor-subtitle">{actor.subtitle}</span>
            {/if}
          </span>
        </div>
      {/each}
    </div>
  {/if}
{/snippet}

{#if canDisclose}
  <div class="message-read-disclosure-anchor" style={disclosureAnchorStyle} bind:this={triggerHost}>
    {#if indicatorVisible}
      {#if triggerMode === "manual"}
        <div
          class={`web-chat-message-read-indicator message-read-indicator ${className}`}
          data-complete={complete ? "true" : "false"}
          data-testid="message-read-indicator"
          data-trigger-mode={triggerMode}
          aria-hidden="true"
        >
          {@render indicatorGlyph()}
        </div>
      {:else}
        <button
          type="button"
          class={`web-chat-message-read-indicator web-chat-message-read-trigger message-read-indicator message-read-trigger ${className}`}
          data-complete={complete ? "true" : "false"}
          data-testid="message-read-indicator"
          data-message-read-trigger
          aria-label={title}
          aria-expanded={open}
          title={title}
          data-trigger-mode={triggerMode}
          onpointerenter={() => {
            if (triggerMode === "hover") {
              showDisclosure();
            }
          }}
          onpointerleave={() => {
            if (triggerMode === "hover") {
              scheduleHideDisclosure();
            }
          }}
          onfocusin={() => {
            if (triggerMode === "hover") {
              showDisclosure();
            }
          }}
          onfocusout={() => {
            if (triggerMode === "hover") {
              scheduleHideDisclosure();
            }
          }}
          onkeydown={handleKeydown}
          onclick={(event: MouseEvent) => {
            event.preventDefault();
            toggleDisclosure();
          }}
        >
          {@render indicatorGlyph()}
        </button>
      {/if}
    {/if}

    {#snippet disclosureCard()}
      <div
        id={disclosureId}
        bind:this={disclosurePopoverRef}
        popover="auto"
        role="dialog"
        tabindex="-1"
        class="message-read-disclosure"
        style={disclosurePopoverStyle}
        data-testid="message-read-disclosure"
        ontoggle={handleNativePopoverToggle}
        onpointerenter={() => {
          clearCloseTimer();
          onDisclosurePointerEnter?.();
        }}
        onpointerleave={() => {
          if (triggerMode === "hover") {
            scheduleHideDisclosure();
          }
          onDisclosurePointerLeave?.();
        }}
      >
        <div class="message-read-panel">
          <header class="message-read-summary">
            <div class="message-read-header-copy">
              <span class="message-read-eyebrow">Read status</span>
              <strong class="message-read-title">{title}</strong>
            </div>
            <span class={`message-read-pill ${complete ? "message-read-pill-complete" : ""}`}>
              {readCount}/{totalCount}
            </span>
          </header>

          <div class:message-read-columns-split={showUnreadColumn} class="message-read-columns">
            <section class="message-read-section">
              <div class="message-read-section-head">
                <span>Read</span>
                <span class="message-read-section-pill message-read-section-pill-read">{readActors.length}</span>
              </div>
              {@render actorList(readActors, "read", "Nobody yet")}
              {#if !showUnreadColumn}
                <p class="message-read-empty">
                  Everyone read
                </p>
              {/if}
            </section>

            {#if showUnreadColumn}
              <section class="message-read-section">
                <div class="message-read-section-head">
                  <span>Unread</span>
                  <span class="message-read-section-pill">{unreadActors.length}</span>
                </div>
                {@render actorList(unreadActors, "unread", "Everybody is up to date")}
              </section>
            {/if}
          </div>
        </div>
      </div>
    {/snippet}

    {#if disclosure && open}
      {@render disclosureCard()}
    {/if}
  </div>
{:else}
  {#if indicatorVisible}
    <div
      class={`web-chat-message-read-indicator message-read-indicator ${className}`}
      data-complete={complete ? "true" : "false"}
      data-testid="message-read-indicator"
      aria-label={title}
      title={title}
    >
      {@render indicatorGlyph()}
    </div>
  {/if}
{/if}

<style>
  :global(.web-chat-message-read-indicator) {
    position: relative;
    display: inline-flex;
    inline-size: var(--web-chat-message-read-indicator-size, 1.25rem);
    block-size: var(--web-chat-message-read-indicator-size, 1.25rem);
    flex: 0 0 auto;
    align-items: center;
    justify-content: center;
    align-self: flex-end;
    margin-bottom: 0.12rem;
    color: #14b8a6;
  }

  :global(.web-chat-message-read-trigger) {
    appearance: none;
    border: 0;
    background: transparent;
    cursor: pointer;
    padding: 0;
    text-decoration: none;
  }

  .message-read-disclosure-anchor {
    position: relative;
  }

  .message-read-disclosure {
    position: fixed;
    position-area: top center;
    position-try-fallbacks: flip-block, flip-inline, flip-block flip-inline;
    position-try-order: most-height;
    inline-size: min(var(--popover-inline-size, 19rem), var(--popover-max-inline-size, calc(100vw - 1rem)));
    max-block-size: min(24rem, calc(100vh - 1rem));
    margin: 0.45rem 0;
    padding: 0;
    border: 0;
    color: var(--f7-text-color, #0f172a);
    overflow: visible;
    pointer-events: auto;
    background: transparent;
    box-shadow: none;
  }

  .message-read-disclosure::backdrop {
    background: transparent;
  }

  @supports not (position-anchor: --message-read-anchor-fallback) {
    .message-read-disclosure {
      left: clamp(
        0.5rem,
        calc(var(--message-read-popover-x, 0px) - 9.5rem),
        calc(100vw - min(var(--popover-inline-size, 19rem), var(--popover-max-inline-size, calc(100vw - 1rem))) - 0.5rem)
      );
      top: clamp(0.5rem, var(--message-read-popover-y, 0px), calc(100vh - 13rem));
    }
  }

  .message-read-panel {
    display: grid;
    gap: 0.6rem;
    padding: 0.72rem;
    border: 1px solid color-mix(in srgb, var(--f7-list-outline-border-color, #cfd8e3) 76%, transparent);
    border-radius: 14px;
    background: color-mix(in srgb, var(--f7-popover-bg-color, var(--f7-list-bg-color, #fff)) 94%, transparent);
    box-shadow: 0 14px 34px rgba(15, 23, 42, 0.17);
    backdrop-filter: blur(16px);
    text-align: left;
  }

  .message-read-summary {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.65rem;
    min-width: 0;
  }

  .message-read-header-copy {
    min-width: 0;
    display: grid;
    gap: 0.15rem;
  }

  .message-read-eyebrow {
    font-size: 0.62rem;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--f7-text-color-secondary, #64748b);
  }

  .message-read-title {
    font-size: 0.84rem;
    font-weight: 700;
    color: var(--f7-text-color, #0f172a);
  }

  .message-read-pill {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 2.8rem;
    height: 1.38rem;
    padding-inline: 0.48rem;
    color: var(--f7-text-color-secondary, #64748b);
    background: transparent;
    border: 1px solid color-mix(in srgb, var(--f7-list-outline-border-color, #cfd8e3) 88%, transparent);
    border-radius: 999px;
    font-size: 0.72rem;
    font-weight: 700;
  }

  .message-read-pill-complete {
    color: #0f766e;
    border-color: rgba(52, 211, 153, 0.35);
  }

  .message-read-columns {
    display: grid;
    gap: 0.55rem;
  }

  .message-read-columns-split {
    grid-template-columns: minmax(0, 1fr);
  }

  .message-read-section {
    display: grid;
    gap: 0.3rem;
    min-width: 0;
  }

  .message-read-section-head {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.5rem;
    min-width: 0;
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--f7-text-color-secondary, #64748b);
  }

  .message-read-section-pill {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 1.8rem;
    height: 1.22rem;
    padding-inline: 0.44rem;
    color: var(--f7-text-color-secondary, #64748b);
    background: transparent;
    border: 1px solid color-mix(in srgb, var(--f7-list-outline-border-color, #cfd8e3) 88%, transparent);
    border-radius: 999px;
    font-size: 0.66rem;
    font-weight: 700;
  }

  .message-read-section-pill-read {
    color: #0f766e;
    border-color: rgba(52, 211, 153, 0.35);
  }

  .message-read-empty {
    margin: 0;
    padding: 0.25rem 0;
    font-size: 0.75rem;
    color: var(--f7-text-color-secondary, #64748b);
  }

  .message-read-list {
    display: grid;
    gap: 0.15rem;
  }

  .message-read-row {
    display: grid;
    grid-template-columns: 1.55rem minmax(0, 1fr);
    align-items: center;
    gap: 0.45rem;
    min-width: 0;
    padding: 0.2rem 0;
  }

  .message-read-row + .message-read-row {
    border-top: 1px solid color-mix(in srgb, var(--f7-list-outline-border-color, #cfd8e3) 62%, transparent);
  }

  .message-read-actor-copy {
    min-width: 0;
    display: grid;
    gap: 0.04rem;
    text-align: left;
  }

  .message-read-actor-label {
    min-width: 0;
    font-size: 0.77rem;
    font-weight: 600;
    line-height: 1.1;
    color: var(--f7-text-color, #0f172a);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .message-read-actor-subtitle {
    min-width: 0;
    font-size: 0.66rem;
    line-height: 1.05;
    color: var(--f7-text-color-secondary, #64748b);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  :global(.message-read-avatar) {
    width: 1.55rem;
    height: 1.55rem;
    min-width: 1.55rem;
    border-radius: 0.65rem;
    box-shadow: none;
    font-size: 0.56rem;
    letter-spacing: 0.12em;
  }

  @media (min-width: 420px) {
    .message-read-disclosure {
      inline-size: min(22rem, var(--popover-max-inline-size, calc(100vw - 1rem)));
    }

    .message-read-columns-split {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  .message-read-ring {
    width: 100%;
    height: 100%;
    transform: rotate(-90deg);
  }

  .message-read-track,
  .message-read-progress {
    fill: none;
    stroke-width: 2.1;
  }

  .message-read-track {
    stroke: color-mix(in srgb, currentColor 20%, white);
  }

  .message-read-progress {
    stroke: currentColor;
    stroke-linecap: round;
    transition: stroke-dashoffset 180ms ease;
  }

  :global(.web-chat-message-read-indicator[data-complete="true"]) .message-read-track,
  :global(.web-chat-message-read-indicator[data-complete="true"]) .message-read-progress {
    stroke: currentColor;
  }

  :global(.message-read-check) {
    position: absolute;
    width: 0.65rem;
    height: 0.65rem;
    stroke-width: 2.5;
  }
</style>
