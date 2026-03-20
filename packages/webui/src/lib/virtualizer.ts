import type { Virtualizer } from "@tanstack/react-virtual";

const PASSIVE_SCROLL_OPTIONS = { passive: true } as const;

const supportsScrollend = typeof window === "undefined" ? true : "onscrollend" in window;

export const observeElementOffsetWithCleanup = <T extends Element>(
  instance: Virtualizer<T, Element>,
  callback: (offset: number, isScrolling: boolean) => void,
) => {
  const element = instance.scrollElement;
  if (!element) {
    return;
  }

  const targetWindow = element.ownerDocument.defaultView;
  if (!targetWindow) {
    return;
  }

  let offset = 0;
  let timeoutId: number | null = null;

  const clearPendingReset = () => {
    if (timeoutId === null) {
      return;
    }
    targetWindow.clearTimeout(timeoutId);
    timeoutId = null;
  };

  const emitSettled = () => {
    timeoutId = null;
    callback(offset, false);
  };

  const scheduleSettled = () => {
    clearPendingReset();
    timeoutId = targetWindow.setTimeout(emitSettled, instance.options.isScrollingResetDelay);
  };

  const readOffset = () => {
    if (instance.options.horizontal) {
      const scrollLeft = element.scrollLeft;
      return scrollLeft * ((instance.options.isRtl && -1) || 1);
    }
    return element.scrollTop;
  };

  const handleScroll = () => {
    offset = readOffset();
    scheduleSettled();
    callback(offset, true);
  };

  const handleScrollEnd = () => {
    offset = readOffset();
    clearPendingReset();
    callback(offset, false);
  };

  element.addEventListener("scroll", handleScroll, PASSIVE_SCROLL_OPTIONS);

  const registerScrollend = instance.options.useScrollendEvent && supportsScrollend;
  if (registerScrollend) {
    element.addEventListener("scrollend", handleScrollEnd, PASSIVE_SCROLL_OPTIONS);
  }

  return () => {
    clearPendingReset();
    element.removeEventListener("scroll", handleScroll);
    if (registerScrollend) {
      element.removeEventListener("scrollend", handleScrollEnd);
    }
  };
};
