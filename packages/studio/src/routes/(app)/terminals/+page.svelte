<script lang="ts">
	import { goto } from '$app/navigation';
	import { getAppControllerContext } from '$lib/app/controller-context';
	import { readDismissedWorkbenchTabIds } from '$lib/features/navigation/workbench-tab-state';

	const controller = getAppControllerContext();

	$effect(() => {
		if (!controller.runtimeState.globalTerminals.loaded) {
			return;
		}
		const dismissedTerminalIds = new Set(readDismissedWorkbenchTabIds('terminals'));
		const nextTerminal = controller.runtimeState.globalTerminals.data.find(
			(terminal) => !dismissedTerminalIds.has(terminal.terminalId),
		);
		const nextHref = nextTerminal ? `/terminals/${encodeURIComponent(nextTerminal.terminalId)}` : '/terminals/new';
		void goto(nextHref, {
			replaceState: true,
			noScroll: true,
			keepFocus: true,
		});
	});
</script>

<div class="px-4 py-6 text-sm text-muted-foreground">Opening terminal workbench…</div>
