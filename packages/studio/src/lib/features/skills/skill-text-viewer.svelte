<script lang="ts">
	import { HighlightStyle, LanguageDescription, LanguageSupport, syntaxHighlighting } from '@codemirror/language';
	import { json } from '@codemirror/lang-json';
	import { languages } from '@codemirror/language-data';
	import { markdown } from '@codemirror/lang-markdown';
	import { yaml } from '@codemirror/lang-yaml';
	import { Compartment, EditorState, type Extension } from '@codemirror/state';
	import { EditorView } from '@codemirror/view';
	import { tags as t } from '@lezer/highlight';
	import { onMount } from 'svelte';

	const SKILL_TEXT_HIGHLIGHTING = syntaxHighlighting(
		HighlightStyle.define([
			{ tag: [t.heading, t.heading1, t.heading2, t.heading3, t.heading4], color: '#0f172a', fontWeight: '700' },
			{ tag: [t.keyword, t.operatorKeyword, t.modifier], color: '#0369a1' },
			{ tag: [t.string, t.special(t.string), t.regexp], color: '#0f766e' },
			{ tag: [t.number, t.integer, t.float, t.bool, t.null], color: '#b45309' },
			{ tag: [t.comment, t.lineComment, t.blockComment], color: '#64748b', fontStyle: 'italic' },
			{ tag: [t.variableName, t.labelName, t.attributeName, t.propertyName], color: '#475569' },
			{ tag: [t.typeName, t.className, t.namespace], color: '#7c3aed' },
			{ tag: [t.function(t.variableName), t.function(t.propertyName), t.definition(t.variableName)], color: '#be123c' },
			{ tag: [t.brace, t.squareBracket, t.paren, t.punctuation, t.separator], color: '#94a3b8' },
			{ tag: [t.link, t.url], color: '#2563eb', textDecoration: 'underline' },
			{ tag: [t.monospace, t.processingInstruction, t.meta], color: '#334155' },
		]),
	);

	const resolveLanguageDescriptionExtension = async (
		description: LanguageDescription | null,
	): Promise<Extension> => {
		if (!description) {
			return [];
		}
		const loadedLanguage: LanguageSupport = description.support ?? (await description.load());
		return [loadedLanguage.extension, SKILL_TEXT_HIGHLIGHTING];
	};

	const resolveLanguage = async (path: string, mimeType: string | null): Promise<Extension> => {
		const normalizedPath = path.toLowerCase();
		if (mimeType === 'application/json' || normalizedPath.endsWith('.json')) {
			return [json(), SKILL_TEXT_HIGHLIGHTING];
		}
		if (mimeType === 'application/yaml' || normalizedPath.endsWith('.yaml') || normalizedPath.endsWith('.yml')) {
			return [yaml(), SKILL_TEXT_HIGHLIGHTING];
		}
		if (mimeType === 'text/markdown' || normalizedPath.endsWith('.md')) {
			return [markdown({ codeLanguages: languages }), SKILL_TEXT_HIGHLIGHTING];
		}
		if (mimeType === 'image/svg+xml' || normalizedPath.endsWith('.svg')) {
			return resolveLanguageDescriptionExtension(LanguageDescription.matchFilename(languages, normalizedPath));
		}
		return resolveLanguageDescriptionExtension(LanguageDescription.matchFilename(languages, normalizedPath));
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
				blockSize: '100%',
				overflow: 'visible',
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
	let languageExtension = $state<Extension>([]);

	const loadLanguage = async (): Promise<void> => {
		languageExtension = await resolveLanguage(path, mimeType);
	};

	onMount(() => {
		void loadLanguage();

		if (renderFallback || !hostRef) {
			return;
		}
		try {
			const view = new EditorView({
				state: EditorState.create({
					doc: text,
					extensions: [...editorExtensions, languageCompartment.of(languageExtension)],
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
		void loadLanguage();
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
			effects: [languageCompartment.reconfigure(languageExtension)],
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

	.skill-text-viewer__editor {
		overflow: visible;
	}

	.skill-text-viewer__fallback {
		margin: 0;
		overflow: visible;
		font-family: var(--font-mono);
		font-size: 12px;
		line-height: 1.65;
		white-space: pre-wrap;
		word-break: break-word;
	}
</style>
