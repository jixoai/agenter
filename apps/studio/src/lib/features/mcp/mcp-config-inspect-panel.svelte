<script lang="ts">
	import type {
		McpAppServerCloseInput,
		McpAppServerCloseOutput,
		McpAppServerStartInput,
		McpAppServerStartOutput,
		McpInspectorCloseInput,
		McpInspectorCloseOutput,
		McpInspectorEvent,
		McpInspectorSnapshotOutput,
		McpInspectorStartInput,
		McpInspectorStartOutput,
		McpProbeInput,
		McpProbeOutput,
	} from '@agenter/client-sdk';
	import { ScrollView } from '@agenter/svelte-components';
	import BugPlayIcon from '@lucide/svelte/icons/bug-play';
	import AudioWaveformIcon from '@lucide/svelte/icons/audio-waveform';
	import Maximize2Icon from '@lucide/svelte/icons/maximize-2';
	import Minimize2Icon from '@lucide/svelte/icons/minimize-2';
	import RocketIcon from '@lucide/svelte/icons/rocket';
	import PlayIcon from '@lucide/svelte/icons/play';
	import XIcon from '@lucide/svelte/icons/x';
	import { onDestroy, onMount } from 'svelte';

	import StructuredValueViewer from '$lib/components/structured-value/structured-value-viewer.svelte';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import NoticeBanner from '$lib/components/ui/notice-banner.svelte';
	import * as Tabs from '$lib/components/ui/tabs/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import { cn } from '$lib/utils.js';

	import McpAppResourcePreview from './mcp-app-resource-preview.svelte';
	import McpHelpHint from './mcp-help-hint.svelte';
	import McpSkeletons from './mcp-skeletons.svelte';
	import {
		buildResourceTemplateDraft,
		buildResourceTemplateUri,
		readResourceTemplateFieldNames,
		readResourceTemplateUriTemplate,
	} from './mcp-uri-template';
	import type { McpGlobalConfigDraft } from './mcp-workbench-state';
	import {
		resolveCapabilityDescription,
		resolveCapabilityIcon,
		resolveCapabilityLabel,
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
	type InspectServerRow = {
		label: string;
		value: string;
	};
	type InspectorSocketState = 'idle' | 'connecting' | 'open' | 'closed' | 'error';
	type InspectPingState = 'idle' | 'pending' | 'success' | 'error';
	type InspectorSocketEventMap = {
		open: Event;
		close: CloseEvent;
		error: Event;
		message: MessageEvent<string>;
	};
	type InspectorSocket = {
		close: (code?: number, reason?: string) => void;
		addEventListener: <Type extends keyof InspectorSocketEventMap>(
			type: Type,
			listener: (event: InspectorSocketEventMap[Type]) => void,
		) => void;
		removeEventListener: <Type extends keyof InspectorSocketEventMap>(
			type: Type,
			listener: (event: InspectorSocketEventMap[Type]) => void,
		) => void;
	};
	type InspectorSocketFactory = (url: string) => InspectorSocket;
	type InspectorWireEvent = McpInspectorEvent | { type: 'error'; error: string };
	type InspectorLogEntry = McpInspectorSnapshotOutput['logs'][number];
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
		onAppServerStart,
		onAppServerClose,
		createInspectorSocket,
	}: {
		resetKey: string;
		pending?: boolean;
		buildDraft: () => McpGlobalConfigDraft;
		onProbe: (input: McpProbeInput) => Promise<McpProbeOutput>;
		onInspectorStart?: (input: McpInspectorStartInput) => Promise<McpInspectorStartOutput>;
		onInspectorClose?: (input: McpInspectorCloseInput) => Promise<McpInspectorCloseOutput>;
		onAppServerStart?: (input: McpAppServerStartInput) => Promise<McpAppServerStartOutput>;
		onAppServerClose?: (input: McpAppServerCloseInput) => Promise<McpAppServerCloseOutput>;
		createInspectorSocket?: InspectorSocketFactory;
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

	const hashString = (value: string): number => {
		let hash = 0;
		for (let index = 0; index < value.length; index += 1) {
			hash = Math.imul(hash ^ value.charCodeAt(index), 0x45d9f3b) >>> 0;
		}
		return hash >>> 0;
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
		if (kind === 'app') {
			const resource = isRecord(value) ? value.resource : null;
			const tool = isRecord(value) ? value.tool : null;
			return (
				readStringField(value, 'title') ??
				readStringField(resource, 'title') ??
				readStringField(tool, 'title') ??
				readStringField(value, 'toolName') ??
				readStringField(value, 'resourceUri') ??
				fallback
			);
		}
		return resolveCapabilityLabel(value, resolveCapabilityProtocolId(kind, value, fallback));
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
		schema: kind === 'app' && isRecord(value) ? resolveToolInputSchema(value.tool) : resolveToolInputSchema(value),
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
	const quoteShellArg = (value: string): string => JSON.stringify(value);
	const redactStringRecord = (value: Record<string, string> | undefined): Record<string, string> | undefined => {
		if (!value || Object.keys(value).length === 0) {
			return undefined;
		}
		return Object.fromEntries(Object.keys(value).map((key) => [key, '<redacted>']));
	};
	const buildInspectorServerName = (name: string): string => name.replace(/[^a-zA-Z0-9_.-]/gu, '-') || 'mcp';
	const buildInspectorEnvArgs = (draft: McpGlobalConfigDraft): string[] => {
		const transportEnvKeys = draft.transport.kind === 'stdio' ? Object.keys(draft.transport.env ?? {}) : [];
		return [...new Set([...Object.keys(draft.env ?? {}), ...transportEnvKeys])].flatMap((key) => [
			'-e',
			`${key}=<redacted>`,
		]);
	};
	const buildInspectorConfigPreview = (draft: McpGlobalConfigDraft): Record<string, unknown> => ({
		mcpServers: {
			[buildInspectorServerName(draft.name.trim() || 'inspector')]:
				draft.transport.kind === 'stdio'
					? {
							type: 'stdio',
							command: draft.transport.command,
							args: draft.transport.args,
							env: redactStringRecord(draft.transport.env),
						}
					: {
							type: draft.transport.kind,
							url: draft.transport.url,
							headers: redactStringRecord(draft.transport.headers),
						},
		},
	});
	const formatInspectorDirectCommand = (draft: McpGlobalConfigDraft): string => {
		if (draft.transport.kind === 'stdio') {
			return [
				'bunx',
				'@modelcontextprotocol/inspector',
				...buildInspectorEnvArgs(draft),
				'--',
				draft.transport.command,
				...draft.transport.args,
			]
				.map(quoteShellArg)
				.join(' ');
		}
		const transport = draft.transport.kind === 'streamable-http' ? 'http' : draft.transport.kind;
		const headerArgs = Object.keys(draft.transport.headers ?? {}).flatMap((key) => ['--header', `${key}: <redacted>`]);
		return [
			'bunx',
			'@modelcontextprotocol/inspector',
			...buildInspectorEnvArgs(draft),
			'--transport',
			transport,
			'--server-url',
			draft.transport.url,
			...headerArgs,
		]
			.map(quoteShellArg)
			.join(' ');
	};

	const formatProbeHelp = (input: McpProbeInput | null, output: McpProbeOutput | null = null): string => {
		if (!input) {
			return 'mcp probe\n\nstdin: not executed yet';
		}
		return [
			'mcp probe',
			'',
			`stdin:\n${formatJson(input)}`,
			output ? `last exit: ${output.exitCode}` : null,
			output?.stdout?.trim() ? `stdout:\n${output.stdout.trim()}` : null,
			output?.stderr ? `stderr:\n${output.stderr.trim()}` : null,
		]
			.filter(Boolean)
			.join('\n\n');
	};

	const resolveCapabilityIconFallbackLabel = (item: InspectCapabilityCard): string =>
		(item.name.trim().slice(0, 1) || item.protocolId.trim().slice(0, 1) || '?').toUpperCase();

	const resolveCapabilityIconFallbackStyle = (item: InspectCapabilityCard): string => {
		const seed = `${item.kind}:${item.protocolId}:${item.name}`;
		const hash = hashString(seed);
		const hue = hash % 360;
		const hue2 = (hue + 18 + (hash % 13)) % 360;
		const hue3 = (hue + 38) % 360;
		const light1 = 92 - (hash % 4);
		const light2 = 84 - (hash % 6);
		const light3 = 76 - (hash % 8);
		return [
			`background: radial-gradient(circle at 28% 24%, hsl(${hue} 84% ${light1}% / 0.96) 0%, hsl(${hue2} 72% ${light2}% / 0.94) 48%, hsl(${hue3} 58% ${light3}% / 0.92) 100%)`,
			`color: hsl(${hue} 38% 20%)`,
		].join('; ');
	};

	const formatInspectorHelp = (
		session: McpInspectorSnapshotOutput | null,
		draft: McpGlobalConfigDraft | null,
	): string => {
		if (!session) {
			if (!draft) {
				return 'bunx @modelcontextprotocol/inspector --config <avatar-tmp-config.json> --server <server-name>\n\nThe backend launches the inspector through a temporary config file.';
			}
			return [
				`bunx ${quoteShellArg('@modelcontextprotocol/inspector')} --config <avatar-tmp-config.json> --server ${quoteShellArg(buildInspectorServerName(draft.name.trim() || 'inspector'))}`,
				'',
				`tmp config preview:\n${formatJson(buildInspectorConfigPreview(draft))}`,
				'',
				`equivalent direct shape:\n${formatInspectorDirectCommand(draft)}`,
			].join('\n');
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
	let snapshotView = $state<'server' | 'capabilities' | 'raw'>('capabilities');
	let capabilityDetailView = $state<'call' | 'raw'>('call');
	let toolArgumentsDirty = $state(false);
	let appliedToolSchemaKey = $state<string | null>(null);
	let activeCapabilityKind = $state<CapabilityKind>('tool');
	let activeCapabilityName = $state('');
	let activeCapabilityProtocolId = $state('');
	let activeCapabilityArguments = $state('{}');
	let activeCapabilityArgumentsDirty = $state(false);
	let activeCapabilitySchemaKey = $state<string | null>(null);
	let activeCapabilityTemplateArguments = $state<Record<string, string>>({});
	let activeCapabilityTemplateArgumentsDirty = $state(false);
	let activeCapabilityTemplateSchemaKey = $state<string | null>(null);
	let inspectorDialogOpen = $state(false);
	let inspectorConfirmCloseOpen = $state(false);
	let inspectorPending = $state(false);
	let inspectorReleasePending = $state(false);
	let inspectorError = $state<string | null>(null);
	let inspectorAvatarNickname = $state<string | null>(null);
	let inspectorSession = $state<McpInspectorSnapshotOutput | null>(null);
	let inspectorWsUrl = $state<string | null>(null);
	let inspectorCompactViewport = $state(false);
	let inspectorFullscreenRequested = $state(false);
	let inspectorSocket: InspectorSocket | null = null;
	let inspectorSocketState = $state<InspectorSocketState>('idle');
	let inspectPingState = $state<InspectPingState>('idle');
	let inspectPingResetTimer: ReturnType<typeof setTimeout> | null = null;
	let inspectorDialogContentElement = $state<HTMLElement | null>(null);
	let inspectDialogOpen = $state(false);
	let inspectConfirmCloseOpen = $state(false);
	let inspectReleasePending = $state(false);
	let inspectFullscreenRequested = $state(false);
	let inspectDialogContentElement = $state<HTMLElement | null>(null);
	let inspectDomRemovalTimer: ReturnType<typeof setTimeout> | null = null;
	let inspectConnectRunId = 0;
	let inspectorSocketGeneration = 0;

	const clearInspectPingResetTimer = (): void => {
		if (inspectPingResetTimer === null) {
			return;
		}
		clearTimeout(inspectPingResetTimer);
		inspectPingResetTimer = null;
	};

	const setInspectPingState = (state: InspectPingState): void => {
		clearInspectPingResetTimer();
		inspectPingState = state;
		if (state !== 'success' && state !== 'error') {
			return;
		}
		inspectPingResetTimer = setTimeout(() => {
			inspectPingResetTimer = null;
			if (inspectPingState === state) {
				inspectPingState = 'idle';
			}
		}, 900);
	};

	const selectedTool = $derived.by(() =>
		(snapshot?.tools ?? []).find((tool, index) => resolveCapabilityProtocolId('tool', tool, `tool_${index + 1}`) === toolName) ??
		null,
	);
	const selectedToolSchema = $derived(resolveToolInputSchema(selectedTool));
	const selectedToolArgumentDraft = $derived.by(() =>
		selectedToolSchema ? stringifySchemaArgumentDraft(selectedToolSchema) : '{}',
	);
	const snapshotServerRows = $derived.by<InspectServerRow[]>(() => {
		if (!snapshot) {
			return [];
		}
		return [
			{
				label: 'Name',
				value: snapshot.serverName ?? 'unknown',
			},
			{ label: 'Version', value: snapshot.serverVersion ?? 'unknown' },
			{ label: 'Protocol', value: snapshot.protocolVersion ?? 'unknown' },
			{ label: 'Project', value: snapshot.projectPath ?? 'none' },
			{ label: 'Captured', value: snapshot.snapshotAt ?? 'not recorded' },
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
	const firstAvailableCapabilitySection = $derived.by<InspectCapabilitySection | null>(
		() => snapshotCapabilities.find((section) => section.items.length > 0) ?? null,
	);
	const activeCapabilitySection = $derived.by<InspectCapabilitySection | null>(
		() =>
			snapshotCapabilities.find((section) => section.kind === activeCapabilityKind && section.items.length > 0) ??
			firstAvailableCapabilitySection,
	);
	const activeCapabilityList = $derived.by<InspectCapabilityCard[]>(() => activeCapabilitySection?.items ?? []);
	const activeCapabilityCount = $derived.by(() =>
		snapshotCapabilities.reduce((total, section) => total + section.items.length, 0),
	);
	const activeCapability = $derived.by(
		(): InspectCapabilityCard | null =>
			activeCapabilityList.find(
				(item) =>
					item.kind === activeCapabilityKind &&
					item.name === activeCapabilityName &&
					item.protocolId === activeCapabilityProtocolId,
			) ??
			activeCapabilityList[0] ??
			null,
	);
	const activeCapabilityTemplateFieldNames = $derived.by(() =>
		activeCapabilityKind === 'template' && activeCapability ? readResourceTemplateFieldNames(activeCapability.raw) : [],
	);
	const activeCapabilityTemplateResolvedUri = $derived.by(() =>
		activeCapabilityKind === 'template' && activeCapability
			? buildResourceTemplateUri(activeCapability.raw, activeCapabilityTemplateArguments)
			: null,
	);
	const activeCapabilityActionLabel = $derived.by(() => {
		if (activeCapabilityKind === 'app') {
			return 'Open';
		}
		if (activeCapabilityKind === 'resource') {
			return 'Read';
		}
		if (activeCapabilityKind === 'prompt') {
			return 'Get';
		}
		if (activeCapabilityKind === 'template') {
			return 'Read Resource';
		}
		return 'Call';
	});
	const activeCapabilityActionPendingLabel = $derived.by(() => {
		if (activeCapabilityKind === 'template') {
			return 'Reading';
		}
		if (activeCapabilityActionLabel === 'Open') {
			return 'Opening';
		}
		if (activeCapabilityActionLabel === 'Get') {
			return 'Getting';
		}
		if (activeCapabilityActionLabel === 'Read') {
			return 'Reading';
		}
		return `${activeCapabilityActionLabel}ing`;
	});
	const activeCapabilityCanRun = $derived.by(
		() => activeCapabilityKind !== 'template' || activeCapabilityTemplateResolvedUri !== null,
	);
	const activeCapabilitySchema = $derived.by(() => (activeCapabilityKind === 'tool' ? selectedToolSchema : activeCapability?.schema ?? null));
	const activeCapabilitySupportsArguments = $derived.by(
		() =>
			activeCapabilityKind === 'tool' ||
			activeCapabilityKind === 'prompt' ||
			activeCapabilityKind === 'template' ||
			(activeCapabilityKind === 'app' && activeCapabilitySchema !== null),
	);
	const activeCapabilityArgumentDraft = $derived.by(() =>
		activeCapabilitySchema ? stringifySchemaArgumentDraft(activeCapabilitySchema) : '{}',
	);
	const inspectHeaderHelp = $derived(formatProbeHelp(lastOpenProbeInput, lastCliResult));
	const actionHeaderHelp = $derived(formatProbeHelp(lastActionProbeInput, lastCliResult));
	const activeCapabilityTemplateHelp = $derived.by(() => {
		if (activeCapabilityKind !== 'template' || !activeCapability) {
			return actionHeaderHelp;
		}
		const resolvedUri = activeCapabilityTemplateResolvedUri;
		const helpInput = {
			avatarNickname: probeAvatarNickname ?? 'unknown',
			action: 'read-resource' as const,
			probeId: probeId ?? 'probe',
			resourceUri: resolvedUri ?? readResourceTemplateUriTemplate(activeCapability.raw) ?? activeCapability.protocolId,
		};
		const help = formatProbeHelp(helpInput, lastCliResult);
		return resolvedUri ? help : `${help}\n\nTemplate values are seeded from uriTemplate.`;
	});
	const inspectorDraftPreview = $derived.by(() => {
		try {
			return buildDraft();
		} catch {
			return null;
		}
	});
	const inspectorHeaderHelp = $derived(formatInspectorHelp(inspectorSession, inspectorDraftPreview));
	const inspectorFullscreen = $derived(inspectorCompactViewport || inspectorFullscreenRequested);
	const inspectorFullscreenToggleLabel = $derived(
		inspectorFullscreen ? 'Exit full screen inspector' : 'Expand inspector',
	);
	const inspectFullscreen = $derived(inspectorCompactViewport || inspectFullscreenRequested);
	const inspectSignalState = $derived.by(() => {
		if (inspectReleasePending) {
			return 'closing';
		}
		if (inspectPending) {
			return 'connecting';
		}
		return probeId ? 'live' : 'closed';
	});
	const inspectSignalLabel = $derived.by(() => {
		if (inspectSignalState === 'connecting') {
			return 'Inspect probe is connecting';
		}
		if (inspectSignalState === 'closing') {
			return 'Inspect probe is closing';
		}
		if (inspectSignalState === 'live') {
			return 'Inspect probe is live';
		}
		return 'Inspect probe is closed';
	});
	const inspectorSignalState = $derived.by(() => {
		if (inspectorReleasePending) {
			return 'closing';
		}
		if (inspectorSocketState === 'connecting') {
			return 'connecting';
		}
		if (inspectorSocketState === 'open') {
			return 'live';
		}
		if (inspectorSocketState === 'error') {
			return 'error';
		}
		return 'closed';
	});
	const inspectorSignalLabel = $derived.by(() => {
		if (inspectorSignalState === 'connecting') {
			return 'Inspector process is connecting';
		}
		if (inspectorSignalState === 'closing') {
			return 'Inspector process is closing';
		}
		if (inspectorSignalState === 'live') {
			return 'Inspector process is live';
		}
		if (inspectorSignalState === 'error') {
			return 'Inspector process failed';
		}
		return 'Inspector process is closed';
	});

	$effect(() => {
		if (lastResetKey === null) {
			lastResetKey = resetKey;
			return;
		}
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
		setInspectPingState('idle');
		snapshotView = 'capabilities';
		capabilityDetailView = 'call';
		toolArgumentsDirty = false;
		appliedToolSchemaKey = null;
		activeCapabilityKind = 'tool';
		activeCapabilityName = '';
		activeCapabilityProtocolId = '';
		activeCapabilityArguments = '{}';
		activeCapabilityArgumentsDirty = false;
		activeCapabilitySchemaKey = null;
		activeCapabilityTemplateArguments = {};
		activeCapabilityTemplateArgumentsDirty = false;
		activeCapabilityTemplateSchemaKey = null;
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

	$effect(() => {
		if (activeCapabilityKind !== 'template') {
			activeCapabilityTemplateArguments = {};
			activeCapabilityTemplateArgumentsDirty = false;
			activeCapabilityTemplateSchemaKey = null;
			return;
		}
		const schemaKey = activeCapability?.protocolId ?? null;
		if (!schemaKey || !activeCapability) {
			return;
		}
		if (schemaKey === activeCapabilityTemplateSchemaKey && activeCapabilityTemplateArgumentsDirty) {
			return;
		}
		if (schemaKey !== activeCapabilityTemplateSchemaKey || !activeCapabilityTemplateArgumentsDirty) {
			activeCapabilityTemplateArguments = buildResourceTemplateDraft(activeCapability.raw);
			activeCapabilityTemplateArgumentsDirty = false;
			activeCapabilityTemplateSchemaKey = schemaKey;
		}
	});

	$effect(() => {
		if (!snapshot || activeCapabilityList.length === 0) {
			activeCapabilityName = '';
			activeCapabilityProtocolId = '';
			callError = null;
			callResult = null;
			return;
		}
		if (
			activeCapabilityList.some(
				(item) =>
					item.kind === activeCapabilityKind &&
					item.name === activeCapabilityName &&
					item.protocolId === activeCapabilityProtocolId,
			)
		) {
			return;
		}
		selectCapability(activeCapabilityList[0]!);
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
			name: draft.name.trim() || undefined,
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

	const requireProbeContext = (): { avatarNickname: string; probeId: string } => {
		if (!probeId || !probeAvatarNickname) {
			throw new Error('Connect before capability actions');
		}
		return { avatarNickname: probeAvatarNickname, probeId };
	};

	const buildToolProbeInput = (toolProtocolId: string, argumentsInput: Record<string, unknown>): McpProbeInput => {
		const context = requireProbeContext();
		return {
			avatarNickname: context.avatarNickname,
			action: 'call-tool',
			probeId: context.probeId,
			toolName: toolProtocolId,
			arguments: argumentsInput,
		};
	};

	const buildReadResourceProbeInput = (resourceUri: string): McpProbeInput => {
		const context = requireProbeContext();
		return {
			avatarNickname: context.avatarNickname,
			action: 'read-resource',
			probeId: context.probeId,
			resourceUri,
		};
	};

	const buildAppServerStartInput = (): McpAppServerStartInput | null => {
		const context = requireProbeContext();
		if (activeCapabilityKind !== 'app' || !activeCapability) {
			return null;
		}
		const draft = buildDraft();
		const toolProtocolId = readStringField(activeCapability.raw, 'toolName') ?? undefined;
		return {
			avatarNickname: context.avatarNickname,
			name: draft.name.trim() || activeCapability.name,
			projectPath: projectPath.trim() || undefined,
			transport: draft.transport,
			env: draft.env,
			toolName: toolProtocolId,
			resourceUri: activeCapability.protocolId,
			arguments:
				toolProtocolId && activeCapabilitySupportsArguments ? parseArguments(activeCapabilityArguments) : undefined,
		};
	};

	const buildCapabilityProbeInput = (): McpProbeInput => {
		const context = requireProbeContext();
		if (!activeCapability || !activeCapabilityCanRun) {
			throw new Error('Select one capability before probe can run');
		}
		if (activeCapabilityKind === 'template') {
			const resourceUri = activeCapabilityTemplateResolvedUri;
			if (!resourceUri) {
				throw new Error('Resource templates require all template fields before read');
			}
			return buildReadResourceProbeInput(resourceUri);
		}
		if (activeCapabilityKind === 'tool') {
			return buildToolProbeInput(activeCapability.protocolId, parseArguments(activeCapabilityArguments));
		}
		if (activeCapabilityKind === 'prompt') {
			return {
				avatarNickname: context.avatarNickname,
				action: 'get-prompt',
				probeId: context.probeId,
				promptName: activeCapability.protocolId,
				arguments: parseArguments(activeCapabilityArguments),
			};
		}
		return buildReadResourceProbeInput(activeCapability.protocolId);
	};

	const activeCapabilityHelp = $derived.by(() => {
		try {
			if (activeCapabilityKind === 'app' && activeCapability) {
				const toolProtocolId = readStringField(activeCapability.raw, 'toolName');
				const inputs = [
					toolProtocolId
						? buildToolProbeInput(
								toolProtocolId,
								activeCapabilitySupportsArguments ? parseArguments(activeCapabilityArguments) : {},
							)
						: null,
					buildReadResourceProbeInput(activeCapability.protocolId),
				].filter((entry): entry is McpProbeInput => entry !== null);
				return inputs.map((input) => formatProbeHelp(input, lastCliResult)).join('\n\n---\n\n');
			}
			return formatProbeHelp(buildCapabilityProbeInput(), lastCliResult);
		} catch {
			return actionHeaderHelp;
		}
	});
	const activeMcpAppServerInput = $derived.by(() => {
		if (callResult === null || activeCapabilityKind !== 'app') {
			return null;
		}
		try {
			return buildAppServerStartInput();
		} catch {
			return null;
		}
	});

	const isInspectorLogEntry = (value: unknown): value is InspectorLogEntry =>
		isRecord(value) &&
		typeof value.id === 'number' &&
		(value.stream === 'stdout' || value.stream === 'stderr' || value.stream === 'system') &&
		typeof value.text === 'string' &&
		typeof value.createdAt === 'string';

	const isInspectorSnapshot = (value: unknown): value is McpInspectorSnapshotOutput =>
		isRecord(value) &&
		typeof value.sessionId === 'string' &&
		typeof value.leaseId === 'string' &&
		(value.state === 'starting' ||
			value.state === 'ready' ||
			value.state === 'exited' ||
			value.state === 'failed' ||
			value.state === 'closed') &&
		value.command === 'bunx' &&
		Array.isArray(value.args) &&
		value.args.every((item) => typeof item === 'string') &&
		typeof value.cwd === 'string' &&
		Array.isArray(value.logs) &&
		value.logs.every(isInspectorLogEntry) &&
		typeof value.startedAt === 'string' &&
		typeof value.updatedAt === 'string';

	const parseInspectorWireEvent = (source: string): InspectorWireEvent => {
		const parsed: unknown = JSON.parse(source);
		if (!isRecord(parsed)) {
			throw new Error('Inspector event must be a JSON object');
		}
		if (parsed.type === 'error') {
			const message = typeof parsed.error === 'string' ? parsed.error : 'Inspector event stream failed';
			return { type: 'error', error: message };
		}
		if (parsed.type === 'snapshot' && isInspectorSnapshot(parsed.session)) {
			return { type: 'snapshot', session: parsed.session };
		}
		if (
			parsed.type === 'log' &&
			typeof parsed.sessionId === 'string' &&
			isInspectorLogEntry(parsed.entry) &&
			isInspectorSnapshot(parsed.session)
		) {
			return {
				type: 'log',
				sessionId: parsed.sessionId,
				entry: parsed.entry,
				session: parsed.session,
			};
		}
		throw new Error('Unsupported inspector event payload');
	};

	const isInspectorLeaseReleaseError = (error: unknown): boolean => {
		const message = error instanceof Error ? error.message : String(error);
		return /(?:mcp inspector (?:not found|lease not found)|(?:not found|lease not found|already closed))/iu.test(
			message,
		);
	};

	const applyInspectorEvent = (event: McpInspectorEvent): void => {
		inspectorSession = event.session;
	};

	const appendInspectorSystemLog = (message: string): void => {
		if (!inspectorSession) {
			return;
		}
		const now = new Date().toISOString();
		const nextId = Math.max(0, ...inspectorSession.logs.map((entry) => entry.id)) + 1;
		inspectorSession = {
			...inspectorSession,
			state: inspectorSession.state === 'closed' ? 'closed' : inspectorSession.state,
			logs: [
				...inspectorSession.logs,
				{
					id: nextId,
					stream: 'system',
					text: message,
					createdAt: now,
				},
			],
			updatedAt: now,
		};
	};

	const closeInspectorSocket = (): void => {
		inspectorSocketGeneration += 1;
		const socket = inspectorSocket;
		inspectorSocket = null;
		inspectorSocketState = 'closed';
		if (!socket) {
			return;
		}
		try {
			socket.close(1000, 'inspector dialog released');
		} catch {
			// Closing is best-effort; the backend also has an unclaimed lease timeout.
		}
	};

	const clearProbeDomRemovalTimer = (): void => {
		if (inspectDomRemovalTimer === null) {
			return;
		}
		clearTimeout(inspectDomRemovalTimer);
		inspectDomRemovalTimer = null;
	};

	const defaultInspectorSocketFactory: InspectorSocketFactory = (url: string) => new WebSocket(url);

	const connectInspectorSocket = (url: string): void => {
		closeInspectorSocket();
		const socketGeneration = inspectorSocketGeneration;
		const socket = (createInspectorSocket ?? defaultInspectorSocketFactory)(url);
		inspectorSocket = socket;
		inspectorSocketState = 'connecting';
		const handleOpen = (): void => {
			if (inspectorSocketGeneration !== socketGeneration || inspectorSocket !== socket) {
				return;
			}
			inspectorSocketState = 'open';
		};
		const handleClose = (): void => {
			if (inspectorSocketGeneration !== socketGeneration || inspectorSocket !== socket) {
				return;
			}
			inspectorSocket = null;
			inspectorSocketState = 'closed';
			if (inspectorSession && inspectorSession.state !== 'closed') {
				inspectorSession = {
					...inspectorSession,
					state: 'closed',
					closedAt: new Date().toISOString(),
					updatedAt: new Date().toISOString(),
				};
			}
		};
		const handleError = (): void => {
			if (inspectorSocketGeneration !== socketGeneration || inspectorSocket !== socket) {
				return;
			}
			inspectorSocketState = 'error';
			inspectorError = 'Inspector WebSocket failed';
		};
		const handleMessage = (event: MessageEvent<string>): void => {
			if (inspectorSocketGeneration !== socketGeneration || inspectorSocket !== socket) {
				return;
			}
			try {
				const wireEvent = parseInspectorWireEvent(event.data);
				if (wireEvent.type === 'error') {
					inspectorError = wireEvent.error;
					return;
				}
				applyInspectorEvent(wireEvent);
			} catch (error) {
				inspectorError = error instanceof Error ? error.message : String(error);
			}
		};
		socket.addEventListener('open', handleOpen);
		socket.addEventListener('close', handleClose);
		socket.addEventListener('error', handleError);
		socket.addEventListener('message', handleMessage);
	};

	const releaseInspectorSession = async (
		options: { closeDialog?: boolean; ignoreCloseError?: boolean } = {},
	): Promise<void> => {
		const session = inspectorSession;
		const avatarNickname = inspectorAvatarNickname;
		inspectorConfirmCloseOpen = false;
		let releaseError: string | null = null;
		if (inspectorSocket) {
			inspectorReleasePending = true;
			closeInspectorSocket();
			inspectorReleasePending = false;
		} else if (session && avatarNickname && onInspectorClose) {
			inspectorReleasePending = true;
			try {
				inspectorSession = await onInspectorClose({
					avatarNickname,
					sessionId: session.sessionId,
				});
			} catch (error) {
				if (!options.ignoreCloseError && !isInspectorLeaseReleaseError(error)) {
					releaseError = error instanceof Error ? error.message : String(error);
				}
			} finally {
				inspectorReleasePending = false;
			}
		}
		inspectorAvatarNickname = null;
		inspectorWsUrl = null;
		if (options.closeDialog) {
			inspectorSession = null;
			inspectorError = null;
			inspectorSocketState = 'idle';
			inspectorDialogOpen = false;
			setInspectPingState('idle');
			return;
		}
		if (releaseError) {
			inspectorError = releaseError;
		}
	};

	const closeInspectorDialogImmediately = (): void => {
		inspectorConfirmCloseOpen = false;
		closeInspectorSocket();
		inspectorSession = null;
		inspectorError = null;
		inspectorAvatarNickname = null;
		inspectorWsUrl = null;
		inspectorSocketState = 'idle';
		inspectorDialogOpen = false;
		setInspectPingState('idle');
	};

	const requestInspectorDialogClose = (): void => {
		if (inspectorReleasePending) {
			return;
		}
		if (inspectorSocketState === 'open' || inspectorSocketState === 'connecting') {
			inspectorConfirmCloseOpen = true;
			return;
		}
		closeInspectorDialogImmediately();
	};

	const toggleInspectorFullscreen = (): void => {
		if (inspectorCompactViewport) {
			return;
		}
		inspectorFullscreenRequested = !inspectorFullscreenRequested;
	};

	const toggleInspectFullscreen = (): void => {
		if (inspectorCompactViewport) {
			return;
		}
		inspectFullscreenRequested = !inspectFullscreenRequested;
	};

	const abortPendingInspectConnect = (): void => {
		inspectConnectRunId += 1;
	};

	const openInspectDialogAndConnect = (): void => {
		inspectDialogOpen = true;
		inspectPending = true;
		inspectError = null;
		setInspectPingState('idle');
		inspectConnectRunId += 1;
		void runConnect(inspectConnectRunId);
	};

	const closeCurrentProbe = async (): Promise<void> => {
		clearProbeDomRemovalTimer();
		snapshot = null;
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

	const releaseInspectSession = async (options: { closeDialog?: boolean } = {}): Promise<void> => {
		abortPendingInspectConnect();
		inspectConfirmCloseOpen = false;
		if (probeId && probeAvatarNickname) {
			inspectReleasePending = true;
			try {
				await closeCurrentProbe();
			} finally {
				inspectReleasePending = false;
			}
		}
		if (options.closeDialog) {
			inspectError = null;
			inspectDialogOpen = false;
			inspectFullscreenRequested = false;
		}
	};

	const requestInspectDialogClose = (): void => {
		if (inspectReleasePending) {
			return;
		}
		inspectConfirmCloseOpen = true;
	};

	const runConnect = async (runId = inspectConnectRunId): Promise<void> => {
		inspectPending = true;
		inspectError = null;
		try {
			await closeCurrentProbe();
			const openInput = buildOpenProbeInput();
			lastOpenProbeInput = openInput;
			const opened = await onProbe(openInput);
			if (runId !== inspectConnectRunId || !inspectDialogOpen) {
				const openedProbeId = readStringField(opened.parsed, 'probeId');
				if (openedProbeId) {
					await onProbe({
						avatarNickname: openInput.avatarNickname,
						action: 'close',
						probeId: openedProbeId,
					}).catch(() => undefined);
				}
				return;
			}
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
		setInspectPingState('pending');
		try {
			const pingInput = buildPingProbeInput();
			lastActionProbeInput = pingInput;
			const ping = await onProbe(pingInput);
			ensureProbeOk(ping);
			callResult = ping.parsed ?? null;
			setInspectPingState('success');
		} catch (error) {
			callError = error instanceof Error ? error.message : String(error);
			setInspectPingState('error');
		} finally {
			callPending = false;
		}
	};

	const runCall = async (): Promise<void> => {
		callPending = true;
		callError = null;
		try {
			if (activeCapabilityKind === 'app' && activeCapability) {
				const toolProtocolId = readStringField(activeCapability.raw, 'toolName');
				if (toolProtocolId) {
					const toolInput = buildToolProbeInput(
						toolProtocolId,
						activeCapabilitySupportsArguments ? parseArguments(activeCapabilityArguments) : {},
					);
					lastActionProbeInput = toolInput;
					const toolOutput = await onProbe(toolInput);
					ensureProbeOk(toolOutput);
				}
				const readInput = buildReadResourceProbeInput(activeCapability.protocolId);
				lastActionProbeInput = readInput;
				const resourceOutput = await onProbe(readInput);
				ensureProbeOk(resourceOutput);
				callResult = resourceOutput.parsed ?? null;
				return;
			}
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

	const handleTemplateFieldInput = (name: string, value: string): void => {
		activeCapabilityTemplateArguments = {
			...activeCapabilityTemplateArguments,
			[name]: value,
		};
		activeCapabilityTemplateArgumentsDirty = true;
	};

	function selectCapability(item: InspectCapabilityCard): void {
		activeCapabilityKind = item.kind;
		activeCapabilityName = item.name;
		activeCapabilityProtocolId = item.protocolId;
		callError = null;
		callResult = null;
		if (item.kind === 'tool') {
			handleToolChange(item.protocolId);
			capabilityDetailView = 'call';
		} else if (item.kind === 'template') {
			activeCapabilityTemplateArguments = buildResourceTemplateDraft(item.raw);
			activeCapabilityTemplateArgumentsDirty = false;
			activeCapabilityTemplateSchemaKey = item.protocolId;
			activeCapabilityArgumentsDirty = false;
			activeCapabilitySchemaKey = null;
			capabilityDetailView = 'call';
		} else {
			activeCapabilityArgumentsDirty = false;
			activeCapabilitySchemaKey = null;
			capabilityDetailView = 'call';
		}
	}

	const runInspector = async (): Promise<void> => {
		if (!onInspectorStart) {
			return;
		}
		inspectorPending = true;
		inspectorError = null;
		inspectorDialogOpen = true;
		try {
			await releaseInspectorSession({ ignoreCloseError: true });
			const draft = buildDraft();
			const input = {
				avatarNickname: draft.avatarNickname,
				name: draft.name.trim() || undefined,
				projectPath: normalizedProjectPath(),
				transport: draft.transport,
				env: draft.env,
			} satisfies McpInspectorStartInput;
			inspectorAvatarNickname = draft.avatarNickname;
			const started = await onInspectorStart(input);
			inspectorSession = started;
			inspectorWsUrl = typeof started.wsUrl === 'string' && started.wsUrl.trim() ? started.wsUrl : null;
			if (inspectorWsUrl) {
				connectInspectorSocket(inspectorWsUrl);
			} else {
				appendInspectorSystemLog('Inspector WebSocket URL unavailable; close will use fallback release.');
			}
		} catch (error) {
			inspectorError = error instanceof Error ? error.message : String(error);
		} finally {
			inspectorPending = false;
		}
	};

	onDestroy(() => {
		clearInspectPingResetTimer();
		clearProbeDomRemovalTimer();
		void closeCurrentProbe();
		void releaseInspectSession({ closeDialog: true });
		void releaseInspectorSession();
	});

	$effect(() => {
		const node = inspectDialogContentElement;
		const activeProbeId = probeId;
		const activeAvatarNickname = probeAvatarNickname;
		clearProbeDomRemovalTimer();
		if (!node || !activeProbeId || !activeAvatarNickname) {
			return;
		}
		const scheduleRelease = (): void => {
			if (document.contains(node) || inspectDomRemovalTimer !== null) {
				return;
			}
			inspectDomRemovalTimer = setTimeout(() => {
				inspectDomRemovalTimer = null;
				if (!inspectDialogContentElement || !probeId || !probeAvatarNickname) {
					return;
				}
				if (!document.contains(inspectDialogContentElement)) {
					void closeCurrentProbe();
				}
			}, 1000);
		};
		const observer = new MutationObserver(scheduleRelease);
		observer.observe(document.body, { childList: true, subtree: true });
		scheduleRelease();
		return () => {
			observer.disconnect();
			clearProbeDomRemovalTimer();
		};
	});

	$effect(() => {
		const node = inspectorDialogContentElement;
		if (!node || !inspectorSocket) {
			return;
		}
		const observer = new MutationObserver(() => {
			if (document.contains(node)) {
				return;
			}
			closeInspectorSocket();
		});
		observer.observe(document.body, { childList: true, subtree: true });
		return () => {
			observer.disconnect();
		};
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
		<div class="flex min-w-0 flex-wrap items-center justify-end gap-1.5">
			{#if snapshot}
				{#if snapshot.serverName}
					<Badge variant="secondary">{snapshot.serverName}</Badge>
				{/if}
				<Badge variant="outline">{snapshot.tools.length} tools</Badge>
				<Badge variant="outline">{snapshot.resources.length} resources</Badge>
				{#if (snapshot.resourceTemplates?.length ?? 0) > 0}
					<Badge variant="outline">{snapshot.resourceTemplates?.length ?? 0} templates</Badge>
				{/if}
				<Badge variant="outline">{snapshot.prompts.length} prompts</Badge>
				{#if (snapshot.apps?.length ?? 0) > 0}
					<Badge variant="outline">{snapshot.apps?.length ?? 0} apps</Badge>
				{/if}
			{/if}
			<Button
				variant="outline"
				size="sm"
				disabled={pending || inspectPending || callPending || inspectReleasePending}
				onclick={openInspectDialogAndConnect}
				data-testid="mcp-config-inspect-connect"
			>
				<RocketIcon class="size-4" />
				Connect
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

	<label class="grid gap-1.5 text-xs text-muted-foreground md:max-w-md">
		Project path
		<Input
			bind:value={projectPath}
			class="h-8 text-sm text-foreground"
			autocomplete="off"
			placeholder="Optional exact path"
		/>
	</label>
</section>

<Dialog.Root
	bind:open={inspectDialogOpen}
	onOpenChange={(nextOpen) => {
		if (!nextOpen && inspectDialogOpen) {
			requestInspectDialogClose();
			return;
		}
		inspectDialogOpen = nextOpen;
	}}
>
	<Dialog.Content
		bind:ref={inspectDialogContentElement}
		class={cn(
			'grid overflow-hidden grid-rows-[auto_minmax(0,1fr)] gap-0 p-0',
			inspectFullscreen
				? 'left-0 top-0 h-[100dvh] max-h-none w-[100vw] max-w-none translate-x-0 translate-y-0 rounded-none border-0 sm:max-w-none'
				: 'h-[min(92dvh,58rem)] max-h-[calc(100dvh-1rem)] w-[min(96vw,88rem)] max-w-[calc(100vw-1rem)] sm:max-w-[min(96vw,88rem)]',
		)}
		interactOutsideBehavior="ignore"
		showCloseButton={false}
		data-testid="mcp-config-light-inspect-dialog"
		data-fullscreen={inspectFullscreen ? 'true' : 'false'}
	>
			<Dialog.Header class="border-b border-border/50 px-4 py-3">
				<div class="grid min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 max-md:grid-cols-[minmax(0,1fr)_auto] max-md:gap-y-2">
					<div class="col-start-1 row-start-1 flex min-w-0 items-center gap-2">
						<Dialog.Title>Inspect</Dialog.Title>
						<McpHelpHint
						ariaLabel="Inspect draft command"
						side="bottom"
						align="start"
						textContext={inspectHeaderHelp}
							mode="mono"
						/>
					</div>
					{#if snapshot}
						<Tabs.Root
							bind:value={snapshotView}
							class="col-start-2 row-start-1 justify-self-center max-md:col-span-2 max-md:col-start-1 max-md:row-start-2"
						>
							<Tabs.List class="grid w-fit grid-cols-3" aria-label="Inspect snapshot view">
								<Tabs.Trigger value="server">Server</Tabs.Trigger>
								<Tabs.Trigger value="capabilities">Capabilities</Tabs.Trigger>
								<Tabs.Trigger value="raw">Raw</Tabs.Trigger>
							</Tabs.List>
						</Tabs.Root>
					{/if}
					<div class="col-start-3 row-start-1 flex min-w-0 items-center justify-end gap-1.5 justify-self-end max-md:col-start-2">
						<div
							class={cn(
							'flex size-8 items-center justify-center transition-colors duration-300',
							inspectSignalState === 'connecting'
								? 'text-sky-500'
								: inspectSignalState === 'closing'
									? 'text-amber-500'
									: inspectSignalState === 'live'
										? 'text-emerald-500'
										: 'text-destructive',
						)}
						aria-label={inspectSignalLabel}
						title={inspectSignalLabel}
						data-testid="mcp-config-light-inspect-signal"
						data-state={inspectSignalState}
					>
						<span
							class={cn(
								'size-2.5 rounded-full shadow-[0_0_0_3px_color-mix(in_srgb,currentColor,transparent_82%)] transition-colors duration-300',
								inspectSignalState === 'connecting'
									? 'animate-[mcp-signal-breathe_1.8s_ease-in-out_infinite] bg-sky-500 text-sky-500'
									: inspectSignalState === 'closing'
										? 'animate-[mcp-signal-breathe_1.8s_ease-in-out_infinite] bg-amber-500 text-amber-500'
										: inspectSignalState === 'live'
											? 'bg-emerald-500 text-emerald-500'
											: 'bg-destructive text-destructive',
							)}
						></span>
					</div>
					<Button
						variant="ghost"
						size="sm"
						disabled={pending || inspectPending || callPending || !probeId}
						onclick={runPing}
						data-testid="mcp-config-inspect-ping"
						data-ping-state={inspectPingState}
					>
						<AudioWaveformIcon
							class={cn(
								'size-4 transition-colors duration-700',
								inspectPingState === 'success'
									? 'text-emerald-500'
									: inspectPingState === 'pending'
										? 'text-sky-500 animate-pulse'
										: inspectPingState === 'error'
											? 'text-destructive'
											: 'text-current',
							)}
						/>
						Ping
					</Button>
					<Button
						variant={inspectFullscreen ? 'secondary' : 'ghost'}
						size="icon-sm"
						disabled={inspectorCompactViewport}
						aria-pressed={inspectFullscreen}
						aria-label={inspectFullscreen ? 'Exit full screen inspect' : 'Expand inspect'}
						title={inspectorCompactViewport ? 'Full screen is required below tablet width' : inspectFullscreen ? 'Exit full screen inspect' : 'Expand inspect'}
						onclick={toggleInspectFullscreen}
						data-testid="mcp-config-light-inspect-fullscreen"
					>
						{#if inspectFullscreen}
							<Minimize2Icon class="size-4" />
						{:else}
							<Maximize2Icon class="size-4" />
						{/if}
					</Button>
					<Button
						variant="destructive"
						size="icon-sm"
						disabled={inspectReleasePending}
						aria-label="Close inspect"
						title="Close inspect"
						onclick={requestInspectDialogClose}
						data-testid="mcp-config-light-inspect-close"
					>
						<XIcon class="size-4" />
					</Button>
				</div>
			</div>
		</Dialog.Header>

		<div class={cn('grid h-full min-h-0 overflow-hidden', inspectError ? 'grid-rows-[auto_minmax(0,1fr)]' : 'grid-rows-[minmax(0,1fr)]')}>
			{#if inspectError}
				<div class="border-b border-border/50 px-4 py-3">
					<NoticeBanner tone="destructive" message={inspectError} />
				</div>
			{/if}
			{#if inspectPending && !snapshot && !inspectError}
				<McpSkeletons rows={5} variant="inspect" data-testid="mcp-config-inspect-skeleton" />
			{:else if snapshot}
				{#if snapshotView === 'capabilities'}
					<div class="mcp-inspect-capabilities-view grid h-full min-h-0 grid-rows-[minmax(0,1fr)] gap-3 px-4 py-3" data-testid="mcp-config-inspect-capabilities-view">
						<section class="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-2">
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
								<Badge variant="outline">{activeCapabilityCount}</Badge>
							</div>
							{#if activeCapabilityCount === 0}
								<div class="rounded-lg bg-muted/20 px-3 py-3 text-sm text-muted-foreground">None</div>
							{:else}
								<div class="mcp-inspect-capability-shell" data-testid="mcp-config-inspect-capabilities">
									<Tabs.Root bind:value={activeCapabilityKind} class="block">
										<Tabs.List class="flex h-auto min-w-0 flex-wrap" aria-label="Inspect capability kind">
											{#each snapshotCapabilities as section (section.kind)}
												<Tabs.Trigger
													value={section.kind}
													disabled={section.items.length === 0}
													onclick={() => {
														if (section.items[0]) {
															selectCapability(section.items[0]);
														}
													}}
													data-testid={`mcp-config-inspect-capability-tab:${section.kind}`}
												>
													{section.title}({section.items.length})
												</Tabs.Trigger>
											{/each}
										</Tabs.List>
									</Tabs.Root>

									<div class="mcp-inspect-capability-layout">
										<div class="mcp-inspect-capability-list" data-testid="mcp-config-inspect-capability-list">
											<ScrollView
												class="h-full"
												contentClass="grid auto-rows-max gap-1.5 pr-1"
												viewportTestId="mcp-config-inspect-capability-list-scroll"
											>
												{#each activeCapabilityList as item (`${item.kind}:${item.protocolId}`)}
													<button
														type="button"
														class={cn(
															'mcp-inspect-capability-row',
															activeCapability?.kind === item.kind &&
																activeCapability.protocolId === item.protocolId &&
																activeCapability.name === item.name &&
																'bg-muted/45 text-foreground',
														)}
														aria-pressed={activeCapability?.kind === item.kind && activeCapability.protocolId === item.protocolId && activeCapability.name === item.name}
														data-testid={`mcp-config-inspect-${item.kind}-card:${item.protocolId}`}
														onclick={() => selectCapability(item)}
													>
														<div
															class="mcp-inspect-capability-icon"
															style={item.icon ? undefined : resolveCapabilityIconFallbackStyle(item)}
															data-testid={`mcp-config-inspect-${item.kind}-icon:${item.protocolId}`}
														>
															{#if item.icon}
																<img src={item.icon} alt="" class="size-5 object-contain" />
															{:else}
																<span aria-hidden="true">{resolveCapabilityIconFallbackLabel(item)}</span>
															{/if}
														</div>
														<div class="min-w-0">
															<div
																class="line-clamp-2 min-w-0 break-words text-sm font-medium"
																data-testid={`mcp-config-inspect-${item.kind}-title:${item.protocolId}`}
															>
																{item.name}
															</div>
															<p
																class="line-clamp-2 text-xs text-muted-foreground"
																data-testid={`mcp-config-inspect-${item.kind}-description:${item.protocolId}`}
															>
																{item.description || item.protocolId}
															</p>
														</div>
													</button>
												{/each}
											</ScrollView>
										</div>

										<div class="mcp-inspect-capability-detail" data-testid="mcp-config-inspect-capability-detail">
											<ScrollView
												class="h-full"
												contentClass="grid auto-rows-max gap-4 p-3"
												viewportTestId="mcp-config-inspect-capability-detail-scroll"
											>
												{#if activeCapability}
													<div class="flex min-w-0 flex-wrap items-center gap-3">
														<div
															class="mcp-inspect-capability-icon size-10 text-sm"
															style={activeCapability.icon ? undefined : resolveCapabilityIconFallbackStyle(activeCapability)}
															data-testid="mcp-config-inspect-capability-detail-icon"
														>
															{#if activeCapability.icon}
																<img src={activeCapability.icon} alt="" class="size-7 object-contain" />
															{:else}
																<span aria-hidden="true">{resolveCapabilityIconFallbackLabel(activeCapability)}</span>
															{/if}
														</div>
														<div class="min-w-0 flex-1">
															<div class="break-words text-sm font-semibold text-foreground">{activeCapability.name}</div>
															<div class="break-all font-mono text-[11px] text-muted-foreground">{activeCapability.protocolId}</div>
														</div>
														<Badge variant="outline">{activeCapability.kind}</Badge>
													</div>

													<p class="text-sm leading-6 text-muted-foreground">
														{activeCapability.description || 'No description'}
													</p>

													<Tabs.Root bind:value={capabilityDetailView} class="block">
														<Tabs.List class="grid w-fit grid-cols-2" aria-label="Inspect capability detail view">
															<Tabs.Trigger value="call">{activeCapabilityActionLabel}</Tabs.Trigger>
															<Tabs.Trigger value="raw">Raw</Tabs.Trigger>
														</Tabs.List>
													</Tabs.Root>

													{#if capabilityDetailView === 'call'}
														<div class="grid gap-3 rounded-lg bg-muted/20 px-3 py-3">
														<div class="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
															<div class="grid gap-3">
																{#if activeCapabilityKind === 'template'}
																	<div class="grid gap-1.5 text-xs text-muted-foreground">
																		<div class="flex items-center gap-1.5">
																			<span>Arguments</span>
																			<McpHelpHint
																				ariaLabel="Capability template arguments command"
																				side="bottom"
																				align="start"
																				textContext={activeCapabilityTemplateHelp}
																				mode="mono"
																			/>
																		</div>
																		{#if activeCapabilityTemplateFieldNames.length > 0}
																			<div class="grid gap-3 sm:grid-cols-2">
																				{#each activeCapabilityTemplateFieldNames as fieldName (fieldName)}
																					<label class="grid gap-1.5">
																						<div class="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
																							{fieldName}
																						</div>
																						<Input
																							value={activeCapabilityTemplateArguments[fieldName] ?? ''}
																							oninput={(event) => {
																								const target = event.currentTarget;
																								if (target instanceof HTMLInputElement) {
																									handleTemplateFieldInput(fieldName, target.value);
																								}
																							}}
																							class="h-8 bg-background text-sm text-foreground"
																							autocomplete="off"
																							placeholder={`Enter ${fieldName}`}
																							data-testid={`mcp-config-inspect-template-${fieldName}`}
																						/>
																					</label>
																				{/each}
																			</div>
																		{:else}
																			<div class="rounded-lg bg-background px-3 py-2 text-xs text-muted-foreground">
																				No template variables
																			</div>
																		{/if}
																	</div>
																{:else if activeCapabilitySupportsArguments}
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
															</div>

															<div class="flex items-end">
																<Button
																	disabled={pending || inspectPending || callPending || !activeCapability || !activeCapabilityCanRun}
																	onclick={runCall}
																	data-testid="mcp-config-inspect-call"
																>
																	<PlayIcon class="size-4" />
																	{callPending ? activeCapabilityActionPendingLabel : activeCapabilityActionLabel}
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
																{#if activeCapabilityKind === 'app' && onAppServerStart}
																	<McpAppResourcePreview
																		startInput={activeMcpAppServerInput}
																		title={activeCapability.name}
																		{onAppServerStart}
																		{onAppServerClose}
																	/>
																{/if}
																<StructuredValueViewer value={callResult} menuLabel="Inspect capability result options" class="rounded-lg" />
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
												{/if}
											</ScrollView>
										</div>
									</div>
								</div>
							{/if}
						</section>
					</div>
				{:else}
					<ScrollView
						class="h-full"
						contentClass="grid auto-rows-max gap-3 px-4 py-3"
						viewportTestId="mcp-config-inspect-scroll"
					>
						{#if snapshotView === 'server'}
						<div class="grid gap-3" data-testid="mcp-config-inspect-server-view">
							<section class="grid gap-2">
								<div class="flex items-center gap-1.5">
									<div class="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
										Server
									</div>
									<McpHelpHint
										ariaLabel="Server probe command"
										side="bottom"
										align="start"
										textContext={inspectHeaderHelp}
										mode="mono"
									/>
								</div>
								<div class="mcp-inspect-server-table" data-testid="mcp-config-inspect-server-table">
									<div class="mcp-inspect-server-row mcp-inspect-server-head">
										<div>Field</div>
										<div>Value</div>
									</div>
									{#each snapshotServerRows as row (row.label)}
										<div class="mcp-inspect-server-row">
											<div class="mcp-inspect-server-label">{row.label}</div>
											<div class="mcp-inspect-server-value">{row.value}</div>
										</div>
									{/each}
								</div>
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
					</ScrollView>
				{/if}
			{/if}
		</div>
	</Dialog.Content>
</Dialog.Root>

<Dialog.Root bind:open={inspectConfirmCloseOpen}>
	<Dialog.Content class="sm:max-w-md" data-testid="mcp-config-light-inspect-close-confirm">
		<Dialog.Header>
			<Dialog.Title>Close inspect?</Dialog.Title>
			<Dialog.Description>
				Closing this dialog stops the active probe and releases the temporary config.
			</Dialog.Description>
		</Dialog.Header>
		<Dialog.Footer>
			<Button variant="outline" disabled={inspectReleasePending} onclick={() => (inspectConfirmCloseOpen = false)}>
				Cancel
			</Button>
			<Button
				variant="destructive"
				disabled={inspectReleasePending}
				data-testid="mcp-config-light-inspect-release"
				onclick={() => void releaseInspectSession({ closeDialog: true })}
			>
				{inspectReleasePending ? 'Releasing' : 'Close'}
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
		bind:ref={inspectorDialogContentElement}
		class={cn(
			'grid overflow-hidden grid-rows-[auto_minmax(0,1fr)] gap-0 p-0',
			inspectorFullscreen
				? 'left-0 top-0 h-[100dvh] max-h-none w-[100vw] max-w-none translate-x-0 translate-y-0 rounded-none border-0 sm:max-w-none'
				: 'h-[min(92dvh,58rem)] max-h-[calc(100dvh-1rem)] w-[min(96vw,88rem)] max-w-[calc(100vw-1rem)] sm:max-w-[min(96vw,88rem)]',
		)}
		interactOutsideBehavior="ignore"
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
					<div
						class={cn(
							'flex size-8 items-center justify-center transition-colors duration-300',
							inspectorSignalState === 'connecting'
								? 'text-sky-500'
								: inspectorSignalState === 'closing'
									? 'text-amber-500'
									: inspectorSignalState === 'live'
										? 'text-emerald-500'
										: inspectorSignalState === 'error'
											? 'text-destructive'
											: 'text-destructive',
						)}
						aria-label={inspectorSignalLabel}
						title={inspectorSignalLabel}
						data-testid="mcp-config-heavy-inspector-signal"
						data-state={inspectorSignalState}
					>
						<span
							class={cn(
								'size-2.5 rounded-full shadow-[0_0_0_3px_color-mix(in_srgb,currentColor,transparent_82%)] transition-colors duration-300',
								inspectorSignalState === 'connecting'
									? 'animate-[mcp-signal-breathe_1.8s_ease-in-out_infinite] bg-sky-500 text-sky-500'
									: inspectorSignalState === 'closing'
										? 'animate-[mcp-signal-breathe_1.8s_ease-in-out_infinite] bg-amber-500 text-amber-500'
										: inspectorSignalState === 'live'
											? 'bg-emerald-500 text-emerald-500'
											: 'bg-destructive text-destructive',
							)}
						></span>
					</div>
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
					<Button
						variant="destructive"
						size="icon-sm"
						disabled={inspectorReleasePending}
						aria-label="Close inspector"
						title="Close inspector"
						onclick={requestInspectorDialogClose}
						data-testid="mcp-config-heavy-inspector-close"
					>
						<XIcon class="size-4" />
					</Button>
				</div>
			</div>
		</Dialog.Header>

		<div
			class={cn(
				'grid h-full min-h-0 overflow-hidden',
				inspectorError ? 'grid-rows-[auto_minmax(0,1fr)]' : 'grid-rows-[minmax(0,1fr)]',
			)}
		>
			{#if inspectorError}
				<div class="border-b border-border/50 px-4 py-3">
					<NoticeBanner tone="destructive" message={inspectorError} />
				</div>
			{/if}
			{#if inspectorSession?.url}
				<iframe
					src={inspectorSession.url}
					title="MCP Inspector"
					class="block h-full min-h-0 w-full border-0 bg-background"
					allow="clipboard-read; clipboard-write"
					data-testid="mcp-config-heavy-inspector-iframe"
				></iframe>
			{:else}
				<ScrollView
					class="h-full"
					contentClass="grid auto-rows-max gap-1 bg-muted/20 p-4 font-mono text-xs leading-5 text-muted-foreground"
					viewportTestId="mcp-config-heavy-inspector-log"
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
				</ScrollView>
			{/if}
		</div>
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
	.mcp-inspect-server-table {
		container-type: inline-size;
		display: grid;
		overflow: hidden;
		border-radius: 0.5rem;
		background: color-mix(in srgb, var(--muted) 18%, transparent);
	}

	.mcp-inspect-server-row {
		display: grid;
		grid-template-columns: minmax(8rem, 0.42fr) minmax(0, 1fr);
		gap: 1rem;
		padding: 0.625rem 0.75rem;
	}

	.mcp-inspect-server-row + .mcp-inspect-server-row {
		border-top: 1px solid color-mix(in srgb, var(--border) 58%, transparent);
	}

	.mcp-inspect-server-head {
		background: color-mix(in srgb, var(--muted) 42%, transparent);
		color: var(--muted-foreground);
		font-size: 0.6875rem;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.mcp-inspect-server-label {
		color: var(--muted-foreground);
		font-size: 0.8125rem;
	}

	.mcp-inspect-server-value {
		min-width: 0;
		overflow-wrap: anywhere;
		color: var(--foreground);
		font-size: 0.8125rem;
	}

	@container (max-width: 32rem) {
		.mcp-inspect-server-head {
			display: none;
		}

		.mcp-inspect-server-row {
			grid-template-columns: minmax(0, 1fr);
			gap: 0.25rem;
			padding-block: 0.75rem;
		}
	}

	.mcp-inspect-capability-layout {
		display: grid;
		grid-template-columns: minmax(12rem, 0.34fr) minmax(0, 1fr);
		gap: 0.75rem;
		align-items: stretch;
		block-size: 100%;
		min-block-size: 0;
		min-inline-size: 0;
	}

	.mcp-inspect-capability-shell {
		container-type: inline-size;
		display: grid;
		grid-template-rows: auto minmax(0, 1fr);
		gap: 0.75rem;
		block-size: 100%;
		min-block-size: 0;
		min-inline-size: 0;
	}

	.mcp-inspect-capability-list {
		block-size: 100%;
		min-block-size: 0;
		min-inline-size: 0;
	}

	.mcp-inspect-capability-row {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		gap: 0.625rem;
		align-items: start;
		border-radius: 0.5rem;
		padding: 0.625rem;
		text-align: left;
		color: var(--muted-foreground);
		transition:
			background-color 160ms ease,
			color 160ms ease;
	}

	.mcp-inspect-capability-row:hover {
		background: color-mix(in srgb, var(--muted) 32%, transparent);
		color: var(--foreground);
	}

	.mcp-inspect-capability-detail {
		block-size: 100%;
		min-block-size: 0;
		min-inline-size: 0;
		overflow: hidden;
		border-radius: 0.5rem;
		background: color-mix(in srgb, var(--muted) 18%, transparent);
	}

	@container (max-width: 44rem) {
		.mcp-inspect-capability-layout {
			grid-template-columns: minmax(0, 1fr);
			grid-template-rows: minmax(10rem, 0.42fr) minmax(14rem, 1fr);
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
		font-weight: 600;
		letter-spacing: 0;
		text-shadow: 0 1px 1px color-mix(in srgb, white 45%, transparent);
	}

	@keyframes mcp-signal-breathe {
		0%,
		100% {
			transform: scale(1);
			opacity: 0.82;
		}
		50% {
			transform: scale(1.15);
			opacity: 1;
		}
	}
</style>
