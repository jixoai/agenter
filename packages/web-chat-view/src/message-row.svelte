<script lang="ts">
  import ChatAvatar from "./chat-avatar.svelte";
  import MessageMarkdownContent from "./components/message-markdown-content.svelte";
  import MessageAttachmentStrip from "./message-attachment-strip.svelte";
  import MessageReadIndicator from "./message-read-indicator.svelte";
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
  import { isAssistantMessage, isViewerOwnedMessage } from "./message-utils";

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

  const messageReadProgress = $derived(resolveMessageReadProgress?.(renderInput) ?? null);
</script>

<div
  class="row"
  part={`message-row ${assistant ? "message-row-assistant" : viewerOwned ? "message-row-viewer" : "message-row-participant"}`}
  class:assistant={assistant}
  class:viewer-owned={viewerOwned && !assistant}
  data-kind={message.kind}
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

    <article class="bubble group/bubble" part={`message-bubble message-bubble-${tone}`}>
      <div class="meta" part="message-meta">
        <div class="meta-copy">
          <span class="author" part="message-author">{actorPresentation.label}</span>
          {#if actorPresentation.subtitle}
            <span class="subtitle">{actorPresentation.subtitle}</span>
          {/if}
        </div>
        <span class="timestamp">{formatTimestamp(message.createdAt)}</span>
      </div>

      {#if message.kind === "error"}
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
      {:else if message.content.trim().length > 0}
        <div class="content" part="message-content">
          <MessageMarkdownContent value={message.content} />
        </div>
      {/if}

      <MessageAttachmentStrip attachments={message.attachments ?? []} {tone} />
    </article>

    {#if messageReadProgress}
      <MessageReadIndicator progress={messageReadProgress} />
    {/if}
  </div>
</div>

<style>
  .row {
    display: flex;
    justify-content: flex-start;
    width: 100%;
    padding: 0.42rem 0;
  }

  .row.viewer-owned {
    justify-content: flex-end;
  }

  .row-body {
    display: flex;
    align-items: flex-end;
    gap: 0.7rem;
    max-width: min(52rem, 100%);
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
    max-width: min(42rem, calc(100% - 3rem));
    border-radius: 1.3rem;
    padding: 0.85rem 1rem 0.9rem;
    border: 1px solid rgba(203, 213, 225, 0.72);
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.99), rgba(248, 250, 252, 0.96)),
      radial-gradient(circle at top, rgba(15, 23, 42, 0.02), transparent 60%);
    color: #0f172a;
    box-shadow: 0 18px 40px -34px rgba(15, 23, 42, 0.34);
  }

  .row.viewer-owned .bubble {
    border-color: rgba(15, 23, 42, 0.18);
    background:
      linear-gradient(180deg, rgba(15, 23, 42, 0.98), rgba(30, 41, 59, 0.96)),
      radial-gradient(circle at top, rgba(255, 255, 255, 0.12), transparent 62%);
    color: white;
    box-shadow: 0 22px 46px -34px rgba(15, 23, 42, 0.52);
  }

  .row.assistant .bubble {
    border-color: rgba(45, 212, 191, 0.22);
    background:
      linear-gradient(180deg, rgba(240, 253, 250, 0.98), rgba(236, 253, 245, 0.95)),
      radial-gradient(circle at top, rgba(20, 184, 166, 0.1), transparent 56%);
  }

  .row[data-kind="error"] .bubble {
    border-color: rgba(251, 113, 133, 0.28);
    background: linear-gradient(180deg, rgba(255, 241, 242, 0.98), rgba(255, 228, 230, 0.96));
    color: #881337;
  }

  .meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    margin-bottom: 0.45rem;
    padding-right: 2rem;
  }

  .meta-copy {
    display: grid;
    gap: 0.1rem;
    min-width: 0;
  }

  .author {
    min-width: 0;
    font-size: 0.74rem;
    font-weight: 700;
    letter-spacing: 0.015em;
  }

  .subtitle,
  .timestamp {
    font-size: 0.68rem;
    line-height: 1.35;
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
  .error-block,
  .interactive-block {
    display: grid;
    gap: 0.65rem;
  }

  .error-block p,
  .interactive-description {
    margin: 0;
    white-space: pre-wrap;
    word-break: break-word;
    line-height: 1.6;
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
    gap: 0.75rem;
  }

  .interactive-field {
    display: grid;
    gap: 0.35rem;
    font-size: 0.78rem;
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
      gap: 0.6rem;
    }

    .bubble {
      max-width: calc(100% - 2.5rem);
      padding-inline: 0.9rem;
    }
  }
</style>
