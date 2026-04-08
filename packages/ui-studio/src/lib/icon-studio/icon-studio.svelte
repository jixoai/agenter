<script lang="ts">
	import { Scaffold, SplitView } from '@agenter/svelte-components';
	import DownloadIcon from '@lucide/svelte/icons/download';
	import MoonStarIcon from '@lucide/svelte/icons/moon-star';
	import PaletteIcon from '@lucide/svelte/icons/palette';
	import SparklesIcon from '@lucide/svelte/icons/sparkles';
	import SunMediumIcon from '@lucide/svelte/icons/sun-medium';

	import {
		CUSTOM_SLOT_ID,
		type IconBackgroundToken,
		type IconComposerConfig,
		type IconFamily,
		type IconPaletteToken,
		type IconPreset,
		type IconSlotKind,
		type IconSlotPreset,
		type IconTheme,
	} from './icon-system-contract';
	import { createRenderInput, parseGeometryFromSvg, renderIconSvg } from './icon-system-svg';

	interface Props {
		backgrounds: IconBackgroundToken[];
		brandDarkSvg: string;
		defaultPreset: IconPreset | null;
		geometrySvg: string;
		palettes: IconPaletteToken[];
		presets: IconPreset[];
		slotCatalog: Record<IconSlotKind, IconSlotPreset[]>;
	}

	const DEFAULT_SLOTS: Record<IconSlotKind, string> = {
		bottomRight: 'terminal',
		center: 'blank-chip',
		topLeft: 'corner-bracket',
	};

	const secondaryButtonClass =
		'inline-flex items-center justify-center gap-2 rounded-xl border border-border/70 bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/50 disabled:pointer-events-none disabled:opacity-50';
	const primaryButtonClass =
		'inline-flex items-center justify-center gap-2 rounded-xl border border-transparent bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50';
	const fieldClass = 'rounded-xl border bg-background px-3 py-2 text-sm';
	const slotKinds = ['topLeft', 'bottomRight', 'center'] as const satisfies readonly IconSlotKind[];

	const createConfigFromPreset = (preset: IconPreset | null, paletteList: IconPaletteToken[], backgroundList: IconBackgroundToken[]): IconComposerConfig => {
		const fallbackPalette = paletteList[0];
		const fallbackBackground = backgroundList[0];
		return {
			backgroundToken: preset?.backgroundToken ?? fallbackBackground?.id ?? 'light-neutral',
			family: preset?.family ?? fallbackPalette?.family ?? 'brand',
			paletteToken: preset?.paletteToken ?? fallbackPalette?.id ?? 'brand-light-emerald-cyan',
			slots: preset?.slots ?? DEFAULT_SLOTS,
			theme: preset?.theme ?? fallbackPalette?.theme ?? 'light',
		};
	};

	const coerceConfig = (
		next: IconComposerConfig,
		paletteList: IconPaletteToken[],
		backgroundList: IconBackgroundToken[],
	): IconComposerConfig => {
		const paletteOptions = paletteList.filter((palette) => palette.theme === next.theme && palette.family === next.family);
		const backgroundOptions = backgroundList.filter((background) => background.theme === next.theme);
		return {
			...next,
			backgroundToken: backgroundOptions.some((background) => background.id === next.backgroundToken)
				? next.backgroundToken
				: (backgroundOptions[0]?.id ?? next.backgroundToken),
			paletteToken: paletteOptions.some((palette) => palette.id === next.paletteToken)
				? next.paletteToken
				: (paletteOptions[0]?.id ?? next.paletteToken),
		};
	};

	let { backgrounds, brandDarkSvg, defaultPreset, geometrySvg, palettes, presets, slotCatalog }: Props = $props();

	const geometry = $derived.by(() => parseGeometryFromSvg(geometrySvg));
	const presetMap = $derived.by(() => Object.fromEntries(presets.map((preset) => [preset.id, preset])) as Record<string, IconPreset>);
	const initialPresetId = $derived.by(() => defaultPreset?.id ?? presets[0]?.id ?? '');
	const initialConfig = $derived.by(() => coerceConfig(createConfigFromPreset(defaultPreset, palettes, backgrounds), palettes, backgrounds));

	let selectedPresetId = $state('');
	let config = $state<IconComposerConfig>({
		backgroundToken: 'light-neutral',
		family: 'brand',
		paletteToken: 'brand-light-emerald-cyan',
		slots: DEFAULT_SLOTS,
		theme: 'light',
	});
	let customSlots = $state<Partial<Record<IconSlotKind, string>>>({});
	let didBootstrap = false;

	$effect(() => {
		if (didBootstrap) {
			return;
		}
		selectedPresetId = initialPresetId;
		config = initialConfig;
		didBootstrap = true;
	});

	const paletteOptions = $derived(palettes.filter((palette) => palette.theme === config.theme && palette.family === config.family));
	const backgroundOptions = $derived(backgrounds.filter((background) => background.theme === config.theme));
	const activePalette = $derived(paletteOptions.find((palette) => palette.id === config.paletteToken) ?? paletteOptions[0] ?? null);
	const activeBackground = $derived(backgroundOptions.find((background) => background.id === config.backgroundToken) ?? backgroundOptions[0] ?? null);
	const previewSvg = $derived(
		renderIconSvg(
			createRenderInput({
				backgrounds,
				config: { ...config, customSlots },
				geometry,
				palettes,
				slotCatalog,
			}),
		),
	);
	const previewDataUri = $derived(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(previewSvg)}`);
	const comparisonDataUri = $derived(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(brandDarkSvg)}`);

	const slotOptions = (slot: IconSlotKind): Array<IconSlotPreset | { id: string; label: string }> => [
		...slotCatalog[slot],
		{ id: CUSTOM_SLOT_ID, label: 'Custom SVG' },
	];

	const applyPreset = (presetId: string): void => {
		const preset = presetMap[presetId];
		if (!preset) {
			return;
		}
		selectedPresetId = presetId;
		config = coerceConfig(createConfigFromPreset(preset, palettes, backgrounds), palettes, backgrounds);
		customSlots = {};
	};

	const setThemeFamily = (theme: IconTheme, family: IconFamily): void => {
		selectedPresetId = '';
		config = coerceConfig({ ...config, family, theme }, palettes, backgrounds);
	};

	const setPalette = (paletteToken: string): void => {
		selectedPresetId = '';
		config = coerceConfig({ ...config, paletteToken }, palettes, backgrounds);
	};

	const setBackground = (backgroundToken: string): void => {
		selectedPresetId = '';
		config = { ...config, backgroundToken };
	};

	const setSlot = (slot: IconSlotKind, slotId: string): void => {
		selectedPresetId = '';
		config = { ...config, slots: { ...config.slots, [slot]: slotId } };
	};

	const setCustomSlotMarkup = (slot: IconSlotKind, markup: string): void => {
		customSlots = { ...customSlots, [slot]: markup };
	};

	const readCustomSvg = async (slot: IconSlotKind, fileList: FileList | null): Promise<void> => {
		const file = fileList?.[0];
		if (!file) {
			return;
		}
		customSlots = { ...customSlots, [slot]: await file.text() };
		setSlot(slot, CUSTOM_SLOT_ID);
	};

	const downloadBlob = (filename: string, blob: Blob): void => {
		const url = URL.createObjectURL(blob);
		const anchor = document.createElement('a');
		anchor.href = url;
		anchor.download = filename;
		anchor.click();
		URL.revokeObjectURL(url);
	};

	const downloadSvg = (): void => {
		downloadBlob(`${config.theme}-${config.family}-${activePalette?.id ?? 'icon'}.svg`, new Blob([previewSvg], { type: 'image/svg+xml' }));
	};

	const downloadPreset = (): void => {
		downloadBlob(
			`${config.theme}-${config.family}-preset.json`,
			new Blob(
				[
					JSON.stringify(
						{
							...config,
							customSlots,
						},
						null,
						2,
					),
				],
				{ type: 'application/json' },
			),
		);
	};

	const downloadPng = async (size = 1024): Promise<void> => {
		const image = new Image();
		image.src = previewDataUri;
		await image.decode();
		const canvas = document.createElement('canvas');
		canvas.width = size;
		canvas.height = size;
		canvas.getContext('2d')?.drawImage(image, 0, 0, size, size);
		const dataUrl = canvas.toDataURL('image/png');
		const anchor = document.createElement('a');
		anchor.href = dataUrl;
		anchor.download = `${config.theme}-${config.family}-${size}.png`;
		anchor.click();
	};
</script>

<Scaffold.Root class="h-full gap-4 p-4 md:p-6" data-testid="icon-studio">
	<Scaffold.Header class="grid gap-3 rounded-[1.15rem] border border-border/55 bg-[linear-gradient(180deg,color-mix(in_srgb,var(--card),white_9%)_0%,color-mix(in_srgb,var(--background),var(--card)_58%)_100%)] px-5 py-4 shadow-[inset_0_1px_0_color-mix(in_srgb,var(--background),white_76%)]">
		<div class="flex flex-wrap items-start justify-between gap-4">
			<div class="grid gap-1">
				<div class="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
					<PaletteIcon class="size-4" />
					Icon Studio
				</div>
				<h1 class="text-sm font-semibold tracking-tight">Light-mode icon system</h1>
				<p class="max-w-3xl text-xs leading-5 text-muted-foreground">
					Compose light and dark icon variants from the canonical SVG master, swap semantic slot motifs, and export SVG, PNG,
					or preset JSON without hand-editing paths.
				</p>
			</div>

			<div class="flex flex-wrap gap-2">
				<button type="button" class={secondaryButtonClass} onclick={downloadSvg}>
					<DownloadIcon class="size-4" />
					Export SVG
				</button>
				<button type="button" class={secondaryButtonClass} onclick={() => void downloadPng()}>
					<DownloadIcon class="size-4" />
					Export PNG
				</button>
				<button type="button" class={primaryButtonClass} onclick={downloadPreset}>
					<SparklesIcon class="size-4" />
					Export preset
				</button>
			</div>
		</div>
	</Scaffold.Header>

	<Scaffold.Body>
		<SplitView.Root variant="sidebar-content">
			<SplitView.Sidebar class="border-b md:border-r md:border-b-0">
				<Scaffold.Root class="h-full rounded-xl border bg-card text-card-foreground shadow-sm">
					<Scaffold.Header class="grid gap-2 border-b px-5 py-4">
						<h2 class="text-base font-semibold">Composer</h2>
						<p class="text-sm text-muted-foreground">Curated presets stay constrained, while slot-level custom SVG remains possible.</p>
					</Scaffold.Header>
					<Scaffold.ScrollBody contentClass="grid gap-5 p-4">
						<label class="grid gap-2 text-sm">
							<span class="font-medium">Preset</span>
							<select class={fieldClass} value={selectedPresetId} onchange={(event) => applyPreset((event.currentTarget as HTMLSelectElement).value)}>
								<option value="">Custom working state</option>
								{#each presets as preset (preset.id)}
									<option value={preset.id}>{preset.label}</option>
								{/each}
							</select>
						</label>

						<div class="grid gap-3 md:grid-cols-2">
							<label class="grid gap-2 text-sm">
								<span class="font-medium">Theme</span>
								<select class={fieldClass} value={config.theme} onchange={(event) => setThemeFamily((event.currentTarget as HTMLSelectElement).value as IconTheme, config.family)}>
									<option value="light">Light</option>
									<option value="dark">Dark</option>
								</select>
							</label>
							<label class="grid gap-2 text-sm">
								<span class="font-medium">Family</span>
								<select class={fieldClass} value={config.family} onchange={(event) => setThemeFamily(config.theme, (event.currentTarget as HTMLSelectElement).value as IconFamily)}>
									<option value="brand">Brand</option>
									<option value="mono">Mono</option>
								</select>
							</label>
						</div>

						<label class="grid gap-2 text-sm">
							<span class="font-medium">Palette</span>
							<select class={fieldClass} value={config.paletteToken} onchange={(event) => setPalette((event.currentTarget as HTMLSelectElement).value)}>
								{#each paletteOptions as palette (palette.id)}
									<option value={palette.id}>{palette.label}</option>
								{/each}
							</select>
						</label>

						<label class="grid gap-2 text-sm">
							<span class="font-medium">Background</span>
							<select class={fieldClass} value={config.backgroundToken} onchange={(event) => setBackground((event.currentTarget as HTMLSelectElement).value)}>
								{#each backgroundOptions as background (background.id)}
									<option value={background.id}>{background.label}</option>
								{/each}
							</select>
						</label>

						{#each slotKinds as slot (slot)}
							<div class="grid gap-3 rounded-2xl border border-border/60 bg-muted/20 p-4">
								<label class="grid gap-2 text-sm">
									<span class="font-medium">{slot} slot</span>
									<select class={fieldClass} value={config.slots[slot]} onchange={(event) => setSlot(slot, (event.currentTarget as HTMLSelectElement).value)}>
										{#each slotOptions(slot) as option (option.id)}
											<option value={option.id}>{option.label}</option>
										{/each}
									</select>
								</label>

								{#if config.slots[slot] === CUSTOM_SLOT_ID}
									<label class="grid gap-2 text-sm">
										<span class="font-medium">Upload custom SVG</span>
										<input class={fieldClass} type="file" accept=".svg,image/svg+xml" onchange={(event) => void readCustomSvg(slot, (event.currentTarget as HTMLInputElement).files)} />
									</label>
									<label class="grid gap-2 text-sm">
										<span class="font-medium">Custom markup</span>
										<textarea
											class="min-h-28 rounded-xl border bg-background px-3 py-2 font-mono text-xs"
											value={customSlots[slot] ?? ''}
											oninput={(event) => setCustomSlotMarkup(slot, (event.currentTarget as HTMLTextAreaElement).value)}
										></textarea>
									</label>
								{/if}
							</div>
						{/each}
					</Scaffold.ScrollBody>
				</Scaffold.Root>
			</SplitView.Sidebar>

			<SplitView.Content>
				<Scaffold.Root class="h-full rounded-xl border bg-card text-card-foreground shadow-sm">
					<Scaffold.Header class="grid gap-2 border-b px-5 py-4">
						<div class="flex flex-wrap items-center justify-between gap-3">
							<div class="grid gap-1">
								<h2 class="text-base font-semibold">Preview</h2>
								<p class="text-sm text-muted-foreground">
									{activePalette?.description ?? 'Curated palette preview'} The light system keeps the white center chip visible via a darker well and a metallic frame.
								</p>
							</div>
							<div class="flex items-center gap-2 text-xs text-muted-foreground">
								{#if config.theme === 'light'}
									<SunMediumIcon class="size-4" />
								{:else}
									<MoonStarIcon class="size-4" />
								{/if}
								{activeBackground?.label ?? 'Background'}
							</div>
						</div>
					</Scaffold.Header>

					<Scaffold.ScrollBody contentClass="grid gap-6 p-5">
						<div class="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
							<div class="grid gap-4 rounded-[1.5rem] border border-border/60 bg-[linear-gradient(180deg,color-mix(in_srgb,var(--card),white_6%)_0%,color-mix(in_srgb,var(--background),transparent_10%)_100%)] p-5">
								<div class="rounded-[1.35rem] border border-border/60 p-6" style:background-color={activeBackground?.color ?? '#f3f0ea'}>
									<img class="mx-auto aspect-square w-full max-w-[34rem]" src={previewDataUri} alt="Configured icon preview" />
								</div>

								<div class="grid gap-3 sm:grid-cols-3">
									{#each [32, 64, 128] as size (size)}
										<div class="grid place-items-center gap-3 rounded-2xl border border-border/60 bg-background/80 p-4">
											<div class="grid size-24 place-items-center rounded-xl border border-dashed border-border/60" style:background-color={activeBackground?.color ?? '#f3f0ea'}>
												<img src={previewDataUri} alt={`Icon preview at ${size}px`} style={`width:${size}px;height:${size}px`} />
											</div>
											<div class="text-xs text-muted-foreground">{size}px</div>
										</div>
									{/each}
								</div>
							</div>

							<div class="grid gap-4">
								<div class="grid gap-3 rounded-[1.35rem] border border-border/60 bg-muted/20 p-4">
									<div class="text-sm font-semibold">Current dark reference</div>
									<div class="grid place-items-center rounded-xl border border-border/60 bg-[#2d3239] p-4">
										<img class="aspect-square w-full max-w-48" src={comparisonDataUri} alt="Current dark brand reference" />
									</div>
								</div>

								<div class="grid gap-2 rounded-[1.35rem] border border-border/60 bg-muted/20 p-4 text-sm">
									<div class="font-semibold">Active configuration</div>
									<div>palette: {activePalette?.label ?? config.paletteToken}</div>
									<div>background: {activeBackground?.label ?? config.backgroundToken}</div>
									<div>top-left: {config.slots.topLeft}</div>
									<div>bottom-right: {config.slots.bottomRight}</div>
									<div>center: {config.slots.center}</div>
								</div>
							</div>
						</div>
					</Scaffold.ScrollBody>
				</Scaffold.Root>
			</SplitView.Content>
		</SplitView.Root>
	</Scaffold.Body>
</Scaffold.Root>
