<script lang="ts">
	import NetworkIcon from '@lucide/svelte/icons/network';
	import { goto } from '$app/navigation';
	import type { Snippet } from 'svelte';

	import type { WorkbenchTabItem } from '$lib/features/navigation/workbench-tab-strip.svelte';
	import WorkbenchWindow from '$lib/features/navigation/workbench-window.svelte';

	let {
		children,
	}: {
		children?: Snippet;
	} = $props();

	const tabs = [
		{
			id: 'mcp',
			href: '/mcp',
			label: 'MCP',
			icon: NetworkIcon,
			title: 'MCP workbench',
			description: 'Runtime MCP projection.',
		},
	] satisfies WorkbenchTabItem[];

	const handleWorkbenchValueChange = async (): Promise<void> => {
		await goto('/mcp', {
			noScroll: true,
			keepFocus: true,
		});
	};
</script>

<div class="h-full" data-testid="mcp-workbench">
	<WorkbenchWindow ariaLabel="MCP workbench tabs" value="mcp" {tabs} onValueChange={handleWorkbenchValueChange} bodyMode="fill">
		<div class="min-h-full">{@render children?.()}</div>
	</WorkbenchWindow>
</div>
