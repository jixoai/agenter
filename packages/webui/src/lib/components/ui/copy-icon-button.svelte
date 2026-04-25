<script lang="ts">
	import CheckIcon from '@lucide/svelte/icons/check';
	import CopyIcon from '@lucide/svelte/icons/copy';
	import { onDestroy } from 'svelte';

	import { Button } from '$lib/components/ui/button/index.js';
	import type { ButtonProps } from '$lib/components/ui/button/button.variants.js';

	type Props = Omit<ButtonProps, 'children' | 'onclick' | 'type' | 'value'> & {
		value: string;
		label: string;
		copiedLabel?: string;
	};

	let {
		value,
		label,
		copiedLabel = 'Copied',
		title = label,
		variant = 'ghost',
		size = 'icon-sm',
		disabled = false,
		...restProps
	}: Props = $props();

	let copied = $state(false);
	let copiedTimer: ReturnType<typeof setTimeout> | null = null;

	const clearCopiedTimer = (): void => {
		if (copiedTimer) {
			clearTimeout(copiedTimer);
			copiedTimer = null;
		}
	};

	const copyValue = async (): Promise<void> => {
		if (disabled || value.length === 0) {
			return;
		}
		await navigator.clipboard?.writeText(value);
		copied = true;
		clearCopiedTimer();
		copiedTimer = setTimeout(() => {
			copied = false;
			copiedTimer = null;
		}, 1200);
	};

	onDestroy(clearCopiedTimer);
</script>

<Button
	type="button"
	{variant}
	{size}
	disabled={disabled || value.length === 0}
	aria-label={copied ? copiedLabel : label}
	title={copied ? copiedLabel : title}
	onclick={() => {
		void copyValue();
	}}
	{...restProps}
>
	{#if copied}
		<CheckIcon class="size-4" />
	{:else}
		<CopyIcon class="size-4" />
	{/if}
	<span class="sr-only">{copied ? copiedLabel : label}</span>
</Button>
