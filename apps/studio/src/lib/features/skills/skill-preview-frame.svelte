<script lang="ts">
	import FilePreviewFrame from '$lib/components/file-preview/file-preview-frame.svelte';
	import type { SkillPreviewRecord } from './skill-browser-state';

	let {
		preview,
	}: {
		preview: SkillPreviewRecord;
	} = $props();
</script>

<FilePreviewFrame {preview} title={`${preview.name} preview`} class="skill-preview-frame" />
