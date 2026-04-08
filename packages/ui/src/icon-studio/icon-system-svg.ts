import {
	CUSTOM_SLOT_ID,
	ICON_CANVAS_SIZE,
	ICON_GROUPS,
	SLOT_BOUNDS,
	type IconBackgroundToken,
	type IconComposerConfig,
	type IconGeometry,
	type IconGradientSpec,
	type IconPaletteToken,
	type IconRenderInput,
	type IconSlotKind,
	type IconSlotPreset,
	type SlotBounds,
} from './icon-system-contract';

interface RgbColor {
	b: number;
	g: number;
	r: number;
}

interface HslColor {
	h: number;
	l: number;
	s: number;
}

type SvgAssetMap<TValue extends { id: string }> = Record<string, TValue>;

const DEFAULT_SLOT_PADDING: Record<IconSlotKind, number> = {
	bottomRight: 0.14,
	center: 0.2,
	topLeft: 0.14,
};

const SLOT_PATH_EXCLUSIONS: Record<IconSlotKind, Set<string>> = {
	bottomRight: new Set(['p18', 'p19']),
	center: new Set<string>(),
	topLeft: new Set(['p1']),
};

const clampByte = (value: number): number => Math.max(0, Math.min(255, Math.round(value)));

const hexToRgb = (hex: string): RgbColor => {
	const normalized = hex.replace('#', '');
	if (normalized.length !== 6) {
		throw new Error(`Invalid hex color: ${hex}`);
	}

	return {
		b: Number.parseInt(normalized.slice(4, 6), 16),
		g: Number.parseInt(normalized.slice(2, 4), 16),
		r: Number.parseInt(normalized.slice(0, 2), 16),
	};
};

const rgbToHex = (rgb: RgbColor): string =>
	`#${[rgb.r, rgb.g, rgb.b].map((channel) => clampByte(channel).toString(16).padStart(2, '0')).join('')}`;

const rgbToHsl = (rgb: RgbColor): HslColor => {
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

	const saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
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
};

const hueToRgb = (p: number, q: number, t: number): number => {
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
};

const hslToRgb = (hsl: HslColor): RgbColor => {
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
};

const interpolateHue = (left: HslColor, right: HslColor, amount: number): number => {
	if (left.s === 0) {
		return right.h;
	}
	if (right.s === 0) {
		return left.h;
	}
	const delta = ((((right.h - left.h) % 360) + 540) % 360) - 180;
	return (((left.h + delta * amount) % 360) + 360) % 360;
};

const mixHex = (leftHex: string, rightHex: string, amount: number): string => {
	const leftHsl = rgbToHsl(hexToRgb(leftHex));
	const rightHsl = rgbToHsl(hexToRgb(rightHex));
	return rgbToHex(
		hslToRgb({
			h: interpolateHue(leftHsl, rightHsl, amount),
			l: leftHsl.l + (rightHsl.l - leftHsl.l) * amount,
			s: leftHsl.s + (rightHsl.s - leftHsl.s) * amount,
		}),
	);
};

const gradientLineFromAngle = (angle: number) => {
	const radians = (angle * Math.PI) / 180;
	const radius = 574;
	const center = ICON_CANVAS_SIZE / 2;
	const dx = Math.cos(radians) * radius;
	const dy = Math.sin(radians) * radius;
	return {
		x1: Number((center - dx).toFixed(3)),
		x2: Number((center + dx).toFixed(3)),
		y1: Number((center - dy).toFixed(3)),
		y2: Number((center + dy).toFixed(3)),
	};
};

const createGradient = (id: string, gradient: IconGradientSpec): string => {
	const line = gradientLineFromAngle(gradient.angle);
	const middleOffset = `${Math.round((gradient.middleOffset ?? 0.48) * 100)}%`;
	const middleColor =
		gradient.start.toLowerCase() === gradient.end.toLowerCase()
			? gradient.start
			: mixHex(gradient.start, gradient.end, 0.5);

	return `<linearGradient id="${id}" x1="${line.x1}" y1="${line.y1}" x2="${line.x2}" y2="${line.y2}" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="${gradient.start}"/><stop offset="${middleOffset}" stop-color="${middleColor}"/><stop offset="100%" stop-color="${gradient.end}"/></linearGradient>`;
};

const createClipPath = (slot: IconSlotKind, bounds: SlotBounds): string =>
	`<clipPath id="clip-${slot}"><rect x="${bounds.x}" y="${bounds.y}" width="${bounds.width}" height="${bounds.height}" rx="${bounds.radius}" ry="${bounds.radius}"/></clipPath>`;

const extractCenterPanelD = (frameD: string): string => {
	const match = frameD.match(/Z\s+(M.*)$/u);
	if (!match?.[1]) {
		throw new Error('Unable to derive center panel path from p10');
	}
	return match[1];
};

const extractNumericTuple = (raw: string): [number, number, number, number] | null => {
	const values = raw
		.trim()
		.split(/[\s,]+/u)
		.map((part) => Number.parseFloat(part))
		.filter((value) => Number.isFinite(value));

	return values.length === 4 ? [values[0]!, values[1]!, values[2]!, values[3]!] : null;
};

const unwrapSvgMarkup = (markup: string): { inner: string; viewBox: [number, number, number, number] | null } => {
	const svgMatch = markup.match(/<svg[^>]*viewBox="([^"]+)"[^>]*>([\s\S]*?)<\/svg>/iu);
	if (!svgMatch) {
		return { inner: markup, viewBox: null };
	}
	return {
		inner: svgMatch[2] ?? '',
		viewBox: extractNumericTuple(svgMatch[1] ?? ''),
	};
};

const fitMarkupToBounds = (
	slot: IconSlotKind,
	markup: string,
	viewBox: [number, number, number, number],
	bounds: SlotBounds,
	color: string,
	padding = 0.16,
): string => {
	const [minX, minY, width, height] = viewBox;
	if (width <= 0 || height <= 0) {
		return '';
	}

	const availableWidth = bounds.width * (1 - padding * 2);
	const availableHeight = bounds.height * (1 - padding * 2);
	const scale = Math.min(availableWidth / width, availableHeight / height);
	const dx = bounds.x + (bounds.width - width * scale) / 2 - minX * scale;
	const dy = bounds.y + (bounds.height - height * scale) / 2 - minY * scale;

	return `<g clip-path="url(#clip-${slot})" color="${color}" fill="${color}" stroke="${color}" transform="translate(${dx.toFixed(3)} ${dy.toFixed(3)}) scale(${scale.toFixed(5)})">${markup}</g>`;
};

const resolveSlotMarkup = (
	slot: IconSlotKind,
	slotId: string,
	customMarkup: string | undefined,
	slotCatalog: SvgAssetMap<IconSlotPreset>,
	bounds: SlotBounds,
	color: string,
): string => {
	if (slotId === CUSTOM_SLOT_ID) {
		if (!customMarkup?.trim()) {
			return '';
		}
		const customSvg = unwrapSvgMarkup(customMarkup);
		return fitMarkupToBounds(
			slot,
			customSvg.inner,
			customSvg.viewBox ?? [0, 0, bounds.width, bounds.height],
			bounds,
			color,
			DEFAULT_SLOT_PADDING[slot],
		);
	}

	const preset = slotCatalog[slotId];
	if (!preset || !preset.markup.trim()) {
		return '';
	}

	return fitMarkupToBounds(slot, preset.markup, preset.viewBox, bounds, color, DEFAULT_SLOT_PADDING[slot]);
};

const renderPathGroup = (
	pathIds: readonly string[],
	geometry: IconGeometry,
	fill: string,
	exclusions?: Set<string>,
	stroke?: { color: string; width: number },
): string =>
	pathIds
		.filter((pathId) => !exclusions?.has(pathId))
		.map((pathId) => {
			const d = geometry.paths[pathId];
			if (!d) {
				throw new Error(`Missing geometry path: ${pathId}`);
			}
			const strokeAttributes = stroke ? ` stroke="${stroke.color}" stroke-width="${stroke.width}"` : '';
			return `<path d="${d}" fill="${fill}"${strokeAttributes}/>`;
		})
		.join('');

const normalizeMap = <TValue extends { id: string }>(items: TValue[]): SvgAssetMap<TValue> =>
	Object.fromEntries(items.map((item) => [item.id, item]));

export const parseGeometryFromSvg = (sourceSvg: string): IconGeometry => {
	const viewBoxMatch = sourceSvg.match(/viewBox="([^"]+)"/u);
	const tuple = extractNumericTuple(viewBoxMatch?.[1] ?? '');
	if (!tuple) {
		throw new Error('Unable to parse icon viewBox');
	}

	const paths = Object.fromEntries(
		Array.from(sourceSvg.matchAll(/<path[^>]*id="([^"]+)"[^>]*d="([^"]+)"[^>]*>/gu)).map((match) => [match[1]!, match[2]!]),
	);
	if (!paths.p10 || !paths.p9) {
		throw new Error('Icon geometry is missing center frame paths');
	}

	return {
		height: tuple[3],
		paths,
		width: tuple[2],
	};
};

export const renderIconSvg = (input: IconRenderInput): string => {
	const palette = input.palettes[input.config.paletteToken];
	const background = input.backgrounds[input.config.backgroundToken];
	if (!palette) {
		throw new Error(`Unknown palette token: ${input.config.paletteToken}`);
	}
	if (!background) {
		throw new Error(`Unknown background token: ${input.config.backgroundToken}`);
	}

	const frameD = input.geometry.paths.p10;
	const chipD = input.geometry.paths.p9;
	if (!frameD || !chipD) {
		throw new Error('Icon geometry is missing required center paths');
	}

	const centerPanelD = extractCenterPanelD(frameD);
	const defs = [
		createGradient('outer-a', palette.ribbons.outerA),
		createGradient('outer-b', palette.ribbons.outerB),
		createGradient('inner-a', palette.ribbons.innerA),
		createGradient('inner-b', palette.ribbons.innerB),
		createGradient('caps-a', palette.ribbons.capsA),
		createGradient('caps-b', palette.ribbons.capsB),
		createGradient('center-frame', palette.center.frame),
		createGradient('center-well', palette.center.well),
		createGradient('center-chip', palette.center.chip),
		createClipPath('topLeft', SLOT_BOUNDS.topLeft),
		createClipPath('bottomRight', SLOT_BOUNDS.bottomRight),
		createClipPath('center', SLOT_BOUNDS.center),
	].join('');

	const slotCatalog = {
		bottomRight: input.slotCatalog.bottomRight,
		center: input.slotCatalog.center,
		topLeft: input.slotCatalog.topLeft,
	};

	const topLeftSlot = resolveSlotMarkup(
		'topLeft',
		input.config.slots.topLeft,
		input.config.customSlots?.topLeft,
		slotCatalog.topLeft,
		SLOT_BOUNDS.topLeft,
		palette.slots.topLeft,
	);
	const bottomRightSlot = resolveSlotMarkup(
		'bottomRight',
		input.config.slots.bottomRight,
		input.config.customSlots?.bottomRight,
		slotCatalog.bottomRight,
		SLOT_BOUNDS.bottomRight,
		palette.slots.bottomRight,
	);
	const centerSlot = resolveSlotMarkup(
		'center',
		input.config.slots.center,
		input.config.customSlots?.center,
		slotCatalog.center,
		SLOT_BOUNDS.center,
		palette.center.symbol,
	);

	const backgroundRect = input.includeBackground === false ? '' : `<rect width="${ICON_CANVAS_SIZE}" height="${ICON_CANVAS_SIZE}" fill="${background.color}"/>`;
	const ribbonPaths = [
		renderPathGroup(ICON_GROUPS.outerA, input.geometry, 'url(#outer-a)'),
		renderPathGroup(ICON_GROUPS.outerB, input.geometry, 'url(#outer-b)'),
		renderPathGroup(ICON_GROUPS.innerA, input.geometry, 'url(#inner-a)'),
		renderPathGroup(ICON_GROUPS.innerB, input.geometry, 'url(#inner-b)'),
		renderPathGroup(ICON_GROUPS.capsA, input.geometry, 'url(#caps-a)'),
		renderPathGroup(ICON_GROUPS.capsB, input.geometry, 'url(#caps-b)', new Set([...SLOT_PATH_EXCLUSIONS.topLeft, ...SLOT_PATH_EXCLUSIONS.bottomRight])),
	].join('');

	const centerPaths = [
		`<path d="${frameD}" fill="url(#center-frame)" fill-rule="evenodd"/>`,
		`<path d="${centerPanelD}" fill="url(#center-well)"/>`,
		`<path d="${chipD}" fill="url(#center-chip)" stroke="${palette.center.chipStroke}" stroke-width="6"/>`,
	].join('');

	return `<svg xmlns="http://www.w3.org/2000/svg" width="${ICON_CANVAS_SIZE}" height="${ICON_CANVAS_SIZE}" viewBox="0 0 ${ICON_CANVAS_SIZE} ${ICON_CANVAS_SIZE}"><defs>${defs}</defs>${backgroundRect}<g>${ribbonPaths}${topLeftSlot}${bottomRightSlot}</g>${centerPaths}${centerSlot}</svg>`;
};

export const createRenderInput = (options: {
	backgrounds: IconBackgroundToken[];
	config: IconComposerConfig;
	geometry: IconGeometry;
	includeBackground?: boolean;
	palettes: IconPaletteToken[];
	slotCatalog: Record<IconSlotKind, IconSlotPreset[]>;
}): IconRenderInput => ({
	backgrounds: normalizeMap(options.backgrounds),
	config: options.config,
	geometry: options.geometry,
	includeBackground: options.includeBackground,
	palettes: normalizeMap(options.palettes),
	slotCatalog: {
		bottomRight: normalizeMap(options.slotCatalog.bottomRight),
		center: normalizeMap(options.slotCatalog.center),
		topLeft: normalizeMap(options.slotCatalog.topLeft),
	},
});
