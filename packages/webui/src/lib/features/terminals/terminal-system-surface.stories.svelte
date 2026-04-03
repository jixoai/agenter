<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';

	import Harness from './terminal-system-surface.story-harness.svelte';

	const { Story } = defineMeta({
		title: 'Features/Terminals/TerminalSystemSurface',
		component: Harness,
	});
</script>

<Story
	name="Scenario: Given a live terminal operator surface When a write tool fact is submitted Then the actions rail and terminal viewport stay synchronized"
	asChild
>
	<Harness />
</Story>
