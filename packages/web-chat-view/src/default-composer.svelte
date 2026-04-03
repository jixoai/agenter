<script lang="ts">
  import type { WebChatComposerRenderProps } from "./types";

  let {
    channel,
    disabled,
    sending,
    connectionState,
    hintText,
    onSubmit,
  }: WebChatComposerRenderProps = $props();

  let draft = $state("");

  const canSubmit = $derived(!disabled && !sending && draft.trim().length > 0);

  const submit = async (): Promise<void> => {
    const text = draft.trim();
    if (!canSubmit || text.length === 0) {
      return;
    }
    await onSubmit({ text, assets: [] });
    draft = "";
  };

  const handleKeydown = (event: KeyboardEvent): void => {
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
</script>

<section class="composer">
  <div class="composer-frame">
    <textarea
      class="composer-textarea"
      bind:value={draft}
      rows="4"
      disabled={disabled || sending}
      placeholder={`Message ${channel.title}...`}
      onkeydown={handleKeydown}
    ></textarea>
    <div class="composer-footer">
      <span>{hintText}</span>
      <button type="button" class="composer-send" disabled={!canSubmit} onclick={() => void submit()}>
        {sending ? "Sending..." : "Send"}
      </button>
    </div>
  </div>
</section>

<style>
  .composer {
    border-top: 1px solid var(--web-chat-border, #dbe1ea);
    background: var(--web-chat-surface, rgba(255, 255, 255, 0.94));
    padding: 0.75rem;
  }

  .composer-frame {
    overflow: hidden;
    border: 1px solid var(--web-chat-border, #dbe1ea);
    border-radius: 1.125rem;
    background: #fff;
    box-shadow: 0 8px 24px rgba(15, 23, 42, 0.04);
  }

  .composer-textarea {
    width: 100%;
    min-height: 5rem;
    resize: vertical;
    border: 0;
    background: transparent;
    padding: 0.85rem 1rem;
    font: inherit;
    font-size: 0.95rem;
    line-height: 1.55;
    color: var(--web-chat-foreground, #0f172a);
    outline: none;
  }

  .composer-textarea::placeholder {
    color: #94a3b8;
  }

  .composer-textarea:disabled {
    cursor: not-allowed;
    opacity: 0.7;
  }

  .composer-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    border-top: 1px solid var(--web-chat-border, #dbe1ea);
    padding: 0.75rem 1rem;
    font-size: 0.75rem;
    color: #64748b;
  }

  .composer-send {
    border: 0;
    border-radius: 999px;
    background: #0f172a;
    padding: 0.45rem 0.9rem;
    color: #fff;
    font: inherit;
    font-size: 0.78rem;
    font-weight: 600;
    cursor: pointer;
    transition: opacity 120ms ease;
  }

  .composer-send:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }
</style>
