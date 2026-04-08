import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { parseArgs } from 'node:util';

import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import sharp from 'sharp';
import { optimize } from 'svgo';

import { compareSvg } from '../next/scripts/compare-svg';

interface RawImage {
	data: Buffer;
	info: {
		channels: number;
		height: number;
		width: number;
	};
}

interface Score {
	grid: GridSummary;
	mae: number;
	maeSimilarity: number;
	pixelDifferencePixels: number;
	pixelSimilarity: number;
}

interface GridCellScore {
	col: number;
	height: number;
	mae: number;
	maeSimilarity: number;
	row: number;
	width: number;
	x: number;
	y: number;
}

interface GridSummary {
	avgMaeSimilarity: number;
	cols: number;
	minMaeSimilarity: number;
	rows: number;
	worstCells: GridCellScore[];
	worstQuartileMaeSimilarity: number;
}

interface Rgb {
	b: number;
	g: number;
	r: number;
}

interface Hsl {
	h: number;
	l: number;
	s: number;
}

interface GradientStop {
	color: string;
	offset: string;
}

interface GradientLine {
	x1: number;
	x2: number;
	y1: number;
	y2: number;
}

type DiscreteFamilyName = 'capsA' | 'capsB' | 'innerA' | 'innerB' | 'outerA' | 'outerB';

interface DiscreteSelection {
	angle: number;
	family: DiscreteFamilyName;
	pairId: string;
}

interface PaletteConfig {
	background: string;
	capsAccentA: GradientStop[];
	capsAccentB: GradientStop[];
	capsLineA: GradientLine;
	capsLineB: GradientLine;
	centerDark: GradientStop[];
	centerLight: GradientStop[];
	discreteSelections?: Partial<Record<DiscreteFamilyName, DiscreteSelection>>;
	innerAccentA: GradientStop[];
	innerAccentB: GradientStop[];
	innerLineA: GradientLine;
	innerLineB: GradientLine;
	name: string;
	outerAccentA: GradientStop[];
	outerAccentB: GradientStop[];
	outerLineA: GradientLine;
	outerLineB: GradientLine;
	shadowAccentA: GradientStop[];
	shadowAccentB: GradientStop[];
	shadowLineA: GradientLine;
	shadowLineB: GradientLine;
}

interface ShadowConfig {
	dx: number;
	dy: number;
	name: string;
	shadowMode: 'all' | 'large' | 'none';
	shadowOpacity: number;
}

interface PaletteResult {
	palette: PaletteConfig;
	score: Score;
}

interface VariantResult {
	palette: PaletteConfig;
	score: Score;
	shadow: ShadowConfig;
	svg: string;
}

interface CliOptions {
	diff: string;
	out: string;
	reference: string;
	rendered: string;
	report: string;
	searchReport: string;
	source: string;
	threshold: number;
}

interface RefineState {
	background: Rgb;
	capsToneA: number;
	capsToneB: number;
	centerDarkTone: number;
	centerLightTone: number;
	innerToneA: number;
	innerToneB: number;
	outerToneA: number;
	outerToneB: number;
	shadowDx: number;
	shadowDy: number;
	shadowMode: ShadowConfig['shadowMode'];
	shadowOpacity: number;
	shadowToneA: number;
	shadowToneB: number;
}

interface DiscreteGradientPair {
	endHex: string;
	id: string;
	startHex: string;
}

interface DiscreteFamilyDescriptor {
	defaultAngle: number;
	family: DiscreteFamilyName;
}

const repoRoot = resolve(import.meta.dirname, '..', '..');
const nextDir = resolve(repoRoot, 'assets', 'next');
const defaultOptions: CliOptions = {
	diff: resolve(nextDir, 'out', 'icon-color-from-bw.diff.png'),
	out: resolve(nextDir, 'svg', 'icon-color-from-bw.svg'),
	reference: resolve(nextDir, 'source', 'icon.png'),
	rendered: resolve(nextDir, 'out', 'icon-color-from-bw.rendered.png'),
	report: resolve(nextDir, 'out', 'icon-color-from-bw.report.json'),
	searchReport: resolve(nextDir, 'out', 'icon-color-from-bw.search.json'),
	source: resolve(nextDir, 'svg', 'icon-bw.svg'),
	threshold: 95,
};
const comparisonGrid = { cols: 4, rows: 4 } as const;
const localRefineRounds = 10;
const discreteGradientSearchRounds = 3;
const toneStep = 0.02;
const backgroundStep = 1;
const canvasCenter = 539;
const gradientRadius = 574;

const ribbonAOuterIds = ['p3', 'p17'] as const;
const ribbonBOuterIds = ['p7', 'p12'] as const;
const ribbonAInnerIds = ['p5', 'p16'] as const;
const ribbonBInnerIds = ['p6', 'p13'] as const;
const ribbonACapsIds = ['p2', 'p4', 'p14', 'p15'] as const;
const ribbonBCapsIds = ['p1', 'p8', 'p11', 'p18', 'p19'] as const;
const topPaletteCount = 3;
const fixedPaletteShadow: ShadowConfig = {
	dx: 0,
	dy: 0,
	name: 'no-shadow',
	shadowMode: 'none',
	shadowOpacity: 0,
};
const discreteGradientAngles = [0, 45, 90, 135, 180, 225, 270, 315] as const;

const defaultLineA: GradientLine = { x1: 132, x2: 944, y1: 944, y2: 132 };
const defaultLineB: GradientLine = { x1: 132, x2: 944, y1: 132, y2: 944 };

const accentGreenHex = '#2fb381';
const accentIndigoHex = '#2bcfe0';
const shadowStartHex = '#216059';
const shadowEndHex = '#17404c';

const colors = {
	accentBright: buildGradientStops(accentGreenHex, accentIndigoHex),
	accentShadow: buildGradientStops(shadowStartHex, shadowEndHex),
	backgrounds: ['#2e333a', '#2d3239', '#30363d'] as const,
	centerDark: [
		{ color: '#20252c', offset: '0%' },
		{ color: '#2c323a', offset: '100%' },
	],
	centerLight: [
		{ color: '#edf0f2', offset: '0%' },
		{ color: '#d7dce1', offset: '100%' },
	],
} as const;

const discreteGradientPairs: DiscreteGradientPair[] = [
	{ endHex: colors.accentBright[2].color, id: 'green-indigo', startHex: colors.accentBright[0].color },
	{ endHex: colors.accentBright[0].color, id: 'green-green', startHex: colors.accentBright[0].color },
	{ endHex: colors.accentBright[2].color, id: 'indigo-indigo', startHex: colors.accentBright[2].color },
	{ endHex: colors.accentBright[0].color, id: 'indigo-green', startHex: colors.accentBright[2].color },
];
const gradientSimplicityTolerance = {
	gridMinMaeSimilarity: 0.04,
	gridWorstQuartileMaeSimilarity: 0.05,
	maeSimilarity: 0.05,
	pixelSimilarity: 0.2,
} as const;
const discreteSearchRegressionTolerance = {
	maeSimilarity: 0.015,
	pixelSimilarity: 0.5,
} as const;

const discreteFamilyDescriptors: readonly DiscreteFamilyDescriptor[] = [
	{ defaultAngle: 315, family: 'outerA' },
	{ defaultAngle: 45, family: 'outerB' },
	{ defaultAngle: 315, family: 'innerA' },
	{ defaultAngle: 45, family: 'innerB' },
	{ defaultAngle: 315, family: 'capsA' },
	{ defaultAngle: 45, family: 'capsB' },
];

const betterThan = (left: Score, right: Score): boolean =>
	left.grid.minMaeSimilarity > right.grid.minMaeSimilarity ||
	(left.grid.minMaeSimilarity === right.grid.minMaeSimilarity &&
		left.grid.worstQuartileMaeSimilarity > right.grid.worstQuartileMaeSimilarity) ||
	(left.grid.minMaeSimilarity === right.grid.minMaeSimilarity &&
		left.grid.worstQuartileMaeSimilarity === right.grid.worstQuartileMaeSimilarity &&
		left.grid.avgMaeSimilarity > right.grid.avgMaeSimilarity) ||
	(left.grid.minMaeSimilarity === right.grid.minMaeSimilarity &&
		left.grid.worstQuartileMaeSimilarity === right.grid.worstQuartileMaeSimilarity &&
		left.grid.avgMaeSimilarity === right.grid.avgMaeSimilarity &&
		left.maeSimilarity > right.maeSimilarity) ||
	(left.grid.minMaeSimilarity === right.grid.minMaeSimilarity &&
		left.grid.worstQuartileMaeSimilarity === right.grid.worstQuartileMaeSimilarity &&
		left.grid.avgMaeSimilarity === right.grid.avgMaeSimilarity &&
		left.maeSimilarity === right.maeSimilarity &&
		left.pixelSimilarity > right.pixelSimilarity);

const parseNumber = (value: string | undefined, fallback: number): number => {
	if (value == null) {
		return fallback;
	}
	const parsed = Number.parseFloat(value);
	if (!Number.isFinite(parsed)) {
		throw new Error(`Invalid numeric value: ${value}`);
	}
	return parsed;
};

const parseCliArgs = (argv: string[]): CliOptions => {
	const parsed = parseArgs({
		args: argv,
		options: {
			diff: { type: 'string' },
			out: { type: 'string' },
			reference: { type: 'string' },
			rendered: { type: 'string' },
			report: { type: 'string' },
			searchReport: { type: 'string' },
			source: { type: 'string' },
			threshold: { type: 'string' },
		},
		strict: true,
	});

	return {
		diff: parsed.values.diff ? resolve(parsed.values.diff) : defaultOptions.diff,
		out: parsed.values.out ? resolve(parsed.values.out) : defaultOptions.out,
		reference: parsed.values.reference ? resolve(parsed.values.reference) : defaultOptions.reference,
		rendered: parsed.values.rendered ? resolve(parsed.values.rendered) : defaultOptions.rendered,
		report: parsed.values.report ? resolve(parsed.values.report) : defaultOptions.report,
		searchReport: parsed.values.searchReport ? resolve(parsed.values.searchReport) : defaultOptions.searchReport,
		source: parsed.values.source ? resolve(parsed.values.source) : defaultOptions.source,
		threshold: parseNumber(parsed.values.threshold, defaultOptions.threshold),
	};
};

function clampByte(value: number): number {
	return Math.max(0, Math.min(255, Math.round(value)));
}

function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value));
}

function hexToRgb(hex: string): Rgb {
	const normalized = hex.replace('#', '');
	if (normalized.length !== 6) {
		throw new Error(`Invalid hex color: ${hex}`);
	}
	return {
		b: Number.parseInt(normalized.slice(4, 6), 16),
		g: Number.parseInt(normalized.slice(2, 4), 16),
		r: Number.parseInt(normalized.slice(0, 2), 16),
	};
}

function rgbToHex(rgb: Rgb): string {
	return `#${[rgb.r, rgb.g, rgb.b].map((channel) => clampByte(channel).toString(16).padStart(2, '0')).join('')}`;
}

function rgbToHsl(rgb: Rgb): Hsl {
	const r = rgb.r / 255;
	const g = rgb.g / 255;
	const b = rgb.b / 255;
	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	const delta = max - min;
	const lightness = (max + min) / 2;

	if (delta === 0) {
		return { h: 0, l: lightness, s: 0 };
	}

	const saturation =
		lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
	let hue = 0;

	switch (max) {
		case r:
			hue = (g - b) / delta + (g < b ? 6 : 0);
			break;
		case g:
			hue = (b - r) / delta + 2;
			break;
		default:
			hue = (r - g) / delta + 4;
			break;
	}

	return { h: hue * 60, l: lightness, s: saturation };
}

function hueToRgb(p: number, q: number, t: number): number {
	let normalized = t;
	if (normalized < 0) {
		normalized += 1;
	}
	if (normalized > 1) {
		normalized -= 1;
	}
	if (normalized < 1 / 6) {
		return p + (q - p) * 6 * normalized;
	}
	if (normalized < 1 / 2) {
		return q;
	}
	if (normalized < 2 / 3) {
		return p + (q - p) * (2 / 3 - normalized) * 6;
	}
	return p;
}

function hslToRgb(hsl: Hsl): Rgb {
	const hue = (((hsl.h % 360) + 360) % 360) / 360;
	if (hsl.s === 0) {
		const gray = clampByte(hsl.l * 255);
		return { b: gray, g: gray, r: gray };
	}

	const q = hsl.l < 0.5 ? hsl.l * (1 + hsl.s) : hsl.l + hsl.s - hsl.l * hsl.s;
	const p = 2 * hsl.l - q;

	return {
		b: clampByte(hueToRgb(p, q, hue - 1 / 3) * 255),
		g: clampByte(hueToRgb(p, q, hue) * 255),
		r: clampByte(hueToRgb(p, q, hue + 1 / 3) * 255),
	};
}

function interpolateHue(left: Hsl, right: Hsl, amount: number): number {
	if (left.s === 0) {
		return right.h;
	}
	if (right.s === 0) {
		return left.h;
	}
	const delta = ((((right.h - left.h) % 360) + 540) % 360) - 180;
	return (((left.h + delta * amount) % 360) + 360) % 360;
}

function mixHex(leftHex: string, rightHex: string, amount: number): string {
	const left = hexToRgb(leftHex);
	const right = hexToRgb(rightHex);
	const leftHsl = rgbToHsl(left);
	const rightHsl = rgbToHsl(right);
	return rgbToHex(
		hslToRgb({
			h: interpolateHue(leftHsl, rightHsl, amount),
			l: leftHsl.l + (rightHsl.l - leftHsl.l) * amount,
			s: leftHsl.s + (rightHsl.s - leftHsl.s) * amount,
		}),
	);
}

function buildGradientStops(startHex: string, endHex: string, middleOffset = '48%'): GradientStop[] {
	if (startHex.toLowerCase() === endHex.toLowerCase()) {
		return [
			{ color: startHex, offset: '0%' },
			{ color: startHex, offset: middleOffset },
			{ color: startHex, offset: '100%' },
		];
	}
	return [
		{ color: startHex, offset: '0%' },
		{ color: mixHex(startHex, endHex, 0.5), offset: middleOffset },
		{ color: endHex, offset: '100%' },
	];
}

const mixGradients = (
	leftStops: ReadonlyArray<GradientStop>,
	rightStops: ReadonlyArray<GradientStop>,
	amount: number,
): GradientStop[] =>
	leftStops.map((stop, index) => ({
		color: mixHex(stop.color, rightStops[index]?.color ?? stop.color, amount),
		offset: stop.offset,
	}));

const tintGradient = (stops: ReadonlyArray<GradientStop>, targetHex: string, amount: number): GradientStop[] =>
	stops.map((stop) => ({
		color: mixHex(stop.color, targetHex, amount),
		offset: stop.offset,
	}));

const cloneLine = (line: GradientLine): GradientLine => ({ ...line });

const lineFromAngle = (angle: number): GradientLine => {
	const radians = (angle * Math.PI) / 180;
	const dx = Math.cos(radians) * gradientRadius;
	const dy = Math.sin(radians) * gradientRadius;
	return {
		x1: Number((canvasCenter - dx).toFixed(3)),
		x2: Number((canvasCenter + dx).toFixed(3)),
		y1: Number((canvasCenter - dy).toFixed(3)),
		y2: Number((canvasCenter + dy).toFixed(3)),
	};
};

const stopsFromDiscretePair = (pair: DiscreteGradientPair): GradientStop[] =>
	buildGradientStops(pair.startHex, pair.endHex);

const normalizeColor = (color: string): string => color.trim().toLowerCase();

const isFlatStops = (stops: ReadonlyArray<GradientStop>): boolean => {
	const anchor = normalizeColor(stops[0]?.color ?? '');
	return stops.every((stop) => normalizeColor(stop.color) === anchor);
};

const accentGradientFamilyCount = (palette: PaletteConfig): number =>
	[
		palette.outerAccentA,
		palette.outerAccentB,
		palette.innerAccentA,
		palette.innerAccentB,
		palette.capsAccentA,
		palette.capsAccentB,
	].reduce((sum, stops) => sum + (isFlatStops(stops) ? 0 : 1), 0);

const scoresCloseEnoughForSimplerPalette = (candidate: Score, current: Score): boolean =>
	Math.abs(candidate.grid.minMaeSimilarity - current.grid.minMaeSimilarity) <=
		gradientSimplicityTolerance.gridMinMaeSimilarity &&
	Math.abs(candidate.grid.worstQuartileMaeSimilarity - current.grid.worstQuartileMaeSimilarity) <=
		gradientSimplicityTolerance.gridWorstQuartileMaeSimilarity &&
	Math.abs(candidate.maeSimilarity - current.maeSimilarity) <= gradientSimplicityTolerance.maeSimilarity &&
	Math.abs(candidate.pixelSimilarity - current.pixelSimilarity) <= gradientSimplicityTolerance.pixelSimilarity;

const avoidsMeaningfulGlobalRegression = (candidate: Score, current: Score): boolean =>
	candidate.maeSimilarity + discreteSearchRegressionTolerance.maeSimilarity >= current.maeSimilarity &&
	candidate.pixelSimilarity + discreteSearchRegressionTolerance.pixelSimilarity >= current.pixelSimilarity;

const colorCandidateBetterThan = (
	candidateScore: Score,
	candidatePalette: PaletteConfig,
	currentScore: Score,
	currentPalette: PaletteConfig,
): boolean =>
	(betterThan(candidateScore, currentScore) && avoidsMeaningfulGlobalRegression(candidateScore, currentScore)) ||
	(scoresCloseEnoughForSimplerPalette(candidateScore, currentScore) &&
		accentGradientFamilyCount(candidatePalette) < accentGradientFamilyCount(currentPalette));

const readRawImage = async (pngPath: string): Promise<RawImage> =>
	(await sharp(pngPath).ensureAlpha().raw().toBuffer({
		resolveWithObject: true,
	})) as RawImage;

const extractPaths = (svg: string): Record<string, string> => {
	const paths: Record<string, string> = {};
	for (const match of svg.matchAll(/<path id="([^"]+)" d="([^"]+)"/g)) {
		const pathId = match[1];
		const d = match[2];
		if (!pathId || !d) {
			continue;
		}
		paths[pathId] = d;
	}
	return paths;
};

const requirePath = (paths: Record<string, string>, pathId: string, sourceLabel: string): string => {
	const d = paths[pathId];
	if (!d) {
		throw new Error(`Missing path ${pathId} in ${sourceLabel}.`);
	}
	return d;
};

const extractCenterPanelD = (frameD: string): string => {
	const match = frameD.match(/Z\s+(M.*)$/);
	if (!match?.[1]) {
		throw new Error('Unable to derive the center panel from p10.');
	}
	return match[1];
};

const createGradient = (
	id: string,
	line: { x1: number; x2: number; y1: number; y2: number },
	stops: ReadonlyArray<GradientStop>,
): string =>
	`<linearGradient id="${id}" x1="${line.x1}" y1="${line.y1}" x2="${line.x2}" y2="${line.y2}" gradientUnits="userSpaceOnUse">${stops
		.map((stop) => `<stop offset="${stop.offset}" stop-color="${stop.color}"/>`)
		.join('')}</linearGradient>`;

const createPaths = (
	pathIds: ReadonlyArray<string>,
	paths: Record<string, string>,
	fill: string,
	sourceLabel: string,
	fillRule?: 'evenodd',
): string =>
	pathIds
		.map((pathId) => {
			const d = requirePath(paths, pathId, sourceLabel);
			const ruleAttr = fillRule ? ` fill-rule="${fillRule}"` : '';
			return `<path d="${d}" fill="${fill}"${ruleAttr}/>`;
		})
		.join('');

const buildVariantSvg = (
	paths: Record<string, string>,
	palette: PaletteConfig,
	shadow: ShadowConfig,
	sourceLabel: string,
): string => {
	const ribbonAIds = [...ribbonAOuterIds, ...ribbonAInnerIds, ...ribbonACapsIds];
	const ribbonBIds = [...ribbonBOuterIds, ...ribbonBInnerIds, ...ribbonBCapsIds];
	const accentAllIds = [...ribbonAIds, ...ribbonBIds];
	const shadowIds =
		shadow.shadowMode === 'all'
			? accentAllIds
			: shadow.shadowMode === 'large'
				? [...ribbonAOuterIds, ...ribbonBOuterIds, ...ribbonAInnerIds, ...ribbonBInnerIds]
				: [];
	const frameD = requirePath(paths, 'p10', sourceLabel);
	const centerPanelD = extractCenterPanelD(frameD);
	const centerTileD = requirePath(paths, 'p9', sourceLabel);

	return `<svg xmlns="http://www.w3.org/2000/svg" width="1078" height="1078" viewBox="0 0 1078 1078"><defs>${createGradient(
		'shadowRibbonA',
		palette.shadowLineA,
		palette.shadowAccentA,
	)}${createGradient('shadowRibbonB', palette.shadowLineB, palette.shadowAccentB)}${createGradient(
		'outerRibbonA',
		palette.outerLineA,
		palette.outerAccentA,
	)}${createGradient('outerRibbonB', palette.outerLineB, palette.outerAccentB)}${createGradient(
		'innerRibbonA',
		palette.innerLineA,
		palette.innerAccentA,
	)}${createGradient('innerRibbonB', palette.innerLineB, palette.innerAccentB)}${createGradient(
		'capsRibbonA',
		palette.capsLineA,
		palette.capsAccentA,
	)}${createGradient('capsRibbonB', palette.capsLineB, palette.capsAccentB)}${createGradient(
		'centerLight',
		{ x1: 358, x2: 720, y1: 358, y2: 720 },
		palette.centerLight,
	)}${createGradient('centerDark', { x1: 404, x2: 672, y1: 404, y2: 672 }, palette.centerDark)}</defs><rect width="1078" height="1078" fill="${palette.background}"/>${
		shadowIds.length > 0
			? `<g transform="translate(${shadow.dx} ${shadow.dy})" opacity="${shadow.shadowOpacity}">${createPaths(
					shadowIds.filter((pathId) => ribbonAIds.includes(pathId as (typeof ribbonAIds)[number])),
					paths,
					'url(#shadowRibbonA)',
					sourceLabel,
				)}${createPaths(
					shadowIds.filter((pathId) => ribbonBIds.includes(pathId as (typeof ribbonBIds)[number])),
					paths,
					'url(#shadowRibbonB)',
					sourceLabel,
				)}</g>`
			: ''
	}<g>${createPaths(ribbonAOuterIds, paths, 'url(#outerRibbonA)', sourceLabel)}${createPaths(
		ribbonBOuterIds,
		paths,
		'url(#outerRibbonB)',
		sourceLabel,
	)}${createPaths(ribbonAInnerIds, paths, 'url(#innerRibbonA)', sourceLabel)}${createPaths(
		ribbonBInnerIds,
		paths,
		'url(#innerRibbonB)',
		sourceLabel,
	)}${createPaths(ribbonACapsIds, paths, 'url(#capsRibbonA)', sourceLabel)}${createPaths(
		ribbonBCapsIds,
		paths,
		'url(#capsRibbonB)',
		sourceLabel,
	)}</g><path d="${frameD}" fill="url(#centerLight)" fill-rule="evenodd"/><path d="${centerPanelD}" fill="url(#centerDark)"/><path d="${centerTileD}" fill="url(#centerLight)"/></svg>`;
};

const summarizeGrid = (options: {
	cellAbsoluteError: Float64Array;
	cellSampleCount: Uint32Array;
	channels: number;
	height: number;
	width: number;
}): GridSummary => {
	const cells: GridCellScore[] = [];
	for (let row = 0; row < comparisonGrid.rows; row += 1) {
		const y = Math.floor((row * options.height) / comparisonGrid.rows);
		const yNext = Math.floor(((row + 1) * options.height) / comparisonGrid.rows);
		for (let col = 0; col < comparisonGrid.cols; col += 1) {
			const x = Math.floor((col * options.width) / comparisonGrid.cols);
			const xNext = Math.floor(((col + 1) * options.width) / comparisonGrid.cols);
			const cellIndex = row * comparisonGrid.cols + col;
			const samples = options.cellSampleCount[cellIndex] ?? 0;
			const mae = samples === 0 ? 255 : options.cellAbsoluteError[cellIndex]! / samples;
			cells.push({
				col,
				height: yNext - y,
				mae,
				maeSimilarity: (1 - mae / 255) * 100,
				row,
				width: xNext - x,
				x,
				y,
			});
		}
	}

	const sortedByWorst = [...cells].sort((left, right) => left.maeSimilarity - right.maeSimilarity);
	const avgMaeSimilarity = cells.reduce((sum, cell) => sum + cell.maeSimilarity, 0) / cells.length;
	const worstQuartileCells = sortedByWorst.slice(0, Math.max(1, Math.floor(cells.length / 4)));
	const worstQuartileMaeSimilarity =
		worstQuartileCells.reduce((sum, cell) => sum + cell.maeSimilarity, 0) / worstQuartileCells.length;

	return {
		avgMaeSimilarity,
		cols: comparisonGrid.cols,
		minMaeSimilarity: sortedByWorst[0]?.maeSimilarity ?? 0,
		rows: comparisonGrid.rows,
		worstCells: sortedByWorst.slice(0, 4),
		worstQuartileMaeSimilarity,
	};
};

const scoreSvg = async (svg: string, referenceRaw: RawImage, referencePng: PNG): Promise<Score> => {
	const renderedPng = await sharp(Buffer.from(svg)).png().toBuffer();
	const renderedRaw = (await sharp(renderedPng).ensureAlpha().raw().toBuffer({
		resolveWithObject: true,
	})) as RawImage;

	if (
		renderedRaw.info.width !== referenceRaw.info.width ||
		renderedRaw.info.height !== referenceRaw.info.height ||
		renderedRaw.info.channels !== referenceRaw.info.channels
	) {
		throw new Error('Rendered SVG dimensions do not match the reference PNG.');
	}

	let absoluteError = 0;
	const totalSamples = referenceRaw.info.width * referenceRaw.info.height * referenceRaw.info.channels;
	const cellAbsoluteError = new Float64Array(comparisonGrid.rows * comparisonGrid.cols);
	const cellSampleCount = new Uint32Array(comparisonGrid.rows * comparisonGrid.cols);

	for (let y = 0; y < referenceRaw.info.height; y += 1) {
		const row = Math.min(comparisonGrid.rows - 1, Math.floor((y * comparisonGrid.rows) / referenceRaw.info.height));
		for (let x = 0; x < referenceRaw.info.width; x += 1) {
			const col = Math.min(comparisonGrid.cols - 1, Math.floor((x * comparisonGrid.cols) / referenceRaw.info.width));
			const cellIndex = row * comparisonGrid.cols + col;
			const pixelOffset = (y * referenceRaw.info.width + x) * referenceRaw.info.channels;

			for (let channel = 0; channel < referenceRaw.info.channels; channel += 1) {
				const difference = Math.abs(referenceRaw.data[pixelOffset + channel]! - renderedRaw.data[pixelOffset + channel]!);
				absoluteError += difference;
				cellAbsoluteError[cellIndex] += difference;
				cellSampleCount[cellIndex] += 1;
			}
		}
	}

	const renderedRaster = PNG.sync.read(renderedPng);
	const diffPng = new PNG({ height: renderedRaster.height, width: renderedRaster.width });
	const pixelDifferencePixels = pixelmatch(
		referencePng.data,
		renderedRaster.data,
		diffPng.data,
		renderedRaster.width,
		renderedRaster.height,
		{ threshold: 0.1 },
	);

	const mae = absoluteError / totalSamples;
	const pixelDifferenceRatio = pixelDifferencePixels / (renderedRaster.width * renderedRaster.height);

	return {
		grid: summarizeGrid({
			cellAbsoluteError,
			cellSampleCount,
			channels: referenceRaw.info.channels,
			height: referenceRaw.info.height,
			width: referenceRaw.info.width,
		}),
		mae,
		maeSimilarity: (1 - mae / 255) * 100,
		pixelDifferencePixels,
		pixelSimilarity: (1 - pixelDifferenceRatio) * 100,
	};
};

const createPaletteVariants = (): PaletteConfig[] => {
	const outerProfiles = [
		{ name: 'base', stops: colors.accentBright as GradientStop[] },
		{ name: 'lift', stops: tintGradient(colors.accentBright, '#ffffff', 0.08) },
		{ name: 'sink', stops: mixGradients(colors.accentBright, colors.accentShadow, 0.16) },
	] as const;
	const innerProfiles = [
		{ name: 'base', stops: colors.accentBright as GradientStop[] },
		{ name: 'lift', stops: tintGradient(colors.accentBright, '#ffffff', 0.12) },
		{ name: 'sink', stops: mixGradients(colors.accentBright, colors.accentShadow, 0.2) },
	] as const;
	const capsProfiles = [
		{ name: 'base', stops: colors.accentBright as GradientStop[] },
		{ name: 'lift', stops: tintGradient(colors.accentBright, '#ffffff', 0.16) },
		{ name: 'sink', stops: mixGradients(colors.accentBright, colors.accentShadow, 0.12) },
	] as const;
	const centerLightProfiles = [
		{ name: 'base', stops: colors.centerLight as GradientStop[] },
		{ name: 'lift', stops: tintGradient(colors.centerLight, '#ffffff', 0.08) },
	] as const;
	const centerDarkProfiles = [
		{ name: 'base', stops: colors.centerDark as GradientStop[] },
		{ name: 'deep', stops: tintGradient(colors.centerDark, '#000000', 0.12) },
	] as const;

	const variants: PaletteConfig[] = [];

	for (const background of colors.backgrounds) {
		for (const outer of outerProfiles) {
			for (const inner of innerProfiles) {
				for (const caps of capsProfiles) {
					for (const centerLight of centerLightProfiles) {
						for (const centerDark of centerDarkProfiles) {
							variants.push({
								background,
								capsAccentA: caps.stops,
								capsAccentB: caps.stops,
								capsLineA: cloneLine(defaultLineA),
								capsLineB: cloneLine(defaultLineB),
								centerDark: centerDark.stops,
								centerLight: centerLight.stops,
								innerAccentA: inner.stops,
								innerAccentB: inner.stops,
								innerLineA: cloneLine(defaultLineA),
								innerLineB: cloneLine(defaultLineB),
								name: `bg-${background.slice(1)}__outer-${outer.name}__inner-${inner.name}__caps-${caps.name}__light-${centerLight.name}__dark-${centerDark.name}`,
								outerAccentA: outer.stops,
								outerAccentB: outer.stops,
								outerLineA: cloneLine(defaultLineA),
								outerLineB: cloneLine(defaultLineB),
								shadowAccentA: colors.accentShadow as GradientStop[],
								shadowAccentB: colors.accentShadow as GradientStop[],
								shadowLineA: cloneLine(defaultLineA),
								shadowLineB: cloneLine(defaultLineB),
							});
						}
					}
				}
			}
		}
	}

	return variants;
};

const createShadowVariants = (): ShadowConfig[] => {
	return [{ dx: 0, dy: 0, name: 'no-shadow', shadowMode: 'none', shadowOpacity: 0 }];
};

const accentToneFromProfile = (profile: string, family: 'caps' | 'inner' | 'outer'): number => {
	switch (`${family}:${profile}`) {
		case 'outer:lift':
			return 0.08;
		case 'outer:sink':
			return -0.16;
		case 'inner:lift':
			return 0.12;
		case 'inner:sink':
			return -0.2;
		case 'caps:lift':
			return 0.16;
		case 'caps:sink':
			return -0.12;
		default:
			return 0;
	}
};

const centerLightToneFromProfile = (profile: string): number => (profile === 'lift' ? 0.08 : 0);

const centerDarkToneFromProfile = (profile: string): number => (profile === 'deep' ? 0.12 : 0);

const parseCoarsePaletteToRefineState = (palette: PaletteConfig, shadow: ShadowConfig): RefineState => {
	const match = palette.name.match(
		/^bg-([0-9a-f]{6})__outer-(base|lift|sink)__inner-(base|lift|sink)__caps-(base|lift|sink)__light-(base|lift)__dark-(base|deep)$/i,
	);
	if (!match) {
		throw new Error(`Unable to parse coarse palette name: ${palette.name}`);
	}

	return {
		background: hexToRgb(`#${match[1]}`),
		capsToneA: accentToneFromProfile(match[4]!, 'caps'),
		capsToneB: accentToneFromProfile(match[4]!, 'caps'),
		centerDarkTone: centerDarkToneFromProfile(match[6]!),
		centerLightTone: centerLightToneFromProfile(match[5]!),
		innerToneA: accentToneFromProfile(match[3]!, 'inner'),
		innerToneB: accentToneFromProfile(match[3]!, 'inner'),
		outerToneA: accentToneFromProfile(match[2]!, 'outer'),
		outerToneB: accentToneFromProfile(match[2]!, 'outer'),
		shadowDx: 0,
		shadowDy: 0,
		shadowMode: 'none',
		shadowOpacity: 0,
		shadowToneA: 0,
		shadowToneB: 0,
	};
};

const applyAccentTone = (tone: number): GradientStop[] => {
	if (tone > 0) {
		return tintGradient(colors.accentBright, '#ffffff', tone);
	}
	if (tone < 0) {
		return mixGradients(colors.accentBright, colors.accentShadow, Math.abs(tone));
	}
	return [...colors.accentBright];
};

const applyShadowTone = (tone: number): GradientStop[] => {
	if (tone > 0) {
		return tintGradient(colors.accentShadow, '#ffffff', tone);
	}
	if (tone < 0) {
		return tintGradient(colors.accentShadow, '#000000', Math.abs(tone));
	}
	return [...colors.accentShadow];
};

const applyCenterLightTone = (tone: number): GradientStop[] => {
	if (tone > 0) {
		return tintGradient(colors.centerLight, '#ffffff', tone);
	}
	if (tone < 0) {
		return tintGradient(colors.centerLight, '#000000', Math.abs(tone));
	}
	return [...colors.centerLight];
};

const applyCenterDarkTone = (tone: number): GradientStop[] => {
	if (tone > 0) {
		return tintGradient(colors.centerDark, '#000000', tone);
	}
	if (tone < 0) {
		return tintGradient(colors.centerDark, '#ffffff', Math.abs(tone));
	}
	return [...colors.centerDark];
};

const refineStateToVariant = (paths: Record<string, string>, state: RefineState, sourceLabel: string) => {
	const palette: PaletteConfig = {
		background: rgbToHex(state.background),
		capsAccentA: applyAccentTone(state.capsToneA),
		capsAccentB: applyAccentTone(state.capsToneB),
		capsLineA: cloneLine(defaultLineA),
		capsLineB: cloneLine(defaultLineB),
		centerDark: applyCenterDarkTone(state.centerDarkTone),
		centerLight: applyCenterLightTone(state.centerLightTone),
		innerAccentA: applyAccentTone(state.innerToneA),
		innerAccentB: applyAccentTone(state.innerToneB),
		innerLineA: cloneLine(defaultLineA),
		innerLineB: cloneLine(defaultLineB),
		name: [
			`bg-${rgbToHex(state.background).slice(1)}`,
			`outerA-${state.outerToneA.toFixed(2)}`,
			`outerB-${state.outerToneB.toFixed(2)}`,
			`innerA-${state.innerToneA.toFixed(2)}`,
			`innerB-${state.innerToneB.toFixed(2)}`,
			`capsA-${state.capsToneA.toFixed(2)}`,
			`capsB-${state.capsToneB.toFixed(2)}`,
			`light-${state.centerLightTone.toFixed(2)}`,
			`dark-${state.centerDarkTone.toFixed(2)}`,
			`shadowA-${state.shadowToneA.toFixed(2)}`,
			`shadowB-${state.shadowToneB.toFixed(2)}`,
		].join('__'),
		outerAccentA: applyAccentTone(state.outerToneA),
		outerAccentB: applyAccentTone(state.outerToneB),
		outerLineA: cloneLine(defaultLineA),
		outerLineB: cloneLine(defaultLineB),
		shadowAccentA: applyShadowTone(state.shadowToneA),
		shadowAccentB: applyShadowTone(state.shadowToneB),
		shadowLineA: cloneLine(defaultLineA),
		shadowLineB: cloneLine(defaultLineB),
	};
	const shadow: ShadowConfig = {
		dx: state.shadowDx,
		dy: state.shadowDy,
		name: `${state.shadowMode}-dx${state.shadowDx}-dy${state.shadowDy}-op${state.shadowOpacity.toFixed(2)}`,
		shadowMode: state.shadowMode,
		shadowOpacity: state.shadowMode === 'none' ? 0 : Number(state.shadowOpacity.toFixed(2)),
	};
	return {
		palette,
		shadow,
		svg: buildVariantSvg(paths, palette, shadow, sourceLabel),
	};
};

const pushNeighbor = (
	neighbors: RefineState[],
	seen: Set<string>,
	candidate: RefineState,
) => {
	const normalized: RefineState = {
		...candidate,
		background: {
			b: clampByte(candidate.background.b),
			g: clampByte(candidate.background.g),
			r: clampByte(candidate.background.r),
		},
		capsToneA: Number(clamp(candidate.capsToneA, -0.24, 0.24).toFixed(2)),
		capsToneB: Number(clamp(candidate.capsToneB, -0.24, 0.24).toFixed(2)),
		centerDarkTone: Number(clamp(candidate.centerDarkTone, -0.08, 0.2).toFixed(2)),
		centerLightTone: Number(clamp(candidate.centerLightTone, -0.08, 0.16).toFixed(2)),
		innerToneA: Number(clamp(candidate.innerToneA, -0.24, 0.24).toFixed(2)),
		innerToneB: Number(clamp(candidate.innerToneB, -0.24, 0.24).toFixed(2)),
		outerToneA: Number(clamp(candidate.outerToneA, -0.24, 0.24).toFixed(2)),
		outerToneB: Number(clamp(candidate.outerToneB, -0.24, 0.24).toFixed(2)),
		shadowDx: clamp(candidate.shadowDx, 0, 4),
		shadowDy: clamp(candidate.shadowDy, 0, 4),
		shadowOpacity: Number(clamp(candidate.shadowOpacity, 0, 0.32).toFixed(2)),
		shadowToneA: Number(clamp(candidate.shadowToneA, -0.16, 0.16).toFixed(2)),
		shadowToneB: Number(clamp(candidate.shadowToneB, -0.16, 0.16).toFixed(2)),
	};
	const key = JSON.stringify(normalized);
	if (seen.has(key)) {
		return;
	}
	seen.add(key);
	neighbors.push(normalized);
};

const enumerateRefineNeighbors = (state: RefineState): RefineState[] => {
	const neighbors: RefineState[] = [];
	const seen = new Set<string>();
	const toneKeys = [
		'outerToneA',
		'outerToneB',
		'innerToneA',
		'innerToneB',
		'capsToneA',
		'capsToneB',
		'centerLightTone',
		'centerDarkTone',
	] as const;

	for (const key of toneKeys) {
		pushNeighbor(neighbors, seen, { ...state, [key]: state[key] + toneStep });
		pushNeighbor(neighbors, seen, { ...state, [key]: state[key] - toneStep });
	}

	for (const key of ['r', 'g', 'b'] as const) {
		pushNeighbor(neighbors, seen, {
			...state,
			background: { ...state.background, [key]: state.background[key] + backgroundStep },
		});
		pushNeighbor(neighbors, seen, {
			...state,
			background: { ...state.background, [key]: state.background[key] - backgroundStep },
		});
	}

	return neighbors;
};

const localRefine = async (options: {
	initial: VariantResult;
	paths: Record<string, string>;
	referencePng: PNG;
	referenceRaw: RawImage;
	sourceLabel: string;
}) => {
	let currentState = parseCoarsePaletteToRefineState(options.initial.palette, options.initial.shadow);
	let currentBest = options.initial;
	const rounds: Array<Record<string, number | string>> = [];

	for (let round = 1; round <= localRefineRounds; round += 1) {
		const neighbors = enumerateRefineNeighbors(currentState);
		let bestRoundCandidate: VariantResult | null = null;
		let bestRoundState: RefineState | null = null;

		console.log(
			`[local-refine] round ${round} start: neighbors=${neighbors.length} maeSimilarity=${currentBest.score.maeSimilarity.toFixed(6)} gridMin=${currentBest.score.grid.minMaeSimilarity.toFixed(6)}`,
		);

		for (let index = 0; index < neighbors.length; index += 1) {
			const neighbor = neighbors[index]!;
			const candidate = refineStateToVariant(options.paths, neighbor, options.sourceLabel);
			const score = await scoreSvg(candidate.svg, options.referenceRaw, options.referencePng);
			const variant: VariantResult = { palette: candidate.palette, score, shadow: candidate.shadow, svg: candidate.svg };

			if (!bestRoundCandidate || betterThan(score, bestRoundCandidate.score)) {
				bestRoundCandidate = variant;
				bestRoundState = neighbor;
			}

			if ((index + 1) % 20 === 0) {
				console.log(`[local-refine] round ${round} progress ${index + 1}/${neighbors.length}`);
			}
		}

		if (!bestRoundCandidate || !bestRoundState || !betterThan(bestRoundCandidate.score, currentBest.score)) {
			rounds.push({
				accepted: false,
				gridMinMaeSimilarity: currentBest.score.grid.minMaeSimilarity,
				gridWorstQuartileMaeSimilarity: currentBest.score.grid.worstQuartileMaeSimilarity,
				maeSimilarity: currentBest.score.maeSimilarity,
				round,
			});
			break;
		}

		currentBest = bestRoundCandidate;
		currentState = bestRoundState;
		rounds.push({
			accepted: true,
			gridMinMaeSimilarity: currentBest.score.grid.minMaeSimilarity,
			gridWorstQuartileMaeSimilarity: currentBest.score.grid.worstQuartileMaeSimilarity,
			maeSimilarity: currentBest.score.maeSimilarity,
			palette: currentBest.palette.name,
			round,
			shadow: currentBest.shadow.name,
		});
		console.log(
			`[local-refine] round ${round} accepted: maeSimilarity=${currentBest.score.maeSimilarity.toFixed(6)} gridMin=${currentBest.score.grid.minMaeSimilarity.toFixed(6)} shadow=${currentBest.shadow.name}`,
		);
	}

	return { result: currentBest, rounds };
};

const stripDiscreteSuffix = (paletteName: string): string => paletteName.split('__disc-')[0] ?? paletteName;

const selectionSignature = (selection: DiscreteSelection): string => `${selection.family}:${selection.pairId}@${selection.angle}`;

const discreteSignatureForPalette = (palette: PaletteConfig): string => {
	const selections = Object.values(palette.discreteSelections ?? {}).filter(
		(selection): selection is DiscreteSelection => selection != null,
	);
	if (selections.length === 0) {
		return 'none';
	}
	return selections
		.sort((left, right) => left.family.localeCompare(right.family))
		.map(selectionSignature)
		.join('|');
};

const applyDiscreteSelectionToPalette = (
	palette: PaletteConfig,
	selection: DiscreteSelection,
): PaletteConfig => {
	const gradientStops = stopsFromDiscretePair(
		discreteGradientPairs.find((pair) => pair.id === selection.pairId) ?? discreteGradientPairs[0]!,
	);
	const line = lineFromAngle(selection.angle);
	const discreteSelections = {
		...(palette.discreteSelections ?? {}),
		[selection.family]: selection,
	};

	switch (selection.family) {
		case 'outerA':
			return { ...palette, discreteSelections, outerAccentA: gradientStops, outerLineA: line };
		case 'outerB':
			return { ...palette, discreteSelections, outerAccentB: gradientStops, outerLineB: line };
		case 'innerA':
			return { ...palette, discreteSelections, innerAccentA: gradientStops, innerLineA: line };
		case 'innerB':
			return { ...palette, discreteSelections, innerAccentB: gradientStops, innerLineB: line };
		case 'capsA':
			return { ...palette, capsAccentA: gradientStops, capsLineA: line, discreteSelections };
		case 'capsB':
			return { ...palette, capsAccentB: gradientStops, capsLineB: line, discreteSelections };
	}
};

const searchDiscreteGradients = async (options: {
	initial: VariantResult;
	paths: Record<string, string>;
	referencePng: PNG;
	referenceRaw: RawImage;
	sourceLabel: string;
}) => {
	let currentBest = options.initial;
	const rounds: Array<Record<string, number | string | boolean>> = [];

	for (let round = 1; round <= discreteGradientSearchRounds; round += 1) {
		let acceptedInRound = false;

		for (const descriptor of discreteFamilyDescriptors) {
			let bestFamilyVariant = currentBest;
			let bestSelection =
				currentBest.palette.discreteSelections?.[descriptor.family] ?? {
					angle: descriptor.defaultAngle,
					family: descriptor.family,
					pairId: 'green-indigo',
				};

			for (const pair of discreteGradientPairs) {
				for (const angle of discreteGradientAngles) {
					const selection: DiscreteSelection = { angle, family: descriptor.family, pairId: pair.id };
					const candidatePalette = applyDiscreteSelectionToPalette(currentBest.palette, selection);
					const candidateSvg = buildVariantSvg(options.paths, candidatePalette, currentBest.shadow, options.sourceLabel);
					const score = await scoreSvg(candidateSvg, options.referenceRaw, options.referencePng);
					if (
						colorCandidateBetterThan(
							score,
							candidatePalette,
							bestFamilyVariant.score,
							bestFamilyVariant.palette,
						)
					) {
						bestFamilyVariant = {
							palette: candidatePalette,
							score,
							shadow: currentBest.shadow,
							svg: candidateSvg,
						};
						bestSelection = selection;
					}
				}
			}

			if (
				bestFamilyVariant !== currentBest &&
				colorCandidateBetterThan(
					bestFamilyVariant.score,
					bestFamilyVariant.palette,
					currentBest.score,
					currentBest.palette,
				)
			) {
				currentBest = {
					...bestFamilyVariant,
					palette: {
						...bestFamilyVariant.palette,
						name: `${stripDiscreteSuffix(bestFamilyVariant.palette.name)}__disc-${discreteSignatureForPalette(bestFamilyVariant.palette)}`,
					},
				};
				acceptedInRound = true;
				rounds.push({
					accepted: true,
					family: descriptor.family,
					gridMinMaeSimilarity: currentBest.score.grid.minMaeSimilarity,
					gridWorstQuartileMaeSimilarity: currentBest.score.grid.worstQuartileMaeSimilarity,
					maeSimilarity: currentBest.score.maeSimilarity,
					pair: bestSelection.pairId,
					angle: bestSelection.angle,
					round,
				});
				console.log(
					`[discrete-gradient] round ${round} accepted ${descriptor.family}: ${bestSelection.pairId}@${bestSelection.angle} maeSimilarity=${currentBest.score.maeSimilarity.toFixed(6)} gridMin=${currentBest.score.grid.minMaeSimilarity.toFixed(6)}`,
				);
			}
		}

		if (!acceptedInRound) {
			rounds.push({
				accepted: false,
				gridMinMaeSimilarity: currentBest.score.grid.minMaeSimilarity,
				gridWorstQuartileMaeSimilarity: currentBest.score.grid.worstQuartileMaeSimilarity,
				maeSimilarity: currentBest.score.maeSimilarity,
				round,
			});
			break;
		}
	}

	return { result: currentBest, rounds };
};

const insertTopPalette = (topPalettes: PaletteResult[], candidate: PaletteResult): PaletteResult[] => {
	const next = [...topPalettes, candidate].sort((left, right) => {
		if (betterThan(left.score, right.score)) {
			return -1;
		}
		if (betterThan(right.score, left.score)) {
			return 1;
		}
		return left.palette.name.localeCompare(right.palette.name);
	});
	return next.slice(0, topPaletteCount);
};

const main = async (): Promise<void> => {
	const cliOptions = parseCliArgs(process.argv.slice(2));
	const sourceBwSvg = await readFile(cliOptions.source, 'utf8');
	const paths = extractPaths(sourceBwSvg);
	const referenceRaw = await readRawImage(cliOptions.reference);
	const referencePng = PNG.sync.read(await readFile(cliOptions.reference));
	const paletteVariants = createPaletteVariants();
	const shadowVariants = createShadowVariants();
	const paletteSummaries: Array<Record<string, number | string>> = [];
	const shadowSummaries: Array<Record<string, number | string>> = [];
	let topPalettes: PaletteResult[] = [];
	let bestOverall: VariantResult | null = null;

	console.log(
		JSON.stringify(
			{
				paletteVariantCount: paletteVariants.length,
				shadowVariantCount: shadowVariants.length,
				stage: 'palette-search',
				shadowSeed: fixedPaletteShadow.name,
			},
			null,
			2,
		),
	);

	for (let index = 0; index < paletteVariants.length; index += 1) {
		const palette = paletteVariants[index]!;
		const candidateSvg = buildVariantSvg(paths, palette, fixedPaletteShadow, cliOptions.source);
		const score = await scoreSvg(candidateSvg, referenceRaw, referencePng);
		paletteSummaries.push({
			gridAvgMaeSimilarity: score.grid.avgMaeSimilarity,
			gridMinMaeSimilarity: score.grid.minMaeSimilarity,
			gridWorstCell: `${score.grid.worstCells[0]?.row ?? 0},${score.grid.worstCells[0]?.col ?? 0}`,
			gridWorstQuartileMaeSimilarity: score.grid.worstQuartileMaeSimilarity,
			maeSimilarity: score.maeSimilarity,
			name: palette.name,
			pixelSimilarity: score.pixelSimilarity,
			shadowSeed: fixedPaletteShadow.name,
		});
		const previousBest = topPalettes[0];
		topPalettes = insertTopPalette(topPalettes, { palette, score });

		if (!previousBest || topPalettes[0]?.palette.name === palette.name) {
			console.log(
				`[palette-search] new best at ${index + 1}/${paletteVariants.length}: ${palette.name} maeSimilarity=${score.maeSimilarity.toFixed(6)} pixelSimilarity=${score.pixelSimilarity.toFixed(6)}`,
			);
		} else if ((index + 1) % 40 === 0) {
			console.log(`[palette-search] progress ${index + 1}/${paletteVariants.length}`);
		}
	}

	if (topPalettes.length === 0) {
		throw new Error('Palette search produced no candidates.');
	}

	console.log(
		JSON.stringify(
			{
				stage: 'shadow-search',
				topPalettes: topPalettes.map((entry) => ({
					maeSimilarity: entry.score.maeSimilarity,
					name: entry.palette.name,
					pixelSimilarity: entry.score.pixelSimilarity,
				})),
			},
			null,
			2,
		),
	);

	for (const paletteEntry of topPalettes) {
		for (let index = 0; index < shadowVariants.length; index += 1) {
			const shadow = shadowVariants[index]!;
			const candidateSvg = buildVariantSvg(paths, paletteEntry.palette, shadow, cliOptions.source);
			const score = await scoreSvg(candidateSvg, referenceRaw, referencePng);
			shadowSummaries.push({
				maeSimilarity: score.maeSimilarity,
				palette: paletteEntry.palette.name,
				gridAvgMaeSimilarity: score.grid.avgMaeSimilarity,
				gridMinMaeSimilarity: score.grid.minMaeSimilarity,
				gridWorstCell: `${score.grid.worstCells[0]?.row ?? 0},${score.grid.worstCells[0]?.col ?? 0}`,
				gridWorstQuartileMaeSimilarity: score.grid.worstQuartileMaeSimilarity,
				pixelSimilarity: score.pixelSimilarity,
				shadow: shadow.name,
			});

			if (!bestOverall || betterThan(score, bestOverall.score)) {
				bestOverall = { palette: paletteEntry.palette, score, shadow, svg: candidateSvg };
				console.log(
					`[shadow-search] new best ${paletteEntry.palette.name} + ${shadow.name}: maeSimilarity=${score.maeSimilarity.toFixed(6)} pixelSimilarity=${score.pixelSimilarity.toFixed(6)}`,
				);
			} else if ((index + 1) % 25 === 0) {
				console.log(
					`[shadow-search] ${paletteEntry.palette.name} progress ${index + 1}/${shadowVariants.length}`,
				);
			}
		}
	}

	if (!bestOverall) {
		throw new Error('Shadow search produced no candidate.');
	}

	const localRefinement = await localRefine({
		initial: bestOverall,
		paths,
		referencePng,
		referenceRaw,
		sourceLabel: cliOptions.source,
	});
	bestOverall = localRefinement.result;
	const discreteGradientSearch = await searchDiscreteGradients({
		initial: bestOverall,
		paths,
		referencePng,
		referenceRaw,
		sourceLabel: cliOptions.source,
	});
	bestOverall = discreteGradientSearch.result;

	const optimizedSvg = optimize(bestOverall.svg, { multipass: true }).data;
	await mkdir(dirname(cliOptions.out), { recursive: true });
	await mkdir(dirname(cliOptions.searchReport), { recursive: true });
	await writeFile(cliOptions.out, optimizedSvg);

	const finalReport = await compareSvg({
		diffPath: cliOptions.diff,
		metric: 'mae',
		outPath: cliOptions.rendered,
		referencePath: cliOptions.reference,
		reportPath: cliOptions.report,
		svgPath: cliOptions.out,
		threshold: cliOptions.threshold,
	});

	await writeFile(
		cliOptions.searchReport,
		`${JSON.stringify(
			{
				bestVariant: {
					maeSimilarity: finalReport.metrics.maeSimilarity,
					palette: bestOverall.palette.name,
					pixelSimilarity: finalReport.metrics.pixelSimilarity,
					shadow: bestOverall.shadow.name,
				},
				outputs: {
					diffPng: cliOptions.diff,
					renderedPng: cliOptions.rendered,
					reportJson: cliOptions.report,
					searchJson: cliOptions.searchReport,
					svg: cliOptions.out,
				},
				paletteSearch: {
					grid: comparisonGrid,
					seedShadow: fixedPaletteShadow.name,
					summaries: paletteSummaries,
					topPalettes: topPalettes.map((entry) => ({
						gridAvgMaeSimilarity: entry.score.grid.avgMaeSimilarity,
						gridMinMaeSimilarity: entry.score.grid.minMaeSimilarity,
						gridWorstCell: `${entry.score.grid.worstCells[0]?.row ?? 0},${entry.score.grid.worstCells[0]?.col ?? 0}`,
						gridWorstQuartileMaeSimilarity: entry.score.grid.worstQuartileMaeSimilarity,
						maeSimilarity: entry.score.maeSimilarity,
						name: entry.palette.name,
						pixelSimilarity: entry.score.pixelSimilarity,
					})),
				},
				shadowSearch: {
					grid: comparisonGrid,
					summaries: shadowSummaries,
					topPaletteCount,
				},
				localRefinement: {
					rounds: localRefinement.rounds,
				},
				discreteGradientSearch: {
					angles: discreteGradientAngles,
					pairs: discreteGradientPairs.map((pair) => pair.id),
					rounds: discreteGradientSearch.rounds,
					selections: discreteSignatureForPalette(bestOverall.palette),
				},
				sourceBwSvgPath: cliOptions.source,
				verifiedMetrics: finalReport.metrics,
				verifiedScore: bestOverall.score,
			},
			null,
			2,
		)}\n`,
	);

	console.log(
		JSON.stringify(
				{
					bestPalette: bestOverall.palette.name,
					bestShadow: bestOverall.shadow.name,
					maeSimilarity: finalReport.metrics.maeSimilarity,
					outputSvgPath: cliOptions.out,
					pixelSimilarity: finalReport.metrics.pixelSimilarity,
				},
			null,
			2,
		),
	);
};

main().catch((error: unknown) => {
	console.error(error);
	process.exitCode = 1;
});
