export type McpTransportKind = 'stdio' | 'streamable-http' | 'sse';
export type McpProjectState = 'enabled' | 'default-disabled';
export type McpLifecycleState = 'starting' | 'running' | 'stopped' | 'failed' | 'not-started';
export type McpProjectionMode = 'global-only' | 'exact-project';

export type McpQueryPrimitive = string | number | null;
export type McpQueryRow = Record<string, McpQueryPrimitive>;

export interface McpWorkbenchCapability {
	name: string;
	description: string;
	schema: unknown | null;
	raw: unknown;
}

export interface McpWorkbenchActionFact {
	operation: 'add' | 'enable' | 'disable' | 'start' | 'stop' | 'restart' | 'call' | 'remove' | 'query';
	status: 'ok' | 'blocked' | 'failed';
	label: string;
	at: string;
	detail?: unknown;
}

export interface McpRuntimeAuthority {
	id: string;
	label: string;
	scope: string;
}

export interface McpTransportSummary {
	kind: McpTransportKind;
	command?: string;
	args?: string[];
	url?: string;
	headers?: Record<string, string>;
	env?: Record<string, string>;
}

export interface McpServerInfo {
	serverName: string | null;
	serverVersion: string | null;
	protocolVersion: string | null;
}

export interface McpWorkbenchRow {
	name: string;
	title: string;
	description: string;
	transport: McpTransportKind;
	transportSummary: McpTransportSummary;
	projectPath: string | null;
	projectState: McpProjectState;
	enabledSource: 'explicit' | 'default' | 'global';
	lifecycle: McpLifecycleState;
	tools: McpWorkbenchCapability[];
	resources: McpWorkbenchCapability[];
	prompts: McpWorkbenchCapability[];
	serverInfo: McpServerInfo;
	snapshot: unknown | null;
	snapshotAt: string | null;
	latestError: string | null;
	blockedProjects: string[];
	latestAction: McpWorkbenchActionFact;
	createdAt: string | null;
	updatedAt: string | null;
	lastUsedAt: string | null;
}

export type McpGlobalConfigDraftTransport =
	| {
			kind: 'stdio';
			command: string;
			args: string[];
			env?: Record<string, string>;
	  }
	| {
			kind: 'streamable-http' | 'sse';
			url: string;
			headers?: Record<string, string>;
	  };

export interface McpGlobalConfigDraft {
	name: string;
	title?: string;
	description?: string;
	transport: McpGlobalConfigDraftTransport;
	env?: Record<string, string>;
	enableProjectPath?: string;
}

export type McpProjectLifecycleAction = 'start' | 'stop' | 'restart';

const emptyServerInfo = (): McpServerInfo => ({
	serverName: null,
	serverVersion: null,
	protocolVersion: null,
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

const isStringRecord = (value: unknown): value is Record<string, string> =>
	isRecord(value) && Object.values(value).every((entry) => typeof entry === 'string');

const stringifyIfPresent = (value: unknown): string => {
	if (typeof value === 'string') {
		return value;
	}
	if (value === null || value === undefined) {
		return '';
	}
	return JSON.stringify(value);
};

const parseJson = (value: string | null): unknown => {
	if (!value) {
		return null;
	}
	try {
		return JSON.parse(value);
	} catch {
		return null;
	}
};

const parseJsonArray = (value: string | null): unknown[] => {
	const parsed = parseJson(value);
	return Array.isArray(parsed) ? parsed : [];
};

const parseStringArray = (value: string | null): string[] =>
	parseJsonArray(value).filter((entry): entry is string => typeof entry === 'string');

const parseStringRecord = (value: string | null): Record<string, string> | undefined => {
	const parsed = parseJson(value);
	return isStringRecord(parsed) ? parsed : undefined;
};

const readString = (row: McpQueryRow, key: string): string | null => {
	const value = row[key];
	return typeof value === 'string' && value.length > 0 ? value : null;
};

const readNumber = (row: McpQueryRow, key: string): number | null => {
	const value = row[key];
	return typeof value === 'number' ? value : null;
};

const readTransportKind = (row: McpQueryRow): McpTransportKind => {
	const value = readString(row, 'transport_kind');
	if (value === 'streamable-http' || value === 'sse') {
		return value;
	}
	return 'stdio';
};

const readLifecycle = (row: McpQueryRow): McpLifecycleState => {
	const value = readString(row, 'lifecycle');
	if (value === 'starting' || value === 'running' || value === 'stopped' || value === 'failed') {
		return value;
	}
	return 'not-started';
};

const capabilityName = (value: unknown, fallback: string): string => {
	if (isRecord(value)) {
		const name = value.name;
		const uri = value.uri;
		const title = value.title;
		if (typeof name === 'string' && name.length > 0) {
			return name;
		}
		if (typeof uri === 'string' && uri.length > 0) {
			return uri;
		}
		if (typeof title === 'string' && title.length > 0) {
			return title;
		}
	}
	return fallback;
};

const capabilityDescription = (value: unknown): string => {
	if (!isRecord(value)) {
		return stringifyIfPresent(value);
	}
	const description = value.description;
	const title = value.title;
	return typeof description === 'string' && description.length > 0
		? description
		: typeof title === 'string' && title.length > 0
			? title
			: '';
};

const capabilitySchema = (value: unknown): unknown | null => {
	if (!isRecord(value)) {
		return null;
	}
	return value.inputSchema ?? value.schema ?? null;
};

const mapCapabilities = (values: unknown[]): McpWorkbenchCapability[] =>
	values.map((value, index) => ({
		name: capabilityName(value, `item_${index + 1}`),
		description: capabilityDescription(value),
		schema: capabilitySchema(value),
		raw: value,
	}));

const buildTransportSummary = (row: McpQueryRow): McpTransportSummary => {
	const kind = readTransportKind(row);
	if (kind === 'stdio') {
		return {
			kind,
			command: readString(row, 'command') ?? undefined,
			args: parseStringArray(readString(row, 'args_json')),
			env: parseStringRecord(readString(row, 'env_json')),
		};
	}
	return {
		kind,
		url: readString(row, 'url') ?? undefined,
		headers: parseStringRecord(readString(row, 'headers_json')),
	};
};

const titleForRow = (row: McpQueryRow): string => readString(row, 'title') ?? readString(row, 'name') ?? 'Unnamed MCP';

const descriptionForRow = (row: McpQueryRow): string => readString(row, 'description') ?? 'No description';

const actionFromRow = (
	operation: McpWorkbenchActionFact['operation'],
	status: McpWorkbenchActionFact['status'],
	label: string,
	at: string | null,
	detail?: unknown,
): McpWorkbenchActionFact => ({
	operation,
	status,
	label,
	at: at ?? 'not recorded',
	detail,
});

export const mapInstalledMcpRows = (rows: readonly McpQueryRow[]): McpWorkbenchRow[] =>
	rows.map((row) => {
		const name = readString(row, 'name') ?? 'unnamed';
		const transport = readTransportKind(row);
		return {
			name,
			title: titleForRow(row),
			description: descriptionForRow(row),
			transport,
			transportSummary: buildTransportSummary(row),
			projectPath: null,
			projectState: 'default-disabled',
			enabledSource: 'global',
			lifecycle: 'not-started',
			tools: [],
			resources: [],
			prompts: [],
			serverInfo: emptyServerInfo(),
			snapshot: null,
			snapshotAt: null,
			latestError: null,
			blockedProjects: [],
			latestAction: actionFromRow('add', 'ok', 'global config installed', readString(row, 'updated_at')),
			createdAt: readString(row, 'created_at'),
			updatedAt: readString(row, 'updated_at'),
			lastUsedAt: null,
		};
	});

export const mapEnabledMcpRows = (rows: readonly McpQueryRow[]): McpWorkbenchRow[] =>
	rows.map((row) => {
		const name = readString(row, 'name') ?? 'unnamed';
		const enabled = readNumber(row, 'enabled') === 1;
		const latestError = readString(row, 'last_error');
		const lifecycle = readLifecycle(row);
		const snapshot = parseJson(readString(row, 'snapshot_json'));
		const tools = mapCapabilities(parseJsonArray(readString(row, 'tools_json')));
		const resources = mapCapabilities(parseJsonArray(readString(row, 'resources_json')));
		const prompts = mapCapabilities(parseJsonArray(readString(row, 'prompts_json')));
		return {
			name,
			title: titleForRow(row),
			description: descriptionForRow(row),
			transport: readTransportKind(row),
			transportSummary: buildTransportSummary(row),
			projectPath: readString(row, 'project_path'),
			projectState: enabled ? 'enabled' : 'default-disabled',
			enabledSource: readString(row, 'enabled_source') === 'explicit' ? 'explicit' : 'default',
			lifecycle,
			tools,
			resources,
			prompts,
			serverInfo: {
				serverName: readString(row, 'server_name'),
				serverVersion: readString(row, 'server_version'),
				protocolVersion: readString(row, 'protocol_version'),
			},
			snapshot,
			snapshotAt: readString(row, 'snapshot_at'),
			latestError,
			blockedProjects: [],
			latestAction: actionFromRow(
				latestError ? 'start' : lifecycle === 'running' ? 'start' : enabled ? 'enable' : 'query',
				latestError ? 'failed' : 'ok',
				latestError ?? (enabled ? 'project projection loaded' : 'default-disabled projection loaded'),
				readString(row, 'updated_at'),
				{ enabled, lifecycle },
			),
			createdAt: readString(row, 'created_at'),
			updatedAt: readString(row, 'updated_at'),
			lastUsedAt: readString(row, 'last_used_at'),
		};
	});

export const markMcpRowAction = (
	rows: readonly McpWorkbenchRow[],
	name: string,
	action: McpWorkbenchActionFact,
	extras: Pick<Partial<McpWorkbenchRow>, 'blockedProjects' | 'latestError'> = {},
): McpWorkbenchRow[] =>
	rows.map((row) =>
		row.name === name
			? {
					...row,
					...extras,
					latestAction: action,
				}
			: row,
	);

export const mcpWorkbenchFixtureRows = [
	{
		name: 'filesystem',
		title: 'Filesystem',
		description: 'Project-scoped file tools.',
		transport: 'stdio',
		transportSummary: {
			kind: 'stdio',
			command: 'bunx',
			args: ['-y', '@modelcontextprotocol/server-filesystem', '.'],
		},
		projectPath: '/repo/app',
		projectState: 'enabled',
		enabledSource: 'explicit',
		lifecycle: 'running',
		tools: [
			{ name: 'read_file', description: 'Read one file from the exact project scope.', schema: { path: 'string' }, raw: { name: 'read_file' } },
			{ name: 'list_directory', description: 'List entries below a project path.', schema: { path: 'string' }, raw: { name: 'list_directory' } },
			{ name: 'search_files', description: 'Search path names inside the project.', schema: { query: 'string' }, raw: { name: 'search_files' } },
		],
		resources: [
			{ name: 'file://README.md', description: 'README resource', schema: null, raw: { uri: 'file://README.md' } },
		],
		prompts: [],
		serverInfo: {
			serverName: 'filesystem',
			serverVersion: '1.0.0',
			protocolVersion: '2025-06-18',
		},
		snapshot: { tools: ['read_file', 'list_directory', 'search_files'] },
		snapshotAt: '2026-06-07 10:18',
		latestError: null,
		blockedProjects: [],
		latestAction: {
			operation: 'call',
			status: 'ok',
			label: 'read_file completed in 44 ms',
			at: '10:21',
			detail: { toolName: 'read_file', result: { ok: true } },
		},
		createdAt: '2026-06-07 09:18',
		updatedAt: '2026-06-07 10:21',
		lastUsedAt: '2026-06-07 10:21',
	},
	{
		name: 'github',
		title: 'GitHub',
		description: 'Remote repository actions.',
		transport: 'streamable-http',
		transportSummary: {
			kind: 'streamable-http',
			url: 'https://mcp.github.example/messages',
		},
		projectPath: '/repo/app',
		projectState: 'default-disabled',
		enabledSource: 'default',
		lifecycle: 'not-started',
		tools: [],
		resources: [],
		prompts: [],
		serverInfo: emptyServerInfo(),
		snapshot: null,
		snapshotAt: null,
		latestError: null,
		blockedProjects: [],
		latestAction: {
			operation: 'add',
			status: 'ok',
			label: 'global config installed',
			at: '09:42',
		},
		createdAt: '2026-06-07 09:42',
		updatedAt: '2026-06-07 09:42',
		lastUsedAt: null,
	},
	{
		name: 'sequential-thinking',
		title: 'Sequential Thinking',
		description: 'Structured reasoning helper.',
		transport: 'stdio',
		transportSummary: {
			kind: 'stdio',
			command: 'bunx',
			args: ['-y', '@modelcontextprotocol/server-sequential-thinking'],
		},
		projectPath: '/repo/app',
		projectState: 'enabled',
		enabledSource: 'explicit',
		lifecycle: 'stopped',
		tools: [{ name: 'sequentialthinking', description: 'Break a problem into explicit thought steps.', schema: null, raw: { name: 'sequentialthinking' } }],
		resources: [],
		prompts: [],
		serverInfo: {
			serverName: 'sequential-thinking',
			serverVersion: '0.1.0',
			protocolVersion: '2025-06-18',
		},
		snapshot: { tools: ['sequentialthinking'] },
		snapshotAt: '2026-06-07 09:33',
		latestError: null,
		blockedProjects: [],
		latestAction: {
			operation: 'stop',
			status: 'ok',
			label: 'project instance stopped',
			at: '09:51',
		},
		createdAt: '2026-06-07 09:30',
		updatedAt: '2026-06-07 09:51',
		lastUsedAt: '2026-06-07 09:51',
	},
	{
		name: 'linear',
		title: 'Linear',
		description: 'Issue and roadmap workflow.',
		transport: 'sse',
		transportSummary: {
			kind: 'sse',
			url: 'https://linear.example/sse',
		},
		projectPath: '/repo/app',
		projectState: 'enabled',
		enabledSource: 'explicit',
		lifecycle: 'failed',
		tools: [],
		resources: [],
		prompts: [],
		serverInfo: emptyServerInfo(),
		snapshot: { error: '401 while initializing SSE transport' },
		snapshotAt: '2026-06-07 08:16',
		latestError: '401 while initializing SSE transport',
		blockedProjects: ['/repo/app'],
		latestAction: {
			operation: 'restart',
			status: 'failed',
			label: 'SSE transport rejected credentials',
			at: '10:03',
		},
		createdAt: '2026-06-07 08:00',
		updatedAt: '2026-06-07 10:03',
		lastUsedAt: null,
	},
] satisfies McpWorkbenchRow[];

export const filterMcpWorkbenchRows = (rows: readonly McpWorkbenchRow[], query: string): readonly McpWorkbenchRow[] => {
	const normalized = query.trim().toLowerCase();
	if (!normalized) {
		return rows;
	}
	return rows.filter((row) =>
		[
			row.name,
			row.title,
			row.transport,
			row.lifecycle,
			row.projectState,
			row.latestError ?? '',
			row.transportSummary.command ?? '',
			row.transportSummary.url ?? '',
		].some((part) => part.toLowerCase().includes(normalized)),
	);
};

export const projectMcpWorkbenchRows = (
	rows: readonly McpWorkbenchRow[],
	projectionMode: McpProjectionMode,
): readonly McpWorkbenchRow[] => {
	if (projectionMode === 'exact-project') {
		return rows;
	}
	return rows.map((row) => ({
		...row,
		projectPath: null,
		projectState: 'default-disabled',
		enabledSource: 'global',
		lifecycle: 'not-started',
		tools: [],
		resources: [],
		prompts: [],
		serverInfo: emptyServerInfo(),
		snapshot: null,
		snapshotAt: null,
		latestError: null,
		blockedProjects: [],
		latestAction: {
			operation: 'add',
			status: 'ok',
			label: 'global config installed',
			at: row.latestAction.at,
		},
	}));
};

export const countEnabledMcpRows = (rows: readonly McpWorkbenchRow[]): number =>
	rows.filter((row) => row.projectState === 'enabled').length;

export const countDefaultDisabledMcpRows = (rows: readonly McpWorkbenchRow[]): number =>
	rows.filter((row) => row.projectState === 'default-disabled').length;

export const countRunningMcpRows = (rows: readonly McpWorkbenchRow[]): number =>
	rows.filter((row) => row.lifecycle === 'running').length;

export const countFailedMcpRows = (rows: readonly McpWorkbenchRow[]): number =>
	rows.filter((row) => row.lifecycle === 'failed').length;
