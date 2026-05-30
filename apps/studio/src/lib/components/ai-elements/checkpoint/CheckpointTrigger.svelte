<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import {
		Tooltip,
		TooltipContent,
		TooltipProvider,
		TooltipTrigger,
	} from '$lib/components/ui/tooltip/index.js';

	let {
		children,
		class: className = '',
		variant = 'ghost',
		size = 'sm',
		tooltip,
		onclick,
		disabled = false,
		...restProps
	}: {
		children?: import('svelte').Snippet;
		class?: string;
		variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
		size?: 'default' | 'sm' | 'lg' | 'icon' | 'icon-sm' | 'icon-lg';
		tooltip?: string;
		onclick?: (event: MouseEvent) => void;
		disabled?: boolean;
	} = $props();
</script>

{#if tooltip}
	<TooltipProvider>
		<Tooltip delayDuration={150}>
			<TooltipTrigger>
				<Button {size} type="button" {variant} {onclick} {disabled} class={className} {...restProps}>
					{@render children?.()}
				</Button>
			</TooltipTrigger>
			<TooltipContent side="bottom" align="start">
				<p>{tooltip}</p>
			</TooltipContent>
		</Tooltip>
	</TooltipProvider>
{:else}
	<Button {size} type="button" {variant} {onclick} {disabled} class={className} {...restProps}>
		{@render children?.()}
	</Button>
{/if}
