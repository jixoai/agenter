<script lang="ts">
	import {
		ASYNC_SURFACE_TAG,
		defineAsyncSurface,
		type AsyncSurfaceElementType,
		type AsyncSurfaceState,
	} from '@agenter/web-components';

	defineAsyncSurface();

	let {
		state: surfaceState,
		emptyLoadingLabel = 'Loading…',
		loadingOverlayLabel = 'Refreshing…',
		class: className = '',
		children,
		empty,
		skeleton,
	}: {
		state: AsyncSurfaceState;
		emptyLoadingLabel?: string;
		loadingOverlayLabel?: string;
		class?: string;
		children?: import('svelte').Snippet;
		empty?: import('svelte').Snippet;
		skeleton?: import('svelte').Snippet;
	} = $props();

	let element: AsyncSurfaceElementType | null = null;

	const syncProps = (): void => {
		if (!element) {
			return;
		}
		element.state = surfaceState;
		element.emptyLoadingLabel = emptyLoadingLabel;
		element.loadingOverlayLabel = loadingOverlayLabel;
	};

	$effect(() => {
		syncProps();
	});
</script>

<svelte:element this={ASYNC_SURFACE_TAG} bind:this={element} class={className}>
	{#if surfaceState === 'empty-idle'}
		{#if empty}
			<div slot="empty">
				{@render empty()}
			</div>
		{/if}
	{:else if surfaceState === 'empty-loading'}
		{#if skeleton}
			<div slot="skeleton">
				{@render skeleton()}
			</div>
		{/if}
	{:else}
		{@render children?.()}
	{/if}
</svelte:element>
