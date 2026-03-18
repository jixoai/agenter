import {
  autocompletion,
  completionStatus,
  startCompletion,
  type Completion,
  type CompletionSource,
} from "@codemirror/autocomplete";
import { markdown } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { EditorSelection } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import CodeMirror from "@uiw/react-codemirror";
import { ImagePlus, LoaderCircle, SendHorizontal, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";

import { Button, ButtonLabel, ButtonLeadingVisual } from "../../components/ui/button";
import { Dialog } from "../../components/ui/dialog";
import { cn } from "../../lib/utils";
import { findWorkspacePathToken } from "./ai-input-logic";

export interface AIInputSuggestion {
  label: string;
  path: string;
  isDirectory: boolean;
  ignored?: boolean;
}

export interface AIInputSubmitPayload {
  text: string;
  images: File[];
}

interface PendingImage {
  id: string;
  file: File;
  previewUrl: string;
}

export interface AIInputProps {
  workspacePath?: string | null;
  placeholder?: string;
  disabled?: boolean;
  imageEnabled?: boolean;
  submitLabel?: string;
  submitTitle?: string;
  onSubmit: (payload: AIInputSubmitPayload) => Promise<void> | void;
  onSearchPaths?: (input: { cwd: string; query: string; limit?: number }) => Promise<AIInputSuggestion[]>;
}

const COMPLETION_LIMIT = 8;

const createPendingImageId = (): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const isImageFile = (file: File): boolean => file.type.toLowerCase().startsWith("image/");

const normalizeImageFiles = (files: Iterable<File> | ArrayLike<File>): File[] => {
  const accepted: File[] = [];
  for (const file of Array.from(files)) {
    if (isImageFile(file)) {
      accepted.push(file);
    }
  }
  return accepted;
};

const dedupeImageFiles = (files: File[]): File[] => {
  const seen = new Set<string>();
  const deduped: File[] = [];
  for (const file of files) {
    const signature = [file.name, file.type, file.size, file.lastModified].join(":");
    if (seen.has(signature)) {
      continue;
    }
    seen.add(signature);
    deduped.push(file);
  }
  return deduped;
};

const extractImageFilesFromTransfer = (dataTransfer: DataTransfer | null | undefined): File[] => {
  if (!dataTransfer) {
    return [];
  }
  const fromFiles = normalizeImageFiles(dataTransfer.files);
  const fromItems = Array.from(dataTransfer.items ?? [])
    .filter((item) => item.kind === "file")
    .map((item) => item.getAsFile())
    .filter((file): file is File => file instanceof File && isImageFile(file));
  return dedupeImageFiles([...fromFiles, ...fromItems]);
};

const hasFileTransfer = (dataTransfer: DataTransfer | null | undefined): boolean => {
  if (!dataTransfer) {
    return false;
  }
  if (extractImageFilesFromTransfer(dataTransfer).length > 0) {
    return true;
  }
  return Array.from(dataTransfer.types).some((type) => type === "Files" || type.startsWith("image/"));
};

const createPendingImage = (file: File): PendingImage => ({
  id: createPendingImageId(),
  file,
  previewUrl: URL.createObjectURL(file),
});

const completionIsIgnored = (completion: Completion): boolean =>
  completion.type?.split(/\s+/).includes("ignored") ?? false;

export const AIInput = ({
  workspacePath,
  placeholder = "Message Agenter...",
  disabled = false,
  imageEnabled = false,
  submitLabel = "Send",
  submitTitle,
  onSubmit,
  onSearchPaths,
}: AIInputProps) => {
  const [draft, setDraft] = useState("");
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [previewImageId, setPreviewImageId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [editorResetKey, setEditorResetKey] = useState(0);

  const editorViewRef = useRef<EditorView | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pendingSelectionRef = useRef<number | null>(null);
  const dragDepthRef = useRef(0);
  const canSubmit = !disabled && !submitting && draft.trim().length > 0;

  const draftRef = useRef(draft);
  draftRef.current = draft;
  const pendingImagesRef = useRef(pendingImages);
  pendingImagesRef.current = pendingImages;
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;
  const submittingRef = useRef(submitting);
  submittingRef.current = submitting;
  const canSubmitRef = useRef(canSubmit);
  canSubmitRef.current = canSubmit;
  const imageEnabledRef = useRef(imageEnabled);
  imageEnabledRef.current = imageEnabled;

  const resetDragState = useCallback(() => {
    dragDepthRef.current = 0;
    setDragging(false);
  }, []);

  const mergePendingFiles = useCallback((files: File[]) => {
    if (files.length === 0 || !imageEnabledRef.current) {
      return;
    }
    setPendingImages((current) => [...current, ...files.map((file) => createPendingImage(file))]);
  }, []);

  useEffect(() => {
    if (imageEnabled) {
      return;
    }
    setPendingImages((current) => {
      current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
      return [];
    });
  }, [imageEnabled]);

  useEffect(() => {
    return () => {
      setPendingImages((current) => {
        current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
        return [];
      });
    };
  }, []);

  useEffect(() => {
    if (!workspacePath || !onSearchPaths) {
      return;
    }
    void onSearchPaths({ cwd: workspacePath, query: "@", limit: 1 }).catch(() => {
      // warm the workspace path index so the first completion stays responsive
    });
  }, [onSearchPaths, workspacePath]);

  useEffect(() => {
    const nextSelection = pendingSelectionRef.current;
    if (nextSelection === null) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      const view = editorViewRef.current;
      if (!view) {
        return;
      }
      const safeSelection = Math.max(0, Math.min(nextSelection, view.state.doc.length));
      pendingSelectionRef.current = null;
      view.dispatch({
        selection: EditorSelection.cursor(safeSelection),
        scrollIntoView: true,
      });
      view.focus();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [draft]);

  const removePendingImage = useCallback(
    (imageId: string) => {
      setPendingImages((current) => {
        const target = current.find((item) => item.id === imageId);
        if (target) {
          URL.revokeObjectURL(target.previewUrl);
        }
        return current.filter((item) => item.id !== imageId);
      });
      if (previewImageId === imageId) {
        setPreviewImageId(null);
      }
    },
    [previewImageId],
  );

  const replaceEditorDocument = useCallback((text: string, selection = text.length) => {
    const view = editorViewRef.current;
    if (!view) {
      return;
    }
    const current = view.state.doc.toString();
    if (current === text) {
      return;
    }
    const safeSelection = Math.max(0, Math.min(selection, text.length));
    view.dispatch({
      changes: {
        from: 0,
        to: view.state.doc.length,
        insert: text,
      },
      selection: EditorSelection.cursor(safeSelection),
    });
  }, []);

  const clearDraftState = useCallback(() => {
    replaceEditorDocument("", 0);
    draftRef.current = "";
    setDraft("");
    setEditorResetKey((current) => current + 1);
    pendingSelectionRef.current = 0;
  }, [replaceEditorDocument]);

  const restoreDraftState = useCallback((text: string, images: PendingImage[]) => {
    replaceEditorDocument(text, text.length);
    draftRef.current = text;
    pendingImagesRef.current = images;
    setDraft(text);
    setPendingImages(images);
    pendingSelectionRef.current = text.length;
  }, [replaceEditorDocument]);

  const submitCurrentDraft = useCallback(async (): Promise<void> => {
    if (submittingRef.current || disabledRef.current || !canSubmitRef.current) {
      return;
    }

    const text = draftRef.current.trim();
    const images = pendingImagesRef.current;
    if (text.length === 0) {
      return;
    }

    submittingRef.current = true;
    clearDraftState();
    pendingImagesRef.current = [];
    setPendingImages([]);
    setSubmitting(true);

    try {
      await onSubmit({
        text,
        images: images.map((item) => item.file),
      });
      images.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    } catch (error) {
      restoreDraftState(text, images);
      throw error;
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }, [clearDraftState, onSubmit, restoreDraftState]);

  const pathCompletionSource = useMemo<CompletionSource | null>(() => {
    if (!workspacePath || !onSearchPaths) {
      return null;
    }

    return async (context) => {
      const token = findWorkspacePathToken(context.state.doc.toString(), context.pos);
      if (!token) {
        return null;
      }

      const items = await onSearchPaths({
        cwd: workspacePath,
        query: token.raw,
        limit: COMPLETION_LIMIT,
      });
      if (context.aborted || items.length === 0) {
        return null;
      }

      const options: Completion[] = items.map((item) => ({
        label: item.path,
        displayLabel: item.label,
        detail: item.isDirectory ? "dir" : "file",
        type: [item.isDirectory ? "namespace" : "file", item.ignored ? "ignored" : ""].filter(Boolean).join(" "),
        apply: item.path.startsWith("@") ? item.path : `@${item.path}`,
        boost: item.isDirectory ? 5 : 0,
      }));

      return {
        from: token.from,
        to: token.to,
        filter: false,
        options,
      };
    };
  }, [onSearchPaths, workspacePath]);

  const extensions = useMemo(() => {
    const cmExtensions = [
      markdown({ codeLanguages: languages }),
      EditorView.lineWrapping,
      EditorView.updateListener.of((update) => {
        if (!update.docChanged) {
          return;
        }
        const cursor = update.state.selection.main.head;
        const token = findWorkspacePathToken(update.state.doc.toString(), cursor);
        if (!token) {
          return;
        }
        const status = completionStatus(update.state);
        if (status === "active" || status === "pending") {
          return;
        }
        startCompletion(update.view);
      }),
      EditorView.domEventHandlers({
        paste: (event) => {
          if (!imageEnabledRef.current) {
            return false;
          }
          const clipboardFiles = extractImageFilesFromTransfer(event.clipboardData);
          if (clipboardFiles.length === 0) {
            return false;
          }
          event.preventDefault();
          mergePendingFiles(clipboardFiles);
          return true;
        },
        drop: (event) => {
          if (!imageEnabledRef.current) {
            return false;
          }
          const droppedFiles = extractImageFilesFromTransfer(event.dataTransfer);
          if (droppedFiles.length === 0) {
            return false;
          }
          event.preventDefault();
          resetDragState();
          mergePendingFiles(droppedFiles);
          return true;
        },
      }),
      EditorView.theme({
        "&": {
          fontSize: "13px",
          backgroundColor: "transparent",
        },
        ".cm-scroller": {
          fontFamily: "var(--font-sans)",
          lineHeight: "1.55",
        },
        ".cm-content": {
          padding: "14px 14px 12px",
          minHeight: "132px",
        },
        ".cm-gutters": {
          display: "none",
        },
        ".cm-focused": {
          outline: "none",
        },
        ".cm-editor": {
          backgroundColor: "transparent",
        },
        ".cm-cursor": {
          borderLeftColor: "#0f766e",
        },
        ".cm-placeholder": {
          color: "#94a3b8",
        },
        ".cm-tooltip-autocomplete": {
          border: "1px solid #e2e8f0",
          backgroundColor: "rgba(255, 255, 255, 0.98)",
          borderRadius: "16px",
          padding: "4px",
          boxShadow: "0 16px 40px rgba(15, 23, 42, 0.16)",
          backdropFilter: "blur(10px)",
        },
        ".cm-tooltip-autocomplete ul": {
          fontFamily: "var(--font-sans)",
          padding: "0",
        },
        ".cm-tooltip-autocomplete ul li": {
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "10px",
          borderRadius: "12px",
          padding: "8px 10px",
          color: "#475569",
        },
        ".cm-tooltip-autocomplete ul li[aria-selected]": {
          backgroundColor: "#ccfbf1",
          color: "#134e4a",
        },
        ".cm-completionOption-ignored .cm-completionLabel": {
          color: "#64748b",
        },
        ".cm-completionOption-ignored .cm-completionDetail": {
          color: "#94a3b8",
        },
        ".cm-completionOption-ignored[aria-selected] .cm-completionLabel": {
          color: "#0f766e",
        },
        ".cm-completionFlag": {
          marginLeft: "8px",
          borderRadius: "999px",
          padding: "1px 6px",
          fontSize: "10px",
          fontWeight: "600",
          letterSpacing: "0.02em",
          textTransform: "uppercase",
          color: "#64748b",
          backgroundColor: "#e2e8f0",
        },
        ".cm-completionOption-ignored[aria-selected] .cm-completionFlag": {
          color: "#115e59",
          backgroundColor: "rgba(15, 118, 110, 0.12)",
        },
        ".cm-completionLabel": {
          minWidth: "0",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          fontWeight: "600",
        },
        ".cm-completionDetail": {
          marginLeft: "12px",
          color: "#94a3b8",
          fontSize: "11px",
          letterSpacing: "0.02em",
          textTransform: "uppercase",
        },
      }),
    ];

    if (pathCompletionSource) {
      cmExtensions.push(
        autocompletion({
          override: [pathCompletionSource],
          activateOnTyping: true,
          icons: false,
          maxRenderedOptions: COMPLETION_LIMIT,
          optionClass: (completion) => (completionIsIgnored(completion) ? "cm-completionOption-ignored" : ""),
          addToOptions: [
            {
              position: 72,
              render: (completion) => {
                if (!completionIsIgnored(completion)) {
                  return null;
                }
                const badge = document.createElement("span");
                badge.className = "cm-completionFlag";
                badge.textContent = "ignored";
                return badge;
              },
            },
          ],
        }),
      );
    }

    return cmExtensions;
  }, [mergePendingFiles, pathCompletionSource]);

  const handleEditorKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Enter" || event.shiftKey) {
      return;
    }

    const viewState = editorViewRef.current?.state as { field?: unknown } | undefined;
    const completionState =
      typeof viewState?.field === "function" ? completionStatus(editorViewRef.current.state) : null;
    if (completionState) {
      return;
    }
    if (!canSubmitRef.current) {
      return;
    }

    event.preventDefault();
    void submitCurrentDraft().catch(() => {
      // parent surfaces the failure; AIInput only restores the draft state
    });
  };

  const previewImage = previewImageId ? (pendingImages.find((item) => item.id === previewImageId) ?? null) : null;

  return (
    <section
      className={cn(
        "overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-colors",
        dragging ? "border-teal-500 bg-teal-50/40" : "",
        disabled ? "opacity-80" : "",
      )}
      onDragEnter={(event) => {
        if (!imageEnabled || !hasFileTransfer(event.dataTransfer)) {
          return;
        }
        event.preventDefault();
        dragDepthRef.current += 1;
        setDragging(true);
      }}
      onDragOver={(event) => {
        if (!imageEnabled || !hasFileTransfer(event.dataTransfer)) {
          return;
        }
        event.preventDefault();
        if (!dragging) {
          setDragging(true);
        }
      }}
      onDragLeave={(event) => {
        if (!imageEnabled || !hasFileTransfer(event.dataTransfer)) {
          return;
        }
        event.preventDefault();
        dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
        if (dragDepthRef.current === 0 && !event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setDragging(false);
        }
      }}
      onDrop={(event) => {
        if (!imageEnabled || !hasFileTransfer(event.dataTransfer)) {
          return;
        }
        resetDragState();
        if (event.defaultPrevented) {
          return;
        }
        event.preventDefault();
        mergePendingFiles(extractImageFilesFromTransfer(event.dataTransfer));
      }}
      onPaste={(event) => {
        if (!imageEnabled || event.defaultPrevented) {
          return;
        }
        const clipboardFiles = extractImageFilesFromTransfer(event.clipboardData);
        if (clipboardFiles.length === 0) {
          return;
        }
        event.preventDefault();
        mergePendingFiles(clipboardFiles);
      }}
    >
      {pendingImages.length > 0 ? (
        <div className="flex flex-wrap gap-2 border-b border-slate-200 px-3 py-3">
          {pendingImages.map((image) => (
            <div key={image.id} className="group relative">
              <button
                type="button"
                onClick={() => setPreviewImageId(image.id)}
                className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50"
                title={image.file.name}
              >
                <img src={image.previewUrl} alt={image.file.name} className="h-16 w-16 object-cover" />
              </button>
              <button
                type="button"
                onClick={() => removePendingImage(image.id)}
                aria-label={`Remove ${image.file.name}`}
                className="absolute -top-1 -right-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-white opacity-0 transition-opacity group-hover:opacity-100"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <div className="relative">
        <CodeMirror
          key={editorResetKey}
          value={draft}
          onChange={(value) => {
            if (submittingRef.current || disabledRef.current) {
              return;
            }
            draftRef.current = value;
            setDraft(value);
          }}
          onCreateEditor={(view) => {
            editorViewRef.current = view;
          }}
          placeholder={placeholder}
          extensions={extensions}
          basicSetup={{
            lineNumbers: false,
            foldGutter: false,
            highlightActiveLineGutter: false,
            highlightActiveLine: false,
          }}
          editable={!disabled && !submitting}
          readOnly={disabled || submitting}
          theme="none"
          onKeyDown={handleEditorKeyDown}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 px-3 py-2">
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
          {imageEnabled ? (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(event) => {
                  mergePendingFiles(normalizeImageFiles(Array.from(event.target.files ?? [])));
                  event.currentTarget.value = "";
                }}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={disabled || submitting}
                onClick={() => fileInputRef.current?.click()}
                title="Attach images"
              >
                <ButtonLeadingVisual>
                  <ImagePlus className="h-3.5 w-3.5" />
                </ButtonLeadingVisual>
                <ButtonLabel>Images</ButtonLabel>
              </Button>
            </>
          ) : null}
          <span>@ workspace path</span>
          <span className="text-slate-300">/</span>
          <span>Enter send</span>
          <span className="text-slate-300">/</span>
          <span>Shift+Enter newline</span>
          {imageEnabled ? (
            <>
              <span className="text-slate-300">/</span>
              <span>Paste or drop images</span>
            </>
          ) : null}
        </div>

        <Button
          type="button"
          disabled={!canSubmit}
          onClick={() => {
            void submitCurrentDraft().catch(() => {
              // parent surfaces the failure; AIInput only restores the draft state
            });
          }}
          title={submitTitle ?? submitLabel}
        >
          <ButtonLeadingVisual>
            {submitting ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <SendHorizontal className="h-4 w-4" />
            )}
          </ButtonLeadingVisual>
          <ButtonLabel>{submitLabel}</ButtonLabel>
        </Button>
      </div>

      <Dialog
        open={previewImage !== null}
        title={previewImage?.file.name ?? "Image preview"}
        description={
          previewImage ? `${previewImage.file.type || "image"} · ${previewImage.file.size} bytes` : undefined
        }
        onClose={() => setPreviewImageId(null)}
      >
        {previewImage ? (
          <img
            src={previewImage.previewUrl}
            alt={previewImage.file.name}
            className="max-h-[70dvh] w-full object-contain"
          />
        ) : null}
      </Dialog>
    </section>
  );
};
