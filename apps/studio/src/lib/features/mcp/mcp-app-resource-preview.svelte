<script lang="ts">
	import { Badge } from '$lib/components/ui/badge/index.js';

	type JsonRpcId = string | number | null;
	type JsonRpcMessage = {
		jsonrpc?: unknown;
		id?: unknown;
		method?: unknown;
		params?: unknown;
	};
	type McpAppResource = {
		uri: string;
		mimeType: string;
		html: string;
	};
	type McpAppToolCallRequest = {
		name: string;
		arguments?: Record<string, unknown>;
	};
	type McpAppToolCaller = (input: McpAppToolCallRequest) => Promise<unknown>;

	let {
		resourceResult,
		toolResult = null,
		title = 'MCP App',
		callTool = null,
	}: {
		resourceResult: unknown;
		toolResult?: unknown;
		title?: string;
		callTool?: McpAppToolCaller | null;
	} = $props();

	let iframeElement = $state<HTMLIFrameElement | null>(null);
	let initialized = $state(false);
	let lastAppMessage = $state<string | null>(null);

	const isRecord = (value: unknown): value is Record<string, unknown> =>
		typeof value === 'object' && value !== null && !Array.isArray(value);

	const readString = (value: unknown, key: string): string | null => {
		if (!isRecord(value)) {
			return null;
		}
		const candidate = value[key];
		return typeof candidate === 'string' && candidate.trim().length > 0 ? candidate : null;
	};

	const decodeBase64 = (source: string): string | null => {
		try {
			return atob(source);
		} catch {
			return null;
		}
	};

	const isMcpAppMimeType = (mimeType: string | null): mimeType is string =>
		typeof mimeType === 'string' &&
		mimeType
			.toLowerCase()
			.split(';')
			.map((part) => part.trim())
			.includes('profile=mcp-app');

	const normalizeResourceContent = (value: unknown): McpAppResource | null => {
		const resource = isRecord(value) && isRecord(value.resource) ? value.resource : value;
		const mimeType = readString(resource, 'mimeType');
		if (!isMcpAppMimeType(mimeType)) {
			return null;
		}
		const text = readString(resource, 'text');
		const blob = readString(resource, 'blob');
		const html = text ?? (blob ? decodeBase64(blob) : null);
		if (!html) {
			return null;
		}
		return {
			uri: readString(resource, 'uri') ?? 'ui://unknown/app',
			mimeType,
			html,
		};
	};

	const resolveMcpAppResource = (value: unknown): McpAppResource | null => {
		if (!isRecord(value) || !Array.isArray(value.contents)) {
			return null;
		}
		for (const content of value.contents) {
			const resource = normalizeResourceContent(content);
			if (resource) {
				return resource;
			}
		}
		return null;
	};

	const appResource = $derived(resolveMcpAppResource(resourceResult));

	const readJsonRpcId = (value: unknown): JsonRpcId | undefined => {
		if (typeof value === 'string' || typeof value === 'number') {
			return value;
		}
		return value === null ? null : undefined;
	};

	const postToApp = (message: Record<string, unknown>): void => {
		if (!iframeElement?.contentWindow) {
			return;
		}
		iframeElement.contentWindow.postMessage(message, '*');
	};
	const postJsonRpcResult = (id: JsonRpcId, result: unknown): void => {
		postToApp({
			jsonrpc: '2.0',
			id,
			result,
		});
	};
	const postJsonRpcError = (id: JsonRpcId, message: string): void => {
		postToApp({
			jsonrpc: '2.0',
			id,
			error: {
				code: -32000,
				message,
			},
		});
	};
	const readToolCallRequest = (params: unknown): McpAppToolCallRequest | null => {
		if (!isRecord(params)) {
			return null;
		}
		const name = readString(params, 'name') ?? readString(params, 'toolName');
		if (!name) {
			return null;
		}
		const argumentsValue = params.arguments ?? params.args;
		return {
			name,
			arguments: isRecord(argumentsValue) ? argumentsValue : undefined,
		};
	};

	const handleInitialize = (message: JsonRpcMessage): void => {
		const id = readJsonRpcId(message.id);
		if (id === undefined) {
			return;
		}
		postJsonRpcResult(id, {
			protocolVersion: '2026-01-26',
			hostInfo: {
				name: 'agenter-studio',
				title: 'Agenter Studio',
				version: '0.0.0',
			},
			hostCapabilities: {
				serverTools: {},
				serverResources: {},
				sandbox: {},
			},
			hostContext: {
				theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light',
				displayMode: 'inline',
				availableDisplayModes: ['inline'],
				userAgent: 'agenter-studio',
				platform: 'web',
			},
		});
		initialized = true;
		if (toolResult !== null) {
			postToApp({
				jsonrpc: '2.0',
				method: 'ui/notifications/tool-result',
				params: toolResult,
			});
		}
	};

	const handleToolCall = async (message: JsonRpcMessage): Promise<void> => {
		const id = readJsonRpcId(message.id);
		if (id === undefined) {
			return;
		}
		if (!callTool) {
			postJsonRpcError(id, 'MCP App tool calls are unavailable in this preview');
			return;
		}
		const request = readToolCallRequest(message.params);
		if (!request) {
			postJsonRpcError(id, 'tools/call requires a tool name');
			return;
		}
		try {
			const result = await callTool(request);
			postJsonRpcResult(id, result);
			postToApp({
				jsonrpc: '2.0',
				method: 'ui/notifications/tool-result',
				params: result,
			});
		} catch (error) {
			postJsonRpcError(id, error instanceof Error ? error.message : String(error));
		}
	};

	$effect(() => {
		const iframe = iframeElement;
		if (!iframe || !appResource) {
			return;
		}
		initialized = false;
		lastAppMessage = null;
		const handleMessage = (event: MessageEvent<unknown>): void => {
			if (event.source !== iframe.contentWindow || !isRecord(event.data)) {
				return;
			}
			const message = event.data as JsonRpcMessage;
			const method = typeof message.method === 'string' ? message.method : null;
			if (!method) {
				return;
			}
			lastAppMessage = method;
			if (method === 'ui/initialize') {
				handleInitialize(message);
			} else if (method === 'tools/call') {
				void handleToolCall(message);
			} else if (method === 'ui/request-display-mode') {
				const id = readJsonRpcId(message.id);
				if (id !== undefined) {
					postJsonRpcResult(id, { displayMode: 'inline' });
				}
			}
		};
		window.addEventListener('message', handleMessage);
		return () => {
			window.removeEventListener('message', handleMessage);
		};
	});
</script>

{#if appResource}
	<div class="grid min-h-[22rem] gap-2 rounded-lg bg-background p-2" data-testid="mcp-config-inspect-app-preview">
		<div class="flex min-w-0 flex-wrap items-center justify-between gap-2 px-1">
			<div class="min-w-0 truncate text-xs font-medium text-foreground">{title}</div>
			<div class="flex items-center gap-1.5">
				<Badge variant="outline">mcp-app</Badge>
				<Badge variant={initialized ? 'secondary' : 'outline'}>{initialized ? 'host' : 'sandbox'}</Badge>
			</div>
		</div>
		<iframe
			bind:this={iframeElement}
			srcdoc={appResource.html}
			title={`${title} preview`}
			sandbox="allow-scripts allow-forms allow-popups allow-downloads"
			referrerpolicy="no-referrer"
			class="min-h-[20rem] w-full rounded-md border border-border/50 bg-background"
			data-testid="mcp-config-inspect-app-iframe"
		></iframe>
		{#if lastAppMessage && lastAppMessage !== 'ui/initialize'}
			<div class="px-1 font-mono text-[11px] text-muted-foreground">{lastAppMessage}</div>
		{/if}
	</div>
{/if}
