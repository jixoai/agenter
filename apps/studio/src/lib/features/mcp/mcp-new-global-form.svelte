<script lang="ts">
	import { ScrollView } from '@agenter/svelte-components';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import CheckIcon from '@lucide/svelte/icons/check';
	import HelpCircleIcon from '@lucide/svelte/icons/help-circle';
	import PlayIcon from '@lucide/svelte/icons/play';
	import SaveIcon from '@lucide/svelte/icons/save';

	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import * as NativeSelect from '$lib/components/ui/native-select/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import HelpHint from '$lib/components/web-components/help-hint.svelte';

	import type { McpGlobalConfigDraft, McpTransportKind, McpWorkbenchRow } from './mcp-workbench-state';

	let {
		projectPath = $bindable(''),
		runtimeLabel,
		initialRow = null,
		pending = false,
		onBack,
		onSubmit,
	}: {
		projectPath: string;
		runtimeLabel: string;
		initialRow?: McpWorkbenchRow | null;
		pending?: boolean;
		onBack: () => void;
		onSubmit: (draft: McpGlobalConfigDraft) => Promise<void>;
	} = $props();

	const isStringRecord = (value: unknown): value is Record<string, string> =>
		typeof value === 'object' &&
		value !== null &&
		!Array.isArray(value) &&
		Object.values(value).every((entry) => typeof entry === 'string');

	const parseOptionalStringRecord = (source: string, label: string): Record<string, string> | undefined => {
		const trimmed = source.trim();
		if (!trimmed) {
			return undefined;
		}
		const parsed: unknown = JSON.parse(trimmed);
		if (!isStringRecord(parsed)) {
			throw new Error(`${label} must be a JSON object with string values`);
		}
		return parsed;
	};

	const serializeRecord = (value: Record<string, string> | undefined): string =>
		value && Object.keys(value).length > 0 ? JSON.stringify(value, null, 2) : '';

	const serializeArgs = (args: readonly string[] | undefined): string => (args ?? []).join(' ');

	let name = $state('browser-tools');
	let title = $state('Browser Tools');
	let description = $state('Authenticated browser automation.');
	let transport = $state<McpTransportKind>('stdio');
	let command = $state('bunx');
	let args = $state('@agent/browser-mcp');
	let url = $state('https://mcp.example.com/messages');
	let headers = $state('');
	let globalEnv = $state('');
	let transportEnv = $state('{\n  "BROWSER_PROFILE": "default"\n}');
	let enableCurrentProject = $state(false);
	let startCurrentProject = $state(false);
	let formError = $state<string | null>(null);
	let lastInitialName = $state<string | null>(null);

	const modeLabel = $derived(initialRow ? 'Edit global config' : 'New global config');
	const submitLabel = $derived(startCurrentProject ? (initialRow ? 'Update & start' : 'Install & start') : initialRow ? 'Update' : 'Install');
	const startLabel = $derived(initialRow ? 'Start after update' : 'Start after install');

	$effect(() => {
		const nextInitialName = initialRow?.name ?? null;
		if (nextInitialName === lastInitialName) {
			return;
		}
		lastInitialName = nextInitialName;
		formError = null;
		if (!initialRow) {
			name = 'browser-tools';
			title = 'Browser Tools';
			description = 'Authenticated browser automation.';
			transport = 'stdio';
			command = 'bunx';
			args = '@agent/browser-mcp';
			url = 'https://mcp.example.com/messages';
			headers = '';
			globalEnv = '';
			transportEnv = '{\n  "BROWSER_PROFILE": "default"\n}';
			enableCurrentProject = false;
			startCurrentProject = false;
			return;
		}
		name = initialRow.name;
		title = initialRow.title;
		description = initialRow.description === 'No description' ? '' : initialRow.description;
		transport = initialRow.transportSummary.kind;
		command = initialRow.transportSummary.command ?? '';
		args = serializeArgs(initialRow.transportSummary.args);
		url = initialRow.transportSummary.url ?? '';
		headers = serializeRecord(initialRow.transportSummary.headers);
		globalEnv = '';
		transportEnv = serializeRecord(initialRow.transportSummary.env);
		enableCurrentProject = false;
		startCurrentProject = false;
	});

	$effect(() => {
		if (startCurrentProject && !enableCurrentProject) {
			enableCurrentProject = true;
		}
		if (!enableCurrentProject && startCurrentProject) {
			startCurrentProject = false;
		}
	});

	const buildDraft = (): McpGlobalConfigDraft => {
		const trimmedName = name.trim();
		if (!trimmedName) {
			throw new Error('Name is required');
		}
		const trimmedTitle = title.trim();
		const trimmedDescription = description.trim();
		const exactProjectPath = projectPath.trim();
		const globalEnvRecord = parseOptionalStringRecord(globalEnv, 'Global env');
		if ((enableCurrentProject || startCurrentProject) && !exactProjectPath) {
			throw new Error('Exact project path is required for project actions');
		}

		const draft: McpGlobalConfigDraft = {
			name: trimmedName,
			title: trimmedTitle || undefined,
			description: trimmedDescription || undefined,
			transport:
				transport === 'stdio'
					? {
							kind: transport,
							command: command.trim(),
							args: args
								.split(/\s+/)
								.map((arg) => arg.trim())
								.filter(Boolean),
							env: parseOptionalStringRecord(transportEnv, 'Transport env'),
						}
					: {
							kind: transport,
							url: url.trim(),
							headers: parseOptionalStringRecord(headers, 'Headers'),
					},
			env: globalEnvRecord,
			enableProjectPath: enableCurrentProject || startCurrentProject ? exactProjectPath : undefined,
			startProjectPath: startCurrentProject ? exactProjectPath : undefined,
		};
		if (draft.transport.kind === 'stdio' && !draft.transport.command) {
			throw new Error('Command is required for stdio transport');
		}
		if (draft.transport.kind !== 'stdio' && !draft.transport.url) {
			throw new Error('URL is required for remote transport');
		}
		return draft;
	};

	const submit = async (): Promise<void> => {
		formError = null;
		try {
			await onSubmit(buildDraft());
		} catch (error) {
			formError = error instanceof Error ? error.message : String(error);
		}
	};

	const addPayload = $derived.by(() => {
		try {
			const draft = buildDraft();
			const { enableProjectPath: _enableProjectPath, startProjectPath: _startProjectPath, ...globalDraft } = draft;
			return globalDraft;
		} catch {
			return null;
		}
	});

	const enablePayload = $derived({
		name: name.trim(),
		projectPath,
	});

	const startPayload = $derived({
		name: name.trim(),
		projectPath,
	});
</script>

<ScrollView class="h-full" contentClass="grid gap-0">
	<div class="grid min-h-full grid-rows-[auto_minmax(0,1fr)]" data-testid="mcp-new-global-form">
		<div class="flex min-w-0 items-center justify-between gap-3 border-b border-border/50 px-3 py-3 md:px-5">
			<div class="flex min-w-0 items-center gap-2">
				<div class="truncate text-sm font-semibold">{modeLabel}</div>
				<HelpHint
					ariaLabel="New MCP config help"
					side="bottom"
					align="start"
					textContext="mcp add persists an inert global config. Project enablement is a second exact-path fact; it does not inherit across directories."
				>
					<HelpCircleIcon class="size-4 text-muted-foreground" />
				</HelpHint>
			</div>
			<div class="flex items-center gap-2">
				<Button variant="outline" size="sm" onclick={onBack}>
					<ArrowLeftIcon class="size-4" />
					List
				</Button>
				<Button variant="outline" size="sm" disabled={pending} onclick={submit}>
					<SaveIcon class="size-4" />
					{pending ? 'Saving' : submitLabel}
				</Button>
			</div>
		</div>

		<div class="grid divide-y divide-border/45 border-b border-border/50 md:grid-cols-3 md:divide-x md:divide-y-0">
			<section class="grid gap-1 px-3 py-3 md:px-5">
				<div class="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">01 Global config</div>
				<div class="flex min-w-0 flex-wrap items-center gap-1.5">
					<Badge variant="secondary">mcp add</Badge>
					<Badge variant="outline">inert</Badge>
					{#if initialRow}
						<Badge variant="secondary">upsert</Badge>
					{/if}
				</div>
			</section>
			<section class="grid gap-1 px-3 py-3 md:px-5">
				<div class="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">02 Project availability</div>
				<div class="flex min-w-0 flex-wrap items-center gap-1.5">
					<Badge variant={enableCurrentProject ? 'outline' : 'secondary'}>
						{enableCurrentProject ? 'mcp enable' : 'not enabled'}
					</Badge>
					<Badge variant="secondary">exact path</Badge>
				</div>
			</section>
			<section class="grid gap-1 px-3 py-3 md:px-5">
				<div class="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">03 Project runtime</div>
				<div class="flex min-w-0 flex-wrap items-center gap-1.5">
					<Badge variant={startCurrentProject ? 'outline' : 'secondary'}>
						{startCurrentProject ? 'mcp start' : 'not started'}
					</Badge>
					<Badge variant="secondary">manual</Badge>
				</div>
			</section>
		</div>

		{#if formError}
			<div class="border-b border-border/50 bg-destructive/8 px-3 py-2 text-sm text-destructive md:px-5" data-testid="mcp-config-form-error">
				{formError}
			</div>
		{/if}

		<div class="grid gap-0 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,0.42fr)]">
			<div class="grid content-start gap-0">
				<section class="grid gap-3 border-b border-border/50 px-3 py-4 md:px-5">
					<div class="flex min-w-0 items-center justify-between gap-3">
						<div class="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Global config</div>
						<Badge variant="secondary">{runtimeLabel}</Badge>
					</div>
					<div class="grid gap-3 md:grid-cols-2">
						<label class="grid gap-1.5 text-xs text-muted-foreground">
							Name
							<Input bind:value={name} class="h-8 text-sm" autocomplete="off" disabled={Boolean(initialRow)} />
						</label>
						<label class="grid gap-1.5 text-xs text-muted-foreground">
							Title
							<Input bind:value={title} class="h-8 text-sm" autocomplete="off" />
						</label>
					</div>
					<label class="grid gap-1.5 text-xs text-muted-foreground">
						Description
						<Input bind:value={description} class="h-8 text-sm" autocomplete="off" />
					</label>
					<label class="grid gap-1.5 text-xs text-muted-foreground">
						Global env
						<Textarea bind:value={globalEnv} class="min-h-20 font-mono text-xs" spellcheck="false" />
					</label>
				</section>

				<section class="grid gap-3 border-b border-border/50 px-3 py-4 md:px-5">
					<div class="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Transport</div>
					<div class="grid gap-3 md:grid-cols-[12rem_minmax(0,1fr)]">
						<label class="grid gap-1.5 text-xs text-muted-foreground">
							Kind
							<NativeSelect.NativeSelect bind:value={transport} class="h-8 text-sm" wrapperClass="w-full">
								<option value="stdio">stdio</option>
								<option value="streamable-http">streamable-http</option>
								<option value="sse">sse</option>
							</NativeSelect.NativeSelect>
						</label>
						{#if transport === 'stdio'}
							<div class="grid gap-3 md:grid-cols-[minmax(10rem,0.35fr)_minmax(0,1fr)]">
								<label class="grid gap-1.5 text-xs text-muted-foreground">
									Command
									<Input bind:value={command} class="h-8 text-sm" autocomplete="off" />
								</label>
								<label class="grid gap-1.5 text-xs text-muted-foreground">
									Args
									<Input bind:value={args} class="h-8 text-sm" autocomplete="off" />
								</label>
							</div>
						{:else}
							<label class="grid gap-1.5 text-xs text-muted-foreground">
								URL
								<Input bind:value={url} class="h-8 text-sm" autocomplete="off" />
							</label>
						{/if}
					</div>
					{#if transport === 'stdio'}
						<label class="grid gap-1.5 text-xs text-muted-foreground">
							Transport env
							<Textarea bind:value={transportEnv} class="min-h-24 font-mono text-xs" spellcheck="false" />
						</label>
					{:else}
						<label class="grid gap-1.5 text-xs text-muted-foreground">
							Headers
							<Textarea bind:value={headers} class="min-h-24 font-mono text-xs" spellcheck="false" />
						</label>
					{/if}
				</section>

				<section class="grid gap-3 px-3 py-4 md:px-5">
					<div class="flex items-center justify-between gap-3">
						<div class="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Project availability</div>
						<Badge variant={enableCurrentProject ? 'outline' : 'secondary'}>
							{enableCurrentProject ? 'explicit enable' : 'inert global'}
						</Badge>
					</div>
					<label class="grid gap-2 text-sm">
						<span class="flex items-center gap-2">
							<Checkbox bind:checked={enableCurrentProject} />
							Enable for current project
						</span>
						<Input bind:value={projectPath} class="h-8 text-xs" aria-label="Exact project path for enablement" />
					</label>
					<label class="grid gap-2 text-sm">
						<span class="flex items-center gap-2">
							<Checkbox bind:checked={startCurrentProject} />
							{startLabel}
						</span>
						<span class="text-xs text-muted-foreground">
							<PlayIcon class="mr-1 inline size-3.5 align-[-0.125rem]" />
							Requires explicit enablement for the same exact path.
						</span>
					</label>
				</section>
			</div>

			<aside class="grid content-start gap-3 border-t border-border/50 px-3 py-4 lg:border-l lg:border-t-0 md:px-5">
				<div class="flex items-center justify-between gap-3">
					<div class="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Command projection</div>
					<Badge variant="secondary">preview</Badge>
				</div>
				<div class="grid gap-2">
					<div class="flex items-center gap-2 text-sm font-semibold">
						<CheckIcon class="size-4 text-muted-foreground" />
						mcp add
					</div>
					<ScrollView class="max-h-72 rounded-md bg-muted/45" contentClass="p-3">
						<pre class="whitespace-pre-wrap break-words text-xs leading-5 text-foreground">{JSON.stringify(addPayload, null, 2)}</pre>
					</ScrollView>
				</div>
				{#if enableCurrentProject}
					<div class="grid gap-2">
						<div class="flex items-center gap-2 text-sm font-semibold">
							<CheckIcon class="size-4 text-muted-foreground" />
							mcp enable
						</div>
						<ScrollView class="max-h-48 rounded-md bg-muted/45" contentClass="p-3">
							<pre class="whitespace-pre-wrap break-words text-xs leading-5 text-foreground">{JSON.stringify(enablePayload, null, 2)}</pre>
						</ScrollView>
					</div>
				{/if}
				{#if startCurrentProject}
					<div class="grid gap-2">
						<div class="flex items-center gap-2 text-sm font-semibold">
							<CheckIcon class="size-4 text-muted-foreground" />
							mcp start
						</div>
						<ScrollView class="max-h-48 rounded-md bg-muted/45" contentClass="p-3">
							<pre class="whitespace-pre-wrap break-words text-xs leading-5 text-foreground">{JSON.stringify(startPayload, null, 2)}</pre>
						</ScrollView>
					</div>
				{/if}
			</aside>
		</div>
	</div>
</ScrollView>
