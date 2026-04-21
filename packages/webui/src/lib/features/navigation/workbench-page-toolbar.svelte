<script lang="ts">
	import { onMount, untrack, type Snippet } from 'svelte';

	import { getWorkbenchPageToolbarRegistry } from './workbench-page-toolbar-context.svelte';

	let {
		children,
	}: {
		children?: Snippet;
	} = $props();

	const registry = getWorkbenchPageToolbarRegistry();
	let host = $state<HTMLElement | null>(null);
	let releasePortalOwner: (() => void) | null = null;

	const portal = (node: HTMLElement, target: HTMLElement | null) => {
		if (target) {
			target.append(node);
		}

		return {
			update(nextTarget: HTMLElement | null) {
				if (nextTarget) {
					nextTarget.append(node);
				}
			},
			destroy() {
				node.remove();
			},
		};
	};

	$effect(() => {
		host = registry?.host ?? null;
	});

	onMount(() => {
		if (!registry || !children) {
			return;
		}
		releasePortalOwner = untrack(() => registry.registerPortalOwner());
		return () => {
			untrack(() => releasePortalOwner?.());
			releasePortalOwner = null;
		};
	});
</script>

{#if host && children}
{#if !registry?.takeover}
	<div use:portal={host} class="workbench-page-toolbar-portal">
		{@render children()}
	</div>
{/if}
{/if}

<style>
	.workbench-page-toolbar-portal {
		block-size: 100%;
		inline-size: 100%;
		min-inline-size: 0;
	}
</style>
