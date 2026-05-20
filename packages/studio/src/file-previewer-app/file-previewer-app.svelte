<script lang="ts">
	import FileIcon from '@lucide/svelte/icons/file';
	import ImageIcon from '@lucide/svelte/icons/image';
	import LoaderCircleIcon from '@lucide/svelte/icons/loader-circle';
	import MusicIcon from '@lucide/svelte/icons/music';
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';
	import VideoIcon from '@lucide/svelte/icons/video';
	import { ScrollView } from '@agenter/svelte-components';
	import { onMount } from 'svelte';
	import * as pdfjs from 'pdfjs-dist/build/pdf.mjs';

	import type { SkillPreviewRecord } from '$lib/features/skills/skill-browser-state';
	import SkillTextViewer from '$lib/features/skills/skill-text-viewer.svelte';

	pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.mjs', import.meta.url).toString();
	const EMPTY_VTT_TRACK = 'data:text/vtt;charset=utf-8,WEBVTT%0A%0A';

	const decodeDataUrlBytes = (dataUrl: string): Uint8Array => {
		const [, base64 = ''] = dataUrl.split(',', 2);
		const binary = atob(base64);
		const bytes = new Uint8Array(binary.length);
		for (let index = 0; index < binary.length; index += 1) {
			bytes[index] = binary.charCodeAt(index);
		}
		return bytes;
	};

	const resolveEmptyIcon = (previewKind: SkillPreviewRecord['previewKind']) => {
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

	const readPreviewFromStorage = (): SkillPreviewRecord | null => {
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
			return JSON.parse(rawPreview) as SkillPreviewRecord;
		} catch {
			return null;
		}
	};

	let preview = $state<SkillPreviewRecord | null>(null);
	let pdfBusy = $state(false);
	let pdfError = $state<string | null>(null);
	let pdfContainerRef = $state<HTMLDivElement | null>(null);
	let renderVersion = 0;

	const renderPdf = async (nextPreview: SkillPreviewRecord): Promise<void> => {
		if (!pdfContainerRef || !nextPreview.mediaDataUrl) {
			return;
		}
		renderVersion += 1;
		const currentVersion = renderVersion;
		pdfBusy = true;
		pdfError = null;
		pdfContainerRef.replaceChildren();

		try {
			const loadingTask = pdfjs.getDocument({
				data: decodeDataUrlBytes(nextPreview.mediaDataUrl),
			});
			const pdfDocument = await loadingTask.promise;
			for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
				if (currentVersion !== renderVersion) {
					await pdfDocument.destroy();
					return;
				}
				const page = await pdfDocument.getPage(pageNumber);
				const viewport = page.getViewport({ scale: 1.25 });
				const canvas = document.createElement('canvas');
				const context = canvas.getContext('2d');
				if (!context) {
					continue;
				}
				canvas.width = viewport.width;
				canvas.height = viewport.height;
				canvas.className = 'file-previewer__pdf-page';
				pdfContainerRef.append(canvas);
				await page.render({
					canvas,
					canvasContext: context,
					viewport,
				}).promise;
			}
			await pdfDocument.destroy();
		} catch (error) {
			pdfError = error instanceof Error ? error.message : 'Failed to render PDF preview.';
		} finally {
			if (currentVersion === renderVersion) {
				pdfBusy = false;
			}
		}
	};

	onMount(() => {
		preview = readPreviewFromStorage();
		const handleMessage = (event: MessageEvent): void => {
			if (event.origin !== window.location.origin || event.data?.type !== 'agenter:file-previewer:set-preview') {
				return;
			}
			preview = event.data.preview as SkillPreviewRecord;
		};
		window.addEventListener('message', handleMessage);
		window.parent.postMessage({ type: 'agenter:file-previewer:ready' }, window.location.origin);
		return () => {
			window.removeEventListener('message', handleMessage);
		};
	});

	$effect(() => {
		if (preview?.previewKind !== 'pdf') {
			renderVersion += 1;
			pdfBusy = false;
			pdfError = null;
			pdfContainerRef?.replaceChildren();
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
	{:else}
		<ScrollView
			class="file-previewer__body"
			contentClass="file-previewer__body-content"
			viewportClass="file-previewer__body-viewport"
		>
			{#if preview.previewKind === 'text'}
				<div class="file-previewer__text-shell">
					<SkillTextViewer text={preview.textContent ?? ''} path={preview.path} mimeType={preview.mimeType} />
				</div>
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
