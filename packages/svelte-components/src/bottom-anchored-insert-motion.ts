export type BottomAnchoredInsertMotion = "latest" | "older";
export interface BottomAnchoredInsertMotionBatchEntry {
  element: HTMLElement;
  motion: BottomAnchoredInsertMotion;
}
interface BottomAnchoredInsertMotionControllerOptions {
  onPrepare?: (entries: readonly BottomAnchoredInsertMotionBatchEntry[]) => void;
  onBeforePlay?: (entries: readonly BottomAnchoredInsertMotionBatchEntry[]) => void;
}

const INSERT_MOTION_ATTRIBUTE = "data-insert-motion";
const INSERT_MOTION_KEY_ATTRIBUTE = "data-insert-motion-key";
const INSERT_MOTION_SELECTOR = `[${INSERT_MOTION_ATTRIBUTE}]`;
export const BOTTOM_ANCHORED_INSERT_MOTION_OFFSET_PX = 18;
export const BOTTOM_ANCHORED_INSERT_MOTION_DURATION_MS = 1_600;
export const BOTTOM_ANCHORED_INSERT_MOTION_CLEAR_DELAY_MS = 2_200;
export const BOTTOM_ANCHORED_INSERT_MOTION_EASING = "cubic-bezier(0.22, 1, 0.36, 1)";

const resolveInsertMotion = (value: string | undefined): BottomAnchoredInsertMotion | null => {
  if (value === "latest" || value === "older") {
    return value;
  }
  return null;
};

const buildInsertMotionKeyframes = (motion: BottomAnchoredInsertMotion): Keyframe[] => {
  const initialTranslateY =
    motion === "latest" ? BOTTOM_ANCHORED_INSERT_MOTION_OFFSET_PX : -BOTTOM_ANCHORED_INSERT_MOTION_OFFSET_PX;
  return [
    {
      opacity: 0,
      transform: `translate3d(0, ${initialTranslateY}px, 0)`,
    },
    {
      opacity: 1,
      transform: "translate3d(0, 0, 0)",
    },
  ];
};

export const createBottomAnchoredInsertMotionController = (
  root: HTMLElement,
  options: BottomAnchoredInsertMotionControllerOptions = {},
): { disconnect: () => void } => {
  const targetWindow = root.ownerDocument?.defaultView;
  const ObserverCtor = targetWindow?.MutationObserver;
  const prefersReducedMotion = targetWindow?.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
  const activeAnimations = new WeakMap<HTMLElement, Animation>();
  const pendingAnimations = new Map<
    HTMLElement,
    {
      motion: BottomAnchoredInsertMotion;
      playToken: number;
      beforePlayNotified: boolean;
    }
  >();
  const lastObservedState = new WeakMap<HTMLElement, string>();
  const observedMotionByKey = new Map<string, BottomAnchoredInsertMotion>();
  const pendingElementByKey = new Map<string, HTMLElement>();
  let flushAnimationFrame = 0;
  let flushBeforePlayMicrotaskQueued = false;
  let nextPlayToken = 1;

  const resolveInsertMotionKey = (element: HTMLElement): string | null => {
    const candidate = element.getAttribute(INSERT_MOTION_KEY_ATTRIBUTE)?.trim() ?? "";
    return candidate.length > 0 ? candidate : null;
  };

  const clearPendingKeyOwner = (element: HTMLElement): void => {
    const logicalKey = resolveInsertMotionKey(element);
    if (!logicalKey) {
      return;
    }
    if (Object.is(pendingElementByKey.get(logicalKey), element)) {
      pendingElementByKey.delete(logicalKey);
    }
  };

  const cancelFlushAnimationFrame = (): void => {
    if (flushAnimationFrame === 0) {
      return;
    }
    targetWindow?.cancelAnimationFrame?.(flushAnimationFrame);
    flushAnimationFrame = 0;
  };

  const cancelActiveAnimation = (element: HTMLElement): void => {
    const animation = activeAnimations.get(element);
    if (!animation) {
      element.style.removeProperty("will-change");
      return;
    }
    activeAnimations.delete(element);
    animation.onfinish = null;
    animation.oncancel = null;
    animation.cancel();
    element.style.removeProperty("will-change");
  };

  const clearAnimation = (element: HTMLElement): void => {
    pendingAnimations.delete(element);
    clearPendingKeyOwner(element);
    cancelActiveAnimation(element);
  };

  const startInsertMotion = (
    element: HTMLElement,
    motion: BottomAnchoredInsertMotion,
    playToken: number,
  ): void => {
    if (prefersReducedMotion || typeof element.animate !== "function") {
      element.style.removeProperty("will-change");
      return;
    }
    cancelActiveAnimation(element);
    if (!element.isConnected || lastObservedState.get(element) !== `${motion}:${playToken}`) {
      element.style.removeProperty("will-change");
      return;
    }
    const logicalKey = resolveInsertMotionKey(element);
    if (logicalKey) {
      observedMotionByKey.set(logicalKey, motion);
    }
    element.style.willChange = "transform, opacity";
    const animation = element.animate(buildInsertMotionKeyframes(motion), {
      duration: BOTTOM_ANCHORED_INSERT_MOTION_DURATION_MS,
      easing: BOTTOM_ANCHORED_INSERT_MOTION_EASING,
      fill: "both",
    });
    animation.play();
    const cleanup = (): void => {
      if (!Object.is(activeAnimations.get(element), animation)) {
        return;
      }
      activeAnimations.delete(element);
      animation.onfinish = null;
      animation.oncancel = null;
      element.style.removeProperty("will-change");
      if (lastObservedState.get(element) === `${motion}:${playToken}`) {
        lastObservedState.set(element, motion);
      }
    };
    animation.onfinish = cleanup;
    animation.oncancel = () => {
      if (!Object.is(activeAnimations.get(element), animation)) {
        return;
      }
      activeAnimations.delete(element);
      animation.onfinish = null;
      animation.oncancel = null;
      element.style.removeProperty("will-change");
    };
    activeAnimations.set(element, animation);
  };

  const flushPendingPrepare = (): void => {
    flushBeforePlayMicrotaskQueued = false;
    if (pendingAnimations.size === 0) {
      return;
    }
    const batch: BottomAnchoredInsertMotionBatchEntry[] = [];
    for (const [element, pendingAnimation] of pendingAnimations) {
      if (pendingAnimation.beforePlayNotified) {
        continue;
      }
      if (!element.isConnected || lastObservedState.get(element) !== `${pendingAnimation.motion}:${pendingAnimation.playToken}`) {
        element.style.removeProperty("will-change");
        pendingAnimations.delete(element);
        clearPendingKeyOwner(element);
        continue;
      }
      pendingAnimation.beforePlayNotified = true;
      batch.push({
        element,
        motion: pendingAnimation.motion,
      });
    }
    if (batch.length === 0) {
      return;
    }
    options.onPrepare?.(batch);
  };

  const flushPendingAnimations = (): void => {
    flushAnimationFrame = 0;
    if (pendingAnimations.size === 0) {
      return;
    }
    const batch: Array<BottomAnchoredInsertMotionBatchEntry & { playToken: number }> = [];
    for (const [element, pendingAnimation] of pendingAnimations) {
      pendingAnimations.delete(element);
      clearPendingKeyOwner(element);
      if (!element.isConnected || lastObservedState.get(element) !== `${pendingAnimation.motion}:${pendingAnimation.playToken}`) {
        element.style.removeProperty("will-change");
        continue;
      }
      batch.push({
        element,
        motion: pendingAnimation.motion,
        playToken: pendingAnimation.playToken,
      });
    }
    if (batch.length === 0) {
      return;
    }
    options.onBeforePlay?.(batch.map(({ element, motion }) => ({ element, motion })));
    for (const { element, motion, playToken } of batch) {
      startInsertMotion(element, motion, playToken);
    }
  };

  const scheduleInsertMotion = (element: HTMLElement, motion: BottomAnchoredInsertMotion): void => {
    const logicalKey = resolveInsertMotionKey(element);
    if (logicalKey) {
      const existingPendingElement = pendingElementByKey.get(logicalKey);
      if (existingPendingElement && !Object.is(existingPendingElement, element)) {
        pendingAnimations.delete(existingPendingElement);
        clearPendingKeyOwner(existingPendingElement);
      }
      pendingElementByKey.set(logicalKey, element);
    }
    const playToken = nextPlayToken;
    nextPlayToken += 1;
    lastObservedState.set(element, `${motion}:${playToken}`);
    pendingAnimations.set(element, { motion, playToken, beforePlayNotified: false });
    if (!flushBeforePlayMicrotaskQueued) {
      flushBeforePlayMicrotaskQueued = true;
      queueMicrotask(() => {
        flushPendingPrepare();
      });
    }
    if (flushAnimationFrame !== 0) {
      return;
    }
    if (targetWindow?.requestAnimationFrame) {
      flushAnimationFrame = targetWindow.requestAnimationFrame(() => {
        flushPendingAnimations();
      });
      return;
    }
    flushPendingAnimations();
  };

  const syncElement = (element: HTMLElement): void => {
    const motion = resolveInsertMotion(element.dataset.insertMotion);
    const nextState = motion ?? "none";
    const previousState = lastObservedState.get(element);
    const logicalKey = resolveInsertMotionKey(element);
    if (previousState === nextState || previousState?.startsWith(`${nextState}:`)) {
      return;
    }
    if (!motion) {
      lastObservedState.set(element, nextState);
      clearAnimation(element);
      return;
    }
    if (logicalKey && observedMotionByKey.get(logicalKey) === motion) {
      lastObservedState.set(element, motion);
      return;
    }
    scheduleInsertMotion(element, motion);
  };

  const syncNode = (node: Node): void => {
    if (!(node instanceof HTMLElement)) {
      return;
    }
    if (node.matches(INSERT_MOTION_SELECTOR)) {
      syncElement(node);
    }
    for (const element of node.querySelectorAll<HTMLElement>(INSERT_MOTION_SELECTOR)) {
      syncElement(element);
    }
  };

  const cleanupNode = (node: Node): void => {
    if (!(node instanceof HTMLElement)) {
      return;
    }
    if (node.matches(INSERT_MOTION_SELECTOR)) {
      clearAnimation(node);
    }
    for (const element of node.querySelectorAll<HTMLElement>(INSERT_MOTION_SELECTOR)) {
      clearAnimation(element);
    }
  };

  syncNode(root);

  if (!ObserverCtor) {
    return {
      disconnect: () => {
        cancelFlushAnimationFrame();
        flushBeforePlayMicrotaskQueued = false;
        cleanupNode(root);
      },
    };
  }

  const observer = new ObserverCtor((records) => {
    for (const record of records) {
      if (record.type === "attributes" && record.target instanceof HTMLElement) {
        syncElement(record.target);
        continue;
      }
      for (const node of record.addedNodes) {
        syncNode(node);
      }
      for (const node of record.removedNodes) {
        cleanupNode(node);
      }
    }
  });

  observer.observe(root, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: [INSERT_MOTION_ATTRIBUTE],
  });

  return {
    disconnect: () => {
      observer.disconnect();
      cancelFlushAnimationFrame();
      flushBeforePlayMicrotaskQueued = false;
      cleanupNode(root);
    },
  };
};
