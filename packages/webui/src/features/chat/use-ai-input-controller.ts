import { completionStatus } from "@codemirror/autocomplete";
import { EditorSelection } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ClipboardEvent as ReactClipboardEvent,
  type DragEvent as ReactDragEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";

import { displayNoticeFromError } from "../../shared/notice";
import { createPendingAsset, extractFilesFromTransfer, hasFileTransfer, normalizeAttachableFiles, revokePendingAssetPreview } from "./ai-input-assets";
import { resolveAIInputCommand, type AIInputCommand, type AIInputSubmitPayload } from "./ai-input-contract";
import type { PendingAsset } from "./ai-input-types";
import { canCaptureDisplayScreenshot, captureDisplayScreenshot } from "./capture-display-screenshot";

interface UseAIInputControllerProps {
  disabled: boolean;
  imageEnabled: boolean;
  onSubmit: (payload: AIInputSubmitPayload) => Promise<void> | void;
  onCommand?: (command: AIInputCommand) => Promise<void> | void;
}

export const useAIInputController = ({
  disabled,
  imageEnabled,
  onSubmit,
  onCommand,
}: UseAIInputControllerProps) => {
  const [draft, setDraft] = useState("");
  const [pendingAssets, setPendingAssets] = useState<PendingAsset[]>([]);
  const [previewAssetId, setPreviewAssetId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [editorResetKey, setEditorResetKey] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);

  const editorViewRef = useRef<EditorView | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const dragDepthRef = useRef(0);
  const pendingSelectionRef = useRef<number | null>(null);

  const draftRef = useRef(draft);
  draftRef.current = draft;
  const pendingAssetsRef = useRef(pendingAssets);
  pendingAssetsRef.current = pendingAssets;
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;
  const submittingRef = useRef(submitting);
  submittingRef.current = submitting;
  const imageEnabledRef = useRef(imageEnabled);
  imageEnabledRef.current = imageEnabled;
  const canSubmit = !disabled && !submitting && draft.trim().length > 0;
  const canSubmitRef = useRef(canSubmit);
  canSubmitRef.current = canSubmit;
  const screenshotSupported = canCaptureDisplayScreenshot();

  const clearNotice = useCallback(() => {
    setNotice(null);
  }, []);

  const setNoticeFromError = useCallback((error: unknown, fallback: string) => {
    setNotice(displayNoticeFromError(error, fallback));
  }, []);

  const bindEditor = useCallback((view: EditorView) => {
    editorViewRef.current = view;
  }, []);

  const resetDragState = useCallback(() => {
    dragDepthRef.current = 0;
    setDragging(false);
  }, []);

  const mergePendingFiles = useCallback((files: File[]) => {
    if (files.length === 0) {
      return;
    }
    clearNotice();
    setPendingAssets((current) => [...current, ...files.map((file) => createPendingAsset(file))]);
  }, [clearNotice]);

  const replaceEditorDocument = useCallback((text: string, selection = text.length) => {
    const view = editorViewRef.current;
    if (!view) {
      return;
    }
    if (view.state.doc.toString() === text) {
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

  const restoreDraftState = useCallback((text: string, assets: PendingAsset[]) => {
    replaceEditorDocument(text, text.length);
    draftRef.current = text;
    pendingAssetsRef.current = assets;
    setDraft(text);
    setPendingAssets(assets);
    pendingSelectionRef.current = text.length;
  }, [replaceEditorDocument]);

  const removePendingAsset = useCallback((assetId: string) => {
    clearNotice();
    setPendingAssets((current) => {
      const target = current.find((item) => item.id === assetId);
      if (target) {
        revokePendingAssetPreview(target);
      }
      return current.filter((item) => item.id !== assetId);
    });
    setPreviewAssetId((current) => (current === assetId ? null : current));
  }, [clearNotice]);

  const captureScreenshot = useCallback(async (): Promise<void> => {
    if (!imageEnabledRef.current || !screenshotSupported) {
      return;
    }
    clearNotice();
    try {
      mergePendingFiles([await captureDisplayScreenshot()]);
    } catch (error) {
      setNoticeFromError(error, "Screen capture was canceled or blocked by the browser.");
      throw error;
    }
  }, [clearNotice, mergePendingFiles, screenshotSupported, setNoticeFromError]);

  const submitCurrentDraft = useCallback(async (): Promise<void> => {
    if (submittingRef.current || disabledRef.current || !canSubmitRef.current) {
      return;
    }

    clearNotice();
    const text = draftRef.current.trim();
    const assets = pendingAssetsRef.current;
    if (text.length === 0) {
      return;
    }
    const command = assets.length === 0 ? resolveAIInputCommand(text) : null;

    if (command === "/screenshot") {
      clearDraftState();
      try {
        await captureScreenshot();
      } catch (error) {
        restoreDraftState(text, assets);
        throw error;
      }
      return;
    }

    if (command && onCommand) {
      submittingRef.current = true;
      clearDraftState();
      setSubmitting(true);

      try {
        await onCommand(command);
      } catch (error) {
        restoreDraftState(text, assets);
        throw error;
      } finally {
        submittingRef.current = false;
        setSubmitting(false);
      }
      return;
    }

    submittingRef.current = true;
    clearDraftState();
    pendingAssetsRef.current = [];
    setPendingAssets([]);
    setSubmitting(true);

    try {
      await onSubmit({
        text,
        assets: assets.map((item) => item.file),
      });
      assets.forEach(revokePendingAssetPreview);
    } catch (error) {
      restoreDraftState(text, assets);
      throw error;
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }, [captureScreenshot, clearDraftState, clearNotice, onCommand, onSubmit, restoreDraftState]);

  const handleEditorChange = useCallback((value: string) => {
    if (submittingRef.current || disabledRef.current) {
      return;
    }
    draftRef.current = value;
    setDraft(value);
    if (notice) {
      setNotice(null);
    }
  }, [notice]);

  const handleEditorKeyDown = useCallback((event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Enter" || event.shiftKey) {
      return;
    }

    const view = editorViewRef.current;
    const viewState = view?.state as { field?: unknown } | undefined;
    const completionState = view && typeof viewState?.field === "function" ? completionStatus(view.state) : null;
    if (completionState) {
      return;
    }
    if (!canSubmitRef.current) {
      return;
    }

    event.preventDefault();
    void submitCurrentDraft().catch(() => {
      // parent route owns send failures; the composer only restores local draft state
    });
  }, [submitCurrentDraft]);

  const handleFileInputChange = useCallback((files: FileList | null) => {
    if (!files) {
      return;
    }
    mergePendingFiles(normalizeAttachableFiles(Array.from(files), imageEnabledRef.current));
  }, [mergePendingFiles]);

  const handleSurfaceDrop = useCallback((event: ReactDragEvent<HTMLElement>) => {
    if (!hasFileTransfer(event.dataTransfer)) {
      return;
    }
    resetDragState();
    if (event.defaultPrevented) {
      return;
    }
    event.preventDefault();
    mergePendingFiles(extractFilesFromTransfer(event.dataTransfer, { imageEnabled: imageEnabledRef.current }));
  }, [mergePendingFiles, resetDragState]);

  const handleSurfacePaste = useCallback((event: ReactClipboardEvent<HTMLElement>) => {
    if (event.defaultPrevented) {
      return;
    }
    const clipboardFiles = extractFilesFromTransfer(event.clipboardData, {
      imageEnabled: imageEnabledRef.current,
      imageOnly: true,
    });
    if (clipboardFiles.length === 0) {
      return;
    }
    event.preventDefault();
    mergePendingFiles(clipboardFiles);
  }, [mergePendingFiles]);

  useEffect(() => {
    if (imageEnabled) {
      return undefined;
    }
    setPendingAssets((current) => {
      const removed = current.filter((item) => item.kind === "image");
      if (removed.length === 0) {
        return current;
      }
      if (removed.some((item) => item.id === previewAssetId)) {
        setPreviewAssetId(null);
      }
      removed.forEach(revokePendingAssetPreview);
      return current.filter((item) => item.kind !== "image");
    });
    return undefined;
  }, [imageEnabled, previewAssetId]);

  useEffect(() => {
    return () => {
      pendingAssetsRef.current.forEach(revokePendingAssetPreview);
    };
  }, []);

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

  return {
    draft,
    pendingAssets,
    previewAsset: previewAssetId ? pendingAssets.find((item) => item.id === previewAssetId) ?? null : null,
    notice,
    submitting,
    dragging,
    canSubmit,
    screenshotSupported,
    editorResetKey,
    fileInputRef,
    bindEditor,
    mergePendingFiles,
    setPreviewAssetId,
    removePendingAsset,
    captureScreenshot,
    submitCurrentDraft,
    handleEditorChange,
    handleEditorKeyDown,
    handleFileInputChange,
    setDragging,
    dragDepthRef,
    resetDragState,
    handleSurfaceDrop,
    handleSurfacePaste,
  };
};
