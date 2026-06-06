<script lang="ts">
	import { isFilePreviewPayload, type FilePreviewPayload } from './file-preview-state';

	let {
		preview,
		title = `${preview.name} preview`,
		class: className = '',
		frameless = false,
	}: {
		preview: FilePreviewPayload;
		title?: string;
		class?: string;
		frameless?: boolean;
	} = $props();

	const frameClass = $derived(
		['file-preview-frame', frameless ? 'file-preview-frame--frameless' : '', className]
			.filter((part) => part.length > 0)
			.join(' '),
	);
	const previewPayloadJson = $derived(JSON.stringify(preview));
	const previewStorageKey = $derived(
		`agenter:file-previewer:${preview.previewKind}:${preview.textProjection ?? 'source'}:${preview.path}:${preview.modifiedAtMs}:${preview.sizeBytes}:${preview.source?.url ?? ''}`,
	);
	const previewFrameSrc = $derived(`/file-previewer?previewKey=${encodeURIComponent(previewStorageKey)}`);
	let previousPreviewStorageKey = $state<string | null>(null);
	let iframeRef = $state<HTMLIFrameElement | null>(null);

	const postPreviewToFrame = (): void => {
		if (typeof window === 'undefined' || !iframeRef?.contentWindow) {
			return;
		}
		const parsedPreview: unknown = JSON.parse(previewPayloadJson);
		if (!isFilePreviewPayload(parsedPreview)) {
			return;
		}
		iframeRef.contentWindow.postMessage(
			{
				type: 'agenter:file-previewer:set-preview',
				preview: parsedPreview,
			},
			window.location.origin,
		);
	};

	$effect.pre(() => {
		if (typeof window === 'undefined') {
			return;
		}
		window.localStorage.setItem(previewStorageKey, previewPayloadJson);
		if (previousPreviewStorageKey && previousPreviewStorageKey !== previewStorageKey) {
			window.localStorage.removeItem(previousPreviewStorageKey);
		}
		previousPreviewStorageKey = previewStorageKey;
	});

	$effect(() => {
		postPreviewToFrame();
	});

	$effect(() => {
		if (typeof window === 'undefined') {
			return;
		}
		const handleMessage = (event: MessageEvent): void => {
			if (event.origin !== window.location.origin || event.data?.type !== 'agenter:file-previewer:ready') {
				return;
			}
			if (event.source !== iframeRef?.contentWindow) {
				return;
			}
			postPreviewToFrame();
		};
		window.addEventListener('message', handleMessage);
		return () => {
			window.removeEventListener('message', handleMessage);
		};
	});
</script>

<iframe
	bind:this={iframeRef}
	{title}
	src={previewFrameSrc}
	class={frameClass}
></iframe>

<style>
	.file-preview-frame {
		display: block;
		block-size: 100%;
		inline-size: 100%;
		min-block-size: 0;
		min-inline-size: 0;
		border: 1px solid color-mix(in srgb, var(--border), transparent 18%);
		border-radius: 0.95rem;
		background: var(--background);
	}

	.file-preview-frame--frameless {
		border: 0;
		border-radius: 0;
		background: transparent;
	}
</style>
