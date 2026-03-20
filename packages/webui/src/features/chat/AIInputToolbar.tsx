import { ImagePlus, LoaderCircle, MonitorUp, Paperclip, SendHorizontal } from "lucide-react";
import type { RefObject } from "react";

import { Button, ButtonLabel, ButtonLeadingVisual } from "../../components/ui/button";

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

const ShortcutHint = ({ label, value }: { label: string; value: string }) => (
  <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-600">
    <kbd className="rounded bg-white px-1.5 py-0.5 font-mono text-[10px] font-medium text-slate-500 ring-1 ring-slate-200">
      {label}
    </kbd>
    <span>{value}</span>
  </span>
);

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
    <div className="flex flex-wrap items-end justify-between gap-3 border-t border-slate-200 px-3 py-3">
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*,*/*"
            multiple
            className="hidden"
            onChange={(event) => {
              onFileInputChange(event.target.files);
              event.currentTarget.value = "";
            }}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled || submitting}
            onClick={() => fileInputRef.current?.click()}
            title="Attach files, videos, or supported images"
          >
            <ButtonLeadingVisual>
              {imageEnabled ? <ImagePlus className="h-3.5 w-3.5" /> : <Paperclip className="h-3.5 w-3.5" />}
            </ButtonLeadingVisual>
            <ButtonLabel>Attach</ButtonLabel>
          </Button>

          {imageEnabled && screenshotSupported ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={disabled || submitting}
              onClick={onCaptureScreenshot}
              title="Capture a screenshot and add it as an attachment"
            >
              <ButtonLeadingVisual>
                <MonitorUp className="h-3.5 w-3.5" />
              </ButtonLeadingVisual>
              <ButtonLabel>Screenshot</ButtonLabel>
            </Button>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
          <ShortcutHint label="@" value="workspace path" />
          <ShortcutHint label="/" value="command" />
          <ShortcutHint label="Enter" value="send" />
          <ShortcutHint label="Shift+Enter" value="newline" />
          <ShortcutHint label="Drop" value="files" />
          {imageEnabled ? <ShortcutHint label="Paste" value="image" /> : null}
        </div>
      </div>

      <Button type="button" disabled={!canSubmit} onClick={onSubmit} title={submitTitle ?? submitLabel}>
        <ButtonLeadingVisual>
          {submitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <SendHorizontal className="h-4 w-4" />}
        </ButtonLeadingVisual>
        <ButtonLabel>{submitLabel}</ButtonLabel>
      </Button>
    </div>
  );
};
