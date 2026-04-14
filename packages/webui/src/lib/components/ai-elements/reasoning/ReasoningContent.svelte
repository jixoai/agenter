<script lang="ts">
	import { cn } from '$lib/utils.js';

	let { class: className = '', children, ...restProps }: { class?: string; children?: import('svelte').Snippet } =
		$props();
</script>

<div class={cn('grid gap-2 pt-2', className)} {...restProps}>
	<div class="grid gap-2 rounded-2xl border border-border/60 bg-muted/30 px-3 py-3 text-sm text-muted-foreground">
		{@render children?.()}
	</div>
</div>
