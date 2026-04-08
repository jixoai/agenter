<script lang="ts">
	import TerminalsWorkbenchLayout from '$lib/features/terminals/terminals-workbench-layout.svelte';

	let { children } = $props();
</script>

<TerminalsWorkbenchLayout>
	{@render children()}
</TerminalsWorkbenchLayout>
