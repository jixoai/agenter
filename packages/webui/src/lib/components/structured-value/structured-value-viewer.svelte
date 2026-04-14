<script lang="ts">
	import { Compartment, EditorState, type Extension } from '@codemirror/state';
	import { EditorView } from '@codemirror/view';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import { onMount } from 'svelte';

	import { Button } from '$lib/components/ui/button/index.js';
	import {
		DropdownMenu,
		DropdownMenuContent,
		DropdownMenuLabel,
		DropdownMenuRadioGroup,
		DropdownMenuRadioItem,
		DropdownMenuSeparator,
		DropdownMenuTrigger,
	} from '$lib/components/ui/dropdown-menu/index.js';
	import { cn } from '$lib/utils.js';

	import { buildJsonViewerDocument } from './json-viewer-content';
	import {
		DEFAULT_JSON_VIEWER_MODE,
		type JsonViewerMode,
		JSON_VIEWER_MODE_OPTIONS,
		getGlobalJsonViewerModeSnapshot,
		getJsonViewerModeLabel,
		normalizeJsonViewerMode,
		resolveJsonViewerMode,
		setGlobalJsonViewerMode,
		subscribeGlobalJsonViewerMode,
	} from './json-viewer-mode';

	let {
		value,
		rawText = '',
		menuLabel = 'Structured value options',
		class: className = '',
	}: {
		value: unknown;
		rawText?: string;
		menuLabel?: string;
		class?: string;
	} = $props();

	const languageCompartment = new Compartment();
	const editorExtensions: readonly Extension[] = [
		EditorState.readOnly.of(true),
		EditorView.editable.of(false),
		EditorView.lineWrapping,
		EditorView.theme({
			'&': {
				backgroundColor: 'transparent',
				color: 'inherit',
			},
			'.cm-editor': {
				minWidth: '0',
				maxWidth: '100%',
				backgroundColor: 'transparent',
			},
			'.cm-focused': {
				outline: 'none',
			},
			'.cm-scroller': {
				minWidth: '0',
				maxWidth: '100%',
				overflow: 'auto',
			},
			'.cm-content': {
				minWidth: '0',
				maxWidth: '100%',
				padding: '0',
				fontFamily: 'var(--font-mono)',
				fontSize: '12px',
				lineHeight: '1.65',
				caretColor: 'transparent',
				color: 'inherit',
				overflowWrap: 'anywhere',
			},
			'.cm-line': {
				paddingInline: '0',
			},
			'.cm-gutters': {
				display: 'none',
			},
			'.cm-activeLine': {
				backgroundColor: 'transparent',
			},
			'.cm-selectionBackground, ::selection': {
				backgroundColor: 'color-mix(in srgb, currentColor 18%, transparent)',
			},
			'.cm-cursor, .cm-dropCursor': {
				display: 'none',
			},
			'.cm-panels': {
				backgroundColor: 'transparent',
			},
			'.cm-tooltip': {
				zIndex: '60',
			},
		}),
	];

	let menuOpen = $state(false);
	let rootRef = $state<HTMLDivElement | null>(null);
	let hostRef = $state<HTMLDivElement | null>(null);
	let editorView = $state<EditorView | null>(null);
	let renderFallback = $state(
		typeof navigator !== 'undefined' && navigator.userAgent.toLowerCase().includes('jsdom'),
	);
	let localMode = $state<JsonViewerMode | null>(null);
	let globalMode = $state<JsonViewerMode>(DEFAULT_JSON_VIEWER_MODE);

	const activeMode = $derived(resolveJsonViewerMode({ localMode, globalMode }));
	const activeModeLabel = $derived(getJsonViewerModeLabel(activeMode));
	const viewerDocument = $derived(buildJsonViewerDocument({ mode: activeMode, value, rawText }));

	const syncViewerDocument = (view: EditorView, nextDocument: { text: string; language: Extension }): void => {
		const currentText = view.state.doc.toString();
		const effects = [languageCompartment.reconfigure(nextDocument.language)];

		if (currentText === nextDocument.text) {
			view.dispatch({ effects });
			return;
		}

		view.dispatch({
			changes: {
				from: 0,
				to: currentText.length,
				insert: nextDocument.text,
			},
			effects,
		});
	};

	const setViewerMode = (scope: 'local' | 'global', mode: JsonViewerMode): void => {
		if (scope === 'local') {
			localMode = mode;
		} else {
			setGlobalJsonViewerMode(mode);
		}
		menuOpen = false;
	};

	onMount(() => {
		globalMode = getGlobalJsonViewerModeSnapshot();
		if (rootRef) {
			const localModeFromDataset = rootRef.dataset.jsonViewerLocalMode;
			localMode =
				localModeFromDataset && localModeFromDataset.length > 0
					? normalizeJsonViewerMode(localModeFromDataset)
					: null;
		}
		const unsubscribe = subscribeGlobalJsonViewerMode(() => {
			globalMode = getGlobalJsonViewerModeSnapshot();
		});

		if (renderFallback || !hostRef) {
			return () => {
				unsubscribe();
			};
		}

		try {
			const view = new EditorView({
				state: EditorState.create({
					doc: viewerDocument.text,
					extensions: [...editorExtensions, languageCompartment.of(viewerDocument.language)],
				}),
				parent: hostRef,
			});
			editorView = view;
			return () => {
				unsubscribe();
				if (editorView === view) {
					editorView = null;
				}
				view.destroy();
			};
		} catch (error) {
			console.warn('structured value viewer failed to initialize CodeMirror, falling back to plain text', error);
			renderFallback = true;
			return () => {
				unsubscribe();
			};
		}
	});

	$effect(() => {
		const view = editorView;
		if (!view) {
			return;
		}
		syncViewerDocument(view, viewerDocument);
	});

	$effect(() => {
		const root = rootRef;
		if (!root) {
			return;
		}
		root.dataset.jsonViewerMode = activeMode;
		root.dataset.jsonViewerGlobalMode = globalMode;
		if (localMode) {
			root.dataset.jsonViewerLocalMode = localMode;
		} else {
			delete root.dataset.jsonViewerLocalMode;
		}
	});
</script>

<div
	bind:this={rootRef}
	class={cn(
		'structured-value-viewer grid min-w-0 gap-2 rounded-xl border border-border/60 bg-background/80 px-3 py-3 text-foreground',
		className,
	)}
	data-json-viewer-mode={activeMode}
	data-testid="structured-value-viewer"
>
	<div class="flex min-w-0 justify-end">
		<DropdownMenu bind:open={menuOpen}>
			<DropdownMenuTrigger>
				{#snippet child({ props })}
					<Button
						{...props}
						variant="outline"
						size="sm"
						class="h-7 rounded-full px-2.5 text-[11px] font-medium tracking-[0.14em] uppercase"
						aria-label={menuLabel}
						title={menuLabel}
					>
						{#snippet children()}
							<span class="truncate">{activeModeLabel}</span>
							<ChevronDownIcon class="size-3.5 opacity-70" />
						{/snippet}
					</Button>
				{/snippet}
			</DropdownMenuTrigger>

			<DropdownMenuContent class="w-72 max-w-[min(22rem,calc(100vw-2rem))]">
				<DropdownMenuLabel>This viewer</DropdownMenuLabel>
				<DropdownMenuRadioGroup value={activeMode} onValueChange={(mode) => setViewerMode('local', mode as JsonViewerMode)}>
					{#each JSON_VIEWER_MODE_OPTIONS as option (option.mode)}
						<DropdownMenuRadioItem value={option.mode}>
							{#snippet children({ checked })}
								<div class="grid gap-0.5 pr-5" data-checked={checked}>
									<div class="text-xs font-medium">{option.label}</div>
									<div class="text-[11px] leading-5 text-muted-foreground">{option.description}</div>
								</div>
							{/snippet}
						</DropdownMenuRadioItem>
					{/each}
				</DropdownMenuRadioGroup>

				<DropdownMenuSeparator />
				<DropdownMenuLabel>All viewers</DropdownMenuLabel>
				<DropdownMenuRadioGroup value={globalMode} onValueChange={(mode) => setViewerMode('global', mode as JsonViewerMode)}>
					{#each JSON_VIEWER_MODE_OPTIONS as option (option.mode)}
						<DropdownMenuRadioItem value={option.mode}>
							{#snippet children({ checked })}
								<div class="grid gap-0.5 pr-5" data-checked={checked}>
									<div class="text-xs font-medium">{option.label}</div>
									<div class="text-[11px] leading-5 text-muted-foreground">{option.description}</div>
								</div>
							{/snippet}
						</DropdownMenuRadioItem>
					{/each}
				</DropdownMenuRadioGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	</div>

	{#if renderFallback}
		<pre class="structured-value-viewer-fallback">{viewerDocument.text}</pre>
	{:else}
		<div bind:this={hostRef} class="structured-value-viewer-editor"></div>
	{/if}
</div>

<style>
	.structured-value-viewer-editor,
	.structured-value-viewer-fallback {
		min-width: 0;
		max-width: 100%;
		color: inherit;
	}

	.structured-value-viewer-fallback {
		font-family: var(--font-mono);
		font-size: 12px;
		line-height: 1.65;
		white-space: pre-wrap;
		word-break: break-word;
		overflow-wrap: anywhere;
	}
</style>
