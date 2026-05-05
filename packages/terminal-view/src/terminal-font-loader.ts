import type { TerminalFontProfile } from "./terminal-renderer-profile";
import {
  resolveTerminalFontCatalogEntry,
  type TerminalFontAssetFace,
  type TerminalFontCatalogEntry,
} from "./terminal-font-catalog";

const injectedStylesheetMarkers = new Set<string>();
const preparedFontPromises = new Map<string, Promise<void>>();
export { resolvePrimaryTerminalFontFamily } from "./terminal-font-catalog";

export const resolveTerminalFontAsset = (familyStack: string): TerminalFontCatalogEntry | null =>
  resolveTerminalFontCatalogEntry(familyStack);

const serializeFontFace = (face: TerminalFontAssetFace): string => {
  const rules = [
    `font-family: '${face.family}';`,
    `font-style: ${face.style};`,
    `font-display: ${face.display ?? "swap"};`,
    `font-weight: ${face.weight};`,
    `src: ${face.src};`,
  ];
  if (face.unicodeRange) {
    rules.push(`unicode-range: ${face.unicodeRange};`);
  }
  return `@font-face {${rules.join("")}}`;
};

const ensureTerminalFontStylesheet = (asset: TerminalFontCatalogEntry): void => {
  if (asset.kind !== "webfont" || typeof document === "undefined") {
    return;
  }
  if (injectedStylesheetMarkers.has(asset.key)) {
    return;
  }
  const marker = `agenter-terminal-font-${asset.key}`;
  if (document.head.querySelector(`style[data-terminal-font-asset="${marker}"]`)) {
    injectedStylesheetMarkers.add(asset.key);
    return;
  }
  // Host-local @font-face rules are not authoritative for terminal-view. The
  // terminal surface must own its optional webfont assets so browser evidence
  // and renderer settle stay traceable to one explicit source.
  const style = document.createElement("style");
  style.setAttribute("data-terminal-font-asset", marker);
  style.textContent = asset.faces.map(serializeFontFace).join("\n");
  document.head.append(style);
  injectedStylesheetMarkers.add(asset.key);
};

const loadDeclaredFontFaces = async (
  asset: TerminalFontCatalogEntry,
  font: Pick<TerminalFontProfile, "sizePx" | "weight" | "weightBold">,
): Promise<void> => {
  if (asset.kind !== "webfont" || typeof document === "undefined" || !document.fonts) {
    return;
  }
  const probeText = "MW@#";
  const normalDescriptor = `${font.weight} ${font.sizePx}px '${asset.family}'`;
  const boldDescriptor = `${font.weightBold} ${font.sizePx}px '${asset.family}'`;
  await Promise.allSettled([
    document.fonts.load(normalDescriptor, probeText),
    document.fonts.load(boldDescriptor, probeText),
  ]);
  await document.fonts.ready.catch(() => undefined);
};

export const ensureTerminalFontPrepared = async (
  font: Pick<TerminalFontProfile, "family" | "sizePx" | "weight" | "weightBold">,
): Promise<void> => {
  const asset = resolveTerminalFontAsset(font.family);
  if (!asset) {
    return;
  }
  const promiseKey = `${asset.key}|${font.sizePx}|${font.weight}|${font.weightBold}`;
  const existing = preparedFontPromises.get(promiseKey);
  if (existing) {
    await existing;
    return;
  }
  const pending = (async () => {
    ensureTerminalFontStylesheet(asset);
    await loadDeclaredFontFaces(asset, font);
  })();
  preparedFontPromises.set(promiseKey, pending);
  try {
    await pending;
  } catch (error) {
    preparedFontPromises.delete(promiseKey);
    throw error;
  }
};

export const __resetTerminalFontLoaderForTests = (): void => {
  injectedStylesheetMarkers.clear();
  preparedFontPromises.clear();
};
