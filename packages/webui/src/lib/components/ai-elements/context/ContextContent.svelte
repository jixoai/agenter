<script lang="ts">
	import { DropdownMenuContent } from '$lib/components/ui/dropdown-menu/index.js';

	let {
		class: className = '',
		children,
	}: {
		class?: string;
		children?: import('svelte').Snippet;
	} = $props();
</script>

<DropdownMenuContent
	align="end"
	class={`w-[22rem] max-w-[min(22rem,calc(100vw-2rem))] rounded-2xl p-3 ${className}`.trim()}
>
	<div class="grid gap-3">
		{@render children?.()}
	</div>
</DropdownMenuContent>
