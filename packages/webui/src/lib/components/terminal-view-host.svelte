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
	let resolvedTerminalId = '';
	let resolvedSnapshot: TerminalViewSnapshot | null = null;
	let resolvedTransportUrl = '';
	let resolvedCwd = '';

	const syncResolvedProps = (): void => {
		if (resolvedTerminalId.length === 0 || resolvedTerminalId !== terminalId) {
			resolvedTerminalId = terminalId;
			resolvedSnapshot = snapshot ?? null;
			resolvedTransportUrl = transportUrl ?? '';
			resolvedCwd = cwd ?? '';
			return;
		}
		if (snapshot) {
			resolvedSnapshot = snapshot;
		}
		if (transportUrl && transportUrl.length > 0) {
			resolvedTransportUrl = transportUrl;
		}
		if (cwd && cwd.trim().length > 0 && cwd !== '.') {
			resolvedCwd = cwd;
		}
	};

	const syncProps = (): void => {
		syncResolvedProps();
		if (!element) {
			return;
		}
		element.transportUrl = resolvedTransportUrl;
		element.terminalId = terminalId;
		element.terminalTitle = terminalTitle ?? terminalId;
		element.cwd = resolvedCwd;
		element.status = status;
		element.viewportMode = viewportMode;
		element.snapshot = resolvedSnapshot;
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
