<script lang="ts">
  import {
    autocompletion,
    completionStatus,
    startCompletion,
    type Completion,
    type CompletionSource,
  } from "@codemirror/autocomplete";
  import { markdown } from "@codemirror/lang-markdown";
  import { EditorSelection, EditorState } from "@codemirror/state";
  import { languages } from "@codemirror/language-data";
  import { EditorView, placeholder as placeholderExtension } from "@codemirror/view";
  import { onMount, untrack } from "svelte";

  import { Textarea } from "../ui/textarea";
  import type { ResolvedWebChatComposerCapabilities } from "./composer-contract";
  import {
    COMPLETION_LIMIT,
    findMentionToken,
    findSlashCommandToken,
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

  const createSlashCompletionSource = (): CompletionSource => {
    return async (context) => {
      const token = findSlashCommandToken(context.state.doc.toString(), context.pos);
      if (!token) {
        return null;
      }
      const query = token.raw.toLowerCase();
      const options = capabilities.commandSuggestions
        .filter((item) => item.label.startsWith(query as `/${string}`))
        .map<Completion>((item) => ({
          label: item.label,
          detail: item.detail,
          type: "keyword",
          apply: item.label,
        }));
      if (options.length === 0) {
        return null;
      }
      return {
        from: token.from,
        to: token.to,
        filter: false,
        options,
      };
    };
  };

  const createMentionCompletionSource = (): CompletionSource => {
    return async (context) => {
      const token = findMentionToken(context.state.doc.toString(), context.pos);
      if (!token) {
        return null;
      }
      const staticSuggestions = capabilities.mentionSuggestions.filter((item) =>
        item.label.toLowerCase().includes(token.query.toLowerCase()),
      );
      const dynamicSuggestions = capabilities.resolveMentionSuggestions
        ? await capabilities.resolveMentionSuggestions(token.query)
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
          label: `@${item.label}`,
          detail: item.detail,
          type: "variable",
          apply: item.apply ?? `@${item.label}`,
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

    const slashCompletionSource = createSlashCompletionSource();
    const mentionCompletionSource = createMentionCompletionSource();
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
              const mentionToken = findMentionToken(nextValue, cursor);
              const slashToken = findSlashCommandToken(nextValue, cursor);
              if (!mentionToken && !slashToken) {
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
                fontSize: "13px",
                backgroundColor: "transparent",
              },
              ".cm-editor": {
                minHeight: "var(--chat-draft-editor-min-height, 82px)",
                backgroundColor: "transparent",
              },
              ".cm-scroller": {
                fontFamily: "var(--font-sans, ui-sans-serif, system-ui, sans-serif)",
                lineHeight: "1.55",
              },
              ".cm-content": {
                minHeight: "var(--chat-draft-editor-content-min-height, 74px)",
                padding: "10px 12px 9px",
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
              },
              ".cm-tooltip-autocomplete": {
                border: "1px solid rgba(226,232,240,0.9)",
                borderRadius: "16px",
                backgroundColor: "rgba(255,255,255,0.98)",
                boxShadow: "0 18px 48px rgba(15,23,42,0.16)",
                padding: "4px",
              },
              ".cm-tooltip-autocomplete ul li": {
                borderRadius: "12px",
                padding: "8px 10px",
                fontFamily: "var(--font-sans, ui-sans-serif, system-ui, sans-serif)",
                fontSize: "12px",
              },
              ".cm-tooltip-autocomplete ul li[aria-selected]": {
                backgroundColor: "rgba(20,184,166,0.12)",
                color: "#0f766e",
              },
            }),
            autocompletion({
              override: [slashCompletionSource, mentionCompletionSource],
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
    class="chat-draft-editor min-w-0 rounded-[1rem] border border-slate-200/95 bg-white/78 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] transition-[color,box-shadow] focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px]"
    data-testid="web-chat-draft-editor"
    part="composer-editor"
  ></div>
{:else}
  <Textarea
    value={value}
    rows={4}
    disabled={disabled || submitting}
    class="chat-draft-editor min-h-[var(--chat-draft-editor-min-height,5.1rem)] resize-none rounded-[1rem] border-slate-200/95 bg-white/78 px-3 py-2.5 text-[13px] leading-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]"
    data-testid="web-chat-draft-editor"
    part="composer-editor"
    {placeholder}
    oninput={(event) => {
      onChange(event.currentTarget.value);
    }}
    onkeydown={(event) => {
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
  />
{/if}

<style>
  .chat-draft-editor {
    --chat-draft-editor-min-height: 5.1rem;
    --chat-draft-editor-content-min-height: 74px;
  }

  @container (max-width: 34rem) {
    .chat-draft-editor {
      --chat-draft-editor-min-height: 4rem;
      --chat-draft-editor-content-min-height: 54px;
    }
  }
</style>
