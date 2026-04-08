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

interface PathState {
	currentD: string;
	currentValues: number[];
	pathId: string;
	templateD: string;
	tokens: NumericToken[];
}

interface MoveLog {
	acceptedCount: number;
	pathId: string;
	pixelSimilarity: number;
	round: number;
	stage: string;
}

interface PairMoveLog {
	deltaA: number;
	deltaB: number;
	indexA: number;
	indexB: number;
	pixelSimilarity: number;
	round: number;
	stage: string;
}

const repoRoot = resolve(import.meta.dirname, '..', '..');
const nextDir = resolve(repoRoot, 'assets', 'next');
const referencePngPath = resolve(nextDir, 'source', 'icon-bw.png');
const sourceSvgPath = resolve(nextDir, 'out', 'two-family-left.svg');
const sourceSingleDPath = resolve(nextDir, 'out', 'two-family-left-path-d-hillclimb.svg');
const pairwiseSvgPath = resolve(nextDir, 'out', 'two-family-left-path-d-pairwise.svg');
const pairwiseRenderedPath = resolve(nextDir, 'out', 'two-family-left-path-d-pairwise.rendered.png');
const pairwiseDiffPath = resolve(nextDir, 'out', 'two-family-left-path-d-pairwise.diff.png');
const pairwiseReportPath = resolve(nextDir, 'out', 'two-family-left-path-d-pairwise.report.json');
const combinedSvgPath = resolve(nextDir, 'out', 'two-family-left-path-bcde-combined.svg');
const combinedRenderedPath = resolve(nextDir, 'out', 'two-family-left-path-bcde-combined.rendered.png');
const combinedDiffPath = resolve(nextDir, 'out', 'two-family-left-path-bcde-combined.diff.png');
const combinedReportPath = resolve(nextDir, 'out', 'two-family-left-path-bcde-combined.report.json');

const pairwisePathId = 'd';
const singlePathIds = ['b', 'c', 'e'] as const;
const singleDeltaCandidates = [-1, 1] as const;
const pairwiseDeltaCandidates = [-1, 1] as const;
const maxSingleRounds = 12;
const maxPairRounds = 8;
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
		throw new Error(`Unable to find path #${pathId} in SVG source.`);
	}
	return svg.replace(pattern, `$1${nextD}$3`);
};

const readRawImage = async (pngPath: string): Promise<RawImage> =>
	(await sharp(pngPath).ensureAlpha().raw().toBuffer({
		resolveWithObject: true,
	})) as RawImage;

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

const extractPathData = (svg: string, pathId: string): string => {
	const match = svg.match(new RegExp(`<path\\s+id="${pathId}"\\s+d="([^"]+)"`));
	if (!match?.[1]) {
		throw new Error(`Unable to parse path #${pathId}.`);
	}
	return match[1];
};

const createPathState = (svg: string, pathId: string): PathState => {
	const templateD = extractPathData(svg, pathId);
	const tokens = parseNumericTokens(templateD);
	const currentValues = tokens.map((token) => token.value);
	return {
		currentD: templateD,
		currentValues,
		pathId,
		templateD,
		tokens,
	};
};

const materializePathState = (pathState: PathState, values: number[]): PathState => ({
	...pathState,
	currentD: rebuildPathData(pathState.templateD, pathState.tokens, values),
	currentValues: values,
});

const findChangedIndices = (baseValues: number[], currentValues: number[]): number[] => {
	const changedIndices: number[] = [];
	for (let index = 0; index < Math.min(baseValues.length, currentValues.length); index += 1) {
		if (baseValues[index] !== currentValues[index]) {
			changedIndices.push(index);
		}
	}
	return changedIndices;
};

const buildSvg = (baseSvg: string, pathStates: Map<string, PathState>): string => {
	let svg = baseSvg;
	for (const [pathId, state] of pathStates) {
		svg = replacePathData(svg, pathId, state.currentD);
	}
	return svg;
};

const clonePathStates = (pathStates: Map<string, PathState>): Map<string, PathState> => {
	const cloned = new Map<string, PathState>();
	for (const [pathId, state] of pathStates) {
		cloned.set(pathId, {
			currentD: state.currentD,
			currentValues: [...state.currentValues],
			pathId,
			templateD: state.templateD,
			tokens: [...state.tokens],
		});
	}
	return cloned;
};

const singleVariableClimb = async (options: {
	baseSvg: string;
	candidateIndices?: number[];
	pathState: PathState;
	pathStates: Map<string, PathState>;
	referenceRaw: RawImage;
	stage: string;
	startScore: Score;
}): Promise<{ logs: MoveLog[]; score: Score; svg: string }> => {
	let currentScore = options.startScore;
	let currentSvg = buildSvg(options.baseSvg, options.pathStates);
	const logs: MoveLog[] = [];
	const candidateIndices =
		options.candidateIndices ?? options.pathState.currentValues.map((_, index) => index);

	for (let round = 1; round <= maxSingleRounds; round += 1) {
		let acceptedCount = 0;
		console.log(
			`[${options.stage}] round ${round} start: pixelSimilarity=${currentScore.pixelSimilarity.toFixed(6)} candidates=${candidateIndices.length}`,
		);

		for (const index of candidateIndices) {
			let bestLocalScore: Score | null = null;
			let bestLocalValues: number[] | null = null;

			for (const delta of singleDeltaCandidates) {
				const nextValues = [...options.pathState.currentValues];
				nextValues[index] += delta;
				const nextState = materializePathState(options.pathState, nextValues);
				const nextStates = clonePathStates(options.pathStates);
				nextStates.set(options.pathState.pathId, nextState);
				const nextSvg = buildSvg(options.baseSvg, nextStates);
				const evaluation = await scoreSvg(nextSvg, options.referenceRaw);

				if (betterThan(evaluation.score, currentScore) && (!bestLocalScore || betterThan(evaluation.score, bestLocalScore))) {
					bestLocalScore = evaluation.score;
					bestLocalValues = nextValues;
				}
			}

			if (!bestLocalScore || !bestLocalValues) {
				continue;
			}

			const acceptedState = materializePathState(options.pathState, bestLocalValues);
			options.pathState.currentValues = acceptedState.currentValues;
			options.pathState.currentD = acceptedState.currentD;
			options.pathStates.set(options.pathState.pathId, { ...options.pathState });
			currentSvg = buildSvg(options.baseSvg, options.pathStates);
			currentScore = bestLocalScore;
			acceptedCount += 1;
		}

		logs.push({
			acceptedCount,
			pathId: options.pathState.pathId,
			pixelSimilarity: currentScore.pixelSimilarity,
			round,
			stage: options.stage,
		});

		if (acceptedCount === 0) {
			break;
		}
	}

	return { logs, score: currentScore, svg: currentSvg };
};

const pairwiseClimb = async (options: {
	baseSvg: string;
	candidateIndices: number[];
	pathState: PathState;
	pathStates: Map<string, PathState>;
	referenceRaw: RawImage;
	stage: string;
	startScore: Score;
}): Promise<{ logs: PairMoveLog[]; score: Score; svg: string }> => {
	let currentScore = options.startScore;
	let currentSvg = buildSvg(options.baseSvg, options.pathStates);
	const logs: PairMoveLog[] = [];

	for (let round = 1; round <= maxPairRounds; round += 1) {
		let bestRoundScore: Score | null = null;
		let bestRoundValues: number[] | null = null;
		let bestMove: PairMoveLog | null = null;
		let pairCount = 0;

		console.log(
			`[${options.stage}] round ${round} start: pixelSimilarity=${currentScore.pixelSimilarity.toFixed(6)} candidates=${options.candidateIndices.length}`,
		);

		for (let positionA = 0; positionA < options.candidateIndices.length - 1; positionA += 1) {
			const indexA = options.candidateIndices[positionA]!;
			for (let positionB = positionA + 1; positionB < options.candidateIndices.length; positionB += 1) {
				const indexB = options.candidateIndices[positionB]!;
				pairCount += 1;

				if (pairCount % 200 === 0) {
					console.log(
						`[${options.stage}] round ${round} progress: checkedPairs=${pairCount} best=${bestRoundScore?.pixelSimilarity.toFixed(6) ?? 'none'}`,
					);
				}

				for (const deltaA of pairwiseDeltaCandidates) {
					for (const deltaB of pairwiseDeltaCandidates) {
						const nextValues = [...options.pathState.currentValues];
						nextValues[indexA] += deltaA;
						nextValues[indexB] += deltaB;
						const nextState = materializePathState(options.pathState, nextValues);
						const nextStates = clonePathStates(options.pathStates);
						nextStates.set(options.pathState.pathId, nextState);
						const nextSvg = buildSvg(options.baseSvg, nextStates);
						const evaluation = await scoreSvg(nextSvg, options.referenceRaw);

						if (
							betterThan(evaluation.score, currentScore) &&
							(!bestRoundScore || betterThan(evaluation.score, bestRoundScore))
						) {
							bestRoundScore = evaluation.score;
							bestRoundValues = nextValues;
							bestMove = {
								deltaA,
								deltaB,
								indexA,
								indexB,
								pixelSimilarity: evaluation.score.pixelSimilarity,
								round,
								stage: options.stage,
							};
						}
					}
				}
			}
		}

		if (!bestRoundScore || !bestRoundValues || !bestMove) {
			break;
		}

		const acceptedState = materializePathState(options.pathState, bestRoundValues);
		options.pathState.currentValues = acceptedState.currentValues;
		options.pathState.currentD = acceptedState.currentD;
		options.pathStates.set(options.pathState.pathId, { ...options.pathState });
		currentSvg = buildSvg(options.baseSvg, options.pathStates);
		currentScore = bestRoundScore;
		logs.push({ ...bestMove, pixelSimilarity: currentScore.pixelSimilarity });
		console.log(
			`[${options.stage}] round ${round} accepted: indexes=${bestMove.indexA},${bestMove.indexB} deltas=${bestMove.deltaA},${bestMove.deltaB} pixelSimilarity=${currentScore.pixelSimilarity.toFixed(6)}`,
		);
	}

	return { logs, score: currentScore, svg: currentSvg };
};

const writeEvaluationOutputs = async (options: {
	diffPath: string;
	evaluation: Evaluation;
	renderedPath: string;
	reportPath: string;
	reportPayload: Record<string, unknown>;
	svg: string;
	svgPath: string;
}): Promise<void> => {
	await mkdir(dirname(options.svgPath), { recursive: true });
	await writeFile(options.svgPath, options.svg);
	await writeFile(options.renderedPath, options.evaluation.renderedPng);
	await writeFile(options.diffPath, PNG.sync.write(options.evaluation.diffPng));
	await writeFile(options.reportPath, `${JSON.stringify(options.reportPayload, null, 2)}\n`);
};

const main = async (): Promise<void> => {
	const baseSvg = await readFile(sourceSvgPath, 'utf8');
	const pairwiseBaseSvg = await readFile(sourceSingleDPath, 'utf8');
	const referenceRaw = await readRawImage(referencePngPath);
	const baseEvaluation = await scoreSvg(baseSvg, referenceRaw);
	const singleDBaseEvaluation = await scoreSvg(pairwiseBaseSvg, referenceRaw);
	const baseDState = createPathState(baseSvg, pairwisePathId);
	const singleDState = createPathState(pairwiseBaseSvg, pairwisePathId);
	const pairwiseCandidateIndices = findChangedIndices(baseDState.currentValues, singleDState.currentValues);

	console.log(
		JSON.stringify(
			{
				basePixelSimilarity: baseEvaluation.score.pixelSimilarity,
				pairwiseCandidateCount: pairwiseCandidateIndices.length,
				pairwiseCandidates: pairwiseCandidateIndices,
				singleDBasePixelSimilarity: singleDBaseEvaluation.score.pixelSimilarity,
			},
			null,
			2,
		),
	);

	const pairStates = new Map<string, PathState>([[pairwisePathId, createPathState(pairwiseBaseSvg, pairwisePathId)]]);
	const pairwiseResult = await pairwiseClimb({
		baseSvg: pairwiseBaseSvg,
		candidateIndices: pairwiseCandidateIndices,
		pathState: pairStates.get(pairwisePathId)!,
		pathStates: pairStates,
		referenceRaw,
		stage: 'pairwise-d',
		startScore: singleDBaseEvaluation.score,
	});
	const pairwiseEvaluation = await scoreSvg(pairwiseResult.svg, referenceRaw);

	await writeEvaluationOutputs({
		diffPath: pairwiseDiffPath,
		evaluation: pairwiseEvaluation,
		renderedPath: pairwiseRenderedPath,
		reportPath: pairwiseReportPath,
		reportPayload: {
			candidateIndices: pairwiseCandidateIndices,
			baseScore: singleDBaseEvaluation.score,
			finalD: pairStates.get(pairwisePathId)?.currentD,
			finalScore: pairwiseEvaluation.score,
			moves: pairwiseResult.logs,
			sourceSvgPath: sourceSingleDPath,
			stage: 'pairwise-d',
			tokenCount: pairStates.get(pairwisePathId)?.currentValues.length,
		},
		svg: pairwiseResult.svg,
		svgPath: pairwiseSvgPath,
	});

	const combinedStates = new Map<string, PathState>();
	for (const pathId of [pairwisePathId, ...singlePathIds]) {
		combinedStates.set(pathId, createPathState(pairwiseResult.svg, pathId));
	}

	let combinedScore = pairwiseEvaluation.score;
	let combinedSvg = pairwiseResult.svg;
	const singleLogs: MoveLog[] = [];

	for (const pathId of singlePathIds) {
		const pathState = combinedStates.get(pathId);
		if (!pathState) {
			throw new Error(`Missing state for path #${pathId}.`);
		}

		const result = await singleVariableClimb({
			baseSvg: pairwiseResult.svg,
			pathState,
			pathStates: combinedStates,
			referenceRaw,
			stage: `single-${pathId}`,
			startScore: combinedScore,
		});

		singleLogs.push(...result.logs);
		combinedScore = result.score;
		combinedSvg = result.svg;
	}

	const finalDPolishState = combinedStates.get(pairwisePathId);
	if (!finalDPolishState) {
		throw new Error(`Missing state for path #${pairwisePathId}.`);
	}

	const finalDPolish = await singleVariableClimb({
		baseSvg: pairwiseResult.svg,
		candidateIndices: pairwiseCandidateIndices,
		pathState: finalDPolishState,
		pathStates: combinedStates,
		referenceRaw,
		stage: 'single-d-polish',
		startScore: combinedScore,
	});

	singleLogs.push(...finalDPolish.logs);
	combinedSvg = finalDPolish.svg;
	const combinedEvaluation = await scoreSvg(combinedSvg, referenceRaw);

	await writeEvaluationOutputs({
		diffPath: combinedDiffPath,
		evaluation: combinedEvaluation,
		renderedPath: combinedRenderedPath,
		reportPath: combinedReportPath,
		reportPayload: {
			baseScore: baseEvaluation.score,
			combinedScore: combinedEvaluation.score,
			paths: Object.fromEntries(
				Array.from(combinedStates.entries()).map(([pathId, state]) => [
					pathId,
					{
						finalD: state.currentD,
						tokenCount: state.currentValues.length,
					},
				]),
			),
			pairwiseCandidateIndices,
			pairwiseDBaseScore: singleDBaseEvaluation.score,
			pairwiseDMoves: pairwiseResult.logs,
			pairwiseDScore: pairwiseEvaluation.score,
			singlePathMoves: singleLogs,
			sourceSvgPath,
		},
		svg: combinedSvg,
		svgPath: combinedSvgPath,
	});

	console.log(
		JSON.stringify(
			{
				basePixelSimilarity: baseEvaluation.score.pixelSimilarity,
				combinedPixelSimilarity: combinedEvaluation.score.pixelSimilarity,
				combinedSvgPath,
				pairwiseDPixelSimilarity: pairwiseEvaluation.score.pixelSimilarity,
				pairwiseSvgPath,
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
