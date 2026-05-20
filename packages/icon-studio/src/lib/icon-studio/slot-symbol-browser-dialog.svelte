<script lang="ts">
	import { ScrollView } from '@agenter/svelte-components';
	import * as Dialog from '$lib/components/ui/dialog';
	import CheckIcon from '@lucide/svelte/icons/check';
	import SearchIcon from '@lucide/svelte/icons/search';
	import XIcon from '@lucide/svelte/icons/x';

	import type { IconSlotKind, LucideIconCatalogEntry } from './icon-system-contract';
	import { createLucideSlotId, getLucideIconBySlotId, listLucideIcons, searchLucideIcons } from './lucide-slot-catalog';
	import SlotSymbolPreview from './slot-symbol-preview.svelte';

	interface Props {
		color: string;
		fieldClass: string;
		onSelect: (slotId: string) => Promise<void> | void;
		open?: boolean;
		scale: number;
		selectedId: string;
		slot: IconSlotKind;
	}

	const secondaryButtonClass =
		'inline-flex items-center justify-center gap-2 rounded-xl border border-border/70 bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/50 disabled:pointer-events-none disabled:opacity-50';
	const primaryButtonClass =
		'inline-flex items-center justify-center gap-2 rounded-xl border border-transparent bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50';
	const gridGapPx = 12;
	const minCardWidthPx = 104;
	const totalLucideIcons = listLucideIcons().length;

	interface BrowserIconCard extends LucideIconCatalogEntry {
		slotId: string;
	}

	interface BrowserIconRow {
		icons: BrowserIconCard[];
		id: string;
	}

	const dialogId = $props.id();

	let { color, fieldClass, onSelect, open = $bindable(false), scale, selectedId, slot }: Props = $props();

	let gridMeasureWidth = $state(0);
	let query = $state('');
	let focusedSlotId = $state('');

	const normalizedQuery = $derived(query.trim());
	const browserIcons = $derived.by<BrowserIconCard[]>(() =>
		(normalizedQuery ? searchLucideIcons(normalizedQuery, totalLucideIcons) : listLucideIcons()).map((icon) => ({
			...icon,
			slotId: createLucideSlotId(icon.id),
		})),
	);
	const gridColumnCount = $derived.by(() => {
		const width = Math.max(0, gridMeasureWidth);
		if (width <= 0) {
			return 1;
		}
		return Math.max(1, Math.floor((width + gridGapPx) / (minCardWidthPx + gridGapPx)));
	});
	const rowGridTemplate = $derived(`repeat(${gridColumnCount}, minmax(0, 1fr))`);
	const estimatedCardWidth = $derived.by(() => {
		const width = Math.max(0, gridMeasureWidth);
		if (width <= 0) {
			return minCardWidthPx;
		}
		const totalGapWidth = Math.max(0, gridColumnCount - 1) * gridGapPx;
		return Math.max(72, Math.floor((width - totalGapWidth) / gridColumnCount));
	});
	const estimatedRowHeight = $derived(Math.max(148, estimatedCardWidth + 60));
	const browserRows = $derived.by<BrowserIconRow[]>(() => {
		if (browserIcons.length === 0) {
			return [];
		}

		const rows: BrowserIconRow[] = [];
		for (let startIndex = 0; startIndex < browserIcons.length; startIndex += gridColumnCount) {
			const rowIcons = browserIcons.slice(startIndex, startIndex + gridColumnCount);
			rows.push({
				icons: rowIcons,
				id: `${gridColumnCount}:${rowIcons[0]!.slotId}`,
			});
		}
		return rows;
	});
	const activeSlotId = $derived.by(() => {
		if (browserIcons.some((icon) => icon.slotId === focusedSlotId)) {
			return focusedSlotId;
		}
		return browserIcons[0]?.slotId ?? selectedId;
	});
	const activeIcon = $derived(getLucideIconBySlotId(activeSlotId));

	$effect(() => {
		if (!open) {
			return;
		}
		query = '';
		focusedSlotId = getLucideIconBySlotId(selectedId) ? selectedId : createLucideSlotId('sparkles');
	});

	$effect(() => {
		if (!open || browserIcons.length === 0) {
			return;
		}
		if (!browserIcons.some((icon) => icon.slotId === focusedSlotId)) {
			focusedSlotId = browserIcons[0]!.slotId;
		}
	});

	const useFocused = async (): Promise<void> => {
		if (!activeSlotId) {
			return;
		}
		await onSelect(activeSlotId);
		open = false;
	};
</script>

<Dialog.Root bind:open>
	<Dialog.Content
		showCloseButton={false}
		aria-describedby={`${dialogId}-description`}
		aria-labelledby={`${dialogId}-title`}
		class="h-[min(100dvh-1rem,58rem)] w-[min(100vw-1rem,72rem)] max-w-[min(100vw-1rem,72rem)] grid-rows-[auto,minmax(0,1fr),auto] gap-0 overflow-hidden rounded-[1.45rem] border border-border/65 bg-card p-0 text-card-foreground shadow-[0_30px_120px_color-mix(in_srgb,black,transparent_72%)] sm:h-[min(86dvh,58rem)] sm:w-[min(100vw-2rem,72rem)] sm:max-w-[min(100vw-2rem,72rem)] sm:rounded-[1.7rem]"
	>
		<div class="grid gap-4 border-b border-border/60 bg-[linear-gradient(180deg,color-mix(in_srgb,var(--card),white_8%)_0%,color-mix(in_srgb,var(--background),var(--card)_62%)_100%)] px-4 py-4 sm:px-5 sm:py-5 md:px-6">
			<div class="flex items-start justify-between gap-3">
				<div class="grid min-w-0 gap-1">
					<div class="text-[10px] uppercase tracking-[0.18em] text-muted-foreground sm:text-[11px]">Lucide catalog</div>
					<Dialog.Title id={`${dialogId}-title`} class="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
					Browse {slot} slot icons
					</Dialog.Title>
					<Dialog.Description id={`${dialogId}-description`} class="max-w-3xl text-xs leading-5 text-muted-foreground sm:text-sm">
					Search the full Lucide catalog, inspect fitted previews directly in the grid, then apply the selected icon.
					</Dialog.Description>
				</div>

				<button
					type="button"
					class={`${secondaryButtonClass} h-9 w-9 shrink-0 rounded-full px-0 sm:h-10 sm:w-10`}
					aria-label="Close Lucide browser"
					onclick={() => {
						open = false;
					}}
				>
					<XIcon class="size-4" />
				</button>
			</div>

			<div class="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
				<label class="grid min-w-0 gap-2 text-sm">
							<span class="font-medium">Search Lucide</span>
							<div class="relative">
								<SearchIcon class="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
								<input class={`${fieldClass} pl-9`} type="search" bind:value={query} placeholder="Search the full Lucide catalog" />
							</div>
				</label>

				<div class="grid gap-1 text-xs text-muted-foreground sm:text-right">
					<div>{browserIcons.length} results</div>
					<div>scale {scale.toFixed(2)}x</div>
					{#if activeIcon}
						<div class="font-medium text-foreground">selected: {activeIcon.label}</div>
					{/if}
				</div>
			</div>
		</div>

		<div class="relative min-h-0">
			<div
				aria-hidden="true"
				class="pointer-events-none invisible absolute inset-x-4 top-0 h-px sm:inset-x-5 md:inset-x-6"
				bind:clientWidth={gridMeasureWidth}
			></div>

			<ScrollView
				class="h-full"
				contentClass="min-h-full py-0"
				viewportClass="overscroll-contain px-4 py-4 sm:px-5 sm:py-5 md:px-6"
				viewportTestId={`slot-symbol-browser-scroll-${slot}`}
				virtual={{
					items: browserRows,
					estimateSize: () => estimatedRowHeight,
					getItemKey: (_, row) => row.id,
					measureElement: true,
					overscan: 4,
				}}
			>
				{#snippet empty()}
					<div class="rounded-[1.35rem] border border-dashed border-border/60 bg-background/75 px-5 py-8 text-sm text-muted-foreground">
						No Lucide icon matched “{normalizedQuery}”.
					</div>
				{/snippet}

				{#snippet item(row)}
					<div class="pb-3">
						<div class="grid gap-3" style:grid-template-columns={rowGridTemplate}>
							{#each row.icons as icon (icon.slotId)}
								<button
									type="button"
									aria-pressed={icon.slotId === activeSlotId}
									class={`min-w-0 rounded-[1.25rem] border p-2.5 text-left transition-colors ${
										icon.slotId === activeSlotId
											? 'border-foreground/25 bg-muted/50 shadow-[0_0_0_1px_color-mix(in_srgb,var(--foreground),transparent_84%)]'
											: 'border-border/60 bg-background/88 hover:bg-muted/30'
									}`}
									onclick={() => {
										focusedSlotId = icon.slotId;
									}}
								>
									<div class="flex items-center justify-between gap-2 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
										<span>Lucide</span>
										{#if icon.slotId === activeSlotId}
											<span class="inline-flex items-center gap-1 font-medium text-foreground">
												<CheckIcon class="size-3" />
											</span>
										{:else if icon.slotId === selectedId}
											<span class="font-medium text-foreground">Current</span>
										{/if}
									</div>

									<SlotSymbolPreview
										alt={`${icon.label} preview`}
										class="aspect-square rounded-[1rem] p-2"
										{color}
										{scale}
										{slot}
										slotId={icon.slotId}
									/>

									<div class="grid gap-0.5">
										<div class="truncate text-[0.8rem] font-medium leading-tight text-foreground sm:text-sm">{icon.label}</div>
										<div class="truncate text-[11px] text-muted-foreground">{icon.id}</div>
									</div>
								</button>
							{/each}
						</div>
					</div>
				{/snippet}
			</ScrollView>
		</div>

		<div class="flex flex-col gap-3 border-t border-border/60 bg-[linear-gradient(180deg,color-mix(in_srgb,var(--card),transparent_18%)_0%,color-mix(in_srgb,var(--background),var(--card)_72%)_100%)] px-4 py-4 sm:px-5 md:flex-row md:items-center md:justify-between md:px-6">
			<div class="min-w-0 text-xs text-muted-foreground">
				{#if activeIcon}
					Ready to apply <span class="font-medium text-foreground">{activeIcon.label}</span> to the {slot} slot.
				{:else}
					Choose an icon from the grid.
				{/if}
			</div>
			<div class="flex w-full flex-col gap-2 sm:flex-row md:w-auto">
				<button
					type="button"
					class={`${secondaryButtonClass} w-full sm:w-auto`}
					onclick={() => {
						open = false;
					}}
				>
					Close
				</button>
				<button
					type="button"
					class={`${primaryButtonClass} w-full sm:w-auto`}
					disabled={!activeIcon}
					onclick={() => void useFocused()}
				>
					<CheckIcon class="size-4" />
					Use selected icon
				</button>
			</div>
		</div>
	</Dialog.Content>
</Dialog.Root>
