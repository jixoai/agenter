<script lang="ts">
	import { cn } from '$lib/utils.js';

	let { class: className = '', children, ...restProps }: { class?: string; children?: import('svelte').Snippet } =
		$props();
</script>

<div class={cn('grid min-w-0 gap-2 pt-0.5', className)} {...restProps}>
	{@render children?.()}
</div>
