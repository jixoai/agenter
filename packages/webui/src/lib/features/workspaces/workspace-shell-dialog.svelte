<script lang="ts">
	import XIcon from '@lucide/svelte/icons/x';
	import { ClipSurface } from '@agenter/svelte-components';

	import { Badge } from '$lib/components/ui/badge/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';

	import {
		buildWorkspaceShellPromptLabel,
		describeWorkspaceShellSurface,
		formatWorkspaceShellPath,
		type WorkspaceShellLaunch,
	} from './workspace-shell-contract';
	import WorkspaceShellTerminal from './workspace-shell-terminal.svelte';

	let {
		open = $bindable(false),
		launch,
		launchKey = null,
		onExec,
	}: {
		open?: boolean;
		launch: WorkspaceShellLaunch | null;
		launchKey?: string | null;
		onExec: (input: {
			avatar: string;
			command: string;
			cwd?: string;
			runtimeId: string;
			surface: WorkspaceShellLaunch['surface'];
			workspacePath: string;
		}) => Promise<{
			cwd: string;
			exitCode: number;
			stderr: string;
			stdout: string;
		}>;
	} = $props();

	let running = $state(false);
	let cwd = $state<string | null>(null);

	const surfaceDescriptor = $derived(
		launch ? describeWorkspaceShellSurface(launch.surface) : describeWorkspaceShellSurface('public-workspace'),
	);
	const promptLabel = $derived(
		launch
			? buildWorkspaceShellPromptLabel({
					avatar: launch.avatar,
					surface: launch.surface,
				})
			: 'default@workspace',
	);
	const currentPathValue = $derived(formatWorkspaceShellPath(cwd ?? launch?.cwd));
</script>

<Dialog.Root bind:open>
	<Dialog.Content
		class="left-0 top-0 h-svh w-svw max-w-none translate-x-0 translate-y-0 gap-0 rounded-none p-0 sm:left-[50%] sm:top-[50%] sm:h-[min(52rem,calc(100svh-2rem))] sm:w-full sm:max-w-5xl sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-[1.4rem]"
		showCloseButton={false}
		data-testid="workspace-shell-dialog"
	>
		<Dialog.Header class="sr-only">
			<Dialog.Title>Run in shell</Dialog.Title>
			<Dialog.Description>Run the selected workspace CLI command inside one backend shell projection.</Dialog.Description>
		</Dialog.Header>

		<div class="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)]">
			<div class="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 border-b px-4 py-4 sm:px-6">
				<div class="grid min-w-0 gap-2">
					<div class="grid gap-1">
						<div class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
							Workspace shell
						</div>
						<div class="grid min-w-0 gap-2 sm:flex sm:flex-wrap sm:items-center">
							<div class="truncate text-base font-semibold text-foreground sm:max-w-[18rem]">{surfaceDescriptor.title}</div>
							{#if launch}
								<code class="max-w-full overflow-hidden text-ellipsis whitespace-nowrap rounded bg-muted/60 px-2 py-1 text-[11px] md:text-xs">
									{launch.command}
								</code>
							{/if}
						</div>
						<div class="grid min-w-0 gap-1 text-xs text-muted-foreground sm:text-sm">
							<span class="font-medium uppercase tracking-[0.16em] text-muted-foreground">Current path</span>
							<code
								class="max-w-full whitespace-normal break-all rounded bg-muted/60 px-2 py-1 text-[11px] leading-relaxed md:text-xs"
								title={currentPathValue}
							>
								{currentPathValue}
							</code>
						</div>
					</div>

					<div class="flex flex-wrap items-center gap-2">
						{#if launch}
							<Badge variant="outline">Avatar {launch.avatar}</Badge>
						{/if}
						<Badge variant="outline">{surfaceDescriptor.badgeLabel}</Badge>
						<Badge variant="outline">{running ? 'Running' : 'Ready'}</Badge>
						{#if launch?.commandLabel && launch.commandLabel !== launch.command}
							<Badge variant="secondary">{launch.commandLabel}</Badge>
						{/if}
					</div>
				</div>

				<Dialog.Close
					class="ring-offset-background focus:ring-ring inline-flex size-9 shrink-0 items-center justify-center rounded-full opacity-70 transition-opacity hover:bg-muted hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden"
				>
					<XIcon class="size-4" />
					<span class="sr-only">Close</span>
				</Dialog.Close>
			</div>

			<ClipSurface
				class="bg-[#0b1220] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] sm:rounded-b-[1.4rem]"
				data-testid="workspace-shell-dialog-terminal-frame"
			>
				{#if open && launch}
					{#key launchKey ?? `${launch.runtimeId}:${launch.surface}:${launch.command}`}
						<WorkspaceShellTerminal
							avatar={launch.avatar}
							bind:cwd
							initialCommand={launch.command}
							initialCwd={launch.cwd}
							{onExec}
							{promptLabel}
							bind:running
							runtimeId={launch.runtimeId}
							surface={launch.surface}
							workspacePath={launch.workspacePath}
						/>
					{/key}
				{:else}
					<div class="grid h-full place-items-center px-4 text-center text-sm text-slate-200">
						No shell launch is selected yet.
					</div>
				{/if}
			</ClipSurface>
		</div>
	</Dialog.Content>
</Dialog.Root>
