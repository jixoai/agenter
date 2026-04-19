<script lang="ts">
  import ChatAvatar from "./chat-avatar.svelte";
  import MessageMarkdownContent from "./components/message-markdown-content.svelte";
  import MessageAttachmentStrip from "./message-attachment-strip.svelte";
  import MessageActionsContextMenu from "./message-actions-context-menu.svelte";
  import MessageActionsMenu, {
    type ResolvedMessageAction,
  } from "./message-actions-menu.svelte";
  import MessageReadIndicator from "./message-read-indicator.svelte";
  import * as ContextMenu from "./ui/context-menu";
  import { Button } from "./ui/button";
  import { Input } from "./ui/input";
  import { Textarea } from "./ui/textarea";
  import type {
    WebChatActorPresentation,
    WebChatChannel,
    WebChatMessage,
    WebChatMessageAction,
    WebChatMessageReadProgress,
    WebChatMessageRenderInput,
  } from "./types";
  import {
    getRenderableMessageText,
    isAssistantMessage,
    isEditedMessage,
    isRecalledMessage,
    isViewerOwnedMessage,
  } from "./message-utils";

  let {
    channel,
    viewerActorId,
    message,
    resolveActorPresentation,
    resolveMessageActions,
    resolveMessageReadProgress,
    onSubmitInteractive,
  }: {
    channel: WebChatChannel;
    viewerActorId: string | null;
    message: WebChatMessage;
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
    onSubmitInteractive: (text: string) => Promise<void>;
  } = $props();

  let interactiveDraft: Record<string, string> = $state({});
  let interactiveSubmitting = $state(false);

  const assistant = $derived(isAssistantMessage(channel, message));
  const viewerOwned = $derived(isViewerOwnedMessage(viewerActorId, message));
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
        actorId: message.senderActorId ?? null,
        fallbackLabel,
      }) ?? {
        actorId: message.senderActorId ?? null,
        label: fallbackLabel,
        subtitle: undefined,
        iconUrl: null,
        kind: role,
      }
    );
  });

  const tone = $derived(assistant ? "assistant" : viewerOwned ? "viewer" : "participant");
  const formatTimestamp = (timestamp: number): string =>
    new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(timestamp));

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

  const writeClipboardText = async (value: string): Promise<void> => {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return;
    }
    const element = document.createElement("textarea");
    element.value = value;
    document.body.append(element);
    element.select();
    document.execCommand("copy");
    element.remove();
  };

  const builtInActions = $derived.by(() => {
    const actions: ResolvedMessageAction[] = [];
    if (message.content.trim().length > 0) {
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
  const messageReadProgress = $derived(resolveMessageReadProgress?.(renderInput) ?? null);
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
    <ChatAvatar
      label={actorPresentation.label}
      subtitle={actorPresentation.subtitle}
      src={actorPresentation.iconUrl}
      class={`avatar avatar-${tone}`}
      part={`message-avatar message-avatar-${tone}`}
    />

    <div class="message-cluster" part="message-cluster">
      <ContextMenu.Root>
        <ContextMenu.Trigger>
          {#snippet child({ props })}
            <article
              {...props}
              class="bubble group/bubble"
              part={`message-bubble message-bubble-${tone}`}
            >
              {#if messageActions.length > 0}
                <div class="bubble-actions">
                  <MessageActionsMenu actions={messageActions} />
                </div>
              {/if}

              <div class="meta" part="message-meta">
                <div class="meta-copy">
                  <div class="meta-head">
                    <span class="author" part="message-author">{actorPresentation.label}</span>
                    {#if recalled}
                      <span class="revision-badge revision-badge-recalled">Recalled</span>
                    {:else if edited}
                      <span class="revision-badge">Edited</span>
                    {/if}
                  </div>
                  {#if actorPresentation.subtitle}
                    <span class="subtitle">{actorPresentation.subtitle}</span>
                  {/if}
                </div>
                <span class="timestamp">{formatTimestamp(message.createdAt)}</span>
              </div>

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
                  <div class="interactive-fields" part="message-interactive-fields">
                    {#each interactive.fields as field (field.id)}
                      <label class="interactive-field" part="message-interactive-field">
                        <span>{field.label}</span>
                        {#if field.multiline}
                          <Textarea
                            rows={3}
                            value={interactiveDraft[field.id] ?? field.initialValue ?? ""}
                            placeholder={field.placeholder}
                            oninput={(event) => {
                              const target = event.currentTarget as HTMLTextAreaElement;
                              interactiveDraft = { ...interactiveDraft, [field.id]: target.value };
                            }}
                          />
                        {:else}
                          <Input
                            value={interactiveDraft[field.id] ?? field.initialValue ?? ""}
                            placeholder={field.placeholder}
                            oninput={(event) => {
                              const target = event.currentTarget as HTMLInputElement;
                              interactiveDraft = { ...interactiveDraft, [field.id]: target.value };
                            }}
                          />
                        {/if}
                      </label>
                    {/each}
                  </div>
                  <Button
                    type="button"
                    class="interactive-submit"
                    part="message-interactive-submit"
                    disabled={interactiveSubmitting}
                    onclick={() => {
                      void submitInteractive();
                    }}
                  >
                    {interactiveSubmitting ? "Sending..." : interactive.submitLabel ?? "Submit"}
                  </Button>
                </div>
              {:else if renderableContent.trim().length > 0}
                <div class="content" part="message-content">
                  <MessageMarkdownContent value={renderableContent} />
                </div>
              {/if}

              <MessageAttachmentStrip attachments={message.attachments ?? []} {tone} />
            </article>
          {/snippet}
        </ContextMenu.Trigger>
        {#if messageActions.length > 0}
          <MessageActionsContextMenu actions={messageActions} />
        {/if}
      </ContextMenu.Root>

      {#if messageReadProgress}
        <MessageReadIndicator progress={messageReadProgress} />
      {/if}
    </div>
  </div>
</div>

<style>
  .row {
    display: flex;
    justify-content: flex-start;
    width: 100%;
    padding: 0.22rem 0;
  }

  .row.viewer-owned {
    justify-content: flex-end;
  }

  .row-body {
    display: flex;
    align-items: flex-end;
    gap: 0.55rem;
    max-width: min(58rem, 100%);
  }

  .message-cluster {
    display: flex;
    min-width: 0;
    align-items: flex-end;
    gap: 0.35rem;
  }

  .row.viewer-owned .row-body {
    flex-direction: row-reverse;
  }

  :global(.avatar-viewer) {
    border-color: rgba(15, 23, 42, 0.18);
    background: linear-gradient(180deg, #0f172a, #1e293b);
    color: white;
  }

  :global(.avatar-assistant) {
    border-color: rgba(45, 212, 191, 0.26);
    background: linear-gradient(180deg, rgba(240, 253, 250, 0.98), rgba(204, 251, 241, 0.92));
    color: #0f766e;
  }

  .bubble {
    position: relative;
    min-width: 0;
    max-width: min(46rem, calc(100% - 2.7rem));
    border-radius: 1.02rem;
    padding: 0.68rem 0.82rem 0.74rem;
    border: 1px solid rgba(203, 213, 225, 0.48);
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.985), rgba(248, 250, 252, 0.94)),
      radial-gradient(circle at top, rgba(15, 23, 42, 0.02), transparent 60%);
    color: #0f172a;
    box-shadow: none;
  }

  .row.viewer-owned .bubble {
    border-color: rgba(15, 23, 42, 0.12);
    background:
      linear-gradient(180deg, rgba(15, 23, 42, 0.98), rgba(30, 41, 59, 0.96)),
      radial-gradient(circle at top, rgba(255, 255, 255, 0.12), transparent 62%);
    color: white;
    box-shadow: none;
  }

  .row.assistant .bubble {
    border-color: rgba(45, 212, 191, 0.14);
    background:
      linear-gradient(180deg, rgba(240, 253, 250, 0.98), rgba(236, 253, 245, 0.95)),
      radial-gradient(circle at top, rgba(20, 184, 166, 0.08), transparent 56%);
  }

  .row[data-kind="error"] .bubble {
    border-color: rgba(251, 113, 133, 0.2);
    background: linear-gradient(180deg, rgba(255, 241, 242, 0.98), rgba(255, 228, 230, 0.96));
    color: #881337;
  }

  .bubble-actions {
    position: absolute;
    top: 0.4rem;
    right: 0.4rem;
    opacity: 0;
    transform: translateY(-2px);
    transition: opacity 120ms ease, transform 120ms ease;
  }

  .bubble:hover .bubble-actions,
  .bubble:focus-within .bubble-actions {
    opacity: 1;
    transform: translateY(0);
  }

  .meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.55rem;
    margin-bottom: 0.3rem;
    padding-right: 1.6rem;
  }

  .meta-copy {
    display: grid;
    gap: 0.1rem;
    min-width: 0;
  }

  .meta-head {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    min-width: 0;
    flex-wrap: wrap;
  }

  .author {
    min-width: 0;
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.015em;
  }

  .subtitle,
  .timestamp {
    font-size: 0.64rem;
    line-height: 1.28;
    color: rgba(100, 116, 139, 0.92);
  }

  .row.viewer-owned .subtitle,
  .row.viewer-owned .timestamp {
    color: rgba(255, 255, 255, 0.68);
  }

  .content {
    display: block;
  }

  .content :global(.message-markdown-content),
  .content :global(.message-markdown-fallback) {
    color: inherit;
  }

  .revision-badge {
    display: inline-flex;
    align-items: center;
    border-radius: 999px;
    padding: 0.08rem 0.42rem;
    background: rgba(148, 163, 184, 0.18);
    color: rgba(51, 65, 85, 0.92);
    font-size: 0.62rem;
    font-weight: 700;
    letter-spacing: 0.02em;
    text-transform: uppercase;
  }

  .revision-badge-recalled {
    background: rgba(251, 113, 133, 0.14);
    color: #9f1239;
  }

  .row.viewer-owned .revision-badge {
    background: rgba(255, 255, 255, 0.14);
    color: rgba(255, 255, 255, 0.82);
  }

  .row.viewer-owned .revision-badge-recalled {
    background: rgba(251, 113, 133, 0.18);
    color: rgba(255, 228, 230, 0.95);
  }

  @media (pointer: coarse) {
    .bubble-actions {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .error-block,
  .recall-block,
  .interactive-block {
    display: grid;
    gap: 0.5rem;
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
    color: rgba(71, 85, 105, 0.92);
    font-style: italic;
  }

  .row.viewer-owned .recall-block {
    color: rgba(255, 255, 255, 0.82);
  }

  .error-title,
  .interactive-title {
    font-size: 0.9rem;
    font-weight: 700;
  }

  .error-detail {
    font-size: 0.8rem;
    color: #9f1239;
  }

  .interactive-fields {
    display: grid;
    gap: 0.55rem;
  }

  .interactive-field {
    display: grid;
    gap: 0.35rem;
    font-size: 0.74rem;
    color: #334155;
  }

  .interactive-field span {
    font-weight: 600;
  }

  .interactive-field :global([data-slot="input"]),
  .interactive-field :global([data-slot="textarea"]) {
    width: 100%;
    border-color: rgba(203, 213, 225, 0.9);
    background: rgba(255, 255, 255, 0.9);
  }

  :global(.interactive-submit) {
    width: fit-content;
    border-radius: 999px;
  }

  @container (max-width: 34rem) {
    .row-body {
      max-width: 100%;
      gap: 0.45rem;
    }

    .bubble {
      max-width: calc(100% - 2.25rem);
      padding: 0.62rem 0.72rem 0.68rem;
      border-radius: 0.94rem;
    }
  }
</style>
