<script lang="ts">
	import FileClockIcon from '@lucide/svelte/icons/file-clock';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import SendHorizontalIcon from '@lucide/svelte/icons/send-horizontal';
	import ShieldUserIcon from '@lucide/svelte/icons/shield-user';
	import TerminalSquareIcon from '@lucide/svelte/icons/terminal-square';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';

	import ProfileAvatar from '$lib/components/profile-avatar.svelte';
	import ScrollView from '$lib/components/scroll-view.svelte';
	import TerminalViewHost from '$lib/components/terminal-view-host.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '$lib/components/ui/card/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import * as NativeSelect from '$lib/components/ui/native-select/index.js';
	import { Tabs, TabsContent, TabsList, TabsTrigger } from '$lib/components/ui/tabs/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';

	import type { TerminalSystemSurfaceProps } from './terminal-system-surface.types';

	let {
		terminalsState,
		selectedTerminalId,
		selectedTerminal,
		terminalGrantsState,
		terminalApprovalsState,
		terminalActivityState,
		routeNotice,
		selectableActors,
		callAsOptions,
		selectedCallerToken,
		seatStates,
		onSelectTerminal,
		onChangeCallerToken,
		onCreateTerminal,
		onDeleteTerminal,
		onGrantSeat,
		onToggleSeatFocus,
		onRevokeSeat,
		onApproveRequest,
		onDenyRequest,
		onWriteToolCall,
		onReadToolCall,
	}: TerminalSystemSurfaceProps = $props();

	let createDialogOpen = $state(false);
	let createTerminalId = $state('');
	let createProcessKind = $state('shell');
	let createCwd = $state('');
	let createBusy = $state(false);
	let createError = $state<string | null>(null);
	let deleteBusy = $state(false);
	let actionToolTab = $state<'write' | 'read'>('write');
	let sidePanelTab = $state<'actions' | 'users'>('actions');
	let grantParticipantId = $state('');
	let grantRole = $state<'admin' | 'writer' | 'requester' | 'readonly'>('writer');
	let grantBusy = $state(false);
	let grantError = $state<string | null>(null);
	let writeText = $state('');
	let writeBusy = $state(false);
	let readMode = $state<'auto' | 'diff' | 'snapshot'>('snapshot');
	let readBusy = $state(false);

	const actionEvents = $derived.by(() => [...terminalActivityState.data].reverse());
	const effectiveCallerToken = $derived(selectedCallerToken ?? callAsOptions[0]?.accessToken ?? null);

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

	const resetCreateDialog = (): void => {
		createTerminalId = '';
		createProcessKind = 'shell';
		createCwd = '';
		createError = null;
	};

	const openCreateDialog = (): void => {
		resetCreateDialog();
		createDialogOpen = true;
	};

	const handleCreateTerminal = async (event: SubmitEvent): Promise<void> => {
		event.preventDefault();
		if (createBusy) {
			return;
		}
		createBusy = true;
		createError = null;
		try {
			await onCreateTerminal({
				terminalId: createTerminalId.trim() || undefined,
				processKind: createProcessKind.trim() || undefined,
				cwd: createCwd.trim() || undefined,
			});
			createDialogOpen = false;
			resetCreateDialog();
		} catch (error) {
			createError = error instanceof Error ? error.message : String(error);
		} finally {
			createBusy = false;
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
</script>

<div class="grid h-full gap-4 p-4 xl:grid-cols-[18rem_minmax(0,1fr)] 2xl:grid-cols-[18rem_minmax(0,1fr)_24rem] md:p-6">
	<Card class="min-h-0 min-w-0 py-0">
		<CardHeader class="gap-2 border-b">
			<div class="flex items-center justify-between gap-3">
				<div class="min-w-0">
					<CardTitle>Terminals</CardTitle>
					<CardDescription>
						terminal-system is global and orthogonal. Focus belongs to a seat, not the terminal object.
					</CardDescription>
				</div>
				<Button
					size="icon-sm"
					variant="outline"
					class="shrink-0"
					onclick={openCreateDialog}
					aria-label="Create terminal"
				>
					<PlusIcon class="size-4" />
				</Button>
			</div>
		</CardHeader>
		<CardContent class="min-h-0 p-0">
			<ScrollView class="h-full" contentClass="divide-y">
				{#if terminalsState.loading && !terminalsState.loaded}
					<div class="p-4 text-sm text-muted-foreground">Loading terminals…</div>
				{:else if terminalsState.error && terminalsState.data.length === 0}
					<div class="p-4 text-sm text-destructive">{terminalsState.error}</div>
				{:else if terminalsState.data.length === 0}
					<div class="p-4 text-sm text-muted-foreground">No terminals yet. Create the first standalone terminal.</div>
				{:else}
					{#each terminalsState.data as terminal (terminal.terminalId)}
						<button
							class={`grid w-full gap-2 px-4 py-4 text-left transition-colors hover:bg-muted/40 ${
								selectedTerminalId === terminal.terminalId ? 'bg-primary/5' : ''
							}`}
							onclick={() => onSelectTerminal(terminal.terminalId)}
							aria-label={`Select terminal ${terminal.title ?? terminal.terminalId}`}
						>
							<div class="flex items-center justify-between gap-3">
								<div class="min-w-0">
									<div class="truncate text-sm font-semibold">{terminal.title || terminal.terminalId}</div>
									<div class="truncate text-[11px] text-muted-foreground">{terminal.cwd}</div>
								</div>
								<div class="rounded-full border px-2 py-1 text-[11px]">{terminal.status}</div>
							</div>
							<div class="truncate text-[11px] text-muted-foreground">
								{(terminal.actors ?? []).length} seats · pending approvals {terminal.pendingRequestCount}
							</div>
						</button>
					{/each}
				{/if}
			</ScrollView>
		</CardContent>
	</Card>

	<Card class="min-h-0 min-w-0 py-0">
		<CardHeader class="gap-2 border-b">
			<div class="flex flex-wrap items-center justify-between gap-3">
				<div class="min-w-0">
					<CardTitle>{selectedTerminal?.title ?? 'Terminal view'}</CardTitle>
					<CardDescription>
						{selectedTerminal?.cwd ?? 'Select one terminal to inspect its shared runtime.'}
					</CardDescription>
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
				<div
					class={`rounded-xl border px-3 py-2 text-sm ${
						routeNotice.tone === 'destructive'
							? 'border-destructive/40 bg-destructive/5 text-destructive'
							: routeNotice.tone === 'warning'
								? 'border-amber-300 bg-amber-50 text-amber-900'
								: 'border-border bg-muted/40 text-foreground'
					}`}
				>
					{routeNotice.message}
				</div>
			{/if}
		</CardHeader>
		<CardContent class="grid min-h-0 grid-rows-[minmax(0,1fr)_auto] p-0">
			<div class="min-h-0 p-4">
				{#if selectedTerminal}
					<div class="grid h-full min-h-0 grid-rows-[minmax(0,1fr)_auto] gap-3">
						<div class="min-h-0 rounded-2xl border bg-black p-2 text-white">
							<TerminalViewHost
								class="block h-full min-h-[18rem] w-full"
								terminalId={selectedTerminal.terminalId}
								terminalTitle={selectedTerminal.title}
								cwd={selectedTerminal.cwd}
								status={selectedTerminal.status}
								transportUrl={selectedTerminal.transportUrl}
								snapshot={selectedTerminal.snapshot ?? null}
							/>
						</div>
						<div class="grid gap-2 text-xs text-muted-foreground">
							<div>Absolute cwd: {selectedTerminal.cwd}</div>
							<div>Process kind: {selectedTerminal.processKind}</div>
							<div>Renderer: {selectedTerminal.rendererEngine ?? 'xterm'}</div>
						</div>
					</div>
				{:else}
					<div class="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
						Select a terminal from the left rail.
					</div>
				{/if}
			</div>

			<div class="relative z-10 border-t bg-card p-4">
				<Tabs bind:value={actionToolTab}>
					<TabsList class="grid w-full grid-cols-2">
						<TabsTrigger value="write">Write</TabsTrigger>
						<TabsTrigger value="read">Read</TabsTrigger>
					</TabsList>

					<TabsContent value="write" class="mt-3 grid gap-3">
						<div class="grid gap-3 xl:grid-cols-[14rem_minmax(0,1fr)_auto]">
							<NativeSelect.Root
								aria-label="Call tool as"
								value={effectiveCallerToken ?? ''}
								onchange={(event) => {
									onChangeCallerToken((event.currentTarget as HTMLSelectElement).value);
								}}
							>
								{#if callAsOptions.length === 0}
									<option value="">No seat token</option>
								{:else}
									{#each callAsOptions as option (option.accessToken)}
										<option value={option.accessToken}>{option.label} · {option.role}</option>
									{/each}
								{/if}
							</NativeSelect.Root>
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
					</TabsContent>

					<TabsContent value="read" class="mt-3 grid gap-3">
						<div class="grid gap-3 xl:grid-cols-[minmax(0,1fr)_12rem_auto]">
							<NativeSelect.Root
								aria-label="Call tool as"
								value={effectiveCallerToken ?? ''}
								onchange={(event) => {
									onChangeCallerToken((event.currentTarget as HTMLSelectElement).value);
								}}
							>
								{#if callAsOptions.length === 0}
									<option value="">No seat token</option>
								{:else}
									{#each callAsOptions as option (option.accessToken)}
										<option value={option.accessToken}>{option.label} · {option.role}</option>
									{/each}
								{/if}
							</NativeSelect.Root>
							<NativeSelect.Root aria-label="Read mode" bind:value={readMode}>
								<option value="auto">auto</option>
								<option value="diff">diff</option>
								<option value="snapshot">snapshot</option>
							</NativeSelect.Root>
							<Button
								class="shrink-0 self-start xl:justify-self-end"
								disabled={!selectedTerminal || !effectiveCallerToken || readBusy}
								onclick={() => void handleReadToolCall()}
							>
								<FileClockIcon class="size-4" />
								Call read
							</Button>
						</div>
					</TabsContent>
				</Tabs>
			</div>
		</CardContent>
	</Card>

	<Card class="min-h-0 min-w-0 py-0 xl:col-span-2 2xl:col-span-1">
		<CardHeader class="gap-2 border-b">
			<CardTitle>Actions + Users</CardTitle>
			<CardDescription>
				Actions are terminal tool facts. Users are seats, grants, approvals, and per-seat focus.
			</CardDescription>
		</CardHeader>
		<CardContent class="min-h-0 p-0">
			<Tabs bind:value={sidePanelTab} class="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)]">
				<TabsList class="mx-4 mt-4 grid grid-cols-2">
					<TabsTrigger value="actions">Actions</TabsTrigger>
					<TabsTrigger value="users">Users</TabsTrigger>
				</TabsList>

				<TabsContent value="actions" class="min-h-0">
					<ScrollView class="h-full" contentClass="grid gap-3 p-4">
						{#if terminalActivityState.loading && !terminalActivityState.loaded}
							<div class="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
								Loading terminal actions…
							</div>
						{:else if terminalActivityState.error && terminalActivityState.data.length === 0}
							<div class="rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
								{terminalActivityState.error}
							</div>
						{:else if actionEvents.length === 0}
							<div class="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
								No terminal actions yet.
							</div>
						{:else}
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
												{event.kind} · {formatTimestamp(event.createdAt)}
											</div>
										</div>
									</div>
									<div class="rounded-xl border bg-muted/40 p-3">
										<div class="text-sm font-semibold">{event.title}</div>
										<pre class="mt-2 whitespace-pre-wrap break-words text-xs text-muted-foreground">{event.content}</pre>
										{#if stringifyDetail(event.detail)}
											<pre class="mt-2 whitespace-pre-wrap break-words rounded-lg bg-background p-2 text-[11px] text-muted-foreground">{stringifyDetail(event.detail)}</pre>
										{/if}
									</div>
								</div>
							{/each}
						{/if}
					</ScrollView>
				</TabsContent>

				<TabsContent value="users" class="min-h-0">
					<div class="grid h-full min-h-0 grid-rows-[auto_auto_minmax(0,1fr)] gap-4 p-4">
						<div class="grid gap-2">
							<div class="text-xs uppercase tracking-[0.18em] text-muted-foreground">Grant access</div>
							<NativeSelect.Root
								aria-label="Grant actor"
								value={grantParticipantId}
								onchange={(event) => {
									grantParticipantId = (event.currentTarget as HTMLSelectElement).value;
								}}
							>
								<option value="">Select actor</option>
								{#each selectableActors as actor (actor.actorId)}
									<option value={actor.actorId}>{actor.label} · {actor.subtitle ?? actor.actorId}</option>
								{/each}
							</NativeSelect.Root>
							<NativeSelect.Root aria-label="Grant role" bind:value={grantRole}>
								<option value="writer">writer</option>
								<option value="requester">requester</option>
								<option value="readonly">readonly</option>
								<option value="admin">admin</option>
							</NativeSelect.Root>
							<Button
								disabled={!selectedTerminal || !grantParticipantId || grantBusy}
								onclick={() => void handleGrantSeat()}
							>
								<ShieldUserIcon class="size-4" />
								Grant seat
							</Button>
							{#if grantError}
								<div class="rounded-xl border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
									{grantError}
								</div>
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

						<ScrollView class="h-full" contentClass="grid gap-3">
							{#if seatStates.length}
								{#each seatStates as seat (seat.actorId)}
									{@const seatAccessToken = seat.accessToken}
									{@const seatGrantId = seat.grantId}
									<div class="rounded-2xl border p-3" data-testid={`terminal-seat-${seat.actorId}`}>
										<div class="flex items-center justify-between gap-3">
											<div class="flex min-w-0 items-center gap-3">
												<ProfileAvatar label={seat.label} src={seat.iconUrl} class="size-9" />
												<div class="min-w-0">
													<div class="truncate text-sm font-semibold">{seat.label}</div>
													<div class="truncate text-xs text-muted-foreground">
														{seat.subtitle ?? seat.actorId}
													</div>
												</div>
											</div>
											<div
												class="rounded-full border px-2 py-1 text-[11px]"
												data-testid={`terminal-seat-role-${seat.actorId}`}
											>
												{seat.role}
											</div>
										</div>
										<div class="mt-3 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
											<div>{seat.focused ? 'Focused' : 'Unfocused'}</div>
											<div>{seat.online ? 'Online' : 'Offline'}</div>
											{#if seat.currentAdmin}
												<div>Current admin</div>
											{/if}
											{#if seat.adminCandidateRank !== undefined}
												<div>Admin group #{seat.adminCandidateRank}</div>
											{/if}
											{#if seat.invalidCredential}
												<div>Credential invalid</div>
											{/if}
											{#if seat.leaseExpiresAt}
												<div>Lease until {formatTimestamp(seat.leaseExpiresAt)}</div>
											{/if}
										</div>
										<div class="mt-3 flex flex-wrap gap-2">
											{#if seatAccessToken}
												<Button
													size="sm"
													variant="outline"
													onclick={() =>
														void onToggleSeatFocus({
															actorId: seat.actorId,
															accessToken: seatAccessToken,
															focused: seat.focused,
														})}
												>
													{seat.focused ? 'Unfocus seat' : 'Focus seat'}
												</Button>
											{/if}
											{#if seatGrantId}
												<Button
													size="sm"
													variant="outline"
													onclick={() => void onRevokeSeat({ actorId: seat.actorId, grantId: seatGrantId })}
												>
													Revoke
												</Button>
											{/if}
										</div>
									</div>
								{/each}
							{:else if selectedTerminal}
								<div class="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
									No terminal seats are visible yet.
								</div>
							{:else}
								<div class="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
									Select a terminal to inspect seats and grant management.
								</div>
							{/if}
						</ScrollView>
					</div>
				</TabsContent>
			</Tabs>
		</CardContent>
	</Card>
</div>

<Dialog.Root bind:open={createDialogOpen}>
	<Dialog.Content class="sm:max-w-lg">
		<form class="grid gap-4" onsubmit={handleCreateTerminal}>
			<Dialog.Header>
				<Dialog.Title>Create terminal</Dialog.Title>
				<Dialog.Description>
					Create a global terminal. Its cwd is absolute because terminal-system is no longer workspace-owned.
				</Dialog.Description>
			</Dialog.Header>

			<label class="grid gap-2 text-sm font-medium">
				<span>Terminal id</span>
				<Input bind:value={createTerminalId} placeholder="global-ops" />
			</label>
			<label class="grid gap-2 text-sm font-medium">
				<span>Process kind</span>
				<Input bind:value={createProcessKind} placeholder="shell" />
			</label>
			<label class="grid gap-2 text-sm font-medium">
				<span>Absolute cwd</span>
				<Input bind:value={createCwd} placeholder="/Users/kzf/Dev/GitHub/jixoai-labs/agenter" />
			</label>
			{#if createError}
				<div class="rounded-xl border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
					{createError}
				</div>
			{/if}

			<Dialog.Footer>
				<Button
					type="button"
					variant="ghost"
					onclick={() => {
						createDialogOpen = false;
						resetCreateDialog();
					}}
				>
					Cancel
				</Button>
				<Button type="submit" disabled={createBusy}>
					<TerminalSquareIcon class="size-4" />
					Create terminal
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
