<script lang="ts" module>
  export type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

  export const badgeVariants = ({
    variant = "default",
  }: {
    variant?: BadgeVariant;
  } = {}): string => {
    return ["web-chat-f7-badge", variant === "outline" ? "web-chat-f7-badge--outline" : ""]
      .filter(Boolean)
      .join(" ");
  };
</script>

<script lang="ts">
  import type { HTMLAnchorAttributes } from "svelte/elements";

  import { Badge as F7Badge } from "../../framework7-components";
  import { cn, type WithElementRef } from "../utils";

  let {
    href,
    class: className,
    variant = "default",
    children,
    ...restProps
  }: WithElementRef<HTMLAnchorAttributes> & {
    variant?: BadgeVariant;
  } = $props();

  const color = $derived.by(() => {
    switch (variant) {
      case "secondary":
        return "gray";
      case "destructive":
        return "red";
      default:
        return undefined;
    }
  });
</script>

{#if href}
  <a href={href} class={`web-chat-f7-badge-link ${className ?? ""}`} {...restProps}>
    <span class={cn(badgeVariants({ variant }), className)}>
      <F7Badge color={color ?? undefined}>
        {@render children?.()}
      </F7Badge>
    </span>
  </a>
{:else}
  <span class={cn(badgeVariants({ variant }), className)}>
    <F7Badge color={color ?? undefined}>
      {@render children?.()}
    </F7Badge>
  </span>
{/if}

<style>
  :global(.web-chat-f7-badge.badge) {
    min-width: 0;
    padding-inline: 0.48rem;
    border-radius: 999px;
    font-size: 0.68rem;
    font-weight: 600;
  }

  :global(.web-chat-f7-badge--outline.badge) {
    background: color-mix(in srgb, var(--f7-card-bg-color, #fff) 92%, transparent);
    border: 1px solid color-mix(in srgb, var(--f7-list-outline-border-color, #cfd8e3) 88%, transparent);
    color: var(--f7-text-color, #1f2937);
  }

  .web-chat-f7-badge-link {
    text-decoration: none;
  }
</style>
