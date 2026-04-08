<script lang="ts">
  import CircleHelp from "@lucide/svelte/icons/circle-help";
  import ImagePlus from "@lucide/svelte/icons/image-plus";
  import LoaderCircle from "@lucide/svelte/icons/loader-circle";
  import TextCursorInput from "@lucide/svelte/icons/text-cursor-input";

  import HelpHint from "../help-hint.svelte";
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

  const helpContext = $derived(capabilities.helpItems.map((item) => `${item.label}:${item.value}`).join(" | "));
  const statusMeta = $derived.by(() => {
    if (submitting) {
      return {
        label: "Sending",
        toneClassName: "border-amber-200 bg-amber-50 text-amber-800",
        Icon: LoaderCircle,
        iconClassName: "animate-spin",
      };
    }
    if (disabled) {
      return {
        label: "Unavailable",
        toneClassName: "border-slate-200 bg-slate-100 text-slate-600",
        Icon: TextCursorInput,
        iconClassName: "",
      };
    }
    if (capabilities.attachmentEnabled) {
      return {
        label: pendingAssetCount > 0 ? "Attachments ready" : "Draft + files",
        toneClassName: "border-teal-200 bg-teal-50 text-teal-800",
        Icon: ImagePlus,
        iconClassName: "",
      };
    }
    return {
      label: "Text draft",
      toneClassName: "border-slate-200 bg-slate-50 text-slate-700",
      Icon: TextCursorInput,
      iconClassName: "",
    };
  });
</script>

<div class="composer-status" data-composer-row="status" part="composer-status">
  <div class="composer-status-copy">
    <div class="composer-status-meta {statusMeta.toneClassName}">
      <statusMeta.Icon class={`size-3.5 shrink-0 ${statusMeta.iconClassName}`} />
      <span class="truncate">{statusMeta.label}</span>
    </div>

    {#if capabilities.helpItems.length > 0}
      <div class="composer-status-hints">
        {#each capabilities.helpItems.slice(0, 4) as item (`${item.label}:${item.value}`)}
          <span class="composer-status-hint">
            <span class="composer-status-hint-key">{item.label}</span>
            <span class="truncate">{item.value}</span>
          </span>
        {/each}
      </div>
    {/if}
  </div>

  <HelpHint
    helpId="web-chat-view:composer-shortcuts"
    textContext={`web-chat-view composer: ${helpContext}`}
    ariaLabel="Composer help"
    align="end"
    side="top"
    class="composer-help"
  >
    {#snippet children()}
      <div class="composer-help-trigger" aria-hidden="true">
        <CircleHelp class="size-3.5" />
      </div>
    {/snippet}
  </HelpHint>
</div>

<style>
  .composer-status {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.75rem;
    padding-top: 0.25rem;
  }

  .composer-status-copy {
    display: grid;
    gap: 0.45rem;
    min-width: 0;
  }

  .composer-status-meta {
    display: inline-flex;
    min-width: 0;
    align-items: center;
    gap: 0.4rem;
    border: 1px solid transparent;
    border-radius: 999px;
    padding: 0.25rem 0.6rem;
    font-size: 0.68rem;
    font-weight: 600;
    letter-spacing: 0.02em;
  }

  .composer-status-hints {
    display: flex;
    min-width: 0;
    flex-wrap: wrap;
    gap: 0.35rem;
  }

  .composer-status-hint {
    display: inline-flex;
    min-width: 0;
    align-items: center;
    gap: 0.35rem;
    border-radius: 999px;
    border: 1px solid rgba(226, 232, 240, 0.9);
    background: rgba(255, 255, 255, 0.72);
    padding: 0.18rem 0.5rem;
    font-size: 0.64rem;
    line-height: 1.35;
    color: #64748b;
  }

  .composer-status-hint-key {
    font-weight: 700;
    color: #0f172a;
  }

  .composer-help {
    display: inline-flex;
  }

  .composer-help-trigger {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.75rem;
    height: 1.75rem;
    border-radius: 999px;
    border: 1px solid rgba(203, 213, 225, 0.9);
    background: rgba(255, 255, 255, 0.88);
    color: #64748b;
  }

  @container (max-width: 34rem) {
    .composer-status-hints {
      display: none;
    }
  }
  </style>
