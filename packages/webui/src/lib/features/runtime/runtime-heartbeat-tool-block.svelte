<script lang="ts">
	import { Tool, ToolContent, ToolHeader, ToolInput, ToolOutput } from '$lib/components/ai-elements/tool/index.js';

	import type { HeartbeatDisplayBlock } from './runtime-heartbeat-parts';
	import { getHeartbeatToolPreview } from './runtime-heartbeat-parts';

	let {
		block,
		forceOpen = false,
		layoutMode = 'detailed',
	}: {
		block: Extract<HeartbeatDisplayBlock, { kind: 'tool' }>;
		forceOpen?: boolean;
		layoutMode?: 'compact' | 'detailed';
	} = $props();

	const shouldOpen = $derived(forceOpen || block.state !== 'output-available');
	const preview = $derived(getHeartbeatToolPreview(block.input));
	const isCompact = $derived(layoutMode === 'compact');
</script>

<Tool class="min-w-0" framed={!isCompact} open={shouldOpen}>
	<ToolHeader
		class={isCompact ? 'px-0 py-0.5' : ''}
		type={block.tool}
		state={block.state}
		{preview}
	/>
	<ToolContent class={isCompact ? 'gap-1 pt-1' : ''}>
		<ToolInput class={isCompact ? 'px-0 pb-0' : ''} input={block.input} plain />
		<ToolOutput class={isCompact ? 'px-0 pb-0' : ''} output={block.output} errorText={block.errorText} plain />
	</ToolContent>
</Tool>
