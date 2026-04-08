import type { IconStudioData } from './icon-system-contract';
import {
	iconSystemBackgrounds,
	iconSystemBrandDarkSvg,
	iconSystemGeometrySvg,
	iconSystemPalettes,
	iconSystemPresets,
	iconSystemSlotCatalog,
} from './icon-system-bundle';

export const getIconStudioData = (): IconStudioData => {
	const presets = [...iconSystemPresets].sort((left, right) => left.id.localeCompare(right.id));
	const defaultPreset = presets.find((preset) => preset.id === 'brand-light') ?? presets[0] ?? null;

	return {
		backgrounds: iconSystemBackgrounds,
		brandDarkSvg: iconSystemBrandDarkSvg,
		defaultPreset,
		geometrySvg: iconSystemGeometrySvg,
		palettes: iconSystemPalettes,
		presets,
		slotCatalog: iconSystemSlotCatalog,
	};
};
