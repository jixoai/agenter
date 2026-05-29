<script lang="ts">
  import { cn } from "./ui/utils";

  let {
    label,
    subtitle = undefined,
    src = null,
    class: className = "",
    part = "avatar",
  }: {
    label: string;
    subtitle?: string;
    src?: string | null;
    class?: string;
    part?: string;
  } = $props();

  let broken = $state(false);

  const initials = $derived(
    label
      .split(/\s+/u)
      .filter(Boolean)
      .slice(0, 2)
      .map((segment) => segment[0]?.toUpperCase() ?? "")
      .join("") || "?",
  );
  const title = $derived(subtitle ? `${label} · ${subtitle}` : label);
</script>

<div
  {title}
  part={part}
  class={cn("chat-avatar", className)}
>
  {#if src && !broken}
    <img
      src={src}
      alt={label}
      class="chat-avatar-image"
      loading="lazy"
      onerror={() => {
        broken = true;
      }}
    />
  {/if}
  {#if !src || broken}
    <span class="chat-avatar-initials">{initials}</span>
  {/if}
</div>

<style>
  .chat-avatar {
    position: relative;
    display: flex;
    inline-size: var(--web-chat-avatar-size, 1.625rem);
    block-size: var(--web-chat-avatar-size, 1.625rem);
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    border: 1px solid rgba(0, 0, 0, 0.05);
    border-radius: var(--web-chat-avatar-radius, 999px);
    background: #d0d5dd;
    color: #475467;
    font-size: var(--web-chat-avatar-font-size, 0.58rem);
    font-weight: 600;
    letter-spacing: 0.01em;
    line-height: 1;
    text-transform: uppercase;
  }

  .chat-avatar-image {
    display: block;
    inline-size: 100%;
    block-size: 100%;
    object-fit: cover;
  }

  .chat-avatar-initials {
    display: block;
    max-inline-size: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
