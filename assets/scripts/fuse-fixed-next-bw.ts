import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

interface CliOptions {
	fixed: string;
	out: string;
	report: string;
	source: string;
}

interface SvgPath {
	d: string;
	id: string;
}

const repoRoot = resolve(import.meta.dirname, '..', '..');
const nextDir = resolve(repoRoot, 'assets', 'next');

const defaultOptions: CliOptions = {
	fixed: '/Users/kzf/Documents/fixed.svg',
	out: resolve(nextDir, 'svg', 'icon-bw-fused-from-fixed.svg'),
	report: resolve(nextDir, 'out', 'icon-bw-fused-from-fixed.merge.json'),
	source: resolve(nextDir, 'svg', 'icon-bw.svg'),
};

const parseArgs = (argv: string[]): CliOptions => {
	const options = { ...defaultOptions };

	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];
		const value = argv[index + 1];
		if (!arg?.startsWith('--')) {
			continue;
		}
		if (!value) {
			throw new Error(`Missing value for ${arg}`);
		}
		switch (arg) {
			case '--fixed':
				options.fixed = resolve(value);
				index += 1;
				break;
			case '--out':
				options.out = resolve(value);
				index += 1;
				break;
			case '--report':
				options.report = resolve(value);
				index += 1;
				break;
			case '--source':
				options.source = resolve(value);
				index += 1;
				break;
			default:
				throw new Error(`Unknown argument: ${arg}`);
		}
	}

	return options;
};

const extractSvgRoot = (svg: string): { height: string; viewBox: string; width: string } => {
	const svgTagMatch = svg.match(/<svg\b([^>]*)>/);
	if (!svgTagMatch?.[1]) {
		throw new Error('Missing root <svg> tag.');
	}
	const attrs = svgTagMatch[1];
	const width = attrs.match(/\bwidth="([^"]+)"/)?.[1] ?? '1078';
	const height = attrs.match(/\bheight="([^"]+)"/)?.[1] ?? '1078';
	const viewBox = attrs.match(/\bviewBox="([^"]+)"/)?.[1] ?? `0 0 ${width} ${height}`;
	return { height, viewBox, width };
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

const main = async (): Promise<void> => {
	const options = parseArgs(process.argv.slice(2));
	const [sourceSvg, fixedSvg] = await Promise.all([
		readFile(options.source, 'utf8'),
		readFile(options.fixed, 'utf8'),
	]);

	const sourceRoot = extractSvgRoot(sourceSvg);
	const sourcePaths = extractPaths(sourceSvg);
	const fixedPathMap = new Map(extractPaths(fixedSvg).map((path) => [path.id, path.d]));

	const changedPathIds: string[] = [];
	const mergedPaths = sourcePaths.map(({ d, id }) => {
		const fixedD = fixedPathMap.get(id);
		if (fixedD && fixedD !== d) {
			changedPathIds.push(id);
			return { d: fixedD, id };
		}
		return { d, id };
	});

	const mergedSvg = [
		`<svg width="${sourceRoot.width}" height="${sourceRoot.height}" viewBox="${sourceRoot.viewBox}" xmlns="http://www.w3.org/2000/svg">`,
		`  <rect width="${sourceRoot.width}" height="${sourceRoot.height}" fill="#000"/>`,
		...mergedPaths.map(({ d, id }) => `  <path id="${id}" d="${d}" fill="#fff"/>`),
		`</svg>`,
	].join('\n');

	const report = {
		changedPathIds,
		fixed: options.fixed,
		out: options.out,
		source: options.source,
		totalPathCount: mergedPaths.length,
	};

	await mkdir(dirname(options.out), { recursive: true });
	await mkdir(dirname(options.report), { recursive: true });
	await writeFile(options.out, mergedSvg);
	await writeFile(options.report, `${JSON.stringify(report, null, 2)}\n`);

	console.log(JSON.stringify(report, null, 2));
};

await main();
