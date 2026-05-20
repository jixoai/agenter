import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";

import sharp from "sharp";

const repoRoot = resolve(import.meta.dirname, "..", "..");
const lucideRoot = resolve(repoRoot, "node_modules", ".bun", "node_modules", "@lucide", "svelte");
const lucideIconsDir = resolve(lucideRoot, "dist", "icons");
const lucideAliasesPath = resolve(lucideRoot, "dist", "aliases", "aliases.js");
const outputDir = resolve(repoRoot, "packages", "icon-studio", "src", "lib", "icon-studio", "generated", "lucide");
const outputChunksDir = resolve(outputDir, "chunks");
const lucideCanvasSize = 24;
const lucideRasterSize = 192;

type IconNodeEntry = [tag: string, attributes: Record<string, boolean | number | string>];
type RawImage = {
  data: Buffer;
  info: {
    channels: number;
    height: number;
    width: number;
  };
};

interface GeneratedLucideMetadata {
  aliases: string[];
  chunkId: string;
  id: string;
  label: string;
  terms: string[];
}

interface GeneratedLucideAsset {
  id: string;
  label: string;
  markup: string;
  viewBox: [number, number, number, number];
}

const DEFAULT_GROUP_ATTRIBUTES = {
  fill: "none",
  stroke: "currentColor",
  "stroke-linecap": "round",
  "stroke-linejoin": "round",
  "stroke-width": 2,
} as const;

const escapeAttribute = (value: boolean | number | string): string =>
  String(value).replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

const kebabToLabel = (value: string): string =>
  value
    .split("-")
    .filter(Boolean)
    .map((segment, index, segments) => {
      if (/^\d+$/.test(segment)) {
        const next = segments[index + 1];
        return next && /^[a-z]$/.test(next) ? `${segment}${next.toUpperCase()}` : segment;
      }
      if (segment.length === 1) {
        return segment.toUpperCase();
      }
      if (/\d/.test(segment)) {
        return segment.toUpperCase();
      }
      return `${segment[0]?.toUpperCase() ?? ""}${segment.slice(1)}`;
    })
    .join(" ");

const aliasToSearchTerm = (value: string): string =>
  value
    .replaceAll(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replaceAll(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .toLowerCase();

const normalizeSearchTerm = (value: string): string =>
  value
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, " ")
    .trim();

const getChunkId = (iconId: string): string => {
  const firstCharacter = iconId[0]?.toLowerCase() ?? "misc";
  return /^[a-z]$/.test(firstCharacter) ? firstCharacter : "misc";
};

const readAliasMap = async (): Promise<Map<string, string[]>> => {
  const aliasSource = await readFile(lucideAliasesPath, "utf8");
  const aliasMap = new Map<string, string[]>();
  const aliasPattern = /default as ([A-Za-z0-9]+) } from '\.\.\/icons\/([^']+)\.js';/g;
  for (const match of aliasSource.matchAll(aliasPattern)) {
    const aliasName = aliasToSearchTerm(match[1] ?? "");
    const iconId = match[2] ?? "";
    const existing = aliasMap.get(iconId) ?? [];
    if (aliasName && !existing.includes(aliasName)) {
      existing.push(aliasName);
    }
    aliasMap.set(iconId, existing);
  }
  return aliasMap;
};

const parseIconNode = (source: string): IconNodeEntry[] => {
  const iconNodeMatch = source.match(/const iconNode = (\[[\s\S]*?\]);/);
  if (!iconNodeMatch?.[1]) {
    throw new Error("Unable to parse Lucide iconNode");
  }

  return Function(`"use strict"; return (${iconNodeMatch[1]});`)() as IconNodeEntry[];
};

const renderAttributes = (attributes: Record<string, boolean | number | string>): string =>
  Object.entries(attributes)
    .map(([key, value]) => ` ${key}="${escapeAttribute(value)}"`)
    .join("");

const iconNodeToMarkup = (iconNode: IconNodeEntry[]): string => {
  const children = iconNode.map(([tag, attributes]) => `<${tag}${renderAttributes(attributes)}/>`).join("");
  return `<g${renderAttributes(DEFAULT_GROUP_ATTRIBUTES)}>${children}</g>`;
};

const readRaw = async (svg: string): Promise<RawImage> =>
  (await sharp(Buffer.from(svg))
    .resize(lucideRasterSize, lucideRasterSize)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })) as RawImage;

const findAlphaBounds = (rawImage: RawImage): { height: number; width: number; x: number; y: number } | null => {
  const alphaIndex = rawImage.info.channels - 1;
  let minX = rawImage.info.width;
  let minY = rawImage.info.height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < rawImage.info.height; y += 1) {
    for (let x = 0; x < rawImage.info.width; x += 1) {
      const offset = (y * rawImage.info.width + x) * rawImage.info.channels + alphaIndex;
      const alpha = rawImage.data[offset] ?? 0;
      if (alpha === 0) {
        continue;
      }
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (maxX < minX || maxY < minY) {
    return null;
  }

  return {
    height: maxY - minY + 1,
    width: maxX - minX + 1,
    x: minX,
    y: minY,
  };
};

const roundViewBoxValue = (value: number): number => Number(value.toFixed(3));

const deriveOpticalViewBox = async (markup: string): Promise<[number, number, number, number]> => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${lucideCanvasSize} ${lucideCanvasSize}">${markup}</svg>`;
  const rawImage = await readRaw(svg);
  const bounds = findAlphaBounds(rawImage);
  if (!bounds) {
    return [0, 0, lucideCanvasSize, lucideCanvasSize];
  }

  const pixelToUnitX = lucideCanvasSize / rawImage.info.width;
  const pixelToUnitY = lucideCanvasSize / rawImage.info.height;
  const bleedX = pixelToUnitX;
  const bleedY = pixelToUnitY;
  const x = Math.max(0, bounds.x * pixelToUnitX - bleedX / 2);
  const y = Math.max(0, bounds.y * pixelToUnitY - bleedY / 2);
  const right = Math.min(lucideCanvasSize, (bounds.x + bounds.width) * pixelToUnitX + bleedX / 2);
  const bottom = Math.min(lucideCanvasSize, (bounds.y + bounds.height) * pixelToUnitY + bleedY / 2);

  return [
    roundViewBoxValue(x),
    roundViewBoxValue(y),
    roundViewBoxValue(Math.max(pixelToUnitX, right - x)),
    roundViewBoxValue(Math.max(pixelToUnitY, bottom - y)),
  ];
};

const createMetadata = (id: string, aliases: string[]): GeneratedLucideMetadata => {
  const label = kebabToLabel(id);
  const chunkId = getChunkId(id);
  const terms = Array.from(
    new Set(
      [id, id.replaceAll("-", " "), label.toLowerCase(), ...aliases]
        .map((term) => normalizeSearchTerm(term))
        .filter(Boolean),
    ),
  );

  return {
    aliases,
    chunkId,
    id,
    label,
    terms,
  };
};

const toCode = (value: unknown): string => JSON.stringify(value, null, 2);

const writeGeneratedFiles = async (
  metadata: GeneratedLucideMetadata[],
  chunks: Map<string, GeneratedLucideAsset[]>,
): Promise<void> => {
  await rm(outputDir, { force: true, recursive: true });
  await mkdir(outputChunksDir, { recursive: true });

  const chunkIds = [...chunks.keys()].sort();

  await writeFile(
    resolve(outputDir, "catalog.ts"),
    `import type { LucideIconCatalogEntry } from '../../icon-system-contract.js';\n\nexport const lucideIconCatalog = ${toCode(metadata)} satisfies LucideIconCatalogEntry[];\n`,
    "utf8",
  );

  await writeFile(
    resolve(outputDir, "loaders.ts"),
    [
      `import type { LucideIconAssetMap } from '../../icon-system-contract.js';`,
      ``,
      `export const lucideIconChunkLoaders = {`,
      ...chunkIds.map(
        (chunkId) =>
          `  ${JSON.stringify(chunkId)}: () => import('./chunks/${chunkId}.js').then((module) => module.lucideIconChunk),`,
      ),
      `} satisfies Record<string, () => Promise<LucideIconAssetMap>>;`,
      ``,
    ].join("\n"),
    "utf8",
  );

  await Promise.all(
    chunkIds.map(async (chunkId) => {
      const icons = chunks.get(chunkId) ?? [];
      const record = Object.fromEntries(
        icons.sort((left, right) => left.id.localeCompare(right.id)).map((icon) => [icon.id, icon]),
      );
      await writeFile(
        resolve(outputChunksDir, `${chunkId}.ts`),
        `import type { LucideIconAssetMap } from '../../../icon-system-contract.js';\n\nexport const lucideIconChunk = ${toCode(record)} satisfies LucideIconAssetMap;\n`,
        "utf8",
      );
    }),
  );
};

const main = async (): Promise<void> => {
  const aliasMap = await readAliasMap();
  const iconFilenames = (await readdir(lucideIconsDir))
    .filter((filename) => filename.endsWith(".svelte") && !filename.endsWith(".svelte.d.ts"))
    .sort();

  const metadata: GeneratedLucideMetadata[] = [];
  const chunks = new Map<string, GeneratedLucideAsset[]>();

  for (const filename of iconFilenames) {
    const iconId = basename(filename, ".svelte");
    const iconSource = await readFile(resolve(lucideIconsDir, filename), "utf8");
    const iconNode = parseIconNode(iconSource);
    const markup = iconNodeToMarkup(iconNode);
    const aliases = aliasMap.get(iconId) ?? [];
    const iconMetadata = createMetadata(iconId, aliases);
    const iconAsset: GeneratedLucideAsset = {
      id: iconId,
      label: iconMetadata.label,
      markup,
      viewBox: await deriveOpticalViewBox(markup),
    };

    metadata.push(iconMetadata);
    const existingChunk = chunks.get(iconMetadata.chunkId) ?? [];
    existingChunk.push(iconAsset);
    chunks.set(iconMetadata.chunkId, existingChunk);
  }

  await writeGeneratedFiles(
    metadata.sort((left, right) => left.label.localeCompare(right.label)),
    chunks,
  );
};

void main();
