<script lang="ts">
	import type {
		McpInspectorCloseInput,
		McpInspectorCloseOutput,
		McpInspectorEvent,
		McpInspectorSnapshotOutput,
		McpInspectorStartInput,
		McpInspectorStartOutput,
		McpProbeInput,
		McpProbeOutput,
	} from '@agenter/client-sdk';
	import BugPlayIcon from '@lucide/svelte/icons/bug-play';
	import Maximize2Icon from '@lucide/svelte/icons/maximize-2';
	import Minimize2Icon from '@lucide/svelte/icons/minimize-2';
	import NetworkIcon from '@lucide/svelte/icons/network';
	import PlayIcon from '@lucide/svelte/icons/play';
	import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';
	import { onDestroy, onMount } from 'svelte';

	import StructuredValueViewer from '$lib/components/structured-value/structured-value-viewer.svelte';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import * as NativeSelect from '$lib/components/ui/native-select/index.js';
	import NoticeBanner from '$lib/components/ui/notice-banner.svelte';
	import * as Tabs from '$lib/components/ui/tabs/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import { cn } from '$lib/utils.js';

	import McpHelpHint from './mcp-help-hint.svelte';
	import type { McpGlobalConfigDraft } from './mcp-workbench-state';
	import {
		resolveCapabilityDescription,
		resolveCapabilityIcon,
		resolveToolInputSchema,
		stringifySchemaArgumentDraft,
	} from './mcp-inspect-schema';

	type CapabilityKind = 'tool' | 'resource' | 'template' | 'prompt' | 'app';
	type InspectCapabilityCard = {
		kind: CapabilityKind;
		name: string;
		protocolId: string;
		description: string;
		icon: string | null;
		schema: unknown | null;
		raw: unknown;
	};
	type InspectCapabilitySection = {
		title: string;
		kind: CapabilityKind;
		items: InspectCapabilityCard[];
	};
	type InspectorSubscription = { unsubscribe: () => void };
	type ProbeOpenParsed = Extract<McpProbeInput, { action: 'open' }> extends never
		? never
		: {
				probeId: string;
				snapshot: {
					name: string;
					projectPath: string;
					serverName?: string;
					serverVersion?: string;
					protocolVersion?: string;
					tools: unknown[];
					resources: unknown[];
					resourceTemplates?: unknown[];
					prompts: unknown[];
					apps?: unknown[];
					snapshot: Record<string, unknown>;
					snapshotAt: string;
				};
			};
	type ProbeSnapshot = ProbeOpenParsed['snapshot'];

	let {
		resetKey,
		pending = false,
		buildDraft,
		onProbe,
		onInspectorStart,
		onInspectorClose,
		onInspectorSubscribe,
	}: {
		resetKey: string;
		pending?: boolean;
		buildDraft: () => McpGlobalConfigDraft;
		onProbe: (input: McpProbeInput) => Promise<McpProbeOutput>;
		onInspectorStart?: (input: McpInspectorStartInput) => Promise<McpInspectorStartOutput>;
		onInspectorClose?: (input: McpInspectorCloseInput) => Promise<McpInspectorCloseOutput>;
		onInspectorSubscribe?: (
			input: McpInspectorCloseInput,
			handlers: {
				onData: (event: McpInspectorEvent) => void;
				onError?: () => void;
			},
		) => InspectorSubscription;
	} = $props();

	const isRecord = (value: unknown): value is Record<string, unknown> =>
		typeof value === 'object' && value !== null && !Array.isArray(value);

	const parseArguments = (source: string): Record<string, unknown> => {
		const trimmed = source.trim();
		if (!trimmed) {
			return {};
		}
		const parsed: unknown = JSON.parse(trimmed);
		if (!isRecord(parsed)) {
			throw new Error('Tool arguments must be a JSON object');
		}
		return parsed;
	};

	const readStringField = (value: unknown, key: string): string | null => {
		if (!isRecord(value)) {
			return null;
		}
		const candidate = value[key];
		return typeof candidate === 'string' && candidate.trim().length > 0 ? candidate.trim() : null;
	};

	const resolveCapabilityProtocolId = (kind: CapabilityKind, value: unknown, fallback: string): string => {
		if (kind === 'resource') {
			return readStringField(value, 'uri') ?? fallback;
		}
		if (kind === 'template') {
			return readStringField(value, 'uriTemplate') ?? fallback;
		}
		if (kind === 'app') {
			return readStringField(value, 'resourceUri') ?? fallback;
		}
		return readStringField(value, 'name') ?? fallback;
	};

	const resolveCapabilityDisplayName = (kind: CapabilityKind, value: unknown, fallback: string): string => {
		if (kind === 'resource' || kind === 'template') {
			return readStringField(value, 'title') ?? readStringField(value, 'name') ?? resolveCapabilityProtocolId(kind, value, fallback);
		}
		if (kind === 'app') {
			return readStringField(value, 'title') ?? readStringField(value, 'toolName') ?? readStringField(value, 'resourceUri') ?? fallback;
		}
		return readStringField(value, 'name') ?? readStringField(value, 'title') ?? fallback;
	};

	const buildCapabilityCard = (kind: CapabilityKind, value: unknown, fallback: string): InspectCapabilityCard => ({
		kind,
		name: resolveCapabilityDisplayName(kind, value, fallback),
		protocolId: resolveCapabilityProtocolId(kind, value, fallback),
		description:
			kind === 'app' && isRecord(value)
				? resolveCapabilityDescription(value.resource) || resolveCapabilityDescription(value.tool) || resolveCapabilityDescription(value)
				: resolveCapabilityDescription(value),
		icon:
			kind === 'app' && isRecord(value)
				? resolveCapabilityIcon(value.resource) || resolveCapabilityIcon(value.tool) || resolveCapabilityIcon(value)
				: resolveCapabilityIcon(value),
		schema: resolveToolInputSchema(value),
		raw: value,
	});

	const parseOpenProbeSnapshot = (output: McpProbeOutput): ProbeSnapshot => {
		if (!isRecord(output.parsed) || !isRecord(output.parsed.snapshot)) {
			throw new Error(output.stderr.trim() || 'mcp probe did not return a snapshot');
		}
		return output.parsed.snapshot as ProbeSnapshot;
	};

	const ensureProbeOk = (output: McpProbeOutput): void => {
		lastCliResult = output;
		if (output.exitCode !== 0) {
			throw new Error(output.stderr.trim() || `mcp probe exited with ${output.exitCode}`);
		}
	};

	const formatJson = (value: unknown): string => JSON.stringify(value, null, 2);

	const formatProbeHelp = (input: McpProbeInput | null, output: McpProbeOutput | null = null): string => {
		if (!input) {
			return 'mcp probe\n\nstdin: not executed yet';
		}
		return [
			'mcp probe',
			'',
			`stdin:\n${formatJson(input)}`,
			output ? `last exit: ${output.exitCode}` : null,
			output?.stderr ? `stderr:\n${output.stderr.trim()}` : null,
		]
			.filter(Boolean)
			.join('\n\n');
	};

	const formatInspectorHelp = (session: McpInspectorSnapshotOutput | null): string => {
		if (!session) {
			return 'bunx @modelcontextprotocol/inspector\n\nThe backend will generate a temporary --config file and --server name for the current draft.';
		}
		return [
			`${session.command} ${session.args.map((arg) => JSON.stringify(arg)).join(' ')}`,
			'',
			`cwd: ${session.cwd}`,
			session.url ? `url: ${session.url}` : null,
		]
			.filter(Boolean)
			.join('\n');
	};

	let projectPath = $state('');
	let toolName = $state('');
	let toolArguments = $state('{}');
	let inspectPending = $state(false);
	let callPending = $state(false);
	let inspectError = $state<string | null>(null);
	let callError = $state<string | null>(null);
	let snapshot = $state<ProbeSnapshot | null>(null);
	let probeId = $state<string | null>(null);
	let probeAvatarNickname = $state<string | null>(null);
	let lastCliResult = $state<McpProbeOutput | null>(null);
	let lastOpenProbeInput = $state<McpProbeInput | null>(null);
	let lastActionProbeInput = $state<McpProbeInput | null>(null);
	let callResult = $state<unknown | null>(null);
	let lastResetKey = $state<string | null>(null);
	let snapshotView = $state<'visual' | 'raw'>('visual');
	let capabilityDialogView = $state<'call' | 'raw'>('call');
	let toolArgumentsDirty = $state(false);
	let appliedToolSchemaKey = $state<string | null>(null);
	let capabilityDialogOpen = $state(false);
	let activeCapabilityKind = $state<CapabilityKind>('tool');
	let activeCapabilityName = $state('');
	let activeCapabilityProtocolId = $state('');
	let activeCapabilityArguments = $state('{}');
	let activeCapabilityArgumentsDirty = $state(false);
	let activeCapabilitySchemaKey = $state<string | null>(null);
	let inspectorDialogOpen = $state(false);
	let inspectorConfirmCloseOpen = $state(false);
	let inspectorPending = $state(false);
	let inspectorReleasePending = $state(false);
	let inspectorError = $state<string | null>(null);
	let inspectorAvatarNickname = $state<string | null>(null);
	let inspectorSession = $state<McpInspectorSnapshotOutput | null>(null);
	let inspectorCompactViewport = $state(false);
	let inspectorFullscreenRequested = $state(false);
	let inspectorSubscription: InspectorSubscription | null = null;

	const toolOptions = $derived.by(() =>
		(snapshot?.tools ?? []).map((tool, index) => resolveCapabilityProtocolId('tool', tool, `tool_${index + 1}`)),
	);
	const selectedTool = $derived.by(() =>
		(snapshot?.tools ?? []).find((tool, index) => resolveCapabilityProtocolId('tool', tool, `tool_${index + 1}`) === toolName) ??
		null,
	);
	const selectedToolSchema = $derived(resolveToolInputSchema(selectedTool));
	const selectedToolDescription = $derived(resolveCapabilityDescription(selectedTool));
	const selectedToolArgumentDraft = $derived.by(() =>
		selectedToolSchema ? stringifySchemaArgumentDraft(selectedToolSchema) : '{}',
	);
	const snapshotVisualSections = $derived.by(() => {
		if (!snapshot) {
			return [];
		}
		return [
			{
				title: 'Server',
				items: [
					{ label: 'Name', value: snapshot.serverName ?? 'unknown' },
					{ label: 'Version', value: snapshot.serverVersion ?? 'unknown' },
					{ label: 'Protocol', value: snapshot.protocolVersion ?? 'unknown' },
					{ label: 'Project', value: snapshot.projectPath ?? 'none' },
					{ label: 'Captured', value: snapshot.snapshotAt ?? 'not recorded' },
				],
			},
			{
				title: 'Capabilities',
				items: [
					{ label: 'Tools', value: String(snapshot.tools.length) },
					{ label: 'Resources', value: String(snapshot.resources.length) },
					{ label: 'Templates', value: String(snapshot.resourceTemplates?.length ?? 0) },
					{ label: 'Prompts', value: String(snapshot.prompts.length) },
					{ label: 'Apps', value: String(snapshot.apps?.length ?? 0) },
				],
			},
		];
	});
	const snapshotCapabilities = $derived.by<InspectCapabilitySection[]>(() => {
		if (!snapshot) {
			return [];
		}
		return [
			{
				title: 'Tools',
				kind: 'tool' as const,
				items: snapshot.tools.map((tool, index) => buildCapabilityCard('tool', tool, `tool_${index + 1}`)),
			},
			{
				title: 'Resources',
				kind: 'resource' as const,
				items: snapshot.resources.map((resource, index) => buildCapabilityCard('resource', resource, `resource_${index + 1}`)),
			},
			{
				title: 'Templates',
				kind: 'template' as const,
				items: (snapshot.resourceTemplates ?? []).map((template, index) =>
					buildCapabilityCard('template', template, `template_${index + 1}`),
				),
			},
			{
				title: 'Prompts',
				kind: 'prompt' as const,
				items: snapshot.prompts.map((prompt, index) => buildCapabilityCard('prompt', prompt, `prompt_${index + 1}`)),
			},
			{
				title: 'Apps',
				kind: 'app' as const,
				items: (snapshot.apps ?? []).map((app, index) => buildCapabilityCard('app', app, `app_${index + 1}`)),
			},
		];
	});
	const mixedSnapshotCapabilities = $derived.by<InspectCapabilityCard[]>(() =>
		snapshotCapabilities.flatMap((section) => section.items.map((item) => ({ ...item, kind: section.kind }))),
	);
	const activeCapability = $derived.by(
		(): InspectCapabilityCard | null =>
			mixedSnapshotCapabilities.find(
				(item) =>
					item.kind === activeCapabilityKind &&
					item.name === activeCapabilityName &&
					item.protocolId === activeCapabilityProtocolId,
			) ?? null,
	);
	const activeCapabilityActionLabel = $derived.by(() => {
		if (activeCapabilityKind === 'resource' || activeCapabilityKind === 'app') {
			return 'Read';
		}
		if (activeCapabilityKind === 'prompt') {
			return 'Get';
		}
		if (activeCapabilityKind === 'template') {
			return 'Complete';
		}
		return 'Call';
	});
	const activeCapabilityCanRun = $derived.by(() => activeCapabilityKind !== 'template');
	const activeCapabilitySupportsArguments = $derived.by(() => activeCapabilityKind === 'tool' || activeCapabilityKind === 'prompt');
	const activeCapabilitySchema = $derived.by(() => (activeCapabilityKind === 'tool' ? selectedToolSchema : activeCapability?.schema ?? null));
	const activeCapabilityDescription = $derived.by(
		() => (activeCapabilityKind === 'tool' ? selectedToolDescription : activeCapability?.description ?? ''),
	);
	const activeCapabilityArgumentDraft = $derived.by(() =>
		activeCapabilitySchema ? stringifySchemaArgumentDraft(activeCapabilitySchema) : '{}',
	);
	const inspectHeaderHelp = $derived(formatProbeHelp(lastOpenProbeInput, lastCliResult));
	const actionHeaderHelp = $derived(formatProbeHelp(lastActionProbeInput, lastCliResult));
	const inspectorHeaderHelp = $derived(formatInspectorHelp(inspectorSession));
	const inspectorFullscreen = $derived(inspectorCompactViewport || inspectorFullscreenRequested);
	const inspectorFullscreenToggleLabel = $derived(
		inspectorFullscreen ? 'Exit full screen inspector' : 'Expand inspector',
	);

	$effect(() => {
		if (resetKey === lastResetKey) {
			return;
		}
		lastResetKey = resetKey;
		projectPath = '';
		toolName = '';
		toolArguments = '{}';
		inspectPending = false;
		callPending = false;
		inspectError = null;
		callError = null;
		snapshot = null;
		void closeCurrentProbe();
		probeId = null;
		probeAvatarNickname = null;
		lastCliResult = null;
		lastOpenProbeInput = null;
		lastActionProbeInput = null;
		callResult = null;
		snapshotView = 'visual';
		capabilityDialogView = 'call';
		toolArgumentsDirty = false;
		appliedToolSchemaKey = null;
		capabilityDialogOpen = false;
		activeCapabilityKind = 'tool';
		activeCapabilityName = '';
		activeCapabilityProtocolId = '';
		activeCapabilityArguments = '{}';
		activeCapabilityArgumentsDirty = false;
		activeCapabilitySchemaKey = null;
		void releaseInspectorSession({ closeDialog: true });
	});

	$effect(() => {
		const schemaKey = toolName.trim().length > 0 ? toolName : null;
		if (!schemaKey || !selectedToolSchema) {
			return;
		}
		if (schemaKey === appliedToolSchemaKey && toolArgumentsDirty) {
			return;
		}
		if (schemaKey !== appliedToolSchemaKey || !toolArgumentsDirty) {
			toolArguments = selectedToolArgumentDraft;
			toolArgumentsDirty = false;
			appliedToolSchemaKey = schemaKey;
		}
	});

	$effect(() => {
		if (!activeCapabilitySupportsArguments) {
			activeCapabilityArguments = '{}';
			activeCapabilityArgumentsDirty = false;
			activeCapabilitySchemaKey = null;
			return;
		}
		const schemaKey =
			activeCapabilityKind === 'tool'
				? toolName.trim().length > 0
					? toolName
					: null
				: activeCapability?.protocolId ?? null;
		if (!schemaKey || !activeCapabilitySchema) {
			return;
		}
		if (schemaKey === activeCapabilitySchemaKey && activeCapabilityArgumentsDirty) {
			return;
		}
		if (schemaKey !== activeCapabilitySchemaKey || !activeCapabilityArgumentsDirty) {
			activeCapabilityArguments = activeCapabilityArgumentDraft;
			activeCapabilityArgumentsDirty = false;
			activeCapabilitySchemaKey = schemaKey;
		}
	});

	const normalizedProjectPath = (): string | undefined => {
		const trimmed = projectPath.trim();
		return trimmed.length > 0 ? trimmed : undefined;
	};

	const buildOpenProbeInput = (): McpProbeInput => {
		const draft = buildDraft();
		return {
			avatarNickname: draft.avatarNickname,
			action: 'open',
			name: draft.name,
			projectPath: normalizedProjectPath(),
			transport: draft.transport,
			env: draft.env,
		};
	};

	const buildPingProbeInput = (): McpProbeInput => {
		if (!probeId || !probeAvatarNickname) {
			throw new Error('Connect before ping');
		}
		return {
			avatarNickname: probeAvatarNickname,
			action: 'ping',
			probeId,
		};
	};

	const buildCapabilityProbeInput = (): McpProbeInput => {
		if (!probeId || !probeAvatarNickname) {
			throw new Error('Connect before capability actions');
		}
		if (!activeCapabilityCanRun || !activeCapability) {
			throw new Error('Resource templates require a concrete URI before probe can read them');
		}
		if (activeCapabilityKind === 'tool') {
			return {
				avatarNickname: probeAvatarNickname,
				action: 'call-tool',
				probeId,
				toolName: activeCapability.protocolId,
				arguments: parseArguments(activeCapabilityArguments),
			};
		}
		if (activeCapabilityKind === 'prompt') {
			return {
				avatarNickname: probeAvatarNickname,
				action: 'get-prompt',
				probeId,
				promptName: activeCapability.protocolId,
				arguments: parseArguments(activeCapabilityArguments),
			};
		}
		return {
			avatarNickname: probeAvatarNickname,
			action: 'read-resource',
			probeId,
			resourceUri: activeCapability.protocolId,
		};
	};

	const activeCapabilityHelp = $derived.by(() => {
		try {
			return formatProbeHelp(buildCapabilityProbeInput(), lastCliResult);
		} catch {
			return actionHeaderHelp;
		}
	});

	const applyInspectorEvent = (event: McpInspectorEvent): void => {
		inspectorSession = event.session;
	};

	const clearInspectorSubscription = (): void => {
		inspectorSubscription?.unsubscribe();
		inspectorSubscription = null;
	};

	const releaseInspectorSession = async (options: { closeDialog?: boolean } = {}): Promise<void> => {
		const session = inspectorSession;
		const avatarNickname = inspectorAvatarNickname;
		clearInspectorSubscription();
		inspectorConfirmCloseOpen = false;
		if (session && avatarNickname && onInspectorClose) {
			inspectorReleasePending = true;
			try {
				inspectorSession = await onInspectorClose({
					avatarNickname,
					sessionId: session.sessionId,
				});
			} catch (error) {
				inspectorError = error instanceof Error ? error.message : String(error);
				return;
			} finally {
				inspectorReleasePending = false;
			}
		}
		inspectorAvatarNickname = null;
		if (options.closeDialog) {
			inspectorSession = null;
			inspectorError = null;
			inspectorDialogOpen = false;
		}
	};

	const requestInspectorDialogClose = (): void => {
		if (inspectorSession && !inspectorReleasePending) {
			inspectorConfirmCloseOpen = true;
			return;
		}
		inspectorDialogOpen = false;
	};

	const toggleInspectorFullscreen = (): void => {
		if (inspectorCompactViewport) {
			return;
		}
		inspectorFullscreenRequested = !inspectorFullscreenRequested;
	};

	const closeCurrentProbe = async (): Promise<void> => {
		const currentProbeId = probeId;
		const currentAvatarNickname = probeAvatarNickname;
		if (!currentProbeId || !currentAvatarNickname) {
			return;
		}
		probeId = null;
		probeAvatarNickname = null;
		await onProbe({
			avatarNickname: currentAvatarNickname,
			action: 'close',
			probeId: currentProbeId,
		}).catch(() => undefined);
	};

	const runConnect = async (): Promise<void> => {
		inspectPending = true;
		inspectError = null;
		try {
			await closeCurrentProbe();
			const openInput = buildOpenProbeInput();
			lastOpenProbeInput = openInput;
			const opened = await onProbe(openInput);
			ensureProbeOk(opened);
			const openedProbeId = readStringField(opened.parsed, 'probeId');
			if (!openedProbeId) {
				throw new Error('mcp probe did not return a probeId');
			}
			probeId = openedProbeId;
			probeAvatarNickname = openInput.avatarNickname ?? null;
			snapshot = parseOpenProbeSnapshot(opened);
			callResult = null;
			const nextToolOptions = (snapshot.tools ?? []).map((tool, index) => resolveCapabilityProtocolId('tool', tool, `tool_${index + 1}`));
			if (!toolName && nextToolOptions[0]) {
				toolName = nextToolOptions[0];
			}
		} catch (error) {
			inspectError = error instanceof Error ? error.message : String(error);
		} finally {
			inspectPending = false;
		}
	};

	const runPing = async (): Promise<void> => {
		callPending = true;
		callError = null;
		try {
			const pingInput = buildPingProbeInput();
			lastActionProbeInput = pingInput;
			const ping = await onProbe(pingInput);
			ensureProbeOk(ping);
			callResult = ping.parsed ?? null;
		} catch (error) {
			callError = error instanceof Error ? error.message : String(error);
		} finally {
			callPending = false;
		}
	};

	const runCall = async (): Promise<void> => {
		callPending = true;
		callError = null;
		try {
			const actionInput = buildCapabilityProbeInput();
			lastActionProbeInput = actionInput;
			const output = await onProbe(actionInput);
			ensureProbeOk(output);
			callResult = output.parsed ?? null;
		} catch (error) {
			callError = error instanceof Error ? error.message : String(error);
		} finally {
			callPending = false;
		}
	};

	const handleToolChange = (value: string): void => {
		toolName = value;
		toolArgumentsDirty = false;
		appliedToolSchemaKey = value;
	};

	const handleToolArgumentsInput = (event: Event): void => {
		const target = event.currentTarget;
		if (!(target instanceof HTMLTextAreaElement)) {
			return;
		}
		if (activeCapabilityKind === 'tool') {
			toolArguments = target.value;
			toolArgumentsDirty = true;
		}
		activeCapabilityArguments = target.value;
		activeCapabilityArgumentsDirty = true;
	};

	const openCapabilityDialog = (item: InspectCapabilityCard): void => {
		activeCapabilityKind = item.kind;
		activeCapabilityName = item.name;
		activeCapabilityProtocolId = item.protocolId;
		callError = null;
		callResult = null;
		if (item.kind === 'tool') {
			handleToolChange(item.protocolId);
			capabilityDialogView = 'call';
		} else {
			activeCapabilityArgumentsDirty = false;
			activeCapabilitySchemaKey = null;
			capabilityDialogView = 'call';
		}
		capabilityDialogOpen = true;
	};

	const runInspector = async (): Promise<void> => {
		if (!onInspectorStart) {
			return;
		}
		inspectorPending = true;
		inspectorError = null;
		inspectorDialogOpen = true;
		try {
			await releaseInspectorSession();
			const draft = buildDraft();
			const input = {
				avatarNickname: draft.avatarNickname,
				name: draft.name,
				projectPath: normalizedProjectPath(),
				transport: draft.transport,
				env: draft.env,
			} satisfies McpInspectorStartInput;
			inspectorAvatarNickname = draft.avatarNickname;
			inspectorSession = await onInspectorStart(input);
			if (onInspectorSubscribe) {
				inspectorSubscription = onInspectorSubscribe(
					{
						avatarNickname: draft.avatarNickname,
						sessionId: inspectorSession.sessionId,
					},
					{
						onData: applyInspectorEvent,
						onError: () => {
							inspectorError = 'Inspector event stream closed';
						},
					},
				);
			}
		} catch (error) {
			inspectorError = error instanceof Error ? error.message : String(error);
		} finally {
			inspectorPending = false;
		}
	};

	onDestroy(() => {
		void closeCurrentProbe();
		void releaseInspectorSession();
	});

	onMount(() => {
		const query = window.matchMedia('(max-width: 767px)');
		const syncCompactViewport = (): void => {
			inspectorCompactViewport = query.matches;
		};
		syncCompactViewport();
		query.addEventListener('change', syncCompactViewport);
		return () => {
			query.removeEventListener('change', syncCompactViewport);
		};
	});
</script>

<section class="grid gap-3 border-t border-border/50 px-3 py-4 md:px-5" data-testid="mcp-config-inspect">
	<div class="flex min-w-0 items-center justify-between gap-3">
		<div class="flex min-w-0 items-center gap-2">
			<div class="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Inspect</div>
			<McpHelpHint
				ariaLabel="Inspect draft help"
				side="bottom"
				align="start"
				textContext={inspectHeaderHelp}
				mode="mono"
			/>
		</div>
		{#if snapshot}
			<div class="flex min-w-0 flex-wrap items-center justify-end gap-1.5">
				<Badge variant="secondary">{snapshot.serverName ?? 'connected'}</Badge>
				<Badge variant="outline">{snapshot.tools.length} tools</Badge>
				<Badge variant="outline">{snapshot.resources.length} resources</Badge>
				{#if (snapshot.resourceTemplates?.length ?? 0) > 0}
					<Badge variant="outline">{snapshot.resourceTemplates?.length ?? 0} templates</Badge>
				{/if}
				<Badge variant="outline">{snapshot.prompts.length} prompts</Badge>
				{#if (snapshot.apps?.length ?? 0) > 0}
					<Badge variant="outline">{snapshot.apps?.length ?? 0} apps</Badge>
				{/if}
			</div>
		{/if}
	</div>

	<div class="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
		<label class="grid gap-1.5 text-xs text-muted-foreground">
			Project path
			<Input
				bind:value={projectPath}
				class="h-8 text-sm text-foreground"
				autocomplete="off"
				placeholder="Optional exact path"
			/>
		</label>

		<div class="flex items-end gap-2">
			<Button
				variant="outline"
				disabled={pending || inspectPending || callPending}
				onclick={runConnect}
				data-testid="mcp-config-inspect-connect"
			>
				<NetworkIcon class="size-4" />
				{inspectPending ? 'Connecting' : 'Connect'}
			</Button>
			<Button
				variant="ghost"
				disabled={pending || inspectPending || callPending || !probeId}
				onclick={runPing}
				data-testid="mcp-config-inspect-ping"
			>
				<RefreshCwIcon class="size-4" />
				Ping
			</Button>
			{#if onInspectorStart}
				<div class="flex items-center gap-1">
					<Button
						variant="ghost"
						disabled={pending || inspectPending || callPending || inspectorPending}
						onclick={runInspector}
						data-testid="mcp-config-inspect-inspector"
					>
						<BugPlayIcon class="size-4" />
						Inspector
					</Button>
					<McpHelpHint
						ariaLabel="MCP Inspector command"
						side="bottom"
						align="end"
						textContext={inspectorHeaderHelp}
						mode="mono"
					/>
				</div>
			{/if}
		</div>
	</div>

	{#if inspectError}
		<NoticeBanner tone="destructive" message={inspectError} />
	{/if}
	{#if callError && !capabilityDialogOpen}
		<NoticeBanner tone="destructive" message={callError} />
	{/if}

	{#if snapshot}
		<div class="grid gap-3">
			<Tabs.Root bind:value={snapshotView} class="gap-3">
				<Tabs.List class="grid w-fit grid-cols-2" aria-label="Inspect snapshot view">
					<Tabs.Trigger value="visual">Visual</Tabs.Trigger>
					<Tabs.Trigger value="raw">Raw</Tabs.Trigger>
				</Tabs.List>
			</Tabs.Root>

			{#if snapshotView === 'visual'}
				<div class="grid gap-3" data-testid="mcp-config-inspect-snapshot-visual">
					<div class="grid gap-3 md:grid-cols-2">
						{#each snapshotVisualSections as section (section.title)}
							<section class="grid gap-2 rounded-lg bg-muted/20 px-3 py-3">
								<div class="flex items-center gap-1.5">
									<div class="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
										{section.title}
									</div>
									<McpHelpHint
										ariaLabel={`${section.title} probe command`}
										side="bottom"
										align="start"
										textContext={inspectHeaderHelp}
										mode="mono"
									/>
								</div>
								<dl class="grid gap-2 text-sm">
									{#each section.items as item (item.label)}
										<div class="grid grid-cols-[5rem_minmax(0,1fr)] gap-3">
											<dt class="text-muted-foreground">{item.label}</dt>
											<dd class="min-w-0 break-all text-foreground">{item.value}</dd>
										</div>
									{/each}
								</dl>
							</section>
						{/each}
					</div>

					<section class="grid gap-2">
						<div class="flex items-center justify-between gap-2">
							<div class="flex items-center gap-1.5">
								<div class="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
									Capabilities
								</div>
								<McpHelpHint
									ariaLabel="Capabilities probe command"
									side="bottom"
									align="start"
									textContext={inspectHeaderHelp}
									mode="mono"
								/>
							</div>
							<Badge variant="outline">{mixedSnapshotCapabilities.length}</Badge>
						</div>
						{#if mixedSnapshotCapabilities.length === 0}
							<div class="rounded-lg bg-muted/20 px-3 py-3 text-sm text-muted-foreground">None</div>
						{:else}
							<div class="mcp-inspect-capability-grid" data-testid="mcp-config-inspect-capability-grid">
								{#each mixedSnapshotCapabilities as item (`${item.kind}:${item.name}`)}
									<button
										type="button"
										class="grid gap-2 rounded-lg bg-muted/20 px-3 py-3 text-left transition-colors hover:bg-muted/35"
										data-testid={`mcp-config-inspect-${item.kind}-card:${item.name}`}
										onclick={() => openCapabilityDialog(item)}
									>
										<div class="flex items-start justify-between gap-2">
											<div class="flex min-w-0 items-start gap-2">
												<div class="mcp-inspect-capability-icon" data-testid={`mcp-config-inspect-${item.kind}-icon:${item.name}`}>
													{#if item.icon}
														<img src={item.icon} alt="" class="size-5 object-contain" />
													{:else}
														<span>{item.name.slice(0, 1).toUpperCase()}</span>
													{/if}
												</div>
												<div
													class="min-w-0 truncate text-sm font-medium text-foreground"
													data-testid={`mcp-config-inspect-${item.kind}-title:${item.name}`}
												>
													{item.name}
												</div>
											</div>
											<Badge variant="outline">{item.kind}</Badge>
										</div>
										<p
											class="line-clamp-3 text-xs text-muted-foreground"
											data-testid={`mcp-config-inspect-${item.kind}-description:${item.name}`}
										>
											{item.description || 'No description'}
										</p>
									</button>
								{/each}
							</div>
						{/if}
					</section>
				</div>
			{:else}
				<div class="grid gap-2">
					<div class="flex items-center gap-1.5">
						<div class="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
							Raw Snapshot
						</div>
						<McpHelpHint
							ariaLabel="Raw snapshot probe command"
							side="bottom"
							align="start"
							textContext={inspectHeaderHelp}
							mode="mono"
						/>
					</div>
					{#if lastCliResult}
						<div
							class="flex min-w-0 flex-wrap items-center gap-2 rounded-md bg-muted/20 px-2 py-1 font-mono text-[11px] text-muted-foreground"
							data-testid="mcp-config-inspect-cli-envelope"
						>
							<span>{lastCliResult.command}</span>
							<span>exit {lastCliResult.exitCode}</span>
							{#if lastCliResult.stderr}
								<span class="text-destructive">{lastCliResult.stderr.trim()}</span>
							{/if}
						</div>
					{/if}
					<StructuredValueViewer
						value={{ snapshot, cli: lastCliResult }}
						menuLabel="mcp probe raw options"
						class="rounded-lg"
					/>
				</div>
			{/if}
		</div>
	{/if}
</section>

<Dialog.Root bind:open={capabilityDialogOpen}>
	<Dialog.Content class="sm:max-w-4xl" data-testid="mcp-config-inspect-capability-dialog">
		<Dialog.Header>
			<Dialog.Title>{activeCapability?.name ?? 'Capability'}</Dialog.Title>
		</Dialog.Header>

		{#if activeCapability}
			<div class="grid max-h-[80vh] gap-4 overflow-y-auto pr-1">
				<div class="flex flex-wrap items-center gap-3">
					<div class="mcp-inspect-capability-icon size-10 text-sm" data-testid="mcp-config-inspect-capability-dialog-icon">
						{#if activeCapability.icon}
							<img src={activeCapability.icon} alt="" class="size-7 object-contain" />
						{:else}
							<span>{activeCapability.name.slice(0, 1).toUpperCase()}</span>
						{/if}
					</div>
					<Badge variant="outline">{activeCapability.kind}</Badge>
				</div>

				<p class="text-sm leading-6 text-muted-foreground">
					{activeCapability.description || 'No description'}
				</p>

				<Tabs.Root bind:value={capabilityDialogView} class="gap-3">
					<Tabs.List class="grid w-fit grid-cols-2" aria-label="Inspect capability dialog view">
						<Tabs.Trigger value="call">{activeCapabilityActionLabel}</Tabs.Trigger>
						<Tabs.Trigger value="raw">Raw</Tabs.Trigger>
					</Tabs.List>
				</Tabs.Root>

				{#if capabilityDialogView === 'call'}
					<div class="grid gap-3 rounded-lg bg-muted/20 px-3 py-3">
						<div class="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
							<div class="grid gap-3">
								{#if activeCapabilitySupportsArguments}
									<label class="grid gap-1.5 text-xs text-muted-foreground">
										<div class="flex items-center gap-1.5">
											<span>Arguments</span>
											<McpHelpHint
												ariaLabel="Capability arguments command"
												side="bottom"
												align="start"
												textContext={`${activeCapabilityHelp}\n\nArguments are seeded from inputSchema when present.\n\n${activeCapabilitySchema ? formatJson(activeCapabilitySchema) : 'inputSchema: none'}`}
												mode="mono"
											/>
										</div>
										<Textarea
											value={activeCapabilityArguments}
											oninput={handleToolArgumentsInput}
											class="min-h-28 bg-background font-mono text-xs text-foreground"
											spellcheck="false"
											data-testid="mcp-config-inspect-arguments"
										/>
									</label>
								{:else}
									<div class="grid gap-1.5 text-xs text-muted-foreground">
										<div class="font-medium text-foreground">URI</div>
										<div class="rounded-lg bg-background px-3 py-2 font-mono text-xs text-foreground">
											{activeCapability?.protocolId}
										</div>
									</div>
								{/if}

								{#if activeCapabilityDescription}
									<div class="text-[11px] text-muted-foreground">{activeCapabilityDescription}</div>
								{/if}
							</div>

							<div class="flex items-end">
								<Button
									disabled={pending || inspectPending || callPending || !activeCapability || !activeCapabilityCanRun}
									onclick={runCall}
									data-testid="mcp-config-inspect-call"
								>
									<PlayIcon class="size-4" />
									{callPending ? `${activeCapabilityActionLabel}ing` : activeCapabilityActionLabel}
								</Button>
							</div>
						</div>

						{#if callError}
							<NoticeBanner tone="destructive" message={callError} />
						{/if}

						{#if callResult !== null}
							<div class="grid gap-1.5" data-testid="mcp-config-inspect-result-preview">
								<div class="flex items-center gap-1.5">
									<div class="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
										Probe Result
									</div>
									<McpHelpHint
										ariaLabel="Probe result command"
										side="bottom"
										align="start"
										textContext={actionHeaderHelp}
										mode="mono"
									/>
								</div>
								{#if lastCliResult}
									<div
										class="flex min-w-0 flex-wrap items-center gap-2 rounded-md bg-background px-2 py-1 font-mono text-[11px] text-muted-foreground"
										data-testid="mcp-config-inspect-cli-result"
									>
										<span>{lastCliResult.command}</span>
										<span>exit {lastCliResult.exitCode}</span>
									</div>
								{/if}
								<StructuredValueViewer value={callResult} menuLabel="Inspect tool result options" class="rounded-lg" />
							</div>
						{/if}
					</div>
				{:else}
					<div class="grid gap-1.5">
						<div class="flex items-center gap-1.5">
							<div class="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
								Raw Capability
							</div>
							<McpHelpHint
								ariaLabel="Raw capability probe command"
								side="bottom"
								align="start"
								textContext={inspectHeaderHelp}
								mode="mono"
							/>
						</div>
						<StructuredValueViewer value={activeCapability.raw} menuLabel="Capability raw options" class="rounded-lg" />
					</div>
				{/if}
			</div>
		{/if}

		<Dialog.Footer>
			<Button
				variant="outline"
				data-testid="mcp-config-inspect-capability-dialog-close"
				onclick={() => (capabilityDialogOpen = false)}
			>
				Close
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<Dialog.Root
	open={inspectorDialogOpen}
	onOpenChange={(nextOpen) => {
		if (!nextOpen && inspectorDialogOpen) {
			requestInspectorDialogClose();
			return;
		}
		inspectorDialogOpen = nextOpen;
	}}
>
	<Dialog.Content
		class={cn(
			'grid grid-rows-[auto_minmax(0,1fr)_auto] gap-0 p-0',
			inspectorFullscreen
				? 'left-0 top-0 h-[100dvh] max-h-none w-[100vw] max-w-none translate-x-0 translate-y-0 rounded-none border-0 sm:max-w-none'
				: 'h-[min(92dvh,58rem)] max-h-[calc(100dvh-1rem)] w-[min(96vw,88rem)] max-w-[calc(100vw-1rem)] sm:max-w-[min(96vw,88rem)]',
		)}
		showCloseButton={false}
		data-testid="mcp-config-heavy-inspector-dialog"
		data-fullscreen={inspectorFullscreen ? 'true' : 'false'}
	>
		<Dialog.Header class="border-b border-border/50 px-4 py-3">
			<div class="flex min-w-0 items-center justify-between gap-3">
				<div class="flex min-w-0 items-center gap-2">
					<Dialog.Title>Inspector</Dialog.Title>
					<McpHelpHint
						ariaLabel="Heavy inspector command"
						side="bottom"
						align="start"
						textContext={inspectorHeaderHelp}
						mode="mono"
					/>
				</div>
				<div class="flex min-w-0 items-center gap-1.5">
					{#if inspectorSession}
						<Badge variant={inspectorSession.state === 'failed' ? 'destructive' : 'secondary'}>
							{inspectorSession.state}
						</Badge>
					{/if}
					{#if inspectorSession?.url}
						<Badge variant="outline">iframe</Badge>
					{/if}
					<Button
						variant={inspectorFullscreen ? 'secondary' : 'ghost'}
						size="icon-sm"
						disabled={inspectorCompactViewport}
						aria-pressed={inspectorFullscreen}
						aria-label={inspectorFullscreenToggleLabel}
						title={inspectorCompactViewport ? 'Full screen is required below tablet width' : inspectorFullscreenToggleLabel}
						onclick={toggleInspectorFullscreen}
						data-testid="mcp-config-heavy-inspector-fullscreen"
					>
						{#if inspectorFullscreen}
							<Minimize2Icon class="size-4" />
						{:else}
							<Maximize2Icon class="size-4" />
						{/if}
					</Button>
				</div>
			</div>
		</Dialog.Header>

		<div class="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)]">
			{#if inspectorError}
				<div class="border-b border-border/50 px-4 py-3">
					<NoticeBanner tone="destructive" message={inspectorError} />
				</div>
			{/if}
			{#if inspectorSession?.url}
				<iframe
					src={inspectorSession.url}
					title="MCP Inspector"
					class="h-full min-h-0 w-full border-0 bg-background"
					data-testid="mcp-config-heavy-inspector-iframe"
				></iframe>
			{:else}
				<div
					class="h-full min-h-0 overflow-auto bg-muted/20 p-4 font-mono text-xs leading-5 text-muted-foreground"
					data-testid="mcp-config-heavy-inspector-log"
				>
					{#if inspectorSession?.logs.length}
						{#each inspectorSession.logs as entry (entry.id)}
							<div class="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-3">
								<span class={entry.stream === 'stderr' ? 'text-destructive' : 'text-muted-foreground'}>
									{entry.stream}
								</span>
								<span class="whitespace-pre-wrap break-words">{entry.text}</span>
							</div>
						{/each}
					{:else if inspectorPending}
						<div>starting inspector...</div>
					{:else}
						<div>no output</div>
					{/if}
				</div>
			{/if}
		</div>

		<Dialog.Footer class="border-t border-border/50 px-4 py-3">
			<Button variant="outline" disabled={inspectorReleasePending} onclick={requestInspectorDialogClose}>
				Close
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<Dialog.Root bind:open={inspectorConfirmCloseOpen}>
	<Dialog.Content class="sm:max-w-md" data-testid="mcp-config-heavy-inspector-close-confirm">
		<Dialog.Header>
			<Dialog.Title>Release inspector?</Dialog.Title>
			<Dialog.Description>
				Closing this dialog stops the spawned inspector process and removes its temporary config.
			</Dialog.Description>
		</Dialog.Header>
		<Dialog.Footer>
			<Button variant="outline" disabled={inspectorReleasePending} onclick={() => (inspectorConfirmCloseOpen = false)}>
				Cancel
			</Button>
			<Button
				variant="destructive"
				disabled={inspectorReleasePending}
				data-testid="mcp-config-heavy-inspector-release"
				onclick={() => void releaseInspectorSession({ closeDialog: true })}
			>
				{inspectorReleasePending ? 'Releasing' : 'Release'}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<style>
	.mcp-inspect-capability-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
		gap: 0.75rem;
		align-items: start;
		grid-auto-flow: row dense;
	}

	@supports (grid-template-rows: masonry) {
		.mcp-inspect-capability-grid {
			grid-template-rows: masonry;
		}
	}

	.mcp-inspect-capability-icon {
		display: inline-flex;
		height: 1.75rem;
		width: 1.75rem;
		flex: 0 0 auto;
		align-items: center;
		justify-content: center;
		overflow: hidden;
		border-radius: 0.5rem;
		background: color-mix(in srgb, var(--muted) 78%, transparent);
		color: var(--muted-foreground);
	}
</style>
