<script lang="ts">
	import {
		TERMINAL_VIEW_TAG,
		defineTerminalView,
		type TerminalViewElement,
		type TerminalViewSnapshot,
	} from '@agenter/terminal-view';

	if (typeof window !== 'undefined' && typeof customElements !== 'undefined') {
		defineTerminalView();
	}

	let {
		terminalId,
		viewportMode = 'fit',
		transportUrl,
		snapshot = null,
		class: className = '',
	}: {
		terminalId: string;
		viewportMode?: 'fit' | 'cover';
		transportUrl?: string;
		snapshot?: TerminalViewSnapshot | null;
		class?: string;
	} = $props();

	type TerminalViewHostElement = HTMLElement &
		Pick<TerminalViewElement, 'transportUrl' | 'terminalId' | 'viewportMode' | 'snapshot'>;

	let element = $state<TerminalViewHostElement | null>(null);

	const syncProps = (): void => {
		if (!element) {
			return;
		}
		element.transportUrl = transportUrl ?? '';
		element.terminalId = terminalId;
		element.viewportMode = viewportMode;
		element.snapshot = snapshot ?? null;
	};

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
