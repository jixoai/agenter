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
		if (nextTerminal) {
			void goto(`/terminals/${encodeURIComponent(nextTerminal.terminalId)}`, {
				replaceState: true,
				noScroll: true,
				keepFocus: true,
			});
			return;
		}
		if (
			!controller.runtimeState.globalTerminalHistory.loaded &&
			controller.runtimeState.globalTerminalHistory.error === null
		) {
			return;
		}
		const nextHref =
			controller.runtimeState.globalTerminalHistory.data.length > 0 ? '/terminals/history' : '/terminals/new';
		void goto(nextHref, {
			replaceState: true,
			noScroll: true,
			keepFocus: true,
		});
	});
</script>

<div class="px-4 py-6 text-sm text-muted-foreground">Opening terminal workbench…</div>
