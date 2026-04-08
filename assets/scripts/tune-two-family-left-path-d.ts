import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import sharp from 'sharp';

interface NumericToken {
	end: number;
	start: number;
	value: number;
}

interface RawImage {
	data: Buffer;
	info: {
		channels: number;
		height: number;
		width: number;
	};
}

interface Score {
	mae: number;
	maeSimilarity: number;
	pixelDifferencePixels: number;
	pixelSimilarity: number;
}

interface Evaluation {
	diffPng: PNG;
	renderedPng: Buffer;
	score: Score;
}

const repoRoot = resolve(import.meta.dirname, '..', '..');
const nextDir = resolve(repoRoot, 'assets', 'next');
const sourceSvgPath = resolve(nextDir, 'out', 'two-family-left.svg');
const referencePngPath = resolve(nextDir, 'source', 'icon-bw.png');
const outputSvgPath = resolve(nextDir, 'out', 'two-family-left-path-d-hillclimb.svg');
const outputRenderedPath = resolve(nextDir, 'out', 'two-family-left-path-d-hillclimb.rendered.png');
const outputDiffPath = resolve(nextDir, 'out', 'two-family-left-path-d-hillclimb.diff.png');
const outputReportPath = resolve(nextDir, 'out', 'two-family-left-path-d-hillclimb.report.json');
const targetPathId = 'd';
const deltaCandidates = [-1, 1] as const;
const maxRounds = 12;
const numberPattern = /-?\d*\.?\d+(?:e[+-]?\d+)?/gi;

const formatNumber = (value: number): string => {
	const rounded = Number.parseFloat(value.toFixed(3));
	return Number.isInteger(rounded) ? String(rounded) : String(rounded);
};

const parseNumericTokens = (d: string): NumericToken[] => {
	const tokens: NumericToken[] = [];

	for (const match of d.matchAll(numberPattern)) {
		const raw = match[0];
		const start = match.index ?? 0;
		tokens.push({
			end: start + raw.length,
			start,
			value: Number.parseFloat(raw),
		});
	}

	return tokens;
};

const rebuildPathData = (originalD: string, tokens: NumericToken[], values: number[]): string => {
	let cursor = 0;
	let output = '';

	for (let index = 0; index < tokens.length; index += 1) {
		const token = tokens[index];
		output += originalD.slice(cursor, token.start);
		output += formatNumber(values[index] ?? token.value);
		cursor = token.end;
	}

	output += originalD.slice(cursor);
	return output;
};

const replacePathData = (svg: string, pathId: string, nextD: string): string => {
	const pattern = new RegExp(`(<path\\s+id="${pathId}"\\s+d=")([^"]+)(")`);
	if (!pattern.test(svg)) {
		throw new Error(`Unable to find path #${pathId} in ${sourceSvgPath}.`);
	}
	const nextSvg = svg.replace(pattern, `$1${nextD}$3`);
	return nextSvg;
};

const betterThan = (left: Score, right: Score): boolean =>
	left.pixelSimilarity > right.pixelSimilarity ||
	(left.pixelSimilarity === right.pixelSimilarity && left.maeSimilarity > right.maeSimilarity);

const scoreSvg = async (svg: string, referenceRaw: RawImage): Promise<Evaluation> => {
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

	const diffPng = new PNG({ height: renderedRaw.info.height, width: renderedRaw.info.width });
	const pixelDifferencePixels = pixelmatch(
		referenceRaw.data,
		renderedRaw.data,
		diffPng.data,
		renderedRaw.info.width,
		renderedRaw.info.height,
		{ threshold: 0.1 },
	);

	let absoluteError = 0;
	const totalSamples = referenceRaw.info.width * referenceRaw.info.height * referenceRaw.info.channels;

	for (let index = 0; index < totalSamples; index += 1) {
		absoluteError += Math.abs(referenceRaw.data[index] - renderedRaw.data[index]);
	}

	const mae = absoluteError / totalSamples;
	const pixelDifferenceRatio = pixelDifferencePixels / (renderedRaw.info.width * renderedRaw.info.height);

	return {
		diffPng,
		renderedPng,
		score: {
			mae,
			maeSimilarity: (1 - mae / 255) * 100,
			pixelDifferencePixels,
			pixelSimilarity: (1 - pixelDifferenceRatio) * 100,
		},
	};
};

const main = async (): Promise<void> => {
	const sourceSvg = await readFile(sourceSvgPath, 'utf8');
	const pathMatch = sourceSvg.match(new RegExp(`<path\\s+id="${targetPathId}"\\s+d="([^"]+)"`));

	if (!pathMatch?.[1]) {
		throw new Error(`Unable to parse path #${targetPathId} from ${sourceSvgPath}.`);
	}

	const originalD = pathMatch[1];
	const tokens = parseNumericTokens(originalD);
	const baseValues = tokens.map((token) => token.value);
	let currentValues = [...baseValues];
	const referenceRaw = (await sharp(referencePngPath).ensureAlpha().raw().toBuffer({
		resolveWithObject: true,
	})) as RawImage;
	let currentD = rebuildPathData(originalD, tokens, currentValues);
	let currentSvg = replacePathData(sourceSvg, targetPathId, currentD);
	let currentEvaluation = await scoreSvg(currentSvg, referenceRaw);
	const baseScore = currentEvaluation.score;
	const rounds: Array<Record<string, unknown>> = [];

	console.log(
		JSON.stringify(
			{
				basePixelSimilarity: baseScore.pixelSimilarity,
				numericTokenCount: currentValues.length,
				pathId: targetPathId,
				sourceSvgPath,
			},
			null,
			2,
		),
	);

	for (let round = 1; round <= maxRounds; round += 1) {
		let acceptedCount = 0;

		for (let index = 0; index < currentValues.length; index += 1) {
			let bestLocalValues: number[] | null = null;
			let bestLocalScore: Score | null = null;

			for (const delta of deltaCandidates) {
				const nextValues = [...currentValues];
				nextValues[index] += delta;
				const nextD = rebuildPathData(originalD, tokens, nextValues);
				const nextSvg = replacePathData(sourceSvg, targetPathId, nextD);
				const { score } = await scoreSvg(nextSvg, referenceRaw);

				if (
					betterThan(score, currentEvaluation.score) &&
					(!bestLocalScore || betterThan(score, bestLocalScore))
				) {
					bestLocalValues = nextValues;
					bestLocalScore = score;
				}
			}

			if (!bestLocalValues || !bestLocalScore) {
				continue;
			}

			currentValues = bestLocalValues;
			currentD = rebuildPathData(originalD, tokens, currentValues);
			currentSvg = replacePathData(sourceSvg, targetPathId, currentD);
			currentEvaluation = await scoreSvg(currentSvg, referenceRaw);
			acceptedCount += 1;

			console.log(
				JSON.stringify(
					{
						accepted: true,
						deltaFromBase: currentValues[index] - baseValues[index],
						index,
						pixelSimilarity: currentEvaluation.score.pixelSimilarity,
						round,
						value: currentValues[index],
					},
					null,
					2,
				),
			);
		}

		rounds.push({
			acceptedCount,
			pixelSimilarity: currentEvaluation.score.pixelSimilarity,
			round,
		});

		if (acceptedCount === 0) {
			break;
		}
	}

	await mkdir(dirname(outputSvgPath), { recursive: true });
	await writeFile(outputSvgPath, currentSvg);
	await writeFile(outputRenderedPath, currentEvaluation.renderedPng);
	await writeFile(outputDiffPath, PNG.sync.write(currentEvaluation.diffPng));
	await writeFile(
		outputReportPath,
		`${JSON.stringify(
			{
				basePathId: targetPathId,
				baseScore,
				finalD: currentD,
				finalScore: currentEvaluation.score,
				outputs: {
					diffPng: outputDiffPath,
					renderedPng: outputRenderedPath,
					svg: outputSvgPath,
				},
				rounds,
				sourceSvgPath,
				tokenCount: currentValues.length,
				values: currentValues,
			},
			null,
			2,
		)}\n`,
	);

	console.log(
		JSON.stringify(
			{
				basePixelSimilarity: baseScore.pixelSimilarity,
				finalPixelSimilarity: currentEvaluation.score.pixelSimilarity,
				outputSvgPath,
				rounds,
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
