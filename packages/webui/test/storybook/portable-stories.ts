import { composeStories } from '@storybook/sveltekit';

type PortableStoriesInput = Parameters<typeof composeStories>[0];
type PortableStory = {
	run: () => Promise<void>;
};

export const asPortableStories = (stories: unknown): PortableStoriesInput =>
	// Svelte CSF story modules are transformed by Vite at runtime, but the static TS view still sees a component module.
	stories as PortableStoriesInput;

export const getPortableStory = (stories: unknown, exportName: string): PortableStory => {
	const composedStories = composeStories(asPortableStories(stories)) as Record<string, PortableStory>;
	const story = composedStories[exportName];
	if (!story) {
		throw new Error(`Portable story "${exportName}" is missing from the composed module.`);
	}
	return story;
};
