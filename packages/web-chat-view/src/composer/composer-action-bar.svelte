<script lang="ts">
  import ImagePlus from "@lucide/svelte/icons/image-plus";
  import LoaderCircle from "@lucide/svelte/icons/loader-circle";
  import MonitorUp from "@lucide/svelte/icons/monitor-up";
  import Paperclip from "@lucide/svelte/icons/paperclip";
  import SendHorizontal from "@lucide/svelte/icons/send-horizontal";

  import { Button } from "../ui/button";
  import type { ResolvedWebChatComposerCapabilities } from "./composer-contract";

  let {
    disabled,
    submitting,
    canSubmit,
    capabilities,
    onAttach,
    onCaptureScreenshot,
    onSubmit,
  }: {
    disabled: boolean;
    submitting: boolean;
    canSubmit: boolean;
    capabilities: ResolvedWebChatComposerCapabilities;
    onAttach: () => void;
    onCaptureScreenshot: () => void;
    onSubmit: () => void;
  } = $props();
</script>

<div class="composer-actions" data-composer-row="actions" part="composer-actions">
  <div class="composer-actions-leading">
    {#if capabilities.attachmentEnabled}
      <Button
        type="button"
        size="sm"
        variant="outline"
        class="composer-action-chip"
        disabled={disabled || submitting}
        title="Attach files"
        onclick={onAttach}
      >
        {#if capabilities.imageEnabled}
          <ImagePlus class="size-4" />
        {:else}
          <Paperclip class="size-4" />
        {/if}
        <span class="composer-action-label">Attach</span>
      </Button>
    {/if}

    {#if capabilities.screenshotEnabled}
      <Button
        type="button"
        size="sm"
        variant="outline"
        class="composer-action-chip"
        disabled={disabled || submitting}
        title="Capture screenshot"
        onclick={onCaptureScreenshot}
      >
        <MonitorUp class="size-4" />
        <span class="composer-action-label">Screenshot</span>
      </Button>
    {/if}
  </div>

  <Button
    type="button"
    size="sm"
    class="composer-send"
    disabled={!canSubmit}
    title={capabilities.submitTitle ?? capabilities.submitLabel}
    part="composer-send"
    onclick={onSubmit}
  >
    {#if submitting}
      <LoaderCircle class="size-4 animate-spin" />
    {:else}
      <SendHorizontal class="size-4" />
    {/if}
    <span>{capabilities.submitLabel}</span>
  </Button>
</div>

<style>
  .composer-actions {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.75rem;
  }

  .composer-actions-leading {
    display: flex;
    min-width: 0;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  :global(.composer-action-chip) {
    min-width: 0;
    border-radius: 999px;
    border-color: rgba(203, 213, 225, 0.88);
    background: rgba(255, 255, 255, 0.74);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.78);
  }

  :global(.composer-send) {
    min-width: 7.5rem;
    border-radius: 999px;
    box-shadow: 0 18px 32px -24px rgba(15, 23, 42, 0.46);
  }

  @container (max-width: 34rem) {
    .composer-action-label {
      display: none;
    }

    :global(.composer-action-chip) {
      width: 2rem;
      padding-inline: 0;
    }
  }

  @container (max-width: 28rem) {
    .composer-actions {
      grid-template-columns: 1fr;
    }

    :global(.composer-send) {
      width: 100%;
    }
  }
</style>
