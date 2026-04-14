<script lang="ts">
	import { cn } from '$lib/utils.js';

	let { class: className = '', children, ...restProps }: { class?: string; children?: import('svelte').Snippet } =
		$props();
</script>

<div class={cn('grid gap-3 pt-1', className)} {...restProps}>
	{@render children?.()}
</div>
