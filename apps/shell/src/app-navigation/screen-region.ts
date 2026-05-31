export interface ScreenRegion {
  readonly row: number;
  readonly col: number;
  readonly width: number;
  readonly rowCount: number;
}

export interface ScreenPoint {
  readonly row: number;
  readonly col: number;
}

export interface RenderableCoordinateLike {
  readonly top: unknown;
  readonly left: unknown;
}

export interface ScreenRegionMapper {
  regionForChild(
    child: RenderableCoordinateLike,
    input: { readonly width: number; readonly rowCount?: number },
  ): ScreenRegion;
}

const coordinate = (value: unknown): number => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.trunc(numeric) : 0;
};

export const createScreenRegionMapper = (input: {
  readonly parent: RenderableCoordinateLike;
  readonly contentInset?: { readonly row?: number; readonly col?: number };
}): ScreenRegionMapper => {
  const rowInset = Math.trunc(input.contentInset?.row ?? 0);
  const colInset = Math.trunc(input.contentInset?.col ?? 0);
  return {
    regionForChild: (child, regionInput) => ({
      row: coordinate(input.parent.top) + rowInset + coordinate(child.top),
      col: coordinate(input.parent.left) + colInset + coordinate(child.left),
      width: Math.max(0, Math.trunc(regionInput.width)),
      rowCount: Math.max(0, Math.trunc(regionInput.rowCount ?? 1)),
    }),
  };
};

// OpenTUI mouse events are screen coordinates; children inside bordered boxes
// render one cell inward from their parent-local top/left coordinates.
export const createBorderedContentRegionMapper = (parent: RenderableCoordinateLike): ScreenRegionMapper =>
  createScreenRegionMapper({
    parent,
    contentInset: { row: 1, col: 1 },
  });

export const screenRegionContains = (region: ScreenRegion, point: ScreenPoint): boolean =>
  point.row >= region.row &&
  point.row < region.row + region.rowCount &&
  point.col >= region.col &&
  point.col < region.col + region.width;
