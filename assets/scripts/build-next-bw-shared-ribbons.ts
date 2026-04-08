import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { parseArgs } from 'node:util';

import { compareSvg } from '../next/scripts/compare-svg';

interface CliOptions {
	buildReport: string;
	cx: number;
	cy: number;
	diff: string;
	families: string[];
	fixed: string;
	out: string;
	range: number;
	reference: string;
	rendered: string;
	report: string;
	search: boolean;
	source: string;
	step: number;
	threshold: number;
}

interface RootAttrs {
	height: string;
	viewBox: string;
	width: string;
}

interface SvgPath {
	d: string;
	id: string;
}

interface SearchSummary {
	baseCenter: {
		cx: number;
		cy: number;
	};
	bestCenter: {
		cx: number;
		cy: number;
	};
	bestMetrics: {
		maeSimilarity: number;
		pixelSimilarity: number;
	};
	range: number;
	step: number;
	testedCount: number;
}

interface SharedFamily {
	masterId: string;
	memberRotations: ReadonlyMap<string, number>;
	name: string;
}

const repoRoot = resolve(import.meta.dirname, '..', '..');
const nextDir = resolve(repoRoot, 'assets', 'next');

const defaultOptions: CliOptions = {
	buildReport: resolve(nextDir, 'out', 'icon-bw-shared-outer.build.json'),
	cx: 538.5,
	cy: 535,
	diff: resolve(nextDir, 'out', 'icon-bw-shared-outer.diff.png'),
	families: ['outer'],
	fixed: '/Users/kzf/Documents/fixed.svg',
	out: resolve(nextDir, 'svg', 'icon-bw-shared-outer.svg'),
	range: 1,
	reference: resolve(nextDir, 'source', 'icon-bw.png'),
	rendered: resolve(nextDir, 'out', 'icon-bw-shared-outer.rendered.png'),
	report: resolve(nextDir, 'out', 'icon-bw-shared-outer.report.json'),
	search: false,
	source: resolve(nextDir, 'svg', 'icon-bw.svg'),
	step: 0.25,
	threshold: 99.8,
};

const sharedFamilies = new Map<string, SharedFamily>([
	[
		'outer',
		{
			masterId: 'p17',
			memberRotations: new Map([
				['p3', 180],
				['p7', -90],
				['p12', 90],
				['p17', 0],
			]),
			name: 'outer',
		},
	],
	[
		'inner',
		{
			masterId: 'p16',
			memberRotations: new Map([
				['p5', 180],
				['p6', 90],
				['p13', -90],
				['p16', 0],
			]),
			name: 'inner',
		},
	],
	[
		'fragments',
		{
			masterId: 'p11',
			memberRotations: new Map([
				['p4', -90],
				['p8', 180],
				['p11', 0],
				['p15', 90],
			]),
			name: 'fragments',
		},
	],
	[
		'corner180',
		{
			masterId: 'p14',
			memberRotations: new Map([
				['p2', 180],
				['p14', 0],
			]),
			name: 'corner180',
		},
	],
]);

const fixedPreferredIds = new Set(['p10', 'p11', 'p14', 'p16', 'p17', 'p18', 'p19']);

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
			buildReport: { type: 'string' },
			cx: { type: 'string' },
			cy: { type: 'string' },
			diff: { type: 'string' },
			families: { type: 'string' },
			fixed: { type: 'string' },
			out: { type: 'string' },
			range: { type: 'string' },
			reference: { type: 'string' },
			rendered: { type: 'string' },
			report: { type: 'string' },
			search: { type: 'boolean' },
			source: { type: 'string' },
			step: { type: 'string' },
			threshold: { type: 'string' },
		},
		strict: true,
	});

	return {
		buildReport: parsed.values.buildReport ? resolve(parsed.values.buildReport) : defaultOptions.buildReport,
		cx: parseNumber(parsed.values.cx, defaultOptions.cx),
		cy: parseNumber(parsed.values.cy, defaultOptions.cy),
		diff: parsed.values.diff ? resolve(parsed.values.diff) : defaultOptions.diff,
		families: (parsed.values.families ?? defaultOptions.families.join(','))
			.split(',')
			.map((name) => name.trim())
			.filter(Boolean),
		fixed: parsed.values.fixed ? resolve(parsed.values.fixed) : defaultOptions.fixed,
		out: parsed.values.out ? resolve(parsed.values.out) : defaultOptions.out,
		range: parseNumber(parsed.values.range, defaultOptions.range),
		reference: parsed.values.reference ? resolve(parsed.values.reference) : defaultOptions.reference,
		rendered: parsed.values.rendered ? resolve(parsed.values.rendered) : defaultOptions.rendered,
		report: parsed.values.report ? resolve(parsed.values.report) : defaultOptions.report,
		search: parsed.values.search ?? defaultOptions.search,
		source: parsed.values.source ? resolve(parsed.values.source) : defaultOptions.source,
		step: parseNumber(parsed.values.step, defaultOptions.step),
		threshold: parseNumber(parsed.values.threshold, defaultOptions.threshold),
	};
};

const extractRootAttrs = (svg: string): RootAttrs => {
	const svgTagMatch = svg.match(/<svg\b([^>]*)>/);
	if (!svgTagMatch?.[1]) {
		throw new Error('Missing root <svg> tag.');
	}
	const attrs = svgTagMatch[1];
	return {
		height: attrs.match(/\bheight="([^"]+)"/)?.[1] ?? '1078',
		viewBox: attrs.match(/\bviewBox="([^"]+)"/)?.[1] ?? '0 0 1078 1078',
		width: attrs.match(/\bwidth="([^"]+)"/)?.[1] ?? '1078',
	};
};

const extractPaths = (svg: string): SvgPath[] =>
	Array.from(svg.matchAll(/<path id="([^"]+)" d="([^"]+)"/g), (match) => {
		const id = match[1];
		const d = match[2];
		if (!id || !d) {
			throw new Error('Invalid path entry in SVG.');
		}
		return { d, id };
	});

const formatNumber = (value: number): string => {
	const rounded = Number(value.toFixed(4));
	return Number.isInteger(rounded) ? `${rounded}` : `${rounded}`;
};

const toPathElement = ({ d, id }: SvgPath): string => `  <path id="${id}" d="${d}" fill="#fff"/>`;

const rotatePoint = (
	x: number,
	y: number,
	rotation: number,
	center: { cx: number; cy: number },
): { x: number; y: number } => {
	switch (rotation) {
		case 0:
			return { x, y };
		case 90:
			return {
				x: center.cx - (y - center.cy),
				y: center.cy + (x - center.cx),
			};
		case -90:
			return {
				x: center.cx + (y - center.cy),
				y: center.cy - (x - center.cx),
			};
		case 180:
			return {
				x: center.cx * 2 - x,
				y: center.cy * 2 - y,
			};
		default:
			throw new Error(`Unsupported outer rotation: ${rotation}`);
	}
};

const rotatePathData = (d: string, rotation: number, center: { cx: number; cy: number }): string => {
	if (rotation === 0) {
		return d;
	}

	return Array.from(d.matchAll(/([A-Za-z])\s*([^A-Za-z]*)/g), (match) => {
		const command = match[1];
		const coordText = match[2]?.trim() ?? '';
		if (!command) {
			throw new Error('Invalid SVG command while rotating path data.');
		}
		if (!coordText) {
			return command;
		}
		if (!['M', 'L', 'C'].includes(command)) {
			throw new Error(`Unsupported SVG command ${command} in shared outer ribbon master.`);
		}

		const values = Array.from(coordText.matchAll(/-?\d*\.?\d+/g), (valueMatch) => Number.parseFloat(valueMatch[0]));
		if (values.length % 2 !== 0) {
			throw new Error(`Odd coordinate count for command ${command}.`);
		}

		const rotatedValues = values.flatMap((value, index) => {
			if (index % 2 === 1) {
				return [];
			}
			const point = rotatePoint(value, values[index + 1] ?? 0, rotation, center);
			return [formatNumber(point.x), formatNumber(point.y)];
		});

		return `${command} ${rotatedValues.join(' ')}`;
	}).join(' ');
};

const mergeFixedPaths = (sourcePaths: SvgPath[], fixedPaths: SvgPath[]): { changedPathIds: string[]; mergedPaths: SvgPath[] } => {
	const fixedPathMap = new Map(fixedPaths.map((path) => [path.id, path.d]));
	const changedPathIds: string[] = [];

	const mergedPaths = sourcePaths.map(({ d, id }) => {
		const fixedD = fixedPathMap.get(id);
		if (!fixedD) {
			return { d, id };
		}
		if (fixedD !== d && fixedPreferredIds.has(id)) {
			changedPathIds.push(id);
			return { d: fixedD, id };
		}
		return { d, id };
	});

	return { changedPathIds, mergedPaths };
};

const resolveFamilies = (familyNames: string[]): SharedFamily[] => {
	if (familyNames.length === 0) {
		throw new Error('At least one family must be selected.');
	}
	return familyNames.map((familyName) => {
		const family = sharedFamilies.get(familyName);
		if (!family) {
			throw new Error(`Unknown shared family: ${familyName}`);
		}
		return family;
	});
};

const buildSharedSvg = (options: {
	center: {
		cx: number;
		cy: number;
	};
	families: SharedFamily[];
	mergedPaths: SvgPath[];
	root: RootAttrs;
}): string => {
	const mergedPathMap = new Map(options.mergedPaths.map((path) => [path.id, path.d]));
	const familyMemberMap = new Map<string, { masterD: string; rotation: number }>();

	for (const family of options.families) {
		const masterD = mergedPathMap.get(family.masterId);
		if (!masterD) {
			throw new Error(`Missing ${family.masterId} in merged path set.`);
		}
		for (const [pathId, rotation] of family.memberRotations) {
			familyMemberMap.set(pathId, { masterD, rotation });
		}
	}

	const body = options.mergedPaths.map((path) => {
		const familyMember = familyMemberMap.get(path.id);
		if (!familyMember) {
			return toPathElement(path);
		}
		return toPathElement({
			d: rotatePathData(familyMember.masterD, familyMember.rotation, options.center),
			id: path.id,
		});
	});

	return [
		`<svg width="${options.root.width}" height="${options.root.height}" viewBox="${options.root.viewBox}" xmlns="http://www.w3.org/2000/svg">`,
		`  <rect width="${options.root.width}" height="${options.root.height}" fill="#000"/>`,
		...body,
		'</svg>',
	].join('\n');
};

const isBetterReport = (
	left: { metrics: { maeSimilarity: number; pixelSimilarity: number } },
	right: { metrics: { maeSimilarity: number; pixelSimilarity: number } } | null,
): boolean =>
	right == null ||
	left.metrics.pixelSimilarity > right.metrics.pixelSimilarity ||
	(left.metrics.pixelSimilarity === right.metrics.pixelSimilarity &&
		left.metrics.maeSimilarity > right.metrics.maeSimilarity);

const searchBestCenter = async (options: {
	baseCenter: {
		cx: number;
		cy: number;
	};
	families: SharedFamily[];
	mergedPaths: SvgPath[];
	range: number;
	referencePath: string;
	root: RootAttrs;
	step: number;
	threshold: number;
}): Promise<SearchSummary> => {
	if (options.step <= 0) {
		throw new Error('Search step must be greater than 0.');
	}

	const span = Math.round(options.range / options.step);
	let testedCount = 0;
	let bestReport:
		| {
				center: {
					cx: number;
					cy: number;
				};
				metrics: {
					maeSimilarity: number;
					pixelSimilarity: number;
				};
		  }
		| null = null;
	const tempDir = await mkdtemp(resolve(tmpdir(), 'agenter-next-shared-'));

	try {
		for (let yIndex = -span; yIndex <= span; yIndex += 1) {
			for (let xIndex = -span; xIndex <= span; xIndex += 1) {
				const center = {
					cx: Number((options.baseCenter.cx + xIndex * options.step).toFixed(4)),
					cy: Number((options.baseCenter.cy + yIndex * options.step).toFixed(4)),
				};
				const svg = buildSharedSvg({
					center,
					families: options.families,
					mergedPaths: options.mergedPaths,
					root: options.root,
				});
				const candidateId = `${yIndex + span}-${xIndex + span}`;
				const tempSvgPath = resolve(tempDir, `${candidateId}.svg`);
				await writeFile(tempSvgPath, svg);
				const report = await compareSvg({
					diffPath: resolve(tempDir, `${candidateId}.diff.png`),
					metric: 'pixel',
					outPath: resolve(tempDir, `${candidateId}.rendered.png`),
					referencePath: options.referencePath,
					reportPath: resolve(tempDir, `${candidateId}.report.json`),
					svgPath: tempSvgPath,
					threshold: options.threshold,
				});
				testedCount += 1;

				if (isBetterReport(report, bestReport)) {
					bestReport = {
						center,
						metrics: {
							maeSimilarity: report.metrics.maeSimilarity,
							pixelSimilarity: report.metrics.pixelSimilarity,
						},
					};
					console.log(
						`[center-search] best=${bestReport.metrics.pixelSimilarity.toFixed(6)} mae=${bestReport.metrics.maeSimilarity.toFixed(6)} cx=${formatNumber(center.cx)} cy=${formatNumber(center.cy)}`,
					);
				}
			}
		}
	} finally {
		await rm(tempDir, { force: true, recursive: true });
	}

	if (!bestReport) {
		throw new Error('Center search did not evaluate any candidates.');
	}

	return {
		baseCenter: options.baseCenter,
		bestCenter: bestReport.center,
		bestMetrics: bestReport.metrics,
		range: options.range,
		step: options.step,
		testedCount,
	};
};

const main = async (): Promise<void> => {
	const options = parseCliArgs(process.argv.slice(2));
	const [sourceSvg, fixedSvg] = await Promise.all([
		readFile(options.source, 'utf8'),
		readFile(options.fixed, 'utf8'),
	]);

	const root = extractRootAttrs(sourceSvg);
	const sourcePaths = extractPaths(sourceSvg);
	const fixedPaths = extractPaths(fixedSvg);
	const { changedPathIds, mergedPaths } = mergeFixedPaths(sourcePaths, fixedPaths);
	const families = resolveFamilies(options.families);

	const baseCenter = { cx: options.cx, cy: options.cy };
	const searchSummary = options.search
		? await searchBestCenter({
				baseCenter,
				families,
				mergedPaths,
				range: options.range,
				referencePath: options.reference,
				root,
				step: options.step,
				threshold: options.threshold,
			})
		: null;

	const finalCenter = searchSummary?.bestCenter ?? baseCenter;
	const finalSvg = buildSharedSvg({
		center: finalCenter,
		families,
		mergedPaths,
		root,
	});

	await mkdir(dirname(options.out), { recursive: true });
	await mkdir(dirname(options.buildReport), { recursive: true });
	await writeFile(options.out, finalSvg);

	const finalCompareReport = await compareSvg({
		diffPath: options.diff,
		metric: 'pixel',
		outPath: options.rendered,
		referencePath: options.reference,
		reportPath: options.report,
		svgPath: options.out,
		threshold: options.threshold,
	});

	await writeFile(
		options.buildReport,
		`${JSON.stringify(
			{
				center: finalCenter,
				changedPathIds,
				families: families.map((family) => family.name),
				fixedSvgPath: options.fixed,
				sharedFamilies: families.map((family) => ({
					masterId: family.masterId,
					memberRotations: Array.from(family.memberRotations, ([pathId, rotation]) => ({ pathId, rotation })),
					name: family.name,
				})),
				referencePngPath: options.reference,
				searchSummary,
				sourceSvgPath: options.source,
				threshold: options.threshold,
				finalMetrics: {
					maeSimilarity: finalCompareReport.metrics.maeSimilarity,
					pixelSimilarity: finalCompareReport.metrics.pixelSimilarity,
				},
			},
			null,
			2,
		)}\n`,
	);

	console.log(
		JSON.stringify(
			{
				buildReport: options.buildReport,
				center: finalCenter,
				families: families.map((family) => family.name),
				out: options.out,
				pixelSimilarity: finalCompareReport.metrics.pixelSimilarity,
				report: options.report,
				searchSummary,
			},
			null,
			2,
		),
	);
};

await main();
