<script lang="ts">
  import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
  import { EditorState, type Extension } from "@codemirror/state";
  import { languages } from "@codemirror/language-data";
  import { EditorView } from "@codemirror/view";
  import { onMount } from "svelte";

  import { markdownPreview } from "./markdown-preview";
  import type { MarkdownPreviewTone, MarkdownResourceReference } from "./types";
  import { cn } from "./utils";

  let {
    value,
    class: className = "",
    resources = [],
    tone = "participant",
    onOpenResource,
  }: {
    value: string;
    class?: string;
    resources?: readonly MarkdownResourceReference[];
    tone?: MarkdownPreviewTone;
    onOpenResource?: ((resource: MarkdownResourceReference) => void) | undefined;
  } = $props();

  const createExtensions = (): readonly Extension[] => [
    EditorState.readOnly.of(true),
    EditorView.editable.of(false),
    EditorView.lineWrapping,
    markdown({
      base: markdownLanguage,
      codeLanguages: languages,
    }),
    markdownPreview({
      resources,
      tone,
      onOpenResource,
    }),
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
        fontSize: "var(--web-chat-body-font-size, 13px)",
        lineHeight: "var(--web-chat-body-line-height, 1.45)",
        "--md-source-line-height": "calc(var(--web-chat-body-font-size, 13px) * var(--web-chat-body-line-height, 1.45))",
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
          extensions: createExtensions(),
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
      console.warn("@jixo/codemirror markdown preview init failed, falling back to plain text", error);
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
  <div class={cn("jixo-codemirror-markdown-preview-fallback", className)} data-jixo-codemirror-markdown-preview>
    {value}
  </div>
{:else}
  <div bind:this={hostRef} class={cn("jixo-codemirror-markdown-preview", className)} data-jixo-codemirror-markdown-preview></div>
{/if}

<style>
  .jixo-codemirror-markdown-preview,
  .jixo-codemirror-markdown-preview-fallback {
    min-width: 0;
    max-width: 100%;
    color: inherit;
  }

  .jixo-codemirror-markdown-preview-fallback {
    white-space: pre-wrap;
    word-break: break-word;
    overflow-wrap: anywhere;
    font-size: var(--web-chat-body-font-size, 13px);
    line-height: var(--web-chat-body-line-height, 1.45);
  }
</style>
