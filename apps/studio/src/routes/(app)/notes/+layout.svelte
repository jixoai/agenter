<script lang="ts">
	import NotesWorkbenchLayout from '$lib/features/notes/notes-workbench-layout.svelte';

	let { children } = $props();
</script>

<NotesWorkbenchLayout>
	{@render children()}
</NotesWorkbenchLayout>
