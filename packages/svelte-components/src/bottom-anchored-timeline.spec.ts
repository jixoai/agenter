// @vitest-environment jsdom

import { flushSync, mount, unmount } from "svelte";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import {
  BOTTOM_ANCHORED_INSERT_MOTION_DURATION_MS,
  BOTTOM_ANCHORED_INSERT_MOTION_EASING,
  BOTTOM_ANCHORED_INSERT_MOTION_OFFSET_PX,
} from "./bottom-anchored-insert-motion";
import TimelineHarness from "./bottom-anchored-timeline.test-harness.svelte";

const parseBottomRootMargin = (value?: string): number => {
  if (!value) {
    return 0;
  }
  const parts = value.split(/\s+/u).filter((part) => part.length > 0);
  const candidate = parts[2] ?? parts[0] ?? "0";
  const parsed = Number.parseFloat(candidate);
  return Number.isFinite(parsed) ? parsed : 0;
};

const isLatestSentinel = (target: Element): target is HTMLElement =>
  target instanceof HTMLElement && target.dataset.bottomAnchoredTimelineLatestSentinel === "true";

class IntersectionObserverMock {
  private readonly observed = new Set<Element>();
  private readonly rootScrollHandler = (): void => {
    for (const target of this.observed) {
      this.emit(target);
    }
  };

  constructor(
    private readonly callback: IntersectionObserverCallback,
    private readonly options: IntersectionObserverInit = {},
  ) {
    if (this.options.root instanceof HTMLElement) {
      this.options.root.addEventListener("scroll", this.rootScrollHandler);
    }
  }

  observe(target: Element): void {
    this.observed.add(target);
    queueMicrotask(() => {
      this.emit(target);
    });
  }

  disconnect(): void {
    if (this.options.root instanceof HTMLElement) {
      this.options.root.removeEventListener("scroll", this.rootScrollHandler);
    }
    this.observed.clear();
  }

  unobserve(target?: Element): void {
    if (target) {
      this.observed.delete(target);
    }
  }

  private emit(target: Element): void {
    const visible = this.resolveVisibility(target);
    this.callback(
      [
        {
          target,
          isIntersecting: visible,
          intersectionRatio: visible ? 1 : 0,
        } as IntersectionObserverEntry,
      ],
      this as unknown as IntersectionObserver,
    );
  }

  private resolveVisibility(target: Element): boolean {
    if (!isLatestSentinel(target)) {
      return true;
    }
    if (!(this.options.root instanceof HTMLElement)) {
      return true;
    }
    const threshold = parseBottomRootMargin(this.options.rootMargin);
    return Math.max(0, -this.options.root.scrollTop) <= threshold;
  }
}

const installViewportMetrics = (): void => {
  Object.defineProperty(HTMLElement.prototype, "clientHeight", {
    configurable: true,
    get() {
      return Number(this.dataset.clientHeight ?? "0");
    },
  });
  Object.defineProperty(HTMLElement.prototype, "scrollHeight", {
    configurable: true,
    get() {
      return Number(this.dataset.scrollHeight ?? "0");
    },
  });
  Object.defineProperty(HTMLElement.prototype, "scrollTop", {
    configurable: true,
    get() {
      return Number(this.dataset.scrollTop ?? "0");
    },
    set(value: number) {
      this.dataset.scrollTop = String(value);
    },
  });
  Object.defineProperty(HTMLElement.prototype, "scrollTo", {
    configurable: true,
    value(topOrOptions: ScrollToOptions | number, y?: number) {
      const top =
        typeof topOrOptions === "number"
          ? (typeof y === "number" ? y : 0)
          : (topOrOptions.top ?? 0);
      this.scrollTop = top;
      this.dispatchEvent(new Event("scroll"));
    },
  });
}

const settle = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise<void>((resolve) => {
    const raf = globalThis.requestAnimationFrame;
    if (typeof raf === "function") {
      raf(() => {
        resolve();
      });
      return;
    }
    setTimeout(() => {
      resolve();
    }, 0);
  });
  flushSync();
};

const installAnimateMock = (
  onAnimate?: (frames: Keyframe[] | PropertyIndexedKeyframes, options?: number | KeyframeAnimationOptions) => void,
): void => {
  Object.defineProperty(HTMLElement.prototype, "animate", {
    configurable: true,
    value: vi.fn((frames: Keyframe[] | PropertyIndexedKeyframes, options?: number | KeyframeAnimationOptions) => {
      onAnimate?.(frames, options);
      return {
        cancel() {},
        play() {},
        onfinish: null,
        oncancel: null,
      } as Animation;
    }),
  });
};

const mountHarness = (
  withIntersectionObserver = true,
  options: {
    motionByValue?: Record<string, "latest" | "older">;
  } = {},
) => {
  if (withIntersectionObserver) {
    vi.stubGlobal("IntersectionObserver", IntersectionObserverMock);
  } else {
    vi.stubGlobal("IntersectionObserver", undefined);
  }

  const target = document.createElement("div");
  document.body.append(target);

  const component = mount(TimelineHarness, {
    target,
    props: {
      items: ["older", "middle", "latest"],
      latestThreshold: 48,
      motionByValue: options.motionByValue ?? {},
    },
  });
  flushSync();

  const viewport = target.querySelector("[data-testid='timeline-viewport']");
  const state = target.querySelector("[data-testid='timeline-state']");
  const towardStartButton = target.querySelector("[data-testid='scroll-toward-start']");
  const toLatestButton = target.querySelector("[data-testid='scroll-to-latest']");
  const toLatestSmoothButton = target.querySelector("[data-testid='scroll-to-latest-smooth']");

  if (
    !(viewport instanceof HTMLDivElement) ||
    !(state instanceof HTMLDivElement) ||
    !(towardStartButton instanceof HTMLButtonElement) ||
    !(toLatestButton instanceof HTMLButtonElement) ||
    !(toLatestSmoothButton instanceof HTMLButtonElement)
  ) {
    throw new Error("Failed to mount bottom-anchored timeline harness.");
  }

  viewport.dataset.clientHeight = "240";
  viewport.dataset.scrollHeight = "720";
  viewport.dataset.scrollTop = "0";

  return { component, target, viewport, state, towardStartButton, toLatestButton, toLatestSmoothButton };
};

describe("Feature: bottom-anchored timeline", () => {
  beforeEach(() => {
    installViewportMetrics();
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.unstubAllGlobals();
  });

  test("Scenario: Given IntersectionObserver is available When the viewport moves away from latest Then atLatest follows the internal latest sentinel", async () => {
    const { component, viewport, state } = mountHarness(true);

    await settle();
    expect(state.dataset.atLatest).toBe("true");

    viewport.scrollTop = -96;
    viewport.dispatchEvent(new Event("scroll"));

    await settle();
    expect(state.dataset.atLatest).toBe("false");

    unmount(component);
  });

  test("Scenario: Given IntersectionObserver is unavailable When the viewport moves away from latest Then atLatest falls back to distance math", async () => {
    const { component, viewport, state } = mountHarness(false);

    await settle();
    expect(state.dataset.atLatest).toBe("true");

    viewport.scrollTop = -96;
    viewport.dispatchEvent(new Event("scroll"));
    flushSync();

    expect(state.dataset.atLatest).toBe("false");

    unmount(component);
  });

  test("Scenario: Given the reverse-flow viewport is at latest When scrollTowardStart runs Then it moves toward visual top and scrollToLatest returns to zero", async () => {
    const { component, viewport, towardStartButton, toLatestButton } = mountHarness(true);

    await settle();
    expect(viewport.scrollTop).toBe(0);

    towardStartButton.click();
    flushSync();

    expect(viewport.scrollTop).toBe(-96);

    toLatestButton.click();
    flushSync();

    expect(viewport.scrollTop).toBe(0);

    unmount(component);
  });

  test("Scenario: Given smooth scroll is requested When scrollToLatest runs Then the timeline delegates to native scrollTo", async () => {
    const scrollToSpy = vi.spyOn(HTMLElement.prototype, "scrollTo");
    const { component, viewport, towardStartButton, toLatestSmoothButton } = mountHarness(true);

    await settle();
    towardStartButton.click();
    flushSync();

    expect(viewport.scrollTop).toBe(-96);

    toLatestSmoothButton.click();
    flushSync();

    expect(scrollToSpy).toHaveBeenCalledWith({
      top: 0,
      behavior: "smooth",
    });
    expect(viewport.scrollTop).toBe(0);

    unmount(component);
  });

  test("Scenario: Given rows are marked with insert motion When the timeline renders them Then it uses Web Animations API with direction-specific keyframes", async () => {
    const animationCalls: Array<{
      frames: Keyframe[] | PropertyIndexedKeyframes;
      options?: number | KeyframeAnimationOptions;
    }> = [];
    installAnimateMock((frames, options) => {
      animationCalls.push({ frames, options });
    });

    const { component } = mountHarness(true, {
      motionByValue: {
        latest: "latest",
        older: "older",
      },
    });

    await settle();

    expect(animationCalls).toHaveLength(2);
    expect(animationCalls[0]?.frames).toEqual([
      { opacity: 0, transform: `translate3d(0, ${BOTTOM_ANCHORED_INSERT_MOTION_OFFSET_PX}px, 0)` },
      { opacity: 1, transform: "translate3d(0, 0, 0)" },
    ]);
    expect(animationCalls[1]?.frames).toEqual([
      { opacity: 0, transform: `translate3d(0, ${-BOTTOM_ANCHORED_INSERT_MOTION_OFFSET_PX}px, 0)` },
      { opacity: 1, transform: "translate3d(0, 0, 0)" },
    ]);
    expect(animationCalls[0]?.options).toMatchObject({
      duration: BOTTOM_ANCHORED_INSERT_MOTION_DURATION_MS,
      easing: BOTTOM_ANCHORED_INSERT_MOTION_EASING,
      fill: "both",
    });
    expect(animationCalls[1]?.options).toMatchObject({
      duration: BOTTOM_ANCHORED_INSERT_MOTION_DURATION_MS,
      easing: BOTTOM_ANCHORED_INSERT_MOTION_EASING,
      fill: "both",
    });

    unmount(component);
  });
});
