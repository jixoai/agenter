<script lang="ts">
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import PlayIcon from '@lucide/svelte/icons/play';
	import RotateCwIcon from '@lucide/svelte/icons/rotate-cw';
	import SquareIcon from '@lucide/svelte/icons/square';
	import TrashIcon from '@lucide/svelte/icons/trash';

	import StructuredValueViewer from '$lib/components/structured-value/structured-value-viewer.svelte';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import WorkbenchDetailDrawer from '$lib/features/navigation/workbench-detail-drawer.svelte';

	import McpHelpHint from './mcp-help-hint.svelte';
	import McpSkeletons from './mcp-skeletons.svelte';
	import type { McpProjectLifecycleAction, McpWorkbenchCapability, McpWorkbenchRow } from './mcp-workbench-state';

	let {
		row,
		projectPath,
		pending = false,
		loading = false,
		onEdit,
		onEnable,
		onDisable,
		onLifecycle,
		onRemove,
		onTestCall,
	}: {
		row: McpWorkbenchRow | null;
		projectPath: string;
		pending?: boolean;
		loading?: boolean;
		onEdit?: (row: McpWorkbenchRow) => void;
		onEnable?: (row: McpWorkbenchRow) => Promise<void>;
		onDisable?: (row: McpWorkbenchRow) => Promise<void>;
		onLifecycle?: (row: McpWorkbenchRow, action: McpProjectLifecycleAction) => Promise<void>;
		onRemove?: (row: McpWorkbenchRow, input: { stop: boolean }) => Promise<void>;
		onTestCall?: (
			row: McpWorkbenchRow,
			input: { toolName: string; arguments: Record<string, unknown>; autoStart: boolean; autoEnable: boolean },
		) => Promise<unknown>;
	} = $props();

	const helpText =
		'Globals are inert Avatar-owned configs. Project enablement, lifecycle, snapshots, calls, mcp_installed, and mcp_enabled are exact-project facts.';

	const isRecord = (value: unknown): value is Record<string, unknown> =>
		typeof value === 'object' && value !== null && !Array.isArray(value);

	const parseArguments = (source: string): Record<string, unknown> => {
		const trimmed = source.trim();
		if (!trimmed) {
			return {};
		}
		const parsed: unknown = JSON.parse(trimmed);
		if (!isRecord(parsed)) {
			throw new Error('Arguments must be a JSON object');
		}
		return parsed;
	};

	let removeDialogOpen = $state(false);
	let removeStop = $state(false);
	let removeError = $state<string | null>(null);
	let testDialogOpen = $state(false);
	let testToolName = $state('');
	let testArguments = $state('{\n  "path": "README.md"\n}');
	let testAutoStart = $state(true);
	let testAutoEnable = $state(false);
	let testPending = $state(false);
	let testError = $state<string | null>(null);
	let testResult = $state<unknown | null>(null);
	let lastRowName = $state<string | null>(null);

	$effect(() => {
		const nextRowName = row?.name ?? null;
		if (nextRowName === lastRowName) {
			return;
		}
		lastRowName = nextRowName;
		removeDialogOpen = false;
		removeStop = false;
		removeError = null;
		testDialogOpen = false;
		testToolName = row?.tools[0]?.name ?? '';
		testArguments = '{\n  "path": "README.md"\n}';
		testAutoStart = true;
		testAutoEnable = false;
		testPending = false;
		testError = null;
		testResult = null;
	});

	const requestLifecycle = async (action: McpProjectLifecycleAction): Promise<void> => {
		if (row) {
			await onLifecycle?.(row, action);
		}
	};

	const requestRemove = async (): Promise<void> => {
		if (!row) {
			return;
		}
		removeError = null;
		try {
			await onRemove?.(row, { stop: removeStop });
			removeDialogOpen = false;
		} catch (error) {
			removeError = error instanceof Error ? error.message : String(error);
		}
	};

	const openTestDialog = (tool?: McpWorkbenchCapability): void => {
		testToolName = tool?.name ?? row?.tools[0]?.name ?? '';
		testDialogOpen = true;
		testError = null;
		testResult = null;
	};

	const submitTestCall = async (): Promise<void> => {
		if (!row) {
			return;
		}
		testPending = true;
		testError = null;
		testResult = null;
		try {
			testResult = await onTestCall?.(row, {
				toolName: testToolName.trim(),
				arguments: parseArguments(testArguments),
				autoStart: testAutoStart,
				autoEnable: testAutoEnable,
			});
		} catch (error) {
			testError = error instanceof Error ? error.message : String(error);
		} finally {
			testPending = false;
		}
	};

	const transportFacts = $derived(row ? row.transportSummary : null);
</script>

{#if row}
	<WorkbenchDetailDrawer title={row.title} contentClass="gap-0 p-0" summaryClass="px-4 py-3" data-testid="mcp-server-detail">
		{#snippet titleAccessory()}
			<Badge variant={row.lifecycle === 'failed' ? 'destructive' : 'outline'}>{row.lifecycle}</Badge>
		{/snippet}

		{#snippet summary()}
			<div>Global: {row.name}</div>
			<div>Exact project: {projectPath}</div>
			<div>Latest action: {row.latestAction.label}</div>
		{/snippet}

		<section class="grid gap-3 border-b border-border/50 p-4">
			<div class="flex items-center justify-between gap-3">
				<div class="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Project projection matrix</div>
				<McpHelpHint ariaLabel="MCP scope law" side="bottom" align="end" textContext={helpText} />
			</div>
			<div class="grid gap-4 lg:grid-cols-2">
				<div class="grid gap-3">
					<div class="flex items-center justify-between gap-3">
						<div class="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Global config</div>
						<Badge variant="secondary">mcp_installed</Badge>
					</div>
					<div class="grid gap-3 text-sm sm:grid-cols-2">
						<div class="grid gap-1">
							<span class="text-xs text-muted-foreground">Name</span>
							<strong>{row.name}</strong>
						</div>
						<div class="grid gap-1">
							<span class="text-xs text-muted-foreground">Transport</span>
							<strong>{row.transport}</strong>
						</div>
						<div class="grid gap-1">
							<span class="text-xs text-muted-foreground">Title</span>
							<strong>{row.title}</strong>
						</div>
						<div class="grid gap-1">
							<span class="text-xs text-muted-foreground">Description</span>
							<strong>{row.description}</strong>
						</div>
					</div>
					<StructuredValueViewer value={transportFacts} plain class="rounded-md" menuLabel="Transport summary options" />
				</div>
				<div class="grid gap-3 border-t border-border/45 pt-4 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">
					<div class="flex items-center justify-between gap-3">
						<div class="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Exact-project projection</div>
						<Badge variant={row.projectState === 'enabled' ? 'outline' : 'secondary'}>
							{row.projectState === 'enabled' ? 'enabled' : 'default disabled'}
						</Badge>
					</div>
					<div class="grid gap-3 text-sm sm:grid-cols-2">
						<div class="grid gap-1">
							<span class="text-xs text-muted-foreground">Exact path</span>
							<strong class="truncate">{projectPath}</strong>
						</div>
						<div class="grid gap-1">
							<span class="text-xs text-muted-foreground">Snapshot</span>
							<strong>{row.snapshotAt ?? 'No project snapshot'}</strong>
						</div>
						<div class="grid gap-1">
							<span class="text-xs text-muted-foreground">Capabilities</span>
							<strong>{row.tools.length} tools · {row.resources.length} resources · {row.prompts.length} prompts</strong>
						</div>
						<div class="grid gap-1">
							<span class="text-xs text-muted-foreground">Latest error</span>
							<strong>{row.latestError ?? 'None'}</strong>
						</div>
					</div>
					<StructuredValueViewer value={row.serverInfo} plain class="rounded-md" menuLabel="Server info options" />
				</div>
			</div>
		</section>

		<section class="grid gap-3 border-b border-border/50 p-4">
			<div class="flex flex-wrap items-center justify-between gap-2">
				<div class="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Project actions</div>
				<div class="flex flex-wrap items-center gap-2">
					<Button size="sm" variant="outline" disabled={pending} onclick={() => onEdit?.(row)}>
						<PencilIcon class="size-4" />
						Edit global
					</Button>
					{#if row.projectState === 'enabled'}
						<Button size="sm" variant="outline" disabled={pending} onclick={() => onDisable?.(row)}>
							Disable
						</Button>
					{:else}
						<Button size="sm" variant="default" disabled={pending} onclick={() => onEnable?.(row)}>
							Enable
						</Button>
					{/if}
					<Button size="sm" variant="outline" disabled={pending || row.projectState !== 'enabled'} onclick={() => requestLifecycle('start')}>
						<PlayIcon class="size-4" />
						Start
					</Button>
					<Button size="sm" variant="outline" disabled={pending || row.lifecycle !== 'running'} onclick={() => requestLifecycle('stop')}>
						<SquareIcon class="size-4" />
						Stop
					</Button>
					<Button size="sm" variant="outline" disabled={pending || row.projectState !== 'enabled'} onclick={() => requestLifecycle('restart')}>
						<RotateCwIcon class="size-4" />
						Restart
					</Button>
					<Button size="sm" variant="outline" disabled={pending || row.projectState !== 'enabled'} onclick={() => openTestDialog()}>
						Test call
					</Button>
					<Button size="sm" variant="destructive" disabled={pending} onclick={() => (removeDialogOpen = true)}>
						<TrashIcon class="size-4" />
						Remove
					</Button>
				</div>
			</div>
			{#if row.blockedProjects.length > 0}
				<div class="rounded-md bg-destructive/8 px-3 py-2 text-sm text-destructive" data-testid="mcp-remove-blocked">
					Remove is blocked by {row.blockedProjects.join(', ')}.
				</div>
			{/if}
		</section>

		<section class="grid gap-3 border-b border-border/50 p-4">
			<div class="flex items-center justify-between gap-3">
				<div class="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Capability snapshot</div>
				<Badge variant="secondary">{row.snapshotAt ?? 'no snapshot'}</Badge>
			</div>
			<div class="grid gap-3">
				<div class="grid gap-2">
					<div class="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Tools</div>
					{#if row.tools.length === 0}
						<div class="text-sm text-muted-foreground">No project-local tool snapshot.</div>
					{:else}
						<div class="divide-y divide-border/50">
							{#each row.tools as tool (tool.name)}
								<div class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-2">
									<div class="grid min-w-0 gap-0.5">
										<div class="truncate text-sm font-semibold">{tool.name}</div>
										<div class="truncate text-xs text-muted-foreground">{tool.description}</div>
									</div>
									<Button size="sm" variant="ghost" disabled={pending || row.projectState !== 'enabled'} onclick={() => openTestDialog(tool)}>
										Test
									</Button>
								</div>
							{/each}
						</div>
					{/if}
				</div>
				<div class="grid gap-3 xl:grid-cols-2">
					<div class="grid gap-2">
						<div class="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Resources</div>
						<StructuredValueViewer value={row.resources} plain class="rounded-md" menuLabel="MCP resources options" />
					</div>
					<div class="grid gap-2">
						<div class="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Prompts</div>
						<StructuredValueViewer value={row.prompts} plain class="rounded-md" menuLabel="MCP prompts options" />
					</div>
				</div>
				<div class="grid gap-2">
					<div class="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Raw snapshot</div>
					<StructuredValueViewer value={row.snapshot ?? {}} plain class="rounded-md" menuLabel="MCP snapshot options" />
				</div>
			</div>
		</section>

		<section class="grid gap-3 p-4">
			<div class="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Latest action</div>
			<StructuredValueViewer value={row.latestAction} plain class="rounded-md" menuLabel="Latest MCP action options" />
		</section>
	</WorkbenchDetailDrawer>

	<Dialog.Root bind:open={removeDialogOpen}>
		<Dialog.Content class="sm:max-w-xl" data-testid="mcp-remove-dialog">
			<Dialog.Header>
				<Dialog.Title>Remove {row.name}</Dialog.Title>
				<Dialog.Description>
					Remove deletes the global config. Running project instances are stopped only when explicitly selected.
				</Dialog.Description>
			</Dialog.Header>
			<div class="grid gap-3">
				{#if row.blockedProjects.length > 0}
					<div class="rounded-md bg-destructive/8 px-3 py-2 text-sm text-destructive">
						Blocked by {row.blockedProjects.join(', ')}.
					</div>
				{/if}
				<label class="flex items-center gap-2 text-sm">
					<Checkbox bind:checked={removeStop} />
					Stop running project instances before removing
				</label>
				{#if removeError}
					<div class="text-sm text-destructive">{removeError}</div>
				{/if}
			</div>
			<Dialog.Footer>
				<Button variant="outline" onclick={() => (removeDialogOpen = false)}>Cancel</Button>
				<Button variant="destructive" disabled={pending} onclick={requestRemove}>
					{removeStop ? 'Remove and stop' : 'Remove only'}
				</Button>
			</Dialog.Footer>
		</Dialog.Content>
	</Dialog.Root>

	<Dialog.Root bind:open={testDialogOpen}>
		<Dialog.Content class="sm:max-w-2xl" data-testid="mcp-test-call-dialog">
			<Dialog.Header>
				<Dialog.Title>Test call</Dialog.Title>
				<Dialog.Description>autoEnable is off unless explicitly selected.</Dialog.Description>
			</Dialog.Header>
			<div class="grid gap-3">
				<label class="grid gap-1.5 text-xs text-muted-foreground">
					Tool
					<Input bind:value={testToolName} class="h-8 text-sm" autocomplete="off" />
				</label>
				<label class="grid gap-1.5 text-xs text-muted-foreground">
					Arguments
					<Textarea bind:value={testArguments} class="min-h-28 font-mono text-xs" spellcheck="false" />
				</label>
				<div class="flex flex-wrap items-center gap-4 text-sm">
					<label class="flex items-center gap-2">
						<Checkbox bind:checked={testAutoStart} />
						autoStart
					</label>
					<label class="flex items-center gap-2">
						<Checkbox bind:checked={testAutoEnable} />
						autoEnable
					</label>
				</div>
				{#if testError}
					<div class="text-sm text-destructive">{testError}</div>
				{/if}
				{#if testResult !== null}
					<StructuredValueViewer value={testResult} plain class="rounded-md" menuLabel="MCP test result options" />
				{/if}
			</div>
			<Dialog.Footer>
				<Button variant="outline" onclick={() => (testDialogOpen = false)}>Close</Button>
				<Button variant="default" disabled={pending || testPending || !testToolName.trim()} onclick={submitTestCall}>
					{testPending ? 'Calling' : 'Call'}
				</Button>
			</Dialog.Footer>
		</Dialog.Content>
	</Dialog.Root>
{:else if loading}
	<WorkbenchDetailDrawer title="MCP detail" contentClass="p-0" data-testid="mcp-server-detail-empty">
		<McpSkeletons rows={1} variant="detail" data-testid="mcp-server-detail-skeleton" />
	</WorkbenchDetailDrawer>
{:else}
	<WorkbenchDetailDrawer title="MCP detail" contentClass="p-4" data-testid="mcp-server-detail-empty">
		<div class="text-sm text-muted-foreground">Select a server row.</div>
	</WorkbenchDetailDrawer>
{/if}
