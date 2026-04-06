<script lang="ts">
	import { getWorkbenchPageToolbarRegistry } from './workbench-page-toolbar-context.svelte';

	let {
		children,
	}: {
		children?: import('svelte').Snippet;
	} = $props();

	const registry = getWorkbenchPageToolbarRegistry();

	$effect(() => {
		const content = children ?? null;
		registry.set(content);
		return () => {
			registry.clear(content);
		};
	});
</script>
