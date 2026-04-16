<script lang="ts">
  import ImagePlus from "@lucide/svelte/icons/image-plus";
  import LoaderCircle from "@lucide/svelte/icons/loader-circle";
  import MonitorUp from "@lucide/svelte/icons/monitor-up";
  import Paperclip from "@lucide/svelte/icons/paperclip";
  import SendHorizontal from "@lucide/svelte/icons/send-horizontal";

  import { buttonVariants } from "../ui/button";
  import { cn } from "../ui/utils";
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
    <button
      type="button"
      class={cn(buttonVariants({ size: "sm", variant: "outline" }), "composer-action-chip")}
      disabled={disabled || submitting}
      title="Attach files"
      hidden={!capabilities.attachmentEnabled}
      aria-hidden={!capabilities.attachmentEnabled}
      onclick={onAttach}
    >
      <span class:hidden={!capabilities.imageEnabled}>
        <ImagePlus class="size-4" />
      </span>
      <span class:hidden={capabilities.imageEnabled}>
        <Paperclip class="size-4" />
      </span>
      <span class="composer-action-label">Attach</span>
    </button>

    <button
      type="button"
      class={cn(buttonVariants({ size: "sm", variant: "outline" }), "composer-action-chip")}
      disabled={disabled || submitting}
      title="Capture screenshot"
      hidden={!capabilities.screenshotEnabled}
      aria-hidden={!capabilities.screenshotEnabled}
      onclick={onCaptureScreenshot}
    >
      <MonitorUp class="size-4" />
      <span class="composer-action-label">Screenshot</span>
    </button>
  </div>

  <button
    type="button"
    class={cn(buttonVariants({ size: "sm" }), "composer-send")}
    disabled={!canSubmit}
    title={capabilities.submitTitle ?? capabilities.submitLabel}
    part="composer-send"
    onclick={onSubmit}
  >
    <span class:hidden={!submitting}>
      <LoaderCircle class="size-4 animate-spin" />
    </span>
    <span class:hidden={submitting}>
      <SendHorizontal class="size-4" />
    </span>
    <span class="composer-send-label">{capabilities.submitLabel}</span>
  </button>
</div>

<style>
  .composer-actions {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.5rem;
  }

  .composer-actions-leading {
    display: flex;
    min-width: 0;
    flex-wrap: wrap;
    gap: 0.375rem;
  }

  :global(.composer-action-chip) {
    min-width: 0;
    border-radius: 0.8rem;
    border-color: transparent;
    background: rgba(255, 255, 255, 0.34);
    box-shadow: none;
  }

  :global(.composer-send) {
    min-width: 5.25rem;
    border-radius: 0.82rem;
    padding-inline: 0.85rem;
    box-shadow: none;
  }

  @container (max-width: 34rem) {
    .composer-action-label {
      display: none;
    }

    :global(.composer-action-chip) {
      width: 2rem;
      min-width: 2rem;
      padding-inline: 0;
      border-radius: 0.72rem;
    }

    :global(.composer-send) {
      min-width: 4.8rem;
      padding-inline: 0.72rem;
    }
  }

  @container (max-width: 22rem) {
    :global(.composer-send) {
      min-width: 2rem;
      padding-inline: 0.6rem;
    }

    .composer-send-label {
      display: none;
    }
  }
</style>
