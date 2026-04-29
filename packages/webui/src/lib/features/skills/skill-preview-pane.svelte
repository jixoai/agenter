<script lang="ts">
	import NoticeBanner from '$lib/components/ui/notice-banner.svelte';

	import type { SkillPreviewRecord } from './skill-browser-state';
	import SkillPreviewFrame from './skill-preview-frame.svelte';

	let {
		preview,
	}: {
		preview: SkillPreviewRecord | null;
	} = $props();
</script>

{#if !preview}
	<NoticeBanner tone="info" message="Select one file from the tree to inspect its read-only preview." />
{:else}
	<SkillPreviewFrame {preview} />
{/if}
