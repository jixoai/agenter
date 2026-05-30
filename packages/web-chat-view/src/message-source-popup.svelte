<script lang="ts">
  import Copy from "@lucide/svelte/icons/copy";
  import Ellipsis from "@lucide/svelte/icons/ellipsis";
  import MessageSquareDot from "@lucide/svelte/icons/message-square-dot";
  import Save from "@lucide/svelte/icons/save";
  import X from "@lucide/svelte/icons/x";
  import { onDestroy, tick } from "svelte";

  import ChatAvatar from "./chat-avatar.svelte";
  import { writeClipboardText } from "./clipboard";
  import CommentAnchorBadge from "./comment-anchor-badge.svelte";
  import {
    Card,
    CardContent,
    CardHeader,
    Link,
    List,
    ListInput,
    NavLeft,
    Navbar,
    NavRight,
    Page,
    PageContent,
    Popup,
    Sheet,
    Toolbar,
    View,
  } from "./framework7-components";
  import { useFramework7Runtime } from "./framework7-host";
  import { showFramework7Toast } from "./framework7-toast";
  import { isRecalledMessage } from "./message-utils";
  import { buildCommentResourceSourceUri, serializeMessageSourceMarkdown } from "./resource-contract";
  import SelectionActionSurface from "./selection-action-surface.svelte";
  import type {
    WebChatActorPresentation,
    WebChatCommentDraftRequest,
    WebChatMessage,
    WebChatResourceReference,
  } from "./types";

  type SourceCommentAnchor = {
    id: string;
    label: string;
    lineNumber: number;
    selectedText: string;
    commentText: string;
    sourceUri?: string | undefined;
  };

  let {
    message,
    actorPresentation,
    resourceReferences = [],
    open = false,
    activeLineNumber = 1,
    onOpenChange,
    onCreateCommentDraft,
  }: {
    message: WebChatMessage | null;
    actorPresentation: WebChatActorPresentation | null;
    resourceReferences?: readonly WebChatResourceReference[];
    open?: boolean;
    activeLineNumber?: number;
    onOpenChange?: (next: boolean) => void;
    onCreateCommentDraft?: (input: WebChatCommentDraftRequest) => void | Promise<void>;
  } = $props();

  let fallbackToastText = $state<string | null>(null);
  let fallbackToastTimer: ReturnType<typeof setTimeout> | null = null;
  let scrollSurfaceRef = $state<HTMLDivElement | null>(null);
  let retainedMessage = $state<WebChatMessage | null>(null);
  let selectedLineNumber = $state(1);
  let selectionActionsOpen = $state(false);
  let sourceCommentAnchors = $state<SourceCommentAnchor[]>([]);
  let activeCommentAnchorId = $state<string | null>(null);
  let commentAnchorMode = $state<"view" | "edit" | null>(null);
  let commentDraft = $state("");
  let lastOpenedKey = "";
  let selectionActionButtonRef = $state<HTMLElement | null>(null);

  const framework7Runtime = useFramework7Runtime();
  const activeMessage = $derived(open ? message : retainedMessage);
  const resolvedOpen = $derived(Boolean(open && activeMessage));
  const resolvedActor = $derived(
    actorPresentation ?? {
      label: activeMessage?.from ?? "Unknown sender",
      subtitle: undefined,
      iconUrl: null,
    },
  );
  const sourceText = $derived.by(() => {
    if (!activeMessage) {
      return "";
    }
    return serializeMessageSourceMarkdown({
      chatId: activeMessage.chatId,
      content: activeMessage.content,
      attachments: activeMessage.attachments ?? [],
      metadata: activeMessage.metadata,
      resourceReferences,
      messageId: activeMessage.messageId,
      viewKey: activeMessage.viewKey,
      senderActorId: resolvedActor.actorId ?? activeMessage.senderContactId ?? null,
      from: activeMessage.from,
    });
  });
  const sourceLines = $derived(sourceText.split(/\r?\n/u));
  const safeActiveLineNumber = $derived.by(() => {
    const lineCount = Math.max(1, sourceLines.length);
    return Math.min(Math.max(activeLineNumber, 1), lineCount);
  });
  const formattedTimestamp = $derived.by(() => {
    if (!activeMessage) {
      return "";
    }
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(activeMessage.createdAt));
  });
  const selectedLineText = $derived(sourceLines[selectedLineNumber - 1]?.trim() ?? "");
  const selectedSourceUri = $derived.by(() => {
    if (!activeMessage) {
      return undefined;
    }
    return buildCommentResourceSourceUri({
      roomId: activeMessage.chatId,
      sourceMessageId: activeMessage.messageId,
      sourceViewKey: activeMessage.viewKey,
      sourceLineNumber: selectedLineNumber,
    });
  });
  const sourceCommentBaseCount = $derived(
    resourceReferences.filter((reference) => reference.kind === "comment").length,
  );
  const activeCommentAnchor = $derived(
    sourceCommentAnchors.find((anchor) => anchor.id === activeCommentAnchorId) ?? null,
  );
  const commentEditorOpen = $derived(
    Boolean(resolvedOpen && activeCommentAnchor && commentAnchorMode === "edit"),
  );
  const commentEditorSourceSummary = $derived.by(() => {
    if (!activeCommentAnchor) {
      return "";
    }
    return buildSourceSummary(activeCommentAnchor.lineNumber);
  });

  const close = (): void => {
    selectionActionsOpen = false;
    commentAnchorMode = null;
    onOpenChange?.(false);
  };

  const handlePopupClosed = (): void => {
    selectionActionsOpen = false;
    commentAnchorMode = null;
    onOpenChange?.(false);
    void tick().then(() => {
      if (!open && !message) {
        retainedMessage = null;
      }
    });
  };

  const stopEvent = (event: Event): void => {
    event.stopPropagation();
  };

  const selectLine = (lineNumber: number): void => {
    selectedLineNumber = lineNumber;
  };

  const buildSourceSummary = (lineNumber: number): string => {
    const parts = [resolvedActor.label];
    parts.push(`Line ${lineNumber}`);
    return parts.join(" · ");
  };

  const commentsForLine = (lineNumber: number): SourceCommentAnchor[] =>
    sourceCommentAnchors.filter((anchor) => anchor.lineNumber === lineNumber);

  const createSourceCommentAnchorId = (): string => {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    return `source-comment-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  };

  const ensureSelectedCommentAnchor = (): SourceCommentAnchor | null => {
    if (!activeMessage || selectedLineText.trim().length === 0) {
      return null;
    }
    const existing =
      sourceCommentAnchors.find(
        (anchor) => anchor.lineNumber === selectedLineNumber && anchor.selectedText === selectedLineText,
      ) ?? null;
    if (existing) {
      return existing;
    }
    const next: SourceCommentAnchor = {
      id: createSourceCommentAnchorId(),
      label: `Comment ${sourceCommentBaseCount + sourceCommentAnchors.length + 1}`,
      lineNumber: selectedLineNumber,
      selectedText: selectedLineText,
      commentText: "",
      sourceUri: selectedSourceUri,
    };
    sourceCommentAnchors = [...sourceCommentAnchors, next];
    return next;
  };

  const activateCommentAnchor = (anchor: SourceCommentAnchor, mode: "view" | "edit"): void => {
    const shouldClose = activeCommentAnchorId === anchor.id && commentAnchorMode === mode;
    if (shouldClose) {
      activeCommentAnchorId = null;
      commentAnchorMode = null;
      return;
    }
    activeCommentAnchorId = anchor.id;
    commentAnchorMode = mode;
    commentDraft = anchor.commentText;
  };

  const openCommentAnchor = (mode: "view" | "edit" = "edit"): void => {
    selectionActionsOpen = false;
    const anchor = ensureSelectedCommentAnchor();
    if (!anchor) {
      return;
    }
    activateCommentAnchor(anchor, mode);
  };

  const closeCommentEditor = ({ deleteIfEmpty = false }: { deleteIfEmpty?: boolean } = {}): void => {
    if (deleteIfEmpty && commentDraft.trim().length === 0) {
      deleteActiveCommentAnchor({ closePanel: true });
      return;
    }
    if (commentAnchorMode === "edit") {
      commentAnchorMode = "view";
    }
  };

  const deleteActiveCommentAnchor = ({ closePanel = false }: { closePanel?: boolean } = {}): void => {
    const anchor = activeCommentAnchor;
    if (!anchor) {
      return;
    }
    sourceCommentAnchors = sourceCommentAnchors.filter((item) => item.id !== anchor.id);
    activeCommentAnchorId = null;
    commentAnchorMode = null;
    commentDraft = "";
    if (closePanel) {
      selectionActionsOpen = false;
    }
  };

  const finalizeEmptyCommentEditor = (): void => {
    closeCommentEditor({ deleteIfEmpty: true });
  };

  const handleLineKeydown = (event: KeyboardEvent, lineNumber: number): void => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      selectLine(lineNumber);
    }
  };

  const clearFallbackToastTimer = (): void => {
    if (fallbackToastTimer) {
      clearTimeout(fallbackToastTimer);
      fallbackToastTimer = null;
    }
  };

  const showCopyToast = (): void => {
    if (showFramework7Toast("已复制全文")) {
      return;
    }
    clearFallbackToastTimer();
    fallbackToastText = "已复制全文";
    fallbackToastTimer = setTimeout(() => {
      fallbackToastText = null;
      fallbackToastTimer = null;
    }, 1600);
  };

  const copyFullText = async (): Promise<void> => {
    if (!activeMessage) {
      return;
    }
    await writeClipboardText(sourceText);
    showCopyToast();
  };

  const showTransientToast = (value: string): void => {
    if (showFramework7Toast(value)) {
      return;
    }
    clearFallbackToastTimer();
    fallbackToastText = value;
    fallbackToastTimer = setTimeout(() => {
      fallbackToastText = null;
      fallbackToastTimer = null;
    }, 1600);
  };

  const copySelectedLine = async (): Promise<void> => {
    if (selectedLineText.length === 0) {
      return;
    }
    await writeClipboardText(selectedLineText);
    showTransientToast("已复制选中内容");
  };

  const shareSelectedLine = async (): Promise<void> => {
    if (selectedLineText.length === 0) {
      return;
    }
    if (typeof navigator !== "undefined" && "share" in navigator) {
      await navigator.share({ text: selectedLineText });
      return;
    }
    await writeClipboardText(selectedLineText);
    showTransientToast("已复制分享内容");
  };

  const saveCommentDraft = async (): Promise<void> => {
    const anchor = activeCommentAnchor;
    const trimmedDraft = commentDraft.trim();
    if (!activeMessage || !anchor || anchor.selectedText.length === 0) {
      return;
    }
    if (trimmedDraft.length === 0) {
      finalizeEmptyCommentEditor();
      showTransientToast("空评论已删除");
      return;
    }
    sourceCommentAnchors = sourceCommentAnchors.map((item) =>
      item.id === anchor.id ? { ...item, commentText: trimmedDraft } : item,
    );
    await onCreateCommentDraft?.({
      sourceMessage: activeMessage,
      sourceMessageId: activeMessage.messageId,
      sourceViewKey: activeMessage.viewKey,
      sourceLineNumber: anchor.lineNumber,
      selectedText: anchor.selectedText,
      sourceActorId: resolvedActor.actorId ?? activeMessage.senderContactId ?? null,
      sourceActorLabel: resolvedActor.label,
      sourceUri: anchor.sourceUri,
      commentText: trimmedDraft,
    });
    commentAnchorMode = "view";
    activeCommentAnchorId = anchor.id;
    showTransientToast("评论已加入资源栏");
  };

  $effect(() => {
    if (!resolvedOpen || !scrollSurfaceRef) {
      return;
    }
    const nextKey = activeMessage ? `${activeMessage.viewKey}:${activeLineNumber}` : "";
    if (nextKey !== lastOpenedKey) {
      selectedLineNumber = safeActiveLineNumber;
      lastOpenedKey = nextKey;
    }
    void tick().then(() => {
      scrollSurfaceRef
        ?.querySelector<HTMLElement>(`[data-line-number="${selectedLineNumber}"]`)
        ?.scrollIntoView({ block: "center", inline: "nearest" });
    });
  });

  onDestroy(() => {
    clearFallbackToastTimer();
  });

  $effect(() => {
    if (open && message) {
      retainedMessage = message;
    }
  });
</script>

{#if $framework7Runtime}
  {#if activeMessage}
    <Popup opened={resolvedOpen} containerEl="body" tabletFullscreen swipeToClose="to-bottom" onPopupClosed={handlePopupClosed}>
      <View>
        <Page class="message-source-page" pageContent={false} noSwipeback>
          <Navbar>
            <NavLeft
              class="message-source-navslot"
              style="--f7-glass-bg-color: transparent; --f7-glass-shadow: none; backdrop-filter: none; border-radius: 0; min-width: 28px; width: 28px; height: 28px; margin: 0; padding: 0;"
            >
              <Link popupClose iconOnly aria-label="Close source" title="Close source">
                <X class="size-4" />
              </Link>
            </NavLeft>
            <NavRight
              class="message-source-navslot"
              style="--f7-glass-bg-color: transparent; --f7-glass-shadow: none; backdrop-filter: none; border-radius: 0; min-width: 28px; width: 28px; height: 28px; margin: 0; padding: 0;"
            >
              <Link iconOnly aria-label="Copy source" title="Copy source" onclick={() => void copyFullText()}>
                <Copy class="size-4" />
              </Link>
            </NavRight>

            <div class="message-source-navbar-center">
              <ChatAvatar
                label={resolvedActor.label}
                subtitle={resolvedActor.subtitle}
                src={resolvedActor.iconUrl}
                class="message-source-navbar-avatar"
                part="message-source-avatar"
              />
              <div class="message-source-navbar-copy">
                <div class="message-source-navbar-name">{resolvedActor.label}</div>
                <div class="message-source-navbar-time">{formattedTimestamp}</div>
              </div>
            </div>
          </Navbar>

          <PageContent class="message-source-page-content">
            <div
            bind:this={scrollSurfaceRef}
            class="message-source-page-content-inner"
            role="dialog"
            aria-modal="true"
            aria-label={`Source for ${resolvedActor.label}`}
          >
            {#if isRecalledMessage(activeMessage)}
              <div class="message-source-note">
                This message was recalled from the transcript. The durable source remains available here.
              </div>
            {/if}

            <div class="message-source-code-surface" part="message-source-surface">
              {#each sourceLines as line, index (`${activeMessage.viewKey}-${index}`)}
                <div
                  class={`message-source-line ${index + 1 === selectedLineNumber ? "message-source-line-active" : ""}`}
                  data-active-line={index + 1 === selectedLineNumber ? "true" : "false"}
                  data-line-number={index + 1}
                  role="button"
                  aria-label={`Select source line ${index + 1}`}
                  tabindex="0"
                  onclick={() => selectLine(index + 1)}
                  onkeydown={(event) => handleLineKeydown(event, index + 1)}
                >
                  <span class="message-source-line-number" aria-hidden="true">{index + 1}</span>
                  <span class="message-source-line-main">
                    <span class="message-source-line-text">{line || "\u00a0"}</span>
                    {#each commentsForLine(index + 1) as anchor (anchor.id)}
                      <CommentAnchorBadge
                        label={anchor.label}
                        selectedText={anchor.selectedText}
                        commentText={anchor.commentText}
                        sourceSummary={buildSourceSummary(anchor.lineNumber)}
                        mode={activeCommentAnchorId === anchor.id ? commentAnchorMode : null}
                        onView={() => {
                          activateCommentAnchor(anchor, "view");
                        }}
                        onEdit={() => {
                          activateCommentAnchor(anchor, "edit");
                        }}
                      />
                    {/each}
                  </span>
                </div>
              {/each}
            </div>

            </div>
          </PageContent>

          <Toolbar bottom class="message-source-selection-toolbar">
            <div class="message-source-selection-summary">
              <span>Line {selectedLineNumber}</span>
              {#if selectedLineText}
                <span>{selectedLineText}</span>
              {/if}
            </div>
            <div class="message-source-toolbar-actions" bind:this={selectionActionButtonRef}>
              <Link
                href="#"
                class="message-source-toolbar-action"
                role="button"
                aria-label="Open source line actions"
                title="Actions"
                onclick={(event: MouseEvent) => {
                  event.preventDefault();
                  selectionActionsOpen = !selectionActionsOpen;
                }}
              >
                <Ellipsis class="message-source-toolbar-action-icon" />
              </Link>
              <Link
                href="#"
                class="message-source-toolbar-action message-source-toolbar-action-primary"
                role="button"
                aria-label="Comment on selected source line"
                title="Comment"
                onclick={(event: MouseEvent) => {
                  event.preventDefault();
                  openCommentAnchor("edit");
                }}
              >
                <MessageSquareDot class="message-source-toolbar-action-icon" />
              </Link>
            </div>
          </Toolbar>
        </Page>
      </View>
    </Popup>
  {/if}
{:else if resolvedOpen && activeMessage}
  <div
    class="message-source-backdrop"
    part="message-source-backdrop"
    role="presentation"
    onclick={close}
  >
    <div
      class="message-source-layer"
      role="dialog"
      aria-modal="true"
      aria-label={`Source for ${resolvedActor.label}`}
      tabindex="-1"
      onclick={stopEvent}
      onkeydown={stopEvent}
    >
      <Card class="message-source-card">
        <CardHeader class="message-source-card-header" part="message-source-header">
          <Link href="#" iconOnly aria-label="Close source" title="Close source" onclick={(event: MouseEvent) => {
            event.preventDefault();
            close();
          }}>
            <X class="size-4" />
          </Link>

          <div class="message-source-header-center">
            <ChatAvatar
              label={resolvedActor.label}
              subtitle={resolvedActor.subtitle}
              src={resolvedActor.iconUrl}
              class="message-source-navbar-avatar"
              part="message-source-avatar"
            />
            <div class="message-source-navbar-copy">
              <div class="message-source-navbar-name">{resolvedActor.label}</div>
              <div class="message-source-navbar-time">{formattedTimestamp}</div>
            </div>
          </div>

          <Link href="#" aria-label="Copy source" onclick={(event: MouseEvent) => {
            event.preventDefault();
            void copyFullText();
          }}>
            <Copy class="size-3.5" />
            <span>Copy</span>
          </Link>
        </CardHeader>

        <CardContent class="message-source-card-body" part="message-source-body">
          {#if isRecalledMessage(activeMessage)}
            <div class="message-source-note">
              This message was recalled from the transcript. The durable source remains available here.
            </div>
          {/if}

          <div bind:this={scrollSurfaceRef} class="message-source-scroll-surface">
            <div class="message-source-code-surface" part="message-source-surface">
              {#each sourceLines as line, index (`${activeMessage.viewKey}-${index}`)}
                <div
                  class={`message-source-line ${index + 1 === selectedLineNumber ? "message-source-line-active" : ""}`}
                  data-active-line={index + 1 === selectedLineNumber ? "true" : "false"}
                  data-line-number={index + 1}
                  role="button"
                  aria-label={`Select source line ${index + 1}`}
                  tabindex="0"
                  onclick={() => selectLine(index + 1)}
                  onkeydown={(event) => handleLineKeydown(event, index + 1)}
                >
                  <span class="message-source-line-number" aria-hidden="true">{index + 1}</span>
                  <span class="message-source-line-main">
                    <span class="message-source-line-text">{line || "\u00a0"}</span>
                    {#each commentsForLine(index + 1) as anchor (anchor.id)}
                      <CommentAnchorBadge
                        label={anchor.label}
                        selectedText={anchor.selectedText}
                        commentText={anchor.commentText}
                        sourceSummary={buildSourceSummary(anchor.lineNumber)}
                        mode={activeCommentAnchorId === anchor.id ? commentAnchorMode : null}
                        onView={() => {
                          activateCommentAnchor(anchor, "view");
                        }}
                        onEdit={() => {
                          activateCommentAnchor(anchor, "edit");
                        }}
                      />
                    {/each}
                  </span>
                </div>
              {/each}
            </div>
          </div>

          <div class="message-source-footer">
            <div class="message-source-selection-summary">
              <span>Line {selectedLineNumber}</span>
              {#if selectedLineText}
                <span>{selectedLineText}</span>
              {/if}
            </div>
            <div class="message-source-footer-actions" bind:this={selectionActionButtonRef}>
              <Link
                href="#"
                role="button"
                aria-label="Open source line actions"
                title="Actions"
                onclick={(event: MouseEvent) => {
                  event.preventDefault();
                  selectionActionsOpen = !selectionActionsOpen;
                }}
              >
                <Ellipsis class="message-source-toolbar-action-icon" />
              </Link>
              <Link href="#" role="button" aria-label="Comment on selected source line" title="Comment" onclick={(event: MouseEvent) => {
                event.preventDefault();
                openCommentAnchor("edit");
              }}>
                <MessageSquareDot class="message-source-toolbar-action-icon" />
              </Link>
            </div>
          </div>

          {#if activeCommentAnchor && commentAnchorMode === "edit"}
            <section class="message-source-comment-editor-inline" aria-label={`Edit ${activeCommentAnchor.label}`}>
              <div class="message-source-comment-editor-title">
                <span>{activeCommentAnchor.label}</span>
                <span>{commentEditorSourceSummary}</span>
              </div>
              <List class="message-source-comment-editor-list" strongIos insetIos>
                <ListInput
                  label="Comment"
                  input={false}
                >
                  {#snippet inputContent()}
                    <textarea
                      class="message-source-comment-editor-native-textarea"
                      rows="3"
                      bind:value={commentDraft}
                      placeholder="Add a selected-text comment"
                    ></textarea>
                  {/snippet}
                </ListInput>
              </List>
              <div class="message-source-comment-editor-actions">
                <Link href="#" role="button" aria-label="Cancel comment edit" title="Cancel" onclick={(event: MouseEvent) => {
                  event.preventDefault();
                  closeCommentEditor({ deleteIfEmpty: true });
                }}>
                  <X class="message-source-comment-editor-action-icon" />
                  <span>Cancel</span>
                </Link>
                <Link
                  href="#"
                  role="button"
                  aria-label="Save comment"
                  title="Save"
                  onclick={(event: MouseEvent) => {
                    event.preventDefault();
                    void saveCommentDraft();
                  }}
                >
                  <Save class="message-source-comment-editor-action-icon" />
                  <span>Save</span>
                </Link>
              </div>
            </section>
          {/if}
        </CardContent>
      </Card>
    </div>

    {#if fallbackToastText}
      <div class="message-source-fallback-toast" role="status" aria-live="polite">
        {fallbackToastText}
      </div>
    {/if}
  </div>
{/if}

<SelectionActionSurface
  bind:open={selectionActionsOpen}
  selectedText={selectedLineText}
  targetEl={selectionActionButtonRef}
  onCopy={() => void copySelectedLine()}
  onShare={() => void shareSelectedLine()}
  onComment={() => {
    openCommentAnchor("edit");
  }}
/>

{#if $framework7Runtime && activeCommentAnchor && resolvedOpen}
  <Sheet
    class="message-source-comment-editor-sheet"
    opened={commentEditorOpen}
    containerEl="body"
    style="height: auto"
    swipeToClose
    backdrop={false}
    closeByOutsideClick={false}
    onSheetClosed={finalizeEmptyCommentEditor}
  >
    <Toolbar class="message-source-comment-editor-toolbar">
      <Link
        href="#"
        class="message-source-comment-editor-action message-source-comment-editor-cancel"
        iconOnly
        aria-label="Cancel comment edit"
        title="Cancel"
        onclick={(event: MouseEvent) => {
          event.preventDefault();
          closeCommentEditor({ deleteIfEmpty: true });
        }}
      >
        <X class="message-source-comment-editor-toolbar-icon" />
      </Link>
      <div class="message-source-comment-editor-title">
        <span>{activeCommentAnchor.label}</span>
        <span>{commentEditorSourceSummary}</span>
      </div>
      <Link
        href="#"
        role="button"
        class="message-source-comment-editor-action message-source-comment-editor-save"
        iconOnly
        aria-label="Save comment"
        title="Save"
        onclick={(event: MouseEvent) => {
          event.preventDefault();
          void saveCommentDraft();
        }}
      >
        <Save class="message-source-comment-editor-toolbar-icon" />
      </Link>
    </Toolbar>
    <PageContent class="message-source-comment-editor-content">
      <div class="message-source-comment-editor-shell">
        <List class="message-source-comment-editor-list" strongIos insetIos>
          <ListInput
            label="Comment"
            input={false}
          >
            {#snippet inputContent()}
              <textarea
                class="message-source-comment-editor-native-textarea"
                rows="3"
                bind:value={commentDraft}
                placeholder="Add a selected-text comment"
              ></textarea>
            {/snippet}
          </ListInput>
        </List>
      </div>
    </PageContent>
  </Sheet>
{/if}

<style>
  .message-source-backdrop {
    position: fixed;
    inset: 0;
    z-index: 95;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.42rem;
    background: rgba(15, 23, 42, 0.28);
    backdrop-filter: blur(20px);
  }

  .message-source-layer {
    width: min(32rem, calc(100vw - 0.84rem));
    max-height: min(76vh, 40rem);
  }

  :global(.message-source-card) {
    overflow: hidden;
    gap: 0;
    border-radius: 20px;
    border: 1px solid rgba(255, 255, 255, 0.58);
    background: rgba(255, 255, 255, 0.94);
    box-shadow: 0 24px 72px rgba(15, 23, 42, 0.22);
  }

  .message-source-card-header {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.38rem;
    padding: 0.44rem 0.56rem;
  }

  .message-source-header-center,
  .message-source-navbar-center {
    display: flex;
    min-width: 0;
    align-items: center;
    justify-content: center;
    gap: 0.36rem;
  }

  .message-source-navbar-center {
    position: absolute;
    inset-inline: 3.75rem;
    inset-block-start: 50%;
    transform: translateY(-50%);
    pointer-events: none;
  }

  .message-source-navbar-avatar {
    box-shadow: none;
  }

  .message-source-navbar-copy {
    display: grid;
    min-width: 0;
    gap: 0.02rem;
  }

  .message-source-navbar-name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 0.64rem;
    font-weight: 700;
    color: var(--f7-text-color, #111827);
  }

  .message-source-navbar-time {
    font-size: 0.5rem;
    color: var(--f7-text-color-secondary, #6b7280);
  }

  .message-source-card-body,
  .message-source-page-content-inner {
    display: grid;
    gap: 0.4rem;
  }

  .message-source-card-body {
    padding: 0.5rem 0.54rem 0.58rem;
  }

  :global(.message-source-page) {
    display: grid;
    align-content: start;
    min-height: 100%;
    --f7-page-navbar-offset: 0px;
    background: transparent;
  }

  :global(.message-source-page-content.page-content) {
    min-height: 0;
    --f7-page-content-extra-padding-top: 0.5rem;
    --f7-page-content-extra-padding-bottom: 0.74rem;
  }

  .message-source-page-content-inner {
    min-height: min-content;
    padding-inline: 0.54rem;
  }

  .message-source-scroll-surface {
    overflow-y: auto;
    max-height: min(31vh, 13rem);
    -webkit-overflow-scrolling: touch;
  }

  .message-source-note {
    border-radius: 10px;
    background: color-mix(in srgb, var(--f7-theme-color, #007aff) 8%, white);
    color: var(--f7-text-color-secondary, #475569);
    padding: 0.44rem 0.54rem;
    font-size: 0.6rem;
    line-height: 1.34;
  }

  .message-source-code-surface {
    overflow: hidden;
    border-radius: 14px;
    border: 1px solid color-mix(in srgb, #cbd5e1 65%, transparent);
    background: color-mix(in srgb, white 92%, #f4f7fb);
  }

  .message-source-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.32rem;
    flex-wrap: wrap;
    position: sticky;
    bottom: 0;
    border-radius: 14px;
    background: rgba(248, 248, 252, 0.82);
    padding: 0.42rem 0.52rem calc(0.42rem + env(safe-area-inset-bottom));
    box-shadow: 0 -8px 20px rgba(15, 23, 42, 0.06);
  }

  .message-source-selection-summary {
    display: grid;
    gap: 0.12rem;
    min-width: 0;
    color: var(--f7-text-color-secondary, #475569);
    font-size: 0.56rem;
    line-height: 1.28;
  }

  .message-source-selection-summary span:last-child {
    color: var(--f7-text-color, #0f172a);
    font-size: 0.62rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: min(22rem, 100%);
  }

  .message-source-footer-actions {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 0.22rem;
  }

  :global(.message-source-selection-toolbar.toolbar) {
    min-height: calc(2.9rem + env(safe-area-inset-bottom));
    border-top: 1px solid rgba(60, 60, 67, 0.1);
    background: rgba(248, 248, 252, 0.9);
    backdrop-filter: saturate(180%) blur(24px);
  }

  :global(.message-source-selection-toolbar .toolbar-inner) {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 0.5rem;
    align-items: center;
    padding: 0.34rem 0.64rem calc(0.34rem + env(safe-area-inset-bottom));
  }

  .message-source-toolbar-actions {
    display: inline-flex;
    align-items: center;
    gap: 0.32rem;
  }

  .message-source-toolbar-action {
    appearance: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.24rem;
    min-width: 2.25rem;
    min-height: 1.9rem;
    border: 0;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.78);
    color: var(--f7-theme-color, #007aff);
    font-size: 0.72rem;
    font-weight: 650;
    line-height: 1;
    padding-inline: 0.72rem;
    box-shadow:
      inset 0 0 0 1px rgba(60, 60, 67, 0.08),
      inset 0 1px 0 rgba(255, 255, 255, 0.6);
  }

  :global(.message-source-toolbar-action-icon),
  :global(.message-source-comment-editor-action-icon),
  :global(.message-source-comment-editor-toolbar-icon) {
    width: 0.92rem;
    height: 0.92rem;
  }

  .message-source-toolbar-action-primary {
    background: var(--f7-theme-color, #007aff);
    color: #fff;
    box-shadow: none;
  }

  .message-source-line {
    display: grid;
    grid-template-columns: 1.6rem minmax(0, 1fr);
    gap: 0.44rem;
    align-items: start;
    padding: 0.38rem 0.5rem;
  }

  .message-source-line + .message-source-line {
    border-top: 1px solid color-mix(in srgb, #cbd5e1 52%, transparent);
  }

  .message-source-line-active {
    background:
      linear-gradient(90deg, color-mix(in srgb, var(--f7-theme-color, #007aff) 14%, transparent), transparent 38%),
      color-mix(in srgb, var(--f7-theme-color, #007aff) 4%, white);
  }

  .message-source-line-number {
    user-select: none;
    text-align: end;
    font-size: 0.58rem;
    font-variant-numeric: tabular-nums;
    color: var(--f7-text-color-secondary, #94a3b8);
  }

  .message-source-line-main {
    display: grid;
    min-width: 0;
    align-content: start;
  }

  .message-source-line-text {
    min-width: 0;
    white-space: pre-wrap;
    word-break: break-word;
    overflow-wrap: anywhere;
    font-family:
      ui-monospace,
      SFMono-Regular,
      SF Mono,
      Menlo,
      monospace;
    font-size: 0.68rem;
    line-height: 1.34;
    color: var(--f7-text-color, #0f172a);
  }

  .message-source-comment-editor-inline {
    display: grid;
    gap: 0.46rem;
    border-radius: 16px;
    background: rgba(248, 248, 252, 0.92);
    padding: 0.56rem;
    box-shadow: inset 0 0 0 1px rgba(60, 60, 67, 0.1);
  }

  .message-source-comment-editor-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.4rem;
  }

  :global(.message-source-comment-editor-list.list) {
    margin: 0;
    --f7-list-inset-side-margin: 0;
    --f7-list-strong-bg-color: rgba(255, 255, 255, 0.72);
  }

  :global(.message-source-comment-editor-list .item-input-wrap textarea) {
    min-height: 5.25rem;
    max-height: min(30vh, 9rem);
  }

  :global(.message-source-comment-editor-native-textarea) {
    width: 100%;
    min-height: 5.25rem;
    max-height: min(30vh, 9rem);
    border: 0;
    background: transparent;
    color: var(--f7-text-color, #0f172a);
    font: inherit;
    line-height: 1.45;
    resize: none;
    outline: none;
  }

  .message-source-fallback-toast {
    position: fixed;
    inset-inline-start: 50%;
    inset-block-end: 1.5rem;
    transform: translateX(-50%);
    z-index: 110;
    border-radius: 999px;
    background: rgba(15, 23, 42, 0.88);
    color: white;
    padding: 0.7rem 1rem;
    font-size: 0.8rem;
    box-shadow: 0 12px 30px rgba(15, 23, 42, 0.22);
  }

  :global(.message-source-page .navbar) {
    background: color-mix(in srgb, var(--f7-bars-bg-color, #f2f2f7) 82%, white);
  }

  :global(.message-source-page .navbar .left.message-source-navslot),
  :global(.message-source-page .navbar .right.message-source-navslot) {
    min-width: 28px;
    width: 28px;
    height: 28px;
    margin: 0;
    padding: 0;
    border-radius: 0 !important;
    background: transparent !important;
    background-color: transparent !important;
    box-shadow: none !important;
    backdrop-filter: none !important;
  }

  :global(.message-source-page) {
    background: rgba(248, 248, 252, 0.96);
  }

  :global(.message-source-comment-editor-sheet.sheet-modal) {
    --f7-sheet-border-radius: 22px 22px 0 0;
  }

  :global(.message-source-comment-editor-toolbar .toolbar-inner) {
    display: grid;
    width: 100%;
    grid-template-columns: minmax(2.4rem, max-content) minmax(0, 1fr) minmax(2.4rem, max-content);
    gap: 0.5rem;
    align-items: center;
  }

  :global(.message-source-comment-editor-content.page-content) {
    /* Framework7 owns PageContent offset formulas; Web Chat only contributes extra spacing variables. */
    --f7-page-toolbar-top-offset: var(--f7-toolbar-height);
    --f7-page-content-extra-padding-top: 0.52rem;
    --f7-page-content-extra-padding-bottom: 0.86rem;
    height: auto;
  }

  .message-source-comment-editor-shell {
    display: grid;
    width: min(100%, 23rem);
    margin: 0 auto;
    padding-inline: 0.72rem;
  }

  .message-source-comment-editor-shell :global(.web-chat-f7-textarea) {
    min-height: 5.4rem;
    max-height: min(30vh, 9rem);
    resize: none;
  }

  .message-source-comment-editor-title {
    min-width: 0;
    display: grid;
    justify-items: center;
    gap: 0.08rem;
    text-align: center;
  }

  .message-source-comment-editor-title span:first-child {
    color: var(--f7-text-color-secondary, #64748b);
    font-size: 0.62rem;
    font-weight: 700;
    text-transform: uppercase;
  }

  .message-source-comment-editor-title span:last-child {
    max-width: 100%;
    overflow: hidden;
    color: var(--f7-text-color-secondary, #475569);
    font-size: 0.7rem;
    line-height: 1.25;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .message-source-comment-editor-action {
    justify-self: start;
    min-width: 2.4rem;
    border: 0;
    background: transparent;
    color: var(--f7-theme-color, #007aff);
    padding: 0.2rem 0.12rem;
    font-size: 0.76rem;
    font-weight: 600;
    text-align: start;
  }

  :global(.message-source-comment-editor-action.link) {
    width: auto;
    height: auto;
    min-height: 2rem;
    justify-content: flex-start;
    padding-inline: 0.12rem;
  }

  .message-source-comment-editor-save {
    justify-self: end;
    text-align: end;
  }

  .message-source-comment-editor-action:disabled {
    opacity: 0.38;
  }

  @media (max-width: 640px) {
    .message-source-navbar-center {
      inset-inline: 3rem;
    }

    .message-source-navbar-name {
      font-size: 0.64rem;
    }

    .message-source-line {
      grid-template-columns: 1.4rem minmax(0, 1fr);
      gap: 0.42rem;
      padding-inline: 0.46rem;
    }
  }
</style>
