import backgroundsData from "../../../../../assets/next/tokens/backgrounds.json";
import brandDarkPreset from "../../../../../assets/next/presets/brand-dark.json";
import brandLightPreset from "../../../../../assets/next/presets/brand-light.json";
import iconBwSvg from "../../../../../assets/next/icon-bw.svg?raw";
import iconColorSvg from "../../../../../assets/next/icon-color.svg?raw";
import lightGraphiteCorePreset from "../../../../../assets/next/presets/light-graphite-core.json";
import lightJadeIcePreset from "../../../../../assets/next/presets/light-jade-ice.json";
import lightMintSkyPreset from "../../../../../assets/next/presets/light-mint-sky.json";
import monoDarkPreset from "../../../../../assets/next/presets/mono-dark.json";
import monoLightPreset from "../../../../../assets/next/presets/mono-light.json";
import palettesData from "../../../../../assets/next/tokens/palettes.json";
import slotsData from "../../../../../assets/next/tokens/slots.json";

import type {
  IconBackgroundToken,
  IconPaletteToken,
  IconPreset,
  IconSlotKind,
  IconSlotPreset,
} from "./icon-system-contract";

export const iconSystemBackgrounds = backgroundsData as IconBackgroundToken[];
export const iconSystemPalettes = palettesData as IconPaletteToken[];
export const iconSystemSlotCatalog = slotsData as Record<
  IconSlotKind,
  IconSlotPreset[]
>;
export const iconSystemGeometrySvg = iconBwSvg;
export const iconSystemBrandDarkSvg = iconColorSvg;
export const iconSystemPresets = [
  brandDarkPreset,
  brandLightPreset,
  lightGraphiteCorePreset,
  lightJadeIcePreset,
  lightMintSkyPreset,
  monoDarkPreset,
  monoLightPreset,
] as IconPreset[];
