import {
  LUCIDE_SLOT_PREFIX,
  type LucideIconAsset,
  type LucideIconAssetMap,
  type LucideIconCatalogEntry,
} from "./icon-system-contract";
import { lucideIconCatalog } from "./generated/lucide/catalog.js";
import { lucideIconChunkLoaders } from "./generated/lucide/loaders.js";

const catalogMap = new Map(lucideIconCatalog.map((icon) => [icon.id, icon]));
const alphabeticalCatalog = [...lucideIconCatalog].sort((left, right) =>
  left.label.localeCompare(right.label),
);
const chunkLoaderMap: Record<string, () => Promise<LucideIconAssetMap>> =
  lucideIconChunkLoaders;
const chunkCache = new Map<string, Promise<LucideIconAssetMap>>();
const iconAssetCache = new Map<string, Promise<LucideIconAsset | null>>();

const normalizeQuery = (value: string): string =>
  value
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/gu, " ")
    .trim();

const getScore = (query: string, icon: LucideIconCatalogEntry): number => {
  let bestScore = -1;

  for (const term of icon.terms) {
    if (term === query) {
      return 1000;
    }
    if (term.startsWith(query)) {
      bestScore = Math.max(
        bestScore,
        850 - Math.max(0, term.length - query.length),
      );
      continue;
    }

    const wordStartScore = term
      .split(" ")
      .reduce(
        (score, word) =>
          word.startsWith(query)
            ? Math.max(score, 725 - (word.length - query.length))
            : score,
        bestScore,
      );
    bestScore = Math.max(bestScore, wordStartScore);

    const includeIndex = term.indexOf(query);
    if (includeIndex >= 0) {
      bestScore = Math.max(bestScore, 600 - includeIndex);
    }
  }

  return bestScore;
};

export const createLucideSlotId = (iconId: string): string =>
  `${LUCIDE_SLOT_PREFIX}${iconId}`;

export const parseLucideSlotId = (slotId: string): string | null =>
  slotId.startsWith(LUCIDE_SLOT_PREFIX)
    ? slotId.slice(LUCIDE_SLOT_PREFIX.length)
    : null;

export const isLucideSlotId = (slotId: string): boolean =>
  parseLucideSlotId(slotId) !== null;

export const getLucideIconById = (
  iconId: string,
): LucideIconCatalogEntry | null => catalogMap.get(iconId) ?? null;

export const getLucideIconBySlotId = (
  slotId: string,
): LucideIconCatalogEntry | null => {
  const iconId = parseLucideSlotId(slotId);
  return iconId ? getLucideIconById(iconId) : null;
};

export const searchLucideIcons = (
  query: string,
  limit = 12,
): LucideIconCatalogEntry[] => {
  const normalizedQuery = normalizeQuery(query);
  if (!normalizedQuery) {
    return [];
  }

  return lucideIconCatalog
    .map((icon) => ({
      icon,
      score: getScore(normalizedQuery, icon),
    }))
    .filter((entry) => entry.score >= 0)
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.icon.label.localeCompare(right.icon.label),
    )
    .slice(0, limit)
    .map((entry) => entry.icon);
};

export const listLucideIcons = (
  limit = alphabeticalCatalog.length,
): LucideIconCatalogEntry[] => alphabeticalCatalog.slice(0, limit);

const loadChunk = async (chunkId: string): Promise<LucideIconAssetMap> => {
  const existing = chunkCache.get(chunkId);
  if (existing) {
    return existing;
  }

  const loader = chunkLoaderMap[chunkId];
  if (!loader) {
    return {};
  }

  const loadingChunk = loader();
  chunkCache.set(chunkId, loadingChunk);
  return loadingChunk;
};

export const loadLucideIconAsset = async (
  iconId: string,
): Promise<LucideIconAsset | null> => {
  const cached = iconAssetCache.get(iconId);
  if (cached) {
    return cached;
  }

  const loadingAsset = (async () => {
    const icon = getLucideIconById(iconId);
    if (!icon) {
      return null;
    }

    const chunk = await loadChunk(icon.chunkId);
    return chunk[iconId] ?? null;
  })();

  iconAssetCache.set(iconId, loadingAsset);
  return loadingAsset;
};

export const renderLucideSlotMarkup = (asset: LucideIconAsset): string =>
  `<svg viewBox="${asset.viewBox.join(" ")}">${asset.markup}</svg>`;
