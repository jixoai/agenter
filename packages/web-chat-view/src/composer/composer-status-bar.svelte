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
    if (pendingAssetCount > 0) {
      return {
        label: `${pendingAssetCount} ${pendingAssetCount === 1 ? "file" : "files"} ready`,
        toneClassName: "text-teal-700",
        Icon: ImagePlus,
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
    return null;
  });
</script>

<div
  class="composer-status"
  data-composer-row="status"
  data-has-meta={statusMeta ? "true" : "false"}
  part="composer-status"
>
  <div class="composer-status-copy">
    {#if statusMeta}
      <div class="composer-status-meta {statusMeta.toneClassName}">
        <statusMeta.Icon class={`size-3.5 shrink-0 ${statusMeta.iconClassName}`} />
        <span class="truncate">{statusMeta.label}</span>
      </div>
    {/if}

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

  {#if capabilities.helpItems.length > 0}
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
  {/if}
</div>

<style>
  .composer-status {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: flex-start;
    gap: 0.5rem;
    padding-top: 0.1rem;
  }

  .composer-status-copy {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.18rem 0.55rem;
    min-width: 0;
  }

  .composer-status-meta {
    display: inline-flex;
    min-width: 0;
    align-items: center;
    gap: 0.35rem;
    padding: 0;
    font-size: 0.64rem;
    font-weight: 600;
    letter-spacing: 0.01em;
  }

  .composer-status-hints {
    display: flex;
    min-width: 0;
    flex-wrap: wrap;
    gap: 0.18rem 0.48rem;
  }

  .composer-status-hint {
    display: inline-flex;
    min-width: 0;
    align-items: center;
    gap: 0.28rem;
    padding: 0;
    font-size: 0.58rem;
    line-height: 1.3;
    color: #64748b;
  }

  .composer-status-hint-key {
    font-weight: 700;
    color: #0f172a;
  }

  .composer-help {
    display: inline-flex;
    align-self: flex-start;
  }

  .composer-help-trigger {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.25rem;
    height: 1.25rem;
    border-radius: 0.5rem;
    border: 0;
    background: transparent;
    color: #94a3b8;
  }

  @container (max-width: 34rem) {
    .composer-status[data-has-meta="false"] {
      display: none;
    }

    .composer-status-hints {
      display: none;
    }

    .composer-help {
      display: none;
    }
  }

  @media (max-width: 430px) {
    .composer-status[data-has-meta="false"] {
      display: none;
    }

    .composer-status-hints,
    .composer-help {
      display: none;
    }
  }
</style>
