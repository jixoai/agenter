<script lang="ts">
	import StructuredValueViewer from '$lib/components/structured-value/structured-value-viewer.svelte';

	let {
		value,
		rawText = '',
		menuLabel = 'Structured value options',
		class: className = '',
	}: {
		value: unknown;
		rawText?: string;
		menuLabel?: string;
		class?: string;
	} = $props();
</script>

<StructuredValueViewer {value} {rawText} {menuLabel} class={className} />
