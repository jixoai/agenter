<script lang="ts">
	import FileIcon from '@lucide/svelte/icons/file';
	import ImageIcon from '@lucide/svelte/icons/image';
	import LoaderCircleIcon from '@lucide/svelte/icons/loader-circle';
	import MusicIcon from '@lucide/svelte/icons/music';
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';
	import VideoIcon from '@lucide/svelte/icons/video';
	import { ScrollView } from '@agenter/svelte-components';
	import { onMount } from 'svelte';

	import { loadHttpFilePreviewPayload } from '$lib/components/file-preview/file-preview-http-source';
	import { isFilePreviewPayload, type FilePreviewKind, type FilePreviewPayload } from '$lib/components/file-preview/file-preview-state';
	import MarkdownDocument from '$lib/components/web-components/markdown-document.svelte';
	import SkillTextViewer from '$lib/features/skills/skill-text-viewer.svelte';
	import { renderPdfPages } from './file-previewer-pdf-renderer';

	const EMPTY_VTT_TRACK = 'data:text/vtt;charset=utf-8,WEBVTT%0A%0A';

	const resolveEmptyIcon = (previewKind: FilePreviewKind) => {
		if (previewKind === 'image' || previewKind === 'pdf') {
			return ImageIcon;
		}
		if (previewKind === 'audio') {
			return MusicIcon;
		}
		if (previewKind === 'video') {
			return VideoIcon;
		}
		return FileIcon;
	};

	const isMarkdownPreview = (nextPreview: FilePreviewPayload): boolean => {
		const mimeType = nextPreview.mimeType?.split(';', 1)[0]?.trim().toLowerCase() ?? '';
		const path = nextPreview.path.toLowerCase();
		return mimeType === 'text/markdown' || mimeType === 'text/x-markdown' || path.endsWith('.md') || path.endsWith('.markdown');
	};

	const shouldRenderDocumentTextProjection = (nextPreview: FilePreviewPayload): boolean =>
		nextPreview.previewKind === 'text' && nextPreview.textProjection === 'document' && isMarkdownPreview(nextPreview);

	const readPreviewFromStorage = (): FilePreviewPayload | null => {
		if (typeof window === 'undefined') {
			return null;
		}
		const previewKey = new URLSearchParams(window.location.search).get('previewKey');
		if (!previewKey) {
			return null;
		}
		const rawPreview = window.localStorage.getItem(previewKey);
		if (!rawPreview) {
			return null;
		}
		try {
			const parsedPreview: unknown = JSON.parse(rawPreview);
			return isFilePreviewPayload(parsedPreview) ? parsedPreview : null;
		} catch {
			return null;
		}
	};

	const isPreviewMessage = (
		value: unknown,
	): value is {
		type: 'agenter:file-previewer:set-preview';
		preview: FilePreviewPayload;
	} => {
		if (!value || typeof value !== 'object' || Array.isArray(value)) {
			return false;
		}
		const record = value as Record<string, unknown>;
		return record.type === 'agenter:file-previewer:set-preview' && isFilePreviewPayload(record.preview);
	};

	let sourcePreview = $state<FilePreviewPayload | null>(null);
	let preview = $state<FilePreviewPayload | null>(null);
	let previewBusy = $state(false);
	let pdfBusy = $state(false);
	let pdfError = $state<string | null>(null);
	let pdfContainerRef = $state<HTMLDivElement | null>(null);
	let renderVersion = 0;
	let fetchVersion = 0;

	const renderPdf = async (nextPreview: FilePreviewPayload): Promise<void> => {
		if (!pdfContainerRef || !nextPreview.mediaDataUrl) {
			return;
		}
		renderVersion += 1;
		const currentVersion = renderVersion;
		pdfBusy = true;
		pdfError = null;

		try {
			await renderPdfPages({
				mediaDataUrl: nextPreview.mediaDataUrl,
				container: pdfContainerRef,
				isCurrent: () => currentVersion === renderVersion,
			});
		} catch (error) {
			pdfError = error instanceof Error ? error.message : 'Failed to render PDF preview.';
		} finally {
			if (currentVersion === renderVersion) {
				pdfBusy = false;
			}
		}
	};

	const fetchHttpPreview = async (nextPreview: FilePreviewPayload): Promise<void> => {
		const currentVersion = ++fetchVersion;
		previewBusy = true;
		preview = {
			...nextPreview,
			note: nextPreview.note ?? 'Loading preview source…',
		};

		try {
			const loadedPreview = await loadHttpFilePreviewPayload(nextPreview);
			if (currentVersion !== fetchVersion) {
				return;
			}
			preview = loadedPreview;
		} catch (error) {
			if (currentVersion !== fetchVersion) {
				return;
			}
			const errorMessage = error instanceof Error ? error.message : 'Failed to load preview source.';
			preview = {
				...nextPreview,
				note: errorMessage,
			};
		} finally {
			if (currentVersion === fetchVersion) {
				previewBusy = false;
			}
		}
	};

	onMount(() => {
		sourcePreview = readPreviewFromStorage();
		const handleMessage = (event: MessageEvent): void => {
			if (event.origin !== window.location.origin || !isPreviewMessage(event.data)) {
				return;
			}
			sourcePreview = event.data.preview;
		};
		window.addEventListener('message', handleMessage);
		window.parent.postMessage({ type: 'agenter:file-previewer:ready' }, window.location.origin);
		return () => {
			window.removeEventListener('message', handleMessage);
		};
	});

	$effect(() => {
		if (!sourcePreview) {
			fetchVersion += 1;
			preview = null;
			previewBusy = false;
			return;
		}
		if (sourcePreview.source?.protocol !== 'http') {
			fetchVersion += 1;
			preview = sourcePreview;
			previewBusy = false;
			return;
		}
		void fetchHttpPreview(sourcePreview);
	});

	$effect(() => {
		if (preview?.previewKind !== 'pdf') {
			renderVersion += 1;
			pdfBusy = false;
			pdfError = null;
			return;
		}
		void renderPdf(preview);
	});
</script>

<div class="file-previewer">
	{#if !preview}
		<div class="file-previewer__empty">
			<FileIcon class="size-5" />
			<span>Waiting for preview payload…</span>
		</div>
	{:else if previewBusy}
		<div class="file-previewer__empty">
			<LoaderCircleIcon class="size-5 animate-spin" />
			<span>Loading preview source…</span>
		</div>
	{:else}
		<ScrollView
			class="file-previewer__body"
			contentClass="file-previewer__body-content"
			viewportClass="file-previewer__body-viewport"
		>
			{#if preview.previewKind === 'text'}
				{#if shouldRenderDocumentTextProjection(preview)}
					<MarkdownDocument
						value={preview.textContent ?? ''}
						mode="preview"
						usage="document"
						surface="plain"
						overflow="grow"
						density="default"
						padding="none"
						class="file-previewer__markdown-document"
					/>
				{:else}
					<div class="file-previewer__text-shell">
						<SkillTextViewer text={preview.textContent ?? ''} path={preview.path} mimeType={preview.mimeType} />
					</div>
				{/if}
			{:else if preview.previewKind === 'image'}
				{#if !preview.mediaDataUrl}
					{@const PreviewIcon = resolveEmptyIcon(preview.previewKind)}
					<div class="file-previewer__empty">
						<PreviewIcon class="size-5" />
						<span>{preview.note ?? 'No media payload was available for this preview.'}</span>
					</div>
				{:else}
					<img src={preview.mediaDataUrl} alt={preview.name} class="file-previewer__image" />
				{/if}
			{:else if preview.previewKind === 'audio'}
				{#if !preview.mediaDataUrl}
					{@const PreviewIcon = resolveEmptyIcon(preview.previewKind)}
					<div class="file-previewer__empty">
						<PreviewIcon class="size-5" />
						<span>{preview.note ?? 'No media payload was available for this preview.'}</span>
					</div>
				{:else}
					<div class="file-previewer__centered">
						<audio controls src={preview.mediaDataUrl} class="w-full"></audio>
					</div>
				{/if}
			{:else if preview.previewKind === 'video'}
				{#if !preview.mediaDataUrl}
					{@const PreviewIcon = resolveEmptyIcon(preview.previewKind)}
					<div class="file-previewer__empty">
						<PreviewIcon class="size-5" />
						<span>{preview.note ?? 'No media payload was available for this preview.'}</span>
					</div>
				{:else}
					<video controls src={preview.mediaDataUrl} class="file-previewer__video">
						<track kind="captions" srclang="en" label="No captions available" src={EMPTY_VTT_TRACK} default />
					</video>
				{/if}
			{:else if preview.previewKind === 'pdf'}
				{#if !preview.mediaDataUrl}
					{@const PreviewIcon = resolveEmptyIcon(preview.previewKind)}
					<div class="file-previewer__empty">
						<PreviewIcon class="size-5" />
						<span>{preview.note ?? 'No media payload was available for this preview.'}</span>
					</div>
				{:else}
					<div class="file-previewer__pdf-shell">
						{#if pdfBusy}
							<div class="file-previewer__empty">
								<LoaderCircleIcon class="size-5 animate-spin" />
								<span>Rendering PDF…</span>
							</div>
						{/if}
						{#if pdfError}
							<div class="file-previewer__empty">
								<TriangleAlertIcon class="size-5" />
								<span>{pdfError}</span>
							</div>
						{/if}
						<div bind:this={pdfContainerRef} class="file-previewer__pdf-pages"></div>
					</div>
				{/if}
			{:else if !preview.mediaDataUrl && preview.note}
				<div class="file-previewer__empty">
					<TriangleAlertIcon class="size-5" />
					<span>{preview.note}</span>
				</div>
			{:else}
				<div class="file-previewer__empty">
					<TriangleAlertIcon class="size-5" />
					<span>{preview.note ?? 'Unsupported preview type.'}</span>
				</div>
			{/if}
		</ScrollView>
	{/if}
</div>

<style>
	.file-previewer {
		block-size: 100dvh;
		background:
			radial-gradient(circle at top, color-mix(in srgb, var(--accent), white 72%) 0%, transparent 46%),
			linear-gradient(180deg, color-mix(in srgb, var(--background), white 4%) 0%, var(--background) 100%);
		color: var(--foreground);
	}

	:global(.file-previewer__body),
	.file-previewer__pdf-shell,
	.file-previewer__text-shell {
		min-block-size: 0;
		min-inline-size: 0;
	}

	:global(.file-previewer__body) {
		block-size: 100%;
	}

	:global(.file-previewer__body-content) {
		display: grid;
		align-content: start;
		min-block-size: 100%;
		padding: 1rem;
	}

	:global(.file-previewer__body-viewport) {
		scrollbar-width: thin;
	}

	.file-previewer__text-shell {
		min-block-size: calc(100dvh - 2rem);
		overflow: visible;
		border: 1px solid color-mix(in srgb, var(--border), transparent 18%);
		border-radius: 1rem;
		padding: 0 0.875rem;
		background: color-mix(in srgb, var(--card), transparent 4%);
	}

	:global(.file-previewer__markdown-document) {
		display: block;
		inline-size: 100%;
		min-block-size: calc(100dvh - 2rem);
	}

	.file-previewer__empty,
	.file-previewer__centered {
		display: flex;
		min-block-size: 100%;
		align-items: center;
		justify-content: center;
		gap: 0.625rem;
		color: var(--muted-foreground);
		text-align: center;
	}

	.file-previewer__image,
	.file-previewer__video {
		display: block;
		max-inline-size: 100%;
		max-block-size: calc(100dvh - 4rem);
		margin-inline: auto;
		border-radius: 1rem;
		background: color-mix(in srgb, var(--card), transparent 4%);
		box-shadow: 0 24px 48px -40px color-mix(in srgb, var(--foreground), transparent 18%);
	}

	.file-previewer__pdf-pages {
		display: grid;
		gap: 1rem;
		justify-items: center;
	}

	:global(.file-previewer__pdf-page) {
		display: block;
		max-inline-size: 100%;
		block-size: auto;
		border-radius: 0.875rem;
		background: white;
		box-shadow: 0 20px 36px -28px color-mix(in srgb, var(--foreground), transparent 22%);
	}
</style>
