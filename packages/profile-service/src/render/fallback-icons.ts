import type { ProfileIconSeed, SessionIconSeed } from "../types";
import { fractionFromSeed, hashString } from "./hash";

const escapeXml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

const percent = (value: number): string => `${Math.round(value * 100)}%`;

const buildRadialStops = (seed: number, accentHue: number) => {
  const glowHue = (accentHue + 30 + Math.round(fractionFromSeed(seed, 4) * 80)) % 360;
  const lightness = 0.78 + fractionFromSeed(seed, 5) * 0.12;
  const chroma = 0.1 + fractionFromSeed(seed, 6) * 0.08;
  return {
    accent: `oklch(${lightness.toFixed(3)} ${chroma.toFixed(3)} ${accentHue})`,
    glow: `oklch(${(lightness - 0.08).toFixed(3)} ${(chroma + 0.02).toFixed(3)} ${glowHue})`,
    depth: `oklch(${(0.34 + fractionFromSeed(seed, 7) * 0.14).toFixed(3)} ${(0.08 + fractionFromSeed(seed, 8) * 0.06).toFixed(3)} ${accentHue})`,
  };
};

const labelFromValue = (value: string | undefined, fallback: string): string => {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : fallback;
};

const normalizeIdentifierSeed = (input: ProfileIconSeed): string => `${input.identifier.kind}:${input.identifier.value.trim()}`;

export const buildProfileIconUrl = (identifier: string): string =>
  `/media/profiles/${encodeURIComponent(identifier)}/icon`;

export const buildSessionIconUrl = (sessionId: string): string =>
  `/media/sessions/${encodeURIComponent(sessionId)}/icon`;

export const renderSessionFallbackSvg = (input: SessionIconSeed): string => {
  const seed = hashString(`${input.workspacePath}::${input.sessionId}`);
  const accentHue = seed % 360;
  const foregroundHue = hashString(input.sessionId) % 360;
  const background = buildRadialStops(seed, accentHue);
  const foreground = buildRadialStops(hashString(input.sessionId), foregroundHue);
  const labelSource = labelFromValue(input.label, String(hashString(input.sessionId) % 100).padStart(2, "0"));
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
    `<feComponentTransfer><feFuncA type="table" tableValues="0 0.18" /></feComponentTransfer>`,
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

export const renderProfileFallbackSvg = (input: ProfileIconSeed): string => {
  const seedKey = normalizeIdentifierSeed(input);
  const seed = hashString(seedKey);
  const accentHue = seed % 360;
  const background = buildRadialStops(seed, accentHue);
  const fallbackLabel = input.identifier.value.trim().slice(0, 1).toUpperCase() || input.identifier.kind.slice(0, 1).toUpperCase();
  const label = escapeXml(labelFromValue(input.label, fallbackLabel));
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
    `<feComponentTransfer><feFuncA type="table" tableValues="0 0.12" /></feComponentTransfer>`,
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
