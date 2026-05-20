<script lang="ts">
	import NoticeBanner from '$lib/components/ui/notice-banner.svelte';
	import { cn } from '$lib/utils.js';

	import type { SkillPreviewRecord } from './skill-browser-state';
	import SkillPreviewFrame from './skill-preview-frame.svelte';

	let {
		preview,
		class: className = '',
	}: {
		preview: SkillPreviewRecord | null;
		class?: string;
	} = $props();
</script>

{#if !preview}
	<NoticeBanner tone="info" message="Select one file from the tree to inspect its read-only preview." />
{:else}
	<div class={cn('skill-preview-pane', className)}>
		<SkillPreviewFrame {preview} />
	</div>
{/if}

<style>
	.skill-preview-pane {
		block-size: 100%;
		min-block-size: 0;
		min-inline-size: 0;
	}
</style>
