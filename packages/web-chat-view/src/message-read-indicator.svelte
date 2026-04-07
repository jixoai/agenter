<script lang="ts">
  import Check from "@lucide/svelte/icons/check";

  import ChatAvatar from "./chat-avatar.svelte";
  import * as Popover from "./ui/popover";
  import type { WebChatMessageReadProgress } from "./types";

  let {
    progress,
  }: {
    progress: WebChatMessageReadProgress;
  } = $props();

  const totalCount = $derived(Math.max(progress.totalCount, 1));
  const readCount = $derived(Math.max(0, Math.min(progress.readCount, totalCount)));
  const ratio = $derived(totalCount > 0 ? readCount / totalCount : 0);
  const complete = $derived(readCount >= totalCount);
  const title = $derived(progress.title ?? `${readCount}/${totalCount} read`);
  const circumference = 2 * Math.PI * 7;
  const dashOffset = $derived(circumference * (1 - ratio));
  const readActors = $derived(progress.readActors ?? []);
  const unreadActors = $derived(progress.unreadActors ?? []);
  const canDisclose = $derived(
    readActors.length > 0 || unreadActors.length > 0,
  );
  const showUnreadColumn = $derived(unreadActors.length > 0);
</script>

{#if canDisclose}
  <Popover.Root>
    <Popover.Trigger>
      {#snippet child({ props })}
        <button
          {...props}
          type="button"
          class="message-read-indicator message-read-trigger"
          data-complete={complete ? "true" : "false"}
          data-testid="message-read-indicator"
          aria-label={title}
          title={title}
        >
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
        </button>
      {/snippet}
    </Popover.Trigger>
    <Popover.Content
      class="message-read-disclosure p-2.5"
      style="--popover-inline-size: 17rem; --popover-max-inline-size: calc(100vw - 1rem);"
      data-testid="message-read-disclosure"
    >
      <div class:single-column={!showUnreadColumn} class="message-read-disclosure-grid">
        <section class="message-read-column" data-state="read">
          <header>
            <span>Read</span>
            <strong>{readActors.length}</strong>
          </header>
          <div class="message-read-actors">
            {#if readActors.length === 0}
              <p class="message-read-empty">Nobody yet</p>
            {:else}
              {#each readActors as actor (actor.actorId)}
                <div class="message-read-actor">
                  <ChatAvatar
                    label={actor.label}
                    subtitle={actor.subtitle}
                    src={actor.iconUrl ?? null}
                    class="message-read-avatar"
                    part="message-read-actor-avatar"
                  />
                  <div class="message-read-copy">
                    <span class="message-read-label">{actor.label}</span>
                    {#if actor.subtitle}
                      <span class="message-read-subtitle">{actor.subtitle}</span>
                    {/if}
                  </div>
                </div>
              {/each}
            {/if}
          </div>
          {#if !showUnreadColumn}
            <p class="message-read-empty message-read-complete-copy">Everyone read</p>
          {/if}
        </section>

        {#if showUnreadColumn}
          <section class="message-read-column" data-state="unread">
            <header>
              <span>Unread</span>
              <strong>{unreadActors.length}</strong>
            </header>
            <div class="message-read-actors">
              {#each unreadActors as actor (actor.actorId)}
                <div class="message-read-actor">
                  <ChatAvatar
                    label={actor.label}
                    subtitle={actor.subtitle}
                    src={actor.iconUrl ?? null}
                    class="message-read-avatar"
                    part="message-read-actor-avatar"
                  />
                  <div class="message-read-copy">
                    <span class="message-read-label">{actor.label}</span>
                    {#if actor.subtitle}
                      <span class="message-read-subtitle">{actor.subtitle}</span>
                    {/if}
                  </div>
                </div>
              {/each}
            </div>
          </section>
        {/if}
      </div>
    </Popover.Content>
  </Popover.Root>
{:else}
  <div
    class="message-read-indicator"
    data-complete={complete ? "true" : "false"}
    data-testid="message-read-indicator"
    aria-label={title}
    title={title}
  >
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
  </div>
{/if}

<style>
  .message-read-indicator {
    position: relative;
    display: inline-flex;
    width: 1.25rem;
    height: 1.25rem;
    flex: 0 0 auto;
    align-items: center;
    justify-content: center;
    align-self: flex-end;
    margin-bottom: 0.12rem;
    color: #14b8a6;
  }

  .message-read-trigger {
    cursor: pointer;
    border: 0;
    background: transparent;
    padding: 0;
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

  .message-read-indicator[data-complete="true"] .message-read-track,
  .message-read-indicator[data-complete="true"] .message-read-progress {
    stroke: currentColor;
  }

  :global(.message-read-check) {
    position: absolute;
    width: 0.65rem;
    height: 0.65rem;
    stroke-width: 2.5;
  }

  .message-read-disclosure-grid {
    display: grid;
    gap: 0.75rem;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .message-read-disclosure-grid.single-column {
    grid-template-columns: 1fr;
  }

  .message-read-column {
    display: grid;
    gap: 0.55rem;
    min-width: 0;
  }

  .message-read-column > header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    font-size: 0.74rem;
    font-weight: 700;
    letter-spacing: 0.02em;
    color: #0f172a;
  }

  .message-read-column[data-state="read"] > header strong {
    color: #0f766e;
  }

  .message-read-column[data-state="unread"] > header strong {
    color: #475569;
  }

  .message-read-actors {
    display: grid;
    gap: 0.45rem;
  }

  .message-read-actor {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    min-width: 0;
    border-radius: 0.95rem;
    padding: 0.45rem 0.5rem;
    background: linear-gradient(180deg, rgba(248, 250, 252, 0.98), rgba(241, 245, 249, 0.94));
  }

  :global(.message-read-avatar) {
    width: 1.9rem;
    height: 1.9rem;
    border-radius: 0.95rem;
    font-size: 0.6rem;
    letter-spacing: 0.08em;
    box-shadow: none;
  }

  .message-read-copy {
    display: grid;
    min-width: 0;
  }

  .message-read-label {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 0.76rem;
    font-weight: 600;
    color: #0f172a;
  }

  .message-read-subtitle,
  .message-read-empty {
    margin: 0;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 0.68rem;
    color: #64748b;
  }

  .message-read-complete-copy {
    color: #0f766e;
  }

  @container (max-width: 28rem) {
    .message-read-disclosure-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
