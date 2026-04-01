import { ImagePlus, LoaderCircle, MonitorUp, Paperclip, SendHorizontal } from "lucide-react";
import { useLayoutEffect, useRef, useState, type RefObject } from "react";

import { AdaptiveIconButton } from "../../components/ui/adaptive-icon-button";
import { Button, ButtonLabel, ButtonLeadingVisual } from "../../components/ui/button";

interface ComposerActionBarProps {
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

export const ComposerActionBar = ({
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
}: ComposerActionBarProps) => {
  const leadingGroupRef = useRef<HTMLDivElement | null>(null);
  const [collapseSecondaryLabels, setCollapseSecondaryLabels] = useState(false);

  useLayoutEffect(() => {
    const container = leadingGroupRef.current;
    if (!container || typeof ResizeObserver === "undefined") {
      return;
    }

    const update = () => {
      const collapseThreshold = imageEnabled && screenshotSupported ? 188 : 96;
      setCollapseSecondaryLabels(container.clientWidth < collapseThreshold);
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(container);
    return () => {
      observer.disconnect();
    };
  }, [imageEnabled, screenshotSupported]);

  return (
    <div
      className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-1.5 py-1.5 md:px-2"
      data-testid="composer-action-bar"
      data-composer-row="actions"
    >
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

      <div
        ref={leadingGroupRef}
        className="flex min-w-0 items-center justify-start gap-1.5"
        data-testid="composer-action-leading"
      >
        <AdaptiveIconButton
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled || submitting}
          icon={imageEnabled ? ImagePlus : Paperclip}
          label="Attach"
          tooltip="Attach files, videos, or supported images"
          labelPriority={collapseSecondaryLabels ? "icon-only" : "always"}
          onClick={() => fileInputRef.current?.click()}
          containerClassName="min-w-0 shrink-0"
        />

        {imageEnabled && screenshotSupported ? (
          <AdaptiveIconButton
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled || submitting}
            icon={MonitorUp}
            label="Screenshot"
            tooltip="Capture a screenshot and add it as an attachment"
            labelPriority={collapseSecondaryLabels ? "icon-only" : "always"}
            onClick={onCaptureScreenshot}
            containerClassName="min-w-0 shrink-0"
          />
        ) : null}
      </div>

      <Button
        type="button"
        disabled={!canSubmit}
        onClick={onSubmit}
        title={submitTitle ?? submitLabel}
        className="shrink-0 justify-self-end"
        data-testid="composer-action-primary"
      >
        <ButtonLeadingVisual>
          {submitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <SendHorizontal className="h-4 w-4" />}
        </ButtonLeadingVisual>
        <ButtonLabel>{submitLabel}</ButtonLabel>
      </Button>
    </div>
  );
};
