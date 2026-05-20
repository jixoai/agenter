<script lang="ts">
	import { goto } from '$app/navigation';

	import { getAppControllerContext } from '$lib/app/controller-context';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import NoticeBanner from '$lib/components/ui/notice-banner.svelte';
	import WorkbenchScaffold from '$lib/features/navigation/workbench-scaffold.svelte';

	const controller = getAppControllerContext();
	const AUTH_REQUIRED_MESSAGE = 'auth token required';

	let terminalId = $state('');
	let processKind = $state('shell');
	let cwd = $state('');
	let createBusy = $state(false);
	let errorMessage = $state<string | null>(null);
	const authReady = $derived(!controller.initializing);
	const isAuthenticated = $derived(Boolean(controller.authSession));
	const showAuthNotice = $derived(authReady && !isAuthenticated);
	const routeErrorMessage = $derived(errorMessage ?? (showAuthNotice ? AUTH_REQUIRED_MESSAGE : null));

	const runtimeEndpointErrorHints = [
		'The string did not match the expected pattern.',
		"Failed to execute 'json' on 'Response': Unexpected end of JSON input",
		'Failed to fetch',
		'fetch failed',
		'NetworkError when attempting to fetch resource.',
	] as const;

	const describeCreateTerminalError = (error: unknown): string => {
		const message = error instanceof Error ? error.message : String(error);
		if (runtimeEndpointErrorHints.some((hint) => message.includes(hint))) {
			return 'Create terminal failed because this Studio cannot reach a healthy agenter runtime endpoint. You are likely on a stale dev server or a proxy that no longer serves `/trpc`. Use the verified `agenter studio --dev` stack or set `PUBLIC_AGENTER_WS_URL` to the live daemon `/trpc` endpoint.';
		}
		return message;
	};

	const handleSubmit = async (event: SubmitEvent): Promise<void> => {
		event.preventDefault();
		if (createBusy) {
			return;
		}
		if (!authReady || !isAuthenticated) {
			errorMessage = AUTH_REQUIRED_MESSAGE;
			return;
		}
		createBusy = true;
		errorMessage = null;
		try {
			const created = await controller.runtimeStore.createGlobalTerminal({
				terminalId: terminalId.trim() || undefined,
				processKind: processKind.trim() || undefined,
				cwd: cwd.trim() || undefined,
			});
			const createdTerminalId = created.terminal?.terminalId;
			if (!createdTerminalId) {
				throw new Error('created terminal id is unavailable');
			}
			await controller.runtimeStore.hydrateGlobalTerminals({ force: true });
			await goto(`/terminals/${encodeURIComponent(createdTerminalId)}`, {
				replaceState: true,
				noScroll: true,
				keepFocus: true,
			});
		} catch (error) {
			errorMessage = describeCreateTerminalError(error);
		} finally {
			createBusy = false;
		}
	};
</script>

<WorkbenchScaffold
	tone="page"
	body="scroll"
	contentClass="mx-auto grid w-full max-w-5xl gap-6"
	data-testid="terminal-create-route"
>
	{#snippet header()}
		<div class="grid gap-2">
			<h2 class="text-base font-semibold">Create terminal</h2>
			<p class="text-sm text-muted-foreground">Open a new global terminal directly from a fixed workbench tab.</p>
		</div>
	{/snippet}

	<form class="grid gap-6 md:max-w-3xl" novalidate onsubmit={handleSubmit}>
		<section class="grid gap-4 rounded-[1rem] border border-border/60 bg-background/45 p-4 md:p-5">
			<label class="grid gap-2 text-sm font-medium">
				<span>Terminal id</span>
				<Input bind:value={terminalId} placeholder="ops-shell" />
			</label>

			<div class="grid gap-4 md:grid-cols-2">
				<label class="grid gap-2 text-sm font-medium">
					<span>Process kind</span>
					<Input bind:value={processKind} placeholder="shell" />
				</label>
				<label class="grid gap-2 text-sm font-medium">
					<span>Working directory</span>
					<Input bind:value={cwd} placeholder="/repo/ops" />
				</label>
			</div>
		</section>

		{#if routeErrorMessage}
			<NoticeBanner tone="destructive" message={routeErrorMessage} />
		{/if}

		<div class="flex justify-end">
			<Button type="submit" disabled={createBusy || !authReady || !isAuthenticated}>
				{createBusy ? 'Creating…' : 'Create terminal'}
			</Button>
		</div>
	</form>
</WorkbenchScaffold>
