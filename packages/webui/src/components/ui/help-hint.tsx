import { Tooltip as TooltipPrimitive, type TooltipRootChangeEventDetails } from "@base-ui-components/react/tooltip";
import { useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from "react";

import { cn } from "../../lib/utils";
import { dismissHelpHint, readHelpHintDismissed } from "./help-hint-store";

type HelpHintSide = "top" | "right" | "bottom" | "left";
type HelpHintAlign = "start" | "center" | "end";
type HelpHintPresentationMode = "closed" | "passive-auto" | "active-open";

interface HelpHintProps {
  textContext: string;
  content: ReactNode;
  helpId?: string;
  ariaLabel?: string;
  className?: string;
  side?: HelpHintSide;
  align?: HelpHintAlign;
  sideOffset?: number;
  disabled?: boolean;
  testId?: string;
}

export const HelpHint = ({
  textContext,
  content,
  helpId,
  ariaLabel = "Help",
  className,
  side = "top",
  align = "center",
  sideOffset = 8,
  disabled = false,
  testId,
}: HelpHintProps) => {
  const [dismissed, setDismissed] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);
  const [presentationMode, setPresentationMode] = useState<HelpHintPresentationMode>("closed");
  const skipNextOpenChangeRef = useRef(false);
  const suppressOpenUntilRef = useRef(0);
  const identity = useMemo(() => ({ helpId, textContext }), [helpId, textContext]);

  useEffect(() => {
    let canceled = false;
    if (disabled) {
      setDismissed(true);
      setOpen(false);
      setPresentationMode("closed");
      return;
    }
    setDismissed(null);
    setOpen(false);
    setPresentationMode("closed");
    void readHelpHintDismissed(identity).then((value) => {
      if (canceled) {
        return;
      }
      setDismissed(value);
      const nextOpen = !value;
      setOpen(nextOpen);
      setPresentationMode(nextOpen ? "passive-auto" : "closed");
    });
    return () => {
      canceled = true;
    };
  }, [disabled, identity]);

  if (disabled) {
    return null;
  }

  const promoteToActiveOpen = () => {
    if (!open || presentationMode === "active-open") {
      return;
    }
    setPresentationMode("active-open");
  };

  const handleOpenChange = (next: boolean, eventDetails: TooltipRootChangeEventDetails) => {
    if (next && Date.now() < suppressOpenUntilRef.current) {
      return;
    }
    if (skipNextOpenChangeRef.current) {
      skipNextOpenChangeRef.current = false;
      return;
    }
    if (dismissed === false) {
      setOpen(true);
      if (next && eventDetails.reason !== "none") {
        setPresentationMode(
          eventDetails.reason === "trigger-hover" ||
            eventDetails.reason === "trigger-focus" ||
            eventDetails.reason === "trigger-press"
            ? "active-open"
            : "passive-auto",
        );
      }
      return;
    }
    setOpen(next);
    setPresentationMode(next ? "active-open" : "closed");
  };

  const handleTriggerClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (dismissed === false) {
      skipNextOpenChangeRef.current = true;
      // On touch devices tooltip libraries may emit a follow-up open event after trigger click.
      // Keep a short suppression window so "dismiss on click" stays deterministic.
      suppressOpenUntilRef.current = Date.now() + 480;
      setDismissed(true);
      setOpen(false);
      setPresentationMode("closed");
      void dismissHelpHint(identity);
      return;
    }
    skipNextOpenChangeRef.current = true;
    const nextOpen = !open;
    setOpen(nextOpen);
    setPresentationMode(nextOpen ? "active-open" : "closed");
  };

  return (
    <TooltipPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <TooltipPrimitive.Trigger
        delay={250}
        render={
          <button
            type="button"
            aria-label={ariaLabel}
            title={ariaLabel}
            data-testid={testId}
            data-help-hint-presentation={presentationMode}
            onClick={handleTriggerClick}
            onFocus={promoteToActiveOpen}
            onMouseEnter={promoteToActiveOpen}
            className={cn(
              "help-hint-trigger inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-200 bg-white text-[11px] leading-none font-semibold text-slate-600 shadow-xs transition hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-teal-200 focus-visible:ring-offset-1 focus-visible:outline-none",
              "data-[popup-open]:border-teal-300 data-[popup-open]:bg-teal-50 data-[popup-open]:text-teal-700 data-[popup-open]:shadow-sm",
              className,
            )}
          >
            ?
          </button>
        }
      />
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Positioner side={side} align={align} sideOffset={sideOffset}>
          <TooltipPrimitive.Popup
            data-help-hint-presentation={presentationMode}
            onFocusCapture={promoteToActiveOpen}
            onMouseEnter={promoteToActiveOpen}
            className={cn(
              "help-hint-popup z-50 max-w-[30rem] rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] leading-5 text-slate-700 shadow-sm",
              "data-[ending-style]:animate-out data-[starting-style]:animate-in",
            )}
          >
            {content}
          </TooltipPrimitive.Popup>
        </TooltipPrimitive.Positioner>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
};
