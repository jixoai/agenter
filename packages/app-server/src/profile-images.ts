import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, extname, join } from "node:path";

import {
  normalizeAvatarNickname,
  resolveAvatarIconCandidates,
  resolveAvatarSources,
  type ResolvedAvatar,
} from "@agenter/avatar";

const IMAGE_MIME_BY_EXT: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

const EXT_BY_IMAGE_MIME: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/svg+xml": ".svg",
  "image/webp": ".webp",
};

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

const labelFromValue = (value: string, fallback: string): string => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
};

export const buildSessionIconUrl = (sessionId: string): string =>
  `/media/sessions/${encodeURIComponent(sessionId)}/icon`;

export const buildAvatarIconUrl = (nickname: string, workspacePath?: string | null): string => {
  const base = `/media/avatars/${encodeURIComponent(normalizeAvatarNickname(nickname))}/icon`;
  if (!workspacePath || workspacePath.trim().length === 0) {
    return base;
  }
  return `${base}?workspacePath=${encodeURIComponent(workspacePath)}`;
};

const resolveUploadedIconExtension = (name: string, mimeType: string): string => {
  const normalizedMime = mimeType.trim().toLowerCase();
  if (EXT_BY_IMAGE_MIME[normalizedMime]) {
    return EXT_BY_IMAGE_MIME[normalizedMime];
  }
  const byName = extname(name).toLowerCase();
  return IMAGE_MIME_BY_EXT[byName] ? byName : ".webp";
};

const resolveSessionIconCandidates = (sessionRoot: string): string[] =>
  [".webp", ".png", ".jpg", ".jpeg", ".svg"].map((extension) => join(sessionRoot, "profile", `session-icon${extension}`));

const resolveMimeFromPath = (filePath: string): string => IMAGE_MIME_BY_EXT[extname(filePath).toLowerCase()] ?? "application/octet-stream";

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

export const renderSessionFallbackSvg = (input: {
  sessionId: string;
  workspacePath: string;
  label?: string;
}): string => {
  const seed = hashString(`${input.workspacePath}::${input.sessionId}`);
  const accentHue = seed % 360;
  const foregroundHue = hashString(input.sessionId) % 360;
  const background = buildRadialStops(seed, accentHue);
  const foreground = buildRadialStops(hashString(input.sessionId), foregroundHue);
  const labelSource = labelFromValue(input.label ?? "", String(hashString(input.sessionId) % 100).padStart(2, "0"));
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

export const renderAvatarFallbackSvg = (input: { nickname: string; label?: string }): string => {
  const nickname = normalizeAvatarNickname(input.nickname);
  const seed = hashString(nickname);
  const accentHue = seed % 360;
  const background = buildRadialStops(seed, accentHue);
  const label = escapeXml(labelFromValue(input.label ?? "", nickname.slice(0, 1).toUpperCase()));
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

export const resolveAvatarUserRoot = (nickname: string, homeDir = homedir()): string =>
  join(homeDir, ".agenter", "avatar", normalizeAvatarNickname(nickname));

export const resolveSessionIconFile = (sessionRoot: string): { filePath: string; mimeType: string; sizeBytes: number } | null => {
  const filePath = resolveSessionIconCandidates(sessionRoot).find((candidate) => existsSync(candidate));
  if (!filePath) {
    return null;
  }
  const stat = statSync(filePath);
  return {
    filePath,
    mimeType: resolveMimeFromPath(filePath),
    sizeBytes: stat.size,
  };
};

export const resolveAvatarIconFile = (
  avatar: ResolvedAvatar,
): { filePath: string; mimeType: string; sizeBytes: number } | null => {
  const filePath = resolveAvatarIconCandidates(avatar).at(-1);
  if (!filePath || !existsSync(filePath)) {
    return null;
  }
  const stat = statSync(filePath);
  return {
    filePath,
    mimeType: resolveMimeFromPath(filePath),
    sizeBytes: stat.size,
  };
};

export const createAvatarCatalogItem = (input: { nickname: string; workspacePath?: string | null; active?: boolean }) => ({
  nickname: normalizeAvatarNickname(input.nickname),
  active: input.active ?? false,
  iconUrl: buildAvatarIconUrl(input.nickname, input.workspacePath),
});

export const listUserAvatarNicknames = (homeDir = homedir()): string[] => {
  const root = join(homeDir, ".agenter", "avatar");
  if (!existsSync(root)) {
    return [];
  }
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => basename(entry.name))
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right));
};

export const writeSessionIconUpload = (sessionRoot: string, file: { bytes: Uint8Array; name: string; mimeType: string }): string => {
  const filePath = join(sessionRoot, "profile", `session-icon${resolveUploadedIconExtension(file.name, file.mimeType)}`);
  mkdirSync(join(sessionRoot, "profile"), { recursive: true });
  writeFileSync(filePath, file.bytes);
  return filePath;
};

export const writeAvatarIconUpload = (
  nickname: string,
  file: { bytes: Uint8Array; name: string; mimeType: string },
  homeDir = homedir(),
): string => {
  const avatarRoot = resolveAvatarUserRoot(nickname, homeDir);
  mkdirSync(avatarRoot, { recursive: true });
  const filePath = join(avatarRoot, `icon${resolveUploadedIconExtension(file.name, file.mimeType)}`);
  writeFileSync(filePath, file.bytes);
  return filePath;
};

export const resolveAvatarForWorkspace = (workspacePath: string, nickname: string, homeDir = homedir()): ResolvedAvatar =>
  resolveAvatarSources({
    nickname,
    projectRoot: workspacePath,
    homeDir,
  });
