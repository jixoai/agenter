import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
  type MouseEvent,
  type ReactNode,
} from "react";

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

const VIEWPORT_PADDING = 8;
const HIDDEN_POSITION = -10_000;

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max);
const isPointInsideElement = (element: HTMLElement, clientX: number, clientY: number): boolean => {
  const rect = element.getBoundingClientRect();
  return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
};

const hasPopoverApi = (element: HTMLElement): element is HTMLElement & { showPopover: () => void; hidePopover: () => void } =>
  typeof (element as HTMLElement & { showPopover?: unknown }).showPopover === "function" &&
  typeof (element as HTMLElement & { hidePopover?: unknown }).hidePopover === "function";

const isPopoverOpen = (element: HTMLElement): boolean => {
  try {
    return element.matches(":popover-open");
  } catch {
    return false;
  }
};

const resolveAlignedOffset = ({
  align,
  anchorStart,
  anchorSize,
  popupSize,
}: {
  align: HelpHintAlign;
  anchorStart: number;
  anchorSize: number;
  popupSize: number;
}): number => {
  if (align === "start") {
    return anchorStart;
  }
  if (align === "end") {
    return anchorStart + anchorSize - popupSize;
  }
  return anchorStart + (anchorSize - popupSize) / 2;
};

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
  const [hasUserIntent, setHasUserIntent] = useState(false);
  const [popupStyle, setPopupStyle] = useState<CSSProperties>({
    left: HIDDEN_POSITION,
    top: HIDDEN_POSITION,
  });
  const identity = useMemo(() => ({ helpId, textContext }), [helpId, textContext]);
  const popupId = useId();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popupRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const manualOpenRef = useRef(false);

  const dismissPersistentHint = useCallback(() => {
    manualOpenRef.current = false;
    setDismissed(true);
    setOpen(false);
    setHasUserIntent(false);
    void dismissHelpHint(identity);
  }, [identity]);

  const cancelScheduledPositioning = useCallback(() => {
    if (frameRef.current === null) {
      return;
    }
    window.cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
  }, []);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    const popup = popupRef.current;
    if (!trigger || !popup || !open) {
      return;
    }

    const triggerRect = trigger.getBoundingClientRect();
    const popupRect = popup.getBoundingClientRect();
    const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
    const viewportHeight = window.visualViewport?.height ?? window.innerHeight;

    let top = 0;
    let left = 0;

    if (side === "top" || side === "bottom") {
      top =
        side === "top" ? triggerRect.top - popupRect.height - sideOffset : triggerRect.bottom + sideOffset;
      left = resolveAlignedOffset({
        align,
        anchorStart: triggerRect.left,
        anchorSize: triggerRect.width,
        popupSize: popupRect.width,
      });
    } else {
      left =
        side === "left" ? triggerRect.left - popupRect.width - sideOffset : triggerRect.right + sideOffset;
      top = resolveAlignedOffset({
        align,
        anchorStart: triggerRect.top,
        anchorSize: triggerRect.height,
        popupSize: popupRect.height,
      });
    }

    const maxLeft = Math.max(VIEWPORT_PADDING, viewportWidth - popupRect.width - VIEWPORT_PADDING);
    const maxTop = Math.max(VIEWPORT_PADDING, viewportHeight - popupRect.height - VIEWPORT_PADDING);

    setPopupStyle({
      left: clamp(left, VIEWPORT_PADDING, maxLeft),
      top: clamp(top, VIEWPORT_PADDING, maxTop),
    });
  }, [align, open, side, sideOffset]);

  const schedulePositioning = useCallback(() => {
    cancelScheduledPositioning();
    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null;
      updatePosition();
    });
  }, [cancelScheduledPositioning, updatePosition]);

  useEffect(() => {
    let canceled = false;
    manualOpenRef.current = false;
    if (disabled) {
      setDismissed(true);
      setOpen(false);
      setHasUserIntent(false);
      setPopupStyle({ left: HIDDEN_POSITION, top: HIDDEN_POSITION });
      return;
    }
    setDismissed(null);
    setOpen(false);
    setHasUserIntent(false);
    void readHelpHintDismissed(identity).then((value) => {
      if (canceled) {
        return;
      }
      setDismissed(value);
      setOpen(!value);
      setHasUserIntent(false);
    });
    return () => {
      canceled = true;
    };
  }, [disabled, identity]);

  useEffect(
    () => () => {
      cancelScheduledPositioning();
    },
    [cancelScheduledPositioning],
  );

  useEffect(() => {
    const popup = popupRef.current;
    if (!popup) {
      return;
    }

    if (open) {
      popup.hidden = false;
      if (hasPopoverApi(popup) && !isPopoverOpen(popup)) {
        popup.showPopover();
      }
      schedulePositioning();
      return;
    }

    cancelScheduledPositioning();
    if (hasPopoverApi(popup) && isPopoverOpen(popup)) {
      popup.hidePopover();
    }
    popup.hidden = true;
    setPopupStyle({ left: HIDDEN_POSITION, top: HIDDEN_POSITION });
  }, [cancelScheduledPositioning, open, schedulePositioning]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleViewportChange = () => {
      schedulePositioning();
    };
    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(() => {
            schedulePositioning();
          });

    const trigger = triggerRef.current;
    const popup = popupRef.current;
    if (trigger && resizeObserver) {
      resizeObserver.observe(trigger);
    }
    if (popup && resizeObserver) {
      resizeObserver.observe(popup);
    }

    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);
    window.visualViewport?.addEventListener("resize", handleViewportChange);
    window.visualViewport?.addEventListener("scroll", handleViewportChange);
    schedulePositioning();

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
      window.visualViewport?.removeEventListener("resize", handleViewportChange);
      window.visualViewport?.removeEventListener("scroll", handleViewportChange);
    };
  }, [open, schedulePositioning]);

  useEffect(() => {
    if (!open || dismissed === false) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      if (triggerRef.current?.contains(target) || popupRef.current?.contains(target)) {
        return;
      }
      manualOpenRef.current = false;
      setOpen(false);
      setHasUserIntent(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }
      manualOpenRef.current = false;
      setOpen(false);
      setHasUserIntent(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [dismissed, open]);

  useEffect(() => {
    if (!open || dismissed !== false) {
      return;
    }

    const handlePointerDownCapture = (event: PointerEvent) => {
      const trigger = triggerRef.current;
      const popup = popupRef.current;
      if (!trigger || !popup) {
        return;
      }
      const target = event.target;
      if (target instanceof Node && trigger.contains(target)) {
        return;
      }
      if (!isPointInsideElement(popup, event.clientX, event.clientY)) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      dismissPersistentHint();
    };

    document.addEventListener("pointerdown", handlePointerDownCapture, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDownCapture, true);
    };
  }, [dismissPersistentHint, dismissed, open]);

  if (disabled) {
    return null;
  }

  const presentationMode: HelpHintPresentationMode = !open
    ? "closed"
    : dismissed === false && !hasUserIntent
      ? "passive-auto"
      : "active-open";

  const markUserIntent = () => {
    if (!open || dismissed !== false) {
      return;
    }
    setHasUserIntent(true);
  };

  const openTransientHint = () => {
    if (dismissed === false || manualOpenRef.current) {
      markUserIntent();
      return;
    }
    setOpen(true);
    setHasUserIntent(true);
  };

  const closeTransientHint = () => {
    if (dismissed === false || manualOpenRef.current) {
      return;
    }
    setOpen(false);
    setHasUserIntent(false);
  };

  const handleTriggerBlur = (event: FocusEvent<HTMLButtonElement>) => {
    if (manualOpenRef.current || dismissed === false) {
      return;
    }
    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Node && popupRef.current?.contains(nextTarget)) {
      return;
    }
    closeTransientHint();
  };

  const handleTriggerClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (dismissed === false) {
      dismissPersistentHint();
      return;
    }
    const nextOpen = !manualOpenRef.current;
    manualOpenRef.current = nextOpen;
    setOpen(nextOpen);
    setHasUserIntent(nextOpen);
  };

  const handlePopupClick = (event: MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
    if (dismissed !== false) {
      return;
    }
    dismissPersistentHint();
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={ariaLabel}
        title={ariaLabel}
        aria-controls={popupId}
        aria-describedby={open ? popupId : undefined}
        aria-expanded={open}
        data-testid={testId}
        data-help-hint-presentation={presentationMode}
        data-popup-open={open ? "" : undefined}
        onClick={handleTriggerClick}
        onFocus={openTransientHint}
        onBlur={handleTriggerBlur}
        onMouseEnter={openTransientHint}
        onMouseLeave={closeTransientHint}
        className={cn(
          "help-hint-trigger inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-200 bg-white text-[11px] leading-none font-semibold text-slate-600 shadow-xs transition hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-teal-200 focus-visible:ring-offset-1 focus-visible:outline-none",
          "data-[popup-open]:border-teal-300 data-[popup-open]:bg-teal-50 data-[popup-open]:text-teal-700 data-[popup-open]:shadow-sm",
          className,
        )}
      >
        ?
      </button>
      <div
        ref={popupRef}
        id={popupId}
        popover="manual"
        role="tooltip"
        hidden={!open}
        aria-hidden={!open}
        data-help-hint-presentation={presentationMode}
        className={cn(
          "help-hint-popup fixed z-[60] max-w-[30rem] rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] leading-5 text-slate-700 shadow-sm outline-none",
          presentationMode === "active-open" ? "pointer-events-auto" : "pointer-events-none",
          "data-[ending-style]:animate-out data-[starting-style]:animate-in",
        )}
        onClick={handlePopupClick}
        style={popupStyle}
      >
        {content}
      </div>
    </>
  );
};
