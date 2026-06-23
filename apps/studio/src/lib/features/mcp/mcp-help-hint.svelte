<script lang="ts">
	import type { HelpHintAlign, HelpHintSide } from '@agenter/web-components';

	import HelpHint from '$lib/components/web-components/help-hint.svelte';

	let {
		textContext,
		ariaLabel = 'Help',
		helpId = '',
		side = 'top',
		align = 'center',
		sideOffset = 8,
		passiveOnFirstVisit = false,
		disabled = false,
		mode = 'prose',
		class: className = '',
	}: {
		textContext: string;
		ariaLabel?: string;
		helpId?: string;
		side?: HelpHintSide;
		align?: HelpHintAlign;
		sideOffset?: number;
		passiveOnFirstVisit?: boolean;
		disabled?: boolean;
		mode?: 'prose' | 'mono';
		class?: string;
	} = $props();
</script>

<HelpHint
	{textContext}
	{ariaLabel}
	{helpId}
	{side}
	{align}
	{sideOffset}
	{passiveOnFirstVisit}
	{disabled}
	class={className}
>
	{#if mode === 'mono'}
		<pre class="max-h-[min(24rem,calc(100dvh-2rem))] w-[28rem] max-w-[calc(100vw-2rem)] overflow-y-auto whitespace-pre-wrap break-words text-left font-mono text-[0.7rem] leading-5 text-foreground">{textContext}</pre>
	{:else}
		<div class="max-h-[min(24rem,calc(100dvh-2rem))] w-[24rem] max-w-[calc(100vw-2rem)] overflow-y-auto whitespace-pre-wrap text-left text-xs leading-5 text-foreground">{textContext}</div>
	{/if}
</HelpHint>
