import { loadLucideIconAsset } from "../../../icon-studio/src/lib/icon-studio/lucide-slot-catalog.js";
import type { AvatarClassify, AvatarIconSeed, ProfileIconSeed, RoomIconSeed, SessionIconSeed } from "../types";

const toTrimmedOrFallback = (value: string | undefined, fallback: string): string => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : fallback;
};

const buildProfileSeed = (input: ProfileIconSeed): string => toTrimmedOrFallback(input.identifier.value, input.identifier.kind);

const escapeXml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

const hashString = (value: string): number => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const fractionFromSeed = (seed: number, offset: number): number => {
  const next = Math.imul(seed ^ (offset * 0x45d9f3b), 0x27d4eb2d) >>> 0;
  return next / 0xffffffff;
};

const percent = (value: number): string => `${Math.round(value * 100)}%`;

const normalizeHue = (value: number): number => ((value % 360) + 360) % 360;

const channelToHex = (value: number): string => Math.round(Math.max(0, Math.min(255, value))).toString(16).padStart(2, "0");

const hslToHex = (hue: number, saturation: number, lightness: number): string => {
  const h = normalizeHue(hue) / 60;
  const s = Math.max(0, Math.min(100, saturation)) / 100;
  const l = Math.max(0, Math.min(100, lightness)) / 100;
  const chroma = (1 - Math.abs(2 * l - 1)) * s;
  const x = chroma * (1 - Math.abs((h % 2) - 1));
  const [r1, g1, b1] =
    h < 1
      ? [chroma, x, 0]
      : h < 2
        ? [x, chroma, 0]
        : h < 3
          ? [0, chroma, x]
          : h < 4
            ? [0, x, chroma]
            : h < 5
              ? [x, 0, chroma]
              : [chroma, 0, x];
  const match = l - chroma / 2;
  return `#${channelToHex((r1 + match) * 255)}${channelToHex((g1 + match) * 255)}${channelToHex((b1 + match) * 255)}`;
};

const hslColor = (hue: number, saturation: number, lightness: number): string => hslToHex(hue, saturation, lightness);

const labelFromValue = (value: string, fallback: string): string => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
};

const buildRadialStops = (seed: number, accentHue: number) => {
  const glowHue = (accentHue + 30 + Math.round(fractionFromSeed(seed, 4) * 80)) % 360;
  const accentLightness = 76 + fractionFromSeed(seed, 5) * 10;
  const accentSaturation = 60 + fractionFromSeed(seed, 6) * 18;
  const depthLightness = 34 + fractionFromSeed(seed, 7) * 14;
  const depthSaturation = 40 + fractionFromSeed(seed, 8) * 16;
  return {
    accent: hslToHex(accentHue, accentSaturation, accentLightness),
    glow: hslToHex(glowHue, accentSaturation + 10, Math.max(54, accentLightness - 10)),
    depth: hslToHex(accentHue, depthSaturation, depthLightness),
  };
};

interface AvatarQuietPalette {
  aura: string;
  auraDeep: string;
  baseDepth: string;
  baseStart: string;
  baseEnd: string;
  facetBright: string;
  facetSoft: string;
  facetLime: string;
  halo: string;
  ink: string;
  inkEdge: string;
  rim: string;
  rimAccent: string;
  ribbonA: string;
  ribbonB: string;
  ribbonC: string;
  spark: string;
}

interface AvatarClassifyTheme {
  glyphGlow: string;
  glyphEdge: string;
  glyphInk: string;
  iconId: string;
}

const AVATAR_CLASSIFY_THEME_BY_ID = {
  assistant: {
    glyphGlow: hslColor(206, 88, 96),
    glyphEdge: hslColor(206, 30, 34),
    glyphInk: hslColor(206, 30, 16),
    iconId: "bot",
  },
  backend: {
    glyphGlow: hslColor(222, 90, 96),
    glyphEdge: hslColor(222, 28, 34),
    glyphInk: hslColor(222, 28, 16),
    iconId: "server",
  },
  design: {
    glyphGlow: hslColor(320, 90, 96),
    glyphEdge: hslColor(320, 30, 34),
    glyphInk: hslColor(320, 30, 16),
    iconId: "palette",
  },
  frontend: {
    glyphGlow: hslColor(164, 84, 95),
    glyphEdge: hslColor(164, 32, 34),
    glyphInk: hslColor(164, 32, 16),
    iconId: "monitor",
  },
  ops: {
    glyphGlow: hslColor(38, 92, 97),
    glyphEdge: hslColor(38, 36, 34),
    glyphInk: hslColor(38, 36, 16),
    iconId: "wrench",
  },
  reviewer: {
    glyphGlow: hslColor(270, 88, 96),
    glyphEdge: hslColor(270, 32, 34),
    glyphInk: hslColor(270, 32, 16),
    iconId: "badge-check",
  },
} satisfies Record<AvatarClassify, AvatarClassifyTheme>;

const buildAvatarQuietPalette = (seed: number): AvatarQuietPalette => {
  const seedHue = normalizeHue(seed % 360);
  const accentHue = normalizeHue(seedHue + (fractionFromSeed(seed, 21) - 0.5) * 18);
  const companionHue = normalizeHue(accentHue + 42 + fractionFromSeed(seed, 22) * 18);
  const contrastHue = normalizeHue(accentHue - 56 - fractionFromSeed(seed, 23) * 16);
  const highlightHue = normalizeHue(accentHue + 102 + fractionFromSeed(seed, 24) * 16);

  return {
    aura: hslColor(highlightHue, 86, 74 + fractionFromSeed(seed, 25) * 7),
    auraDeep: hslColor(companionHue, 74, 54 + fractionFromSeed(seed, 26) * 10),
    baseDepth: hslColor(contrastHue, 58, 24 + fractionFromSeed(seed, 27) * 10),
    baseStart: hslColor(accentHue, 82, 44 + fractionFromSeed(seed, 28) * 10),
    baseEnd: hslColor(companionHue, 68, 66 + fractionFromSeed(seed, 29) * 12),
    facetBright: hslColor(highlightHue, 88, 82 + fractionFromSeed(seed, 30) * 6),
    facetSoft: hslColor(companionHue, 62, 62 + fractionFromSeed(seed, 31) * 7),
    facetLime: hslColor(normalizeHue(accentHue + 132), 74, 66 + fractionFromSeed(seed, 32) * 8),
    halo: hslColor(highlightHue, 92, 80 + fractionFromSeed(seed, 33) * 5),
    ink: hslColor(normalizeHue(contrastHue - 6), 44, 16 + fractionFromSeed(seed, 34) * 5),
    inkEdge: hslColor(normalizeHue(contrastHue + 8), 42, 26 + fractionFromSeed(seed, 35) * 5),
    rim: hslColor(companionHue, 72, 84),
    rimAccent: hslColor(highlightHue, 90, 74),
    ribbonA: hslColor(companionHue, 80, 72 + fractionFromSeed(seed, 36) * 6),
    ribbonB: hslColor(accentHue, 84, 68 + fractionFromSeed(seed, 37) * 6),
    ribbonC: hslColor(highlightHue, 82, 72 + fractionFromSeed(seed, 38) * 6),
    spark: hslColor(normalizeHue(highlightHue + 22), 94, 88),
  };
};

interface Point {
  x: number;
  y: number;
}

const formatSvgNumber = (value: number): string => Number(value.toFixed(2)).toString();

const buildCatmullRomPath = (points: readonly Point[]): string => {
  if (points.length === 0) {
    return "";
  }
  if (points.length === 1) {
    return `M${formatSvgNumber(points[0].x)} ${formatSvgNumber(points[0].y)}`;
  }

  const segments = [`M${formatSvgNumber(points[0].x)} ${formatSvgNumber(points[0].y)}`];
  for (let index = 0; index < points.length - 1; index += 1) {
    const p0 = points[Math.max(0, index - 1)];
    const p1 = points[index];
    const p2 = points[index + 1];
    const p3 = points[Math.min(points.length - 1, index + 2)];
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    segments.push(
      `C${formatSvgNumber(c1x)} ${formatSvgNumber(c1y)} ${formatSvgNumber(c2x)} ${formatSvgNumber(c2y)} ${formatSvgNumber(p2.x)} ${formatSvgNumber(p2.y)}`,
    );
  }
  return segments.join("");
};

const buildAvatarRibbonPath = (seed: number, index: number, energy = 1): string => {
  const phase = fractionFromSeed(seed, 60 + index * 7) * Math.PI * 2;
  const amplitude = (6 + fractionFromSeed(seed, 61 + index * 7) * 7) * energy;
  const lift = index === 0 ? 18 : index === 1 ? 34 : 56;
  const slope = (fractionFromSeed(seed, 62 + index * 7) - 0.5) * (index === 2 ? 10 : 16) * energy;
  const frequency = 0.72 + fractionFromSeed(seed, 63 + index * 7) * 0.4 * Math.max(1, energy * 0.94);
  const secondary = 1.35 + fractionFromSeed(seed, 64 + index * 7) * 0.8 * Math.max(1, energy * 0.88);
  const offset = (fractionFromSeed(seed, 65 + index * 7) - 0.5) * 10;
  const points: Point[] = [];

  for (let step = 0; step <= 6; step += 1) {
    const t = step / 6;
    const x = -10 + t * 116;
    const wave =
      Math.sin((t * frequency + phase) * Math.PI * 2) * amplitude +
      Math.cos((t * secondary + phase * 0.6) * Math.PI * 2) * amplitude * 0.36;
    const bend = slope * (t - 0.5);
    points.push({
      x,
      y: lift + offset + wave + bend,
    });
  }

  return buildCatmullRomPath(points);
};

const buildSparkleMarkup = (
  cx: number,
  cy: number,
  radius: number,
  color: string,
  opacity: number,
): string => {
  const r = Number(radius.toFixed(2));
  const x = Number(cx.toFixed(2));
  const y = Number(cy.toFixed(2));
  const diagonal = Number((radius * 0.68).toFixed(2));
  return `<g opacity="${opacity}" stroke="${color}" stroke-linecap="round" fill="none"><path d="M${x} ${y - r}L${x} ${y + r}" stroke-width="${Number((radius * 0.22).toFixed(2))}" /><path d="M${x - r} ${y}L${x + r} ${y}" stroke-width="${Number((radius * 0.22).toFixed(2))}" /><path d="M${x - diagonal} ${y - diagonal}L${x + diagonal} ${y + diagonal}" stroke-width="${Number((radius * 0.14).toFixed(2))}" /><path d="M${x - diagonal} ${y + diagonal}L${x + diagonal} ${y - diagonal}" stroke-width="${Number((radius * 0.14).toFixed(2))}" /></g>`;
};

export const buildProfileIconUrl = (identifier: string): string =>
  `/media/profiles/${encodeURIComponent(identifier)}/icon`;

export const buildAvatarIconUrl = (principalId: string): string =>
  `/media/avatars/${encodeURIComponent(principalId)}/icon`;

export const buildSessionIconUrl = (sessionId: string): string =>
  `/media/sessions/${encodeURIComponent(sessionId)}/icon`;

export const buildRoomIconUrl = (roomId: string): string =>
  `/media/rooms/${encodeURIComponent(roomId)}/icon`;

interface LucideAvatarGlyph {
  markup: string;
  viewBox: [number, number, number, number];
}

const resolveAvatarClassifyGlyph = async (classify: AvatarClassify): Promise<LucideAvatarGlyph | null> => {
  const asset = await loadLucideIconAsset(AVATAR_CLASSIFY_THEME_BY_ID[classify].iconId);
  if (!asset) {
    return null;
  }
  return {
    markup: asset.markup,
    viewBox: asset.viewBox,
  };
};

const renderAvatarClassifyGlyph = (
  glyph: LucideAvatarGlyph,
  input: {
    color: string;
    opacity?: number;
    size: number;
    x: number;
    y: number;
    filterId?: string;
  },
): string => {
  const opacityAttribute = input.opacity === undefined ? "" : ` opacity="${input.opacity}"`;
  const filterAttribute = input.filterId ? ` filter="url(#${input.filterId})"` : "";
  return `<svg x="${input.x}" y="${input.y}" width="${input.size}" height="${input.size}" viewBox="${glyph.viewBox.join(" ")}" color="${input.color}"${opacityAttribute}${filterAttribute}>${glyph.markup}</svg>`;
};

const AVATAR_RIBBON_PRIMARY_PATH = buildAvatarRibbonPath(0x4127a2f1, 0, 1);
const AVATAR_RIBBON_SECONDARY_PATH = buildAvatarRibbonPath(0x57db91c3, 1, 1);
const AVATAR_RIBBON_ACCENT_PATH = buildAvatarRibbonPath(0x7812e4ab, 2, 1);

export const renderAvatarFallbackSvg = async (input: AvatarIconSeed): Promise<string> => {
  const principalId = input.principalId.trim().toLowerCase();
  const colorSeed = hashString(`avatar::palette::${principalId}`);
  const palette = buildAvatarQuietPalette(colorSeed);
  const classifyTheme = input.classify ? AVATAR_CLASSIFY_THEME_BY_ID[input.classify] : null;
  const label = escapeXml(labelFromValue(input.displayName ?? input.nickname, principalId.slice(-2).toUpperCase()));
  const sparkles = [
    buildSparkleMarkup(76, 18, 3.4, palette.spark, 0.22),
    buildSparkleMarkup(84, 26, 1.9, palette.spark, 0.16),
  ].join("");
  const facetNorth = "M0 0H66L47 50L0 58Z";
  const facetEast = "M66 0H96V38L47 50Z";
  const facetSouthWest = "M0 58L47 50L34 96H0Z";
  const facetSouthEast = "M47 50L96 38V96H34Z";
  // TODO: move the Lucide SVG asset loader into a runtime-neutral package once another non-UI package needs it.
  const glyph = input.classify ? await resolveAvatarClassifyGlyph(input.classify) : null;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96" fill="none">`,
    `<defs>`,
    `<clipPath id="avatarClip">`,
    `<rect width="96" height="96" rx="28" />`,
    `</clipPath>`,
    `<linearGradient id="avatarField" x1="8" y1="88" x2="88" y2="12">`,
    `<stop offset="0%" stop-color="${palette.baseStart}" />`,
    `<stop offset="54%" stop-color="${palette.auraDeep}" />`,
    `<stop offset="100%" stop-color="${palette.baseEnd}" />`,
    `</linearGradient>`,
    `<radialGradient id="avatarGlow" cx="74%" cy="18%" r="74%">`,
    `<stop offset="0%" stop-color="${palette.aura}" stop-opacity="0.84" />`,
    `<stop offset="48%" stop-color="${palette.facetBright}" stop-opacity="0.22" />`,
    `<stop offset="100%" stop-color="${palette.baseEnd}" stop-opacity="0" />`,
    `</radialGradient>`,
    `<radialGradient id="avatarBaseGlow" cx="34%" cy="26%" r="78%">`,
    `<stop offset="0%" stop-color="${palette.facetBright}" stop-opacity="0.56" />`,
    `<stop offset="100%" stop-color="${palette.facetSoft}" stop-opacity="0" />`,
    `</radialGradient>`,
    `<linearGradient id="facetBright" x1="0" y1="0" x2="96" y2="96">`,
    `<stop offset="0%" stop-color="${palette.facetBright}" stop-opacity="0.54" />`,
    `<stop offset="100%" stop-color="${palette.facetSoft}" stop-opacity="0.08" />`,
    `</linearGradient>`,
    `<linearGradient id="facetLime" x1="96" y1="0" x2="20" y2="96">`,
    `<stop offset="0%" stop-color="${palette.facetLime}" stop-opacity="0.42" />`,
    `<stop offset="100%" stop-color="${palette.facetBright}" stop-opacity="0.06" />`,
    `</linearGradient>`,
    `<linearGradient id="facetSoft" x1="0" y1="96" x2="96" y2="24">`,
    `<stop offset="0%" stop-color="${palette.baseDepth}" stop-opacity="0.2" />`,
    `<stop offset="100%" stop-color="${palette.facetSoft}" stop-opacity="0.32" />`,
    `</linearGradient>`,
    `<linearGradient id="avatarRim" x1="8" y1="88" x2="88" y2="8">`,
    `<stop offset="0%" stop-color="${palette.halo}" stop-opacity="0.92" />`,
    `<stop offset="68%" stop-color="${palette.rim}" stop-opacity="0.78" />`,
    `<stop offset="100%" stop-color="${palette.rimAccent}" stop-opacity="0.94" />`,
    `</linearGradient>`,
    `<linearGradient id="ribbonPrimaryGradient" x1="8" y1="18" x2="92" y2="38">`,
    `<stop offset="0%" stop-color="${palette.ribbonB}" stop-opacity="0" />`,
    `<stop offset="28%" stop-color="${palette.ribbonA}" stop-opacity="0.72" />`,
    `<stop offset="72%" stop-color="${palette.ribbonC}" stop-opacity="0.82" />`,
    `<stop offset="100%" stop-color="${palette.spark}" stop-opacity="0.08" />`,
    `</linearGradient>`,
    `<linearGradient id="ribbonSecondaryGradient" x1="4" y1="42" x2="92" y2="74">`,
    `<stop offset="0%" stop-color="${palette.ribbonA}" stop-opacity="0.1" />`,
    `<stop offset="42%" stop-color="${palette.ribbonB}" stop-opacity="0.52" />`,
    `<stop offset="100%" stop-color="${palette.spark}" stop-opacity="0.2" />`,
    `</linearGradient>`,
    `<linearGradient id="ribbonAccentGradient" x1="12" y1="60" x2="90" y2="82">`,
    `<stop offset="0%" stop-color="${palette.ribbonB}" stop-opacity="0.06" />`,
    `<stop offset="48%" stop-color="${palette.ribbonC}" stop-opacity="0.42" />`,
    `<stop offset="100%" stop-color="${palette.spark}" stop-opacity="0.12" />`,
    `</linearGradient>`,
    `<linearGradient id="auroraFieldGradient" x1="18" y1="12" x2="92" y2="74">`,
    `<stop offset="0%" stop-color="${palette.spark}" stop-opacity="0.06" />`,
    `<stop offset="22%" stop-color="${palette.ribbonA}" stop-opacity="0.42" />`,
    `<stop offset="64%" stop-color="${palette.ribbonB}" stop-opacity="0.38" />`,
    `<stop offset="100%" stop-color="${palette.ribbonC}" stop-opacity="0.16" />`,
    `</linearGradient>`,
    `<linearGradient id="veilFieldGradient" x1="12" y1="82" x2="88" y2="24">`,
    `<stop offset="0%" stop-color="${palette.facetBright}" stop-opacity="0.08" />`,
    `<stop offset="50%" stop-color="${palette.ribbonB}" stop-opacity="0.2" />`,
    `<stop offset="100%" stop-color="${palette.spark}" stop-opacity="0.12" />`,
    `</linearGradient>`,
    `<radialGradient id="glyphSpot" cx="50%" cy="44%" r="42%">`,
    `<stop offset="0%" stop-color="white" stop-opacity="0.28" />`,
    `<stop offset="100%" stop-color="${palette.facetBright}" stop-opacity="0" />`,
    `</radialGradient>`,
    `<filter id="surfaceGrain">`,
    `<feTurbulence type="fractalNoise" baseFrequency="0.88" numOctaves="2" seed="61" />`,
    `<feColorMatrix type="saturate" values="0" />`,
    `<feComponentTransfer>`,
    `<feFuncA type="table" tableValues="0 0.08" />`,
    `</feComponentTransfer>`,
    `</filter>`,
    `<filter id="glyphGlow" x="-40%" y="-40%" width="180%" height="180%" color-interpolation-filters="sRGB">`,
    `<feGaussianBlur stdDeviation="2.2" />`,
    `</filter>`,
    `<filter id="auraBlur" x="-30%" y="-30%" width="160%" height="160%">`,
    `<feGaussianBlur stdDeviation="8" />`,
    `</filter>`,
    `<filter id="ribbonGlow" x="-20%" y="-20%" width="140%" height="140%" color-interpolation-filters="sRGB">`,
    `<feGaussianBlur stdDeviation="4.2" />`,
    `<feColorMatrix type="matrix" values="1 0 0 0 0 0 1 0 0 0.03 0 0 1 0 0.03 0 0 0 0.92 0" />`,
    `</filter>`,
    `<filter id="ribbonSoft" x="-20%" y="-20%" width="140%" height="140%">`,
    `<feGaussianBlur stdDeviation="2.4" />`,
    `</filter>`,
    `<filter id="auroraMaskNoise" x="-20%" y="-20%" width="140%" height="140%">`,
    `<feTurbulence type="fractalNoise" baseFrequency="0.018 0.14" numOctaves="3" seed="139" />`,
    `<feColorMatrix type="saturate" values="0" />`,
    `<feComponentTransfer>`,
    `<feFuncR type="gamma" amplitude="1.2" exponent="1.25" offset="-0.04" />`,
    `<feFuncG type="gamma" amplitude="1.2" exponent="1.25" offset="-0.04" />`,
    `<feFuncB type="gamma" amplitude="1.2" exponent="1.25" offset="-0.04" />`,
    `</feComponentTransfer>`,
    `</filter>`,
    `<filter id="veilMaskNoise" x="-20%" y="-20%" width="140%" height="140%">`,
    `<feTurbulence type="fractalNoise" baseFrequency="0.014 0.09" numOctaves="2" seed="211" />`,
    `<feColorMatrix type="saturate" values="0" />`,
    `<feComponentTransfer>`,
    `<feFuncR type="gamma" amplitude="1.08" exponent="1.1" offset="-0.02" />`,
    `<feFuncG type="gamma" amplitude="1.08" exponent="1.1" offset="-0.02" />`,
    `<feFuncB type="gamma" amplitude="1.08" exponent="1.1" offset="-0.02" />`,
    `</feComponentTransfer>`,
    `</filter>`,
    `<mask id="auroraFieldMask">`,
    `<rect width="96" height="96" rx="28" fill="black" />`,
    `<circle cx="74" cy="24" r="28" fill="white" opacity="0.74" />`,
    `<path d="${AVATAR_RIBBON_PRIMARY_PATH}" stroke="white" stroke-width="24" stroke-linecap="round" fill="none" opacity="0.46" />`,
    `<path d="${AVATAR_RIBBON_SECONDARY_PATH}" stroke="white" stroke-width="18" stroke-linecap="round" fill="none" opacity="0.28" />`,
    `<rect width="96" height="96" filter="url(#auroraMaskNoise)" opacity="0.34" />`,
    `</mask>`,
    `<mask id="veilFieldMask">`,
    `<rect width="96" height="96" rx="28" fill="black" />`,
    `<path d="M-12 70C14 60 30 58 52 56C70 54 83 48 108 34V108H-12Z" fill="white" opacity="0.24" />`,
    `<rect width="96" height="96" filter="url(#veilMaskNoise)" opacity="0.24" />`,
    `</mask>`,
    `</defs>`,
    `<g>`,
    `<g clip-path="url(#avatarClip)">`,
    `<rect width="96" height="96" rx="28" fill="url(#avatarField)" />`,
    `<rect width="96" height="96" rx="28" fill="url(#avatarGlow)" />`,
    `<rect width="96" height="96" rx="28" fill="url(#avatarBaseGlow)" />`,
    `<circle cx="72" cy="24" r="22" fill="${palette.aura}" fill-opacity="0.16" filter="url(#auraBlur)" />`,
    `<rect width="96" height="96" rx="28" fill="url(#auroraFieldGradient)" mask="url(#auroraFieldMask)" opacity="0.48" />`,
    `<rect width="96" height="96" rx="28" fill="url(#veilFieldGradient)" mask="url(#veilFieldMask)" opacity="0.26" />`,
    `<path d="${AVATAR_RIBBON_PRIMARY_PATH}" stroke="url(#ribbonPrimaryGradient)" stroke-width="13" stroke-linecap="round" fill="none" opacity="0.34" filter="url(#ribbonGlow)" />`,
    `<path d="${AVATAR_RIBBON_PRIMARY_PATH}" stroke="white" stroke-opacity="0.12" stroke-width="2.2" stroke-linecap="round" fill="none" filter="url(#ribbonSoft)" />`,
    `<path d="${AVATAR_RIBBON_SECONDARY_PATH}" stroke="url(#ribbonSecondaryGradient)" stroke-width="10" stroke-linecap="round" fill="none" opacity="0.28" filter="url(#ribbonGlow)" />`,
    `<path d="${AVATAR_RIBBON_ACCENT_PATH}" stroke="url(#ribbonAccentGradient)" stroke-width="7" stroke-linecap="round" fill="none" opacity="0.22" filter="url(#ribbonSoft)" />`,
    `<path d="${facetNorth}" fill="url(#facetBright)" />`,
    `<path d="${facetEast}" fill="url(#facetLime)" />`,
    `<path d="${facetSouthWest}" fill="url(#facetSoft)" />`,
    `<path d="${facetSouthEast}" fill="url(#facetBright)" opacity="0.34" />`,
    `<path d="M66 0L47 50L34 96" stroke="white" stroke-opacity="0.18" stroke-width="1.2" />`,
    `<path d="M0 58L47 50L96 38" stroke="white" stroke-opacity="0.12" stroke-width="1.2" />`,
    `<path d="M10 16C24 6 48 4 74 12C82 14 88 18 92 24" stroke="white" stroke-opacity="0.22" stroke-width="2.2" stroke-linecap="round" />`,
    `<rect width="96" height="96" rx="28" filter="url(#surfaceGrain)" opacity="0.28" />`,
    sparkles,
    `</g>`,
    `<rect x="1.25" y="1.25" width="93.5" height="93.5" rx="26.75" stroke="url(#avatarRim)" stroke-width="2.5" />`,
    `<rect x="4.5" y="4.5" width="87" height="87" rx="23.5" stroke="white" stroke-opacity="0.2" />`,
    `</g>`,
    `<circle cx="48" cy="48" r="25" fill="url(#glyphSpot)" opacity="0.72" />`,
    glyph
      ? [
          renderAvatarClassifyGlyph(glyph, {
            color: classifyTheme?.glyphGlow ?? palette.halo,
            filterId: "glyphGlow",
            opacity: 0.52,
            size: 50,
            x: 23,
            y: 23,
          }),
          renderAvatarClassifyGlyph(glyph, {
            color: classifyTheme?.glyphEdge ?? palette.inkEdge,
            opacity: 0.66,
            size: 49,
            x: 23.5,
            y: 23.5,
          }),
          renderAvatarClassifyGlyph(glyph, {
            color: classifyTheme?.glyphInk ?? palette.ink,
            size: 48,
            x: 24,
            y: 24,
          }),
        ].join("")
      : [
          `<text x="48" y="49" text-anchor="middle" dominant-baseline="middle" font-family="ui-sans-serif, 'IBM Plex Sans', sans-serif" font-size="30" font-weight="700" fill="${palette.halo}" fill-opacity="0.52" filter="url(#glyphGlow)">${label}</text>`,
          `<text x="48" y="49" text-anchor="middle" dominant-baseline="middle" font-family="ui-sans-serif, 'IBM Plex Sans', sans-serif" font-size="30" font-weight="700" fill="${palette.ink}">${label}</text>`,
        ].join(""),
    `</svg>`,
  ].join("");
};

export const renderSessionFallbackSvg = (input: SessionIconSeed): string => {
  const workspacePath = input.workspacePath.trim();
  const sessionId = input.sessionId.trim();
  const seed = hashString(`${workspacePath}::${sessionId}`);
  const accentHue = seed % 360;
  const foregroundHue = hashString(sessionId) % 360;
  const background = buildRadialStops(seed, accentHue);
  const foreground = buildRadialStops(hashString(sessionId), foregroundHue);
  const labelSource = labelFromValue(input.label ?? "", String(hashString(sessionId) % 100).padStart(2, "0"));
  const cx = percent(0.26 + fractionFromSeed(seed, 1) * 0.52);
  const cy = percent(0.18 + fractionFromSeed(seed, 2) * 0.5);
  const radius = percent(0.55 + fractionFromSeed(seed, 3) * 0.2);
  const orbCx = percent(0.62 + fractionFromSeed(seed, 9) * 0.22);
  const orbCy = percent(0.26 + fractionFromSeed(seed, 10) * 0.2);
  const orbRadius = 16 + Math.round(fractionFromSeed(seed, 11) * 14);
  const textSize = 34 + Math.round(fractionFromSeed(seed, 12) * 10);
  const turbulenceSeed = (seed % 997) + 1;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96" fill="none">`,
    `<defs>`,
    `<radialGradient id="bg" cx="${cx}" cy="${cy}" r="${radius}">`,
    `<stop offset="0%" stop-color="${background.accent}" />`,
    `<stop offset="48%" stop-color="${background.glow}" />`,
    `<stop offset="100%" stop-color="${background.depth}" />`,
    `</radialGradient>`,
    `<radialGradient id="fg" cx="50%" cy="42%" r="58%">`,
    `<stop offset="0%" stop-color="${foreground.accent}" stop-opacity="0.98" />`,
    `<stop offset="100%" stop-color="${foreground.depth}" stop-opacity="0.9" />`,
    `</radialGradient>`,
    `<filter id="noise">`,
    `<feTurbulence type="fractalNoise" baseFrequency="0.95" numOctaves="2" seed="${turbulenceSeed}" />`,
    `<feColorMatrix type="saturate" values="0" />`,
    `<feComponentTransfer>`,
    `<feFuncA type="table" tableValues="0 0.18" />`,
    `</feComponentTransfer>`,
    `</filter>`,
    `</defs>`,
    `<rect width="96" height="96" rx="26" fill="url(#bg)" />`,
    `<circle cx="${orbCx}" cy="${orbCy}" r="${orbRadius}" fill="${foreground.glow}" fill-opacity="0.42" />`,
    `<rect x="0" y="0" width="96" height="96" rx="26" filter="url(#noise)" opacity="0.34" />`,
    `<path d="M18 70c0-12 10-22 22-22h16c12 0 22 10 22 22v8H18z" fill="url(#fg)" fill-opacity="0.88" />`,
    `<circle cx="48" cy="35" r="18" fill="url(#fg)" />`,
    `<text x="48" y="55" text-anchor="middle" dominant-baseline="middle" font-family="ui-monospace, 'JetBrains Mono', monospace" font-size="${textSize}" font-weight="700" fill="white">${escapeXml(labelSource)}</text>`,
    `</svg>`,
  ].join("");
};

const buildRoomLabel = (input: RoomIconSeed): string => {
  const token = labelFromValue(input.label ?? "", input.roomId);
  const initials = token
    .split(/[^A-Za-z0-9]+/u)
    .filter((part) => part.length > 0)
    .slice(0, 2)
    .map((part) => part.slice(0, 1).toUpperCase())
    .join("");
  return initials.length > 0 ? initials : "RM";
};

export const renderRoomFallbackSvg = (input: RoomIconSeed): string => {
  const roomId = input.roomId.trim();
  const seed = hashString(`room::${roomId}`);
  const accentHue = seed % 360;
  const background = buildRadialStops(seed, accentHue);
  const panel = buildRadialStops(hashString(roomId), accentHue + 62);
  const label = escapeXml(buildRoomLabel(input));
  const orbCx = percent(0.18 + fractionFromSeed(seed, 1) * 0.58);
  const orbCy = percent(0.16 + fractionFromSeed(seed, 2) * 0.42);
  const turbulenceSeed = (seed % 991) + 5;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96" fill="none">`,
    `<defs>`,
    `<radialGradient id="bg" cx="${orbCx}" cy="${orbCy}" r="82%">`,
    `<stop offset="0%" stop-color="${background.accent}" />`,
    `<stop offset="58%" stop-color="${background.glow}" />`,
    `<stop offset="100%" stop-color="${background.depth}" />`,
    `</radialGradient>`,
    `<linearGradient id="panel" x1="18" y1="20" x2="78" y2="76">`,
    `<stop offset="0%" stop-color="${panel.accent}" stop-opacity="0.94" />`,
    `<stop offset="100%" stop-color="${panel.depth}" stop-opacity="0.9" />`,
    `</linearGradient>`,
    `<filter id="grain">`,
    `<feTurbulence type="fractalNoise" baseFrequency="0.82" numOctaves="2" seed="${turbulenceSeed}" />`,
    `<feComponentTransfer>`,
    `<feFuncA type="table" tableValues="0 0.14" />`,
    `</feComponentTransfer>`,
    `</filter>`,
    `</defs>`,
    `<rect width="96" height="96" rx="26" fill="url(#bg)" />`,
    `<circle cx="70" cy="24" r="12" fill="white" fill-opacity="0.14" />`,
    `<path d="M22 28c0-5.523 4.477-10 10-10h32c5.523 0 10 4.477 10 10v24c0 5.523-4.477 10-10 10H46l-11 12v-12H32c-5.523 0-10-4.477-10-10z" fill="url(#panel)" />`,
    `<path d="M34 38h24M34 46h18" stroke="white" stroke-opacity="0.22" stroke-width="3" stroke-linecap="round" />`,
    `<rect width="96" height="96" rx="26" filter="url(#grain)" opacity="0.24" />`,
    `<text x="47" y="48" text-anchor="middle" dominant-baseline="middle" font-family="ui-sans-serif, 'IBM Plex Sans', sans-serif" font-size="28" font-weight="700" fill="white">${label}</text>`,
    `</svg>`,
  ].join("");
};

export const renderProfileFallbackSvg = (input: ProfileIconSeed): string => {
  const seedValue = buildProfileSeed(input);
  const seed = hashString(seedValue);
  const accentHue = seed % 360;
  const background = buildRadialStops(seed, accentHue);
  const label = escapeXml(labelFromValue(input.label ?? "", seedValue.slice(0, 1).toUpperCase()));
  const orbCx = percent(0.24 + fractionFromSeed(seed, 1) * 0.52);
  const orbCy = percent(0.18 + fractionFromSeed(seed, 2) * 0.48);
  const turbulenceSeed = (seed % 997) + 1;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96" fill="none">`,
    `<defs>`,
    `<radialGradient id="bg" cx="${orbCx}" cy="${orbCy}" r="76%">`,
    `<stop offset="0%" stop-color="${background.accent}" />`,
    `<stop offset="100%" stop-color="${background.depth}" />`,
    `</radialGradient>`,
    `<filter id="grain">`,
    `<feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="${turbulenceSeed}" />`,
    `<feComponentTransfer>`,
    `<feFuncA type="table" tableValues="0 0.12" />`,
    `</feComponentTransfer>`,
    `</filter>`,
    `</defs>`,
    `<rect width="96" height="96" rx="48" fill="url(#bg)" />`,
    `<circle cx="48" cy="34" r="17" fill="white" fill-opacity="0.18" />`,
    `<path d="M20 76c2-14 13-24 28-24s26 10 28 24" stroke="white" stroke-opacity="0.24" stroke-width="10" stroke-linecap="round" />`,
    `<rect width="96" height="96" rx="48" filter="url(#grain)" opacity="0.28" />`,
    `<text x="48" y="50" text-anchor="middle" dominant-baseline="middle" font-family="ui-sans-serif, 'IBM Plex Sans', sans-serif" font-size="34" font-weight="700" fill="white">${label}</text>`,
    `</svg>`,
  ].join("");
};
