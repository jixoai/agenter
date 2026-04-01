<script lang="ts">
	import ArrowUpDownIcon from '@lucide/svelte/icons/arrow-up-down';
	import { goto } from '$app/navigation';

import { getAppControllerContext } from '$lib/app/controller-context';
import ScrollView from '$lib/components/scroll-view.svelte';
	import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card/index.js';
	import * as NativeSelect from '$lib/components/ui/native-select/index.js';
	import { sortWorkspacesForHistory, type WorkspaceHistorySortMode } from './workspace-sorting';

	const controller = getAppControllerContext();

	let sortMode = $state<WorkspaceHistorySortMode>('recent');

	const sorted = $derived(sortWorkspacesForHistory(controller.runtimeState.workspaces, sortMode));
</script>

<div class="grid h-full min-h-0 p-4 md:p-6">
	<Card class="min-h-0 py-0">
		<CardHeader class="gap-2 border-b">
			<div class="flex flex-wrap items-center justify-between gap-3">
				<div>
					<CardTitle>History</CardTitle>
					<CardDescription>List all workspaces by last used time, path, or name.</CardDescription>
				</div>
				<div class="flex items-center gap-2">
					<ArrowUpDownIcon class="size-4 text-muted-foreground" />
					<NativeSelect.Root bind:value={sortMode} class="min-w-40">
						<option value="recent">Last used</option>
						<option value="path">Path</option>
						<option value="name">Name</option>
					</NativeSelect.Root>
				</div>
			</div>
		</CardHeader>
		<CardContent class="min-h-0 p-0">
			<ScrollView class="h-full" contentClass="divide-y">
				{#each sorted as workspace (workspace.path)}
					<a
						href={`/workspaces?path=${encodeURIComponent(workspace.path)}`}
						class="grid gap-2 px-4 py-4 transition-colors hover:bg-muted/40"
						onclick={(event) => {
							event.preventDefault();
							void goto(`/workspaces?path=${encodeURIComponent(workspace.path)}`);
						}}
					>
						<div class="flex items-center justify-between gap-3">
							<div class="min-w-0">
								<div class="truncate text-sm font-semibold">{workspace.path === '~/' ? 'Global workspace' : workspace.path}</div>
								<div class="truncate text-xs text-muted-foreground">
									{workspace.group} · {workspace.counts.running} running · {workspace.counts.all} total
								</div>
							</div>
							<div class="rounded-full border px-2 py-1 text-[11px]">{workspace.favorite ? 'Favorite' : 'Open'}</div>
						</div>
						<div class="text-[11px] text-muted-foreground">{workspace.lastSessionActivityAt ?? 'Never started'}</div>
					</a>
				{/each}
			</ScrollView>
		</CardContent>
	</Card>
</div>
