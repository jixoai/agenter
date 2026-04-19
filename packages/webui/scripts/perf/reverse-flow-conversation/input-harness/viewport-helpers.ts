const waitForFrame = (): Promise<void> => {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      resolve();
    });
  });
};

export const waitForAnimationFrames = async (count = 2): Promise<void> => {
  for (let index = 0; index < count; index += 1) {
    await waitForFrame();
  }
};

const getBottomAnchoredScrollExtent = (viewport: HTMLElement): number =>
  Math.max(0, viewport.scrollHeight - viewport.clientHeight);

const getBottomAnchoredDistanceToLatest = (viewport: HTMLElement): number => {
  const extent = getBottomAnchoredScrollExtent(viewport);
  return Math.min(extent, Math.max(0, -viewport.scrollTop));
};

const getBottomAnchoredStartScrollTop = (viewport: HTMLElement): number =>
  -getBottomAnchoredScrollExtent(viewport);

const usesReverseFlow = (viewport: HTMLElement): boolean => {
  return getComputedStyle(viewport).flexDirection === "column-reverse";
};

export const resolveHistoryStartScrollTop = (viewport: HTMLElement): number => {
  return usesReverseFlow(viewport) ? getBottomAnchoredStartScrollTop(viewport) : 0;
};

export const scrollViewportToHistoryStart = async (viewport: HTMLElement): Promise<void> => {
  const targetTop = resolveHistoryStartScrollTop(viewport);
  for (let attempt = 0; attempt < 6; attempt += 1) {
    viewport.scrollTop = targetTop;
    viewport.dispatchEvent(new Event("scroll"));
    await waitForAnimationFrames();
  }
};

export const isViewportAwayFromLatest = (viewport: HTMLElement, threshold = 48): boolean => {
  return usesReverseFlow(viewport)
    ? getBottomAnchoredDistanceToLatest(viewport) > threshold
    : Math.abs(viewport.scrollTop - Math.max(0, viewport.scrollHeight - viewport.clientHeight)) > threshold;
};
