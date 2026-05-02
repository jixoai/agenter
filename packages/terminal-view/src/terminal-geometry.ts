export interface TerminalScreenMetricsInput {
  cols: number;
  rows: number;
  screenWidth?: number;
  screenHeight?: number;
}

export interface TerminalScreenMetrics {
  cols: number;
  rows: number;
  cellWidth: number;
  cellHeight: number;
  screenWidth: number;
  screenHeight: number;
  framePaddingX: number;
  framePaddingY: number;
  frameWidth: number;
  frameHeight: number;
}

const FALLBACK_CELL_WIDTH = 8.2;
const FALLBACK_CELL_HEIGHT = 16;

/**
 * Keep projection gutter below one full cell so terminal framing can avoid
 * edge clipping without drifting into obvious blank bands.
 */
const VIEWPORT_GUTTER_CELL_RATIO = 0.5;

const toPositive = (value: number | undefined): number | null =>
  typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;

const clampCellCount = (value: number): number => Math.max(1, Math.floor(value));

const resolveMeasuredCell = (screen: number | null, cells: number, fallback: number): number =>
  screen !== null ? screen / cells : fallback;

const resolveFramePadding = (cellSize: number): number => Math.max(1, Math.ceil(cellSize * VIEWPORT_GUTTER_CELL_RATIO));

export const resolveTerminalScreenMetrics = (input: TerminalScreenMetricsInput): TerminalScreenMetrics => {
  const cols = clampCellCount(input.cols);
  const rows = clampCellCount(input.rows);
  const measuredScreenWidth = toPositive(input.screenWidth);
  const measuredScreenHeight = toPositive(input.screenHeight);
  const cellWidth = resolveMeasuredCell(measuredScreenWidth, cols, FALLBACK_CELL_WIDTH);
  const cellHeight = resolveMeasuredCell(measuredScreenHeight, rows, FALLBACK_CELL_HEIGHT);
  const screenWidth = measuredScreenWidth ?? Math.round(cols * cellWidth);
  const screenHeight = measuredScreenHeight ?? Math.round(rows * cellHeight);
  const framePaddingX = resolveFramePadding(cellWidth);
  const framePaddingY = resolveFramePadding(cellHeight);

  return {
    cols,
    rows,
    cellWidth,
    cellHeight,
    screenWidth,
    screenHeight,
    framePaddingX,
    framePaddingY,
    frameWidth: screenWidth + framePaddingX * 2,
    frameHeight: screenHeight + framePaddingY * 2,
  };
};
