<script lang="ts">
  import { onDestroy } from "svelte";

  import type { WebChatComposerRenderProps } from "./types";
  import ComposerActionBar from "./composer/composer-action-bar.svelte";
  import ComposerStatusBar from "./composer/composer-status-bar.svelte";
  import {
    resolveComposerCapabilities,
  } from "./composer/composer-contract";
  import { Textarea } from "./ui/textarea";
  import {
    canCaptureDisplayScreenshot,
    captureDisplayScreenshot,
  } from "./composer/capture-display-screenshot";
  import PendingAssetStrip from "./composer/pending-asset-strip.svelte";
  import {
    createPendingAsset,
    extractFilesFromTransfer,
    hasFileTransfer,
    normalizeAttachableFiles,
    revokePendingAssetPreview,
    type PendingAsset,
  } from "./composer/pending-assets";

  let {
    channel,
    disabled,
    sending,
    connectionState,
    hintText,
    capabilities,
    onSubmit,
  }: WebChatComposerRenderProps = $props();

  let fileInputRef = $state<HTMLInputElement | null>(null);
  let draft = $state("");
  let pendingAssets = $state<PendingAsset[]>([]);
  let dragging = $state(false);
  let dragDepth = 0;
  let notice = $state<string | null>(null);

  const composerCapabilities = $derived(
    resolveComposerCapabilities(capabilities, `Message ${channel.title}...`),
  );
  const canSubmit = $derived(
    !disabled && !sending && (draft.trim().length > 0 || pendingAssets.length > 0),
  );

  const clearNotice = (): void => {
    notice = null;
  };

  const revokeAllPendingAssets = (assets: PendingAsset[]): void => {
    for (const asset of assets) {
      revokePendingAssetPreview(asset);
    }
  };

  const mergePendingFiles = (files: File[]): void => {
    if (files.length === 0) {
      return;
    }
    clearNotice();
    const nextFiles = normalizeAttachableFiles(files, composerCapabilities.imageEnabled);
    if (nextFiles.length === 0) {
      return;
    }
    const seen = pendingAssets.map((asset) =>
      [asset.file.name, asset.file.type, asset.file.size, asset.file.lastModified].join(":"),
    );
    const merged = nextFiles.filter((file) => {
      const signature = [file.name, file.type, file.size, file.lastModified].join(":");
      if (seen.includes(signature)) {
        return false;
      }
      seen.push(signature);
      return true;
    });
    pendingAssets = [...pendingAssets, ...merged.map((file) => createPendingAsset(file))];
  };

  const removePendingAsset = (assetId: string): void => {
    const target = pendingAssets.find((asset) => asset.id === assetId);
    if (target) {
      revokePendingAssetPreview(target);
    }
    pendingAssets = pendingAssets.filter((asset) => asset.id !== assetId);
  };

  const resetDraftState = (): void => {
    draft = "";
    const released = pendingAssets;
    pendingAssets = [];
    revokeAllPendingAssets(released);
  };

  const handleCaptureScreenshot = async (): Promise<void> => {
    if (!composerCapabilities.screenshotEnabled || !canCaptureDisplayScreenshot()) {
      notice = "Screen capture is not supported in this browser.";
      return;
    }
    clearNotice();
    try {
      mergePendingFiles([await captureDisplayScreenshot()]);
    } catch (error) {
      notice =
        error instanceof Error ? error.message : "Screen capture was canceled or blocked by the browser.";
    }
  };

  const submit = async (): Promise<void> => {
    if (!canSubmit) {
      return;
    }
    if (draft.trim() === "/screenshot" && composerCapabilities.screenshotEnabled && pendingAssets.length === 0) {
      draft = "";
      await handleCaptureScreenshot();
      return;
    }

    const nextDraft = draft.trim();
    const nextAssets = pendingAssets;
    pendingAssets = [];
    draft = "";

    try {
      await onSubmit({
        text: nextDraft,
        assets: nextAssets.map((asset) => asset.file),
      });
      revokeAllPendingAssets(nextAssets);
    } catch (error) {
      pendingAssets = nextAssets;
      draft = nextDraft;
      throw error;
    }
  };

  const handleDragEnter = (event: DragEvent): void => {
    if (!hasFileTransfer(event.dataTransfer)) {
      return;
    }
    event.preventDefault();
    dragDepth += 1;
    dragging = true;
  };

  const handleDragOver = (event: DragEvent): void => {
    if (!hasFileTransfer(event.dataTransfer)) {
      return;
    }
    event.preventDefault();
    dragging = true;
  };

  const handleDragLeave = (event: DragEvent): void => {
    if (!hasFileTransfer(event.dataTransfer)) {
      return;
    }
    event.preventDefault();
    dragDepth = Math.max(0, dragDepth - 1);
    const currentTarget = event.currentTarget as HTMLElement | null;
    if (dragDepth === 0 && !currentTarget?.contains(event.relatedTarget as Node | null)) {
      dragging = false;
    }
  };

  const handleDrop = (event: DragEvent): void => {
    if (!hasFileTransfer(event.dataTransfer)) {
      return;
    }
    event.preventDefault();
    dragDepth = 0;
    dragging = false;
    mergePendingFiles(
      extractFilesFromTransfer(event.dataTransfer, {
        imageEnabled: composerCapabilities.imageEnabled,
      }),
    );
  };

  const handleTextareaKeydown = (event: KeyboardEvent): void => {
    if (
      event.key !== "Enter" ||
      event.shiftKey ||
      event.metaKey ||
      event.ctrlKey ||
      event.altKey ||
      event.isComposing
    ) {
      return;
    }
    event.preventDefault();
    void submit();
  };

  const handlePaste = (event: ClipboardEvent): void => {
    const files = extractFilesFromTransfer(event.clipboardData, {
      imageEnabled: composerCapabilities.imageEnabled,
      imageOnly: true,
    });
    if (files.length === 0) {
      return;
    }
    event.preventDefault();
    mergePendingFiles(files);
  };

  onDestroy(() => {
    revokeAllPendingAssets(pendingAssets);
  });
</script>

<section
  class="composer"
  class:dragging
  part="composer"
  role="group"
  aria-label="Message composer"
  ondragenter={handleDragEnter}
  ondragover={handleDragOver}
  ondragleave={handleDragLeave}
  ondrop={handleDrop}
  onpaste={handlePaste}
>
  <input
    bind:this={fileInputRef}
    type="file"
    accept="image/*,video/*,*/*"
    multiple
    class="hidden"
    onchange={(event) => {
      mergePendingFiles(Array.from(event.currentTarget.files ?? []));
      event.currentTarget.value = "";
    }}
  />

  <div class="composer-frame" part="composer-frame">
    {#if notice}
      <div class="composer-notice" part="composer-notice" role="status">
        {notice}
      </div>
    {/if}

    <PendingAssetStrip assets={pendingAssets} onRemove={removePendingAsset} />

    <Textarea
      class="composer-textarea"
      rows={4}
      value={draft}
      placeholder={composerCapabilities.placeholder}
      disabled={disabled || sending}
      oninput={(event) => {
        const target = event.currentTarget as HTMLTextAreaElement;
        draft = target.value;
        if (notice) {
          notice = null;
        }
      }}
      onkeydown={handleTextareaKeydown}
    />

    <div class="composer-toolbar">
      <ComposerActionBar
        disabled={disabled}
        submitting={sending}
        {canSubmit}
        capabilities={composerCapabilities}
        onAttach={() => {
          fileInputRef?.click();
        }}
        onCaptureScreenshot={() => {
          void handleCaptureScreenshot();
        }}
        onSubmit={() => {
          void submit();
        }}
      />

      <div class="composer-footnote">
        <span class="composer-hint" part="composer-hint" aria-live="polite">
          {hintText}
        </span>
        <ComposerStatusBar
          disabled={disabled}
          submitting={sending}
          capabilities={composerCapabilities}
          pendingAssetCount={pendingAssets.length}
        />
      </div>
    </div>
  </div>
</section>

<style>
  .composer {
    padding: 0.75rem 0 0;
    container-type: inline-size;
  }

  .composer-frame {
    display: grid;
    gap: 0.75rem;
    border: 1px solid rgba(226, 232, 240, 0.95);
    border-radius: 1.2rem;
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(248, 250, 252, 0.94)),
      radial-gradient(circle at top, rgba(20, 184, 166, 0.08), transparent 54%);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.82),
      0 22px 46px -40px rgba(15, 23, 42, 0.35);
    padding: 0.8rem;
  }

  .composer.dragging .composer-frame {
    background:
      linear-gradient(180deg, rgba(240, 253, 250, 0.94), rgba(236, 253, 245, 0.92)),
      radial-gradient(circle at top, rgba(20, 184, 166, 0.16), transparent 58%);
  }

  .composer-notice {
    border: 1px solid rgba(245, 158, 11, 0.32);
    border-radius: 1rem;
    background: rgba(255, 251, 235, 0.96);
    color: #b45309;
    padding: 0.7rem 0.85rem;
    font-size: 0.8rem;
    line-height: 1.5;
  }

  .composer-toolbar {
    display: grid;
    gap: 0.65rem;
  }

  :global(.composer-textarea) {
    min-block-size: 5rem;
    resize: vertical;
    border-radius: 1rem;
    border-color: rgba(226, 232, 240, 0.95);
    background: rgba(255, 255, 255, 0.78);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.72);
  }

  .composer-footnote {
    display: grid;
    gap: 0.55rem;
  }

  .composer-hint {
    color: rgba(100, 116, 139, 0.96);
    font-size: 0.72rem;
    line-height: 1.45;
  }

  @container (max-width: 34rem) {
    .composer {
      padding-top: 0.45rem;
    }

    .composer-frame {
      gap: 0.55rem;
      padding: 0.65rem;
    }

    .composer-footnote {
      gap: 0.4rem;
    }

    .composer-hint {
      display: none;
    }
  }
</style>
