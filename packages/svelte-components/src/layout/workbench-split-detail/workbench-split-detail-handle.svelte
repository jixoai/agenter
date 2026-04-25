<script lang="ts">
	import type { HTMLButtonAttributes } from "svelte/elements";

	import { cn, type WithElementRef } from "../../internal/utils.js";
	import { getWorkbenchSplitDetailContext } from "./workbench-split-detail-context.js";

	let {
		ref = $bindable(null),
		class: className,
		ariaLabel = "Resize detail panel",
		title = "Resize detail panel",
		...restProps
	}: WithElementRef<HTMLButtonAttributes, HTMLButtonElement> & {
		ariaLabel?: string;
		title?: string;
	} = $props();

	const context = getWorkbenchSplitDetailContext();
	const compact = $derived(context?.compact() ?? false);
	const detailVisible = $derived(context?.detailVisible() ?? true);
	const ratio = $derived(context?.ratio() ?? 0.5);
</script>

<button
	bind:this={ref}
	type="button"
	role="separator"
	aria-orientation="vertical"
	aria-label={ariaLabel}
	aria-valuemin={0}
	aria-valuemax={100}
	aria-valuenow={Math.round(ratio * 100)}
	disabled={compact || !detailVisible}
	title={title}
	data-layout-role="workbench-split-detail-handle"
	data-slot="workbench-split-detail-handle"
	class={cn("workbench-split-detail-handle", className)}
	{...restProps}
>
	<span aria-hidden="true" class="workbench-split-detail-handle__grip"></span>
</button>

<style>
	:where([data-layout-role="workbench-split-detail-handle"]) {
		display: grid;
		place-items: center;
		min-block-size: 0;
		min-inline-size: 0;
		border: 0;
		background: transparent;
		cursor: col-resize;
		padding: 0;
	}

	:where([data-layout-role="workbench-split-detail-handle"]):disabled {
		cursor: default;
		opacity: 0;
		pointer-events: none;
	}

	:where(.workbench-split-detail-handle__grip) {
		block-size: 100%;
		inline-size: 2px;
		border-radius: 999px;
		background: color-mix(in srgb, currentColor, transparent 76%);
	}
	</style>
