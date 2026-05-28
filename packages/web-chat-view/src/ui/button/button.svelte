<script lang="ts" module>
  import type { HTMLAnchorAttributes, HTMLButtonAttributes } from "svelte/elements";

  import type { WithElementRef } from "../utils";

  export type ButtonVariant = "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  export type ButtonSize = "default" | "sm" | "lg" | "icon" | "icon-sm";
  export type ButtonProps = WithElementRef<HTMLButtonAttributes> &
    WithElementRef<HTMLAnchorAttributes> & {
      variant?: ButtonVariant;
      size?: ButtonSize;
    };

  export const buttonVariants = ({
    variant = "default",
    size = "default",
  }: {
    variant?: ButtonVariant;
    size?: ButtonSize;
  } = {}): string => {
    const classes = ["button", "web-chat-f7-button"];

    switch (variant) {
      case "default":
        classes.push("button-fill");
        break;
      case "destructive":
        classes.push("button-fill", "color-red");
        break;
      case "outline":
        classes.push("button-outline");
        break;
      case "secondary":
        classes.push("button-tonal");
        break;
      case "ghost":
        classes.push("web-chat-f7-button--ghost");
        break;
      case "link":
        classes.push("web-chat-f7-button--link");
        break;
    }

    switch (size) {
      case "sm":
        classes.push("button-small");
        break;
      case "lg":
        classes.push("button-large");
        break;
      case "icon":
        classes.push("web-chat-f7-button--icon");
        break;
      case "icon-sm":
        classes.push("button-small", "web-chat-f7-button--icon");
        break;
    }

    return classes.join(" ");
  };
</script>

<script lang="ts">
  import type { Snippet } from "svelte";

  import { cn } from "../utils";

  let {
    class: className,
    variant = "default",
    size = "default",
    ref = $bindable(null),
    href = undefined,
    type = "button",
    disabled = false,
    children,
    ...restProps
  }: ButtonProps & { children?: Snippet | unknown } = $props();

  const resolveChildren = (): Snippet | null => {
    return typeof children === "function" ? children : null;
  };

  const childSnippet = $derived.by(resolveChildren);
  const resolvedClassName = $derived(cn(buttonVariants({ variant, size }), className));
</script>

{#if href}
  <a
    bind:this={ref}
    data-slot="button"
    class={resolvedClassName}
    href={disabled ? undefined : href}
    aria-disabled={disabled ? "true" : undefined}
    role={disabled ? "link" : undefined}
    tabindex={disabled ? -1 : undefined}
    {...restProps}
  >
    {@render childSnippet?.()}
  </a>
{:else}
  <button
    bind:this={ref}
    data-slot="button"
    class={resolvedClassName}
    type={type ?? "button"}
    disabled={disabled ?? false}
    {...restProps}
  >
    {@render childSnippet?.()}
  </button>
{/if}

<style>
  :global(.web-chat-f7-button) {
    gap: 0.45rem;
    min-width: 0;
    border-radius: 14px;
    font-weight: 600;
    box-shadow: none;
  }

  :global(.web-chat-f7-button.button) {
    transition:
      opacity 160ms ease,
      transform 160ms ease;
  }

  :global(.web-chat-f7-button--ghost.button) {
    background: transparent;
    color: var(--f7-theme-color, #007aff);
  }

  :global(.web-chat-f7-button--ghost.button:not(.disabled):active) {
    opacity: 0.72;
  }

  :global(.web-chat-f7-button--link.button) {
    background: transparent;
    color: var(--f7-theme-color, #007aff);
    padding-inline: 0;
  }

  :global(.web-chat-f7-button--icon.button) {
    width: 2.25rem;
    min-width: 2.25rem;
    padding-inline: 0;
  }

  :global(.web-chat-f7-button.button-small.web-chat-f7-button--icon) {
    width: 1.9rem;
    min-width: 1.9rem;
  }
</style>
