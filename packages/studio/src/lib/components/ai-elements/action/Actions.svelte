<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';

	import { cn } from '$lib/utils.js';

	type ActionsProps = HTMLAttributes<HTMLDivElement>;

	let { class: className = '', children, ...restProps }: ActionsProps = $props();
</script>

<div class={cn('flex items-center gap-1', className)} {...restProps}>
	{@render children?.()}
</div>
