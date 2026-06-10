<script lang="ts">
	import type {
		McpAppServerCloseInput,
		McpAppServerCloseOutput,
		McpAppServerStartInput,
		McpAppServerStartOutput,
	} from '@agenter/client-sdk';
	import { onDestroy, untrack } from 'svelte';

	import { Badge } from '$lib/components/ui/badge/index.js';
	import NoticeBanner from '$lib/components/ui/notice-banner.svelte';

	let {
		startInput,
		title = 'MCP App',
		onAppServerStart,
		onAppServerClose,
	}: {
		startInput: McpAppServerStartInput | null;
		title?: string;
		onAppServerStart: (input: McpAppServerStartInput) => Promise<McpAppServerStartOutput>;
		onAppServerClose?: (input: McpAppServerCloseInput) => Promise<McpAppServerCloseOutput>;
	} = $props();

	let session = $state<McpAppServerStartOutput | null>(null);
	let pending = $state(false);
	let error = $state<string | null>(null);
	let runId = 0;
	let closedSessionIds = new Set<string>();
	let activeAvatarNickname: string | null | undefined;

	const isRecord = (value: unknown): value is Record<string, unknown> =>
		typeof value === 'object' && value !== null && !Array.isArray(value);

	const stableJson = (value: unknown): unknown => {
		if (Array.isArray(value)) {
			return value.map(stableJson);
		}
		if (!isRecord(value)) {
			return value;
		}
		return Object.fromEntries(
			Object.entries(value)
				.sort(([left], [right]) => left.localeCompare(right))
				.map(([key, entry]) => [key, stableJson(entry)]),
		);
	};

	const stableStringify = (value: unknown): string => JSON.stringify(stableJson(value));
	const startKey = $derived(startInput ? stableStringify(startInput) : null);

	const closeSession = (target: McpAppServerStartOutput | null, avatarNickname?: string | null): void => {
		if (!target || closedSessionIds.has(target.sessionId)) {
			return;
		}
		closedSessionIds = new Set([...closedSessionIds, target.sessionId]);
		const closeHandler = untrack(() => onAppServerClose);
		void closeHandler?.({
			avatarNickname: avatarNickname ?? undefined,
			sessionId: target.sessionId,
		}).catch(() => undefined);
	};

	$effect(() => {
		const key = startKey;
		const input = untrack(() => startInput);
		const startHandler = untrack(() => onAppServerStart);
		const previousSession = untrack(() => session);
		const previousAvatarNickname = activeAvatarNickname;
		const currentRunId = ++runId;
		closeSession(previousSession, previousAvatarNickname);
		session = null;
		error = null;
		activeAvatarNickname = input?.avatarNickname;
		if (!key || !input) {
			pending = false;
			return;
		}
		pending = true;
		void (async () => {
			try {
				const started = await startHandler(input);
				if (currentRunId !== runId) {
					closeSession(started, input.avatarNickname);
					return;
				}
				session = started;
			} catch (cause) {
				if (currentRunId === runId) {
					error = cause instanceof Error ? cause.message : String(cause);
				}
			} finally {
				if (currentRunId === runId) {
					pending = false;
				}
			}
		})();
		return () => {
			runId += 1;
			closeSession(untrack(() => session), input.avatarNickname);
		};
	});

	onDestroy(() => {
		runId += 1;
		closeSession(session, activeAvatarNickname);
	});
</script>

{#if startInput}
	<div class="grid min-h-[22rem] gap-2 rounded-lg bg-background p-2" data-testid="mcp-config-inspect-app-preview">
		<div class="flex min-w-0 flex-wrap items-center justify-between gap-2 px-1">
			<div class="min-w-0 truncate text-xs font-medium text-foreground">{title}</div>
			<div class="flex items-center gap-1.5">
				<Badge variant="outline">mcp-app</Badge>
				<Badge variant={session?.state === 'ready' ? 'secondary' : 'outline'}>
					{pending ? 'starting' : (session?.state ?? 'idle')}
				</Badge>
			</div>
		</div>
		{#if error}
			<NoticeBanner tone="destructive" message={error} />
		{:else if session?.hostUrl || session?.hostPath}
			<iframe
				src={session.hostUrl ?? session.hostPath}
				title={`${title} preview`}
				class="min-h-[20rem] w-full rounded-md bg-background"
				data-testid="mcp-config-inspect-app-iframe"
			></iframe>
		{:else}
			<div class="flex min-h-[20rem] items-center justify-center text-xs text-muted-foreground">
				Preparing preview
			</div>
		{/if}
	</div>
{/if}
