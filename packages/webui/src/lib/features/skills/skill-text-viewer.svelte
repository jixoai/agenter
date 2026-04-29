<script lang="ts">
	import { json } from '@codemirror/lang-json';
	import { markdown } from '@codemirror/lang-markdown';
	import { yaml } from '@codemirror/lang-yaml';
	import { Compartment, EditorState, type Extension } from '@codemirror/state';
	import { EditorView } from '@codemirror/view';
	import { onMount } from 'svelte';

	const resolveLanguage = (path: string, mimeType: string | null): Extension => {
		const normalizedPath = path.toLowerCase();
		if (mimeType === 'application/json' || normalizedPath.endsWith('.json')) {
			return json();
		}
		if (mimeType === 'application/yaml' || normalizedPath.endsWith('.yaml') || normalizedPath.endsWith('.yml')) {
			return yaml();
		}
		if (mimeType === 'text/markdown' || normalizedPath.endsWith('.md')) {
			return markdown();
		}
		return [];
	};

	let {
		text,
		path,
		mimeType = null,
	}: {
		text: string;
		path: string;
		mimeType?: string | null;
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
				padding: '0.25rem 0',
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
		}),
	];

	let hostRef = $state<HTMLDivElement | null>(null);
	let editorView = $state<EditorView | null>(null);
	let renderFallback = $state(
		typeof navigator !== 'undefined' && navigator.userAgent.toLowerCase().includes('jsdom'),
	);

	const language = $derived(resolveLanguage(path, mimeType));

	onMount(() => {
		if (renderFallback || !hostRef) {
			return;
		}
		try {
			const view = new EditorView({
				state: EditorState.create({
					doc: text,
					extensions: [...editorExtensions, languageCompartment.of(language)],
				}),
				parent: hostRef,
			});
			editorView = view;
			return () => {
				if (editorView === view) {
					editorView = null;
				}
				view.destroy();
			};
		} catch {
			renderFallback = true;
		}
	});

	$effect(() => {
		const view = editorView;
		if (!view) {
			return;
		}
		const currentText = view.state.doc.toString();
		view.dispatch({
			changes:
				currentText === text
					? undefined
					: {
							from: 0,
							to: currentText.length,
							insert: text,
						},
			effects: [languageCompartment.reconfigure(language)],
		});
	});
</script>

{#if renderFallback}
	<pre class="skill-text-viewer__fallback">{text}</pre>
{:else}
	<div bind:this={hostRef} class="skill-text-viewer__editor"></div>
{/if}

<style>
	.skill-text-viewer__editor,
	.skill-text-viewer__fallback {
		block-size: 100%;
		inline-size: 100%;
		min-block-size: 0;
		min-inline-size: 0;
	}

	.skill-text-viewer__fallback {
		margin: 0;
		overflow: auto;
		font-family: var(--font-mono);
		font-size: 12px;
		line-height: 1.65;
		white-space: pre-wrap;
		word-break: break-word;
	}
	</style>
