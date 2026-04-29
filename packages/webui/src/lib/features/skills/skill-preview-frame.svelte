<script lang="ts">
	import type { SkillPreviewRecord } from './skill-browser-state';

	let {
		preview,
	}: {
		preview: SkillPreviewRecord;
	} = $props();

	const previewPayloadJson = $derived(JSON.stringify(preview));
	const previewStorageKey = $derived(
		`agenter:file-previewer:${preview.previewKind}:${preview.path}:${preview.modifiedAtMs}:${preview.sizeBytes}`,
	);
	const previewFrameSrc = $derived(`/filePreviewer.html?previewKey=${encodeURIComponent(previewStorageKey)}`);
	let previousPreviewStorageKey = $state<string | null>(null);
	let iframeRef = $state<HTMLIFrameElement | null>(null);

	const postPreviewToFrame = (): void => {
		if (typeof window === 'undefined' || !iframeRef?.contentWindow) {
			return;
		}
		iframeRef.contentWindow.postMessage(
			{
				type: 'agenter:file-previewer:set-preview',
				preview: JSON.parse(previewPayloadJson) as SkillPreviewRecord,
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
	title={`${preview.name} preview`}
	src={previewFrameSrc}
	class="h-full min-h-[24rem] w-full rounded-xl border border-border/60 bg-background"
></iframe>
