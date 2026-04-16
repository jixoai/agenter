<script lang="ts">
	let {
		class: className = '',
		children,
	}: {
		class?: string;
		children?: import('svelte').Snippet;
	} = $props();
</script>

<div class={`grid gap-2 ${className}`.trim()}>
	{@render children?.()}
</div>
