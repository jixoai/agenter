<script lang="ts">
	import type {
		McpAppServerCloseInput,
		McpAppServerCloseOutput,
		McpAppServerStartInput,
		McpAppServerStartOutput,
	} from '@agenter/client-sdk';
	import { onDestroy } from 'svelte';

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

	const closeSession = (target: McpAppServerStartOutput | null): void => {
		if (!target || closedSessionIds.has(target.sessionId)) {
			return;
		}
		closedSessionIds = new Set([...closedSessionIds, target.sessionId]);
		void onAppServerClose?.({
			avatarNickname: startInput?.avatarNickname,
			sessionId: target.sessionId,
		}).catch(() => undefined);
	};

	$effect(() => {
		const input = startInput;
		const currentRunId = ++runId;
		closeSession(session);
		session = null;
		error = null;
		if (!input) {
			pending = false;
			return;
		}
		pending = true;
		void (async () => {
			try {
				const started = await onAppServerStart(input);
				if (currentRunId !== runId) {
					closeSession(started);
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
			closeSession(session);
		};
	});

	onDestroy(() => {
		runId += 1;
		closeSession(session);
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
