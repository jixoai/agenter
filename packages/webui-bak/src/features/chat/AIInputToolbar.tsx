import type { RefObject } from "react";

import { ComposerActionBar } from "./ComposerActionBar";
import { ComposerStatusBar } from "./ComposerStatusBar";

interface AIInputToolbarProps {
  disabled: boolean;
  submitting: boolean;
  canSubmit: boolean;
  imageEnabled: boolean;
  screenshotSupported: boolean;
  submitLabel: string;
  submitTitle?: string;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onFileInputChange: (files: FileList | null) => void;
  onCaptureScreenshot: () => void;
  onSubmit: () => void;
}

export const AIInputToolbar = ({
  disabled,
  submitting,
  canSubmit,
  imageEnabled,
  screenshotSupported,
  submitLabel,
  submitTitle,
  fileInputRef,
  onFileInputChange,
  onCaptureScreenshot,
  onSubmit,
}: AIInputToolbarProps) => {
  return (
    <div className="min-w-0 border-t border-slate-200" data-testid="composer-toolbar">
      <ComposerActionBar
        disabled={disabled}
        submitting={submitting}
        canSubmit={canSubmit}
        imageEnabled={imageEnabled}
        screenshotSupported={screenshotSupported}
        submitLabel={submitLabel}
        submitTitle={submitTitle}
        fileInputRef={fileInputRef}
        onFileInputChange={onFileInputChange}
        onCaptureScreenshot={onCaptureScreenshot}
        onSubmit={onSubmit}
      />
      <ComposerStatusBar
        disabled={disabled}
        submitting={submitting}
        imageEnabled={imageEnabled}
        screenshotSupported={screenshotSupported}
      />
    </div>
  );
};
