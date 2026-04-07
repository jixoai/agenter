<script lang="ts">
	import { getWorkbenchPageToolbarRegistry } from './workbench-page-toolbar-context.svelte';

	let {
		children,
	}: {
		children?: import('svelte').Snippet;
	} = $props();

	const registry = getWorkbenchPageToolbarRegistry();
	let host = $state<HTMLElement | null>(null);

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
</script>

{#if host && children}
	<div use:portal={host} class="workbench-page-toolbar-portal">
		{@render children()}
	</div>
{/if}
