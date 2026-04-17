export interface BottomAnchoredScrollViewport {
  clientHeight: number;
  scrollHeight: number;
  scrollTop: number;
}

export const getBottomAnchoredScrollExtent = (viewport: BottomAnchoredScrollViewport): number =>
  Math.max(0, viewport.scrollHeight - viewport.clientHeight);

export const getBottomAnchoredVirtualOffset = (viewport: BottomAnchoredScrollViewport): number => {
  const extent = getBottomAnchoredScrollExtent(viewport);
  return Math.min(extent, Math.max(0, -viewport.scrollTop));
};

export const getBottomAnchoredDistanceToLatest = (viewport: BottomAnchoredScrollViewport): number =>
  getBottomAnchoredVirtualOffset(viewport);

export const getBottomAnchoredDistanceToStart = (viewport: BottomAnchoredScrollViewport): number =>
  Math.max(0, getBottomAnchoredScrollExtent(viewport) - getBottomAnchoredVirtualOffset(viewport));

export const getBottomAnchoredLatestScrollTop = (): number => 0;

export const getBottomAnchoredStartScrollTop = (viewport: BottomAnchoredScrollViewport): number =>
  -getBottomAnchoredScrollExtent(viewport);

export const getBottomAnchoredScrollTopFromVirtualOffset = (offset: number): number =>
  -Math.max(0, offset);
