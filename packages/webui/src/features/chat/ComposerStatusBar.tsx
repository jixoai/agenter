import { ImagePlus, LoaderCircle, TextCursorInput } from "lucide-react";
import { useMemo } from "react";

import { HelpHint } from "../../components/ui/help-hint";
import { Tooltip } from "../../components/ui/tooltip";
import { cn } from "../../lib/utils";

interface ComposerStatusBarProps {
  disabled: boolean;
  submitting: boolean;
  imageEnabled: boolean;
  screenshotSupported: boolean;
}

const ShortcutHint = ({ label, value }: { label: string; value: string }) => (
  <span className="inline-flex h-5 items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-1.5 text-[10px] leading-none text-slate-600">
    <kbd className="rounded bg-white px-1 py-0.5 font-mono text-[9px] font-medium text-slate-500 ring-1 ring-slate-200">
      {label}
    </kbd>
    <span>{value}</span>
  </span>
);

const COMPOSER_HELP_ITEMS: Array<{ label: string; value: string }> = [
  { label: "@", value: "path" },
  { label: "/", value: "command" },
  { label: "Enter", value: "send" },
  { label: "Shift+Enter", value: "newline" },
  { label: "Drop", value: "files" },
  { label: "Paste", value: "image" },
];

const statusMeta = (input: {
  disabled: boolean;
  submitting: boolean;
  imageEnabled: boolean;
  screenshotSupported: boolean;
}): {
  label: string;
  toneClassName: string;
  iconClassName: string;
  Icon: typeof TextCursorInput;
} => {
  if (input.submitting) {
    return {
      label: "Sending",
      toneClassName: "border-amber-200 bg-amber-50 text-amber-800",
      iconClassName: "animate-spin",
      Icon: LoaderCircle,
    };
  }
  if (input.disabled) {
    return {
      label: "Unavailable",
      toneClassName: "border-slate-200 bg-slate-100 text-slate-600",
      iconClassName: "",
      Icon: TextCursorInput,
    };
  }
  if (input.imageEnabled) {
    return {
      label: input.screenshotSupported ? "Attachments ready" : "Images ready",
      toneClassName: "border-teal-200 bg-teal-50 text-teal-800",
      iconClassName: "",
      Icon: ImagePlus,
    };
  }
  return {
    label: "Text draft",
    toneClassName: "border-slate-200 bg-slate-50 text-slate-700",
    iconClassName: "",
    Icon: TextCursorInput,
  };
};

export const ComposerStatusBar = ({
  disabled,
  submitting,
  imageEnabled,
  screenshotSupported,
}: ComposerStatusBarProps) => {
  const helpItems = COMPOSER_HELP_ITEMS.filter((item) => imageEnabled || item.label !== "Paste");
  const meta = statusMeta({ disabled, submitting, imageEnabled, screenshotSupported });
  const StatusIcon = meta.Icon;
  const helpContext = useMemo(
    () => helpItems.map((item) => `${item.label}:${item.value}`).join(" | "),
    [helpItems],
  );

  return (
    <div
      className="min-w-0 border-t border-slate-100 px-1.5 py-1 md:px-2"
      data-testid="composer-status-bar"
      data-composer-row="status"
    >
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
        <Tooltip content="Composer-local state only. Session state stays in the route body.">
          <div
            className={cn(
              "inline-flex h-5.5 min-w-0 items-center gap-1 rounded-full border px-2 text-[10px] leading-none font-medium",
              meta.toneClassName,
            )}
            aria-label={meta.label}
            title={meta.label}
            data-testid="composer-local-status"
          >
            <StatusIcon className={cn("h-3 w-3 shrink-0", meta.iconClassName)} />
            <span className="truncate">{meta.label}</span>
          </div>
        </Tooltip>

        <HelpHint
          ariaLabel="Composer help"
          textContext={`composer-help:${helpContext}`}
          content={
            <div className="space-y-1.5">
              <p className="text-[11px] font-medium text-slate-700">Composer help</p>
              <div className="grid gap-1.5">
                {helpItems.map((item) => (
                  <ShortcutHint key={`${item.label}-${item.value}`} label={item.label} value={item.value} />
                ))}
              </div>
            </div>
          }
          className="h-6 w-6 text-[11px]"
          side="top"
          align="end"
        />
      </div>
    </div>
  );
};
