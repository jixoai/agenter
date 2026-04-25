<script lang="ts">
	import ListTodoIcon from '@lucide/svelte/icons/list-todo';
	import SquareTerminalIcon from '@lucide/svelte/icons/square-terminal';
	import UsersIcon from '@lucide/svelte/icons/users';
	import type { GlobalTerminalEntry } from '@agenter/client-sdk';

	import HelpHint from '$lib/components/web-components/help-hint.svelte';
	import WorkbenchToolbarAction from '$lib/features/navigation/workbench-toolbar-action.svelte';
	import WorkbenchToolbarStatus from '$lib/features/navigation/workbench-toolbar-status.svelte';
	import WorkbenchToolbarToggle from '$lib/features/navigation/workbench-toolbar-toggle.svelte';
	import WorkbenchToolbar from '$lib/features/navigation/workbench-toolbar.svelte';
	import type { WorkbenchToolbarRenderState } from '$lib/features/navigation/workbench-toolbar.types';
	import { cn } from '$lib/utils.js';

	let {
		selectedTerminal,
		actionsOpen,
		usersOpen,
		onToggleActions,
		onOpenUsers,
	}: {
		selectedTerminal: GlobalTerminalEntry | null;
		actionsOpen: boolean;
		usersOpen: boolean;
		onToggleActions: () => void;
		onOpenUsers: () => void;
	} = $props();

	const terminalTitle = $derived.by(() => {
		if (!selectedTerminal) {
			return 'Shared terminal';
		}
		const title = selectedTerminal.title?.trim();
		return title && title !== selectedTerminal.terminalId ? title : selectedTerminal.terminalId;
	});

	const terminalSubtitle = $derived.by(() => {
		if (!selectedTerminal) {
			return 'Select an active terminal tab.';
		}
		const title = selectedTerminal.title?.trim();
		if (title && title !== selectedTerminal.terminalId) {
			return `${selectedTerminal.terminalId} · ${selectedTerminal.cwd}`;
		}
		return selectedTerminal.cwd;
	});

	type TerminalToolbarStatusFact = {
		label: string;
		title: string;
		tone: 'neutral' | 'accent' | 'positive' | 'warning' | 'critical';
		caps?: boolean;
	};

	const terminalStatusFacts = $derived.by(() => {
		if (!selectedTerminal) {
			return [
				{
					label: 'No terminal',
					title: 'No shared terminal is selected.',
					tone: 'neutral',
					caps: true,
				},
			] satisfies TerminalToolbarStatusFact[];
		}

		const facts: TerminalToolbarStatusFact[] = [
			{
				label: selectedTerminal.running ? 'Running' : 'Stopped',
				title: selectedTerminal.running ? 'PTY is currently running.' : 'PTY is currently stopped.',
				tone: selectedTerminal.running ? 'positive' : 'warning',
				caps: true,
			},
		];

		if (selectedTerminal.running) {
			facts.push({
				label: selectedTerminal.status === 'BUSY' ? 'Busy' : 'Idle',
				title:
					selectedTerminal.status === 'BUSY'
						? 'Terminal is processing active work.'
						: 'Terminal is waiting for the next interaction.',
				tone: selectedTerminal.status === 'BUSY' ? 'accent' : 'neutral',
			});
		}

		return facts;
	});

	const terminalHelpText =
		'Shared terminals reopen durable tabs for long-lived shell sessions. Actions stays in-page; Users opens a dedicated management dialog.';
</script>

{#snippet terminalToolbarIdentityLeading(_toolbarState: WorkbenchToolbarRenderState)}
	<SquareTerminalIcon class="size-4 text-muted-foreground" />
{/snippet}

{#snippet terminalToolbarIdentityTitle(_toolbarState: WorkbenchToolbarRenderState)}
	<span class="truncate">{terminalTitle}</span>
{/snippet}

{#snippet terminalToolbarIdentitySubtitle(_toolbarState: WorkbenchToolbarRenderState)}
	<span class="truncate">{terminalSubtitle}</span>
{/snippet}

{#snippet terminalToolbarStatus(toolbarState: WorkbenchToolbarRenderState)}
	<div
		class={cn(
			'flex min-w-0 flex-wrap items-center gap-1',
			toolbarState.placement === 'overflow' ? 'justify-start' : 'justify-end',
		)}
	>
		{#each terminalStatusFacts as fact (fact.label)}
			<WorkbenchToolbarStatus
				placement={toolbarState.placement}
				label={fact.label}
				title={fact.title}
				tone={fact.tone}
				caps={fact.caps ?? false}
			/>
		{/each}
	</div>
{/snippet}

{#snippet terminalToolbarActions(toolbarState: WorkbenchToolbarRenderState)}
	<div
		class={cn(
			'flex min-w-0 items-center gap-1',
			toolbarState.placement === 'overflow' && 'grid justify-items-start gap-2',
		)}
		aria-label="Terminal detail view actions"
	>
		<WorkbenchToolbarToggle
			placement={toolbarState.placement}
			label="Actions"
			title={actionsOpen ? 'Hide terminal actions' : 'Show terminal actions'}
			pressed={actionsOpen}
			inlineTone="active"
			onclick={onToggleActions}
		>
			<ListTodoIcon class="size-4" />
		</WorkbenchToolbarToggle>
		<WorkbenchToolbarAction
			type="button"
			placement={toolbarState.placement}
			label="Users"
			title="Show terminal users"
			inlineLabel
			inlineTone={usersOpen ? 'active' : 'neutral'}
			onclick={onOpenUsers}
		>
			<UsersIcon class="size-4" />
		</WorkbenchToolbarAction>

		<HelpHint
			ariaLabel="Terminal workbench help"
			align={toolbarState.placement === 'overflow' ? 'start' : 'end'}
			side="bottom"
			textContext={terminalHelpText}
		>
			<p class="max-w-[17rem] text-balance sm:max-w-xs">
				{terminalHelpText}
			</p>
		</HelpHint>
	</div>
{/snippet}

<WorkbenchToolbar
	identityLeading={terminalToolbarIdentityLeading}
	identityTitle={terminalToolbarIdentityTitle}
	identitySubtitle={terminalToolbarIdentitySubtitle}
	status={terminalToolbarStatus}
	actions={terminalToolbarActions}
	overflowLabel="Open terminal toolbar details"
/>
