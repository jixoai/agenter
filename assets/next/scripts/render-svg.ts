import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { parseArgs } from 'node:util';

import sharp from 'sharp';

const rootDir = resolve(import.meta.dirname, '..');

export interface RenderSvgOptions {
	height?: number;
	pngPath?: string;
	svgPath?: string;
	width?: number;
}

export interface RenderSvgResult {
	height: number;
	pngPath: string;
	svgPath: string;
	width: number;
}

export async function renderSvgToPng(options: RenderSvgOptions = {}): Promise<RenderSvgResult> {
	const svgPath = resolve(rootDir, options.svgPath ?? 'svg/icon.svg');
	const pngPath = resolve(rootDir, options.pngPath ?? 'out/icon.rendered.png');

	const metadata = await sharp(svgPath).metadata();
	const width = options.width ?? metadata.width ?? 1078;
	const height = options.height ?? metadata.height ?? 1078;

	await mkdir(dirname(pngPath), { recursive: true });

	await sharp(svgPath).resize(width, height).png().toFile(pngPath);

	return { svgPath, pngPath, width, height };
}

if (import.meta.main) {
	const parsed = parseArgs({
		args: process.argv.slice(2),
		options: {
			height: { type: 'string' },
			out: { type: 'string' },
			svg: { type: 'string' },
			width: { type: 'string' },
		},
		strict: true,
	});

	const width = parsed.values.width ? Number.parseInt(parsed.values.width, 10) : undefined;
	const height = parsed.values.height ? Number.parseInt(parsed.values.height, 10) : undefined;

	const result = await renderSvgToPng({
		height,
		pngPath: parsed.values.out,
		svgPath: parsed.values.svg,
		width,
	});

	console.log(JSON.stringify(result, null, 2));
}
