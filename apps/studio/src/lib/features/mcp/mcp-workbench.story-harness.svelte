<script lang="ts">
	import McpNewGlobalForm from './mcp-new-global-form.svelte';
	import McpServerDetail from './mcp-server-detail.svelte';
	import McpServerList from './mcp-server-list.svelte';
	import {
		mcpWorkbenchFixtureRows,
		projectMcpWorkbenchRows,
		type McpGlobalConfigDraft,
		type McpProjectLifecycleAction,
		type McpProjectionMode,
		type McpWorkbenchRow,
	} from './mcp-workbench-state';

	type McpStoryScenario =
		| 'no-runtime'
		| 'global-only'
		| 'default-disabled'
		| 'enabled-stopped'
		| 'running'
		| 'failed'
		| 'blocked-remove'
		| 'test-call';

	let {
		scenario = 'running',
	}: {
		scenario?: McpStoryScenario;
	} = $props();

	const storyProjectionMode = $derived<McpProjectionMode>(scenario === 'global-only' ? 'global-only' : 'exact-project');
	const baseRows = $derived(projectMcpWorkbenchRows(mcpWorkbenchFixtureRows, storyProjectionMode));
	const scenarioRows = $derived.by((): readonly McpWorkbenchRow[] => {
		if (scenario === 'default-disabled') {
			return baseRows.filter((row) => row.name === 'github');
		}
		if (scenario === 'enabled-stopped') {
			return baseRows.filter((row) => row.name === 'sequential-thinking');
		}
		if (scenario === 'failed') {
			return baseRows.filter((row) => row.name === 'linear');
		}
		if (scenario === 'blocked-remove') {
			return baseRows.filter((row) => row.name === 'linear');
		}
		return baseRows.filter((row) => row.name === 'filesystem');
	});

	let rows = $state<readonly McpWorkbenchRow[]>([]);
	let selectedName = $state('');
	let projectPath = $state('/repo/app');
	let latestEvent = $state('idle');

	$effect(() => {
		rows = scenarioRows;
		selectedName = scenarioRows[0]?.name ?? '';
		latestEvent = 'idle';
	});

	const selectedRow = $derived(rows.find((row) => row.name === selectedName) ?? rows[0] ?? null);

	const recordEvent = (event: string): void => {
		latestEvent = event;
	};

	const submitGlobal = async (draft: McpGlobalConfigDraft): Promise<void> => {
		recordEvent(`submit:${draft.name}:${draft.transport.kind}`);
	};

	const mutateRow = (row: McpWorkbenchRow, next: Partial<McpWorkbenchRow>): void => {
		rows = rows.map((entry) => (entry.name === row.name ? { ...entry, ...next } : entry));
	};

	const enable = async (row: McpWorkbenchRow): Promise<void> => {
		recordEvent(`enable:${row.name}`);
		mutateRow(row, { projectState: 'enabled', lifecycle: 'stopped' });
	};

	const disable = async (row: McpWorkbenchRow): Promise<void> => {
		recordEvent(`disable:${row.name}`);
		mutateRow(row, { projectState: 'default-disabled', lifecycle: 'not-started' });
	};

	const lifecycle = async (row: McpWorkbenchRow, action: McpProjectLifecycleAction): Promise<void> => {
		recordEvent(`${action}:${row.name}`);
		mutateRow(row, { lifecycle: action === 'stop' ? 'stopped' : 'running' });
	};

	const remove = async (row: McpWorkbenchRow, input: { stop: boolean }): Promise<void> => {
		recordEvent(`remove:${row.name}:${input.stop ? 'stop' : 'no-stop'}`);
		if (!input.stop) {
			mutateRow(row, { blockedProjects: ['/repo/app'] });
			return;
		}
		rows = rows.filter((entry) => entry.name !== row.name);
	};

	const testCall = async (
		row: McpWorkbenchRow,
		input: { toolName: string; arguments: Record<string, unknown>; autoStart: boolean; autoEnable: boolean },
	): Promise<unknown> => {
		recordEvent(`call:${row.name}:${input.toolName}:${input.autoEnable ? 'auto-enable' : 'no-auto-enable'}`);
		return {
			result: {
				content: [{ type: 'text', text: 'ok' }],
				structuredContent: { ok: true, arguments: input.arguments },
			},
			instance: {
				name: row.name,
				projectPath,
				lifecycle: 'running',
			},
		};
	};
</script>

<div class="grid h-[58rem] max-h-[calc(100vh-2rem)] min-w-0 grid-rows-[auto_minmax(0,1fr)] border border-border/50" data-testid="mcp-story-harness">
	<div class="flex min-w-0 items-center justify-between gap-3 border-b border-border/50 px-3 py-2">
		<div class="truncate text-sm font-semibold">MCP story</div>
		<div class="truncate text-xs text-muted-foreground" data-testid="mcp-story-event">{latestEvent}</div>
	</div>

	{#if scenario === 'no-runtime'}
		<div class="grid content-start gap-2 p-4" data-testid="mcp-story-no-runtime">
			<div class="text-sm font-semibold">No running AvatarRuntime</div>
			<div class="text-sm text-muted-foreground">MCP facts require a runtime authority.</div>
		</div>
	{:else}
		<div class="grid min-w-0 gap-0 lg:grid-cols-[minmax(18rem,0.42fr)_minmax(0,1fr)]">
			<div class="border-b border-border/50 lg:border-b-0 lg:border-r">
				<McpServerList {rows} {selectedName} onSelect={(name) => (selectedName = name)} />
			</div>
			<div>
				{#if scenario === 'global-only'}
					<McpNewGlobalForm bind:projectPath runtimeLabel="story-runtime" onBack={() => recordEvent('back:list')} onSubmit={submitGlobal} />
				{:else}
					<McpServerDetail
						row={selectedRow}
						{projectPath}
						onEdit={(row) => recordEvent(`edit:${row.name}`)}
						onEnable={enable}
						onDisable={disable}
						onLifecycle={lifecycle}
						onRemove={remove}
						onTestCall={testCall}
					/>
				{/if}
			</div>
		</div>
	{/if}
</div>
