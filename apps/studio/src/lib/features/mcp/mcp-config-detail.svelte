<script lang="ts">
	import type {
		McpInspectorCloseInput,
		McpInspectorCloseOutput,
		McpInspectorEvent,
		McpInspectorStartInput,
		McpInspectorStartOutput,
		McpProbeInput,
		McpProbeOutput,
	} from '@agenter/client-sdk';
	import CircleEllipsisIcon from '@lucide/svelte/icons/circle-ellipsis';
	import HelpCircleIcon from '@lucide/svelte/icons/help-circle';
	import PlayIcon from '@lucide/svelte/icons/play';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import RotateCwIcon from '@lucide/svelte/icons/rotate-cw';
	import SquareIcon from '@lucide/svelte/icons/square';
	import TrashIcon from '@lucide/svelte/icons/trash';

	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import HelpHint from '$lib/components/web-components/help-hint.svelte';
	import WorkbenchDetailDrawer from '$lib/features/navigation/workbench-detail-drawer.svelte';

	import McpNewGlobalForm from './mcp-new-global-form.svelte';
	import type {
		McpAvatarCatalogOption,
		McpConfigCatalogRow,
		McpGlobalConfigDraft,
		McpWorkbenchRow,
	} from './mcp-workbench-state';

	let {
		row,
		initialRow,
		avatarOptions,
		knownConfigRows,
		projectRows,
		pending = false,
		selectedProjectPath = null,
		onOpenAvatar,
		onRemoveConfig,
		onSubmitGlobal,
		onProbe,
		onInspectorStart,
		onInspectorClose,
		onInspectorSubscribe,
		onAddProject,
		onStartProject,
		onStopProject,
		onRestartProject,
		onRemoveProject,
	}: {
		row: McpConfigCatalogRow | null;
		initialRow: McpWorkbenchRow | null;
		avatarOptions: readonly McpAvatarCatalogOption[];
		knownConfigRows: readonly McpConfigCatalogRow[];
		projectRows: readonly McpWorkbenchRow[];
		pending?: boolean;
		selectedProjectPath?: string | null;
		onOpenAvatar?: (avatarNickname: string) => void;
		onRemoveConfig?: (row: McpWorkbenchRow) => Promise<void>;
		onSubmitGlobal: (draft: McpGlobalConfigDraft, options?: { override?: boolean }) => Promise<void>;
		onProbe: (input: McpProbeInput) => Promise<McpProbeOutput>;
		onInspectorStart?: (input: McpInspectorStartInput) => Promise<McpInspectorStartOutput>;
		onInspectorClose?: (input: McpInspectorCloseInput) => Promise<McpInspectorCloseOutput>;
		onInspectorSubscribe?: (
			input: McpInspectorCloseInput,
			handlers: {
				onData: (event: McpInspectorEvent) => void;
				onError?: () => void;
			},
		) => { unsubscribe: () => void };
		onAddProject: (projectPath: string) => Promise<void>;
		onStartProject: (row: McpWorkbenchRow) => Promise<void>;
		onStopProject: (row: McpWorkbenchRow) => Promise<void>;
		onRestartProject: (row: McpWorkbenchRow) => Promise<void>;
		onRemoveProject: (row: McpWorkbenchRow) => Promise<void>;
	} = $props();

	const helpText =
		'Global config stays Avatar-owned. Project rows below are exact-path projections that can be added, started, stopped, restarted, or removed independently.';

	let addDialogOpen = $state(false);
	let addProjectPath = $state('');
	let addError = $state<string | null>(null);
	let lastConfigKey = $state<string | null>(null);

	$effect(() => {
		const nextConfigKey = row ? `${row.avatarNickname}:${row.name}` : null;
		if (nextConfigKey === lastConfigKey) {
			return;
		}
		lastConfigKey = nextConfigKey;
		addDialogOpen = false;
		addProjectPath = '';
		addError = null;
	});

	const submitAddProject = async (): Promise<void> => {
		addError = null;
		const projectPath = addProjectPath.trim();
		if (!projectPath) {
			addError = 'Project path is required';
			return;
		}
		try {
			await onAddProject(projectPath);
			addDialogOpen = false;
			addProjectPath = '';
		} catch (error) {
			addError = error instanceof Error ? error.message : String(error);
		}
	};

	const isSelectedProjectRow = (projectRow: McpWorkbenchRow): boolean =>
		Boolean(selectedProjectPath && projectRow.projectPath === selectedProjectPath);
</script>

{#if row && initialRow}
	<WorkbenchDetailDrawer
		title={row.title}
		contentClass="gap-0 p-0"
		data-testid="mcp-config-detail"
	>
		{#snippet titleAccessory()}
			<Badge variant="secondary">{row.transport}</Badge>
		{/snippet}

		<McpNewGlobalForm
			avatarOptions={avatarOptions}
			{knownConfigRows}
			ownerAvatarNickname={row.avatarNickname}
			initialRow={initialRow}
			pending={pending}
			{onOpenAvatar}
			onRemove={onRemoveConfig}
			onSubmit={onSubmitGlobal}
			{onProbe}
			{onInspectorStart}
			{onInspectorClose}
			{onInspectorSubscribe}
		/>

		<section class="grid gap-3 border-t border-border/50 p-4">
			<div class="flex min-w-0 items-center justify-between gap-3">
				<div class="flex min-w-0 items-center gap-2">
					<div class="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Instances</div>
					<HelpHint ariaLabel="MCP instances help" side="bottom" align="start" textContext={helpText}>
						<HelpCircleIcon class="size-4 text-muted-foreground" />
					</HelpHint>
				</div>
				<div class="flex items-center gap-2">
					<Badge variant="outline">{projectRows.length}</Badge>
					<Button size="sm" variant="outline" disabled={pending} onclick={() => (addDialogOpen = true)}>
						<PlusIcon class="size-4" />
						Add
					</Button>
				</div>
			</div>

			{#if projectRows.length === 0}
				<div class="text-sm text-muted-foreground">No exact-project rows exist yet.</div>
			{:else}
				<div class="divide-y divide-border/45">
					{#each projectRows as projectRow (`${projectRow.name}:${projectRow.projectPath ?? 'global'}`)}
						<div
							class={`grid gap-2 px-1 py-3 ${isSelectedProjectRow(projectRow) ? 'rounded-lg bg-accent/35' : ''}`}
							data-testid="mcp-config-instance-row"
							data-selected={isSelectedProjectRow(projectRow) ? 'true' : 'false'}
						>
							<div class="flex min-w-0 items-start justify-between gap-3">
								<div class="grid min-w-0 gap-1">
									<div class="truncate text-sm font-semibold">
										{projectRow.projectPath ?? 'unknown project'}
									</div>
									<div class="flex min-w-0 flex-wrap items-center gap-1.5">
										<Badge variant={projectRow.projectState === 'enabled' ? 'outline' : 'secondary'}>
											{projectRow.projectState === 'enabled' ? 'enabled' : 'disabled'}
										</Badge>
										<Badge variant={projectRow.lifecycle === 'failed' ? 'destructive' : 'secondary'}>
											{projectRow.lifecycle}
										</Badge>
										<Badge variant="secondary">{projectRow.tools.length} tools</Badge>
										{#if projectRow.latestError}
											<Badge variant="destructive">error</Badge>
										{/if}
									</div>
								</div>

								<div class="flex items-center gap-1">
									{#if projectRow.lifecycle === 'running'}
										<Button
											size="icon-sm"
											variant="ghost"
											class="rounded-full"
											disabled={pending}
											aria-label={`Stop ${projectRow.projectPath ?? projectRow.name}`}
											title="Stop"
											onclick={() => void onStopProject(projectRow)}
										>
											<SquareIcon class="size-4" />
										</Button>
									{:else if projectRow.projectState === 'enabled'}
										<Button
											size="icon-sm"
											variant="ghost"
											class="rounded-full"
											disabled={pending}
											aria-label={`Start ${projectRow.projectPath ?? projectRow.name}`}
											title="Start"
											onclick={() => void onStartProject(projectRow)}
										>
											<PlayIcon class="size-4" />
										</Button>
									{/if}

									<Button
										size="icon-sm"
										variant="ghost"
										class="rounded-full text-muted-foreground hover:text-destructive"
										disabled={pending}
										aria-label={`Remove ${projectRow.projectPath ?? projectRow.name}`}
										title="Remove"
										onclick={() => void onRemoveProject(projectRow)}
									>
										<TrashIcon class="size-4" />
									</Button>

									<DropdownMenu.Root>
										<DropdownMenu.Trigger>
											{#snippet child({ props })}
												<Button
													{...props}
													type="button"
													size="icon-sm"
													variant="ghost"
													class="rounded-full text-muted-foreground hover:text-foreground data-[state=open]:bg-accent"
													aria-label={`More actions for ${projectRow.projectPath ?? projectRow.name}`}
													title="More"
												>
													<CircleEllipsisIcon class="size-4" />
												</Button>
											{/snippet}
										</DropdownMenu.Trigger>
										<DropdownMenu.Content align="end" sideOffset={6}>
											<DropdownMenu.Item
												disabled={pending || projectRow.projectState !== 'enabled'}
												onclick={() => void onRestartProject(projectRow)}
											>
												<div class="flex items-center gap-2">
													<RotateCwIcon class="size-4" />
													<span>Restart</span>
												</div>
											</DropdownMenu.Item>
										</DropdownMenu.Content>
									</DropdownMenu.Root>
								</div>
							</div>

							<div class="truncate text-xs text-muted-foreground">
								{projectRow.snapshotAt ? `snapshot ${projectRow.snapshotAt}` : 'no snapshot'} · {projectRow.latestAction.label}
							</div>

							{#if projectRow.latestError}
								<div class="text-xs text-destructive">{projectRow.latestError}</div>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		</section>
	</WorkbenchDetailDrawer>

	<Dialog.Root bind:open={addDialogOpen}>
		<Dialog.Content class="sm:max-w-lg" data-testid="mcp-add-project-dialog">
			<Dialog.Header>
				<Dialog.Title>Add project instance</Dialog.Title>
				<Dialog.Description>
					Enable {row.name} for one exact project path. Starting stays a separate action.
				</Dialog.Description>
			</Dialog.Header>
			<div class="grid gap-3">
				<label class="grid gap-1.5 text-xs text-muted-foreground">
					Project path
					<Input bind:value={addProjectPath} class="h-8 text-sm" autocomplete="off" />
				</label>
				{#if addError}
					<div class="text-sm text-destructive">{addError}</div>
				{/if}
			</div>
			<Dialog.Footer>
				<Button variant="outline" onclick={() => (addDialogOpen = false)}>Cancel</Button>
				<Button disabled={pending} onclick={submitAddProject}>Add</Button>
			</Dialog.Footer>
		</Dialog.Content>
	</Dialog.Root>
{:else}
	<WorkbenchDetailDrawer title="Config detail" contentClass="p-4" data-testid="mcp-config-detail-empty">
		<div class="text-sm text-muted-foreground">Select one config or start a new draft.</div>
	</WorkbenchDetailDrawer>
{/if}
