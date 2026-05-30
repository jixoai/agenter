<script lang="ts">
	import { Button, type ButtonProps } from '$lib/components/ui/button/index.js';
	import { cn } from '$lib/utils.js';

	export type ActionProps = ButtonProps & {
		tooltip?: string;
		label?: string;
	};

	let {
		tooltip,
		label,
		children,
		class: className = '',
		variant = 'ghost',
		size = 'icon-sm',
		...restProps
	}: ActionProps = $props();

	const actionClassName = $derived(
		cn('text-muted-foreground hover:text-foreground size-8 rounded-full p-0', className),
	);
</script>

<Button
	class={actionClassName}
	{size}
	type="button"
	{variant}
	title={tooltip}
	aria-label={label ?? tooltip ?? 'Action'}
	{...restProps}
>
	{@render children?.()}
	<span class="sr-only">{label ?? tooltip ?? 'Action'}</span>
</Button>
