import { useEffect, type ClipboardEvent as ReactClipboardEvent, type DragEvent as ReactDragEvent } from "react";

import { NoticeBanner } from "../../components/ui/notice-banner";
import { cn } from "../../lib/utils";
import { AIInputEditor } from "./AIInputEditor";
import { AIInputPendingAssets } from "./AIInputPendingAssets";
import { ChatAssetPreviewDialog } from "./ChatAssetPreviewDialog";
import { hasFileTransfer, toPendingAssetPreview } from "./ai-input-assets";
import type { AIInputCommand, AIInputSubmitPayload, AIInputSuggestion } from "./ai-input-contract";
import { AIInputToolbar } from "./AIInputToolbar";
import { useAIInputController } from "./use-ai-input-controller";

export type { AIInputCommand, AIInputSubmitPayload, AIInputSuggestion } from "./ai-input-contract";

export interface AIInputProps {
  workspacePath?: string | null;
  placeholder?: string;
  disabled?: boolean;
  imageEnabled?: boolean;
  imageCompatible?: boolean;
  submitLabel?: string;
  submitTitle?: string;
  onSubmit: (payload: AIInputSubmitPayload) => Promise<void> | void;
  onCommand?: (command: AIInputCommand) => Promise<void> | void;
  onSearchPaths?: (input: { cwd: string; query: string; limit?: number }) => Promise<AIInputSuggestion[]>;
}

export const AIInput = ({
  workspacePath,
  placeholder = "Message Agenter...",
  disabled = false,
  imageEnabled = false,
  imageCompatible = true,
  submitLabel = "Send",
  submitTitle,
  onSubmit,
  onCommand,
  onSearchPaths,
}: AIInputProps) => {
  const controller = useAIInputController({
    disabled,
    imageEnabled,
    imageCompatible,
    onSubmit,
    onCommand,
  });

  useEffect(() => {
    if (!workspacePath || !onSearchPaths) {
      return;
    }
    void onSearchPaths({ cwd: workspacePath, query: "@", limit: 1 }).catch(() => {
      // warm the workspace index so the first completion stays responsive
    });
  }, [onSearchPaths, workspacePath]);

  const handleDragEnter = (event: ReactDragEvent<HTMLElement>) => {
    if (!hasFileTransfer(event.dataTransfer)) {
      return;
    }
    event.preventDefault();
    controller.dragDepthRef.current += 1;
    controller.setDragging(true);
  };

  const handleDragOver = (event: ReactDragEvent<HTMLElement>) => {
    if (!hasFileTransfer(event.dataTransfer)) {
      return;
    }
    event.preventDefault();
    controller.setDragging(true);
  };

  const handleDragLeave = (event: ReactDragEvent<HTMLElement>) => {
    if (!hasFileTransfer(event.dataTransfer)) {
      return;
    }
    event.preventDefault();
    controller.dragDepthRef.current = Math.max(0, controller.dragDepthRef.current - 1);
    if (
      controller.dragDepthRef.current === 0 &&
      !event.currentTarget.contains(event.relatedTarget as Node | null)
    ) {
      controller.setDragging(false);
    }
  };

  const handleDrop = (event: ReactDragEvent<HTMLElement>) => {
    controller.handleSurfaceDrop(event);
  };

  const handlePaste = (event: ReactClipboardEvent<HTMLElement>) => {
    controller.handleSurfacePaste(event);
  };

  return (
    <section
      className={cn(
        "rounded-2xl border border-slate-200 bg-white shadow-sm transition-colors",
        controller.dragging ? "border-teal-500 bg-teal-50/40" : "",
        disabled ? "opacity-80" : "",
      )}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onPaste={handlePaste}
    >
      {controller.notice ? (
        <div className="border-b border-slate-200 px-3 py-3">
          <NoticeBanner tone="warning">{controller.notice}</NoticeBanner>
        </div>
      ) : null}

      <AIInputPendingAssets
        pendingAssets={controller.pendingAssets}
        onPreviewAsset={controller.setPreviewAssetId}
        onRemoveAsset={controller.removePendingAsset}
      />

      <AIInputEditor
        editorResetKey={controller.editorResetKey}
        value={controller.draft}
        placeholder={placeholder}
        disabled={disabled}
        submitting={controller.submitting}
        imageEnabled={imageEnabled}
        workspacePath={workspacePath}
        onSearchPaths={onSearchPaths}
        onChange={controller.handleEditorChange}
        onCreateEditor={controller.bindEditor}
        onKeyDown={controller.handleEditorKeyDown}
        onMergePendingFiles={controller.mergePendingFiles}
        onResetDragState={controller.resetDragState}
      />

      <AIInputToolbar
        disabled={disabled}
        submitting={controller.submitting}
        canSubmit={controller.canSubmit}
        imageEnabled={imageEnabled}
        screenshotSupported={controller.screenshotSupported}
        submitLabel={submitLabel}
        submitTitle={submitTitle}
        fileInputRef={controller.fileInputRef}
        onFileInputChange={controller.handleFileInputChange}
        onCaptureScreenshot={() => {
          void controller.captureScreenshot().catch(() => {
            // local composer notice already explains screenshot failures
          });
        }}
        onSubmit={() => {
          void controller.submitCurrentDraft().catch(() => {
            // parent route owns send failures; the composer only restores local draft state
          });
        }}
      />

      <ChatAssetPreviewDialog
        asset={controller.previewAsset ? toPendingAssetPreview(controller.previewAsset) : null}
        onClose={() => controller.setPreviewAssetId(null)}
      />
    </section>
  );
};
