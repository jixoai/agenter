<script lang="ts">
	import {
		TOOL_INVOCATION_CARD_TAG,
		defineToolInvocationCard,
		type ToolInvocationCardElementType,
		type ToolInvocationView,
	} from '@agenter/web-components';

	defineToolInvocationCard();

	let {
		invocation,
		class: className = '',
	}: {
		invocation: ToolInvocationView | null;
		class?: string;
	} = $props();

	let element: ToolInvocationCardElementType | null = null;

	const syncProps = (): void => {
		if (!element) {
			return;
		}
		element.invocation = invocation;
	};

	$effect(() => {
		syncProps();
	});
</script>

<svelte:element this={TOOL_INVOCATION_CARD_TAG} bind:this={element} class={className}></svelte:element>
