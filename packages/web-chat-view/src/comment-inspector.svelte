<script lang="ts">
  import Eye from "@lucide/svelte/icons/eye";
  import FilePenLine from "@lucide/svelte/icons/file-pen-line";
  import MessageSquareMore from "@lucide/svelte/icons/message-square-more";

  import {
    Block,
    BlockTitle,
    Button as Framework7Button,
    Link,
    List,
    ListInput,
    PageContent,
    Segmented,
    Sheet,
    Toolbar,
  } from "./framework7-components";
  import { useFramework7Runtime } from "./framework7-host";
  import ResourcePreviewShell from "./resource-preview-shell.svelte";

  let {
    open = $bindable(false),
    title = "Comment",
    standaloneShell = true,
    selectedText,
    sourceActorLabel,
    sourceLineNumber,
    sourceUri,
    mode = "edit",
    canEdit = true,
    value = $bindable(""),
    onSave,
    onOpenChange,
    onModeChange,
  }: {
    open?: boolean;
    title?: string;
    standaloneShell?: boolean;
    selectedText: string;
    sourceActorLabel?: string | undefined;
    sourceLineNumber?: number | undefined;
    sourceUri?: string | undefined;
    mode?: "view" | "edit";
    canEdit?: boolean;
    value?: string;
    onSave?: (() => void | Promise<void>) | undefined;
    onOpenChange?: ((next: boolean) => void) | undefined;
    onModeChange?: ((next: "view" | "edit") => void) | undefined;
  } = $props();

  const effectiveCanEdit = $derived(canEdit && typeof onSave === "function");
  const trimmedValue = $derived(value.trim());
  const canSave = $derived(trimmedValue.length > 0 && effectiveCanEdit);
  const framework7Runtime = useFramework7Runtime();
  const editSheetOpen = $derived(open && mode === "edit" && effectiveCanEdit);
  const shellTitle = $derived(title);
  const shellAriaLabel = $derived(mode === "edit" ? `Edit ${title}` : title);
  const sourceSummary = $derived.by(() => {
    const parts: string[] = [];
    if (sourceActorLabel?.trim()) {
      parts.push(sourceActorLabel.trim());
    }
    if (typeof sourceLineNumber === "number") {
      parts.push(`Line ${sourceLineNumber}`);
    }
    return parts.join(" · ");
  });

  const close = (): void => {
    open = false;
    onOpenChange?.(false);
  };

  const handleShellOpenChange = (next: boolean): void => {
    open = next;
    onOpenChange?.(next);
  };

  const setMode = (next: "view" | "edit"): void => {
    if (next === "edit" && !effectiveCanEdit) {
      return;
    }
    onModeChange?.(next);
  };

  const handleEditSheetClosed = (): void => {
    if (open && mode === "edit") {
      setMode("view");
    }
  };

  const save = async (): Promise<void> => {
    if (!canSave) {
      return;
    }
    await onSave?.();
  };
</script>

{#snippet anchorCardContent()}
  <div class="comment-inspector-anchor-header">
    <div class="comment-inspector-anchor-badge">
      <MessageSquareMore class="size-4" />
    </div>
    <div class="comment-inspector-anchor-copy">
      <div class="comment-inspector-anchor-label">Selected text</div>
      {#if sourceSummary}
        <div class="comment-inspector-anchor-meta">{sourceSummary}</div>
      {/if}
    </div>
  </div>

  <div class="comment-inspector-selection">{selectedText}</div>

  {#if sourceUri}
    <div class="comment-inspector-anchor-uri">{sourceUri}</div>
  {/if}
{/snippet}

{#snippet commentCardContent()}
  {#if mode === "edit" && !$framework7Runtime}
    <List class="comment-inspector-edit-list" strongIos insetIos>
      <ListInput
        label="Comment"
        input={false}
      >
        {#snippet inputContent()}
          <textarea
            class="comment-inspector-native-textarea"
            rows="4"
            bind:value
            placeholder="Add a selected-text comment"
          ></textarea>
        {/snippet}
      </ListInput>
    </List>
  {:else}
    <div class="comment-inspector-view">{trimmedValue.length > 0 ? value : "No comment body yet."}</div>
  {/if}
{/snippet}

{#snippet inspectorBody()}
  <div class="comment-inspector-sheet" data-mode={mode} part="comment-inspector-body">
    <Segmented strong round class="comment-inspector-segmented" role="tablist" aria-label="Comment mode">
      <Framework7Button
        type="button"
        small
        round
        active={mode === "view"}
        role="tab"
        aria-selected={mode === "view"}
        onclick={() => setMode("view")}
      >
        <Eye class="size-3.5" />
        <span>View</span>
      </Framework7Button>
      <Framework7Button
        type="button"
        small
        round
        active={mode === "edit"}
        role="tab"
        aria-selected={mode === "edit"}
        disabled={!effectiveCanEdit}
        onclick={() => setMode("edit")}
      >
        <FilePenLine class="size-3.5" />
        <span>Edit</span>
      </Framework7Button>
    </Segmented>

    <BlockTitle class="comment-inspector-block-title">Selected text</BlockTitle>
    <Block class="comment-inspector-anchor-card" strongIos insetIos aria-label="Selected text comment anchor">
      {@render anchorCardContent()}
    </Block>
    <BlockTitle class="comment-inspector-block-title">Comment</BlockTitle>
    <Block class="comment-inspector-comment-card" strongIos insetIos aria-label="Comment body">
      {@render commentCardContent()}
    </Block>

    {#if mode === "edit" && $framework7Runtime}
      <div class="comment-inspector-edit-sheet-spacer" aria-hidden="true"></div>
    {:else}
      <div class="comment-inspector-footer">
        <Framework7Button type="button" small round outline onclick={close}>{mode === "edit" ? "Cancel" : "Close"}</Framework7Button>
        {#if mode === "edit"}
          <Framework7Button type="button" small round fill disabled={!canSave} onclick={() => void save()}>Save comment</Framework7Button>
        {/if}
      </div>
    {/if}
  </div>
{/snippet}

{#if standaloneShell}
  <ResourcePreviewShell
    {open}
    title={shellTitle}
    eyebrow="Comment"
    meta={sourceSummary}
    ariaLabel={shellAriaLabel}
    onOpenChange={handleShellOpenChange}
  >
    {@render inspectorBody()}
  </ResourcePreviewShell>
{:else}
  {@render inspectorBody()}
{/if}

{#if $framework7Runtime && effectiveCanEdit && open}
  <Sheet
    class="comment-inspector-edit-sheet"
    opened={editSheetOpen}
    containerEl="body"
    style="height: auto"
    swipeToClose
    backdrop={false}
    closeByOutsideClick={false}
    onSheetClosed={handleEditSheetClosed}
  >
    <Toolbar class="comment-inspector-edit-bar">
      <Link
        href="#"
        class="comment-inspector-edit-action"
        onclick={(event: MouseEvent) => {
          event.preventDefault();
          setMode("view");
        }}
      >
        Cancel
      </Link>
      <div class="comment-inspector-edit-title">
        <div class="comment-inspector-anchor-label">Edit comment</div>
        {#if sourceSummary}
          <div class="comment-inspector-anchor-meta">{sourceSummary}</div>
        {/if}
      </div>
      <Link
        href="#"
        role="button"
        class="comment-inspector-edit-action comment-inspector-edit-save"
        aria-disabled={!canSave}
        tabindex={!canSave ? -1 : undefined}
        onclick={(event: MouseEvent) => {
          event.preventDefault();
          if (!canSave) {
            return;
          }
          void save();
        }}
      >
        Save
      </Link>
    </Toolbar>
    <PageContent class="comment-inspector-edit-content">
      <div class="comment-inspector-edit-shell">
        <List class="comment-inspector-edit-list" strongIos insetIos>
          <ListInput
            label="Comment"
            input={false}
          >
            {#snippet inputContent()}
              <textarea
                class="comment-inspector-native-textarea"
                rows="3"
                bind:value
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
  .comment-inspector-sheet {
    display: grid;
    gap: 0.72rem;
    width: min(100%, 21.5rem);
    margin: 0 auto;
  }

  .comment-inspector-sheet[data-mode="edit"] {
    align-content: start;
  }

  :global(.comment-inspector-segmented.segmented) {
    width: min(100%, 12rem);
    margin: 0 auto 0.08rem;
    --f7-button-height: 1.86rem;
    --f7-button-font-size: 0.72rem;
    --f7-segmented-strong-padding: 2px;
    --f7-segmented-strong-between-buttons: 2px;
  }

  :global(.comment-inspector-segmented .button) {
    gap: 0.28rem;
  }

  :global(.comment-inspector-anchor-card.block),
  :global(.comment-inspector-comment-card.block) {
    display: grid;
    gap: 0.42rem;
    margin-block: 0;
    padding-block: 0.72rem;
  }

  .comment-inspector-anchor-header {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 0.68rem;
    align-items: center;
  }

  .comment-inspector-anchor-badge {
    display: grid;
    place-items: center;
    width: 2.4rem;
    height: 2.4rem;
    border-radius: 0.82rem;
    background: rgba(15, 23, 42, 0.96);
    color: white;
  }

  .comment-inspector-anchor-copy {
    min-width: 0;
    display: grid;
    gap: 0.16rem;
  }

  .comment-inspector-anchor-label {
    font-size: 0.62rem;
    font-weight: 700;
    text-transform: uppercase;
    color: var(--f7-text-color-secondary, #64748b);
  }

  :global(.comment-inspector-block-title.block-title) {
    margin: 0.05rem 1rem -0.42rem;
    color: var(--f7-text-color-secondary, #64748b);
    font-size: 0.62rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .comment-inspector-anchor-meta,
  .comment-inspector-anchor-uri {
    font-size: 0.7rem;
    line-height: 1.42;
    color: var(--f7-text-color-secondary, #475569);
    word-break: break-word;
  }

  .comment-inspector-anchor-uri {
    display: none;
  }

  .comment-inspector-selection,
  .comment-inspector-view {
    color: var(--f7-text-color, #0f172a);
    font-size: 0.78rem;
    line-height: 1.5;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .comment-inspector-selection {
    border-radius: 0.8rem;
    background: color-mix(in srgb, var(--f7-theme-color, #007aff) 7%, white);
    padding: 0.68rem 0.74rem;
  }

  .comment-inspector-view {
    min-height: 4.2rem;
  }

  .comment-inspector-edit-sheet-spacer {
    height: clamp(9.5rem, 30vh, 13.5rem);
  }

  .comment-inspector-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
  }

  :global(.comment-inspector-edit-sheet.sheet-modal) {
    --f7-sheet-border-radius: 22px 22px 0 0;
    background: rgba(248, 248, 252, 0.96);
    backdrop-filter: saturate(180%) blur(24px);
  }

  :global(.comment-inspector-edit-content.page-content) {
    --f7-page-toolbar-top-offset: var(--f7-toolbar-height);
    height: auto;
    padding:
      0.52rem
      max(0.72rem, env(safe-area-inset-right))
      calc(0.86rem + env(safe-area-inset-bottom))
      max(0.72rem, env(safe-area-inset-left));
  }

  .comment-inspector-edit-shell {
    display: grid;
    gap: 0.52rem;
    width: min(100%, 23rem);
    margin: 0 auto;
  }

  :global(.comment-inspector-edit-list.list) {
    margin: 0;
    --f7-list-inset-side-margin: 0;
    --f7-list-strong-bg-color: rgba(255, 255, 255, 0.72);
  }

  :global(.comment-inspector-edit-list .item-input-wrap textarea) {
    min-height: 5.25rem;
    max-height: min(30vh, 9rem);
  }

  :global(.comment-inspector-native-textarea) {
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

  :global(.comment-inspector-edit-bar.toolbar) {
    --f7-toolbar-bg-color: transparent;
    --f7-toolbar-height: auto;
    margin: 0;
    background: transparent;
  }

  :global(.comment-inspector-edit-bar .toolbar-inner) {
    display: grid;
    grid-template-columns: minmax(3.9rem, max-content) minmax(0, 1fr) minmax(3.9rem, max-content);
    gap: 0.5rem;
    align-items: center;
    padding: 0;
  }

  .comment-inspector-edit-title {
    min-width: 0;
    display: grid;
    justify-items: center;
    gap: 0.08rem;
    text-align: center;
  }

  :global(.comment-inspector-edit-action.link) {
    justify-self: start;
    min-width: 3.9rem;
    color: var(--f7-theme-color, #007aff);
    padding: 0.2rem 0.12rem;
    font-size: 0.76rem;
    font-weight: 600;
    text-align: start;
    text-decoration: none;
  }

  :global(.comment-inspector-edit-save.link) {
    justify-self: end;
    text-align: end;
  }

  .comment-inspector-edit-shell :global(.web-chat-f7-textarea) {
    min-height: 5.4rem;
    max-height: min(30vh, 9rem);
    resize: none;
  }

  :global(.comment-inspector-edit-action[aria-disabled="true"]) {
    opacity: 0.38;
    pointer-events: none;
  }
</style>
