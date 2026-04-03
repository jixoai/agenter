<script lang="ts">
  import MarkdownDocumentHost from "./components/markdown-document-host.svelte";
  import type { WebChatChannel, WebChatMessage } from "./types";
  import { isAssistantMessage } from "./message-utils";

  let {
    channel,
    message,
    onSubmitInteractive,
  }: {
    channel: WebChatChannel;
    message: WebChatMessage;
    onSubmitInteractive: (text: string) => Promise<void>;
  } = $props();

  const assistant = $derived(isAssistantMessage(channel, message));
  const interactive = $derived(message.kind === "interactive" ? message.payload?.interactive : undefined);
  let interactiveDraft: Record<string, string> = $state({});
  let interactiveSubmitting = $state(false);

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
</script>

<div class:assistant class="row" data-kind={message.kind}>
  <article class="bubble">
    <div class="meta">
      <span class="author">{message.from}</span>
      <span>{formatTimestamp(message.createdAt)}</span>
    </div>

    {#if message.kind === "error"}
      <div class="error-block">
        <div class="error-title">{message.payload?.error?.title ?? "Error"}</div>
        <p>{message.content}</p>
        {#if message.payload?.error?.detail}
          <p class="error-detail">{message.payload.error.detail}</p>
        {/if}
      </div>
    {:else if message.kind === "interactive" && interactive}
      <div class="interactive-block">
        <p class="interactive-title">{interactive.title}</p>
        {#if interactive.description}
          <p class="interactive-description">{interactive.description}</p>
        {/if}
        <div class="interactive-fields">
          {#each interactive.fields as field (field.id)}
            <label class="interactive-field">
              <span>{field.label}</span>
              {#if field.multiline}
                <textarea
                  rows="3"
                  value={interactiveDraft[field.id] ?? field.initialValue ?? ""}
                  placeholder={field.placeholder}
                  oninput={(event) => {
                    const target = event.currentTarget as HTMLTextAreaElement;
                    interactiveDraft = { ...interactiveDraft, [field.id]: target.value };
                  }}
                ></textarea>
              {:else}
                <input
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
        <button type="button" class="interactive-submit" disabled={interactiveSubmitting} onclick={() => void submitInteractive()}>
          {interactiveSubmitting ? "Sending..." : interactive.submitLabel ?? "Submit"}
        </button>
      </div>
    {:else if message.content.trim().length > 0}
      <div class="content">
        <MarkdownDocumentHost
          value={message.content}
          mode="preview"
          usage="chat"
          surface={assistant ? "bubble-assistant" : "bubble-user"}
          syntaxTone={assistant ? "accented" : "inherit"}
        />
      </div>
    {/if}

    {#if (message.attachments?.length ?? 0) > 0}
      <ul class="attachments">
        {#each message.attachments ?? [] as attachment (attachment.assetId)}
          <li>{attachment.name}</li>
        {/each}
      </ul>
    {/if}
  </article>
</div>

<style>
  .row {
    display: flex;
    justify-content: flex-end;
    width: 100%;
    padding: 0.35rem 0;
  }

  .row.assistant {
    justify-content: flex-start;
  }

  .bubble {
    max-width: min(44rem, 92%);
    border-radius: 1.25rem;
    padding: 0.9rem 1rem;
    background: #0f172a;
    color: #fff;
    box-shadow: 0 12px 32px rgba(15, 23, 42, 0.12);
  }

  .row.assistant .bubble {
    border: 1px solid rgba(148, 163, 184, 0.25);
    background: #fff;
    color: #0f172a;
    box-shadow: 0 12px 32px rgba(15, 23, 42, 0.06);
  }

  .row[data-kind="error"] .bubble {
    border: 1px solid rgba(244, 63, 94, 0.28);
    background: #fff1f2;
    color: #881337;
  }

  .meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.45rem;
    font-size: 0.72rem;
    opacity: 0.72;
  }

  .author {
    font-weight: 600;
  }

  .error-block p,
  .interactive-description {
    margin: 0;
    white-space: pre-wrap;
    word-break: break-word;
    line-height: 1.6;
  }

  .content {
    display: block;
  }

  .error-block,
  .interactive-block {
    display: grid;
    gap: 0.65rem;
  }

  .error-title,
  .interactive-title {
    font-size: 0.88rem;
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

  .interactive-field input,
  .interactive-field textarea {
    width: 100%;
    border: 1px solid #cbd5e1;
    border-radius: 0.75rem;
    padding: 0.55rem 0.7rem;
    font: inherit;
    color: #0f172a;
    background: #fff;
    outline: none;
  }

  .interactive-field input:focus,
  .interactive-field textarea:focus {
    border-color: #475569;
  }

  .interactive-submit {
    width: fit-content;
    border: 0;
    border-radius: 999px;
    background: #0f172a;
    padding: 0.45rem 0.85rem;
    color: #fff;
    font: inherit;
    font-size: 0.78rem;
    font-weight: 600;
    cursor: pointer;
  }

  .interactive-submit:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }

  .attachments {
    margin: 0.75rem 0 0;
    padding-left: 1rem;
    font-size: 0.78rem;
    opacity: 0.78;
  }
</style>
