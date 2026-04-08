import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

interface ExtractedPath {
	d: string;
	id: string;
}

const repoRoot = resolve(import.meta.dirname, '..', '..');
const nextDir = resolve(repoRoot, 'assets', 'next');
const sourceSvgPath = resolve(nextDir, 'svg', 'icon-bw.svg');
const sourcePngPath = resolve(nextDir, 'source', 'icon-bw.png');
const outputSvgPath = resolve(nextDir, 'svg', 'icon-bw-overlay.svg');

const overlayFillOpacity = 0.28;
const overlayStrokeOpacity = 0.95;
const overlayStrokeWidth = 2.5;

const extractViewBox = (svg: string): string => {
	const match = svg.match(/viewBox="([^"]+)"/);
	if (!match?.[1]) {
		throw new Error(`Missing viewBox in ${sourceSvgPath}`);
	}
	return match[1];
};

const extractPaths = (svg: string): ExtractedPath[] =>
	Array.from(svg.matchAll(/<path id="([^"]+)" d="([^"]+)"/g), (match) => {
		const id = match[1];
		const d = match[2];
		if (!id || !d) {
			throw new Error(`Invalid path entry in ${sourceSvgPath}`);
		}
		return { d, id };
	});

const colorForIndex = (index: number, total: number): string => {
	const hue = Math.round((index * 360) / Math.max(total, 1));
	const saturation = 82 - (index % 3) * 6;
	const lightness = 58 + (index % 2) * 6;
	return `hsl(${hue} ${saturation}% ${lightness}%)`;
};

const main = async (): Promise<void> => {
	const [svgSource, pngSource] = await Promise.all([
		readFile(sourceSvgPath, 'utf8'),
		readFile(sourcePngPath),
	]);
	const viewBox = extractViewBox(svgSource);
	const paths = extractPaths(svgSource);
	const pngBase64 = pngSource.toString('base64');

	const overlayPaths = paths
		.map(({ d, id }, index) => {
			const color = colorForIndex(index, paths.length);
			return `    <path id="${id}" d="${d}" fill="${color}" fill-opacity="${overlayFillOpacity}" stroke="${color}" stroke-opacity="${overlayStrokeOpacity}" stroke-width="${overlayStrokeWidth}" vector-effect="non-scaling-stroke"/>`;
		})
		.join('\n');

	const outputSvg = [
		`<svg width="1078" height="1078" viewBox="${viewBox}" xmlns="http://www.w3.org/2000/svg">`,
		`  <title>icon-bw overlay guide</title>`,
		`  <desc>Embedded black-and-white reference with semi-transparent per-path HSL overlay for manual path tuning.</desc>`,
		`  <image id="reference-bw" href="data:image/png;base64,${pngBase64}" x="0" y="0" width="1078" height="1078"/>`,
		`  <g id="vector-overlay">`,
		overlayPaths,
		`  </g>`,
		`</svg>`,
	].join('\n');

	await mkdir(dirname(outputSvgPath), { recursive: true });
	await writeFile(outputSvgPath, outputSvg);
	console.log(`Wrote ${outputSvgPath}`);
};

await main();
