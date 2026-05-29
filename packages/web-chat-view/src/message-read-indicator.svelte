<script lang="ts">
  import Check from "@lucide/svelte/icons/check";

  import ChatAvatar from "./chat-avatar.svelte";
  import { useFramework7Runtime } from "./framework7-host";
  import { Badge, Block, BlockTitle, Link, List, ListItem, Popover } from "./framework7-components";
  import type { WebChatMessageReadActor, WebChatMessageReadProgress } from "./types";

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
  const canDisclose = $derived(readActors.length > 0 || unreadActors.length > 0);
  const showUnreadColumn = $derived(unreadActors.length > 0);
  let open = $state(false);
  let triggerHost = $state<HTMLDivElement | null>(null);
  const targetEl = $derived.by(() => triggerHost?.querySelector("[data-message-read-trigger]") ?? undefined);
  const framework7Runtime = useFramework7Runtime();
</script>

{#snippet actorList(
  actors: readonly WebChatMessageReadActor[],
  tone: "read" | "unread",
  emptyCopy: string,
)}
  {#if actors.length === 0}
    <Block class="message-read-empty-block" strongIos insetIos>
      <div class="message-read-empty">
        {emptyCopy}
      </div>
    </Block>
  {:else}
    <List class="message-read-list" mediaList strongIos insetIos>
      {#each actors as actor (actor.actorId)}
        <ListItem title={actor.label} subtitle={actor.subtitle} class="message-read-row" data-tone={tone}>
          {#snippet media()}
            <ChatAvatar
              label={actor.label}
              subtitle={actor.subtitle}
              src={actor.iconUrl ?? null}
              class="message-read-avatar"
              part="message-read-actor-avatar"
            />
          {/snippet}
        </ListItem>
      {/each}
    </List>
  {/if}
{/snippet}

{#if canDisclose}
  <div class="message-read-disclosure-anchor" bind:this={triggerHost}>
    <Link
      href="#"
      class="web-chat-message-read-indicator web-chat-message-read-trigger message-read-indicator message-read-trigger"
      data-complete={complete ? "true" : "false"}
      data-testid="message-read-indicator"
      data-message-read-trigger
      aria-label={title}
      aria-expanded={open}
      title={title}
      onclick={(event: MouseEvent) => {
        event.preventDefault();
        open = !open;
      }}
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
    </Link>

    {#snippet disclosureCard()}
      <div
        class="message-read-disclosure"
        style="--popover-inline-size: 17rem; --popover-max-inline-size: calc(100vw - 1rem);"
        data-testid="message-read-disclosure"
      >
        <div class="message-read-panel">
          <Block class="message-read-summary" strongIos insetIos>
            <div class="message-read-summary-head">
              <div class="message-read-header-copy">
                <div class="message-read-eyebrow">Read status</div>
                <div class="message-read-title">{title}</div>
              </div>
              <Badge class={`message-read-pill ${complete ? "message-read-pill-complete" : ""}`}>
                {readCount}/{totalCount}
              </Badge>
            </div>
          </Block>

          <div class={`message-read-columns ${showUnreadColumn ? "message-read-columns-dual" : ""}`}>
            <section class="message-read-section">
              <BlockTitle class="message-read-section-head">
                <span>Read</span>
                <Badge class="message-read-section-pill message-read-section-pill-read">{readActors.length}</Badge>
              </BlockTitle>
              {@render actorList(readActors, "read", "Nobody yet")}
              {#if !showUnreadColumn}
                <Block class="message-read-empty-block" strongIos insetIos>
                  <div class="message-read-empty">
                    Everyone read
                  </div>
                </Block>
              {/if}
            </section>

            {#if showUnreadColumn}
              <section class="message-read-section">
                <BlockTitle class="message-read-section-head">
                  <span>Unread</span>
                  <Badge class="message-read-section-pill">{unreadActors.length}</Badge>
                </BlockTitle>
                {@render actorList(unreadActors, "unread", "Everybody is up to date")}
              </section>
            {/if}
          </div>
        </div>
      </div>
    {/snippet}

    {#if $framework7Runtime}
      {#if open}
        <Popover
          opened
          {targetEl}
          containerEl="body"
          closeByOutsideClick
          closeByBackdropClick
          onPopoverClosed={() => {
            open = false;
          }}
        >
          {@render disclosureCard()}
        </Popover>
      {/if}
    {:else if open}
      {@render disclosureCard()}
    {/if}
  </div>
{:else}
  <div
    class="web-chat-message-read-indicator message-read-indicator"
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
    cursor: pointer;
    padding: 0;
    text-decoration: none;
  }

  .message-read-disclosure-anchor {
    position: relative;
  }

  .message-read-disclosure {
    position: absolute;
    right: 0;
    bottom: calc(100% + 0.45rem);
    width: min(var(--popover-inline-size, 17rem), var(--popover-max-inline-size, calc(100vw - 1rem)));
    z-index: 14;
    border-radius: 18px;
    box-shadow: 0 14px 32px rgba(15, 23, 42, 0.16);
  }

  .message-read-panel {
    display: grid;
    gap: 0.5rem;
  }

  :global(.message-read-summary.block) {
    margin-block: 0;
    padding-block: 0.78rem;
  }

  .message-read-summary-head {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: start;
    gap: 0.5rem;
  }

  .message-read-header-copy {
    min-width: 0;
    display: grid;
    gap: 0.15rem;
  }

  .message-read-eyebrow {
    font-size: 0.66rem;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--f7-text-color-secondary, #64748b);
  }

  .message-read-title {
    font-size: 0.9rem;
    font-weight: 700;
    color: var(--f7-text-color, #0f172a);
  }

  :global(.message-read-pill.badge) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 2.8rem;
    height: 1.55rem;
    padding-inline: 0.48rem;
    color: var(--f7-text-color-secondary, #64748b);
    background: color-mix(in srgb, var(--f7-card-bg-color, #fff) 96%, transparent);
    border: 1px solid color-mix(in srgb, var(--f7-list-outline-border-color, #cfd8e3) 88%, transparent);
    border-radius: 999px;
  }

  :global(.message-read-pill-complete.badge) {
    color: #0f766e;
    border-color: rgba(52, 211, 153, 0.35);
  }

  .message-read-columns {
    display: grid;
    gap: 0.55rem;
  }

  .message-read-columns-dual {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .message-read-section {
    display: grid;
    gap: 0.45rem;
    min-width: 0;
  }

  :global(.message-read-section-head.block-title) {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    margin: 0 1rem -0.06rem;
  }

  :global(.message-read-section-pill.badge) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 1.8rem;
    height: 1.45rem;
    padding-inline: 0.44rem;
    color: var(--f7-text-color-secondary, #64748b);
    background: color-mix(in srgb, var(--f7-card-bg-color, #fff) 96%, transparent);
    border: 1px solid color-mix(in srgb, var(--f7-list-outline-border-color, #cfd8e3) 88%, transparent);
    border-radius: 999px;
  }

  :global(.message-read-section-pill-read.badge) {
    color: #0f766e;
    border-color: rgba(52, 211, 153, 0.35);
  }

  .message-read-empty {
    font-size: 0.75rem;
    color: var(--f7-text-color-secondary, #64748b);
  }

  :global(.message-read-empty-block.block) {
    margin-block: 0;
    padding-block: 0.6rem;
  }

  .message-read-empty {
    padding: 0.12rem 0;
  }

  :global(.message-read-list.list) {
    margin-block: 0;
  }

  :global(.message-read-avatar) {
    width: 1.75rem;
    height: 1.75rem;
    min-width: 1.75rem;
    border-radius: 0.75rem;
    box-shadow: none;
    font-size: 0.56rem;
    letter-spacing: 0.12em;
  }

  :global(.message-read-list .item-title) {
    font-size: 0.78rem;
    font-weight: 600;
    color: var(--f7-text-color, #0f172a);
  }

  :global(.message-read-list .item-subtitle) {
    font-size: 0.7rem;
    color: var(--f7-text-color-secondary, #64748b);
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
