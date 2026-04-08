<script lang="ts">
  import Check from "@lucide/svelte/icons/check";

  import ChatAvatar from "./chat-avatar.svelte";
  import { Badge } from "./ui/badge";
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

  const renderActorState = (actor: WebChatMessageReadActor, tone: "read" | "unread") =>
    tone === "read"
      ? {
          rowClass:
            "flex min-w-0 items-center gap-2.5 rounded-xl border border-emerald-200/70 bg-white px-2.5 py-2 shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
          avatarClass: "size-8 rounded-xl border-white/80 text-[0.56rem] tracking-[0.12em] shadow-none",
          subtitleClass: "truncate text-[0.72rem] text-emerald-700/70",
        }
      : {
          rowClass:
            "flex min-w-0 items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-2.5 py-2 shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
          avatarClass: "size-8 rounded-xl text-[0.56rem] tracking-[0.12em] shadow-none",
          subtitleClass: "truncate text-[0.72rem] text-slate-500",
        };
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
      class="message-read-disclosure space-y-2 p-2"
      style="--popover-inline-size: 17rem; --popover-max-inline-size: calc(100vw - 1rem);"
      data-testid="message-read-disclosure"
    >
      <div class="flex items-center justify-between gap-2">
        <div class="space-y-0.5">
          <div class="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-slate-500">Read status</div>
          <div class="text-sm font-semibold text-slate-900">{title}</div>
        </div>
        <Badge
          variant={complete ? "secondary" : "outline"}
          class={
            complete
              ? "h-6 rounded-full border-emerald-200 bg-emerald-50 px-2.5 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-emerald-700"
              : "h-6 rounded-full border-slate-200 bg-white px-2.5 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-slate-600"
          }
        >
          {readCount}/{totalCount}
        </Badge>
      </div>

      <div class={disclosureGridClass}>
        <section class="min-w-0 space-y-2 rounded-2xl border border-emerald-200/70 bg-emerald-50/60 p-2.5">
          <div class="flex items-center justify-between gap-2">
            <Badge
              variant="outline"
              class="h-6 rounded-full border-emerald-200 bg-white px-2.5 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-emerald-700"
            >
              Read
            </Badge>
            <span class="text-xs font-semibold text-emerald-800/75">{readActors.length}</span>
          </div>
          {@render actorList(readActors, "read", "Nobody yet")}
          {#if !showUnreadColumn}
            <div class="rounded-xl border border-emerald-200/80 bg-white/85 px-3 py-2 text-xs text-emerald-700">
              Everyone read
            </div>
          {/if}
        </section>

        {#if showUnreadColumn}
          <section class="min-w-0 space-y-2 rounded-2xl border border-slate-200 bg-slate-50/80 p-2.5">
            <div class="flex items-center justify-between gap-2">
              <Badge
                variant="outline"
                class="h-6 rounded-full border-slate-200 bg-white px-2.5 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-slate-600"
              >
                Unread
              </Badge>
              <span class="text-xs font-semibold text-slate-500">{unreadActors.length}</span>
            </div>
            {@render actorList(unreadActors, "unread", "Everybody is up to date")}
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
</style>
