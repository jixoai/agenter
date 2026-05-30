<script lang="ts">
	import EyeIcon from '@lucide/svelte/icons/eye';
	import EyeOffIcon from '@lucide/svelte/icons/eye-off';
	import type { HTMLInputAttributes } from 'svelte/elements';

	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { cn } from '$lib/utils.js';

	type PasswordInputProps = Omit<HTMLInputAttributes, 'type' | 'value' | 'files'> & {
		value?: string;
		class?: string;
		inputClass?: string;
		toggleLabel?: string;
	};

	let {
		value = $bindable(''),
		class: className = '',
		inputClass = '',
		disabled = false,
		toggleLabel = 'Toggle password visibility',
		...restProps
	}: PasswordInputProps = $props();

	let revealed = $state(false);
</script>

<div class={cn('relative min-w-0', className)}>
	<Input
		bind:value
		type={revealed ? 'text' : 'password'}
		{disabled}
		class={cn('pr-11', inputClass)}
		{...restProps}
	/>
	<Button
		type="button"
		variant="ghost"
		size="icon-sm"
		class="absolute right-1 top-1/2 -translate-y-1/2"
		{disabled}
		aria-label={revealed ? 'Hide password' : 'Show password'}
		title={toggleLabel}
		onclick={() => {
			revealed = !revealed;
		}}
	>
		{#if revealed}
			<EyeOffIcon class="size-4" />
		{:else}
			<EyeIcon class="size-4" />
		{/if}
	</Button>
</div>
