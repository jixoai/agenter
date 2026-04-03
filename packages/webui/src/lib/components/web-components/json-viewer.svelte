<script lang="ts">
	import { JSON_VIEWER_TAG, defineJsonViewer, type JsonViewerElementType } from '@agenter/web-components';

	defineJsonViewer();

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

	let element: JsonViewerElementType | null = null;

	const syncProps = (): void => {
		if (!element) {
			return;
		}
		element.value = value;
		element.rawText = rawText;
		element.menuLabel = menuLabel;
	};

	$effect(() => {
		syncProps();
	});
</script>

<svelte:element this={JSON_VIEWER_TAG} bind:this={element} class={className}></svelte:element>
