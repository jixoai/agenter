<script lang="ts">
	import ListTodoIcon from '@lucide/svelte/icons/list-todo';
	import PlayIcon from '@lucide/svelte/icons/play';
	import PowerIcon from '@lucide/svelte/icons/power';
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
	import {
		isTerminalRunning,
		resolveTerminalIdentitySubtitle,
		resolveTerminalInstanceName,
		resolveTerminalLifecycleFacts,
	} from './terminal-display';
	import type { TerminalLifecycleIntent } from './terminal-system-surface.types';

	let {
		selectedTerminal,
		actionsOpen,
		usersOpen,
		lifecycleBusy = false,
		lifecycleIntent = null,
		onToggleActions,
		onOpenUsers,
		onStopTerminal,
		onBootstrapTerminal,
	}: {
		selectedTerminal: GlobalTerminalEntry | null;
		actionsOpen: boolean;
		usersOpen: boolean;
		lifecycleBusy?: boolean;
		lifecycleIntent?: TerminalLifecycleIntent | null;
		onToggleActions: () => void;
		onOpenUsers: () => void;
		onStopTerminal: () => void;
		onBootstrapTerminal: () => void;
	} = $props();

	const terminalTitle = $derived(resolveTerminalInstanceName(selectedTerminal));
	const terminalSubtitle = $derived(resolveTerminalIdentitySubtitle(selectedTerminal));

	type TerminalToolbarStatusFact = {
		label: string;
		title: string;
		tone: 'neutral' | 'accent' | 'positive' | 'warning' | 'critical';
		caps?: boolean;
	};

	const terminalStatusFacts = $derived(resolveTerminalLifecycleFacts(selectedTerminal) satisfies TerminalToolbarStatusFact[]);
	const lifecycleAction = $derived<TerminalLifecycleIntent>(
		lifecycleIntent ?? (selectedTerminal && isTerminalRunning(selectedTerminal) ? 'stop' : 'bootstrap'),
	);
	const lifecycleActionLabel = $derived.by(() => {
		if (lifecycleBusy && lifecycleAction === 'bootstrap') {
			return 'Bootstrapping PTY…';
		}
		if (lifecycleBusy && lifecycleAction === 'stop') {
			return 'Killing PTY…';
		}
		return lifecycleAction === 'stop' ? 'Kill PTY' : 'Bootstrap PTY';
	});
	const lifecycleActionTitle = $derived.by(() => {
		if (lifecycleBusy && lifecycleAction === 'bootstrap') {
			return 'Starting the PTY for this provisioned terminal.';
		}
		if (lifecycleBusy && lifecycleAction === 'stop') {
			return 'Stopping the live PTY while preserving the terminal.';
		}
		return lifecycleAction === 'stop'
			? 'Stop the live PTY while preserving the terminal.'
			: 'Start the PTY for this provisioned terminal.';
	});

	const terminalHelpText =
		'Shared terminals reopen durable tabs for long-lived shell sessions. Bootstrap/Kill PTY controls runtime lifecycle; Delete terminal remains a separate destructive action in the terminal window.';
</script>

{#snippet terminalToolbarIdentityLeading(_toolbarState: WorkbenchToolbarRenderState)}
	<SquareTerminalIcon class="size-4 text-muted-foreground" />
{/snippet}

{#snippet terminalToolbarIdentityTitle(_toolbarState: WorkbenchToolbarRenderState)}
	<span class="truncate">{terminalTitle}</span>
{/snippet}

{#snippet terminalToolbarIdentitySubtitle(_toolbarState: WorkbenchToolbarRenderState)}
	{#if terminalSubtitle}
		<span class="truncate">{terminalSubtitle}</span>
	{/if}
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
		{#if selectedTerminal}
			<WorkbenchToolbarAction
				type="button"
				placement={toolbarState.placement}
				label={lifecycleActionLabel}
				title={lifecycleActionTitle}
				inlineLabel
				disabled={lifecycleBusy}
				onclick={lifecycleAction === 'stop' ? onStopTerminal : onBootstrapTerminal}
			>
				{#if lifecycleAction === 'stop'}
					<PowerIcon class="size-4" />
				{:else}
					<PlayIcon class="size-4" />
				{/if}
			</WorkbenchToolbarAction>
		{/if}
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
