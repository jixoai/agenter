import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import sharp from 'sharp';
import { optimize } from 'svgo';

import {
	createRenderInput,
	type IconBackgroundToken,
	type IconComposerConfig,
	type IconPaletteToken,
	type IconPreset,
	type IconSlotKind,
	type IconSlotPreset,
	parseGeometryFromSvg,
	renderIconSvg,
} from '@agenter/icon-studio';

const repoRoot = resolve(import.meta.dirname, '..', '..');
const nextDir = resolve(repoRoot, 'assets', 'next');
const mastersDir = resolve(nextDir, 'masters');
const tokensDir = resolve(nextDir, 'tokens');
const presetsDir = resolve(nextDir, 'presets');
const masterPngDir = resolve(repoRoot, 'assets', 'source', 'master');
const outputCanvas = 1536;

type RawImage = {
	data: Buffer;
	info: {
		channels: number;
		height: number;
		width: number;
	};
};

const loadJson = async <TValue>(filePath: string): Promise<TValue> =>
	JSON.parse(await readFile(filePath, 'utf8')) as TValue;

const loadPresets = async (): Promise<IconPreset[]> => {
	const filenames = (await readdir(presetsDir)).filter((filename) => filename.endsWith('.json')).sort();
	return Promise.all(filenames.map((filename) => loadJson<IconPreset>(resolve(presetsDir, filename))));
};

const ensureCleanDir = async (dirPath: string): Promise<void> => {
	await rm(dirPath, { force: true, recursive: true });
	await mkdir(dirPath, { recursive: true });
};

const writeOptimizedSvg = async (outputPath: string, svg: string): Promise<void> => {
	await mkdir(dirname(outputPath), { recursive: true });
	await writeFile(outputPath, `${optimize(svg, { multipass: true }).data}\n`, 'utf8');
};

const renderSvgBuffer = async (svg: string, includeAlpha = true): Promise<Buffer> =>
	sharp(Buffer.from(svg))
		.resize(outputCanvas, outputCanvas)
		.png({ compressionLevel: 9 })
		.ensureAlpha(includeAlpha ? 1 : undefined)
		.toBuffer();

const readRaw = async (pngBuffer: Buffer): Promise<RawImage> =>
	(await sharp(pngBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true })) as RawImage;

const findAlphaBounds = (rawImage: RawImage): { height: number; width: number; x: number; y: number } | null => {
	const alphaIndex = rawImage.info.channels - 1;
	let minX = rawImage.info.width;
	let minY = rawImage.info.height;
	let maxX = -1;
	let maxY = -1;

	for (let y = 0; y < rawImage.info.height; y += 1) {
		for (let x = 0; x < rawImage.info.width; x += 1) {
			const offset = (y * rawImage.info.width + x) * rawImage.info.channels + alphaIndex;
			const alpha = rawImage.data[offset] ?? 0;
			if (alpha === 0) {
				continue;
			}
			minX = Math.min(minX, x);
			minY = Math.min(minY, y);
			maxX = Math.max(maxX, x);
			maxY = Math.max(maxY, y);
		}
	}

	if (maxX < minX || maxY < minY) {
		return null;
	}

	return {
		height: maxY - minY + 1,
		width: maxX - minX + 1,
		x: minX,
		y: minY,
	};
};

const composeCenteredForeground = async (pngBuffer: Buffer, targetBox: number): Promise<Buffer> => {
	const rawImage = await readRaw(pngBuffer);
	const bounds = findAlphaBounds(rawImage);
	if (!bounds) {
		return sharp({
			create: {
				background: { alpha: 0, b: 0, g: 0, r: 0 },
				channels: 4,
				height: outputCanvas,
				width: outputCanvas,
			},
		})
			.png()
			.toBuffer();
	}

	const extracted = await sharp(pngBuffer)
		.extract({
			height: bounds.height,
			left: bounds.x,
			top: bounds.y,
			width: bounds.width,
		})
		.resize(targetBox, targetBox, { fit: 'inside' })
		.png()
		.toBuffer();
	const metadata = await sharp(extracted).metadata();
	const width = metadata.width ?? targetBox;
	const height = metadata.height ?? targetBox;
	const left = Math.floor((outputCanvas - width) / 2);
	const top = Math.floor((outputCanvas - height) / 2);

	return sharp({
		create: {
			background: { alpha: 0, b: 0, g: 0, r: 0 },
			channels: 4,
			height: outputCanvas,
			width: outputCanvas,
		},
	})
		.composite([{ input: extracted, left, top }])
		.png({ compressionLevel: 9 })
		.toBuffer();
};

const solidCanvas = async (hexColor: string): Promise<Buffer> =>
	sharp({
		create: {
			background: hexColor,
			channels: 4,
			height: outputCanvas,
			width: outputCanvas,
		},
	})
		.png({ compressionLevel: 9 })
		.toBuffer();

const writePng = async (outputPath: string, buffer: Buffer): Promise<void> => {
	await mkdir(dirname(outputPath), { recursive: true });
	await writeFile(outputPath, buffer);
};

const loadSystem = async () => {
	const [backgrounds, palettes, slotCatalog, presets, geometrySvg] = await Promise.all([
		loadJson<IconBackgroundToken[]>(resolve(tokensDir, 'backgrounds.json')),
		loadJson<IconPaletteToken[]>(resolve(tokensDir, 'palettes.json')),
		loadJson<Record<IconSlotKind, IconSlotPreset[]>>(resolve(tokensDir, 'slots.json')),
		loadPresets(),
		readFile(resolve(nextDir, 'icon-bw.svg'), 'utf8'),
	]);

	return {
		backgrounds,
		geometry: parseGeometryFromSvg(geometrySvg),
		palettes,
		presets,
		slotCatalog,
	};
};

const renderPresetSvg = (
	config: IconComposerConfig,
	system: Awaited<ReturnType<typeof loadSystem>>,
	includeBackground = true,
): string =>
	renderIconSvg(
		createRenderInput({
			backgrounds: system.backgrounds,
			config,
			geometry: system.geometry,
			includeBackground,
			palettes: system.palettes,
			slotCatalog: system.slotCatalog,
		}),
	);

const resolvePresetConfig = (preset: IconPreset): IconComposerConfig => ({
	backgroundToken: preset.backgroundToken,
	family: preset.family,
	paletteToken: preset.paletteToken,
	slots: preset.slots,
	theme: preset.theme,
});

const buildThemeMasterSet = async (
	themeName: 'dark' | 'light',
	config: IconComposerConfig,
	system: Awaited<ReturnType<typeof loadSystem>>,
	faviconConfig: IconComposerConfig,
): Promise<void> => {
	const themeDir = resolve(masterPngDir, themeName);
	await ensureCleanDir(themeDir);

	const withBackgroundSvg = renderPresetSvg(config, system, true);
	const transparentSvg = renderPresetSvg(config, system, false);
	const faviconSvg = renderPresetSvg(faviconConfig, system, false);
	const palette = system.palettes.find((entry) => entry.id === config.paletteToken);
	const background = system.backgrounds.find((entry) => entry.id === config.backgroundToken);
	if (!palette || !background) {
		throw new Error(`Missing palette/background for theme set: ${themeName}`);
	}

	const fullCanvas = await renderSvgBuffer(withBackgroundSvg);
	const foreground = await composeCenteredForeground(await renderSvgBuffer(transparentSvg), 1180);
	const foregroundCompact = await composeCenteredForeground(await renderSvgBuffer(transparentSvg), 1280);
	const favicon = await composeCenteredForeground(await renderSvgBuffer(faviconSvg), 1320);
	const adaptiveForeground = await composeCenteredForeground(await renderSvgBuffer(transparentSvg), 1200);
	const adaptiveBackground = await solidCanvas(background.color);

	await Promise.all([
		writePng(resolve(themeDir, 'icon-core.png'), foreground),
		writePng(resolve(themeDir, 'icon-core-compact.png'), foregroundCompact),
		writePng(resolve(themeDir, 'favicon-source.png'), favicon),
		writePng(resolve(themeDir, 'icon-tile.png'), fullCanvas),
		writePng(resolve(themeDir, 'icon-maskable.png'), fullCanvas),
		writePng(resolve(themeDir, 'android-adaptive-background.png'), adaptiveBackground),
		writePng(resolve(themeDir, 'android-adaptive-foreground.png'), adaptiveForeground),
	]);

	const defaultCopies = themeName === 'light';
	if (defaultCopies) {
		await Promise.all([
			writePng(resolve(masterPngDir, 'icon-core.png'), foreground),
			writePng(resolve(masterPngDir, 'icon-core-compact.png'), foregroundCompact),
			writePng(resolve(masterPngDir, 'favicon-source.png'), favicon),
			writePng(resolve(masterPngDir, 'icon-tile.png'), fullCanvas),
			writePng(resolve(masterPngDir, 'icon-maskable.png'), fullCanvas),
			writePng(resolve(masterPngDir, 'android-adaptive-background.png'), adaptiveBackground),
			writePng(resolve(masterPngDir, 'android-adaptive-foreground.png'), adaptiveForeground),
		]);
	}

	await writeFile(
		resolve(themeDir, 'manifest.json'),
		`${JSON.stringify(
			{
				backgroundToken: background.id,
				centerSymbol: config.slots.center,
				faviconSourceTheme: faviconConfig.theme,
				paletteToken: palette.id,
				presetTheme: themeName,
			},
			null,
			2,
		)}\n`,
		'utf8',
	);
};

const main = async (): Promise<void> => {
	const system = await loadSystem();
	const presetMap = Object.fromEntries(system.presets.map((preset) => [preset.id, preset])) as Record<string, IconPreset>;
	const presetIds = Object.keys(presetMap).sort();

	await ensureCleanDir(mastersDir);

	for (const presetId of presetIds) {
		const preset = presetMap[presetId]!;
		const svg = renderPresetSvg(resolvePresetConfig(preset), system, true);
		await writeOptimizedSvg(resolve(mastersDir, `${preset.id}.svg`), svg);
	}

	const brandDark = presetMap['brand-dark'];
	const brandLight = presetMap['brand-light'];
	const monoDark = presetMap['mono-dark'];
	const monoLight = presetMap['mono-light'];
	if (!brandDark || !brandLight || !monoDark || !monoLight) {
		throw new Error('Missing one or more canonical icon presets');
	}

	await mkdir(masterPngDir, { recursive: true });
	await buildThemeMasterSet('dark', resolvePresetConfig(brandDark), system, resolvePresetConfig(monoDark));
	await buildThemeMasterSet('light', resolvePresetConfig(brandLight), system, resolvePresetConfig(monoLight));
};

main().catch((error: unknown) => {
	console.error(error);
	process.exitCode = 1;
});
