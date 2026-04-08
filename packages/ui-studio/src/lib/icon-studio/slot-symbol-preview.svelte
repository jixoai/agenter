<script lang="ts">
	import { CUSTOM_SLOT_ID, type IconSlotKind, type IconSlotPreset } from './icon-system-contract';
	import { loadLucideIconAsset, parseLucideSlotId, renderLucideSlotMarkup } from './lucide-slot-catalog';
	import { renderSlotPreviewSvg, svgToDataUri } from './icon-system-svg';

	interface Props {
		alt: string;
		class?: string;
		color: string;
		customMarkup?: string;
		runtimeMarkup?: string;
		scale?: number;
		slot: IconSlotKind;
		slotCatalog?: IconSlotPreset[];
		slotId: string;
		surfaceFill?: string;
		surfaceStroke?: string;
	}

	let {
		alt,
		class: className = '',
		color,
		customMarkup = '',
		runtimeMarkup = '',
		scale = 1,
		slot,
		slotCatalog = [],
		slotId,
		surfaceFill,
		surfaceStroke,
	}: Props = $props();

	let resolvedRuntimeMarkup = $state('');
	let loading = $state(false);

	const presetMarkup = $derived.by(() => slotCatalog.find((option) => option.id === slotId)?.markup ?? '');
	const resolvedMarkup = $derived.by(() => {
		if (slotId === CUSTOM_SLOT_ID) {
			return customMarkup.trim();
		}
		return runtimeMarkup.trim() || resolvedRuntimeMarkup.trim() || presetMarkup.trim();
	});
	const hasRenderableMarkup = $derived(resolvedMarkup.length > 0);
	const previewSvg = $derived.by(() =>
		renderSlotPreviewSvg({
			color,
			customMarkup,
			runtimeMarkup: runtimeMarkup || resolvedRuntimeMarkup,
			scale,
			slot,
			slotCatalog,
			slotId,
			surfaceFill,
			surfaceStroke,
		}),
	);
	const previewDataUri = $derived(svgToDataUri(previewSvg));

	$effect(() => {
		resolvedRuntimeMarkup = runtimeMarkup;
	});

	$effect(() => {
		const lucideIconId = parseLucideSlotId(slotId);
		if (!lucideIconId || runtimeMarkup.trim()) {
			resolvedRuntimeMarkup = runtimeMarkup;
			loading = false;
			return;
		}

		let cancelled = false;
		resolvedRuntimeMarkup = '';
		loading = true;

		void loadLucideIconAsset(lucideIconId).then((asset) => {
			if (cancelled) {
				return;
			}
			resolvedRuntimeMarkup = asset ? renderLucideSlotMarkup(asset) : '';
			loading = false;
		});

		return () => {
			cancelled = true;
		};
	});
</script>

<div class={`relative overflow-hidden rounded-[1.15rem] border border-border/60 bg-background/90 ${className}`}>
	<img class="block h-full w-full object-contain" src={previewDataUri} {alt} />

	{#if !hasRenderableMarkup}
		<div class="pointer-events-none absolute inset-0 grid place-items-center px-3 text-center text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
			No symbol
		</div>
	{/if}

	{#if loading}
		<div class="pointer-events-none absolute inset-x-2 bottom-2 rounded-full border border-border/60 bg-background/90 px-2 py-1 text-center text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
			Loading
		</div>
	{/if}
</div>
