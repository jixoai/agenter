import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { parseArgs } from 'node:util';

import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import sharp from 'sharp';

import { renderSvgToPng } from './render-svg';

const rootDir = resolve(import.meta.dirname, '..');

type MetricName = 'mae' | 'pixel' | 'rmse';

interface CompareMetrics {
	mae: number;
	maeSimilarity: number;
	pixelDifferenceRatio: number;
	pixelDifferencePixels: number;
	pixelSimilarity: number;
	rmse: number;
	rmseSimilarity: number;
}

interface CompareReport {
	height: number;
	metric: MetricName;
	metrics: CompareMetrics;
	passed: boolean;
	paths: {
		diffPng: string;
		referencePng: string;
		renderedPng: string;
		reportJson: string;
		svg: string;
	};
	threshold: number;
	width: number;
}

function similarityForMetric(metrics: CompareMetrics, metric: MetricName): number {
	switch (metric) {
		case 'pixel':
			return metrics.pixelSimilarity;
		case 'rmse':
			return metrics.rmseSimilarity;
		case 'mae':
			return metrics.maeSimilarity;
	}
}

async function readRawPng(path: string) {
	return sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
}

async function compareSvg(options: {
	diffPath?: string;
	metric?: MetricName;
	outPath?: string;
	referencePath?: string;
	reportPath?: string;
	svgPath?: string;
	threshold?: number;
} = {}): Promise<CompareReport> {
	const referencePath = resolve(rootDir, options.referencePath ?? 'source/icon.png');
	const svgPath = resolve(rootDir, options.svgPath ?? 'svg/icon.svg');
	const renderedPath = resolve(rootDir, options.outPath ?? 'out/icon.rendered.png');
	const diffPath = resolve(rootDir, options.diffPath ?? 'out/icon.diff.png');
	const reportPath = resolve(rootDir, options.reportPath ?? 'out/report.json');
	const threshold = options.threshold ?? 95;
	const metric = options.metric ?? 'mae';

	const referenceMeta = await sharp(referencePath).metadata();
	const width = referenceMeta.width ?? 1078;
	const height = referenceMeta.height ?? 1078;

	await renderSvgToPng({ height, pngPath: renderedPath, svgPath, width });

	const referenceRaw = await readRawPng(referencePath);
	const renderedRaw = await readRawPng(renderedPath);

	if (referenceRaw.info.width !== renderedRaw.info.width || referenceRaw.info.height !== renderedRaw.info.height) {
		throw new Error('Rendered SVG dimensions do not match the reference PNG.');
	}

	const channels = referenceRaw.info.channels;
	const totalSamples = referenceRaw.info.width * referenceRaw.info.height * channels;

	let absoluteError = 0;
	let squaredError = 0;

	for (let index = 0; index < totalSamples; index += 1) {
		const difference = referenceRaw.data[index] - renderedRaw.data[index];
		absoluteError += Math.abs(difference);
		squaredError += difference * difference;
	}

	const referencePng = PNG.sync.read(await readFile(referencePath));
	const renderedPng = PNG.sync.read(await readFile(renderedPath));
	const diffPng = new PNG({ width, height });

	const pixelDifferencePixels = pixelmatch(
		referencePng.data,
		renderedPng.data,
		diffPng.data,
		width,
		height,
		{ threshold: 0.1 },
	);

	await mkdir(dirname(diffPath), { recursive: true });
	await writeFile(diffPath, PNG.sync.write(diffPng));

	const mae = absoluteError / totalSamples;
	const rmse = Math.sqrt(squaredError / totalSamples);
	const pixelDifferenceRatio = pixelDifferencePixels / (width * height);

	const metrics: CompareMetrics = {
		mae,
		maeSimilarity: (1 - mae / 255) * 100,
		pixelDifferencePixels,
		pixelDifferenceRatio,
		pixelSimilarity: (1 - pixelDifferenceRatio) * 100,
		rmse,
		rmseSimilarity: (1 - rmse / 255) * 100,
	};

	const report: CompareReport = {
		height,
		metric,
		metrics,
		passed: similarityForMetric(metrics, metric) >= threshold,
		paths: {
			diffPng: diffPath,
			referencePng: referencePath,
			renderedPng: renderedPath,
			reportJson: reportPath,
			svg: svgPath,
		},
		threshold,
		width,
	};

	await writeFile(reportPath, JSON.stringify(report, null, 2));

	return report;
}

if (import.meta.main) {
	const parsed = parseArgs({
		args: process.argv.slice(2),
		options: {
			diff: { type: 'string' },
			metric: { type: 'string' },
			out: { type: 'string' },
			reference: { type: 'string' },
			report: { type: 'string' },
			svg: { type: 'string' },
			threshold: { type: 'string' },
		},
		strict: true,
	});

	const metric = (parsed.values.metric ?? 'mae') as MetricName;

	if (!['mae', 'pixel', 'rmse'].includes(metric)) {
		throw new Error(`Unsupported metric: ${metric}`);
	}

	const threshold = parsed.values.threshold ? Number.parseFloat(parsed.values.threshold) : 95;
	const report = await compareSvg({
		diffPath: parsed.values.diff,
		metric,
		outPath: parsed.values.out,
		referencePath: parsed.values.reference,
		reportPath: parsed.values.report,
		svgPath: parsed.values.svg,
		threshold,
	});

	console.log(JSON.stringify(report, null, 2));
	process.exitCode = report.passed ? 0 : 1;
}

export { compareSvg };
