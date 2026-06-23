<script lang="ts">
  import ChatAvatar from "./chat-avatar.svelte";
  import MessageMarkdownContent from "./components/message-markdown-content.svelte";
  import MessageActionsMenu, {
    type ResolvedMessageAction,
  } from "./message-actions-menu.svelte";
  import { WEB_CHAT_CLOSE_COMMENT_ACTION_POPOVERS_EVENT } from "./message-comment-action-events";
  import MessageCommentActionPopover from "./message-comment-action-popover.svelte";
  import MessageSourcePopup, { type MessageSourceSelectionRequest } from "./message-source-popup.svelte";
  import { resolveDefaultMessageReadProgress } from "./message-read-progress";
  import {
    mergeResourceReferences,
    resolveMessageResourceReferences,
    serializeMessageSourceMarkdown,
  } from "./resource-contract";
  import ResourcePreviewLayer from "./resource-preview-layer.svelte";
  import { writeClipboardText } from "./clipboard";
  import { Button as Framework7Button, List, ListInput } from "./framework7-components";
  import Framework7Message from "./ui/framework7-message.svelte";
  import type {
    WebChatActorPresentation,
    WebChatChannel,
    WebChatMessage,
    WebChatMessageAction,
    WebChatCommentDraftRequest,
    WebChatMessageReference,
    WebChatMessageReadProgress,
    WebChatResourceReference,
    WebChatMessageRenderInput,
  } from "./types";
  import {
    getRenderableMessageText,
    isAssistantMessage,
    isEditedMessage,
    isRecalledMessage,
    resolveMessageActorId,
    isViewerOwnedMessage,
  } from "./message-utils";

  let {
    channel,
    viewerActorId,
    message,
    groupFirst = true,
    groupLast = true,
    groupTail = true,
    referencedMessage = null,
    resolveActorPresentation,
    resolveMessageActions,
    resolveMessageReadProgress,
    resolveMessageResources,
    onCreateCommentDraft,
    onSubmitInteractive,
  }: {
    channel: WebChatChannel;
    viewerActorId: string | null;
    message: WebChatMessage;
    groupFirst?: boolean;
    groupLast?: boolean;
    groupTail?: boolean;
    referencedMessage?: WebChatMessageReference | null;
    resolveActorPresentation?: (
      input: {
        channel: WebChatChannel;
        message?: WebChatMessage;
        viewerActorId: string | null;
        role: "assistant" | "channel" | "participant" | "viewer";
        actorId?: string | null;
        fallbackLabel: string;
      },
    ) => WebChatActorPresentation | null;
    resolveMessageActions?: (input: WebChatMessageRenderInput) => readonly WebChatMessageAction[];
    resolveMessageReadProgress?: (input: WebChatMessageRenderInput) => WebChatMessageReadProgress | null;
    resolveMessageResources?: (input: WebChatMessageRenderInput) => readonly WebChatResourceReference[];
    onCreateCommentDraft?: ((input: WebChatCommentDraftRequest) => void | Promise<void>) | undefined;
    onSubmitInteractive: (text: string) => Promise<void>;
  } = $props();

  let interactiveDraft: Record<string, string> = $state({});
  let messageCardRef = $state<HTMLDivElement | null>(null);
  let interactiveSubmitting = $state(false);
  let actionsOpen = $state(false);
  let sourcePopupOpen = $state(false);
  let previewingResourceId = $state<string | null>(null);
  let commentDetailMode = $state<"view" | "edit">("view");
  let commentActionOpen = $state(false);
  let commentActionAnchor = $state<{ x: number; y: number; width: number; height: number } | null>(null);
  let commentSelectionRequest = $state<MessageSourceSelectionRequest | null>(null);
  let requestedSourceLineNumber = $state(1);
  let requestedSourceLineEndNumber = $state<number | undefined>(undefined);

  const assistant = $derived(isAssistantMessage(channel, message));
  const resolvedActorId = $derived(resolveMessageActorId(channel, message, viewerActorId));
  const viewerOwned = $derived(isViewerOwnedMessage(viewerActorId, message, channel));
  const recalled = $derived(isRecalledMessage(message));
  const edited = $derived(isEditedMessage(message));
  const renderableContent = $derived(getRenderableMessageText(message));
  const interactive = $derived(message.kind === "interactive" ? message.payload?.interactive : undefined);
  const renderInput = $derived({
    channel,
    message,
    viewerActorId,
    isAssistant: assistant,
    onSubmitInteractive,
  } satisfies WebChatMessageRenderInput);

  const actorPresentation = $derived.by(() => {
    const role = assistant ? "assistant" : viewerOwned ? "viewer" : "participant";
    const fallbackLabel = message.from || (assistant ? channel.owner : viewerOwned ? "You" : "Participant");
    return (
      resolveActorPresentation?.({
        channel,
        message,
        viewerActorId,
        role,
        actorId: resolvedActorId,
        fallbackLabel,
      }) ?? {
        actorId: resolvedActorId,
        label: fallbackLabel,
        subtitle: undefined,
        iconUrl: null,
        kind: role as WebChatActorPresentation["kind"],
      }
    );
  });

  const tone = $derived(assistant ? "assistant" : viewerOwned ? "viewer" : "participant");
  const clipReferencePreview = (value: string, maxChars = 92): string => {
    const normalized = value.replace(/\s+/gu, " ").trim();
    if (normalized.length <= maxChars) {
      return normalized;
    }
    return `${normalized.slice(0, Math.max(0, maxChars - 3)).trimEnd()}...`;
  };
  const referencedPreviewText = $derived.by(() => {
    if (!referencedMessage) {
      return null;
    }
    const content = referencedMessage.recalledAt ? "This message was recalled." : referencedMessage.content;
    const preview = clipReferencePreview(content);
    return preview.length > 0 ? preview : "[empty message]";
  });
  const referencedActorLabel = $derived.by(() => {
    if (!referencedMessage) {
      return null;
    }
    const actorId = resolveMessageActorId(channel, referencedMessage, viewerActorId);
    const participantLabel = actorId
      ? channel.participants.find((participant) => participant.id === actorId)?.label?.trim()
      : undefined;
    const fallbackLabel = participantLabel || referencedMessage.from || "Participant";
    const role =
      referencedMessage.from === channel.owner || referencedMessage.from === `avatar:${channel.owner}`
        ? "assistant"
        : actorId && actorId === viewerActorId
          ? "viewer"
          : "participant";
    return (
      resolveActorPresentation?.({
        channel,
        viewerActorId,
        role,
        actorId,
        fallbackLabel,
      })?.label ?? fallbackLabel
    );
  });

  const buildInteractiveText = (
    fields: Record<string, string>,
    fieldLabels: Record<string, string>,
  ): string => {
    const summaryLines = Object.entries(fields)
      .map(([id, value]) => {
        const normalized = value.trim();
        if (normalized.length === 0) {
          return null;
        }
        return `${fieldLabels[id] ?? id}: ${normalized}`;
      })
      .filter((value): value is string => value !== null);
    if (summaryLines.length === 0) {
      return message.content;
    }
    return `${message.content}\n${summaryLines.join("\n")}`;
  };

  const submitInteractive = async (): Promise<void> => {
    if (!interactive || interactiveSubmitting) {
      return;
    }
    const labels = Object.fromEntries(interactive.fields.map((field) => [field.id, field.label]));
    interactiveSubmitting = true;
    try {
      await onSubmitInteractive(buildInteractiveText(interactiveDraft, labels));
    } finally {
      interactiveSubmitting = false;
    }
  };

  const openSourcePopup = (): void => {
    if (message.content.trim().length === 0) {
      return;
    }
    actionsOpen = false;
    commentSelectionRequest = null;
    sourcePopupOpen = true;
  };

  const createCommentSelectionRequestId = (): string => {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    return `comment-selection-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  };

  const openCommentActionForSelection = (input: {
    lineNumber: number;
    lineEndNumber?: number;
    selectedText: string;
    anchor: { x: number; y: number; width: number; height: number };
  }): void => {
    if (input.selectedText.trim().length === 0) {
      return;
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event(WEB_CHAT_CLOSE_COMMENT_ACTION_POPOVERS_EVENT));
    }
    commentSelectionRequest = {
      id: createCommentSelectionRequestId(),
      openCommentEditor: true,
    };
    requestedSourceLineNumber = input.lineNumber;
    requestedSourceLineEndNumber = input.lineEndNumber;
    commentActionAnchor = input.anchor;
    commentActionOpen = true;
  };

  const currentSelectedTextWithinMessage = (): string => {
    const selection = typeof window !== "undefined" ? window.getSelection() : null;
    if (!selection || selection.rangeCount === 0 || !messageCardRef) {
      return "";
    }
    const anchorNode = selection.anchorNode;
    const focusNode = selection.focusNode;
    const containsNode = (node: Node | null): boolean =>
      node
        ? messageCardRef?.contains(node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement) === true
        : false;
    if (!containsNode(anchorNode) || !containsNode(focusNode)) {
      return "";
    }
    const text = selection?.toString().trim() ?? "";
    return text;
  };

  const selectionRectFromSelection = (): { x: number; y: number; width: number; height: number } | null => {
    if (typeof window === "undefined") {
      return null;
    }
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      return null;
    }
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    if (!rect || (rect.width === 0 && rect.height === 0)) {
      return null;
    }
    return {
      x: rect.left + rect.width / 2,
      y: rect.top,
      width: Math.max(rect.width, 24),
      height: Math.max(rect.height, 24),
    };
  };

  const lineRangeForText = (selectedText: string): { lineNumber: number; lineEndNumber?: number } => {
    const normalizedSelection = selectedText.trim();
    if (normalizedSelection.length === 0) {
      return { lineNumber: 1 };
    }
    const index = sourceMarkdown.indexOf(normalizedSelection);
    if (index < 0) {
      return { lineNumber: 1 };
    }
    const prefix = sourceMarkdown.slice(0, index);
    const segment = sourceMarkdown.slice(index, index + normalizedSelection.length);
    const lineNumber = prefix.split(/\r?\n/u).length;
    const lineEndNumber = lineNumber + segment.split(/\r?\n/u).length - 1;
    return lineEndNumber > lineNumber ? { lineNumber, lineEndNumber } : { lineNumber };
  };

  const openSelectionCommentFromSelection = (): void => {
    const selectedText = currentSelectedTextWithinMessage();
    if (selectedText.length === 0) {
      return;
    }
    const anchor = selectionRectFromSelection();
    if (!anchor) {
      return;
    }
    openCommentActionForSelection({
      ...lineRangeForText(selectedText),
      selectedText,
      anchor,
    });
  };

  const builtInActions = $derived.by(() => {
    const actions: ResolvedMessageAction[] = [];
    if (message.content.trim().length > 0) {
      actions.push({
        id: "open-source",
        label: "View source",
        detail: "markdown",
        onSelect: async () => {
          openSourcePopup();
        },
      });
      actions.push({
        id: "copy-content",
        label: "Copy message",
        detail: "text",
        onSelect: async () => {
          await writeClipboardText(message.content);
        },
      });
    }
    if (typeof message.messageId === "number") {
      actions.push({
        id: "copy-message-id",
        label: "Copy message id",
        detail: "durable",
        onSelect: async () => {
          await writeClipboardText(String(message.messageId));
        },
      });
    }
    actions.push({
      id: "copy-view-key",
      label: "Copy view key",
      detail: "ui",
      onSelect: async () => {
        await writeClipboardText(message.viewKey);
      },
    });
    return actions;
  });

  const messageActions = $derived([
    ...builtInActions,
    ...(resolveMessageActions?.(renderInput) ?? []).map<ResolvedMessageAction>((action) => ({
      id: action.id,
      label: action.label,
      detail: action.detail,
      tone: action.tone,
      disabled: action.disabled,
      onSelect: action.onSelect ? () => action.onSelect?.(renderInput) : undefined,
    })),
  ]);
  const messageReadProgress = $derived.by(() => {
    if (resolveMessageReadProgress) {
      return resolveMessageReadProgress(renderInput);
    }
    return resolveDefaultMessageReadProgress(renderInput, resolveActorPresentation);
  });
  const defaultMessageResources = $derived(
    resolveMessageResourceReferences({
      attachments: message.attachments ?? [],
      metadata: message.metadata,
      content: message.content,
      messageId: message.messageId,
      viewKey: message.viewKey,
      senderActorId: resolvedActorId,
      from: message.from,
    }),
  );
  const messageResources = $derived(
    mergeResourceReferences(defaultMessageResources, resolveMessageResources?.(renderInput) ?? []),
  );
  const previewingResource = $derived(messageResources.find((resource) => resource.id === previewingResourceId) ?? null);
  const sourceMarkdown = $derived.by(() =>
    renderableContent.trim().length > 0
      ? serializeMessageSourceMarkdown({
          chatId: message.chatId,
          content: message.content,
          attachments: message.attachments ?? [],
          metadata: message.metadata,
          resourceReferences: messageResources,
          messageId: message.messageId,
          viewKey: message.viewKey,
          senderActorId: resolvedActorId,
          from: message.from,
        })
      : renderableContent,
  );
  const bubbleMarkdown = $derived(renderableContent);

  const openResource = (resource: WebChatResourceReference): void => {
    previewingResourceId = resource.id;
    if (resource.kind === "comment") {
      commentDetailMode = "view";
    }
  };
</script>

<div
  class="row"
  part={`message-row ${assistant ? "message-row-assistant" : viewerOwned ? "message-row-viewer" : "message-row-participant"}`}
  class:assistant={assistant}
  class:viewer-owned={viewerOwned && !assistant}
  data-kind={recalled ? "recalled" : message.kind}
  data-message-author={viewerOwned ? "viewer" : assistant ? "assistant" : "participant"}
>
  <div class="row-body" part="message-row-body">
    <div class="message-cluster" part="message-cluster">
      <div class="message-shell">
        <Framework7Message
          type={viewerOwned && !assistant ? "sent" : "received"}
          tail={groupTail}
          first={groupFirst}
          last={groupLast}
          class={assistant ? "message-assistant" : ""}
        >
          {#snippet avatar()}
            <ChatAvatar
              label={actorPresentation.label}
              subtitle={actorPresentation.subtitle}
              src={actorPresentation.iconUrl}
              class={`avatar avatar-${tone}`}
              part={`message-avatar message-avatar-${tone}`}
            />
          {/snippet}

          {#if !viewerOwned && groupFirst}
            {#snippet name()}
              {actorPresentation.label}
            {/snippet}
          {/if}

          {#snippet header()}
            {#if recalled || edited}
              <div class="meta-head" part="message-meta">
                {#if recalled}
                  <span class="revision-badge revision-badge-recalled">Recalled</span>
                {:else if edited}
                  <span class="revision-badge">Edited</span>
                {/if}
              </div>
            {/if}
          {/snippet}

          <div
            class={`message-card ${messageActions.length > 0 ? "message-card-with-actions" : ""} ${messageReadProgress ? "message-card-with-read" : ""}`}
            part={`message-bubble message-bubble-${tone}`}
            role="presentation"
            bind:this={messageCardRef}
            onpointerup={(event: PointerEvent) => {
              if (event.button !== 0) {
                return;
              }
              setTimeout(openSelectionCommentFromSelection, 0);
            }}
          >
            {#if referencedMessage && referencedPreviewText}
              <div class="reference-preview" data-testid="message-ref-preview" part="message-reference">
                <span class="reference-label">{referencedActorLabel ?? referencedMessage.from}</span>
                <p>{referencedPreviewText}</p>
              </div>
            {/if}

            {#if recalled}
              <div class="recall-block" part="message-recalled">
                <p>{renderableContent}</p>
              </div>
            {:else if message.kind === "error"}
              <div class="error-block" part="message-error">
                <div class="error-title" part="message-error-title">{message.payload?.error?.title ?? "Error"}</div>
                <p>{message.content}</p>
                {#if message.payload?.error?.detail}
                  <p class="error-detail">{message.payload.error.detail}</p>
                {/if}
              </div>
            {:else if message.kind === "interactive" && interactive}
              <div class="interactive-block" part="message-interactive">
                <p class="interactive-title" part="message-interactive-title">{interactive.title}</p>
                {#if interactive.description}
                  <p class="interactive-description">{interactive.description}</p>
                {/if}
                <List class="interactive-fields" strongIos dividersIos part="message-interactive-fields">
                  {#each interactive.fields as field (field.id)}
                    <ListInput
                      class="interactive-field"
                      part="message-interactive-field"
                      label={field.label}
                      type={field.multiline ? "textarea" : "text"}
                      resizable={field.multiline}
                      placeholder={field.placeholder}
                      value={interactiveDraft[field.id] ?? field.initialValue ?? ""}
                      oninput={(event: Event) => {
                        const target = event.currentTarget as HTMLInputElement | HTMLTextAreaElement;
                        interactiveDraft = { ...interactiveDraft, [field.id]: target.value };
                      }}
                    />
                  {/each}
                </List>
                <Framework7Button
                  type="button"
                  fill
                  small
                  round
                  class="interactive-submit"
                  part="message-interactive-submit"
                  disabled={interactiveSubmitting}
                  onclick={() => {
                    void submitInteractive();
                  }}
                >
                  {interactiveSubmitting ? "Sending..." : interactive.submitLabel ?? "Submit"}
                </Framework7Button>
              </div>
            {:else if renderableContent.trim().length > 0}
              <div class="content" part="message-content">
                <MessageMarkdownContent
                  value={bubbleMarkdown}
                  resources={messageResources}
                  {tone}
                  onOpenResource={openResource}
                />
              </div>
            {/if}

          </div>
          <MessageCommentActionPopover
            bind:open={commentActionOpen}
            anchor={commentActionAnchor}
            onComment={() => {
              if (!commentSelectionRequest) {
                return;
              }
              sourcePopupOpen = true;
              commentActionOpen = false;
            }}
          />
          {#snippet contentEnd()}
            {#if messageActions.length > 0 || messageReadProgress}
              <div
                class={`bubble-actions bubble-actions-${tone} ${messageReadProgress ? "bubble-actions-has-read" : ""} ${actionsOpen ? "bubble-actions-open" : ""}`}
              >
                <MessageActionsMenu
                  bind:open={actionsOpen}
                  actions={messageActions}
                  readProgress={messageReadProgress}
                  class={messageReadProgress ? "bubble-actions-read" : ""}
                />
              </div>
            {/if}
          {/snippet}
        </Framework7Message>
      </div>

    </div>
  </div>
</div>

<MessageSourcePopup
  message={message}
  {actorPresentation}
  resourceReferences={messageResources}
  open={sourcePopupOpen}
  activeLineNumber={requestedSourceLineNumber}
  activeLineEndNumber={requestedSourceLineEndNumber}
  commentSelectionRequest={commentSelectionRequest}
  onOpenChange={(next) => {
    sourcePopupOpen = next;
    if (!next) {
      commentSelectionRequest = null;
      requestedSourceLineNumber = 1;
      requestedSourceLineEndNumber = undefined;
      commentActionAnchor = null;
      commentActionOpen = false;
    }
  }}
  {onCreateCommentDraft}
/>

<ResourcePreviewLayer
  resource={previewingResource}
  open={Boolean(previewingResource)}
  commentMode={commentDetailMode}
  onCommentModeChange={(next) => {
    commentDetailMode = next;
  }}
  onOpenChange={(next) => {
    previewingResourceId = next ? previewingResourceId : null;
  }}
/>

<style>
  .row {
    display: flex;
    justify-content: flex-start;
    width: 100%;
    padding: 0;
  }

  .row.viewer-owned {
    justify-content: flex-end;
  }

  .row-body {
    display: flex;
    align-items: flex-start;
    width: 100%;
    max-width: min(40rem, 100%);
    padding-inline: 0.02rem;
    box-sizing: border-box;
  }

  .message-cluster {
    display: grid;
    min-width: 0;
    gap: 0.08rem;
    width: fit-content;
    max-width: 100%;
  }

  .message-shell {
    --message-action-button-size: 1.5rem;
    --message-action-gutter: 2.5rem;
    --message-action-inline-offset: calc(-1 * var(--message-action-button-size) - 0.75rem);
    --message-action-block-offset: 0;
    display: grid;
    position: relative;
    min-width: 0;
    overflow: visible;
    padding-inline-end: var(--message-action-gutter);
  }

  .row.viewer-owned .message-shell {
    padding-inline-start: var(--message-action-gutter);
    padding-inline-end: 0;
  }

  .row.viewer-owned .row-body {
    justify-content: flex-end;
  }

  .row.viewer-owned .message-cluster,
  .row.viewer-owned .message-shell {
    justify-items: end;
  }

  :global(.message .message-content),
  :global(.web-chat-f7-message-host .message-content) {
    min-width: 0;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    position: relative;
  }

  :global(.avatar-viewer) {
    border-color: rgba(0, 0, 0, 0.08);
    background: #d0d5dd;
    color: #344054;
  }

  :global(.avatar-assistant) {
    border-color: rgba(0, 0, 0, 0.06);
    background: #ffd76a;
    color: #7a4d00;
  }

  :global(.message .message-bubble) {
    position: relative;
    min-width: 0;
    min-inline-size: 3.4em;
    max-width: 100%;
    border-radius: var(--f7-message-bubble-border-radius, 16px);
    padding: var(--f7-message-bubble-padding-vertical, 7px) var(--f7-message-bubble-padding-horizontal, 13px);
    border: 0;
    background: var(--f7-message-received-bg-color, #e5e5ea);
    color: var(--f7-message-received-text-color, #111827);
    box-shadow: none;
    font-size: var(--f7-message-bubble-font-size, 15px);
    line-height: var(--f7-message-bubble-line-height, 1.32);
  }

  .row.viewer-owned :global(.message .message-bubble) {
    background: var(--f7-message-sent-bg-color, var(--f7-theme-color, #007aff));
    color: var(--f7-message-sent-text-color, #fff);
    box-shadow: none;
  }

  .row.viewer-owned :global(.message .message-content) {
    align-items: stretch;
  }

  .row.assistant :global(.message .message-bubble) {
    background: color-mix(in srgb, var(--f7-message-received-bg-color, #e5e5ea) 82%, #edf8f3);
  }

  .row[data-kind="error"] :global(.message .message-bubble) {
    background: #ffe6eb;
    color: #881337;
  }

  .message-card {
    display: grid;
    gap: 0.1rem;
    position: relative;
    inline-size: fit-content;
    min-inline-size: 3.4em;
    max-inline-size: 100%;
    justify-items: start;
  }

  .row.viewer-owned .message-card {
    justify-items: end;
  }

  .bubble-actions {
    --message-read-disclosure-inline-start: 0;
    --message-read-disclosure-inline-end: auto;
    position: absolute;
    inset-block-end: var(--message-action-block-offset);
    inset-inline-end: var(--message-action-inline-offset);
    opacity: 0.34;
    transition: opacity 120ms ease;
    z-index: 20;
  }

  .bubble-actions-viewer {
    --message-read-disclosure-inline-start: auto;
    --message-read-disclosure-inline-end: 0;
    inset-inline-start: var(--message-action-inline-offset);
    inset-inline-end: auto;
  }

  .message-shell:hover .bubble-actions,
  .message-shell:focus-within .bubble-actions,
  .bubble-actions-open {
    opacity: 1;
  }

  .bubble-actions-has-read {
    opacity: 1;
  }

  .meta-head {
    display: inline-flex;
    align-items: center;
    gap: 0.24rem;
    min-width: 0;
    flex-wrap: wrap;
  }

  .row.viewer-owned .meta-head {
    justify-content: flex-end;
  }

  .row :global(.message-header),
  .row :global(.message-footer) {
    display: flex;
  }

  .row.viewer-owned :global(.message-header),
  .row.viewer-owned :global(.message-footer) {
    justify-content: flex-end;
  }

  .row.viewer-owned :global(.message) {
    margin-inline-start: auto;
  }

  .subtitle,
  .timestamp {
    font-size: var(--f7-message-footer-font-size, 11px);
    line-height: 1.18;
    color: var(--f7-message-footer-text-color, #8e8e93);
    white-space: nowrap;
  }

  .row.viewer-owned .subtitle,
  .row.viewer-owned .timestamp {
    color: rgba(255, 255, 255, 0.74);
  }

  .subtitle-viewer-owned {
    opacity: 0.72;
  }

  .reference-preview {
    display: grid;
    gap: 0.1rem;
    padding: 0 0 0 0.34rem;
    border-radius: 8px;
    border: 0;
    background: transparent;
    position: relative;
    margin-bottom: 0.06rem;
  }

  .reference-preview::before {
    content: "";
    position: absolute;
    inset-block: 0.04rem;
    inset-inline-start: 0;
    width: 2px;
    border-radius: 999px;
    background: rgba(0, 0, 0, 0.12);
  }

  .reference-label {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0;
    color: rgba(0, 0, 0, 0.5);
  }

  .reference-preview p {
    margin: 0;
    font-size: 11px;
    line-height: 1.28;
    color: rgba(0, 0, 0, 0.62);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .row.viewer-owned .reference-preview {
    background: transparent;
  }

  .row.viewer-owned .reference-preview::before {
    background: rgba(255, 255, 255, 0.28);
  }

  .row.viewer-owned .reference-label,
  .row.viewer-owned .reference-preview p {
    color: rgba(255, 255, 255, 0.78);
  }

  .content {
    display: block;
    inline-size: fit-content;
    min-inline-size: 3.4em;
    max-inline-size: 100%;
  }

  .content :global(.message-markdown-content),
  .content :global(.message-markdown-fallback) {
    display: inline-block;
    inline-size: fit-content;
    min-inline-size: 3.4em;
    max-inline-size: 100%;
    color: inherit;
    text-align: left;
    line-height: inherit;
    overflow-wrap: anywhere;
  }

  .row.viewer-owned .content :global(.message-markdown-content),
  .row.viewer-owned .content :global(.message-markdown-fallback) {
    text-align: left;
  }

  .revision-badge {
    display: inline-flex;
    align-items: center;
    border-radius: 999px;
    padding: 0.14rem 0.42rem;
    background: rgba(0, 0, 0, 0.08);
    color: rgba(0, 0, 0, 0.62);
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0;
    text-transform: uppercase;
  }

  .revision-badge-recalled {
    background: rgba(251, 113, 133, 0.14);
    color: #9f1239;
  }

  .row.viewer-owned .revision-badge {
    background: color-mix(in srgb, white 16%, transparent);
    color: rgba(255, 255, 255, 0.82);
  }

  .row.viewer-owned .revision-badge-recalled {
    background: rgba(251, 113, 133, 0.18);
    color: rgba(255, 228, 230, 0.95);
  }

  .error-block,
  .recall-block,
  .interactive-block {
    display: grid;
    gap: 0.42rem;
  }

  .error-block p,
  .recall-block p,
  .interactive-description {
    margin: 0;
    white-space: pre-wrap;
    word-break: break-word;
    line-height: 1.6;
  }

  .recall-block {
    padding: 0.15rem 0 0.05rem;
    color: rgba(0, 0, 0, 0.58);
    font-style: italic;
  }

  .row.viewer-owned .recall-block {
    color: rgba(255, 255, 255, 0.82);
  }

  .error-title,
  .interactive-title {
    font-size: 14px;
    font-weight: 700;
  }

  .error-detail {
    font-size: 0.8rem;
    color: #9f1239;
  }

  .interactive-fields {
    margin: 0;
    width: min(100%, 18.75rem);
    --f7-list-bg-color: transparent;
    --f7-list-strong-bg-color: rgba(255, 255, 255, 0.68);
    --f7-list-inset-side-margin: 0;
    --f7-list-item-border-color: rgba(15, 23, 42, 0.08);
    --f7-list-item-padding-vertical: 0;
    --f7-list-item-padding-horizontal: 0;
    --f7-list-item-title-text-color: #334155;
  }

  :global(.interactive-fields.list .item-content) {
    padding-inline: 0.66rem;
  }

  :global(.interactive-fields.list .item-inner) {
    padding-block: 0.52rem;
    gap: 0.26rem;
  }

  :global(.interactive-fields.list .item-label) {
    font-size: 0.72rem;
    font-weight: 600;
    color: #334155;
  }

  :global(.interactive-fields.list .item-input-wrap input),
  :global(.interactive-fields.list .item-input-wrap textarea) {
    font-size: 0.78rem;
    color: #0f172a;
  }

  :global(.interactive-fields.list .item-input-wrap textarea) {
    min-height: 3.6rem;
  }

  :global(.interactive-submit) {
    width: fit-content;
    border-radius: 999px;
    min-height: 2rem;
  }

  .sr-only {
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
    .message-shell:hover .bubble-actions {
      opacity: 0;
    }

    .message-shell:hover .bubble-actions-has-read,
    .message-shell:focus-within .bubble-actions-has-read,
    .bubble-actions-open.bubble-actions-has-read {
      opacity: 1;
      transform: translateY(0);
    }

    .message-shell:focus-within .bubble-actions,
    .bubble-actions-open {
      opacity: 1;
      transform: translateY(0);
    }

    .row {
      padding-inline: 0;
    }

    .row-body {
      max-width: 100%;
      padding-inline: 0;
    }

    :global(.message .message-bubble) {
      padding: var(--f7-message-bubble-padding-vertical, 6px)
        var(--f7-message-bubble-padding-horizontal, 11px);
      border-radius: var(--f7-message-bubble-border-radius, 16px);
    }

    .message-card {
      gap: 0.1rem;
    }

    .subtitle,
    .timestamp {
      font-size: 11px;
    }

    :global(.web-chat-f7-message-host .message) {
      max-width: min(74%, 17.75rem);
    }

    .row.viewer-owned :global(.message-header),
    .row.viewer-owned :global(.message-footer) {
      padding-inline-end: 0.08rem;
    }

    .bubble-actions {
      inset-block-end: var(--message-action-block-offset);
      inset-inline-end: var(--message-action-inline-offset);
    }

    .message-shell {
      --message-action-button-size: 1.45rem;
      --message-action-gutter: 2.35rem;
    }
  }
</style>
