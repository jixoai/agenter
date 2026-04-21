<script lang="ts">
	import { ScrollView } from '@agenter/svelte-components';
	import MinusIcon from '@lucide/svelte/icons/minus';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import SquareTerminalIcon from '@lucide/svelte/icons/square-terminal';
	import XIcon from '@lucide/svelte/icons/x';

	import type { GlobalTerminalEntry } from '@agenter/client-sdk';

	import type { TerminalViewportComponent } from './terminal-system-surface.types';

	let {
		terminal,
		terminalViewportComponent,
		viewportMode,
		deleteBusy = false,
		onRequestDelete,
		onToggleViewportMode,
	}: {
		terminal: GlobalTerminalEntry;
		terminalViewportComponent: TerminalViewportComponent;
		viewportMode: 'fit' | 'cover';
		deleteBusy?: boolean;
		onRequestDelete: () => void;
		onToggleViewportMode: () => void;
	} = $props();

	const TerminalViewport = $derived(terminalViewportComponent);
	const viewportCols = $derived(terminal.snapshot?.cols ?? 80);
	const viewportRows = $derived(terminal.snapshot?.rows ?? 24);
	const terminalTitle = $derived(terminal.title?.trim().length ? terminal.title : terminal.terminalId);
	const terminalGeometry = $derived.by(() => {
		const cols = viewportCols;
		const rows = viewportRows;
		if (typeof cols === 'number' && typeof rows === 'number') {
			return `${cols}x${rows}`;
		}
		return 'geometry pending';
	});
	const mirrorModeLabel = $derived(terminal.transportUrl ? 'Live mirror' : 'Snapshot mirror');
	const viewportModeLabel = $derived(viewportMode === 'cover' ? 'Cover projection' : 'Fit projection');
	const viewportToggleLabel = $derived(
		viewportMode === 'cover' ? 'Minimize terminal window to fit projection' : 'Maximize terminal window to cover projection',
	);
	const intrinsicScreenWidth = $derived(Math.round(viewportCols * 9.44));
	const intrinsicScreenHeight = $derived(Math.round(viewportRows * 15));
	const intrinsicFrameWidth = $derived(intrinsicScreenWidth + 32);
	const intrinsicFrameHeight = $derived(intrinsicScreenHeight + 28);
	const coverFrameWidth = $derived(Math.round(intrinsicFrameWidth * 1.16));
	const scrollOrientation = $derived(viewportMode === 'cover' ? 'both' : 'vertical');
	const windowShellStyle = $derived(
		viewportMode === 'cover'
			? `width:${coverFrameWidth}px;min-width:${coverFrameWidth}px;`
			: `width:min(100%, ${intrinsicFrameWidth}px);`,
	);
	const windowBodyStyle = $derived(`width:100%;aspect-ratio:${intrinsicFrameWidth} / ${intrinsicFrameHeight};`);
	const scrollContentClass = $derived(
		viewportMode === 'cover'
			? 'grid min-h-full min-w-max justify-items-start content-start p-2.5 sm:p-3'
			: 'grid min-h-full min-w-full justify-items-center content-start p-2.5 sm:p-3',
	);
</script>

<div class="h-full min-h-[24rem] overflow-hidden rounded-[1.7rem] bg-[linear-gradient(180deg,#1d1d1f,#171719)]">
	<ScrollView
		class="h-full"
		orientation={scrollOrientation}
		viewportTestId="terminal-window-scroll-viewport"
		contentClass={scrollContentClass}
	>
		<section
			class="grid overflow-hidden rounded-[1.55rem] border border-white/10 bg-[linear-gradient(180deg,#2b2b2d,#1f1f21_12%,#1a1a1c)] text-slate-100 shadow-[0_28px_72px_rgba(0,0,0,0.32),inset_0_1px_0_rgba(255,255,255,0.08)]"
			style={windowShellStyle}
			data-terminal-window-surface="true"
			data-terminal-window-mode={viewportMode}
		>
			<header class="flex h-11 items-center gap-3 border-b border-white/8 bg-[linear-gradient(180deg,rgba(58,58,60,0.98),rgba(40,40,42,0.96))] px-4 shadow-[0_1px_0_rgba(255,255,255,0.05)_inset]">
				<div class="flex min-w-0 flex-1 items-center gap-3">
					<div class="flex items-center gap-2" aria-label="Window controls">
						<button
							type="button"
							class="window-control-button window-control-button-close"
							data-testid="terminal-window-close-control"
							aria-label="Close terminal window"
							title="Close terminal"
							disabled={deleteBusy}
							onclick={onRequestDelete}
						>
							<XIcon class="window-control-icon" aria-hidden="true" />
						</button>
						<button
							type="button"
							class="window-control-button window-control-button-zoom"
							data-testid="terminal-window-zoom-control"
							aria-label={viewportToggleLabel}
							title={viewportToggleLabel}
							onclick={onToggleViewportMode}
						>
							{#if viewportMode === 'cover'}
								<MinusIcon class="window-control-icon" aria-hidden="true" />
							{:else}
								<PlusIcon class="window-control-icon" aria-hidden="true" />
							{/if}
						</button>
					</div>

					<div class="flex min-w-0 flex-1 items-center gap-2.5">
						<div
							class="flex size-5 shrink-0 items-center justify-center rounded-md border border-white/8 bg-white/6 text-slate-300 shadow-[0_1px_0_rgba(255,255,255,0.08)_inset]"
							aria-hidden="true"
						>
							<SquareTerminalIcon class="size-3.5" />
						</div>
						<div class="min-w-0 truncate text-[13px] font-semibold text-slate-100">{terminalTitle}</div>
					</div>
				</div>

				<div class="flex items-center gap-2 text-[10px] text-slate-400">
					<span class="rounded-full border border-white/8 bg-white/5 px-2.5 py-1 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset]">
						{viewportModeLabel}
					</span>
					<span class="rounded-full border border-white/8 bg-white/5 px-2.5 py-1 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset]">
						{mirrorModeLabel}
					</span>
					<span class="rounded-full border border-white/8 bg-white/5 px-2.5 py-1 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset]">
						{terminalGeometry}
					</span>
				</div>
			</header>

			<div
				class="overflow-hidden bg-[linear-gradient(180deg,#1c1c1e,#171719)]"
				style={windowBodyStyle}
			>
				<TerminalViewport
					class="block h-full w-full"
					terminalId={terminal.terminalId}
					viewportMode={viewportMode}
					transportUrl={terminal.transportUrl}
					snapshot={terminal.snapshot ?? null}
				/>
			</div>
		</section>
	</ScrollView>
</div>

<style>
	.window-control-button {
		position: relative;
		display: inline-flex;
		height: 0.875rem;
		width: 0.875rem;
		align-items: center;
		justify-content: center;
		border-radius: 9999px;
		border: 1px solid color-mix(in srgb, currentColor 22%, transparent);
		box-shadow:
			0 0.5px 0 rgba(255, 255, 255, 0.55) inset,
			0 1px 1px rgba(15, 23, 42, 0.12);
	}

	.window-control-button:hover:not(:disabled),
	.window-control-button:focus-visible {
		filter: saturate(1.04);
	}

	.window-control-button:disabled {
		cursor: not-allowed;
		opacity: 0.6;
	}

	.window-control-button-close {
		background: linear-gradient(180deg, #ff6f67, #f34d42);
		color: rgba(122, 24, 16, 0.88);
	}

	.window-control-button-zoom {
		background: linear-gradient(180deg, #39d161, #27bc47);
		color: rgba(11, 78, 27, 0.9);
	}

	:global(.window-control-icon) {
		height: 0.5rem;
		width: 0.5rem;
		opacity: 0;
	}

	.window-control-button:hover :global(.window-control-icon),
	.window-control-button:focus-visible :global(.window-control-icon) {
		opacity: 1;
	}
</style>
