import cascadiaMono400LatinWoff2 from "@fontsource/cascadia-mono/files/cascadia-mono-latin-400-normal.woff2";
import cascadiaMono700LatinWoff2 from "@fontsource/cascadia-mono/files/cascadia-mono-latin-700-normal.woff2";
import firaCode400LatinWoff2 from "@fontsource/fira-code/files/fira-code-latin-400-normal.woff2";
import firaCode700LatinWoff2 from "@fontsource/fira-code/files/fira-code-latin-700-normal.woff2";
import geistMono400LatinWoff2 from "@fontsource/geist-mono/files/geist-mono-latin-400-normal.woff2";
import geistMono700LatinWoff2 from "@fontsource/geist-mono/files/geist-mono-latin-700-normal.woff2";
import ibmPlexMono400LatinWoff2 from "@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2";
import ibmPlexMono700LatinWoff2 from "@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-700-normal.woff2";
import jetbrainsMono400LatinWoff2 from "@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff2";
import jetbrainsMono700LatinWoff2 from "@fontsource/jetbrains-mono/files/jetbrains-mono-latin-700-normal.woff2";
import sourceCodePro400LatinWoff2 from "@fontsource/source-code-pro/files/source-code-pro-latin-400-normal.woff2";
import sourceCodePro700LatinWoff2 from "@fontsource/source-code-pro/files/source-code-pro-latin-700-normal.woff2";

import { DEFAULT_TERMINAL_FONT } from "./terminal-renderer-profile";

export interface TerminalFontAssetFace {
  family: string;
  style: string;
  weight: string;
  src: string;
  unicodeRange?: string;
  display?: string;
}

export interface TerminalFontCatalogEntry {
  key: string;
  label: string;
  family: string;
  stack: string;
  kind: "system" | "webfont";
  faces: readonly TerminalFontAssetFace[];
}

export interface TerminalFontFamilyOption {
  key: string;
  label: string;
  value: string;
}

const TERMINAL_FONT_DISPLAY = "swap";
const TERMINAL_FONT_LATIN_RANGE =
  "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD";

const createFace = (input: Omit<TerminalFontAssetFace, "display" | "unicodeRange">): TerminalFontAssetFace => ({
  ...input,
  display: TERMINAL_FONT_DISPLAY,
  unicodeRange: TERMINAL_FONT_LATIN_RANGE,
});

const createFontStack = (family: string): string => `'${family}', ${DEFAULT_TERMINAL_FONT.family}`;

const createWebfontEntry = (
  key: string,
  label: string,
  family: string,
  regularSrc: string,
  boldSrc: string,
): TerminalFontCatalogEntry => ({
  key,
  label,
  family,
  stack: createFontStack(family),
  kind: "webfont",
  faces: [
    createFace({
      family,
      style: "normal",
      weight: "400",
      src: `url(${regularSrc}) format('woff2')`,
    }),
    createFace({
      family,
      style: "normal",
      weight: "700",
      src: `url(${boldSrc}) format('woff2')`,
    }),
  ],
});

// Keep terminal font truth inside terminal-view so hosts can switch renderers,
// hosts, or settings surfaces without duplicating font availability rules.
export const TERMINAL_FONT_CATALOG = [
  {
    key: "system-mono",
    label: "System Mono",
    family: "ui-monospace",
    stack: DEFAULT_TERMINAL_FONT.family,
    kind: "system",
    faces: [],
  },
  {
    key: "sf-mono",
    label: "SF Mono",
    family: "SF Mono",
    stack: "'SF Mono', 'SFMono-Regular', Menlo, Consolas, ui-monospace, monospace",
    kind: "system",
    faces: [],
  },
  createWebfontEntry(
    "jetbrains-mono",
    "JetBrains Mono",
    "JetBrains Mono",
    jetbrainsMono400LatinWoff2,
    jetbrainsMono700LatinWoff2,
  ),
  createWebfontEntry(
    "ibm-plex-mono",
    "IBM Plex Mono",
    "IBM Plex Mono",
    ibmPlexMono400LatinWoff2,
    ibmPlexMono700LatinWoff2,
  ),
  createWebfontEntry(
    "cascadia-mono",
    "Cascadia Mono",
    "Cascadia Mono",
    cascadiaMono400LatinWoff2,
    cascadiaMono700LatinWoff2,
  ),
  createWebfontEntry(
    "source-code-pro",
    "Source Code Pro",
    "Source Code Pro",
    sourceCodePro400LatinWoff2,
    sourceCodePro700LatinWoff2,
  ),
  createWebfontEntry("fira-code", "Fira Code", "Fira Code", firaCode400LatinWoff2, firaCode700LatinWoff2),
  createWebfontEntry("geist-mono", "Geist Mono", "Geist Mono", geistMono400LatinWoff2, geistMono700LatinWoff2),
] as const satisfies readonly TerminalFontCatalogEntry[];

const terminalFontEntryByFamily = new Map<string, TerminalFontCatalogEntry>(
  TERMINAL_FONT_CATALOG.map((entry) => [entry.family, entry]),
);

const normalizeQuotedFontFamily = (family: string): string => family.trim().replace(/^['"]|['"]$/g, "");

export const splitFontFamilyStack = (input: string): string[] => {
  const families: string[] = [];
  let current = "";
  let quote: '"' | "'" | null = null;

  for (const char of input) {
    if (quote) {
      current += char;
      if (char === quote) {
        quote = null;
      }
      continue;
    }
    if (char === '"' || char === "'") {
      current += char;
      quote = char;
      continue;
    }
    if (char === ",") {
      const normalized = current.trim();
      if (normalized.length > 0) {
        families.push(normalized);
      }
      current = "";
      continue;
    }
    current += char;
  }

  const tail = current.trim();
  if (tail.length > 0) {
    families.push(tail);
  }
  return families;
};

export const resolvePrimaryTerminalFontFamily = (input: string): string => {
  const primary = splitFontFamilyStack(input)[0];
  return primary && primary.length > 0 ? primary : "monospace";
};

export const resolveTerminalFontCatalogEntry = (familyStack: string): TerminalFontCatalogEntry | null => {
  const primaryFamily = normalizeQuotedFontFamily(resolvePrimaryTerminalFontFamily(familyStack));
  return terminalFontEntryByFamily.get(primaryFamily) ?? null;
};

export const TERMINAL_FONT_FAMILY_OPTIONS = TERMINAL_FONT_CATALOG.map((entry) => ({
  key: entry.key,
  label: entry.label,
  value: entry.stack,
})) satisfies readonly TerminalFontFamilyOption[];
