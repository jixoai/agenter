<script lang="ts">
  import LoaderCircle from "@lucide/svelte/icons/loader-circle";
  import TextCursorInput from "@lucide/svelte/icons/text-cursor-input";

  import type { ResolvedWebChatComposerCapabilities } from "./composer-contract";

  let {
    disabled,
    submitting,
    capabilities,
    pendingAssetCount,
  }: {
    disabled: boolean;
    submitting: boolean;
    capabilities: ResolvedWebChatComposerCapabilities;
    pendingAssetCount: number;
  } = $props();

  const statusMeta = $derived.by(() => {
    if (submitting) {
      return {
        label: "Sending",
        toneClassName: "text-amber-700",
        Icon: LoaderCircle,
        iconClassName: "animate-spin",
      };
    }
    if (disabled) {
      return {
        label: "Unavailable",
        toneClassName: "text-slate-500",
        Icon: TextCursorInput,
        iconClassName: "",
      };
    }
    if (!capabilities.attachmentEnabled) {
      return {
        label: "Text draft",
        toneClassName: "text-slate-600",
        Icon: TextCursorInput,
        iconClassName: "",
      };
    }
    if (capabilities.helpItems.length > 0) {
      return {
        label: "Type ? for help",
        toneClassName: "text-slate-500",
        Icon: null,
        iconClassName: "",
      };
    }
    return {
      label: "",
      toneClassName: "text-slate-500",
      Icon: null,
      iconClassName: "",
    };
  });
</script>

<div
  class="composer-status"
  data-composer-row="status"
  part="composer-status"
>
  {#if statusMeta?.label}
    <div class="composer-status-meta {statusMeta.toneClassName}">
      {#if statusMeta.Icon}
        <statusMeta.Icon class={`size-3.5 shrink-0 ${statusMeta.iconClassName}`} />
      {/if}
      <span class="truncate">{statusMeta.label}</span>
    </div>
  {/if}
</div>

<style>
  .composer-status {
    min-height: 0.88rem;
    display: flex;
    align-items: center;
    padding-inline: 0.24rem;
    color: var(--f7-text-color-secondary, #6b7280);
  }

  .composer-status-meta {
    display: inline-flex;
    min-width: 0;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.64rem;
    font-weight: 600;
    letter-spacing: 0;
  }

  @container (max-width: 34rem) {
    .composer-status {
      min-height: 0.8rem;
      padding-inline: 0.14rem;
    }
  }
</style>
