<script lang="ts">
	import { tick } from 'svelte';

	import { Button } from '$lib/components/ui/button/index.js';

	import {
		DEFAULT_JSON_VIEWER_MODE,
		setGlobalJsonViewerMode,
	} from './json-viewer-mode';
	import StructuredValueViewer from './structured-value-viewer.svelte';

	let {
		value,
		rawText = '',
		menuLabel = '',
		class: className = '',
	}: {
		value: unknown;
		rawText?: string;
		menuLabel?: string;
		class?: string;
	} = $props();

	let showSecondaryViewer = $state(true);

	setGlobalJsonViewerMode(DEFAULT_JSON_VIEWER_MODE);

	const remountSecondaryViewer = async (): Promise<void> => {
		showSecondaryViewer = false;
		await tick();
		showSecondaryViewer = true;
	};
</script>

<div class={className} data-testid="structured-value-viewer-harness">
	<div class="grid gap-3">
	<div class="flex justify-end">
		<Button size="sm" variant="outline" onclick={() => void remountSecondaryViewer()}>
			Remount secondary viewer
		</Button>
	</div>

	<div class="grid gap-3 md:grid-cols-2">
		<div class="grid gap-2" data-testid="structured-value-viewer-primary">
			<div class="text-xs uppercase tracking-[0.18em] text-muted-foreground">Primary viewer</div>
			<StructuredValueViewer
				{value}
				{rawText}
				menuLabel={menuLabel || 'Primary structured value options'}
			/>
		</div>

		{#if showSecondaryViewer}
			<div class="grid gap-2" data-testid="structured-value-viewer-secondary">
				<div class="text-xs uppercase tracking-[0.18em] text-muted-foreground">Secondary viewer</div>
				<StructuredValueViewer
					{value}
					{rawText}
					menuLabel="Secondary structured value options"
				/>
			</div>
		{/if}
	</div>
</div>
</div>
