<script lang="ts">
  let {
    label,
    src = null,
    large = false,
  }: {
    label: string;
    src?: string | null;
    large?: boolean;
  } = $props();

  const initials = $derived(
    label
      .split(/\s+/u)
      .filter(Boolean)
      .slice(0, 2)
      .map((segment) => segment[0]?.toUpperCase() ?? "")
      .join("") || "?",
  );

  const rasterSrc = $derived.by(() => {
    if (!src?.trim() || !src.includes("/media/") || typeof window === "undefined") {
      return src;
    }
    try {
      const url = new URL(src, window.location.href);
      if (url.searchParams.get("format") === "svg") {
        return url.toString();
      }
      url.searchParams.set("size", large ? "160" : "96");
      return url.toString();
    } catch {
      return src;
    }
  });
</script>

<span class:heartbeat-avatar-media--large={large} class="heartbeat-avatar-media" aria-label={label}>
  {#if rasterSrc}
    <img src={rasterSrc} alt={label} />
  {:else}
    <span>{initials}</span>
  {/if}
</span>
