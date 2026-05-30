<script lang="ts">
	import type { ToolInvocationView } from '@agenter/web-components';

	import { Tool, ToolContent, ToolHeader, ToolInput, ToolOutput } from '$lib/components/ai-elements/tool/index.js';
	import { cn } from '$lib/utils.js';

	const toToolState = (status: ToolInvocationView['status']) => {
		switch (status) {
			case 'waiting':
				return 'input-streaming' as const;
			case 'running':
				return 'input-available' as const;
			case 'failed':
			case 'cancelled':
				return 'output-error' as const;
			default:
				return 'output-available' as const;
		}
	};

	const toPreviewText = (payload: unknown): string | null => {
		if (typeof payload === 'string') {
			const text = payload.trim();
			return text.length > 0 ? text : null;
		}
		if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
			return null;
		}
		if ('text' in payload && typeof payload.text === 'string') {
			const text = payload.text.trim();
			return text.length > 0 ? text : null;
		}
		if ('mode' in payload && typeof payload.mode === 'string') {
			return `mode: ${payload.mode}`;
		}
		return null;
	};

	let {
		invocation,
		structuredValuePlain = true,
		class: className = '',
	}: {
		invocation: ToolInvocationView | null;
		structuredValuePlain?: boolean;
		class?: string;
	} = $props();

	const toolState = $derived(invocation ? toToolState(invocation.status) : 'output-available');
	const preview = $derived(invocation ? toPreviewText(invocation.call?.value) : null);
	const output = $derived(invocation?.error ? undefined : invocation?.result?.value);
</script>

{#if invocation}
	<Tool class={cn('min-w-0 w-full max-w-full', className)} framed={false} open>
		<ToolHeader type={invocation.toolName} state={toolState} {preview} />
		<ToolContent class="gap-1 pt-1">
			<ToolInput input={invocation.call?.value} plain={structuredValuePlain} class="px-0 pb-0" />
			<ToolOutput
				output={output}
				errorText={invocation.error}
				plain={structuredValuePlain}
				class="px-0 pb-0"
			/>
		</ToolContent>
	</Tool>
{/if}
