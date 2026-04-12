<script lang="ts">
  import Check from "@lucide/svelte/icons/check";

  import ChatAvatar from "./chat-avatar.svelte";
  import { Badge } from "./ui/badge";
  import * as Card from "./ui/card";
  import * as Popover from "./ui/popover";
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
  const disclosureGridClass = $derived(
    showUnreadColumn ? "grid gap-2 min-[21rem]:grid-cols-2" : "grid gap-2",
  );

  const renderActorState = (_actor: WebChatMessageReadActor, _tone: "read" | "unread") =>
    ({
      rowClass: "flex min-w-0 items-center gap-2 rounded-lg border border-border/70 bg-background px-2.5 py-2",
      avatarClass: "size-7 rounded-lg text-[0.56rem] tracking-[0.12em] shadow-none",
      subtitleClass: "truncate text-[0.72rem] text-muted-foreground",
    });
</script>

{#snippet actorList(
  actors: readonly WebChatMessageReadActor[],
  tone: "read" | "unread",
  emptyCopy: string,
)}
  {#if actors.length === 0}
    <div class="rounded-xl border border-dashed border-slate-200 bg-white/80 px-3 py-2 text-xs text-slate-500">
      {emptyCopy}
    </div>
  {:else}
    <div class="grid gap-1.5">
      {#each actors as actor (actor.actorId)}
        {@const actorState = renderActorState(actor, tone)}
        <div class={actorState.rowClass}>
          <ChatAvatar
            label={actor.label}
            subtitle={actor.subtitle}
            src={actor.iconUrl ?? null}
            class={actorState.avatarClass}
            part="message-read-actor-avatar"
          />
          <div class="min-w-0 flex-1">
            <div class="truncate text-[0.82rem] font-semibold text-slate-900">{actor.label}</div>
            {#if actor.subtitle}
              <div class={actorState.subtitleClass}>{actor.subtitle}</div>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}
{/snippet}

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
      class="message-read-disclosure border-0 bg-transparent p-0 shadow-none"
      style="--popover-inline-size: 17rem; --popover-max-inline-size: calc(100vw - 1rem);"
      data-testid="message-read-disclosure"
    >
      <Card.Root class="gap-0 rounded-xl border-border/80 bg-popover py-0 shadow-md">
        <Card.Header class="grid-cols-[1fr_auto] gap-2 border-b border-border/70 px-3 py-3">
          <div class="space-y-1">
            <Card.Description class="text-[0.68rem] font-medium uppercase tracking-[0.16em] text-muted-foreground">
              Read status
            </Card.Description>
            <Card.Title class="text-sm font-semibold text-foreground">{title}</Card.Title>
          </div>
          <Card.Action>
            <Badge
              variant="outline"
              class={
                complete
                  ? "h-6 rounded-full border-emerald-200/70 bg-emerald-50/40 px-2.5 text-[0.68rem] font-medium uppercase tracking-[0.12em] text-emerald-700"
                  : "h-6 rounded-full border-border/70 bg-background px-2.5 text-[0.68rem] font-medium uppercase tracking-[0.12em] text-muted-foreground"
              }
            >
              {readCount}/{totalCount}
            </Badge>
          </Card.Action>
        </Card.Header>

        <Card.Content class={`${disclosureGridClass} px-3 py-3`}>
          <section class="min-w-0 space-y-2 rounded-lg border border-border/70 bg-muted/20 p-2.5">
            <div class="flex items-center justify-between gap-2">
              <Badge
                variant="outline"
                class="h-6 rounded-full border-emerald-200/70 bg-background px-2.5 text-[0.68rem] font-medium uppercase tracking-[0.12em] text-emerald-700"
              >
                Read
              </Badge>
              <span class="text-xs font-medium text-muted-foreground">{readActors.length}</span>
            </div>
            {@render actorList(readActors, "read", "Nobody yet")}
            {#if !showUnreadColumn}
              <div class="rounded-lg border border-border/70 bg-background px-3 py-2 text-xs text-muted-foreground">
                Everyone read
              </div>
            {/if}
          </section>

          {#if showUnreadColumn}
            <section class="min-w-0 space-y-2 rounded-lg border border-border/70 bg-muted/20 p-2.5">
              <div class="flex items-center justify-between gap-2">
                <Badge
                  variant="outline"
                  class="h-6 rounded-full border-border/70 bg-background px-2.5 text-[0.68rem] font-medium uppercase tracking-[0.12em] text-muted-foreground"
                >
                  Unread
                </Badge>
                <span class="text-xs font-medium text-muted-foreground">{unreadActors.length}</span>
              </div>
              {@render actorList(unreadActors, "unread", "Everybody is up to date")}
            </section>
          {/if}
        </Card.Content>
      </Card.Root>
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
</style>
