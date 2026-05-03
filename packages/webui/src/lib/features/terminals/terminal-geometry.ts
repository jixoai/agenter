interface TerminalScreenMetricsInput {
	cols: number;
	rows: number;
	screenWidth?: number;
	screenHeight?: number;
}

interface TerminalScreenMetrics {
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

type TerminalWindowViewportMode = 'fit' | 'cover';

interface TerminalWindowProjectionInput {
	mode: TerminalWindowViewportMode;
	frameWidth: number;
	frameHeight: number;
	contentWidth?: number;
	contentHeight?: number;
	availableWidth: number;
	availableHeight: number;
	headerHeight: number;
}

interface TerminalWindowProjection {
	scale: number;
	bodyWidth: number;
	bodyHeight: number;
	shellWidth: number;
	shellHeight: number;
	anchor: 'center' | 'start';
}

interface TerminalGridFromFrameInput {
	frameWidth: number;
	frameHeight: number;
	cellWidth: number;
	cellHeight: number;
	framePaddingX: number;
	framePaddingY: number;
	minCols?: number;
	minRows?: number;
	maxCols?: number;
	maxRows?: number;
}

interface TerminalGridSize {
	cols: number;
	rows: number;
}

const FALLBACK_CELL_WIDTH = 8.2;
const FALLBACK_CELL_HEIGHT = 16;
const VIEWPORT_GUTTER_CELL_RATIO = 0.5;

const toPositive = (value: number | undefined): number | null =>
	typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;

const clampCellCount = (value: number): number => Math.max(1, Math.floor(value));

const clampCellCountRange = (value: number, min: number, max: number): number =>
	Math.max(min, Math.min(max, Math.round(value)));

const resolveMeasuredCell = (screen: number | null, cells: number, fallback: number): number =>
	screen !== null ? screen / cells : fallback;

const resolveFramePadding = (cellSize: number): number =>
	Math.max(1, Math.ceil(cellSize * VIEWPORT_GUTTER_CELL_RATIO));

const resolvePositiveOr = (value: number, fallback: number): number =>
	Number.isFinite(value) && value > 0 ? value : fallback;

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

export const resolveTerminalWindowProjection = (
	input: TerminalWindowProjectionInput,
): TerminalWindowProjection => {
	// Projection only changes the outer window shell. The terminal grid itself remains
	// authoritative until an explicit resize path derives new cols/rows.
	const frameWidth = Math.max(1, Math.round(input.frameWidth));
	const frameHeight = Math.max(1, Math.round(input.frameHeight));
	const contentWidth = Math.max(1, Math.round(input.contentWidth ?? frameWidth));
	const contentHeight = Math.max(1, Math.round(input.contentHeight ?? frameHeight));
	const headerHeight = Math.max(0, Math.round(input.headerHeight));
	const availableWidth = resolvePositiveOr(input.availableWidth, contentWidth);
	const availableBodyHeight = Math.max(1, resolvePositiveOr(input.availableHeight, headerHeight + contentHeight) - headerHeight);
	const widthRatio = availableWidth / contentWidth;
	const heightRatio = availableBodyHeight / contentHeight;
	const fitRatio = Math.min(widthRatio, heightRatio);
	const rawScale = input.mode === 'cover' ? 1 : Math.min(1, fitRatio);
	const scale = Number.isFinite(rawScale) && rawScale > 0 ? rawScale : 1;
	const bodyWidth = Math.max(1, Math.round(contentWidth * scale));
	const bodyHeight = Math.max(1, Math.round(contentHeight * scale));

	return {
		scale,
		bodyWidth,
		bodyHeight,
		shellWidth: bodyWidth,
		shellHeight: headerHeight + bodyHeight,
		anchor: input.mode === 'cover' ? 'start' : 'center',
	};
};

export const resolveTerminalGridFromFrame = (input: TerminalGridFromFrameInput): TerminalGridSize => {
	// Gesture resize converts dragged frame pixels back into discrete terminal geometry.
	// Arbitrary drag pixels are preview state only; durable truth is always cols x rows.
	const minCols = clampCellCount(input.minCols ?? 8);
	const minRows = clampCellCount(input.minRows ?? 4);
	const maxCols = Math.max(minCols, clampCellCount(input.maxCols ?? 300));
	const maxRows = Math.max(minRows, clampCellCount(input.maxRows ?? 120));
	const cellWidth = resolvePositiveOr(input.cellWidth, FALLBACK_CELL_WIDTH);
	const cellHeight = resolvePositiveOr(input.cellHeight, FALLBACK_CELL_HEIGHT);
	const frameWidth = resolvePositiveOr(input.frameWidth, minCols * cellWidth + input.framePaddingX * 2);
	const frameHeight = resolvePositiveOr(input.frameHeight, minRows * cellHeight + input.framePaddingY * 2);
	const contentWidth = Math.max(cellWidth, frameWidth - Math.max(0, input.framePaddingX) * 2);
	const contentHeight = Math.max(cellHeight, frameHeight - Math.max(0, input.framePaddingY) * 2);

	return {
		cols: clampCellCountRange(contentWidth / cellWidth, minCols, maxCols),
		rows: clampCellCountRange(contentHeight / cellHeight, minRows, maxRows),
	};
};

export type {
	TerminalGridFromFrameInput,
	TerminalGridSize,
	TerminalScreenMetrics,
	TerminalWindowProjection,
	TerminalWindowProjectionInput,
	TerminalWindowViewportMode,
};
