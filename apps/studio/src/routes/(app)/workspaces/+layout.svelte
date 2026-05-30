<script lang="ts">
	import WorkspacesWorkbenchLayout from '$lib/features/workspaces/workspaces-workbench-layout.svelte';

	let { children } = $props();
</script>

<WorkspacesWorkbenchLayout>
	{@render children()}
</WorkspacesWorkbenchLayout>
