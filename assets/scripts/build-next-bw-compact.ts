import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import sharp from 'sharp';
import { optimize } from 'svgo';

import { compareSvg } from '../next/scripts/compare-svg';

interface IconPathRecord {
	d: string;
	id: number;
}

interface FitTarget {
	angle: 0 | 90 | 180 | 270;
	targetId: number;
}

interface FitGroup {
	baseId: number;
	targets: FitTarget[];
}

interface Strategy {
	groups: FitGroup[];
	name: string;
	semanticBaseIds?: readonly number[];
}

interface FitResult {
	angle: 0 | 90 | 180 | 270;
	baseId: number;
	dx: number;
	dy: number;
	scale: number;
	similarity: number;
	targetId: number;
}

interface Point {
	t?: number;
	x: number;
	y: number;
}

interface CroppedMask {
	height: number;
	mask: Uint8Array;
	offsetX: number;
	offsetY: number;
	width: number;
}

interface ShapeFillDef {
	baseId: number;
	d: string;
	id: string;
	kind: 'fill';
}

interface ShapeStrokeDef {
	baseId: number;
	d: string;
	id: string;
	kind: 'stroke';
	strokeLinecap: 'butt' | 'round' | 'square';
	strokeLinejoin: 'bevel' | 'miter' | 'round';
	strokeWidth: number;
}

type ShapeDef = ShapeFillDef | ShapeStrokeDef;

interface SemanticStrokeCandidate {
	baseId: number;
	d: string;
	dBytes: number;
	pixelSimilarity: number;
	pointCount: number;
	sampleCount: number;
	simplifyEpsilon: number;
	snapThreshold: number;
	strokeLinecap: ShapeStrokeDef['strokeLinecap'];
	strokeLinejoin: ShapeStrokeDef['strokeLinejoin'];
	strokeWidth: number;
}

const canvasSize = 1078;
const center = 539;
const similarityScaleCandidates = [1, 0.995, 1.005, 0.99, 1.01] as const;
const translationRange = { max: 12, min: -12 };
const uniquePathIds = [1, 9, 10, 18, 19] as const;
const semanticBaseIds = [3, 5, 6, 7] as const;
const octilinearAngles = [0, 45, 90, 135, 180, 225, 270, 315] as const;
const semanticSampleCounts = [20, 22, 24, 26, 28, 30, 32] as const;
const semanticSnapThresholds = [6, 8, 10, 12, 15, 18, 25, 360] as const;
const semanticStrokeWidths = [23, 24, 25, 26, 27, 28] as const;
const semanticSimplifyEpsilons = [0.75, 1] as const;
const semanticLinecapCandidates = ['round', 'square', 'butt'] as const;
const semanticLinejoinCandidates = ['round', 'miter'] as const;

const repoRoot = resolve(import.meta.dirname, '..', '..');
const nextDir = resolve(repoRoot, 'assets', 'next');
const sourcePathsPath = resolve(nextDir, 'source', 'icon-bw-paths.json');
const outputSvgPath = resolve(nextDir, 'svg', 'icon-bw-compact.svg');
const outputFitPath = resolve(nextDir, 'out', 'icon-bw-compact-fit.json');

const baseStrategies: Strategy[] = [
	{
		name: 'single-affine',
		groups: [
			{ baseId: 2, targets: [{ angle: 180, targetId: 14 }] },
			{
				baseId: 3,
				targets: [
					{ angle: 90, targetId: 12 },
					{ angle: 180, targetId: 17 },
					{ angle: 270, targetId: 7 },
				],
			},
			{
				baseId: 5,
				targets: [
					{ angle: 90, targetId: 13 },
					{ angle: 180, targetId: 16 },
					{ angle: 270, targetId: 6 },
				],
			},
			{
				baseId: 4,
				targets: [
					{ angle: 90, targetId: 11 },
					{ angle: 180, targetId: 15 },
					{ angle: 270, targetId: 8 },
				],
			},
		],
	},
	{
		name: 'two-family-short',
		groups: [
			{ baseId: 2, targets: [{ angle: 180, targetId: 14 }] },
			{ baseId: 3, targets: [{ angle: 180, targetId: 17 }] },
			{ baseId: 12, targets: [{ angle: 180, targetId: 7 }] },
			{ baseId: 5, targets: [{ angle: 180, targetId: 16 }] },
			{ baseId: 13, targets: [{ angle: 180, targetId: 6 }] },
			{ baseId: 4, targets: [{ angle: 180, targetId: 15 }] },
			{ baseId: 11, targets: [{ angle: 180, targetId: 8 }] },
		],
	},
	{
		name: 'hybrid-outer-short',
		groups: [
			{ baseId: 2, targets: [{ angle: 180, targetId: 14 }] },
			{ baseId: 3, targets: [{ angle: 180, targetId: 17 }] },
			{ baseId: 12, targets: [{ angle: 180, targetId: 7 }] },
			{
				baseId: 5,
				targets: [
					{ angle: 90, targetId: 13 },
					{ angle: 180, targetId: 16 },
					{ angle: 270, targetId: 6 },
				],
			},
			{
				baseId: 4,
				targets: [
					{ angle: 90, targetId: 11 },
					{ angle: 180, targetId: 15 },
					{ angle: 270, targetId: 8 },
				],
			},
		],
	},
	{
		name: 'hybrid-inner-short',
		groups: [
			{ baseId: 2, targets: [{ angle: 180, targetId: 14 }] },
			{
				baseId: 3,
				targets: [
					{ angle: 90, targetId: 12 },
					{ angle: 180, targetId: 17 },
					{ angle: 270, targetId: 7 },
				],
			},
			{ baseId: 5, targets: [{ angle: 180, targetId: 16 }] },
			{ baseId: 13, targets: [{ angle: 180, targetId: 6 }] },
			{
				baseId: 4,
				targets: [
					{ angle: 90, targetId: 11 },
					{ angle: 180, targetId: 15 },
					{ angle: 270, targetId: 8 },
				],
			},
		],
	},
	{
		name: 'two-family-left',
		groups: [
			{ baseId: 2, targets: [{ angle: 180, targetId: 14 }] },
			{ baseId: 3, targets: [{ angle: 180, targetId: 17 }] },
			{ baseId: 7, targets: [{ angle: 180, targetId: 12 }] },
			{ baseId: 5, targets: [{ angle: 180, targetId: 16 }] },
			{ baseId: 6, targets: [{ angle: 180, targetId: 13 }] },
			{ baseId: 4, targets: [{ angle: 180, targetId: 15 }] },
			{ baseId: 8, targets: [{ angle: 180, targetId: 11 }] },
		],
	},
	{
		name: 'semantic-two-family-left-outer',
		semanticBaseIds: [3, 7],
		groups: [
			{ baseId: 2, targets: [{ angle: 180, targetId: 14 }] },
			{ baseId: 3, targets: [{ angle: 180, targetId: 17 }] },
			{ baseId: 7, targets: [{ angle: 180, targetId: 12 }] },
			{ baseId: 5, targets: [{ angle: 180, targetId: 16 }] },
			{ baseId: 6, targets: [{ angle: 180, targetId: 13 }] },
			{ baseId: 4, targets: [{ angle: 180, targetId: 15 }] },
			{ baseId: 8, targets: [{ angle: 180, targetId: 11 }] },
		],
	},
	{
		name: 'semantic-two-family-left-inner',
		semanticBaseIds: [5, 6],
		groups: [
			{ baseId: 2, targets: [{ angle: 180, targetId: 14 }] },
			{ baseId: 3, targets: [{ angle: 180, targetId: 17 }] },
			{ baseId: 7, targets: [{ angle: 180, targetId: 12 }] },
			{ baseId: 5, targets: [{ angle: 180, targetId: 16 }] },
			{ baseId: 6, targets: [{ angle: 180, targetId: 13 }] },
			{ baseId: 4, targets: [{ angle: 180, targetId: 15 }] },
			{ baseId: 8, targets: [{ angle: 180, targetId: 11 }] },
		],
	},
	{
		name: 'semantic-two-family-left-all',
		semanticBaseIds,
		groups: [
			{ baseId: 2, targets: [{ angle: 180, targetId: 14 }] },
			{ baseId: 3, targets: [{ angle: 180, targetId: 17 }] },
			{ baseId: 7, targets: [{ angle: 180, targetId: 12 }] },
			{ baseId: 5, targets: [{ angle: 180, targetId: 16 }] },
			{ baseId: 6, targets: [{ angle: 180, targetId: 13 }] },
			{ baseId: 4, targets: [{ angle: 180, targetId: 15 }] },
			{ baseId: 8, targets: [{ angle: 180, targetId: 11 }] },
		],
	},
];

const readIconPaths = async (): Promise<IconPathRecord[]> => {
	const source = await readFile(sourcePathsPath, 'utf8');
	return JSON.parse(source) as IconPathRecord[];
};

const createFillSvg = (d: string): string =>
	`<svg xmlns="http://www.w3.org/2000/svg" width="${canvasSize}" height="${canvasSize}" viewBox="0 0 ${canvasSize} ${canvasSize}"><path fill="#fff" d="${d}"/></svg>`;

const createShapeSvg = (shape: ShapeDef): string =>
	shape.kind === 'fill'
		? createFillSvg(shape.d)
		: `<svg xmlns="http://www.w3.org/2000/svg" width="${canvasSize}" height="${canvasSize}" viewBox="0 0 ${canvasSize} ${canvasSize}"><path fill="none" stroke="#fff" stroke-width="${shape.strokeWidth}" stroke-linecap="${shape.strokeLinecap}" stroke-linejoin="${shape.strokeLinejoin}" d="${shape.d}"/></svg>`;

const renderMask = async (svg: string): Promise<Uint8Array> => {
	const { data, info } = await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
	const width = info.width ?? canvasSize;
	const height = info.height ?? canvasSize;
	const mask = new Uint8Array(width * height);

	for (let pixelIndex = 0; pixelIndex < width * height; pixelIndex += 1) {
		mask[pixelIndex] = data[pixelIndex * 4] > 127 ? 1 : 0;
	}

	return mask;
};

const whitePixelIndices = (mask: Uint8Array): number[] => {
	const indices: number[] = [];
	for (let index = 0; index < mask.length; index += 1) {
		if (mask[index] === 1) {
			indices.push(index);
		}
	}
	return indices;
};

const cropMask = (mask: Uint8Array): CroppedMask => {
	let minX = canvasSize;
	let minY = canvasSize;
	let maxX = 0;
	let maxY = 0;

	for (let y = 0; y < canvasSize; y += 1) {
		for (let x = 0; x < canvasSize; x += 1) {
			if (mask[y * canvasSize + x] === 0) {
				continue;
			}

			minX = Math.min(minX, x);
			minY = Math.min(minY, y);
			maxX = Math.max(maxX, x);
			maxY = Math.max(maxY, y);
		}
	}

	const padding = 3;
	const offsetX = Math.max(0, minX - padding);
	const offsetY = Math.max(0, minY - padding);
	const width = Math.min(canvasSize - offsetX, maxX - minX + 1 + padding * 2);
	const height = Math.min(canvasSize - offsetY, maxY - minY + 1 + padding * 2);
	const cropped = new Uint8Array(width * height);

	for (let y = 0; y < height; y += 1) {
		for (let x = 0; x < width; x += 1) {
			cropped[y * width + x] = mask[(offsetY + y) * canvasSize + offsetX + x];
		}
	}

	return { height, mask: cropped, offsetX, offsetY, width };
};

const skeletonize = (sourceMask: Uint8Array, width: number, height: number): Uint8Array => {
	const mask = new Uint8Array(sourceMask);
	const indexFor = (x: number, y: number): number => y * width + x;
	const neighborIndices = (x: number, y: number): number[] => [
		indexFor(x, y - 1),
		indexFor(x + 1, y - 1),
		indexFor(x + 1, y),
		indexFor(x + 1, y + 1),
		indexFor(x, y + 1),
		indexFor(x - 1, y + 1),
		indexFor(x - 1, y),
		indexFor(x - 1, y - 1),
	];

	let changed = true;
	let iteration = 0;

	while (changed && iteration < 200) {
		changed = false;
		iteration += 1;

		for (let step = 0; step < 2; step += 1) {
			const removal: number[] = [];

			for (let y = 1; y < height - 1; y += 1) {
				for (let x = 1; x < width - 1; x += 1) {
					const pixelIndex = indexFor(x, y);
					if (mask[pixelIndex] === 0) {
						continue;
					}

					const neighbors = neighborIndices(x, y).map((currentIndex) => mask[currentIndex]);
					const neighborCount = neighbors.reduce((sum, value) => sum + value, 0);

					if (neighborCount < 2 || neighborCount > 6) {
						continue;
					}

					let transitions = 0;
					for (let current = 0; current < 8; current += 1) {
						if (neighbors[current] === 0 && neighbors[(current + 1) % 8] === 1) {
							transitions += 1;
						}
					}

					if (transitions !== 1) {
						continue;
					}

					const p2 = neighbors[0];
					const p4 = neighbors[2];
					const p6 = neighbors[4];
					const p8 = neighbors[6];

					if (step === 0) {
						if (p2 === 1 && p4 === 1 && p6 === 1) {
							continue;
						}

						if (p4 === 1 && p6 === 1 && p8 === 1) {
							continue;
						}
					} else {
						if (p2 === 1 && p4 === 1 && p8 === 1) {
							continue;
						}

						if (p2 === 1 && p6 === 1 && p8 === 1) {
							continue;
						}
					}

					removal.push(pixelIndex);
				}
			}

			if (removal.length > 0) {
				changed = true;
				for (const pixelIndex of removal) {
					mask[pixelIndex] = 0;
				}
			}
		}
	}

	return mask;
};

const extractLongestSkeletonPath = (mask: Uint8Array, width: number, height: number): Point[] => {
	const indexFor = (x: number, y: number): number => y * width + x;
	const nodes: number[] = [];

	for (let y = 1; y < height - 1; y += 1) {
		for (let x = 1; x < width - 1; x += 1) {
			if (mask[indexFor(x, y)] === 1) {
				nodes.push(indexFor(x, y));
			}
		}
	}

	const nodeSet = new Set(nodes);
	const neighborsOf = (pixelIndex: number): number[] => {
		const x = pixelIndex % width;
		const y = Math.floor(pixelIndex / width);
		const neighbors: number[] = [];

		for (let dy = -1; dy <= 1; dy += 1) {
			for (let dx = -1; dx <= 1; dx += 1) {
				if (dx === 0 && dy === 0) {
					continue;
				}

				const neighborIndex = indexFor(x + dx, y + dy);
				if (nodeSet.has(neighborIndex)) {
					neighbors.push(neighborIndex);
				}
			}
		}

		return neighbors;
	};

	const endpoints = nodes.filter((pixelIndex) => neighborsOf(pixelIndex).length === 1);
	const startNode = endpoints[0] ?? nodes[0];

	const bfs = (start: number) => {
		const queue = [start];
		const previous = new Map<number, number>();
		const distance = new Map<number, number>([[start, 0]]);
		let head = 0;
		let farthest = start;

		while (head < queue.length) {
			const current = queue[head];
			head += 1;
			const currentDistance = distance.get(current) ?? 0;

			if (currentDistance > (distance.get(farthest) ?? 0)) {
				farthest = current;
			}

			for (const neighbor of neighborsOf(current)) {
				if (distance.has(neighbor)) {
					continue;
				}

				distance.set(neighbor, currentDistance + 1);
				previous.set(neighbor, current);
				queue.push(neighbor);
			}
		}

		return { distance, farthest, previous };
	};

	const firstPass = bfs(startNode);
	const secondPass = bfs(firstPass.farthest);
	const ordered: Point[] = [];
	let cursor: number | undefined = secondPass.farthest;

	while (cursor !== undefined) {
		ordered.push({ x: cursor % width, y: Math.floor(cursor / width) });
		cursor = secondPass.previous.get(cursor);
	}

	ordered.reverse();
	return ordered;
};

const smoothPoints = (points: Point[], passes: number): Point[] => {
	let smoothed = points.map((point) => ({ x: point.x, y: point.y }));

	for (let pass = 0; pass < passes; pass += 1) {
		smoothed = smoothed.map((point, index, currentPoints) => {
			if (index === 0 || index === currentPoints.length - 1) {
				return point;
			}

			const prev = currentPoints[index - 1];
			const next = currentPoints[index + 1];
			return {
				x: (prev.x + point.x + next.x) / 3,
				y: (prev.y + point.y + next.y) / 3,
			};
		});
	}

	return smoothed;
};

const resamplePoints = (points: Point[], targetCount: number): Point[] => {
	const distances = [0];

	for (let index = 1; index < points.length; index += 1) {
		const dx = points[index].x - points[index - 1].x;
		const dy = points[index].y - points[index - 1].y;
		distances[index] = distances[index - 1] + Math.hypot(dx, dy);
	}

	const totalLength = distances[distances.length - 1];
	const sampled: Point[] = [];

	for (let step = 0; step < targetCount; step += 1) {
		const targetLength = (totalLength * step) / (targetCount - 1);
		let cursor = 1;

		while (cursor < distances.length && distances[cursor] < targetLength) {
			cursor += 1;
		}

		if (cursor >= distances.length) {
			sampled.push({ x: points[points.length - 1].x, y: points[points.length - 1].y });
			continue;
		}

		const startDistance = distances[cursor - 1];
		const endDistance = distances[cursor];
		const ratio = endDistance === startDistance ? 0 : (targetLength - startDistance) / (endDistance - startDistance);
		const start = points[cursor - 1];
		const end = points[cursor];

		sampled.push({
			x: start.x + (end.x - start.x) * ratio,
			y: start.y + (end.y - start.y) * ratio,
		});
	}

	return sampled;
};

const normalizeDegrees = (angle: number): number => {
	let normalized = angle;
	while (normalized < 0) {
		normalized += 360;
	}
	while (normalized >= 360) {
		normalized -= 360;
	}
	return normalized;
};

const nearestOctilinearAngle = (angle: number): { angle: number; diff: number } => {
	let bestAngle = octilinearAngles[0];
	let bestDiff = Number.POSITIVE_INFINITY;

	for (const allowedAngle of octilinearAngles) {
		const rawDiff = Math.abs(normalizeDegrees(angle - allowedAngle));
		const diff = Math.min(rawDiff, 360 - rawDiff);
		if (diff < bestDiff) {
			bestDiff = diff;
			bestAngle = allowedAngle;
		}
	}

	return { angle: bestAngle, diff: bestDiff };
};

const quantizePoints = (points: Point[], threshold: number): Point[] => {
	const segments: Array<{ angle: number; length: number }> = [];
	let totalLength = 0;

	for (let index = 0; index < points.length - 1; index += 1) {
		const dx = points[index + 1].x - points[index].x;
		const dy = points[index + 1].y - points[index].y;
		const length = Math.hypot(dx, dy);
		const rawAngle = normalizeDegrees((Math.atan2(dy, dx) * 180) / Math.PI);
		const snapped = nearestOctilinearAngle(rawAngle);

		segments.push({
			angle: snapped.diff <= threshold ? snapped.angle : rawAngle,
			length,
		});
		totalLength += length;
	}

	const quantized: Point[] = [{ x: points[0].x, y: points[0].y }];
	let accumulatedLength = 0;

	for (const segment of segments) {
		accumulatedLength += segment.length;
		const radians = (segment.angle * Math.PI) / 180;
		const prev = quantized[quantized.length - 1];
		quantized.push({
			t: accumulatedLength / totalLength,
			x: prev.x + Math.cos(radians) * segment.length,
			y: prev.y + Math.sin(radians) * segment.length,
		});
	}

	const targetEnd = points[points.length - 1];
	const actualEnd = quantized[quantized.length - 1];
	const errorX = targetEnd.x - actualEnd.x;
	const errorY = targetEnd.y - actualEnd.y;

	return quantized.map((point, index) => {
		const t = index === 0 ? 0 : index === quantized.length - 1 ? 1 : point.t ?? 0;
		return {
			x: point.x + errorX * t,
			y: point.y + errorY * t,
		};
	});
};

const simplifyPoints = (points: Point[], epsilon: number): Point[] => {
	const simplified: Point[] = [{ x: points[0].x, y: points[0].y }];

	for (let index = 1; index < points.length - 1; index += 1) {
		const prev = simplified[simplified.length - 1];
		const current = points[index];
		const next = points[index + 1];
		const prevDx = current.x - prev.x;
		const prevDy = current.y - prev.y;
		const nextDx = next.x - current.x;
		const nextDy = next.y - current.y;
		const angleDelta = Math.abs(Math.atan2(prevDx * nextDy - prevDy * nextDx, prevDx * nextDx + prevDy * nextDy));
		const cross = Math.abs((current.x - prev.x) * (next.y - prev.y) - (current.y - prev.y) * (next.x - prev.x));
		const chordLength = Math.hypot(next.x - prev.x, next.y - prev.y) || 1;
		const deviation = cross / chordLength;

		if (angleDelta < 0.05 || deviation < epsilon) {
			continue;
		}

		simplified.push({ x: current.x, y: current.y });
	}

	simplified.push({ x: points[points.length - 1].x, y: points[points.length - 1].y });
	return simplified;
};

const formatNumber = (value: number): string => {
	const rounded = Number.parseFloat(value.toFixed(3));
	return Number.isInteger(rounded) ? String(rounded) : String(rounded);
};

const pointsToPathData = (points: Point[], offsetX: number, offsetY: number): string =>
	points
		.map((point, index) => `${index === 0 ? 'M' : 'L'}${formatNumber(point.x + offsetX)} ${formatNumber(point.y + offsetY)}`)
		.join(' ');

const compareBinaryMasks = (left: Uint8Array, right: Uint8Array): number => {
	let differenceCount = 0;
	for (let index = 0; index < left.length; index += 1) {
		if (left[index] !== right[index]) {
			differenceCount += 1;
		}
	}
	return 1 - differenceCount / left.length;
};

const shapeByteSize = (shape: ShapeDef): number => {
	if (shape.kind === 'fill') {
		return Buffer.byteLength(shape.d);
	}
	return Buffer.byteLength(`${shape.d}|${shape.strokeWidth}|${shape.strokeLinecap}|${shape.strokeLinejoin}`);
};

const buildSemanticStrokeCandidate = async (basePath: IconPathRecord): Promise<SemanticStrokeCandidate> => {
	const baseMask = await renderMask(createFillSvg(basePath.d));
	const cropped = cropMask(baseMask);
	const skeleton = skeletonize(cropped.mask, cropped.width, cropped.height);
	const skeletonPath = extractLongestSkeletonPath(skeleton, cropped.width, cropped.height);
	const smoothedPath = smoothPoints(skeletonPath, 3);

	let bestCandidate: SemanticStrokeCandidate | null = null;

	for (const sampleCount of semanticSampleCounts) {
		const sampledPath = resamplePoints(smoothedPath, sampleCount);

		for (const snapThreshold of semanticSnapThresholds) {
			for (const simplifyEpsilon of semanticSimplifyEpsilons) {
				const simplifiedPath = simplifyPoints(quantizePoints(sampledPath, snapThreshold), simplifyEpsilon);
				const d = pointsToPathData(simplifiedPath, cropped.offsetX, cropped.offsetY);

				for (const strokeWidth of semanticStrokeWidths) {
					const provisionalShape: ShapeStrokeDef = {
						baseId: basePath.id,
						d,
						id: 'x',
						kind: 'stroke',
						strokeLinecap: 'round',
						strokeLinejoin: 'round',
						strokeWidth,
					};
					const candidateMask = await renderMask(createShapeSvg(provisionalShape));
					const pixelSimilarity = compareBinaryMasks(baseMask, candidateMask);
					const nextCandidate: SemanticStrokeCandidate = {
						baseId: basePath.id,
						d,
						dBytes: Buffer.byteLength(d),
						pixelSimilarity,
						pointCount: simplifiedPath.length,
						sampleCount,
						simplifyEpsilon,
						snapThreshold,
						strokeLinecap: 'round',
						strokeLinejoin: 'round',
						strokeWidth,
					};

					if (
						!bestCandidate ||
						nextCandidate.pixelSimilarity > bestCandidate.pixelSimilarity ||
						(nextCandidate.pixelSimilarity === bestCandidate.pixelSimilarity &&
							(nextCandidate.dBytes < bestCandidate.dBytes ||
								(nextCandidate.dBytes === bestCandidate.dBytes && nextCandidate.pointCount < bestCandidate.pointCount)))
					) {
						bestCandidate = nextCandidate;
					}
				}
			}
		}
	}

	if (!bestCandidate) {
		throw new Error(`Failed to build semantic stroke candidate for path ${basePath.id}.`);
	}

	for (const strokeLinecap of semanticLinecapCandidates) {
		for (const strokeLinejoin of semanticLinejoinCandidates) {
			const candidateShape: ShapeStrokeDef = {
				baseId: basePath.id,
				d: bestCandidate.d,
				id: 'x',
				kind: 'stroke',
				strokeLinecap,
				strokeLinejoin,
				strokeWidth: bestCandidate.strokeWidth,
			};
			const candidateMask = await renderMask(createShapeSvg(candidateShape));
			const pixelSimilarity = compareBinaryMasks(baseMask, candidateMask);
			const refinedCandidate: SemanticStrokeCandidate = {
				...bestCandidate,
				pixelSimilarity,
				strokeLinecap,
				strokeLinejoin,
			};

			if (
				refinedCandidate.pixelSimilarity > bestCandidate.pixelSimilarity ||
				(refinedCandidate.pixelSimilarity === bestCandidate.pixelSimilarity &&
					(refinedCandidate.dBytes < bestCandidate.dBytes ||
						(refinedCandidate.dBytes === bestCandidate.dBytes && refinedCandidate.pointCount < bestCandidate.pointCount)))
			) {
				bestCandidate = refinedCandidate;
			}
		}
	}

	return bestCandidate;
};

const transformMask = (
	indices: number[],
	angle: 0 | 90 | 180 | 270,
	dx: number,
	dy: number,
	scale: number,
): Uint8Array => {
	const output = new Uint8Array(canvasSize * canvasSize);

	for (const index of indices) {
		const x = index % canvasSize;
		const y = Math.floor(index / canvasSize);
		const localX = x - center;
		const localY = y - center;

		let rotatedX = localX;
		let rotatedY = localY;

		switch (angle) {
			case 90:
				rotatedX = -localY;
				rotatedY = localX;
				break;
			case 180:
				rotatedX = -localX;
				rotatedY = -localY;
				break;
			case 270:
				rotatedX = localY;
				rotatedY = -localX;
				break;
			case 0:
				break;
		}

		const finalX = Math.round(center + rotatedX * scale + dx);
		const finalY = Math.round(center + rotatedY * scale + dy);

		if (finalX >= 0 && finalX < canvasSize && finalY >= 0 && finalY < canvasSize) {
			output[finalY * canvasSize + finalX] = 1;
		}
	}

	return output;
};

const bestAffineFit = (baseIndices: number[], targetMask: Uint8Array, target: FitTarget, baseId: number): FitResult => {
	let best: FitResult = {
		angle: target.angle,
		baseId,
		dx: 0,
		dy: 0,
		scale: 1,
		similarity: 0,
		targetId: target.targetId,
	};

	for (const scale of similarityScaleCandidates) {
		for (let dx = translationRange.min; dx <= translationRange.max; dx += 1) {
			for (let dy = translationRange.min; dy <= translationRange.max; dy += 1) {
				const candidateMask = transformMask(baseIndices, target.angle, dx, dy, scale);
				const candidateSimilarity = compareBinaryMasks(candidateMask, targetMask);

				if (candidateSimilarity > best.similarity) {
					best = {
						angle: target.angle,
						baseId,
						dx,
						dy,
						scale,
						similarity: candidateSimilarity,
						targetId: target.targetId,
					};
				}
			}
		}
	}

	return best;
};

const transformMatrix = (angle: 0 | 90 | 180 | 270, dx: number, dy: number, scale: number): string | null => {
	const radians = (angle * Math.PI) / 180;
	const cos = Math.cos(radians);
	const sin = Math.sin(radians);
	const a = scale * cos;
	const b = scale * sin;
	const c = -scale * sin;
	const d = scale * cos;
	const e = center - a * center - c * center + dx;
	const f = center - b * center - d * center + dy;

	const isIdentity =
		Math.abs(a - 1) < 1e-9 &&
		Math.abs(b) < 1e-9 &&
		Math.abs(c) < 1e-9 &&
		Math.abs(d - 1) < 1e-9 &&
		Math.abs(e) < 1e-9 &&
		Math.abs(f) < 1e-9;

	if (isIdentity) {
		return null;
	}

	return `matrix(${formatNumber(a)} ${formatNumber(b)} ${formatNumber(c)} ${formatNumber(d)} ${formatNumber(e)} ${formatNumber(f)})`;
};

const shapeMarkup = (shape: ShapeDef): string =>
	shape.kind === 'fill'
		? `<path id="${shape.id}" d="${shape.d}"/>`
		: `<path id="${shape.id}" d="${shape.d}" fill="none" stroke="#fff" stroke-width="${shape.strokeWidth}" stroke-linecap="${shape.strokeLinecap}" stroke-linejoin="${shape.strokeLinejoin}"/>`;

const buildShapeDefs = (
	paths: IconPathRecord[],
	strategy: Strategy,
	semanticCandidates: Map<number, SemanticStrokeCandidate>,
): ShapeDef[] => {
	const pathById = new Map(paths.map((path) => [path.id, path]));
	return strategy.groups.map((group, index) => {
		const semanticCandidate = strategy.semanticBaseIds?.includes(group.baseId) ? semanticCandidates.get(group.baseId) : null;
		const id = String.fromCharCode(97 + index);

		if (semanticCandidate) {
			return {
				baseId: group.baseId,
				d: semanticCandidate.d,
				id,
				kind: 'stroke',
				strokeLinecap: semanticCandidate.strokeLinecap,
				strokeLinejoin: semanticCandidate.strokeLinejoin,
				strokeWidth: semanticCandidate.strokeWidth,
			};
		}

		const basePath = pathById.get(group.baseId);
		if (!basePath) {
			throw new Error(`Missing base path ${group.baseId}.`);
		}

		return {
			baseId: group.baseId,
			d: basePath.d,
			id,
			kind: 'fill',
		};
	});
};

const buildCompactSvg = (paths: IconPathRecord[], shapes: ShapeDef[], fits: FitResult[]): string => {
	const pathById = new Map(paths.map((path) => [path.id, path.d]));
	const defs = shapes.map(shapeMarkup).join('');
	const uniquePathData = uniquePathIds.map((id) => pathById.get(id) ?? '').join(' ');
	const uses: string[] = [];

	for (const shape of shapes) {
		uses.push(`<use href="#${shape.id}"/>`);

		for (const fit of fits.filter((currentFit) => currentFit.baseId === shape.baseId)) {
			const matrix = transformMatrix(fit.angle, fit.dx, fit.dy, fit.scale);
			uses.push(matrix ? `<use href="#${shape.id}" transform="${matrix}"/>` : `<use href="#${shape.id}"/>`);
		}
	}

	const rawSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${canvasSize}" height="${canvasSize}" viewBox="0 0 ${canvasSize} ${canvasSize}"><path d="M0 0h${canvasSize}v${canvasSize}H0z"/><defs>${defs}</defs><g fill="#fff"><path d="${uniquePathData}"/>${uses.join('')}</g></svg>`;

	return optimize(rawSvg, {
		multipass: true,
		plugins: [
			{
				name: 'preset-default',
				params: {
					overrides: {
						cleanupNumericValues: { floatPrecision: 3 },
						convertPathData: { floatPrecision: 3 },
					},
				},
			},
		],
	}).data;
};

const main = async (): Promise<void> => {
	const paths = await readIconPaths();
	const pathById = new Map(paths.map((path) => [path.id, path]));
	const semanticCandidates = new Map<number, SemanticStrokeCandidate>();
	const targetMaskCache = new Map<number, Uint8Array>();

	const loadTargetMask = async (pathId: number): Promise<Uint8Array> => {
		const cached = targetMaskCache.get(pathId);
		if (cached) {
			return cached;
		}

		const iconPath = pathById.get(pathId);
		if (!iconPath) {
			throw new Error(`Missing target path ${pathId}.`);
		}

		const mask = await renderMask(createFillSvg(iconPath.d));
		targetMaskCache.set(pathId, mask);
		return mask;
	};

	for (const pathId of semanticBaseIds) {
		const basePath = pathById.get(pathId);
		if (!basePath) {
			throw new Error(`Missing semantic base path ${pathId}.`);
		}

		semanticCandidates.set(pathId, await buildSemanticStrokeCandidate(basePath));
	}

	const strategySummaries: Array<Record<string, unknown>> = [];
	let bestOverallSummary: Record<string, unknown> | null = null;
	let bestOverallSimilarity = Number.NEGATIVE_INFINITY;
	let bestUnderLimitSummary: Record<string, unknown> | null = null;
	let bestUnderLimitScore = Number.NEGATIVE_INFINITY;
	let bestUnderLimitSvg = '';

	for (const strategy of baseStrategies) {
		const shapes = buildShapeDefs(paths, strategy, semanticCandidates);
		const localShapeMaskCache = new Map<string, { indices: number[]; mask: Uint8Array }>();
		const fitResults: FitResult[] = [];

		for (const group of strategy.groups) {
			const shape = shapes.find((currentShape) => currentShape.baseId === group.baseId);
			if (!shape) {
				throw new Error(`Missing shape for base ${group.baseId}.`);
			}

			const cacheKey =
				shape.kind === 'fill'
					? `fill:${shape.baseId}`
					: `stroke:${shape.baseId}:${shape.d}:${shape.strokeWidth}:${shape.strokeLinecap}:${shape.strokeLinejoin}`;
			let cachedShape = localShapeMaskCache.get(cacheKey);

			if (!cachedShape) {
				const mask = await renderMask(createShapeSvg(shape));
				cachedShape = { indices: whitePixelIndices(mask), mask };
				localShapeMaskCache.set(cacheKey, cachedShape);
			}

			for (const target of group.targets) {
				const targetMask = await loadTargetMask(target.targetId);
				fitResults.push(bestAffineFit(cachedShape.indices, targetMask, target, group.baseId));
			}
		}

		const compactSvg = buildCompactSvg(paths, shapes, fitResults);
		const svgPath = resolve(nextDir, 'out', `${strategy.name}.svg`);
		const renderedPath = resolve(nextDir, 'out', `${strategy.name}.rendered.png`);
		const diffPath = resolve(nextDir, 'out', `${strategy.name}.diff.png`);
		const reportPath = resolve(nextDir, 'out', `${strategy.name}.report.json`);

		await writeFile(svgPath, compactSvg);
		const report = await compareSvg({
			diffPath,
			metric: 'pixel',
			outPath: renderedPath,
			referencePath: 'source/icon-bw.png',
			reportPath,
			svgPath,
			threshold: 99.8,
		});

		const outputBytes = Buffer.byteLength(compactSvg);
		const summary = {
			fits: fitResults,
			name: strategy.name,
			outputBytes,
			outputSvgPath: svgPath,
			report,
			semanticBaseIds: strategy.semanticBaseIds ?? [],
		};

		strategySummaries.push(summary);

		if (report.metrics.pixelSimilarity > bestOverallSimilarity) {
			bestOverallSimilarity = report.metrics.pixelSimilarity;
			bestOverallSummary = summary;
		}

		if (outputBytes <= 2048 && report.metrics.pixelSimilarity > bestUnderLimitScore) {
			bestUnderLimitScore = report.metrics.pixelSimilarity;
			bestUnderLimitSummary = summary;
			bestUnderLimitSvg = compactSvg;
		}
	}

	if (!bestOverallSummary || !bestUnderLimitSummary) {
		throw new Error('No compact strategy was produced.');
	}

	await mkdir(dirname(outputSvgPath), { recursive: true });
	await mkdir(dirname(outputFitPath), { recursive: true });
	await writeFile(outputSvgPath, bestUnderLimitSvg);
	await writeFile(
		outputFitPath,
		`${JSON.stringify(
			{
				bestOverall: bestOverallSummary,
				bestUnder2kb: bestUnderLimitSummary,
				semanticCandidates: Array.from(semanticCandidates.values()),
				strategies: strategySummaries,
			},
			null,
			2,
		)}\n`,
	);

	console.log(
		JSON.stringify(
			{
				bestOverall: {
					name: bestOverallSummary.name,
					outputBytes: bestOverallSummary.outputBytes,
					pixelSimilarity: (
						bestOverallSummary.report as { metrics: { pixelSimilarity: number } }
					).metrics.pixelSimilarity,
				},
				bestUnder2kb: {
					name: bestUnderLimitSummary.name,
					outputBytes: bestUnderLimitSummary.outputBytes,
					pixelSimilarity: (
						bestUnderLimitSummary.report as { metrics: { pixelSimilarity: number } }
					).metrics.pixelSimilarity,
				},
				semanticCandidates: Array.from(semanticCandidates.values()).map((candidate) => ({
					baseId: candidate.baseId,
					pointCount: candidate.pointCount,
					pixelSimilarity: candidate.pixelSimilarity,
					strokeWidth: candidate.strokeWidth,
					snapThreshold: candidate.snapThreshold,
				})),
				strategies: strategySummaries.map((summary) => ({
					name: summary.name,
					outputBytes: summary.outputBytes,
					pixelSimilarity: (summary.report as { metrics: { pixelSimilarity: number } }).metrics.pixelSimilarity,
				})),
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
