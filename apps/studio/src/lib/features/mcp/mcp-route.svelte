<script lang="ts">
	import { ScrollView } from '@agenter/svelte-components';
	import NetworkIcon from '@lucide/svelte/icons/network';
	import PanelRightOpenIcon from '@lucide/svelte/icons/panel-right-open';
	import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';
	import SearchIcon from '@lucide/svelte/icons/search';
	import { tick } from 'svelte';

	import { getAppControllerContext } from '$lib/app/controller-context';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import NoticeBanner from '$lib/components/ui/notice-banner.svelte';
	import WorkbenchPageContent from '$lib/features/navigation/workbench-page-content.svelte';
	import WorkbenchPageTabs from '$lib/features/navigation/workbench-page-tabs.svelte';
	import type { WorkbenchPageTabItem } from '$lib/features/navigation/workbench-page-tabs.types';
	import WorkbenchPageToolbar from '$lib/features/navigation/workbench-page-toolbar.svelte';
	import WorkbenchToolbar from '$lib/features/navigation/workbench-toolbar.svelte';
	import WorkbenchToolbarAction from '$lib/features/navigation/workbench-toolbar-action.svelte';
	import WorkbenchToolbarStatus from '$lib/features/navigation/workbench-toolbar-status.svelte';
	import type { WorkbenchToolbarRenderState } from '$lib/features/navigation/workbench-toolbar.types';

	import McpAvatarOverview from './mcp-avatar-overview.svelte';
	import McpConfigDetail from './mcp-config-detail.svelte';
	import McpConfigList from './mcp-config-list.svelte';
	import McpHelpHint from './mcp-help-hint.svelte';
	import McpNewGlobalForm from './mcp-new-global-form.svelte';
	import {
		buildMcpConfigSelectionKey,
		buildMcpConfigCatalogRows,
		countDistinctMcpProjects,
		countEnabledMcpRows,
		countFailedMcpRows,
		countRunningMcpRows,
		filterMcpConfigCatalogRows,
		listMcpConfigProjectRows,
		mapEnabledMcpRows,
		mapInstalledMcpRows,
		markMcpRowAction,
		type McpAvatarCatalogOption,
		type McpConfigCatalogRow,
		type McpGlobalConfigDraft,
		type McpQueryRow,
		type McpWorkbenchRow,
	} from './mcp-workbench-state';

	type McpRouteView = 'configs' | 'avatars';
	type McpConfigSelection = '__new__' | string;

	const controller = getAppControllerContext();
	const installedSql = `select name, title, description, transport_kind, command, args_json, url, headers_json, env_json, created_at, updated_at from mcp_installed order by name`;

	let query = $state('');
	let detailCompact = $state(false);
	let detailOpen = $state(true);
	let activeView = $state<McpRouteView>('configs');
	let selectedAvatarNickname = $state('');
	let draftAvatarNickname = $state('');
	let selectedConfigKey = $state<McpConfigSelection>('__new__');
	let selectedProjectPath = $state<string | null>(null);
	let loading = $state(false);
	let actionPending = $state(false);
	let loadError = $state<string | null>(null);
	let actionError = $state<string | null>(null);
	let refreshVersion = $state(0);
	let loadSequence = 0;
	let installedRowsByAvatar = $state(new Map<string, readonly McpWorkbenchRow[]>());
	let projectRowsByAvatar = $state(new Map<string, readonly McpWorkbenchRow[]>());

	const avatarOptions = $derived.by(
		(): readonly McpAvatarCatalogOption[] =>
			controller.runtimeState.globalAvatarCatalog.data.map((avatar) => ({
				nickname: avatar.nickname,
				label: avatar.displayName ?? avatar.nickname,
				principalId: avatar.avatarPrincipalId ?? avatar.nickname,
				iconUrl: avatar.iconUrl ?? null,
			})),
	);
	const avatarConfigRowsByAvatar = $derived.by(() => {
		const next = new Map<string, readonly McpConfigCatalogRow[]>();
		for (const avatar of avatarOptions) {
			next.set(
				avatar.nickname,
				buildMcpConfigCatalogRows(
					avatar,
					installedRowsByAvatar.get(avatar.nickname) ?? [],
					projectRowsByAvatar.get(avatar.nickname) ?? [],
				),
			);
		}
		return next;
	});
	const catalogRows = $derived.by(() => Array.from(avatarConfigRowsByAvatar.values()).flat());
	const visibleCatalogRows = $derived(filterMcpConfigCatalogRows(catalogRows, query));
	const selectedCatalogRow = $derived.by((): McpConfigCatalogRow | null => {
		if (selectedConfigKey === '__new__') {
			return null;
		}
		return catalogRows.find((row) => buildMcpConfigSelectionKey(row) === selectedConfigKey) ?? null;
	});
	const selectedConfigInstalledRows = $derived(
		selectedCatalogRow ? (installedRowsByAvatar.get(selectedCatalogRow.avatarNickname) ?? []) : [],
	);
	const selectedConfigInstalledRow = $derived(
		selectedCatalogRow
			? selectedConfigInstalledRows.find((row) => row.name === selectedCatalogRow.name) ?? null
			: null,
	);
	const selectedConfigProjectRows = $derived(
		selectedCatalogRow
			? listMcpConfigProjectRows(
					projectRowsByAvatar.get(selectedCatalogRow.avatarNickname) ?? [],
					selectedCatalogRow.name,
				)
			: [],
	);
	const allProjectRows = $derived.by(() => Array.from(projectRowsByAvatar.values()).flat());
	const enabledRows = $derived(countEnabledMcpRows(allProjectRows));
	const runningRows = $derived(countRunningMcpRows(allProjectRows));
	const failedRows = $derived(countFailedMcpRows(allProjectRows));
	const projectCount = $derived(countDistinctMcpProjects(allProjectRows));
	const totalConfigs = $derived(catalogRows.length);
	const pageTabs = $derived([
		{
			value: 'configs',
			label: 'Configs',
			title: 'Global MCP configs with per-project instance projection',
			badgeLabel: `${totalConfigs}`,
		},
		{
			value: 'avatars',
			label: 'Avatars',
			title: 'Avatar ownership and instance overview',
			badgeLabel: `${avatarOptions.length}`,
		},
	] satisfies WorkbenchPageTabItem[]);
	const loadKey = $derived(`${avatarOptions.map((avatar) => avatar.nickname).join('|')}\u0000${refreshVersion}`);

	const toErrorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

	const setInstalledRows = (avatarNickname: string, rows: readonly McpWorkbenchRow[]): void => {
		installedRowsByAvatar = new Map(installedRowsByAvatar).set(avatarNickname, rows);
	};

	const setProjectRows = (avatarNickname: string, rows: readonly McpWorkbenchRow[]): void => {
		projectRowsByAvatar = new Map(projectRowsByAvatar).set(avatarNickname, rows);
	};

	$effect(() => {
		if (!avatarOptions.some((avatar) => avatar.nickname === draftAvatarNickname)) {
			draftAvatarNickname = avatarOptions[0]?.nickname ?? draftAvatarNickname ?? 'default';
		}
	});

	$effect(() => {
		const release = controller.runtimeStore.retainGlobalAvatarCatalog();
		void controller.runtimeStore.hydrateGlobalAvatarCatalog();
		return () => {
			release();
		};
	});

	$effect(() => {
		if (selectedConfigKey === '__new__') {
			return;
		}
		if (!selectedCatalogRow) {
			selectedConfigKey = visibleCatalogRows[0] ? buildMcpConfigSelectionKey(visibleCatalogRows[0]) : '__new__';
		}
	});

	const loadAvatarProjection = async (
		avatar: McpAvatarCatalogOption,
		sequence: number,
	): Promise<void> => {
		const [installedOutput, explicitOutput] = await Promise.all([
			controller.runtimeStore.queryMcp({
				avatarNickname: avatar.nickname,
				sql: installedSql,
			}),
			controller.runtimeStore.queryMcp({
				avatarNickname: avatar.nickname,
				sql: `select name, project_path, enabled, enabled_source, title, description, transport_kind, lifecycle, last_error, server_name, server_version, protocol_version, snapshot_at, tools_json, resources_json, prompts_json, snapshot_json, created_at, updated_at, last_used_at from mcp_enabled order by project_path, name`,
			}),
		]);
		if (sequence !== loadSequence) {
			return;
		}
		setInstalledRows(avatar.nickname, mapInstalledMcpRows(installedOutput.rows as McpQueryRow[]));
		setProjectRows(avatar.nickname, mapEnabledMcpRows(explicitOutput.rows as McpQueryRow[]));
	};

	const loadMcpProjection = async (): Promise<void> => {
		const avatars = avatarOptions;
		const sequence = ++loadSequence;

		loading = true;
		loadError = null;
		try {
			const failures: string[] = [];
			await Promise.all(
				avatars.map(async (avatar) => {
					try {
						await loadAvatarProjection(avatar, sequence);
					} catch (error) {
						failures.push(`@${avatar.nickname}: ${toErrorMessage(error)}`);
					}
				}),
			);
			if (sequence !== loadSequence) {
				return;
			}
			loadError = failures[0] ?? null;
			if (
				selectedConfigKey !== '__new__' &&
				!catalogRows.some((row) => buildMcpConfigSelectionKey(row) === selectedConfigKey)
			) {
				selectedConfigKey = visibleCatalogRows[0] ? buildMcpConfigSelectionKey(visibleCatalogRows[0]) : '__new__';
			}
		} catch (error) {
			if (sequence !== loadSequence) {
				return;
			}
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

	async function runMcpMutation<T>(operation: () => Promise<T>, options: { refresh?: boolean } = {}): Promise<T> {
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
	}

	const handleViewChange = (value: string): void => {
		if (value === 'configs' || value === 'avatars') {
			activeView = value;
		}
	};

	const handleConfigSelect = (key: string): void => {
		selectedConfigKey = key === '__new__' ? '__new__' : key;
		selectedProjectPath = null;
		detailOpen = true;
	};

	const handleOpenAvatar = async (avatarNickname: string): Promise<void> => {
		activeView = 'avatars';
		selectedAvatarNickname = avatarNickname;
		await tick();
		detailOpen = true;
	};

	const handleGlobalSubmit = async (
		draft: McpGlobalConfigDraft,
		options: { override?: boolean } = {},
	): Promise<void> => {
		await runMcpMutation(
			async () =>
				await controller.runtimeStore.addMcpGlobal({
					avatarNickname: draft.avatarNickname,
					name: draft.name,
					title: draft.title,
					description: draft.description,
					transport: draft.transport,
					env: draft.env,
					override: options.override,
				}),
		);
		selectedConfigKey = buildMcpConfigSelectionKey({
			avatarNickname: draft.avatarNickname,
			name: draft.name,
		});
		selectedProjectPath = null;
	};

	const handleRemoveConfig = async (row: McpWorkbenchRow): Promise<void> => {
		if (!selectedCatalogRow) {
			return;
		}
		try {
			const result = await runMcpMutation(async () =>
				await controller.runtimeStore.removeMcpGlobal({
					avatarNickname: selectedCatalogRow.avatarNickname,
					name: row.name,
					stop: false,
				}),
				{ refresh: false },
			);
			if (result.removed) {
				selectedConfigKey = '__new__';
				refreshMcpProjection();
				return;
			}
			setProjectRows(
				selectedCatalogRow.avatarNickname,
				markMcpRowAction(
					projectRowsByAvatar.get(selectedCatalogRow.avatarNickname) ?? [],
					row.name,
					{
						operation: 'remove',
						status: 'blocked',
						label: `blocked by ${result.blockedProjects.length} project instance${result.blockedProjects.length === 1 ? '' : 's'}`,
						at: new Date().toISOString(),
						detail: result,
					},
					{ blockedProjects: result.blockedProjects },
				),
			);
		} catch {
			return;
		}
	};

	const handleAddProject = async (projectPath: string): Promise<void> => {
		if (!selectedCatalogRow) {
			return;
		}
		const normalizedProjectPath = projectPath.trim();
		await runMcpMutation(async () =>
			await controller.runtimeStore.enableMcpProject({
				avatarNickname: selectedCatalogRow.avatarNickname,
				name: selectedCatalogRow.name,
				projectPath: normalizedProjectPath,
			}),
		);
		selectedProjectPath = normalizedProjectPath;
	};

	const handleStartProject = async (row: McpWorkbenchRow): Promise<void> => {
		const name = row.name;
		const projectPath = row.projectPath;
		if (!selectedCatalogRow || !name || !projectPath) {
			return;
		}
		try {
			await runMcpMutation(async () =>
				await controller.runtimeStore.startMcpProject({
					avatarNickname: selectedCatalogRow.avatarNickname,
					name,
					projectPath,
				}),
			);
			selectedProjectPath = projectPath;
		} catch {
			return;
		}
	};

	const handleStopProject = async (row: McpWorkbenchRow): Promise<void> => {
		const name = row.name;
		const projectPath = row.projectPath;
		if (!selectedCatalogRow || !name || !projectPath) {
			return;
		}
		try {
			await runMcpMutation(async () =>
				await controller.runtimeStore.stopMcpProject({
					avatarNickname: selectedCatalogRow.avatarNickname,
					name,
					projectPath,
				}),
			);
			selectedProjectPath = projectPath;
		} catch {
			return;
		}
	};

	const handleRestartProject = async (row: McpWorkbenchRow): Promise<void> => {
		const name = row.name;
		const projectPath = row.projectPath;
		if (!selectedCatalogRow || !name || !projectPath) {
			return;
		}
		try {
			await runMcpMutation(async () =>
				await controller.runtimeStore.restartMcpProject({
					avatarNickname: selectedCatalogRow.avatarNickname,
					name,
					projectPath,
				}),
			);
			selectedProjectPath = projectPath;
		} catch {
			return;
		}
	};

	const handleRemoveProject = async (row: McpWorkbenchRow): Promise<void> => {
		const name = row.name;
		const projectPath = row.projectPath;
		if (!selectedCatalogRow || !name || !projectPath) {
			return;
		}
		try {
			await runMcpMutation(async () =>
				await controller.runtimeStore.disableMcpProject({
					avatarNickname: selectedCatalogRow.avatarNickname,
					name,
					projectPath,
					stop: true,
				}),
			);
			if (selectedProjectPath === projectPath) {
				selectedProjectPath = null;
			}
		} catch {
			return;
		}
	};

	const handleProbeDraft = async (input: Parameters<typeof controller.runtimeStore.probeMcp>[0]) =>
		await controller.runtimeStore.probeMcp(input);
	const handleInspectorStart = async (input: Parameters<typeof controller.runtimeStore.startMcpInspector>[0]) =>
		await controller.runtimeStore.startMcpInspector(input);
	const handleInspectorClose = async (input: Parameters<typeof controller.runtimeStore.closeMcpInspector>[0]) =>
		await controller.runtimeStore.closeMcpInspector(input);
	const handleAppServerStart = async (input: Parameters<typeof controller.runtimeStore.startMcpAppServer>[0]) =>
		await controller.runtimeStore.startMcpAppServer(input);
	const handleAppServerClose = async (input: Parameters<typeof controller.runtimeStore.closeMcpAppServer>[0]) =>
		await controller.runtimeStore.closeMcpAppServer(input);

	const handleOpenAvatarConfig = async (row: McpConfigCatalogRow): Promise<void> => {
		activeView = 'configs';
		selectedConfigKey = buildMcpConfigSelectionKey(row);
		selectedProjectPath = null;
		await tick();
		detailOpen = true;
	};

	const handleOpenAvatarProject = async (
		avatarNickname: string,
		row: McpWorkbenchRow,
	): Promise<void> => {
		activeView = 'configs';
		selectedConfigKey = buildMcpConfigSelectionKey({
			avatarNickname,
			name: row.name,
		});
		selectedProjectPath = row.projectPath;
		await tick();
		detailOpen = true;
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
	<span class="truncate">{activeView === 'configs' ? 'global config catalog' : 'avatar ownership overview'}</span>
{/snippet}

{#snippet toolbarActions(toolbarState: WorkbenchToolbarRenderState)}
	<WorkbenchToolbarAction
		placement={toolbarState.placement}
		label="Refresh MCP projection"
		title="Refresh MCP projection"
		disabled={loading}
		onclick={refreshMcpProjection}
	>
		<RefreshCwIcon class="size-4" />
	</WorkbenchToolbarAction>
{/snippet}

{#snippet toolbarStatus(toolbarState: WorkbenchToolbarRenderState)}
	<WorkbenchToolbarStatus
		placement={toolbarState.placement}
		label={`${totalConfigs} configs`}
		title="Installed global configs"
	/>
	<WorkbenchToolbarStatus
		placement={toolbarState.placement}
		label={`${projectCount} projects`}
		title="Explicit exact-project rows"
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
		label={`${enabledRows} enabled`}
		title="Enabled project rows"
		tone={enabledRows > 0 ? 'positive' : 'neutral'}
	/>
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
	{#if activeView === 'configs'}
		<WorkbenchPageContent
			class="h-full min-w-0"
			detailLayout="split-detail"
			bind:detailCompact
			bind:detailOpen
			mainClass="h-full"
			drawerClass="h-full"
			detailRatioPersistence="mcp:configs:detail"
			detailLeftMin={340}
			detailRightMin={390}
			detailDefaultRatio={0.46}
		>
			{#snippet main()}
					<div class="grid h-full min-w-0 grid-rows-[auto_auto_minmax(0,1fr)]">
					<div class="flex min-w-0 items-center justify-between gap-3 border-b border-border/50 px-3 py-3 md:px-5">
						<div class="flex min-w-0 items-center gap-2">
							<div class="relative min-w-0">
								<SearchIcon class="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
								<Input
									bind:value={query}
									class="h-8 w-[min(20rem,calc(100vw-7rem))] pl-7 text-xs md:w-[18rem]"
									placeholder="Filter configs"
									aria-label="Filter MCP configs"
								/>
							</div>
							<McpHelpHint
								ariaLabel="Config catalog help"
								side="bottom"
								align="start"
								textContext="Configs are global truth. Each row keeps its owner Avatar; exact-project instances stay read-only in detail."
							/>
						</div>
						<div class="flex items-center gap-2">
							{#if detailCompact}
								<Button variant="outline" size="sm" onclick={() => (detailOpen = true)}>
									<PanelRightOpenIcon class="size-4" />
									Detail
								</Button>
							{/if}
						</div>
					</div>

						{#if loadError || actionError}
							<div class="grid gap-0">
								{#if loadError}
									<div class="border-b border-border/50 px-3 py-3 md:px-5">
										<NoticeBanner tone="destructive" message={loadError} />
									</div>
								{/if}
								{#if actionError}
									<div class="border-b border-border/50 px-3 py-3 md:px-5">
										<NoticeBanner tone="destructive" message={actionError} />
									</div>
								{/if}
							</div>
						{/if}
					{#if loading && visibleCatalogRows.length === 0 && selectedConfigKey === '__new__'}
						<div class="px-4 py-6 text-sm text-muted-foreground">Loading MCP projection.</div>
					{:else}
						<McpConfigList
							rows={visibleCatalogRows}
							selectedKey={selectedConfigKey}
							onSelect={handleConfigSelect}
							onOpenAvatar={(avatarNickname) => void handleOpenAvatar(avatarNickname)}
						/>
					{/if}
				</div>
			{/snippet}

			{#snippet drawer()}
				{#if detailCompact && !detailOpen}
					<ScrollView class="h-full" contentClass="p-4 text-sm text-muted-foreground">
						Detail is closed.
					</ScrollView>
				{:else if selectedConfigKey === '__new__'}
					<ScrollView class="h-full" contentClass="grid gap-0">
						<McpNewGlobalForm
							avatarOptions={avatarOptions}
							knownConfigRows={catalogRows}
							bind:ownerAvatarNickname={draftAvatarNickname}
							pending={actionPending}
							onSubmit={handleGlobalSubmit}
							onProbe={handleProbeDraft}
							onInspectorStart={handleInspectorStart}
							onInspectorClose={handleInspectorClose}
							onAppServerStart={handleAppServerStart}
							onAppServerClose={handleAppServerClose}
						/>
					</ScrollView>
				{:else if selectedCatalogRow}
					<McpConfigDetail
						row={selectedCatalogRow}
						initialRow={selectedConfigInstalledRow}
						avatarOptions={avatarOptions}
						knownConfigRows={catalogRows}
						projectRows={selectedConfigProjectRows}
						pending={actionPending}
						{selectedProjectPath}
						onOpenAvatar={(avatarNickname) => void handleOpenAvatar(avatarNickname)}
						onRemoveConfig={handleRemoveConfig}
						onSubmitGlobal={handleGlobalSubmit}
						onProbe={handleProbeDraft}
						onInspectorStart={handleInspectorStart}
						onInspectorClose={handleInspectorClose}
						onAppServerStart={handleAppServerStart}
						onAppServerClose={handleAppServerClose}
						onAddProject={handleAddProject}
						onStartProject={handleStartProject}
						onStopProject={handleStopProject}
						onRestartProject={handleRestartProject}
						onRemoveProject={handleRemoveProject}
					/>
				{:else}
					<ScrollView class="h-full" contentClass="p-4 text-sm text-muted-foreground">
						Select one config or start a new draft.
					</ScrollView>
				{/if}
			{/snippet}
		</WorkbenchPageContent>
	{:else}
		<McpAvatarOverview
			avatars={avatarOptions}
			bind:selectedAvatarNickname
			configRowsByAvatar={avatarConfigRowsByAvatar}
			projectRowsByAvatar={projectRowsByAvatar}
			onOpenConfig={handleOpenAvatarConfig}
			onOpenProject={handleOpenAvatarProject}
		/>
	{/if}
</div>
