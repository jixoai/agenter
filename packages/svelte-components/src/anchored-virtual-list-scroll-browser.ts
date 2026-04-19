import { getBottomAnchoredStartScrollTop } from "./bottom-anchored-scroll";
import type { BottomAnchoredTimelineHandle } from "./bottom-anchored-timeline.types";
import type {
  AnchoredVirtualListEdgeState,
  AnchoredVirtualListHostAdapter,
  AnchoredVirtualListResolvedElementTarget,
  AnchoredVirtualListResolvedPositionTarget,
  AnchoredVirtualListResolvedRequest,
  AnchoredVirtualListResolvedTarget,
  AnchoredVirtualListScrollPlan,
  AnchoredVirtualListScrollStateSnapshot,
} from "./anchored-virtual-list-scroll.types";

/**
 * 底层等待一帧。
 */
export const waitForAnchoredVirtualListAnimationFrame = async (
  signal?: AbortSignal,
): Promise<void> => {
  if (signal?.aborted) {
    throw signal.reason;
  }
  await new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason);
      return;
    }
    requestAnimationFrame(() => {
      if (signal?.aborted) {
        reject(signal.reason);
        return;
      }
      resolve();
    });
  });
};

const readViewportSignature = (viewport: HTMLDivElement): string =>
  `${viewport.scrollTop}:${viewport.scrollLeft}:${viewport.scrollHeight}:${viewport.clientHeight}`;

/**
 * 等待视觉滚动结束。
 * 优先用 `scrollend`，否则回退到“多帧稳定”策略。
 */
export const waitForAnchoredVirtualListScrollEnd = async (
  viewport: HTMLDivElement | null,
  signal: AbortSignal,
): Promise<void> => {
  if (!viewport) {
    return;
  }
  if (signal.aborted) {
    throw signal.reason;
  }
  const waitForStableFrames = async (frameSignal: AbortSignal): Promise<void> => {
    let lastSignature = readViewportSignature(viewport);
    let stableFrames = 0;
    for (let index = 0; index < 12; index += 1) {
      await waitForAnchoredVirtualListAnimationFrame(frameSignal);
      const nextSignature = readViewportSignature(viewport);
      if (nextSignature === lastSignature) {
        stableFrames += 1;
        if (stableFrames >= 2) {
          return;
        }
        continue;
      }
      lastSignature = nextSignature;
      stableFrames = 0;
    }
  };
  if (!("onscrollend" in viewport)) {
    await waitForStableFrames(signal);
    return;
  }
  const fallbackController = new AbortController();
  const forwardAbort = (): void => {
    fallbackController.abort(signal.reason);
  };
  signal.addEventListener("abort", forwardAbort, { once: true });
  try {
    await Promise.race([
      new Promise<void>((resolve, reject) => {
        const handleAbort = (): void => {
          cleanup();
          reject(signal.reason);
        };
        const handleScrollEnd = (): void => {
          cleanup();
          fallbackController.abort("scrollend");
          resolve();
        };
        const cleanup = (): void => {
          viewport.removeEventListener("scrollend", handleScrollEnd);
          signal.removeEventListener("abort", handleAbort);
        };
        viewport.addEventListener("scrollend", handleScrollEnd, { once: true });
        signal.addEventListener("abort", handleAbort, { once: true });
      }),
      waitForStableFrames(fallbackController.signal).catch((error: unknown) => {
        if (fallbackController.signal.aborted && fallbackController.signal.reason === "scrollend") {
          return;
        }
        throw error;
      }),
    ]);
  } finally {
    signal.removeEventListener("abort", forwardAbort);
  }
};

/**
 * 等待 DOM / resize / virtualizer 进一步稳定。
 */
export const waitForAnchoredVirtualListDomSettle = async (
  viewport: HTMLDivElement | null,
  signal: AbortSignal,
): Promise<void> => {
  if (!viewport) {
    return;
  }
  let lastSignature = readViewportSignature(viewport);
  let stableFrames = 0;
  for (let index = 0; index < 16; index += 1) {
    await waitForAnchoredVirtualListAnimationFrame(signal);
    const nextSignature = readViewportSignature(viewport);
    if (nextSignature === lastSignature) {
      stableFrames += 1;
      if (stableFrames >= 3) {
        return;
      }
      continue;
    }
    lastSignature = nextSignature;
    stableFrames = 0;
  }
};

/**
 * 判断元素是否已经满足 reveal-if-needed 语义。
 */
export const isAnchoredVirtualListElementVisibleWithinViewport = (
  viewport: HTMLDivElement,
  element: Element,
): boolean => {
  const viewportRect = viewport.getBoundingClientRect();
  const elementRect = element.getBoundingClientRect();
  return (
    elementRect.top >= viewportRect.top &&
    elementRect.bottom <= viewportRect.bottom &&
    elementRect.left >= viewportRect.left &&
    elementRect.right <= viewportRect.right
  );
};

/**
 * 执行 element plan。
 */
export const executeAnchoredVirtualListElementPlan = (
  viewport: HTMLDivElement,
  plan: Extract<AnchoredVirtualListScrollPlan, { kind: "element" }>,
): boolean => {
  if (plan.scrollMode === "if-needed" && isAnchoredVirtualListElementVisibleWithinViewport(viewport, plan.element)) {
    return false;
  }
  plan.element.scrollIntoView({
    behavior: plan.behavior,
    block: plan.block,
    inline: plan.inline,
  });
  return true;
};

/**
 * 构造底部锚定时间线的 host adapter。
 * 这让新的语义协调器可以先复用旧渲染内核。
 */
export const createBottomAnchoredTimelineHostAdapter = (input: {
  getViewport: () => HTMLDivElement | null;
  getContentRoot: () => HTMLElement | null;
  getTimelineHandle: () => BottomAnchoredTimelineHandle | null;
  getEdgeState: () => AnchoredVirtualListEdgeState;
  resolveTarget?: (
    request: AnchoredVirtualListResolvedRequest,
    snapshot: AnchoredVirtualListScrollStateSnapshot,
  ) => AnchoredVirtualListResolvedTarget | null | Promise<AnchoredVirtualListResolvedTarget | null>;
}): AnchoredVirtualListHostAdapter => ({
  getViewport: input.getViewport,
  getContentRoot: input.getContentRoot,
  getEdgeState: input.getEdgeState,
  readPosition() {
    const viewport = input.getViewport();
    return {
      top: viewport?.scrollTop ?? 0,
      left: viewport?.scrollLeft ?? 0,
    };
  },
  resolveEdgePosition(edge) {
    const viewport = input.getViewport();
    if (!viewport) {
      return { top: null, left: null };
    }
    if (edge === "latest") {
      return { top: 0, left: viewport.scrollLeft };
    }
    return {
      top: getBottomAnchoredStartScrollTop(viewport),
      left: viewport.scrollLeft,
    };
  },
  async resolveTarget(request, snapshot) {
    const customTarget = await input.resolveTarget?.(request, snapshot);
    if (customTarget) {
      return customTarget;
    }
    switch (request.target.kind) {
      case "edge":
        return request.target;
      case "position":
        return {
          kind: "position",
          top: request.target.top ?? 0,
          left: request.target.left ?? 0,
          reason: "requested",
        } satisfies AnchoredVirtualListResolvedPositionTarget;
      case "element": {
        if (request.target.element) {
          return {
            ...request.target,
            element: request.target.element,
          } satisfies AnchoredVirtualListResolvedElementTarget;
        }
        if (!request.target.selector) {
          return null;
        }
        const contentRoot = input.getContentRoot();
        const element = contentRoot?.querySelector(request.target.selector) ?? null;
        if (!element) {
          return null;
        }
        return {
          ...request.target,
          element,
        } satisfies AnchoredVirtualListResolvedElementTarget;
      }
    }
  },
  scrollToEdge(edge, behavior) {
    const timelineHandle = input.getTimelineHandle();
    if (timelineHandle) {
      timelineHandle.driver.scrollToEdge(edge, behavior);
      return;
    }
    const viewport = input.getViewport();
    if (!viewport) {
      return;
    }
    const top = edge === "latest" ? 0 : getBottomAnchoredStartScrollTop(viewport);
    viewport.scrollTo({
      top,
      left: viewport.scrollLeft,
      behavior,
    });
  },
  scrollToPosition(position, behavior) {
    const timelineHandle = input.getTimelineHandle();
    if (timelineHandle) {
      timelineHandle.driver.scrollToPosition(
        position.top,
        position.left,
        behavior,
        position.top === 0 ? "latest" : null,
      );
      return;
    }
    const viewport = input.getViewport();
    viewport?.scrollTo({
      top: position.top,
      left: position.left,
      behavior,
    });
  },
});
