<script lang="ts">
	import StructuredValueViewer from '$lib/components/structured-value/structured-value-viewer.svelte';

	let {
		value,
		rawText = '',
		menuLabel = 'Structured value options',
		plain = false,
		class: className = '',
	}: {
		value: unknown;
		rawText?: string;
		menuLabel?: string;
		plain?: boolean;
		class?: string;
	} = $props();
</script>

<StructuredValueViewer {value} {rawText} {menuLabel} {plain} class={className} />
