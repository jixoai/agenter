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
    <span>{capabilities.submitLabel}</span>
  </button>
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
