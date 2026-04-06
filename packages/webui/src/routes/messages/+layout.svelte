<script lang="ts">
	import MessagesWorkbenchLayout from '$lib/features/messages/messages-workbench-layout.svelte';

	let { children } = $props();
</script>

<MessagesWorkbenchLayout>
	{@render children()}
</MessagesWorkbenchLayout>
