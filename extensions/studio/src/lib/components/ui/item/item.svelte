<script lang="ts" module>
	import { type VariantProps, tv } from "tailwind-variants";

	export const itemVariants = tv({
		base: "bg-card text-card-foreground relative flex min-w-0 items-start gap-3 rounded-2xl border shadow-sm transition-[background-color,border-color,box-shadow]",
		variants: {
			variant: {
				default: "border-border/80",
				muted: "border-border/60 bg-muted/25",
			},
			size: {
				default: "px-3.5 py-3",
				sm: "gap-2.5 px-3 py-2.5",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	});

	export type ItemVariant = VariantProps<typeof itemVariants>["variant"];
	export type ItemSize = VariantProps<typeof itemVariants>["size"];
</script>

<script lang="ts">
	import type { HTMLAttributes } from "svelte/elements";

	import { cn, type WithElementRef } from "$lib/utils.js";

	let {
		ref = $bindable(null),
		class: className,
		children,
		variant = "default",
		size = "default",
		...restProps
	}: WithElementRef<HTMLAttributes<HTMLDivElement>> & {
		variant?: ItemVariant;
		size?: ItemSize;
	} = $props();
</script>

<div
	bind:this={ref}
	data-slot="item"
	class={cn(itemVariants({ variant, size }), className)}
	{...restProps}
>
	{@render children?.()}
</div>
