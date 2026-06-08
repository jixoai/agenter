<script lang="ts">
  import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
  import { sql } from "@codemirror/lang-sql";
  import { Compartment, EditorState, type Extension } from "@codemirror/state";
  import { EditorView } from "@codemirror/view";
  import { tags as t } from "@lezer/highlight";
  import { onMount } from "svelte";

  import { cn } from "./utils";

  let {
    value = $bindable(""),
    disabled = false,
    ariaLabel = "SQL editor",
    placeholder = "",
    class: className = "",
  }: {
    value?: string;
    disabled?: boolean;
    ariaLabel?: string;
    placeholder?: string;
    class?: string;
  } = $props();

  const SQL_HIGHLIGHTING = syntaxHighlighting(
    HighlightStyle.define([
      { tag: [t.keyword, t.operatorKeyword, t.modifier], color: "var(--jixo-sql-keyword, #0369a1)", fontWeight: "600" },
      { tag: [t.string, t.special(t.string), t.regexp], color: "var(--jixo-sql-string, #0f766e)" },
      { tag: [t.number, t.integer, t.float, t.bool, t.null], color: "var(--jixo-sql-number, #b45309)" },
      { tag: [t.comment, t.lineComment, t.blockComment], color: "var(--jixo-sql-comment, #64748b)", fontStyle: "italic" },
      { tag: [t.variableName, t.labelName, t.attributeName, t.propertyName], color: "var(--jixo-sql-name, #475569)" },
      { tag: [t.typeName, t.className, t.namespace], color: "var(--jixo-sql-type, #7c3aed)" },
      { tag: [t.function(t.variableName), t.function(t.propertyName), t.definition(t.variableName)], color: "var(--jixo-sql-function, #be123c)" },
      { tag: [t.brace, t.squareBracket, t.paren, t.punctuation, t.separator], color: "var(--jixo-sql-punctuation, #94a3b8)" },
    ]),
  );

  const readOnlyCompartment = new Compartment();
  const editableCompartment = new Compartment();
  const createExtensions = (): readonly Extension[] => [
    readOnlyCompartment.of(EditorState.readOnly.of(disabled)),
    editableCompartment.of(EditorView.editable.of(!disabled)),
    EditorView.lineWrapping,
    sql(),
    SQL_HIGHLIGHTING,
    EditorView.contentAttributes.of({
      "aria-label": ariaLabel,
      "aria-multiline": "true",
      "data-jixo-codemirror-sql-editor-input": "true",
      role: "textbox",
      spellcheck: "false",
    }),
    EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        value = update.state.doc.toString();
      }
    }),
    EditorView.theme({
      "&": {
        backgroundColor: "transparent",
        color: "inherit",
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
        overflow: "auto",
      },
      ".cm-content": {
        minHeight: "4.5rem",
        minWidth: "0",
        maxWidth: "100%",
        padding: "0.625rem 0.75rem",
        fontFamily: "var(--font-mono)",
        fontSize: "12px",
        lineHeight: "1.6",
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
        backgroundColor: "color-mix(in srgb, currentColor 5%, transparent)",
      },
      ".cm-selectionBackground, ::selection": {
        backgroundColor: "color-mix(in srgb, currentColor 18%, transparent)",
      },
      ".cm-cursor, .cm-dropCursor": {
        borderLeftColor: "currentColor",
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

  const syncEditableState = (view: EditorView): void => {
    view.dispatch({
      effects: [
        readOnlyCompartment.reconfigure(EditorState.readOnly.of(disabled)),
        editableCompartment.reconfigure(EditorView.editable.of(!disabled)),
      ],
    });
  };

  onMount(() => {
    if (renderFallback || !hostRef) {
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
      console.warn("@jixo/codemirror SQL editor init failed, falling back to textarea", error);
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
    syncEditableState(view);
  });
</script>

{#if renderFallback}
  <textarea
    class={cn("jixo-codemirror-sql-editor-fallback", className)}
    data-jixo-codemirror-sql-editor
    aria-label={ariaLabel}
    {placeholder}
    {disabled}
    bind:value
  ></textarea>
{:else}
  <div
    bind:this={hostRef}
    class={cn("jixo-codemirror-sql-editor", className)}
    data-jixo-codemirror-sql-editor
    aria-label={ariaLabel}
  ></div>
{/if}

<style>
  .jixo-codemirror-sql-editor,
  .jixo-codemirror-sql-editor-fallback {
    min-width: 0;
    max-width: 100%;
    color: inherit;
  }

  .jixo-codemirror-sql-editor {
    overflow: hidden;
  }

  .jixo-codemirror-sql-editor-fallback {
    min-height: 4.5rem;
    width: 100%;
    resize: vertical;
    border: 0;
    background: transparent;
    padding: 0.625rem 0.75rem;
    font-family: var(--font-mono);
    font-size: 12px;
    line-height: 1.6;
    outline: none;
  }
</style>
