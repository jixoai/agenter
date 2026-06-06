<script lang="ts">
	import { ScrollView } from '@agenter/svelte-components';
	import ListIcon from '@lucide/svelte/icons/list';
	import NetworkIcon from '@lucide/svelte/icons/network';
	import PanelRightOpenIcon from '@lucide/svelte/icons/panel-right-open';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';
	import SearchIcon from '@lucide/svelte/icons/search';

	import { getAppControllerContext } from '$lib/app/controller-context';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import * as NativeSelect from '$lib/components/ui/native-select/index.js';
	import HelpHint from '$lib/components/web-components/help-hint.svelte';
	import WorkbenchPageContent from '$lib/features/navigation/workbench-page-content.svelte';
	import WorkbenchPageTabs from '$lib/features/navigation/workbench-page-tabs.svelte';
	import type { WorkbenchPageTabItem } from '$lib/features/navigation/workbench-page-tabs.types';
	import WorkbenchPageToolbar from '$lib/features/navigation/workbench-page-toolbar.svelte';
	import WorkbenchToolbar from '$lib/features/navigation/workbench-toolbar.svelte';
	import type { WorkbenchToolbarRenderState } from '$lib/features/navigation/workbench-toolbar.types';
	import WorkbenchToolbarAction from '$lib/features/navigation/workbench-toolbar-action.svelte';
	import WorkbenchToolbarStatus from '$lib/features/navigation/workbench-toolbar-status.svelte';

	import McpNewGlobalForm from './mcp-new-global-form.svelte';
	import McpServerDetail from './mcp-server-detail.svelte';
	import McpServerList from './mcp-server-list.svelte';
	import {
		countDefaultDisabledMcpRows,
		countEnabledMcpRows,
		countFailedMcpRows,
		countRunningMcpRows,
		filterMcpWorkbenchRows,
		mapEnabledMcpRows,
		mapInstalledMcpRows,
		markMcpRowAction,
		type McpGlobalConfigDraft,
		type McpProjectLifecycleAction,
		type McpProjectionMode,
		type McpQueryRow,
		type McpRuntimeAuthority,
		type McpWorkbenchRow,
	} from './mcp-workbench-state';

	type McpRouteView = 'list' | 'new';

	const controller = getAppControllerContext();
	const installedSql = `select name, title, description, transport_kind, command, args_json, url, headers_json, env_json, created_at, updated_at from mcp_installed order by name`;
	const enabledSql = `select name, project_path, enabled, enabled_source, title, description, transport_kind, lifecycle, last_error, server_name, server_version, protocol_version, snapshot_at, tools_json, resources_json, prompts_json, snapshot_json, created_at, updated_at, last_used_at from mcp_enabled order by name`;

	let projectPath = $state('/Users/kzf/Dev/GitHub/jixoai-labs/agenter');
	let query = $state('');
	let selectedName = $state('');
	let detailCompact = $state(false);
	let detailOpen = $state(true);
	let activeView = $state<McpRouteView>('list');
	let selectedRuntimeId = $state('');
	let projectionMode = $state<McpProjectionMode>('exact-project');
	let rows = $state<readonly McpWorkbenchRow[]>([]);
	let loading = $state(false);
	let actionPending = $state(false);
	let loadError = $state<string | null>(null);
	let actionError = $state<string | null>(null);
	let refreshVersion = $state(0);
	let loadSequence = 0;
	let editingRow = $state<McpWorkbenchRow | null>(null);

	const runtimeOptions = $derived(controller.runtimeState.sessions.filter((session) => session.status === 'running'));
	const selectedRuntimeIdAvailable = $derived(runtimeOptions.some((session) => session.id === selectedRuntimeId));
	const effectiveRuntimeId = $derived(selectedRuntimeIdAvailable ? selectedRuntimeId : runtimeOptions[0]?.id ?? '');
	const selectedRuntimeSession = $derived(runtimeOptions.find((session) => session.id === effectiveRuntimeId) ?? null);
	const runtimeAuthority = $derived.by((): McpRuntimeAuthority => {
		if (!selectedRuntimeSession) {
			return {
				id: 'none',
				label: 'No running AvatarRuntime',
				scope: 'runtime authority required',
			};
		}
		return {
			id: selectedRuntimeSession.id,
			label: selectedRuntimeSession.avatar || selectedRuntimeSession.name,
			scope: 'avatar-private MCP facts',
		};
	});
	const runtimeLabel = $derived(runtimeAuthority.label);
	const hasRuntimeAuthority = $derived(selectedRuntimeSession !== null);
	const activeProjectionMode = $derived(projectionMode === 'exact-project' && projectPath.trim() ? 'exact-project' : 'global-only');
	const visibleRows = $derived(hasRuntimeAuthority ? filterMcpWorkbenchRows(rows, query) : []);
	const enabledRows = $derived(countEnabledMcpRows(visibleRows));
	const defaultDisabledRows = $derived(countDefaultDisabledMcpRows(visibleRows));
	const runningRows = $derived(countRunningMcpRows(visibleRows));
	const failedRows = $derived(countFailedMcpRows(visibleRows));
	const selectedRow = $derived(visibleRows.find((row) => row.name === selectedName) ?? visibleRows[0] ?? null);
	const effectiveSelectedName = $derived(selectedRow?.name ?? selectedName);
	const pageTabs = $derived([
		{
			value: 'list',
			label: 'List',
			title: 'Global registry with exact-project projection',
			badgeLabel: `${visibleRows.length}`,
		},
		{
			value: 'new',
			label: 'New',
			title: 'Create inert global MCP config',
		},
	] satisfies WorkbenchPageTabItem[]);
	const loadKey = $derived(`${effectiveRuntimeId}\u0000${activeProjectionMode}\u0000${projectPath.trim()}\u0000${refreshVersion}`);

	const toErrorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

	const loadMcpProjection = async (): Promise<void> => {
		const runtimeId = effectiveRuntimeId;
		const project = projectPath.trim();
		const mode = activeProjectionMode;
		const sequence = ++loadSequence;

		if (!runtimeId) {
			rows = [];
			loading = false;
			loadError = null;
			return;
		}

		loading = true;
		loadError = null;
		try {
			const output = await controller.runtimeStore.queryMcp({
				sessionId: runtimeId,
				projectPath: mode === 'exact-project' ? project : undefined,
				sql: mode === 'exact-project' ? enabledSql : installedSql,
			});
			if (sequence !== loadSequence) {
				return;
			}
			const queryRows = output.rows as McpQueryRow[];
			rows = mode === 'exact-project' ? mapEnabledMcpRows(queryRows) : mapInstalledMcpRows(queryRows);
			if (!selectedName && rows[0]) {
				selectedName = rows[0].name;
			}
		} catch (error) {
			if (sequence !== loadSequence) {
				return;
			}
			rows = [];
			loadError = toErrorMessage(error);
		} finally {
			if (sequence === loadSequence) {
				loading = false;
			}
		}
	};

	$effect(() => {
		loadKey;
		void loadMcpProjection();
	});

	const refreshMcpProjection = (): void => {
		refreshVersion += 1;
	};

	const runMcpMutation = async <T>(operation: () => Promise<T>, options: { refresh?: boolean } = {}): Promise<T> => {
		actionPending = true;
		actionError = null;
		try {
			const result = await operation();
			if (options.refresh !== false) {
				refreshMcpProjection();
			}
			return result;
		} catch (error) {
			actionError = toErrorMessage(error);
			throw error;
		} finally {
			actionPending = false;
		}
	};

	const selectRow = (name: string): void => {
		selectedName = name;
		detailOpen = true;
	};

	const handleViewChange = (value: string): void => {
		if (value === 'list' || value === 'new') {
			activeView = value;
			if (value === 'new') {
				editingRow = null;
			}
		}
	};

	const handleRuntimeSelectChange = (event: Event): void => {
		const select = event.currentTarget;
		if (select instanceof HTMLSelectElement) {
			selectedRuntimeId = select.value;
		}
	};

	const openEditGlobal = (row: McpWorkbenchRow): void => {
		editingRow = row;
		activeView = 'new';
	};

	const handleGlobalSubmit = async (draft: McpGlobalConfigDraft): Promise<void> => {
		await runMcpMutation(async () => {
			const global = await controller.runtimeStore.addMcpGlobal({
				sessionId: effectiveRuntimeId,
				name: draft.name,
				title: draft.title,
				description: draft.description,
				transport: draft.transport,
				env: draft.env,
			});
			if (draft.enableProjectPath) {
				await controller.runtimeStore.enableMcpProject({
					sessionId: effectiveRuntimeId,
					name: draft.name,
					projectPath: draft.enableProjectPath,
				});
			}
			return global;
		});
		selectedName = draft.name;
		editingRow = null;
		activeView = 'list';
	};

	const handleEnable = async (row: McpWorkbenchRow): Promise<void> => {
		await runMcpMutation(async () =>
			await controller.runtimeStore.enableMcpProject({
				sessionId: effectiveRuntimeId,
				name: row.name,
				projectPath,
			}),
		);
	};

	const handleDisable = async (row: McpWorkbenchRow): Promise<void> => {
		await runMcpMutation(async () =>
			await controller.runtimeStore.disableMcpProject({
				sessionId: effectiveRuntimeId,
				name: row.name,
				projectPath,
			}),
		);
	};

	const handleLifecycle = async (row: McpWorkbenchRow, action: McpProjectLifecycleAction): Promise<void> => {
		await runMcpMutation(async () => {
			const input = {
				sessionId: effectiveRuntimeId,
				name: row.name,
				projectPath,
			};
			if (action === 'start') {
				return await controller.runtimeStore.startMcpProject(input);
			}
			if (action === 'stop') {
				return await controller.runtimeStore.stopMcpProject(input);
			}
			return await controller.runtimeStore.restartMcpProject(input);
		});
	};

	const handleRemove = async (row: McpWorkbenchRow, input: { stop: boolean }): Promise<void> => {
		const result = await runMcpMutation(async () =>
			await controller.runtimeStore.removeMcpGlobal({
				sessionId: effectiveRuntimeId,
				name: row.name,
				stop: input.stop,
			}),
			{ refresh: false },
		);
		if (result.removed) {
			selectedName = '';
			refreshMcpProjection();
			return;
		}
		rows = markMcpRowAction(
			rows,
			row.name,
			{
				operation: 'remove',
				status: 'blocked',
				label: `blocked by ${result.blockedProjects.length} project instance${result.blockedProjects.length === 1 ? '' : 's'}`,
				at: new Date().toISOString(),
				detail: result,
			},
			{ blockedProjects: result.blockedProjects },
		);
	};

	const handleTestCall = async (
		row: McpWorkbenchRow,
		input: { toolName: string; arguments: Record<string, unknown>; autoStart: boolean; autoEnable: boolean },
	): Promise<unknown> => {
		const result = await runMcpMutation(async () =>
			await controller.runtimeStore.callMcpTool({
				sessionId: effectiveRuntimeId,
				name: row.name,
				projectPath,
				toolName: input.toolName,
				arguments: input.arguments,
				autoStart: input.autoStart,
				autoEnable: input.autoEnable,
			}),
		);
		return result;
	};
</script>

{#snippet mcpToolbarPageTabs(toolbarState: WorkbenchToolbarRenderState)}
	<WorkbenchPageTabs
		ariaLabel="MCP sections"
		value={activeView}
		items={pageTabs}
		{toolbarState}
		onValueChange={handleViewChange}
	/>
{/snippet}

{#snippet toolbarIdentityLeading(_toolbarState: WorkbenchToolbarRenderState)}
	<NetworkIcon class="size-4 text-muted-foreground" />
{/snippet}

{#snippet toolbarIdentityTitle(_toolbarState: WorkbenchToolbarRenderState)}
	<span class="truncate">MCP</span>
{/snippet}

{#snippet toolbarIdentitySubtitle(_toolbarState: WorkbenchToolbarRenderState)}
	<span class="truncate">{activeView === 'list' ? runtimeAuthority.scope : editingRow ? 'global config edit' : 'inert global draft'}</span>
{/snippet}

{#snippet toolbarActions(toolbarState: WorkbenchToolbarRenderState)}
	<WorkbenchToolbarAction
		placement={toolbarState.placement}
		label="Refresh MCP projection"
		title="Refresh MCP projection"
		disabled={!hasRuntimeAuthority || loading}
		onclick={refreshMcpProjection}
	>
		<RefreshCwIcon class="size-4" />
	</WorkbenchToolbarAction>
	{#if activeView === 'list'}
		<WorkbenchToolbarAction
			placement={toolbarState.placement}
			label="New global"
			title="New global MCP config"
			disabled={!hasRuntimeAuthority}
			inlineLabel={toolbarState.isWide}
			onclick={() => {
				editingRow = null;
				activeView = 'new';
			}}
		>
			<PlusIcon class="size-4" />
		</WorkbenchToolbarAction>
	{:else}
		<WorkbenchToolbarAction
			placement={toolbarState.placement}
			label="List"
			title="Back to MCP list"
			inlineLabel={toolbarState.isWide}
			onclick={() => {
				editingRow = null;
				activeView = 'list';
			}}
		>
			<ListIcon class="size-4" />
		</WorkbenchToolbarAction>
	{/if}
{/snippet}

{#snippet toolbarStatus(toolbarState: WorkbenchToolbarRenderState)}
	<WorkbenchToolbarStatus
		placement={toolbarState.placement}
		label={hasRuntimeAuthority ? `${visibleRows.length} globals` : 'no runtime'}
		title={hasRuntimeAuthority ? 'Installed global configs' : 'No running AvatarRuntime'}
		tone={hasRuntimeAuthority ? 'neutral' : 'critical'}
	/>
	<WorkbenchToolbarStatus
		placement={toolbarState.placement}
		label={`${enabledRows} enabled`}
		title="Enabled project MCP rows"
		tone={enabledRows > 0 ? 'positive' : 'neutral'}
	/>
	<WorkbenchToolbarStatus
		placement={toolbarState.placement}
		label={`${runningRows} running`}
		title="Running project MCP instances"
		tone={runningRows > 0 ? 'positive' : 'neutral'}
	/>
	<WorkbenchToolbarStatus
		placement={toolbarState.placement}
		label={`${failedRows} failed`}
		title="Failed project MCP rows"
		tone={failedRows > 0 ? 'critical' : 'neutral'}
	/>
	<WorkbenchToolbarStatus
		placement={toolbarState.placement}
		label={`${defaultDisabledRows} default-disabled`}
		title="Default-disabled project projections"
	/>
{/snippet}

{#snippet noRuntimeState()}
	<div class="grid h-full min-w-0 content-start gap-2 p-4 md:p-6" data-testid="mcp-no-runtime-state">
		<div class="text-sm font-semibold">No running AvatarRuntime</div>
		<div class="max-w-2xl text-sm text-muted-foreground">
			MCP facts are runtime-owned. Start or reopen an AvatarRuntime before listing, adding, enabling, or calling MCP servers.
		</div>
	</div>
{/snippet}

<WorkbenchPageToolbar>
	<WorkbenchToolbar
		pageTabs={mcpToolbarPageTabs}
		identityLeading={toolbarIdentityLeading}
		identityTitle={toolbarIdentityTitle}
		identitySubtitle={toolbarIdentitySubtitle}
		actions={toolbarActions}
		status={toolbarStatus}
		overflowLabel="Open MCP toolbar details"
	/>
</WorkbenchPageToolbar>

<div class="h-full min-w-0" data-testid="mcp-route">
	{#if activeView === 'list'}
		<WorkbenchPageContent
			class="h-full min-w-0"
			detailLayout="split-detail"
			bind:detailCompact
			bind:detailOpen
			mainClass="h-full"
			drawerClass="h-full"
			detailRatioPersistence="mcp:workbench:detail"
			detailLeftMin={340}
			detailRightMin={390}
			detailDefaultRatio={0.46}
		>
			{#snippet main()}
				<div class="grid h-full min-w-0 grid-rows-[auto_minmax(0,1fr)]">
					<div class="grid gap-0 border-b border-border/50">
						<div class="grid min-w-0 divide-y divide-border/45 md:grid-cols-[minmax(13rem,0.9fr)_minmax(12rem,0.8fr)_minmax(0,1.2fr)] md:divide-x md:divide-y-0">
							<section class="grid min-w-0 gap-1 px-3 py-3 md:px-5">
								<div class="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Runtime authority</div>
								<div class="truncate text-sm font-semibold">{runtimeAuthority.label}</div>
								<div class="truncate text-xs text-muted-foreground">{runtimeAuthority.id}</div>
							</section>
							<section class="grid min-w-0 gap-1 px-3 py-3 md:px-5">
								<div class="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Global registry</div>
								<div class="text-sm font-semibold">{visibleRows.length} installed</div>
								<div class="truncate text-xs text-muted-foreground">mcp_installed</div>
							</section>
							<section class="grid min-w-0 gap-2 px-3 py-3 md:px-5">
								<div class="flex min-w-0 items-center gap-2">
									<div class="truncate text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
										{activeProjectionMode === 'global-only' ? 'Global-only projection' : 'Exact-project projection'}
									</div>
									<HelpHint
										ariaLabel="MCP projection help"
										side="bottom"
										align="start"
										textContext="Global configs are listed from mcp_installed. Project state is an exact-path projection from mcp_enabled. Viewing a row never starts or enables an MCP server."
									>
										<Badge variant="outline" class="cursor-help">?</Badge>
									</HelpHint>
								</div>
								<div class="flex min-w-0 flex-wrap items-center gap-1.5">
									{#if activeProjectionMode === 'global-only'}
										<Badge variant="secondary">global-only</Badge>
										<Badge variant="secondary">no project rows</Badge>
									{:else}
										<Badge variant={enabledRows > 0 ? 'outline' : 'secondary'}>{enabledRows} enabled</Badge>
										<Badge variant="secondary">{defaultDisabledRows} default-disabled</Badge>
									{/if}
								</div>
								<div class="truncate text-xs text-muted-foreground">
									{activeProjectionMode === 'global-only' ? 'mcp_installed without project enablement' : 'mcp_enabled for one exact path'}
								</div>
							</section>
						</div>
						<div class="grid min-w-0 gap-2 px-3 py-3 md:px-5">
							<div class="grid min-w-0 gap-2 md:grid-cols-[minmax(12rem,0.75fr)_auto_minmax(0,1.25fr)]">
								<NativeSelect.NativeSelect
									value={effectiveRuntimeId}
									class="h-8 text-xs"
									wrapperClass="w-full"
									disabled={runtimeOptions.length === 0}
									onchange={handleRuntimeSelectChange}
								>
									{#if runtimeOptions.length === 0}
										<option value="">No running runtime</option>
									{:else}
										{#each runtimeOptions as runtime (runtime.id)}
											<option value={runtime.id}>{runtime.avatar || runtime.name}</option>
										{/each}
									{/if}
								</NativeSelect.NativeSelect>
								<div class="flex min-w-0 items-center gap-1">
									<Button
										variant={projectionMode === 'global-only' ? 'default' : 'outline'}
										size="sm"
										class="h-8"
										disabled={!hasRuntimeAuthority}
										onclick={() => (projectionMode = 'global-only')}
									>
										Global-only
									</Button>
									<Button
										variant={projectionMode === 'exact-project' ? 'default' : 'outline'}
										size="sm"
										class="h-8"
										disabled={!hasRuntimeAuthority}
										onclick={() => (projectionMode = 'exact-project')}
									>
										Exact project
									</Button>
								</div>
								<Input
									bind:value={projectPath}
									class="h-8 text-xs"
									aria-label="Exact project path"
									disabled={!hasRuntimeAuthority || projectionMode === 'global-only'}
								/>
							</div>
							<div class="grid min-w-0 gap-2 md:grid-cols-[minmax(0,16rem)_auto] md:justify-end">
								<div class="relative min-w-0">
									<SearchIcon class="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
									<Input
										bind:value={query}
										class="h-8 pl-7 text-xs"
										placeholder="Filter globals"
										aria-label="Filter MCP globals"
										disabled={!hasRuntimeAuthority}
									/>
								</div>
								{#if detailCompact && selectedRow}
									<Button variant="outline" size="sm" onclick={() => (detailOpen = true)}>
										<PanelRightOpenIcon class="size-4" />
										Detail
									</Button>
								{/if}
							</div>
						</div>
					</div>

					{#if !hasRuntimeAuthority}
						{@render noRuntimeState()}
					{:else if loadError || actionError}
						<div class="px-4 py-6 text-sm text-destructive">{loadError ?? actionError}</div>
					{:else if loading}
						<div class="px-4 py-6 text-sm text-muted-foreground">Loading MCP projection.</div>
					{:else if visibleRows.length === 0}
						<div class="px-4 py-6 text-sm text-muted-foreground">No MCP rows match the current filter.</div>
					{:else}
						<McpServerList rows={visibleRows} selectedName={effectiveSelectedName} onSelect={selectRow} />
					{/if}
				</div>
			{/snippet}

			{#snippet drawer()}
				{#if detailCompact && !detailOpen}
					<ScrollView class="h-full" contentClass="p-4 text-sm text-muted-foreground">
						Detail is closed.
					</ScrollView>
				{:else}
					<McpServerDetail
						row={selectedRow}
						{projectPath}
						pending={actionPending}
						onEdit={openEditGlobal}
						onEnable={handleEnable}
						onDisable={handleDisable}
						onLifecycle={handleLifecycle}
						onRemove={handleRemove}
						onTestCall={handleTestCall}
					/>
				{/if}
			{/snippet}
		</WorkbenchPageContent>
	{:else}
		{#if hasRuntimeAuthority}
			<McpNewGlobalForm
				bind:projectPath
				{runtimeLabel}
				initialRow={editingRow}
				pending={actionPending}
				onBack={() => {
					editingRow = null;
					activeView = 'list';
				}}
				onSubmit={handleGlobalSubmit}
			/>
		{:else}
			{@render noRuntimeState()}
		{/if}
	{/if}
</div>
