<script lang="ts">
	import {
		TERMINAL_VIEW_TAG,
		defineTerminalView,
		type TerminalViewElement,
		type TerminalViewSnapshot,
	} from '@agenter/terminal-view';
	import { onMount } from 'svelte';

	let {
		terminalId,
		terminalTitle,
		cwd,
		status,
		viewportMode = 'fit',
		transportUrl,
		snapshot = null,
		class: className = '',
	}: {
		terminalId: string;
		terminalTitle?: string;
		cwd?: string;
		status: 'IDLE' | 'BUSY';
		viewportMode?: 'fit' | 'cover';
		transportUrl?: string;
		snapshot?: TerminalViewSnapshot | null;
		class?: string;
	} = $props();

	type TerminalViewHostElement = HTMLElement &
		Pick<
			TerminalViewElement,
			'transportUrl' | 'terminalId' | 'terminalTitle' | 'cwd' | 'status' | 'viewportMode' | 'snapshot'
		>;

	let element = $state<TerminalViewHostElement | null>(null);

	const syncProps = (): void => {
		if (!element) {
			return;
		}
		element.transportUrl = transportUrl ?? '';
		element.terminalId = terminalId;
		element.terminalTitle = terminalTitle ?? terminalId;
		element.cwd = cwd ?? '';
		element.status = status;
		element.viewportMode = viewportMode;
		element.snapshot = snapshot ?? null;
	};

	onMount(() => {
		if (typeof customElements !== 'undefined') {
			defineTerminalView();
		}
		syncProps();
	});

	$effect(() => {
		syncProps();
	});
</script>

<svelte:element
	this={TERMINAL_VIEW_TAG}
	bind:this={element}
	class={className}
	data-terminal-host-root="true"
/>
