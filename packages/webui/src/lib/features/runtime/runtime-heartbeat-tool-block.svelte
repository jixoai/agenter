<script lang="ts">
	import { Tool, ToolContent, ToolHeader, ToolInput, ToolOutput } from '$lib/components/ai-elements/tool/index.js';

	import type { HeartbeatDisplayBlock } from './runtime-heartbeat-parts';
	import { getHeartbeatToolPreview } from './runtime-heartbeat-parts';

	let {
		block,
	}: {
		block: Extract<HeartbeatDisplayBlock, { kind: 'tool' }>;
	} = $props();

	const shouldOpen = $derived(block.state !== 'output-available');
	const preview = $derived(getHeartbeatToolPreview(block.input));
</script>

<Tool open={shouldOpen}>
	<ToolHeader type={block.tool} state={block.state} {preview} />
	<ToolContent>
		<ToolInput input={block.input} />
		<ToolOutput output={block.output} errorText={block.errorText} />
	</ToolContent>
</Tool>
