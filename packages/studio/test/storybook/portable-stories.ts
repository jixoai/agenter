import { createRuntimeStories } from "@storybook/addon-svelte-csf/internal/create-runtime-stories";
import { composeStories } from "@storybook/sveltekit";
import type { Component } from "svelte";

type PortableStoriesInput = Parameters<typeof composeStories>[0];
type PortableStory = {
  run: () => Promise<void>;
  storyName?: string;
  name?: string;
};
type RuntimeStoriesModule = {
  default?: Component;
  [key: string]: unknown;
};

const normalizeStoryNameToExportName = (storyName: string): string =>
  storyName
    .replace(/([A-Z])/g, " $1")
    .trim()
    .split(/[^A-Za-z0-9]+/u)
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");

const buildPortableStoriesInput = (stories: unknown): PortableStoriesInput => {
  const storyModule = stories as RuntimeStoriesModule;
  const composedStories = composeStories(storyModule as PortableStoriesInput) as Record<string, PortableStory>;
  if (Object.keys(composedStories).length > 0) {
    return storyModule as PortableStoriesInput;
  }

  if (!storyModule.default) {
    return storyModule as PortableStoriesInput;
  }

  const emptyMeta: Parameters<typeof createRuntimeStories>[1] = {};
  return {
    default: emptyMeta,
    ...createRuntimeStories(storyModule.default, emptyMeta),
  } as PortableStoriesInput;
};

export const asPortableStories = (stories: unknown): PortableStoriesInput =>
  // Svelte CSF story modules are transformed by Vite at runtime, but the static TS view still sees a component module.
  buildPortableStoriesInput(stories);

export const getPortableStory = (stories: unknown, exportName: string): PortableStory => {
  const composedStories = composeStories(asPortableStories(stories)) as Record<string, PortableStory>;
  const normalizedExportName = normalizeStoryNameToExportName(exportName);
  const story =
    composedStories[exportName] ??
    composedStories[normalizedExportName] ??
    Object.values(composedStories).find(
      (candidate) =>
        candidate.storyName === exportName ||
        candidate.name === exportName ||
        candidate.storyName === normalizedExportName ||
        candidate.name === normalizedExportName,
    );
  if (!story) {
    const availableStories = Object.entries(composedStories).map(([key, candidate]) => ({
      exportName: key,
      storyName: candidate.storyName ?? candidate.name ?? null,
    }));
    throw new Error(
      `Portable story "${exportName}" is missing from the composed module. Available stories: ${JSON.stringify(availableStories)}`,
    );
  }
  return story;
};
