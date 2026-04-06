import type { ProfileIconSeed, RoomIconSeed, SessionIconSeed } from "../types";

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

export const buildProfileIconUrl = (identifier: string): string =>
  `/media/profiles/${encodeURIComponent(identifier)}/icon`;

export const buildSessionIconUrl = (sessionId: string): string =>
  `/media/sessions/${encodeURIComponent(sessionId)}/icon`;

export const buildRoomIconUrl = (roomId: string): string =>
  `/media/rooms/${encodeURIComponent(roomId)}/icon`;

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
