<script lang="ts">
  import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
  import { EditorState, type Extension } from "@codemirror/state";
  import { languages } from "@codemirror/language-data";
  import { EditorView } from "@codemirror/view";
  import { onMount } from "svelte";

  import { cn } from "../ui/utils";
  import { messageMarkdownPreview } from "./message-markdown-preview";

  let {
    value,
    class: className = "",
  }: {
    value: string;
    class?: string;
  } = $props();

  const extensions: readonly Extension[] = [
    EditorState.readOnly.of(true),
    EditorView.editable.of(false),
    EditorView.lineWrapping,
    markdown({
      base: markdownLanguage,
      codeLanguages: languages,
    }),
    messageMarkdownPreview(),
    EditorView.theme({
      "&": {
        backgroundColor: "transparent",
        color: "inherit",
        "--md-heading": "currentColor",
        "--md-link": "currentColor",
        "--md-inline-code": "currentColor",
        "--md-inline-code-bg": "color-mix(in srgb, currentColor 10%, transparent)",
        "--md-inline-code-border": "color-mix(in srgb, currentColor 16%, transparent)",
        "--md-quote": "color-mix(in srgb, currentColor 72%, transparent)",
        "--md-keyword": "currentColor",
        "--md-string": "currentColor",
        "--md-number": "currentColor",
        "--md-comment": "color-mix(in srgb, currentColor 62%, transparent)",
        "--md-type": "currentColor",
        "--md-function": "currentColor",
        "--md-property": "currentColor",
        "--md-operator": "color-mix(in srgb, currentColor 72%, transparent)",
        "--md-code-bg": "color-mix(in srgb, currentColor 6%, transparent)",
        "--md-code-border": "color-mix(in srgb, currentColor 16%, transparent)",
        "--md-code-label": "color-mix(in srgb, currentColor 72%, transparent)",
        "--md-code-text": "currentColor",
      },
      ".cm-editor": {
        minWidth: "0",
        maxWidth: "100%",
        backgroundColor: "transparent",
      },
      ".cm-focused": {
        outline: "none",
      },
      ".cm-scroller": {
        minWidth: "0",
        maxWidth: "100%",
        overflow: "visible",
      },
      ".cm-content": {
        minWidth: "0",
        maxWidth: "100%",
        padding: "0",
        fontFamily: "var(--font-sans)",
        fontSize: "13px",
        lineHeight: "1.6",
        "--md-source-line-height": "calc(13px * 1.6)",
        caretColor: "transparent",
        color: "inherit",
        overflowWrap: "anywhere",
      },
      ".cm-line": {
        paddingInline: "0",
      },
      ".cm-gutters": {
        display: "none",
      },
      ".cm-activeLine": {
        backgroundColor: "transparent",
      },
      ".cm-selectionBackground, ::selection": {
        backgroundColor: "color-mix(in srgb, currentColor 18%, transparent)",
      },
      ".cm-cursor, .cm-dropCursor": {
        display: "none",
      },
    }),
  ];

  let hostRef = $state<HTMLDivElement | null>(null);
  let editorView = $state<EditorView | null>(null);
  let renderFallback = $state(false);

  const syncValue = (view: EditorView, nextValue: string): void => {
    const currentValue = view.state.doc.toString();
    if (currentValue === nextValue) {
      return;
    }
    view.dispatch({
      changes: {
        from: 0,
        to: currentValue.length,
        insert: nextValue,
      },
    });
  };

  onMount(() => {
    if (!hostRef) {
      return;
    }
    try {
      const view = new EditorView({
        state: EditorState.create({
          doc: value,
          extensions,
        }),
        parent: hostRef,
      });
      editorView = view;
      return () => {
        if (editorView === view) {
          editorView = null;
        }
        view.destroy();
      };
    } catch (error) {
      console.warn("web-chat-view markdown preview init failed, falling back to plain text", error);
      renderFallback = true;
      return undefined;
    }
  });

  $effect(() => {
    const view = editorView;
    if (!view) {
      return;
    }
    syncValue(view, value);
  });
</script>

{#if renderFallback}
  <div class={cn("message-markdown-fallback", className)}>{value}</div>
{:else}
  <div bind:this={hostRef} class={cn("message-markdown-content", className)}></div>
{/if}

<style>
  .message-markdown-content,
  .message-markdown-fallback {
    min-width: 0;
    max-width: 100%;
    color: inherit;
  }

  .message-markdown-fallback {
    white-space: pre-wrap;
    word-break: break-word;
    overflow-wrap: anywhere;
    font-size: 13px;
    line-height: 1.6;
  }
</style>
