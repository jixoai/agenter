<script lang="ts">
	import ProfileAvatar from '$lib/components/profile-avatar.svelte';
	import * as Select from '$lib/components/ui/select/index.js';
	import { cn } from '$lib/utils.js';

	import type {
		ActorSelectChrome,
		ActorSelectDensity,
		ActorSelectItem,
		ActorSelectVariant,
	} from './actor-select.types';

	let {
		items,
		value = null,
		selectedItem = null,
		placeholder = 'Select actor',
		id,
		ariaLabel,
		disabled = false,
		variant = 'field',
		density,
		chrome,
		showTriggerSubtitle = true,
		showMenuSubtitle = true,
		class: className,
		onValueChange,
	}: {
		items: ActorSelectItem[];
		value?: string | null;
		selectedItem?: ActorSelectItem | null;
		placeholder?: string;
		id?: string;
		ariaLabel: string;
		disabled?: boolean;
		variant?: ActorSelectVariant;
		density?: ActorSelectDensity;
		chrome?: ActorSelectChrome;
		showTriggerSubtitle?: boolean;
		showMenuSubtitle?: boolean;
		class?: string;
		onValueChange?: (value: string) => void;
	} = $props();

	const selected = $derived(selectedItem ?? items.find((item) => item.value === value) ?? null);
	const selectItems = $derived(items.map((item) => ({ value: item.value, label: item.label })));
	const resolvedDensity = $derived(density ?? (variant === 'toolbar' ? 'compact' : 'detail'));
	const resolvedChrome = $derived(chrome ?? (variant === 'toolbar' ? 'borderless' : 'field'));
	const renderTriggerSubtitle = $derived(showTriggerSubtitle);
	const renderMenuSubtitle = $derived(showMenuSubtitle);
	const triggerClass = $derived.by(() => {
		const chromeClass =
			resolvedChrome === 'borderless'
				? 'border-0 bg-transparent px-0 py-0 shadow-none hover:bg-transparent focus-visible:ring-0'
				: 'border border-border/60 bg-background/88 px-2.5 py-2 shadow-none hover:bg-background';
		const densityClass =
			resolvedDensity === 'detail'
				? 'min-h-[3.25rem] w-full justify-start gap-3 rounded-[1.1rem] text-left [&_svg]:size-4'
				: 'h-auto w-auto max-w-full justify-start gap-2 rounded-full text-left text-foreground [&_svg]:size-3.5 [&_svg]:opacity-50';
		return `${chromeClass} ${densityClass}`;
	});
	const triggerAvatarClass = $derived(
		resolvedDensity === 'detail'
			? 'size-9 rounded-full border-border/50 bg-muted/40'
			: 'size-7 rounded-full border-border/45 bg-muted/35',
	);
	const optionAvatarClass = $derived(
		resolvedDensity === 'detail'
			? 'size-8 rounded-full border-border/50 bg-muted/40'
			: 'size-7 rounded-full border-border/45 bg-muted/35',
	);
	const triggerContentClass = $derived('grid min-w-0 gap-0.5 text-left leading-tight');
	const triggerLabelClass = $derived(
		resolvedDensity === 'detail' ? 'truncate text-sm font-semibold text-foreground' : 'truncate text-[0.82rem] font-semibold text-foreground',
	);
	const triggerSubtitleClass = $derived(
		resolvedDensity === 'detail'
			? 'truncate text-[11px] leading-tight text-muted-foreground'
			: 'truncate text-[0.68rem] leading-tight text-muted-foreground',
	);
</script>

<Select.Root
	type="single"
	items={selectItems}
	value={value ?? undefined}
	disabled={disabled || items.length === 0}
	onValueChange={(nextValue) => {
		onValueChange?.(nextValue);
	}}
>
	<Select.Trigger
		{id}
		size={variant === 'toolbar' ? 'sm' : 'default'}
		aria-label={ariaLabel}
		class={cn(triggerClass, className)}
	>
		{#if selected}
			<div class={cn('flex min-w-0 items-center', resolvedDensity === 'detail' ? 'gap-3' : 'gap-2')}>
				<ProfileAvatar
					label={selected.label}
					src={selected.iconUrl ?? null}
					class={triggerAvatarClass}
				/>
				<div class={triggerContentClass}>
					<span class={triggerLabelClass}>
						{selected.label}
					</span>
					{#if renderTriggerSubtitle && selected.subtitle}
						<span class={triggerSubtitleClass} title={selected.subtitle}>
							{selected.subtitle}
						</span>
					{/if}
				</div>
			</div>
		{:else}
			<span class="truncate text-sm text-muted-foreground">{placeholder}</span>
		{/if}
	</Select.Trigger>

	<Select.Content>
		{#each items as item (item.value)}
			<Select.Item value={item.value} label={item.label}>
				<div class="flex min-w-0 items-center gap-2">
					<ProfileAvatar label={item.label} src={item.iconUrl ?? null} class={optionAvatarClass} />
					<div class="grid min-w-0 leading-tight">
						<span class="truncate text-sm font-medium text-foreground">{item.label}</span>
						{#if renderMenuSubtitle && item.subtitle}
							<span class="truncate text-[11px] text-muted-foreground" title={item.subtitle}>{item.subtitle}</span>
						{/if}
					</div>
				</div>
			</Select.Item>
		{/each}
	</Select.Content>
</Select.Root>
