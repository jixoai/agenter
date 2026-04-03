<script lang="ts">
	import RuntimeShell from '$lib/features/runtime/runtime-shell.svelte';
	import type { PageProps } from './$types';

	let { params }: PageProps = $props();
</script>

<RuntimeShell sessionId={params.sessionId} tab={params.tab} />
