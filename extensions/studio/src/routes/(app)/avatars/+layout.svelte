<script lang="ts">
	import AvatarsWorkbenchLayout from '$lib/features/avatars/avatars-workbench-layout.svelte';

	let { children } = $props();
</script>

<AvatarsWorkbenchLayout>
	{@render children()}
</AvatarsWorkbenchLayout>
