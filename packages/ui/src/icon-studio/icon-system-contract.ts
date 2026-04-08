export const ICON_CANVAS_SIZE = 1078;
export const ICON_VIEW_BOX = `0 0 ${ICON_CANVAS_SIZE} ${ICON_CANVAS_SIZE}`;
export const CUSTOM_SLOT_ID = 'custom';

export type IconTheme = 'dark' | 'light';
export type IconFamily = 'brand' | 'mono';
export type IconSlotKind = 'bottomRight' | 'center' | 'topLeft';

export interface IconGradientSpec {
	angle: number;
	end: string;
	middleOffset?: number;
	start: string;
}

export interface IconBackgroundToken {
	color: string;
	id: string;
	label: string;
	theme: IconTheme;
}

export interface IconPaletteToken {
	backgroundToken: string;
	center: {
		chip: IconGradientSpec;
		chipStroke: string;
		frame: IconGradientSpec;
		symbol: string;
		well: IconGradientSpec;
	};
	description: string;
	family: IconFamily;
	id: string;
	label: string;
	ribbons: {
		capsA: IconGradientSpec;
		capsB: IconGradientSpec;
		innerA: IconGradientSpec;
		innerB: IconGradientSpec;
		outerA: IconGradientSpec;
		outerB: IconGradientSpec;
	};
	slots: {
		bottomRight: string;
		center: string;
		topLeft: string;
	};
	theme: IconTheme;
}

export interface IconSlotPreset {
	id: string;
	label: string;
	markup: string;
	slot: IconSlotKind;
	viewBox: [number, number, number, number];
}

export interface IconPreset {
	backgroundToken: string;
	description: string;
	family: IconFamily;
	id: string;
	label: string;
	paletteToken: string;
	slots: Record<IconSlotKind, string>;
	theme: IconTheme;
}

export interface IconComposerConfig {
	backgroundToken: string;
	customSlots?: Partial<Record<IconSlotKind, string>>;
	family: IconFamily;
	paletteToken: string;
	slots: Record<IconSlotKind, string>;
	theme: IconTheme;
}

export interface IconGeometry {
	height: number;
	paths: Record<string, string>;
	width: number;
}

export interface IconRenderInput {
	backgrounds: Record<string, IconBackgroundToken>;
	config: IconComposerConfig;
	geometry: IconGeometry;
	includeBackground?: boolean;
	palettes: Record<string, IconPaletteToken>;
	slotCatalog: Record<IconSlotKind, Record<string, IconSlotPreset>>;
}

export interface SlotBounds {
	height: number;
	radius: number;
	width: number;
	x: number;
	y: number;
}

export interface IconStudioData {
	backgrounds: IconBackgroundToken[];
	brandDarkSvg: string;
	defaultPreset: IconPreset | null;
	geometrySvg: string;
	palettes: IconPaletteToken[];
	presets: IconPreset[];
	slotCatalog: Record<IconSlotKind, IconSlotPreset[]>;
}

export const ICON_GROUPS = {
	capsA: ['p2', 'p4', 'p14', 'p15'],
	capsB: ['p1', 'p8', 'p11', 'p18', 'p19'],
	innerA: ['p5', 'p16'],
	innerB: ['p6', 'p13'],
	outerA: ['p3', 'p17'],
	outerB: ['p7', 'p12'],
} as const;

export const SLOT_BOUNDS: Record<IconSlotKind, SlotBounds> = {
	bottomRight: { height: 148, radius: 34, width: 158, x: 724, y: 712 },
	center: { height: 168, radius: 40, width: 168, x: 454, y: 451 },
	topLeft: { height: 148, radius: 34, width: 158, x: 196, y: 194 },
};
