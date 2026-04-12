<script lang="ts">
	import { page } from '$app/state';

	import WorkspacesRoute from '$lib/features/workspaces/workspaces-route.svelte';
</script>

<WorkspacesRoute workspacePath={page.params.workspaceRoot ?? ''} />
