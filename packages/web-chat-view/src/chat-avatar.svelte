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
  class={cn(
    "relative flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/70 bg-slate-100 text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-slate-600 shadow-[0_10px_26px_rgba(15,23,42,0.08)]",
    className,
  )}
>
  {#if src && !broken}
    <img
      src={src}
      alt={label}
      class="h-full w-full object-cover"
      loading="lazy"
      onerror={() => {
        broken = true;
      }}
    />
  {/if}
  {#if !src || broken}
    <span>{initials}</span>
  {/if}
</div>
