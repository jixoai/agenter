<script lang="ts">
	import SearchIcon from '@lucide/svelte/icons/search';
	import SparklesIcon from '@lucide/svelte/icons/sparkles';

	import { CUSTOM_SLOT_ID, clampSlotScale, type IconSlotKind, type IconSlotPreset } from './icon-system-contract';
	import {
		createLucideSlotId,
		getLucideIconBySlotId,
		searchLucideIcons,
	} from './lucide-slot-catalog';
	import SlotScaleControls from './slot-scale-controls.svelte';
	import SlotSymbolBrowserDialog from './slot-symbol-browser-dialog.svelte';
	import SlotSymbolPreview from './slot-symbol-preview.svelte';

	interface Props {
		curatedOptions: IconSlotPreset[];
		customMarkup?: string;
		fieldClass: string;
		loading: boolean;
		onScaleChange: (slot: IconSlotKind, scale: number) => void;
		onSelect: (slot: IconSlotKind, slotId: string) => Promise<void> | void;
		previewColor: string;
		runtimeMarkup?: string;
		scale: number;
		selectedId: string;
		slot: IconSlotKind;
	}

	type SlotSourceMode = 'custom' | 'default' | 'lucide';

	const secondaryButtonClass =
		'inline-flex items-center justify-center gap-2 rounded-xl border border-border/70 bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/50 disabled:pointer-events-none disabled:opacity-50';

	let {
		curatedOptions,
		customMarkup = '',
		fieldClass,
		loading,
		onScaleChange,
		onSelect,
		previewColor,
		runtimeMarkup = '',
		scale,
		selectedId,
		slot,
	}: Props = $props();

	let browserOpen = $state(false);
	let query = $state('');
	let rememberedLucideId = $state('sparkles');
	let rememberedDefaultId = $state('');

	const normalizedQuery = $derived(query.trim());
	const normalizedScale = $derived(clampSlotScale(scale));
	const selectedLucide = $derived(getLucideIconBySlotId(selectedId));
	const selectedDefault = $derived(curatedOptions.find((option) => option.id === selectedId) ?? null);
	const activeMode = $derived.by<SlotSourceMode>(() => {
		if (selectedId === CUSTOM_SLOT_ID) {
			return 'custom';
		}
		return selectedLucide ? 'lucide' : 'default';
	});
	const activeDefaultId = $derived.by(() => selectedDefault?.id ?? rememberedDefaultId ?? curatedOptions[0]?.id ?? '');
	const previewTitle = $derived.by(() => {
		if (selectedId === CUSTOM_SLOT_ID) {
			return customMarkup.trim() ? 'Custom SVG' : 'Custom SVG pending';
		}
		return selectedLucide?.label ?? selectedDefault?.label ?? activeDefaultId ?? 'Slot preview';
	});
	const previewMeta = $derived.by(() => {
		if (selectedId === CUSTOM_SLOT_ID) {
			return customMarkup.trim()
				? 'Uses the custom upload or markup below.'
				: 'Paste or upload SVG markup below to activate the preview.';
		}
		return selectedLucide?.id ?? 'Uses the preset-owned default for this slot.';
	});
	const lucideMatches = $derived.by(() =>
		normalizedQuery
			? searchLucideIcons(normalizedQuery, 6).map((icon) => ({
					id: createLucideSlotId(icon.id),
					label: icon.label,
					meta: icon.id,
				}))
			: [],
	);

	const pick = async (slotId: string): Promise<void> => {
		const lucideId = getLucideIconBySlotId(slotId)?.id;
		if (lucideId) {
			rememberedLucideId = lucideId;
		} else if (slotId !== CUSTOM_SLOT_ID) {
			rememberedDefaultId = slotId;
		}
		query = '';
		await onSelect(slot, slotId);
	};

	const changeMode = async (mode: SlotSourceMode): Promise<void> => {
		if (mode === activeMode) {
			return;
		}

		switch (mode) {
			case 'default':
				if (activeDefaultId) {
					await pick(activeDefaultId);
				}
				return;
			case 'lucide':
				await pick(createLucideSlotId(selectedLucide?.id ?? rememberedLucideId));
				return;
			case 'custom':
				await pick(CUSTOM_SLOT_ID);
		}
	};

	const updateScale = (nextScale: number): void => {
		onScaleChange(slot, nextScale);
	};

	const pickFromBrowser = (slotId: string): Promise<void> => pick(slotId);
</script>

<div class="grid gap-3 rounded-2xl border border-border/60 bg-muted/20 p-4">
	<label class="grid gap-2 text-sm">
		<span class="font-medium">{slot} slot</span>
		<select class={fieldClass} value={activeMode} onchange={(event) => void changeMode((event.currentTarget as HTMLSelectElement).value as SlotSourceMode)}>
			{#each [
				{ id: 'default', label: 'Default' },
				{ id: 'lucide', label: 'Lucide' },
				{ id: 'custom', label: 'Custom' },
			] as option (option.id)}
				<option value={option.id}>{option.label}</option>
			{/each}
		</select>
	</label>

	<div class="grid gap-3 rounded-[1.2rem] border border-border/60 bg-background/75 p-3">
		<div class="flex items-start justify-between gap-3">
			<div class="grid gap-1">
				<div class="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Preview</div>
				<div class="font-medium text-foreground">{previewTitle}</div>
				<div class="text-xs text-muted-foreground">{previewMeta}</div>
			</div>

			<SlotSymbolPreview
				alt={`${previewTitle} preview`}
				class="aspect-[158/148] w-24 shrink-0 p-2"
				color={previewColor}
				{customMarkup}
				runtimeMarkup={runtimeMarkup}
				scale={normalizedScale}
				{slot}
				slotCatalog={curatedOptions}
				slotId={selectedId}
			/>
		</div>

		{#if activeMode !== 'default'}
			<div class="flex items-center justify-between gap-3 rounded-xl border border-dashed border-border/60 bg-muted/25 px-3 py-2 text-xs text-muted-foreground">
				<span>Current fit scale</span>
				<span class="font-medium text-foreground">{normalizedScale.toFixed(2)}x</span>
			</div>
		{/if}
	</div>

	{#if activeMode === 'default'}
		<div class="grid gap-2 rounded-xl border border-dashed border-border/60 bg-background/60 px-3 py-3 text-sm">
			<div class="font-medium text-foreground">Default symbol</div>
			<div class="text-muted-foreground">
				Uses the preset-owned default for this slot:
				<span class="font-medium text-foreground">
					{curatedOptions.find((option) => option.id === activeDefaultId)?.label ?? activeDefaultId}
				</span>
			</div>
		</div>
	{:else if activeMode === 'lucide'}
		<div class="grid gap-3 text-sm">
			<div class="flex items-center justify-between gap-3">
				<div class="grid gap-1">
					<span class="font-medium">Lucide search</span>
					<span class="text-xs text-muted-foreground">Quick search inline, or open the browser for the larger fitted preview.</span>
				</div>
				<button type="button" class={secondaryButtonClass} onclick={() => (browserOpen = true)}>
					<SearchIcon class="size-4" />
					Browse
				</button>
			</div>

			<label class="grid gap-2">
				<span class="sr-only">Search Lucide icons</span>
				<div class="relative">
					<SearchIcon class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
					<input class={`${fieldClass} pl-9`} type="search" bind:value={query} placeholder="Search Lucide icons" />
				</div>
			</label>

			{#if normalizedQuery}
				<div class="grid gap-2">
					{#if lucideMatches.length === 0}
						<div class="rounded-xl border border-dashed border-border/60 bg-background/60 px-3 py-2 text-xs text-muted-foreground">
							No Lucide icon matched “{normalizedQuery}”.
						</div>
					{:else}
						{#each lucideMatches as option (option.id)}
							<button
								type="button"
								class="grid grid-cols-[4rem_minmax(0,1fr)] items-center gap-3 rounded-xl border border-border/60 bg-background/80 px-3 py-2 text-left transition-colors hover:bg-muted/50"
								onclick={() => void pick(option.id)}
							>
								<SlotSymbolPreview
									alt={`${option.label} preview`}
									class="aspect-[158/148] p-2"
									color={previewColor}
									scale={normalizedScale}
									{slot}
									slotId={option.id}
								/>
								<div class="grid gap-1">
									<div class="font-medium text-foreground">{option.label}</div>
									<div class="text-xs text-muted-foreground">{option.meta}</div>
								</div>
							</button>
						{/each}
					{/if}
				</div>
			{:else if selectedLucide}
				<div class="rounded-xl border border-border/60 bg-background/80 px-3 py-2 text-xs text-muted-foreground">
					Selected Lucide icon: <span class="font-medium text-foreground">{selectedLucide.label}</span>
					<div class="mt-1">{selectedLucide.id}</div>
				</div>
			{:else}
				<div class="flex items-center gap-2 rounded-xl border border-dashed border-border/60 bg-background/60 px-3 py-2 text-xs text-muted-foreground">
					<SparklesIcon class="size-4" />
					Type to search Lucide, or open the browser for the larger preview.
				</div>
			{/if}

			<SlotScaleControls
				{fieldClass}
				helpText="Applies only to Lucide and custom SVG sources. Default preset symbols keep their authored fit."
				onChange={updateScale}
				value={normalizedScale}
			/>

			{#if loading}
				<div class="text-xs text-muted-foreground">Loading selected Lucide icon…</div>
			{/if}
		</div>
	{:else}
		<div class="grid gap-3">
			<div class="flex items-center gap-2 rounded-xl border border-dashed border-border/60 bg-background/60 px-3 py-2 text-xs text-muted-foreground">
				<SparklesIcon class="size-4" />
				Custom mode uses the upload and markup fields below.
			</div>

			<SlotScaleControls
				{fieldClass}
				helpText="Use scale to tune how the imported SVG fills the rounded slot container."
				onChange={updateScale}
				value={normalizedScale}
			/>
		</div>
	{/if}
</div>

<SlotSymbolBrowserDialog
	bind:open={browserOpen}
	color={previewColor}
	{fieldClass}
	onSelect={pickFromBrowser}
	scale={normalizedScale}
	selectedId={selectedLucide ? selectedId : createLucideSlotId(rememberedLucideId)}
	{slot}
/>
