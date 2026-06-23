<script lang="ts">
	import type {
		McpAppServerCloseInput,
		McpAppServerCloseOutput,
		McpAppServerStartInput,
		McpAppServerStartOutput,
		McpInspectorCloseInput,
		McpInspectorCloseOutput,
		McpInspectorSnapshotOutput,
		McpInspectorStartInput,
		McpInspectorStartOutput,
		McpProbeInput,
		McpProbeOutput,
	} from '@agenter/client-sdk';

	import McpAvatarOverview from './mcp-avatar-overview.svelte';
	import McpConfigDetail from './mcp-config-detail.svelte';
	import McpConfigList from './mcp-config-list.svelte';
	import McpNewGlobalForm from './mcp-new-global-form.svelte';
	import McpServerDetail from './mcp-server-detail.svelte';
	import McpServerList from './mcp-server-list.svelte';
	import {
		buildMcpConfigSelectionKey,
		buildMcpConfigCatalogRows,
		listMcpConfigProjectRows,
		mcpWorkbenchFixtureRows,
		type McpAvatarCatalogOption,
		type McpConfigCatalogRow,
		type McpGlobalConfigDraft,
		type McpWorkbenchRow,
	} from './mcp-workbench-state';

	type StoryInspectorSocketEventMap = {
		open: Event;
		close: CloseEvent;
		error: Event;
		message: MessageEvent<string>;
	};
	type StoryInspectorSocket = {
		close: (code?: number, reason?: string) => void;
		addEventListener: <Type extends keyof StoryInspectorSocketEventMap>(
			type: Type,
			listener: (event: StoryInspectorSocketEventMap[Type]) => void,
		) => void;
		removeEventListener: <Type extends keyof StoryInspectorSocketEventMap>(
			type: Type,
			listener: (event: StoryInspectorSocketEventMap[Type]) => void,
		) => void;
	};

	type McpStoryScenario =
		| 'avatar-authority'
		| 'configs-new'
		| 'config-detail'
		| 'config-running'
		| 'avatars-overview'
		| 'inspect-pending'
		| 'loading-empty';

	let {
		scenario = 'config-detail',
	}: {
		scenario?: McpStoryScenario;
	} = $props();
	const iconEcho =
		'data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2016%2016%22%3E%3Crect%20width%3D%2216%22%20height%3D%2216%22%20rx%3D%224%22%20fill%3D%22%23111827%22%2F%3E%3Ctext%20x%3D%228%22%20y%3D%2211%22%20font-size%3D%228%22%20text-anchor%3D%22middle%22%20fill%3D%22%23ffffff%22%20font-family%3D%22ui-sans-serif%2Csystem-ui%22%3EE%3C%2Ftext%3E%3C%2Fsvg%3E';
	const iconWorkspace =
		'data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2016%2016%22%3E%3Crect%20width%3D%2216%22%20height%3D%2216%22%20rx%3D%224%22%20fill%3D%22%230f172a%22%2F%3E%3Ctext%20x%3D%228%22%20y%3D%2211%22%20font-size%3D%228%22%20text-anchor%3D%22middle%22%20fill%3D%22%23ffffff%22%20font-family%3D%22ui-sans-serif%2Csystem-ui%22%3EW%3C%2Ftext%3E%3C%2Fsvg%3E';
	const iconSection =
		'data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2016%2016%22%3E%3Crect%20width%3D%2216%22%20height%3D%2216%22%20rx%3D%224%22%20fill%3D%22%237c3aed%22%2F%3E%3Ctext%20x%3D%228%22%20y%3D%2211%22%20font-size%3D%228%22%20text-anchor%3D%22middle%22%20fill%3D%22%23ffffff%22%20font-family%3D%22ui-sans-serif%2Csystem-ui%22%3ES%3C%2Ftext%3E%3C%2Fsvg%3E';
	const iconPrompt =
		'data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2016%2016%22%3E%3Crect%20width%3D%2216%22%20height%3D%2216%22%20rx%3D%224%22%20fill%3D%22%230f766e%22%2F%3E%3Ctext%20x%3D%228%22%20y%3D%2211%22%20font-size%3D%228%22%20text-anchor%3D%22middle%22%20fill%3D%22%23ffffff%22%20font-family%3D%22ui-sans-serif%2Csystem-ui%22%3EP%3C%2Ftext%3E%3C%2Fsvg%3E';
	const iconApp =
		'data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2016%2016%22%3E%3Crect%20width%3D%2216%22%20height%3D%2216%22%20rx%3D%224%22%20fill%3D%22%232563eb%22%2F%3E%3Ctext%20x%3D%228%22%20y%3D%2211%22%20font-size%3D%228%22%20text-anchor%3D%22middle%22%20fill%3D%22%23ffffff%22%20font-family%3D%22ui-sans-serif%2Csystem-ui%22%3EA%3C%2Ftext%3E%3C%2Fsvg%3E';
	const iconTool =
		'data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2016%2016%22%3E%3Crect%20width%3D%2216%22%20height%3D%2216%22%20rx%3D%224%22%20fill%3D%22%232563eb%22%2F%3E%3Ctext%20x%3D%228%22%20y%3D%2211%22%20font-size%3D%228%22%20text-anchor%3D%22middle%22%20fill%3D%22%23ffffff%22%20font-family%3D%22ui-sans-serif%2Csystem-ui%22%3ET%3C%2Ftext%3E%3C%2Fsvg%3E';
	const iconResource =
		'data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2016%2016%22%3E%3Crect%20width%3D%2216%22%20height%3D%2216%22%20rx%3D%224%22%20fill%3D%22%232563eb%22%2F%3E%3Ctext%20x%3D%228%22%20y%3D%2211%22%20font-size%3D%228%22%20text-anchor%3D%22middle%22%20fill%3D%22%23ffffff%22%20font-family%3D%22ui-sans-serif%2Csystem-ui%22%3ER%3C%2Ftext%3E%3C%2Fsvg%3E';

	const avatarCatalog = [
		{
			nickname: 'default',
			label: 'Default Avatar',
			principalId: '0x2f1a1e21381acab5c76cb31d96453fabaae2d1ff',
			iconUrl: null,
		},
		{
			nickname: 'agent',
			label: 'Agent Avatar',
			principalId: '0x7d0ec3a2d8f9db9b0d7d2c4a1ce47b6f21a9e4bc',
			iconUrl: null,
		},
	] satisfies readonly McpAvatarCatalogOption[];
	const defaultRows = mcpWorkbenchFixtureRows;
	const agentRows = [
		{
			...mcpWorkbenchFixtureRows[1],
			projectPath: '/repo/agent',
			projectState: 'enabled',
			lifecycle: 'running',
			latestAction: {
				operation: 'start',
				status: 'ok',
				label: 'agent runtime connected',
				at: '10:40',
			},
		},
	] satisfies readonly McpWorkbenchRow[];

	const installedByAvatar = new Map<string, readonly McpWorkbenchRow[]>([
		['default', defaultRows.map((row) => ({ ...row, projectPath: null, projectState: 'default-disabled', lifecycle: 'not-started', tools: [], resources: [], prompts: [], serverInfo: { serverName: null, serverVersion: null, protocolVersion: null }, snapshot: null, snapshotAt: null, latestError: null, blockedProjects: [], latestAction: { operation: 'add', status: 'ok', label: 'global config installed', at: row.latestAction.at }, lastUsedAt: null }))],
		['agent', agentRows.map((row) => ({ ...row, projectPath: null, projectState: 'default-disabled', lifecycle: 'not-started', tools: [], resources: [], prompts: [], serverInfo: { serverName: null, serverVersion: null, protocolVersion: null }, snapshot: null, snapshotAt: null, latestError: null, blockedProjects: [], latestAction: { operation: 'add', status: 'ok', label: 'global config installed', at: row.latestAction.at }, lastUsedAt: null }))],
	]);
	const projectByAvatar = new Map<string, readonly McpWorkbenchRow[]>([
		['default', defaultRows],
		['agent', agentRows],
	]);
	const configByAvatar = new Map<string, readonly McpConfigCatalogRow[]>(
		[...installedByAvatar.entries()].map(([nickname, rows]) => [
			nickname,
			buildMcpConfigCatalogRows(
				avatarCatalog.find((avatar) => avatar.nickname === nickname) ?? avatarCatalog[0]!,
				rows,
				projectByAvatar.get(nickname) ?? [],
			),
		]),
	);
	const catalogRows = [...configByAvatar.values()].flat();

	let selectedConfigKey = $state<'__new__' | string>(buildMcpConfigSelectionKey({ avatarNickname: 'default', name: 'filesystem' }));
	let selectedAvatarNickname = $state('default');
	let draftAvatarNickname = $state('default');
	let selectedProjectPath = $state<string | null>(null);
	let latestEvent = $state('idle');

	$effect(() => {
		selectedConfigKey =
			scenario === 'configs-new' || scenario === 'avatar-authority'
				? '__new__'
				: buildMcpConfigSelectionKey({ avatarNickname: 'default', name: 'filesystem' });
		selectedAvatarNickname = 'default';
		draftAvatarNickname = 'default';
		selectedProjectPath = null;
		latestEvent = 'idle';
	});

	const selectedCatalogRow = $derived(
		selectedConfigKey === '__new__'
			? null
			: catalogRows.find((row) => buildMcpConfigSelectionKey(row) === selectedConfigKey) ?? null,
	);
	const selectedProjectRows = $derived(
		selectedCatalogRow
			? listMcpConfigProjectRows(projectByAvatar.get(selectedCatalogRow.avatarNickname) ?? [], selectedCatalogRow.name)
			: [],
	);
	const selectedGlobalRow = $derived(
		selectedCatalogRow
			? (installedByAvatar.get(selectedCatalogRow.avatarNickname) ?? []).find((row) => row.name === selectedCatalogRow.name) ??
				null
			: null,
	);

	const recordEvent = (event: string): void => {
		latestEvent = event;
	};

	const buildProbeSnapshot = (input: { name?: string; projectPath?: string; transport?: McpGlobalConfigDraft['transport'] }) => ({
		name: input.name ?? 'browser-tools',
		projectPath: input.projectPath ?? '/repo/app',
		serverName: `fixture-${input.name ?? 'browser-tools'}`,
		serverVersion: '1.0.0',
		protocolVersion: '2025-06-18',
		tools: [
			{
				name: 'echo',
				title: 'Echo',
				description: 'Echo one message back through the fixture transport.',
				icons: [
					{
						src: iconEcho,
						mimeType: 'image/svg+xml',
					},
				],
				inputSchema: {
					type: 'object',
					required: ['message'],
					properties: {
						message: { type: 'string', default: 'hello' },
						trace: { type: 'boolean' },
					},
				},
			},
			{
				name: 'playground-link',
				title: 'Playground Link UI',
				description: 'Returns a UI resource for playground links.',
				_meta: {
					'openai/outputTemplate': 'ui://svelte/playground-link',
				},
			},
		],
		resources: [
			{
				uri: 'memory://workspace',
				title: 'Workspace Memory',
				description: 'Fixture resource catalogue.',
				icons: [
					{
						src: iconWorkspace,
						mimeType: 'image/svg+xml',
					},
				],
			},
			{
				uri: 'svelte:///docs/index.md',
				title: 'Svelte Docs Index',
				description: 'Entry point for the Svelte documentation catalog.',
				icons: [
					{
						src: iconSection,
						mimeType: 'image/svg+xml',
					},
				],
			},
			{
				uri: 'svelte:///docs/guide.md',
				title: 'Svelte Guide',
				description: 'Core guide sections for Svelte.',
				icons: [
					{
						src: iconSection,
						mimeType: 'image/svg+xml',
					},
				],
			},
			{
				uri: 'svelte:///docs/kit.md',
				title: 'SvelteKit Guide',
				description: 'Routing, data loading, and app shell guidance.',
				icons: [
					{
						src: iconSection,
						mimeType: 'image/svg+xml',
					},
				],
			},
			{
				uri: 'ui://svelte/playground-link',
				title: 'UI resource for the Svelte Playground widget',
				description: 'UI resource for the Svelte Playground widget.',
			},
			{
				uri: 'svelte:///ai/instructions.md',
				title: 'ai/instructions',
				description: 'To get the most out of the MCP server and skills, include the following...',
			},
		],
		resourceTemplates: [
			{
				name: 'Svelte-Doc-Section',
				title: 'A single documentation section',
				description: 'A single documentation section',
				icons: [
					{
						src: iconSection,
						mimeType: 'image/svg+xml',
					},
				],
				uriTemplate: 'svelte://{/slug*}.md',
			},
		],
		prompts: [
			{
				name: 'summarize',
				description: 'Fixture prompt template.',
				arguments: [
					{
						name: 'topic',
						description: 'What to summarize',
						required: true,
					},
				],
				icons: [
					{
						src: iconPrompt,
						mimeType: 'image/svg+xml',
					},
				],
			},
		],
		apps: [
			{
				type: 'app',
				toolName: 'playground-link',
				resourceUri: 'ui://svelte/playground-link',
				icons: [
					{
						src: iconApp,
						mimeType: 'image/svg+xml',
					},
				],
				tool: {
					name: 'playground-link',
					title: 'Playground Link UI',
					description: 'Returns a UI resource for playground links.',
					icons: [
						{
							src: iconTool,
							mimeType: 'image/svg+xml',
						},
					],
					_meta: {
						'openai/outputTemplate': 'ui://svelte/playground-link',
					},
				},
				resource: {
					uri: 'ui://svelte/playground-link',
					title: 'UI resource for the Svelte Playground widget',
					description: 'UI resource for the Svelte Playground widget.',
					icons: [
						{
							src: iconResource,
							mimeType: 'image/svg+xml',
						},
					],
				},
			},
		],
		snapshot: {
			transport: input.transport,
			resourceTemplates: ['svelte://{/slug*}.md'],
		},
		snapshotAt: '2026-06-08T00:00:00.000Z',
	});

	const buildProbeOutput = (input: McpProbeInput, parsed: unknown, exitCode = 0): McpProbeOutput => ({
		command: 'mcp probe',
		stdin: JSON.stringify(input, null, 2),
		stdout: exitCode === 0 ? `${JSON.stringify(parsed, null, 2)}\n` : '',
		stderr: exitCode === 0 ? '' : 'probe failed\n',
		exitCode,
		parsed,
	});

	const buildMcpAppHtml = (): string =>
		[
			'<!doctype html>',
			'<html><body style="margin:0;font:13px system-ui;background:#fff;color:#111">',
			'<main style="display:grid;min-height:100vh;place-items:center;padding:16px">',
			'<div id="status">Waiting for tool output</div>',
			'</main>',
			'<script>',
			'const status = document.getElementById("status");',
			'window.addEventListener("message", (event) => {',
			'  const message = event.data || {};',
			'  if (message.method === "ui/notifications/tool-result") {',
			'    status.textContent = message.params?.structuredContent?.url || "tool output received";',
			'  }',
			'});',
			'window.parent.postMessage({ jsonrpc: "2.0", id: 1, method: "ui/initialize", params: {} }, "*");',
			'</scr' + 'ipt>',
			'</body></html>',
		].join('\n');

	const buildInspectorSession = (
		state: McpInspectorSnapshotOutput['state'],
		url?: string,
	): McpInspectorSnapshotOutput => ({
		sessionId: 'inspector-story-1',
		leaseId: 'lease-story-1',
		state,
		url,
		command: 'bunx',
		args: [
			'@modelcontextprotocol/inspector',
			'--config',
			'/avatar/tmp/mcp-inspector-story-1.json',
			'--server',
			'browser-tools',
		],
		cwd: '/repo/app',
		logs: [
			{
				id: 1,
				stream: 'system',
				text: 'bunx "@modelcontextprotocol/inspector" "--config" "/avatar/tmp/mcp-inspector-story-1.json" "--server" "browser-tools"',
				createdAt: '2026-06-08T00:00:00.000Z',
			},
			{
				id: 2,
				stream: 'stdout',
				text: 'MCP Inspector listening on http://127.0.0.1:6274/?MCP_PROXY_AUTH_TOKEN=story',
				createdAt: '2026-06-08T00:00:01.000Z',
			},
		],
		startedAt: '2026-06-08T00:00:00.000Z',
		updatedAt: state === 'starting' ? '2026-06-08T00:00:00.000Z' : '2026-06-08T00:00:01.000Z',
		closedAt: state === 'closed' ? '2026-06-08T00:00:02.000Z' : undefined,
	});

	const submitGlobal = async (
		draft: McpGlobalConfigDraft,
		options: { override?: boolean } = {},
	): Promise<void> => {
		recordEvent(
			`submit:${draft.avatarNickname}:${draft.name}:${draft.transport.kind}:${options.override ? 'override' : 'install'}`,
		);
	};

	const probeDraft = async (input: McpProbeInput): Promise<McpProbeOutput> => {
		recordEvent(`probe:${input.action}:${'probeId' in input ? input.probeId : input.name ?? 'draft'}`);
		if (scenario === 'inspect-pending' && input.action === 'open') {
			return new Promise(() => undefined);
		}
		if (input.action === 'open') {
			const transport =
				input.transport.kind === 'stdio'
					? {
							...input.transport,
							args: input.transport.args ?? [],
						}
					: input.transport;
			return buildProbeOutput(input, {
				probeId: 'probe-story-1',
				snapshot: buildProbeSnapshot({
					name: input.name,
					projectPath: input.projectPath,
					transport,
				}),
			});
		}
		if (input.action === 'ping') {
			return buildProbeOutput(input, {});
		}
		if (input.action === 'close') {
			return buildProbeOutput(input, { probeId: input.probeId, closed: true });
		}
		const result =
			input.action === 'read-resource'
				? input.resourceUri === 'ui://svelte/playground-link'
					? {
							contents: [
								{
									uri: input.resourceUri,
									mimeType: 'text/html;profile=mcp-app',
									text: buildMcpAppHtml(),
								},
							],
						}
					: input.resourceUri === 'svelte:///ai/instructions.md'
						? {
								contents: [
									{
										uri: input.resourceUri,
										mimeType: 'text/markdown',
										text: `# AI Instructions\n\nTo get the most out of the MCP server and skills, include the following:\n\n- Keep the app focused\n- Use the inspect panel for CLI-shaped evidence\n- Read resources before calling tools when the URI template points at docs\n`,
									},
								],
							}
						: {
								contents: [
									{
										uri: input.resourceUri,
										mimeType: 'application/json',
										text: JSON.stringify(
											{
												title: 'Workspace Memory',
												workspace: 'fixture',
												projectPath: '/repo/app',
											},
											null,
											2,
										),
									},
								],
							}
				: input.action === 'get-prompt'
					? {
							description: 'Fixture summarize prompt.',
							messages: [
								{
									role: 'user',
									content: {
										type: 'text',
										text: `Summarize ${String(input.arguments?.topic ?? 'workspace')} for /repo/app.`,
									},
								},
							],
						}
					: input.action === 'call-tool'
						? input.toolName === 'playground-link'
							? {
									content: [{ type: 'text', text: 'playground link ready' }],
									structuredContent: {
										url: 'https://svelte.dev/playground/hello-world',
									},
								}
							: {
									content: [{ type: 'text', text: 'ok' }],
									structuredContent: {
										ok: true,
										received: input.arguments ?? {},
									},
								}
						: undefined;
		return buildProbeOutput(input, result ?? {});
	};

	const startInspector = async (input: McpInspectorStartInput): Promise<McpInspectorStartOutput> => {
		recordEvent(`inspector-start:${input.name ?? 'draft'}`);
		return {
			...buildInspectorSession('starting'),
			wsUrl: 'ws://127.0.0.1:6006/mcp/inspector/lease-story-1?avatarNickname=default',
		};
	};

	const closeInspector = async (input: McpInspectorCloseInput): Promise<McpInspectorCloseOutput> => {
		recordEvent(`inspector-close:${input.sessionId}`);
		return buildInspectorSession('closed');
	};

	const startAppServer = async (input: McpAppServerStartInput): Promise<McpAppServerStartOutput> => {
		recordEvent(`app-server-start:${input.toolName ?? input.resourceUri ?? input.name ?? 'app'}`);
		const now = new Date().toISOString();
		return {
			sessionId: 'app-server-story-1',
			leaseId: 'app-lease-story-1',
			state: 'ready',
			command: 'mcp app-server',
			name: input.name ?? 'story-app',
			projectPath: input.projectPath ?? '/repo/app',
			resourceUri: input.resourceUri ?? 'ui://story/app',
			toolName: input.toolName,
			toolArguments: input.arguments,
			hostPath: '/mcp/apps/app-lease-story-1/host',
			wsPath: '/mcp/apps/app-lease-story-1/ws',
			hostUrl: 'about:blank',
			wsUrl: 'ws://127.0.0.1:6006/mcp/apps/app-lease-story-1/ws',
			startedAt: now,
			updatedAt: now,
		};
	};

	const closeAppServer = async (input: McpAppServerCloseInput): Promise<McpAppServerCloseOutput> => {
		recordEvent(`app-server-close:${input.sessionId}`);
		const now = new Date().toISOString();
		return {
			sessionId: input.sessionId,
			leaseId: 'app-lease-story-1',
			state: 'closed',
			command: 'mcp app-server',
			name: 'story-app',
			projectPath: '/repo/app',
			resourceUri: 'ui://story/app',
			hostPath: '/mcp/apps/app-lease-story-1/host',
			wsPath: '/mcp/apps/app-lease-story-1/ws',
			startedAt: now,
			updatedAt: now,
			closedAt: now,
		};
	};

	const createInspectorSocket = (url: string): StoryInspectorSocket => {
		recordEvent(`inspector-ws:${url}`);
		const listeners = {
			open: new Set<(event: Event) => void>(),
			close: new Set<(event: CloseEvent) => void>(),
			error: new Set<(event: Event) => void>(),
			message: new Set<(event: MessageEvent<string>) => void>(),
		};
		let closed = false;
		const dispatch = (
			type: keyof StoryInspectorSocketEventMap,
			event: StoryInspectorSocketEventMap[keyof StoryInspectorSocketEventMap],
		): void => {
			for (const listener of listeners[type]) {
				listener(event as never);
			}
		};
		queueMicrotask(() => {
			if (!closed) {
				dispatch('open', new Event('open'));
			}
		});
		const readyTimer = setTimeout(() => {
			if (closed) {
				return;
			}
			dispatch(
				'message',
				new MessageEvent('message', {
					data: JSON.stringify({
						type: 'snapshot',
						session: buildInspectorSession('ready', 'http://127.0.0.1:6274/?MCP_PROXY_AUTH_TOKEN=story'),
					}),
				}),
			);
		}, 20);
		return {
			close: () => {
				if (closed) {
					return;
				}
				closed = true;
				clearTimeout(readyTimer);
				recordEvent('inspector-close:inspector-story-1');
				const closeEvent =
					typeof CloseEvent === 'function' ? new CloseEvent('close') : (new Event('close') as CloseEvent);
				dispatch('close', closeEvent);
			},
			addEventListener: (type, listener) => {
				listeners[type].add(listener as never);
			},
			removeEventListener: (type, listener) => {
				listeners[type].delete(listener as never);
			},
		};
	};
</script>

<div class="grid h-[58rem] max-h-[calc(100vh-2rem)] min-w-0 grid-rows-[auto_minmax(0,1fr)] border border-border/50" data-testid="mcp-story-harness">
	<div class="flex min-w-0 items-center justify-between gap-3 border-b border-border/50 px-3 py-2">
		<div class="truncate text-sm font-semibold">MCP story</div>
		<div class="truncate text-xs text-muted-foreground" data-testid="mcp-story-event">{latestEvent}</div>
	</div>

	{#if scenario === 'avatars-overview'}
		<McpAvatarOverview
			avatars={avatarCatalog}
			bind:selectedAvatarNickname
			configRowsByAvatar={configByAvatar}
			projectRowsByAvatar={projectByAvatar}
		/>
	{:else if scenario === 'avatar-authority'}
		<div class="grid min-w-0 gap-0 lg:grid-cols-[minmax(18rem,0.42fr)_minmax(0,1fr)]" data-testid="mcp-story-avatar-authority">
			<div class="border-b border-border/50 lg:border-b-0 lg:border-r">
				<McpConfigList rows={catalogRows} selectedKey={selectedConfigKey} onSelect={(key) => (selectedConfigKey = key as '__new__' | string)} />
			</div>
			<div>
				<McpNewGlobalForm
					avatarOptions={avatarCatalog}
					knownConfigRows={catalogRows}
					bind:ownerAvatarNickname={draftAvatarNickname}
					onSubmit={submitGlobal}
					onProbe={probeDraft}
					onInspectorStart={startInspector}
					onInspectorClose={closeInspector}
					onAppServerStart={startAppServer}
					onAppServerClose={closeAppServer}
					{createInspectorSocket}
				/>
			</div>
		</div>
	{:else if scenario === 'configs-new' || scenario === 'inspect-pending'}
		<div class="grid min-w-0 gap-0 lg:grid-cols-[minmax(18rem,0.42fr)_minmax(0,1fr)]">
			<div class="border-b border-border/50 lg:border-b-0 lg:border-r">
				<McpConfigList
					rows={catalogRows}
					selectedKey={selectedConfigKey}
					onSelect={(key) => (selectedConfigKey = key as '__new__' | string)}
					onOpenAvatar={(avatarNickname) => {
						selectedAvatarNickname = avatarNickname;
						recordEvent(`open-avatar:${avatarNickname}`);
					}}
				/>
			</div>
			<div>
				<McpNewGlobalForm
					avatarOptions={avatarCatalog}
					knownConfigRows={catalogRows}
					bind:ownerAvatarNickname={draftAvatarNickname}
					onSubmit={submitGlobal}
					onProbe={probeDraft}
					onInspectorStart={startInspector}
					onInspectorClose={closeInspector}
					onAppServerStart={startAppServer}
					onAppServerClose={closeAppServer}
					{createInspectorSocket}
				/>
			</div>
		</div>
	{:else if scenario === 'config-running'}
		<div class="grid min-w-0 gap-0 lg:grid-cols-[minmax(18rem,0.42fr)_minmax(0,1fr)]">
			<div class="border-b border-border/50 lg:border-b-0 lg:border-r">
				<McpConfigList
					rows={catalogRows}
					selectedKey={selectedConfigKey}
					onSelect={(key) => (selectedConfigKey = key as '__new__' | string)}
					onOpenAvatar={(avatarNickname) => {
						selectedAvatarNickname = avatarNickname;
						recordEvent(`open-avatar:${avatarNickname}`);
					}}
				/>
			</div>
			<div>
				<McpConfigDetail
					row={selectedCatalogRow}
					initialRow={selectedGlobalRow}
					avatarOptions={avatarCatalog}
					knownConfigRows={catalogRows}
					projectRows={selectedProjectRows}
					{selectedProjectPath}
					onOpenAvatar={(avatarNickname) => {
						selectedAvatarNickname = avatarNickname;
						recordEvent(`open-avatar:${avatarNickname}`);
					}}
					onSubmitGlobal={submitGlobal}
					onProbe={probeDraft}
					onInspectorStart={startInspector}
					onInspectorClose={closeInspector}
					onAppServerStart={startAppServer}
					onAppServerClose={closeAppServer}
					{createInspectorSocket}
					onAddProject={async (nextProjectPath) => {
						selectedProjectPath = nextProjectPath;
						recordEvent(`add-project:${nextProjectPath}`);
					}}
					onStartProject={async (row) => {
						selectedProjectPath = row.projectPath;
						recordEvent(`start:${row.projectPath ?? row.name}`);
					}}
					onStopProject={async (row) => {
						selectedProjectPath = row.projectPath;
						recordEvent(`stop:${row.projectPath ?? row.name}`);
					}}
					onRestartProject={async (row) => {
						selectedProjectPath = row.projectPath;
						recordEvent(`restart:${row.projectPath ?? row.name}`);
					}}
					onRemoveProject={async (row) => {
						recordEvent(`remove-project:${row.projectPath ?? row.name}`);
					}}
				/>
			</div>
		</div>
	{:else if scenario === 'loading-empty'}
		<div class="grid min-h-0 min-w-0 grid-rows-[minmax(0,1fr)_minmax(0,1fr)]">
			<div class="grid min-h-0 min-w-0 gap-0 border-b border-border/50 lg:grid-cols-[minmax(18rem,0.42fr)_minmax(0,1fr)]">
				<div class="min-h-0 border-b border-border/50 lg:border-b-0 lg:border-r">
					<McpConfigList
						rows={[]}
						selectedKey="__new__"
						loading
						onSelect={(key) => (selectedConfigKey = key as '__new__' | string)}
						onOpenAvatar={(avatarNickname) => {
							selectedAvatarNickname = avatarNickname;
							recordEvent(`open-avatar:${avatarNickname}`);
						}}
					/>
				</div>
				<div class="min-h-0">
					<McpConfigDetail
						row={null}
						initialRow={null}
						avatarOptions={[]}
						knownConfigRows={[]}
						projectRows={[]}
						loading
						onSubmitGlobal={submitGlobal}
						onProbe={probeDraft}
						onAddProject={async (nextProjectPath) => {
							selectedProjectPath = nextProjectPath;
							recordEvent(`add-project:${nextProjectPath}`);
						}}
						onStartProject={async (row) => {
							selectedProjectPath = row.projectPath;
							recordEvent(`start:${row.projectPath ?? row.name}`);
						}}
						onStopProject={async (row) => {
							selectedProjectPath = row.projectPath;
							recordEvent(`stop:${row.projectPath ?? row.name}`);
						}}
						onRestartProject={async (row) => {
							selectedProjectPath = row.projectPath;
							recordEvent(`restart:${row.projectPath ?? row.name}`);
						}}
						onRemoveProject={async (row) => {
							recordEvent(`remove-project:${row.projectPath ?? row.name}`);
						}}
					/>
				</div>
			</div>
			<div class="grid min-h-0 min-w-0 gap-0 lg:grid-cols-[minmax(18rem,0.42fr)_minmax(0,1fr)]">
				<div class="min-h-0 border-b border-border/50 lg:border-b-0 lg:border-r">
					<McpServerList
						rows={[]}
						selectedName=""
						loading
						onSelect={(name) => {
							recordEvent(`select-server:${name}`);
						}}
					/>
				</div>
				<div class="min-h-0">
					<McpServerDetail row={null} projectPath="" loading />
				</div>
			</div>
		</div>
	{:else}
			<div class="grid min-w-0 gap-0 lg:grid-cols-[minmax(18rem,0.42fr)_minmax(0,1fr)]">
			<div class="border-b border-border/50 lg:border-b-0 lg:border-r">
				<McpConfigList
					rows={catalogRows}
					selectedKey={selectedConfigKey}
					onSelect={(key) => (selectedConfigKey = key as '__new__' | string)}
					onOpenAvatar={(avatarNickname) => {
						selectedAvatarNickname = avatarNickname;
						recordEvent(`open-avatar:${avatarNickname}`);
					}}
				/>
			</div>
			<div>
				<McpConfigDetail
					row={selectedCatalogRow}
					initialRow={selectedGlobalRow}
					avatarOptions={avatarCatalog}
					knownConfigRows={catalogRows}
					projectRows={selectedProjectRows}
					{selectedProjectPath}
					onOpenAvatar={(avatarNickname) => {
						selectedAvatarNickname = avatarNickname;
						recordEvent(`open-avatar:${avatarNickname}`);
					}}
					onSubmitGlobal={submitGlobal}
					onProbe={probeDraft}
					onInspectorStart={startInspector}
					onInspectorClose={closeInspector}
					onAppServerStart={startAppServer}
					onAppServerClose={closeAppServer}
					{createInspectorSocket}
					onAddProject={async (nextProjectPath) => {
						selectedProjectPath = nextProjectPath;
						recordEvent(`add-project:${nextProjectPath}`);
					}}
					onStartProject={async (row) => {
						selectedProjectPath = row.projectPath;
						recordEvent(`start:${row.projectPath ?? row.name}`);
					}}
					onStopProject={async (row) => {
						selectedProjectPath = row.projectPath;
						recordEvent(`stop:${row.projectPath ?? row.name}`);
					}}
					onRestartProject={async (row) => {
						selectedProjectPath = row.projectPath;
						recordEvent(`restart:${row.projectPath ?? row.name}`);
					}}
					onRemoveProject={async (row) => {
						recordEvent(`remove-project:${row.projectPath ?? row.name}`);
					}}
				/>
			</div>
		</div>
	{/if}
</div>
