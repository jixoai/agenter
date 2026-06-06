<script lang="ts">
	import type { Snippet } from 'svelte';

	import McpWorkbenchLayout from '$lib/features/mcp/mcp-workbench-layout.svelte';

	let {
		children,
	}: {
		children?: Snippet;
	} = $props();
</script>

<McpWorkbenchLayout>
	{@render children?.()}
</McpWorkbenchLayout>
