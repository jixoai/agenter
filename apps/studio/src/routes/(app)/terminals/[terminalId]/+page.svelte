<script lang="ts">
	import TerminalRoute from '$lib/features/terminals/terminal-route.svelte';
	import type { PageProps } from './$types';

	let { params }: PageProps = $props();
</script>

<TerminalRoute terminalId={params.terminalId} />
