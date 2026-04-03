<script lang="ts">
	import ScrollView from '$lib/components/scroll-view.svelte';

	import type { TerminalViewportProps } from './terminal-system-surface.types';

	let {
		terminalId,
		terminalTitle,
		cwd,
		status,
		snapshot = null,
		class: className = '',
	}: TerminalViewportProps = $props();

	const renderedLines = $derived(
		snapshot?.lines?.length ? snapshot.lines.join('\n') : `$ ${cwd ?? terminalId}\n# snapshot unavailable`,
	);
</script>

<div
	class={`grid h-full min-h-[18rem] w-full grid-rows-[auto_minmax(0,1fr)] rounded-xl border border-white/10 bg-black/80 ${className}`}
>
	<div class="grid gap-1 border-b border-white/10 px-4 py-3 text-[11px] text-white/70">
		<div class="font-semibold text-white">{terminalTitle ?? terminalId}</div>
		<div>{cwd ?? terminalId} · {status}</div>
	</div>
	<ScrollView class="h-full" contentClass="px-4 py-3">
		<pre class="font-mono text-[12px] leading-6 text-white/90">{renderedLines}</pre>
	</ScrollView>
</div>
