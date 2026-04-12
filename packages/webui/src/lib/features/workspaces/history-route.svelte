<script lang="ts">
	import ArrowUpDownIcon from '@lucide/svelte/icons/arrow-up-down';
	import { goto } from '$app/navigation';

	import { getAppControllerContext } from '$lib/app/controller-context';
	import * as Select from '$lib/components/ui/select/index.js';
	import WorkbenchScaffold from '$lib/features/navigation/workbench-scaffold.svelte';
	import {
		buildWorkspaceDetailHref,
	} from './workspace-location';
	import {
		describeCompactWorkspace,
		sortWorkspacesForHistory,
		type WorkspaceHistorySortMode,
	} from './workspace-sorting';

	const controller = getAppControllerContext();

	let sortMode = $state<WorkspaceHistorySortMode>('recent');

	const sorted = $derived(sortWorkspacesForHistory(controller.runtimeState.workspaces, sortMode));
	const sortModeItems = [
		{ value: 'recent', label: 'Last used' },
		{ value: 'path', label: 'Path' },
		{ value: 'name', label: 'Name' },
	] as const satisfies { value: WorkspaceHistorySortMode; label: string }[];
	const selectedSortModeLabel = $derived(
		sortModeItems.find((item) => item.value === sortMode)?.label ?? 'Last used',
	);
</script>

<WorkbenchScaffold tone="page" body="scroll" contentClass="divide-y px-0 py-0" data-testid="history-route">
	{#snippet header()}
			<div class="flex flex-wrap items-center justify-between gap-3">
				<div>
					<h1 class="text-base font-semibold">History</h1>
				</div>
				<div class="flex items-center gap-2">
					<ArrowUpDownIcon class="size-4 text-muted-foreground" />
					<Select.Root
						type="single"
						items={sortModeItems}
						value={sortMode}
						onValueChange={(value) => {
							sortMode = value as WorkspaceHistorySortMode;
						}}
					>
						<Select.Trigger class="min-w-40">{selectedSortModeLabel}</Select.Trigger>
						<Select.Content>
							{#each sortModeItems as item (item.value)}
								<Select.Item value={item.value} label={item.label}>{item.label}</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
				</div>
			</div>
	{/snippet}

	{#each sorted as workspace (workspace.path)}
		<a
			href={buildWorkspaceDetailHref({ workspacePath: workspace.path })}
			class="grid gap-2 px-5 py-4 transition-colors hover:bg-muted/30 md:px-7"
			onclick={(event) => {
				event.preventDefault();
				void goto(buildWorkspaceDetailHref({ workspacePath: workspace.path }));
			}}
		>
			<div class="flex items-center justify-between gap-3">
				<div class="min-w-0">
					<div class="truncate text-sm font-semibold">{describeCompactWorkspace(workspace.path)}</div>
					<div class="text-[11px] text-muted-foreground">{workspace.lastSessionActivityAt ?? 'Never started'}</div>
				</div>
				<div class="rounded-full border px-2 py-1 text-[11px]">{workspace.favorite ? 'Favorite' : 'Open'}</div>
			</div>
		</a>
	{/each}
</WorkbenchScaffold>
