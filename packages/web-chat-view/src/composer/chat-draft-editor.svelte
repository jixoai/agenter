<script lang="ts">
  import {
    autocompletion,
    completionStatus,
    startCompletion,
    type Completion,
    type CompletionSource,
    type CompletionContext,
  } from "@codemirror/autocomplete";
  import { markdown } from "@codemirror/lang-markdown";
  import { EditorSelection, EditorState } from "@codemirror/state";
  import { languages } from "@codemirror/language-data";
  import { EditorView, placeholder as placeholderExtension } from "@codemirror/view";
  import { onMount, untrack } from "svelte";

  import type { ResolvedWebChatComposerCapabilities } from "./composer-contract";
  import {
    COMPLETION_LIMIT,
    findCompletionToken,
    padInsertedCompletion,
    resolveCompletionProviders,
  } from "./composer-contract";

  let {
    value,
    placeholder,
    disabled,
    submitting,
    capabilities,
    onChange,
    onSubmit,
  }: {
    value: string;
    placeholder: string;
    disabled: boolean;
    submitting: boolean;
    capabilities: ResolvedWebChatComposerCapabilities;
    onChange: (value: string) => void;
    onSubmit: () => void;
  } = $props();

  let hostRef = $state<HTMLDivElement | null>(null);
  let editorView = $state<EditorView | null>(null);

  let useCodeMirror = $state(
    typeof navigator !== "undefined" && !navigator.userAgent.toLowerCase().includes("jsdom"),
  );

  const completionProviders = $derived(resolveCompletionProviders(capabilities));

  const resolveActiveCompletionToken = (value: string, cursor: number) => {
    for (const provider of completionProviders) {
      const token = findCompletionToken(value, cursor, provider);
      if (token) {
        return { provider, token };
      }
    }
    return null;
  };

  const completionTypeForTrigger = (trigger: string): Completion["type"] => {
    switch (trigger) {
      case "/":
      case "?":
      case "？":
        return "keyword";
      case "^":
        return "type";
      default:
        return "variable";
    }
  };

  const completionLabelForItem = (
    provider: ResolvedWebChatComposerCapabilities["completionProviders"][number],
    item: {
      label: string;
    },
  ): string => {
    if (provider.trigger === "@" || provider.trigger === "^") {
      return `${provider.trigger}${item.label}`;
    }
    return item.label;
  };

  const createCompletionSource = (): CompletionSource => {
    return async (context: CompletionContext) => {
      const value = context.state.doc.toString();
      const resolved = resolveActiveCompletionToken(value, context.pos);
      if (!resolved) {
        return null;
      }
      const { provider, token } = resolved;
      const staticSuggestions = provider.suggestions ?? [];
      const dynamicSuggestions = provider.resolveSuggestions
        ? await provider.resolveSuggestions(token.query, { trigger: provider.trigger })
        : [];
      if (context.aborted) {
        return null;
      }
      const seen = new Set<string>();
      const options = [...staticSuggestions, ...dynamicSuggestions]
        .filter((item) => {
          if (seen.has(item.id)) {
            return false;
          }
          seen.add(item.id);
          return true;
        })
        .map<Completion>((item) => ({
          label: completionLabelForItem(provider, item),
          detail: item.detail,
          type: completionTypeForTrigger(provider.trigger),
          apply: (view, completion, from, to) => {
            const replacement = padInsertedCompletion(
              view.state.doc.toString(),
              { ...token, from, to },
              item.insertText,
            );
            view.dispatch({
              changes: { from, to, insert: replacement },
              selection: { anchor: from + replacement.length },
            });
          },
        }));
      if (options.length === 0) {
        return null;
      }
      return {
        from: token.from,
        to: token.to,
        filter: false,
        options: options.slice(0, COMPLETION_LIMIT),
      };
    };
  };

  const handleEditorSubmit = (): void => {
    if (disabled || submitting) {
      return;
    }
    onSubmit();
  };

  /**
   * TODO(codemirror-dedupe): remove these adapters once the workspace resolves to
   * a single CodeMirror state/view instance again.
   */
  const completionStatusForState = (state: EditorState): ReturnType<typeof completionStatus> => {
    return completionStatus(state as unknown as Parameters<typeof completionStatus>[0]);
  };

  const startCompletionForView = (view: EditorView): void => {
    startCompletion(view as unknown as Parameters<typeof startCompletion>[0]);
  };

  onMount(() => {
    if (!hostRef || !useCodeMirror) {
      return;
    }

    const completionSource = createCompletionSource();
    let view: EditorView;
    try {
      view = new EditorView({
        state: EditorState.create({
          doc: untrack(() => value),
          selection: EditorSelection.cursor(untrack(() => value.length)),
          extensions: [
            markdown({ codeLanguages: languages }),
            placeholderExtension(placeholder),
            EditorView.lineWrapping,
            EditorView.updateListener.of((update) => {
              if (!update.docChanged) {
                return;
              }
              const nextValue = update.state.doc.toString();
              onChange(nextValue);
              const cursor = update.state.selection.main.head;
              if (!resolveActiveCompletionToken(nextValue, cursor)) {
                return;
              }
              const status = completionStatusForState(update.state);
              if (status === "active" || status === "pending") {
                return;
              }
              startCompletionForView(update.view);
            }),
            EditorView.domEventHandlers({
              keydown: (event, viewState) => {
                if (
                  event.key !== "Enter" ||
                  event.shiftKey ||
                  event.metaKey ||
                  event.ctrlKey ||
                  event.altKey ||
                  event.isComposing
                ) {
                  return false;
                }
                if (completionStatusForState(viewState.state)) {
                  return false;
                }
                event.preventDefault();
                handleEditorSubmit();
                return true;
              },
            }),
            EditorView.theme({
              "&": {
                fontSize: "var(--web-chat-body-font-size, 13px)",
                backgroundColor: "transparent",
              },
              ".cm-editor": {
                minHeight: "var(--chat-draft-editor-min-height, 52px)",
                backgroundColor: "transparent",
              },
              ".cm-scroller": {
                fontFamily: "var(--font-sans, ui-sans-serif, system-ui, sans-serif)",
                lineHeight: "var(--web-chat-body-line-height, 1.45)",
              },
              ".cm-content": {
                minHeight: "var(--chat-draft-editor-content-min-height, 34px)",
                padding: "7px 12px 5px",
              },
              ".cm-focused": {
                outline: "none",
              },
              ".cm-line": {
                overflowWrap: "anywhere",
              },
              ".cm-gutters": {
                display: "none",
              },
              ".cm-placeholder": {
                color: "#94a3b8",
                whiteSpace: "normal",
                fontSize: "var(--web-chat-body-font-size, 13px)",
              },
              ".cm-tooltip-autocomplete": {
                border:
                  "1px solid color-mix(in srgb, var(--f7-messagebar-attachments-border-color, rgba(60,60,67,0.16)) 92%, transparent)",
                borderRadius: "20px",
                backgroundColor: "rgba(255,255,255,0.96)",
                boxShadow:
                  "0 16px 44px rgba(15,23,42,0.14), 0 0 0 1px rgba(255,255,255,0.28) inset",
                backdropFilter: "saturate(180%) blur(24px)",
                width: "min(22rem, calc(100vw - 1rem))",
                maxWidth: "calc(100vw - 1rem)",
                overflow: "hidden",
                padding: "0.2rem",
                zIndex: "24",
                boxSizing: "border-box",
              },
              ".cm-tooltip-autocomplete ul": {
                margin: "0",
                padding: "0",
              },
              ".cm-tooltip-autocomplete ul li": {
                borderRadius: "14px",
                display: "grid",
                gridTemplateColumns: "fit-content(8rem) minmax(0, 1fr)",
                alignItems: "start",
                columnGap: "0.56rem",
                rowGap: "0.08rem",
                padding: "0.5rem 0.74rem",
                fontFamily: "var(--font-sans, ui-sans-serif, system-ui, sans-serif)",
                fontSize: "13px",
                lineHeight: "1.28",
              },
              ".cm-tooltip-autocomplete ul li[aria-selected]": {
                backgroundColor:
                  "color-mix(in srgb, var(--f7-theme-color, #007aff) 12%, rgba(255,255,255,0.98))",
                color: "var(--f7-text-color, #111827)",
              },
              ".cm-tooltip-autocomplete ul li .cm-completionLabel": {
                display: "inline-flex",
                gridColumn: "1",
                minWidth: "0",
                overflow: "hidden",
                textOverflow: "ellipsis",
                fontWeight: "700",
                whiteSpace: "nowrap",
              },
              ".cm-tooltip-autocomplete ul li .cm-completionDetail": {
                display: "block",
                gridColumn: "2",
                alignSelf: "center",
                marginLeft: "0",
                fontSize: "12px",
                lineHeight: "1.32",
                fontStyle: "normal",
                whiteSpace: "normal",
                color: "#475569",
              },
              ".cm-tooltip-autocomplete ul li[aria-selected] .cm-completionLabel": {
                color: "var(--f7-theme-color, #007aff)",
              },
              ".cm-tooltip-autocomplete ul li[aria-selected] .cm-completionDetail": {
                color: "#475569",
              },
              ".cm-tooltip-autocomplete ul li .cm-completionMatchedText": {
                textDecoration: "none",
                fontWeight: "700",
              },
            }),
            autocompletion({
              override: [completionSource],
              activateOnTyping: true,
              icons: false,
              maxRenderedOptions: COMPLETION_LIMIT,
            }),
          ],
        }),
        parent: hostRef,
      });
    } catch (error) {
      console.warn("web-chat-view CodeMirror init failed, falling back to textarea", error);
      useCodeMirror = false;
      return;
    }

    editorView = view;
    return () => {
      if (editorView === view) {
        editorView = null;
      }
      view.destroy();
    };
  });

  $effect(() => {
    const view = editorView;
    if (!view) {
      return;
    }
    const currentValue = view.state.doc.toString();
    if (currentValue === value) {
      return;
    }
    const selection = Math.min(value.length, view.state.selection.main.head);
    view.dispatch({
      changes: {
        from: 0,
        to: view.state.doc.length,
        insert: value,
      },
      selection: EditorSelection.cursor(selection),
    });
  });
</script>

{#if useCodeMirror}
  <div
    bind:this={hostRef}
    class="chat-draft-editor"
    data-testid="web-chat-draft-editor"
    part="composer-editor"
  ></div>
{:else}
  <textarea
    value={value}
    rows={4}
    disabled={disabled || submitting}
    class="chat-draft-editor chat-draft-editor-fallback"
    data-testid="web-chat-draft-editor"
    part="composer-editor"
    {placeholder}
    oninput={(event) => {
      onChange((event.currentTarget as HTMLTextAreaElement).value);
    }}
    onkeydown={(event: KeyboardEvent) => {
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
      handleEditorSubmit();
    }}
  ></textarea>
{/if}

<style>
  .chat-draft-editor {
    --chat-draft-editor-min-height: 2.42rem;
    --chat-draft-editor-content-min-height: 28px;
    position: relative;
    overflow: visible;
    isolation: isolate;
    min-width: 0;
    border-radius: var(--f7-messagebar-textarea-border-radius, 24px);
    border: var(--f7-messagebar-textarea-border, none);
    background: var(--f7-messagebar-textarea-bg-color, rgba(255, 255, 255, 0.96));
    box-shadow: none;
    transition:
      border-color 160ms ease,
      box-shadow 160ms ease,
      background-color 160ms ease;
  }

  .chat-draft-editor:focus-within {
    box-shadow: none;
  }

  :global(.chat-draft-editor-fallback) {
    min-height: var(--chat-draft-editor-min-height, 4rem);
    resize: none;
    padding: 0.44rem 0.8rem 0.34rem;
    font-size: var(--f7-messagebar-textarea-font-size, 15px);
    line-height: var(--f7-messagebar-textarea-line-height, 20px);
  }

  :global(.chat-draft-editor .cm-editor) {
    min-height: var(--chat-draft-editor-min-height, 4rem);
    border-radius: inherit;
    position: relative;
    overflow: visible;
  }

  :global(.chat-draft-editor .cm-content) {
    padding: 0.44rem 0.8rem 0.34rem;
  }

  :global(.chat-draft-editor .cm-scroller) {
    overflow: visible;
  }

  :global(.chat-draft-editor .cm-focused) {
    outline: none;
  }

  @container (max-width: 34rem) {
    .chat-draft-editor {
      --chat-draft-editor-min-height: 2.28rem;
      --chat-draft-editor-content-min-height: 24px;
    }
  }
</style>
