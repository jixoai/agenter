<script lang="ts">
	import FileClockIcon from '@lucide/svelte/icons/file-clock';
	import SendHorizontalIcon from '@lucide/svelte/icons/send-horizontal';
	import ShieldUserIcon from '@lucide/svelte/icons/shield-user';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import { resolveAsyncSurfaceState, type ToolInvocationView } from '@agenter/web-components';
	import { tick } from 'svelte';

	import { ClipSurface, Scaffold, SplitView } from '@agenter/svelte-components';
	import ProfileAvatar from '$lib/components/profile-avatar.svelte';
	import AsyncSurface from '$lib/components/web-components/async-surface.svelte';
	import HelpHint from '$lib/components/web-components/help-hint.svelte';
	import ToolInvocationCard from '$lib/components/web-components/tool-invocation-card.svelte';
	import WorkbenchScaffold from '$lib/features/navigation/workbench-scaffold.svelte';
	import NoticeBanner from '$lib/components/ui/notice-banner.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import * as Tabs from '$lib/components/ui/tabs/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';

	import type { TerminalSystemSurfaceProps } from './terminal-system-surface.types';
	import { resolveTerminalUsersPaneLayout } from './terminal-system-surface-layout';

	let {
		selectedTerminal,
		terminalViewportComponent,
		terminalGrantsState,
		terminalApprovalsState,
		terminalActivityState,
		routeNotice,
		selectableActors,
		callAsOptions,
		selectedCallerToken,
		seatStates,
		onChangeCallerToken,
		onDeleteTerminal,
		onGrantSeat,
		onToggleSeatFocus,
		onRevokeSeat,
		onApproveRequest,
		onDenyRequest,
		onWriteToolCall,
		onReadToolCall,
	}: TerminalSystemSurfaceProps = $props();

	let deleteBusy = $state(false);
	let actionToolTab: 'write' | 'read' = $state('write');
	let sidePanelTab: 'actions' | 'users' = $state('actions');
	let grantParticipantId = $state('');
	let grantRole: 'admin' | 'writer' | 'requester' | 'readonly' = $state('writer');
	let grantBusy = $state(false);
	let grantError: string | null = $state(null);
	let writeText = $state('');
	let writeBusy = $state(false);
	let readMode: 'auto' | 'diff' | 'snapshot' = $state('snapshot');
	let readBusy = $state(false);
	let actionsPanelRef: HTMLElement | null = $state(null);
	let usersPanelRef = $state<HTMLElement | null>(null);
	let usersPanelWidth = $state(0);

	const actionEvents = $derived.by(() =>
		[...terminalActivityState.data].sort((left, right) => {
			if (left.createdAt !== right.createdAt) {
				return right.createdAt - left.createdAt;
			}
			return right.id - left.id;
		}),
	);
	const actionsSurfaceState = $derived(
		resolveAsyncSurfaceState({
			loading: terminalActivityState.loading && !terminalActivityState.loaded,
			hasData: actionEvents.length > 0,
		}),
	);
	const effectiveCallerToken = $derived(selectedCallerToken ?? callAsOptions[0]?.accessToken ?? null);
	const TerminalViewport = $derived(terminalViewportComponent);
	const callAsItems = $derived(
		callAsOptions.map((option) => ({
			value: option.accessToken,
			label: `${option.label} · ${option.role}`,
		})),
	);
	const selectedCallAsLabel = $derived(
		callAsItems.find((item) => item.value === effectiveCallerToken)?.label ??
			(callAsItems[0]?.label ?? 'No seat token'),
	);
	const readModeItems: { value: 'auto' | 'diff' | 'snapshot'; label: string }[] = [
		{ value: 'auto', label: 'auto' },
		{ value: 'diff', label: 'diff' },
		{ value: 'snapshot', label: 'snapshot' },
	];
	const selectedReadModeLabel = $derived(
		readModeItems.find((item) => item.value === readMode)?.label ?? 'snapshot',
	);
	const grantActorItems = $derived([
		{ value: '', label: 'Select actor' },
		...selectableActors.map((actor) => ({
			value: actor.actorId,
			label: `${actor.label} · ${actor.subtitle ?? actor.actorId}`,
		})),
	]);
	const selectedGrantActorLabel = $derived(
		grantActorItems.find((item) => item.value === grantParticipantId)?.label ?? 'Select actor',
	);
	const grantRoleItems: { value: 'admin' | 'writer' | 'requester' | 'readonly'; label: string }[] = [
		{ value: 'writer', label: 'writer' },
		{ value: 'requester', label: 'requester' },
		{ value: 'readonly', label: 'readonly' },
		{ value: 'admin', label: 'admin' },
	];
	const selectedGrantRoleLabel = $derived(
		grantRoleItems.find((item) => item.value === grantRole)?.label ?? 'writer',
	);
	const latestActionEventId = $derived(actionEvents[0]?.id ?? null);
	const usersPaneCompact = $derived(resolveTerminalUsersPaneLayout(usersPanelWidth) === 'compact');

	const formatTimestamp = (value?: number): string => {
		if (!value) {
			return 'unknown';
		}
		return new Date(value).toLocaleString();
	};

	const stringifyDetail = (value: unknown): string | null => {
		if (value === undefined) {
			return null;
		}
		if (typeof value === 'string') {
			return value;
		}
		try {
			return JSON.stringify(value, null, 2);
		} catch {
			return String(value);
		}
	};

	const handleDeleteTerminal = async (): Promise<void> => {
		if (!selectedTerminal || deleteBusy) {
			return;
		}
		deleteBusy = true;
		try {
			await onDeleteTerminal();
		} finally {
			deleteBusy = false;
		}
	};

	const handleGrantSeat = async (): Promise<void> => {
		if (!selectedTerminal || grantBusy || grantParticipantId.length === 0) {
			return;
		}
		grantBusy = true;
		grantError = null;
		try {
			await onGrantSeat({
				participantId: grantParticipantId,
				role: grantRole,
			});
			grantParticipantId = '';
		} catch (error) {
			grantError = error instanceof Error ? error.message : String(error);
		} finally {
			grantBusy = false;
		}
	};

	const handleWriteToolCall = async (): Promise<void> => {
		if (!selectedTerminal || !effectiveCallerToken || !writeText.trim() || writeBusy) {
			return;
		}
		writeBusy = true;
		try {
			await onWriteToolCall({ text: writeText });
			writeText = '';
		} finally {
			writeBusy = false;
		}
	};

	const handleReadToolCall = async (): Promise<void> => {
		if (!selectedTerminal || !effectiveCallerToken || readBusy) {
			return;
		}
		readBusy = true;
		try {
			await onReadToolCall({ mode: readMode });
		} finally {
			readBusy = false;
		}
	};

	const resolveActionToolName = (kind: string): string => {
		if (kind === 'terminal_write') {
			return 'terminal.write';
		}
		if (kind === 'terminal_read') {
			return 'terminal.read';
		}
		return kind;
	};

	const toActionInvocation = (
		event: TerminalSystemSurfaceProps['terminalActivityState']['data'][number],
	): ToolInvocationView => {
		const detailText = stringifyDetail(event.detail);
		if (event.kind === 'terminal_read') {
			return {
				invocationId: `${event.terminalId}:${event.id}`,
				toolName: resolveActionToolName(event.kind),
				status: 'success',
				call: {
					value:
						event.detail && typeof event.detail === 'object' && !Array.isArray(event.detail)
							? { mode: (event.detail as { mode?: string }).mode ?? 'snapshot' }
							: { mode: 'snapshot' },
				},
				result: {
					value: event.detail ?? event.content,
					rawText: detailText ?? event.content,
				},
				meta: {
					title: event.title,
					actorId: event.actorId,
				},
				startedAt: event.createdAt,
				finishedAt: event.createdAt,
			};
		}
		return {
			invocationId: `${event.terminalId}:${event.id}`,
			toolName: resolveActionToolName(event.kind),
			status: 'success',
			call: {
				value:
					event.detail && typeof event.detail === 'object' && !Array.isArray(event.detail)
						? {
								text: event.content,
								...(event.detail as Record<string, unknown>),
							}
						: { text: event.content },
				rawText: event.content,
			},
			meta: {
				title: event.title,
				actorId: event.actorId,
			},
			startedAt: event.createdAt,
			finishedAt: event.createdAt,
		};
	};

	$effect(() => {
		const actionEventId = latestActionEventId;
		if (sidePanelTab !== 'actions' || !actionsPanelRef || actionEventId === null) {
			return;
		}

		void tick().then(() => {
			const viewport = actionsPanelRef?.querySelector<HTMLElement>('[data-scroll-view-viewport]');
			viewport?.scrollTo({ top: 0, behavior: 'auto' });
		});
	});

	$effect(() => {
		const element = usersPanelRef;
		if (!element) {
			return;
		}

		let frame = 0;
		const scheduleWidthCommit = (nextWidth: number): void => {
			if (frame !== 0) {
				cancelAnimationFrame(frame);
			}
			frame = requestAnimationFrame(() => {
				frame = 0;
				if (nextWidth !== usersPanelWidth) {
					usersPanelWidth = nextWidth;
				}
			});
		};

		if (typeof ResizeObserver === 'undefined') {
			scheduleWidthCommit(Math.round(element.clientWidth));
			return () => {
				if (frame !== 0) {
					cancelAnimationFrame(frame);
				}
			};
		}

		const observer = new ResizeObserver((entries) => {
			const nextWidth = Math.round(entries[0]?.contentRect.width ?? element.clientWidth ?? 0);
			scheduleWidthCommit(nextWidth);
		});
		observer.observe(element);
		scheduleWidthCommit(Math.round(element.clientWidth));
		return () => {
			if (frame !== 0) {
				cancelAnimationFrame(frame);
			}
			observer.disconnect();
		};
	});
</script>

{#snippet terminalStagePanel()}
	<WorkbenchScaffold tone="pane" bodyClass="p-4">
		{#snippet header()}
			<div class="flex flex-wrap items-center justify-between gap-3">
				<div class="min-w-0">
					<h2 class="text-base font-semibold">{selectedTerminal?.terminalId ?? 'Terminal view'}</h2>
					<p class="text-sm text-muted-foreground">
						{selectedTerminal?.cwd ?? 'Select one terminal tab to inspect its shared runtime.'}
					</p>
					{#if selectedTerminal?.title && selectedTerminal.title !== selectedTerminal.terminalId}
						<div class="text-xs text-muted-foreground">{selectedTerminal.title}</div>
					{/if}
				</div>
				<Button
					variant="outline"
					size="icon-sm"
					class="shrink-0"
					disabled={!selectedTerminal || deleteBusy}
					onclick={() => void handleDeleteTerminal()}
					aria-label="Delete terminal"
				>
					<Trash2Icon class="size-4" />
				</Button>
			</div>
			{#if routeNotice}
				<NoticeBanner tone={routeNotice.tone} message={routeNotice.message} />
			{/if}
		{/snippet}

		{#if selectedTerminal}
			<div class="grid gap-3 lg:h-full lg:grid-rows-[minmax(0,1fr)_auto]">
				<ClipSurface class="rounded-2xl border bg-slate-950 text-white">
					<TerminalViewport
						class="block h-full min-h-[22rem] w-full"
						terminalId={selectedTerminal.terminalId}
						terminalTitle={selectedTerminal.title}
						cwd={selectedTerminal.cwd}
						status={selectedTerminal.status}
						viewportMode="fit"
						transportUrl={selectedTerminal.transportUrl}
						snapshot={selectedTerminal.snapshot ?? null}
					/>
				</ClipSurface>
				<div class="grid gap-2 text-xs text-muted-foreground">
					<div>Absolute cwd: {selectedTerminal.cwd}</div>
					<div>Process kind: {selectedTerminal.processKind}</div>
					<div>Renderer: {selectedTerminal.rendererEngine ?? 'xterm'}</div>
				</div>
			</div>
		{:else}
			<div class="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
				Select a terminal tab.
			</div>
		{/if}

		{#snippet footer()}
			<Tabs.Root bind:value={actionToolTab}>
				<Tabs.List class="grid w-full grid-cols-2">
					<Tabs.Trigger value="write">Write</Tabs.Trigger>
					<Tabs.Trigger value="read">Read</Tabs.Trigger>
				</Tabs.List>

				<Tabs.Content value="write" class="mt-3 grid gap-3">
					<div class="grid gap-3 xl:grid-cols-[14rem_minmax(0,1fr)_auto]">
						<Select.Root
							type="single"
							items={callAsItems}
							value={effectiveCallerToken ?? undefined}
							disabled={callAsItems.length === 0}
							onValueChange={(value) => {
								onChangeCallerToken(value);
							}}
						>
							<Select.Trigger aria-label="Call tool as" class="w-full">
								{selectedCallAsLabel}
							</Select.Trigger>
							<Select.Content>
								{#each callAsItems as item (item.value)}
									<Select.Item value={item.value} label={item.label}>{item.label}</Select.Item>
								{/each}
							</Select.Content>
						</Select.Root>
						<Textarea bind:value={writeText} class="min-h-24" placeholder="Type terminal input…" />
						<Button
							class="shrink-0 self-start xl:justify-self-end"
							disabled={!selectedTerminal || !effectiveCallerToken || !writeText.trim() || writeBusy}
							onclick={() => void handleWriteToolCall()}
						>
							<SendHorizontalIcon class="size-4" />
							Call tool
						</Button>
					</div>
				</Tabs.Content>

				<Tabs.Content value="read" class="mt-3 grid gap-3">
					<div class="grid gap-3 xl:grid-cols-[minmax(0,1fr)_12rem_auto]">
						<Select.Root
							type="single"
							items={callAsItems}
							value={effectiveCallerToken ?? undefined}
							disabled={callAsItems.length === 0}
							onValueChange={(value) => {
								onChangeCallerToken(value);
							}}
						>
							<Select.Trigger aria-label="Call tool as" class="w-full">
								{selectedCallAsLabel}
							</Select.Trigger>
							<Select.Content>
								{#each callAsItems as item (item.value)}
									<Select.Item value={item.value} label={item.label}>{item.label}</Select.Item>
								{/each}
							</Select.Content>
						</Select.Root>
						<Select.Root
							type="single"
							items={readModeItems}
							value={readMode}
							onValueChange={(value) => {
								readMode = value as typeof readMode;
							}}
						>
							<Select.Trigger aria-label="Read mode" class="w-full">
								{selectedReadModeLabel}
							</Select.Trigger>
							<Select.Content>
								{#each readModeItems as item (item.value)}
									<Select.Item value={item.value} label={item.label}>{item.label}</Select.Item>
								{/each}
							</Select.Content>
						</Select.Root>
						<Button
							class="shrink-0 self-start xl:justify-self-end"
							disabled={!selectedTerminal || !effectiveCallerToken || readBusy}
							onclick={() => void handleReadToolCall()}
						>
							<FileClockIcon class="size-4" />
							Call read
						</Button>
					</div>
				</Tabs.Content>
			</Tabs.Root>
		{/snippet}
	</WorkbenchScaffold>
{/snippet}

{#snippet terminalActivityPanel()}
	<WorkbenchScaffold tone="pane">
		{#snippet header()}
			<h2 class="text-base font-semibold">Actions + Users</h2>
			<div class="flex items-center gap-2 text-sm text-muted-foreground">
				<span>Activity and seat access.</span>
				<HelpHint textContext="terminal actions render as tool facts while users owns seat authorization and per-seat focus.">
					<p>Actions render through the shared tool invocation surface so reads and writes follow one factual shape.</p>
				</HelpHint>
			</div>
		{/snippet}

		<Tabs.Root bind:value={sidePanelTab} class="grid h-full grid-rows-[auto_minmax(0,1fr)]">
			<Tabs.List class="mx-4 mt-4 grid grid-cols-2">
				<Tabs.Trigger value="actions">Actions</Tabs.Trigger>
				<Tabs.Trigger value="users">Users</Tabs.Trigger>
			</Tabs.List>

			<Tabs.Content value="actions" class="h-full" bind:ref={actionsPanelRef}>
				<AsyncSurface
					class="h-full"
					state={actionsSurfaceState}
					emptyLoadingLabel="Loading terminal actions…"
					loadingOverlayLabel="Refreshing terminal actions…"
				>
					{#snippet empty()}
						{#if terminalActivityState.error && terminalActivityState.data.length === 0}
							<div class="rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
								{terminalActivityState.error}
							</div>
						{:else}
							<div class="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
								No terminal actions yet.
							</div>
						{/if}
					{/snippet}

					<Scaffold.ScrollBody contentClass="grid gap-3 p-4">
						{#each actionEvents as event (event.id)}
							<div class="grid gap-3 rounded-2xl border p-3">
								<div class="flex items-center gap-3">
									<ProfileAvatar
										label={seatStates.find((seat) => seat.actorId === event.actorId)?.label ?? event.actorId ?? event.terminalId}
										src={seatStates.find((seat) => seat.actorId === event.actorId)?.iconUrl}
										class="size-8"
									/>
									<div class="min-w-0">
										<div class="truncate text-sm font-semibold">
											{seatStates.find((seat) => seat.actorId === event.actorId)?.label ??
												event.actorId ??
												event.terminalId}
										</div>
										<div class="truncate text-xs text-muted-foreground">
											{event.title} · {formatTimestamp(event.createdAt)}
										</div>
									</div>
								</div>
								<ToolInvocationCard invocation={toActionInvocation(event)} />
							</div>
						{/each}
					</Scaffold.ScrollBody>
				</AsyncSurface>
			</Tabs.Content>

				<Tabs.Content
					value="users"
					bind:ref={usersPanelRef}
					class={usersPaneCompact ? 'grid gap-4 p-4' : 'h-full'}
				>
					{#if usersPaneCompact}
						<div class="grid gap-4">
							<div class="relative z-10 grid gap-2">
								<div class="text-xs uppercase tracking-[0.18em] text-muted-foreground">Grant access</div>
								<Select.Root
									type="single"
									items={grantActorItems}
									value={grantParticipantId}
									onValueChange={(value) => {
										grantParticipantId = value;
									}}
								>
									<Select.Trigger aria-label="Grant actor" class="w-full">
										{selectedGrantActorLabel}
									</Select.Trigger>
									<Select.Content>
										{#each grantActorItems as item (item.value)}
											<Select.Item value={item.value} label={item.label}>{item.label}</Select.Item>
										{/each}
									</Select.Content>
								</Select.Root>
								<Select.Root
									type="single"
									items={grantRoleItems}
									value={grantRole}
									onValueChange={(value) => {
										grantRole = value as typeof grantRole;
									}}
								>
									<Select.Trigger aria-label="Grant role" class="w-full">
										{selectedGrantRoleLabel}
									</Select.Trigger>
									<Select.Content>
										{#each grantRoleItems as item (item.value)}
											<Select.Item value={item.value} label={item.label}>{item.label}</Select.Item>
										{/each}
									</Select.Content>
								</Select.Root>
								<Button
									class="relative z-10"
									disabled={!selectedTerminal || !grantParticipantId || grantBusy}
									onclick={() => void handleGrantSeat()}
								>
									<ShieldUserIcon class="size-4" />
									Grant seat
								</Button>
								{#if grantError}
									<NoticeBanner tone="destructive" message={grantError} />
								{/if}
							</div>

							{#if terminalApprovalsState.data.length}
								<div class="grid gap-2 rounded-2xl border border-amber-300 bg-amber-50/60 p-3">
									<div class="text-sm font-semibold">Pending approvals</div>
									{#each terminalApprovalsState.data as approval (approval.requestId)}
										<div class="rounded-xl border border-amber-200 bg-white/80 p-3">
											<div class="text-sm font-semibold">{approval.participantId}</div>
											<div class="mt-1 text-xs text-muted-foreground">
												{approval.requestedInput?.text ?? 'write request'} · expires {formatTimestamp(approval.expiresAt)}
											</div>
											<div class="mt-3 flex flex-wrap gap-2">
												<Button
													size="sm"
													onclick={() =>
														void onApproveRequest({ requestId: approval.requestId, durationMs: 30 * 60 * 1000 })}
												>
													Approve 30m
												</Button>
												<Button
													size="sm"
													variant="outline"
													onclick={() => void onDenyRequest({ requestId: approval.requestId })}
												>
													Deny
												</Button>
											</div>
										</div>
									{/each}
								</div>
							{/if}

							<div class="grid gap-3">
								{#each seatStates as seat (seat.actorId)}
									<div class="rounded-2xl border p-3">
										<div class="flex items-start justify-between gap-3">
											<div class="flex items-center gap-3">
												<ProfileAvatar label={seat.label} src={seat.iconUrl} class="size-9" />
												<div>
													<div class="text-sm font-semibold">{seat.label}</div>
													<div class="text-xs text-muted-foreground">{seat.subtitle ?? seat.actorId}</div>
												</div>
											</div>
											<div class="text-xs text-muted-foreground">{seat.role}</div>
										</div>
										<div class="mt-3 flex flex-wrap gap-2">
											<Button
												size="sm"
												variant="outline"
												disabled={!seat.accessToken}
												onclick={() =>
													seat.accessToken
														? void onToggleSeatFocus({
																actorId: seat.actorId,
																accessToken: seat.accessToken,
																focused: seat.focused,
															})
														: undefined}
											>
												{seat.focused ? 'Unfocus' : 'Focus'}
											</Button>
											{#if seat.grantId}
												<Button size="sm" variant="outline" onclick={() => void onRevokeSeat({ actorId: seat.actorId, grantId: seat.grantId! })}>
													Revoke
												</Button>
											{/if}
										</div>
										{#if seat.leaseExpiresAt}
											<div class="mt-2 text-xs text-muted-foreground">
												Lease until {formatTimestamp(seat.leaseExpiresAt)}
											</div>
										{/if}
									</div>
								{/each}
							</div>
						</div>
					{:else}
						<Scaffold.Root class="h-full gap-4 p-4">
							<Scaffold.Header class="grid gap-4 border-b-0 p-0">
								<div class="grid gap-2 xl:grid-cols-[minmax(0,1fr)_10rem_auto]">
									<Select.Root
										type="single"
										items={grantActorItems}
										value={grantParticipantId}
										onValueChange={(value) => {
											grantParticipantId = value;
										}}
									>
										<Select.Trigger aria-label="Grant actor" class="w-full">
											{selectedGrantActorLabel}
										</Select.Trigger>
										<Select.Content>
											{#each grantActorItems as item (item.value)}
												<Select.Item value={item.value} label={item.label}>{item.label}</Select.Item>
											{/each}
										</Select.Content>
									</Select.Root>

									<Select.Root
										type="single"
										items={grantRoleItems}
										value={grantRole}
										onValueChange={(value) => {
											grantRole = value as typeof grantRole;
										}}
									>
										<Select.Trigger aria-label="Grant role" class="w-full">
											{selectedGrantRoleLabel}
										</Select.Trigger>
										<Select.Content>
											{#each grantRoleItems as item (item.value)}
												<Select.Item value={item.value} label={item.label}>{item.label}</Select.Item>
											{/each}
										</Select.Content>
									</Select.Root>

									<Button
										class="xl:justify-self-end"
										disabled={!selectedTerminal || !grantParticipantId || grantBusy}
										onclick={() => void handleGrantSeat()}
									>
										<ShieldUserIcon class="size-4" />
										Grant seat
									</Button>
								</div>
								{#if grantError}
									<NoticeBanner tone="destructive" message={grantError} />
								{/if}
							</Scaffold.Header>

							<Scaffold.ScrollBody contentClass="grid gap-3">
								{#if terminalApprovalsState.data.length}
									<div class="grid gap-2 rounded-2xl border border-amber-300 bg-amber-50/60 p-3">
										<div class="text-sm font-semibold">Pending approvals</div>
										{#each terminalApprovalsState.data as approval (approval.requestId)}
											<div class="rounded-xl border border-amber-200 bg-white/80 p-3">
												<div class="text-sm font-semibold">{approval.participantId}</div>
												<div class="mt-1 text-xs text-muted-foreground">
													{approval.requestedInput?.text ?? 'write request'} · expires {formatTimestamp(approval.expiresAt)}
												</div>
												<div class="mt-3 flex flex-wrap gap-2">
													<Button
														size="sm"
														onclick={() =>
															void onApproveRequest({ requestId: approval.requestId, durationMs: 30 * 60 * 1000 })}
													>
														Approve 30m
													</Button>
													<Button
														size="sm"
														variant="outline"
														onclick={() => void onDenyRequest({ requestId: approval.requestId })}
													>
														Deny
													</Button>
												</div>
											</div>
										{/each}
									</div>
								{/if}

								{#each seatStates as seat (seat.actorId)}
									<div class="rounded-2xl border p-3">
										<div class="flex items-center justify-between gap-3">
											<div class="flex min-w-0 items-center gap-3">
												<ProfileAvatar label={seat.label} src={seat.iconUrl} class="size-9" />
												<div class="min-w-0">
													<div class="truncate text-sm font-semibold">{seat.label}</div>
													<div class="truncate text-xs text-muted-foreground">{seat.subtitle ?? seat.actorId}</div>
												</div>
											</div>
											<div class="text-xs text-muted-foreground">{seat.role}</div>
										</div>
										<div class="mt-3 flex flex-wrap gap-2">
											<Button
												size="sm"
												variant="outline"
												disabled={!seat.accessToken}
												onclick={() =>
													seat.accessToken
														? void onToggleSeatFocus({
																actorId: seat.actorId,
																accessToken: seat.accessToken,
																focused: seat.focused,
															})
														: undefined}
											>
												{seat.focused ? 'Unfocus' : 'Focus'}
											</Button>
											{#if seat.grantId}
												<Button
													size="sm"
													variant="outline"
													onclick={() => void onRevokeSeat({ actorId: seat.actorId, grantId: seat.grantId! })}
												>
													Revoke
												</Button>
											{/if}
										</div>
										{#if seat.leaseExpiresAt}
											<div class="mt-2 text-xs text-muted-foreground">
												Lease until {formatTimestamp(seat.leaseExpiresAt)}
											</div>
										{/if}
									</div>
								{/each}
							</Scaffold.ScrollBody>
						</Scaffold.Root>
					{/if}
				</Tabs.Content>
		</Tabs.Root>
	</WorkbenchScaffold>
{/snippet}

<SplitView.Root variant="content-detail" padding="none" data-testid="terminal-system-surface">
	<SplitView.Content>
		{#if selectedTerminal}
			{@render terminalStagePanel()}
		{:else}
			<div class="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
				Select a terminal tab.
			</div>
		{/if}
	</SplitView.Content>

	<SplitView.Detail>
		{@render terminalActivityPanel()}
	</SplitView.Detail>
</SplitView.Root>
