<script lang="ts">
  import { onDestroy } from "svelte";
  import LoaderCircle from "@lucide/svelte/icons/loader-circle";
  import FileUp from "@lucide/svelte/icons/file-up";
  import HelpCircle from "@lucide/svelte/icons/circle-help";
  import ImagePlus from "@lucide/svelte/icons/image-plus";
  import MonitorUp from "@lucide/svelte/icons/monitor-up";
  import Plus from "@lucide/svelte/icons/plus";
  import SendHorizontal from "@lucide/svelte/icons/send-horizontal";

  import type { WebChatComposerRenderProps } from "./types";
  import ChatDraftEditor from "./composer/chat-draft-editor.svelte";
  import ComposerToolSheet from "./composer/composer-tool-sheet.svelte";
  import ComposerStatusBar from "./composer/composer-status-bar.svelte";
  import {
    resolveComposerCapabilities,
  } from "./composer/composer-contract";
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
  import {
    commentResourceToReference,
    mergeResourceReferences,
    pendingAssetToResourceReference,
  } from "./resource-contract";
  import { Link, Messagebar, MessagebarSheetItem } from "./framework7-components";
  import type { WebChatCommentResourcePayload, WebChatResourceReference } from "./types";

  let {
    channel,
    disabled,
    sending,
    connectionState,
    hintText,
    capabilities,
    liveResourceReferences = [],
    draftInsertions = [],
    commentResourceInsertions = [],
    onDraftInsertionApplied,
    onCommentResourceInsertionApplied,
    onSubmit,
  }: WebChatComposerRenderProps & {
    liveResourceReferences?: readonly WebChatResourceReference[];
  } = $props();

  let fileInputRef = $state<HTMLInputElement | null>(null);
  let draft = $state("");
  let pendingAssets = $state<PendingAsset[]>([]);
  let pendingCommentResources = $state<WebChatCommentResourcePayload[]>([]);
  let dragging = $state(false);
  let dragDepth = 0;
  let notice = $state<string | null>(null);
  let toolsSheetVisible = $state(false);

  const composerCapabilities = $derived(
    resolveComposerCapabilities(
      {
        ...capabilities,
        resourceReferences: mergeResourceReferences(
          liveResourceReferences,
          mergeResourceReferences(
            pendingAssets.map((asset, index) => pendingAssetToResourceReference(asset, index)),
            pendingCommentResources.map((resource) => commentResourceToReference(resource)),
          ),
        ),
      },
      `Message ${channel.title}...`,
    ),
  );
  const canSubmit = $derived(
    !disabled &&
      !sending &&
      (draft.trim().length > 0 || pendingAssets.length > 0 || pendingCommentResources.length > 0),
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

  const removePendingCommentResource = (resourceId: string): void => {
    pendingCommentResources = pendingCommentResources.filter((resource) => resource.id !== resourceId);
  };

  const updatePendingCommentResource = (resourceId: string, commentText: string): void => {
    pendingCommentResources = pendingCommentResources.map((resource) =>
      resource.id === resourceId ? { ...resource, commentText } : resource,
    );
  };

  const resetDraftState = (): void => {
    draft = "";
    const released = pendingAssets;
    pendingAssets = [];
    pendingCommentResources = [];
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

  const openAttachPicker = (): void => {
    toolsSheetVisible = false;
    fileInputRef?.click();
  };

  const captureScreenshotFromTools = (): void => {
    toolsSheetVisible = false;
    void handleCaptureScreenshot();
  };

  const insertHelpTrigger = (): void => {
    toolsSheetVisible = false;
    const spacer = draft.length === 0 || /\s$/u.test(draft) ? "" : " ";
    draft = `${draft}${spacer}?`;
  };

  type ComposerToolItem = {
    key: string;
    label: string;
    icon: typeof ImagePlus;
    disabled: boolean;
    action: () => void;
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
    const nextCommentResources = pendingCommentResources;
    pendingAssets = [];
    pendingCommentResources = [];
    draft = "";

    try {
      await onSubmit({
        text: nextDraft,
        assets: nextAssets.map((asset) => asset.file),
        commentResources: nextCommentResources,
      });
      revokeAllPendingAssets(nextAssets);
    } catch (error) {
      pendingAssets = nextAssets;
      pendingCommentResources = nextCommentResources;
      draft = nextDraft;
      throw error;
    }
  };

  const composerToolItems = $derived<readonly ComposerToolItem[]>([
    {
      key: "photo",
      label: "Photo / video",
      icon: ImagePlus,
      disabled: disabled || sending || !composerCapabilities.attachmentEnabled,
      action: openAttachPicker,
    },
    {
      key: "file",
      label: "File",
      icon: FileUp,
      disabled: disabled || sending || !composerCapabilities.attachmentEnabled,
      action: openAttachPicker,
    },
    {
      key: "screenshot",
      label: "Screenshot",
      icon: MonitorUp,
      disabled: disabled || sending || !composerCapabilities.screenshotEnabled,
      action: captureScreenshotFromTools,
    },
    {
      key: "help",
      label: "Help",
      icon: HelpCircle,
      disabled: disabled || sending,
      action: insertHelpTrigger,
    },
  ]);

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

  $effect(() => {
    if (draftInsertions.length === 0) {
      return;
    }
    const unapplied = draftInsertions.filter((insertion) => insertion.text.length > 0);
    if (unapplied.length === 0) {
      return;
    }
    const suffix = unapplied.map((insertion) => insertion.text).join("");
    draft = `${draft}${suffix}`;
    for (const insertion of unapplied) {
      onDraftInsertionApplied?.(insertion.id);
    }
  });

  $effect(() => {
    if (commentResourceInsertions.length === 0) {
      return;
    }
    const nextResources = [...pendingCommentResources];
    let changed = false;
    for (const resource of commentResourceInsertions) {
      if (nextResources.some((existing) => existing.id === resource.id)) {
        continue;
      }
      nextResources.push(resource);
      changed = true;
    }
    if (!changed) {
      return;
    }
    pendingCommentResources = nextResources;
    for (const resource of commentResourceInsertions) {
      onCommentResourceInsertionApplied?.(resource.id);
    }
  });

  const commentResources = $derived(pendingCommentResources);
  const hasPendingResources = $derived(pendingAssets.length > 0 || commentResources.length > 0);
  const showComposerStatus = $derived(disabled || sending);
  const toolsDisabled = $derived(
    disabled || sending || (!composerCapabilities.attachmentEnabled && !composerCapabilities.screenshotEnabled),
  );

</script>

<Messagebar
  class={`composer ${dragging ? "composer-dragging" : ""}`}
  part="composer"
  role="group"
  aria-label="Message composer"
  attachmentsVisible={hasPendingResources}
  sheetVisible={toolsSheetVisible}
  resizable={false}
  resizePage={false}
  value=""
  placeholder=""
  ondragenter={handleDragEnter}
  ondragover={handleDragOver}
  ondragleave={handleDragLeave}
  ondrop={handleDrop}
  onpaste={handlePaste}
>
  {#snippet beforeInner()}
    <input
      bind:this={fileInputRef}
      type="file"
      accept="image/*,video/*,*/*"
      multiple
      class="composer-file-input"
      tabindex="-1"
      aria-hidden="true"
      onchange={(event) => {
        mergePendingFiles(Array.from(event.currentTarget.files ?? []));
        event.currentTarget.value = "";
      }}
    />
    {#if notice}
      <div class="composer-notice" part="composer-notice" role="status">
        {notice}
      </div>
    {/if}
  {/snippet}

  {#snippet innerStart()}
    <Link
      href={false}
      iconOnly
      class={`composer-action-link ${toolsSheetVisible ? "composer-action-link-active" : ""} ${toolsDisabled ? "composer-action-link-disabled" : ""}`}
      aria-label="Open message tools"
      title="Open message tools"
      aria-expanded={toolsSheetVisible}
      aria-disabled={toolsDisabled}
      tabindex={toolsDisabled ? -1 : undefined}
      onclick={() => {
        if (toolsDisabled) {
          return;
        }
        toolsSheetVisible = !toolsSheetVisible;
      }}
    >
      <Plus class="size-4" />
    </Link>
  {/snippet}

  {#snippet beforeArea()}
    <PendingAssetStrip
      assets={pendingAssets}
      {commentResources}
      onRemove={removePendingAsset}
      onRemoveComment={removePendingCommentResource}
      onUpdateComment={updatePendingCommentResource}
    />
  {/snippet}

  {#snippet afterArea()}
    <div class="composer-stage" part="composer-frame">
      <div class="composer-stack">
        <div class="composer-editor-shell" part="composer-editor-shell">
          <ChatDraftEditor
            value={draft}
            placeholder={composerCapabilities.placeholder}
            disabled={disabled}
            submitting={sending}
            capabilities={composerCapabilities}
            onChange={(value) => {
              draft = value;
              clearNotice();
            }}
            onSubmit={() => {
              void submit();
            }}
          />
        </div>
      </div>

      {#if showComposerStatus}
        <div class="composer-meta-row">
          <ComposerStatusBar
            disabled={disabled}
            submitting={sending}
            capabilities={composerCapabilities}
            pendingAssetCount={pendingAssets.length}
          />
        </div>
      {/if}

      <span class="composer-hint-sr" part="composer-hint" aria-live="polite">
        {hintText}
      </span>
    </div>
  {/snippet}

  {#snippet innerEnd()}
    <Link
      href={false}
      iconOnly
      class={`composer-send-link ${!canSubmit ? "composer-send-link-disabled" : ""}`}
      part="composer-send"
      aria-label={composerCapabilities.submitLabel}
      title={composerCapabilities.submitTitle ?? composerCapabilities.submitLabel}
      aria-disabled={!canSubmit}
      tabindex={canSubmit ? undefined : -1}
      data-testid="web-chat-composer-send"
      onclick={() => {
        if (!canSubmit) {
          return;
        }
        void submit();
      }}
    >
      {#if sending}
        <LoaderCircle class="size-4 animate-spin" />
      {:else}
        <SendHorizontal class="size-4" />
      {/if}
      <span class="composer-hint-sr">{composerCapabilities.submitLabel}</span>
    </Link>
  {/snippet}

  <ComposerToolSheet ariaLabel="Message tools">
    {#each composerToolItems as item (item.key)}
      <MessagebarSheetItem
        class={`composer-tool-sheet-item ${item.disabled ? "composer-tool-sheet-item-disabled" : ""}`}
        aria-disabled={item.disabled}
        tabindex={item.disabled ? -1 : undefined}
        role="button"
        onclick={(event: MouseEvent) => {
          event.preventDefault();
          if (item.disabled) {
            return;
          }
          item.action();
        }}
        onkeydown={(event: KeyboardEvent) => {
          if (item.disabled || (event.key !== "Enter" && event.key !== " ")) {
            return;
          }
          event.preventDefault();
          item.action();
        }}
      >
        <item.icon class="composer-tool-sheet-icon" />
        <span>{item.label}</span>
      </MessagebarSheetItem>
    {/each}
  </ComposerToolSheet>
</Messagebar>

<style>
  .composer-file-input {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
    border: 0;
  }

  :global(.composer.messagebar.toolbar) {
    position: relative;
    container-type: inline-size;
    font-size: var(--web-chat-body-font-size, 13px);
    line-height: var(--web-chat-body-line-height, 1.32);
    padding: 0;
    background: var(--f7-toolbar-bg-color, rgba(248, 248, 252, 0.94));
  }

  :global(.composer .toolbar-inner) {
    align-items: end;
    gap: 0.18rem;
    padding-inline: 0.1rem;
    padding-top: 0.1rem;
    padding-bottom: 0.1rem;
    min-width: 0;
  }

  :global(.composer .messagebar-area) {
    min-width: 0;
    display: grid;
    gap: 0.18rem;
    align-items: stretch;
  }

  :global(.composer .messagebar-area > textarea),
  :global(.composer .messagebar-area > .input) {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
    border: 0;
    opacity: 0;
    pointer-events: none;
  }

  :global(.composer-tool-sheet-item) {
    display: grid;
    place-items: center;
    gap: 0.18rem;
    min-width: 0;
    cursor: pointer;
    color: var(--f7-text-color, #111827);
    text-decoration: none;
  }

  :global(.composer-tool-sheet-item-disabled) {
    opacity: 0.36;
    pointer-events: none;
  }

  :global(.composer-tool-sheet-icon) {
    width: 0.92rem;
    height: 0.92rem;
    color: var(--f7-theme-color, #007aff);
  }

  :global(.composer-tool-sheet-item span) {
    max-width: 100%;
    overflow: hidden;
    color: rgba(60, 60, 67, 0.82);
    font-size: 0.53rem;
    font-weight: 560;
    line-height: 1.18;
    text-align: center;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .composer-stage {
    display: grid;
    gap: 0.12rem;
    min-width: 0;
  }

  .composer-stack {
    display: grid;
    gap: 0.06rem;
    min-width: 0;
  }

  .composer-editor-shell {
    position: relative;
    min-width: 0;
    border-radius: var(--f7-messagebar-textarea-border-radius, 1.35rem);
    border: 1px solid rgba(60, 60, 67, 0.08);
    background: var(--f7-messagebar-textarea-bg-color, rgba(255, 255, 255, 0.96));
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.74);
    backdrop-filter: none;
  }

  :global(.composer.composer-dragging) .composer-editor-shell {
    filter: saturate(1.05);
  }

  .composer-notice {
    border: 1px solid rgba(255, 159, 10, 0.18);
    border-radius: 14px;
    background: rgba(255, 249, 235, 0.94);
    color: #b45309;
    padding: 0.34rem 0.56rem;
    font-size: 12px;
    line-height: 1.35;
  }

  :global(.pending-resource-shelf) {
    min-width: 0;
    width: 100%;
  }

  :global(.composer .pending-resource-shelf.messagebar-attachments) {
    border: 0;
    border-radius: 0;
    background: transparent;
    box-shadow: none;
    backdrop-filter: none;
  }

  .composer-meta-row {
    min-width: 0;
    margin-top: 0.02rem;
    padding-inline: 0.12rem;
  }

  :global(.composer-action-link),
  :global(.composer-send-link) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin: 0;
    border-radius: 999px;
    text-decoration: none;
    box-shadow: inset 0 0 0 1px rgba(60, 60, 67, 0.08);
  }

  :global(.composer-action-link) {
    width: calc(var(--f7-messagebar-textarea-height, 2.4rem) - 0.06rem);
    min-width: calc(var(--f7-messagebar-textarea-height, 2.4rem) - 0.06rem);
    height: calc(var(--f7-messagebar-textarea-height, 2.4rem) - 0.06rem);
    color: var(--f7-theme-color, #007aff);
    background: rgba(255, 255, 255, 0.8);
    transition: opacity 140ms ease, background-color 140ms ease;
  }

  :global(.composer-action-link-active) {
    background: color-mix(in srgb, var(--f7-theme-color, #007aff) 12%, white);
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--f7-theme-color, #007aff) 24%, white);
  }

  :global(.composer-action-link-disabled) {
    opacity: 0.38;
    pointer-events: none;
  }

  :global(.composer-send-link) {
    width: calc(var(--f7-messagebar-textarea-height, 2.4rem) - 0.06rem);
    min-width: calc(var(--f7-messagebar-textarea-height, 2.4rem) - 0.06rem);
    height: calc(var(--f7-messagebar-textarea-height, 2.4rem) - 0.06rem);
    background: color-mix(in srgb, var(--f7-theme-color, #007aff) 12%, white);
    color: var(--f7-theme-color, #007aff);
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--f7-theme-color, #007aff) 18%, white);
  }

  :global(.composer-send-link-disabled) {
    opacity: 0.56;
    background: rgba(255, 255, 255, 0.76);
    color: rgba(60, 60, 67, 0.42);
    box-shadow: inset 0 0 0 1px rgba(60, 60, 67, 0.08);
    pointer-events: none;
  }

  .composer-hint-sr {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
    border: 0;
  }

  @container (max-width: 34rem) {
    .composer-stage {
      gap: 0.12rem;
    }

  }
</style>
