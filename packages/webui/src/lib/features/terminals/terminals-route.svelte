<script lang="ts">
	import FileClockIcon from '@lucide/svelte/icons/file-clock';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import SendHorizontalIcon from '@lucide/svelte/icons/send-horizontal';
	import ShieldUserIcon from '@lucide/svelte/icons/shield-user';
	import TerminalSquareIcon from '@lucide/svelte/icons/terminal-square';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import { onMount } from 'svelte';

	import type {
		GlobalTerminalApprovalRequest,
		GlobalTerminalEntry,
		GlobalTerminalGrantEntry,
		TerminalActivityItem,
	} from '@agenter/client-sdk';

	import { getAppControllerContext } from '$lib/app/controller-context';
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
	import {
		buildActorDirectory,
		buildActorDirectoryMap,
		fallbackActorLabel,
		type ActorDirectoryEntry,
	} from '$lib/features/collaboration/actor-directory';

	const controller = getAppControllerContext();

	let terminals = $state<GlobalTerminalEntry[]>([]);
	let selectedTerminalId = $state('');
	let selectedTerminal = $state<GlobalTerminalEntry | null>(null);
	let grants = $state<GlobalTerminalGrantEntry[]>([]);
	let approvals = $state<GlobalTerminalApprovalRequest[]>([]);
	let activity = $state<TerminalActivityItem[]>([]);
	let terminalsLoading = $state(false);
	let terminalDetailLoading = $state(false);
	let grantParticipantId = $state('');
	let grantRole = $state<'admin' | 'writer' | 'requester' | 'readonly'>('writer');
	let callAsToken = $state('');
	let readMode = $state<'auto' | 'diff' | 'snapshot'>('auto');
	let writeText = $state('');
	let createDialogOpen = $state(false);
	let createTerminalId = $state('');
	let createProcessKind = $state('shell');
	let createCwd = $state('');
	let actionToolTab = $state<'write' | 'read'>('write');
	let sidePanelTab = $state<'actions' | 'users'>('actions');
	const globalTerminalRefreshMs = 2500;

	const actorDirectory = $derived(
		buildActorDirectory({
			sessions: controller.runtimeState.sessions,
			authActors: controller.authActors,
			profileIconUrl: (reference) => controller.runtimeStore.profileIconUrl(reference ?? ''),
			sessionIconUrl: (sessionId) => (sessionId ? controller.runtimeStore.sessionIconUrl(sessionId) : null),
		}),
	);
	const actorDirectoryMap = $derived(buildActorDirectoryMap(actorDirectory));

	const asTerminalActorId = (value: string): `auth:${string}` | `session:${string}` | `system:${string}` | null => {
		return /^((auth|session|system):.+)$/u.test(value)
			? (value as `auth:${string}` | `session:${string}` | `system:${string}`)
			: null;
	};

	const callAsOptions = $derived.by(() => {
		if (!selectedTerminal) {
			return [];
		}
		const items = [];
		if (selectedTerminal.access?.accessToken) {
			items.push({
				accessToken: selectedTerminal.access.accessToken,
				participantId: selectedTerminal.access.participantId,
				role: selectedTerminal.access.role,
				label:
					(selectedTerminal.access.participantId
						? actorDirectoryMap.get(selectedTerminal.access.participantId)?.label ??
							fallbackActorLabel(selectedTerminal.access.participantId)
						: undefined) ?? 'Admin seat',
			});
		}
		for (const grant of grants) {
			if (!grant.accessToken) {
				continue;
			}
			items.push({
				accessToken: grant.accessToken,
				participantId: grant.participantId,
				role: grant.role,
				label:
					(grant.participantId ? actorDirectoryMap.get(grant.participantId)?.label : undefined) ??
					grant.label ??
					fallbackActorLabel(grant.participantId ?? grant.grantId),
			});
		}
		return items;
	});

	const loadTerminals = async (options?: { background?: boolean }): Promise<void> => {
		terminalsLoading = !options?.background;
		try {
			terminals = await controller.runtimeStore.listGlobalTerminals();
			if (!selectedTerminalId && terminals[0]) {
				selectedTerminalId = terminals[0].terminalId;
			}
		} finally {
			terminalsLoading = false;
		}
	};

	const loadTerminalDetail = async (terminalId: string, options?: { background?: boolean }): Promise<void> => {
		terminalDetailLoading = !options?.background;
		try {
			selectedTerminal = (await controller.runtimeStore.listGlobalTerminals()).find((entry) => entry.terminalId === terminalId) ?? null;
			if (!selectedTerminal) {
				return;
			}
			grants = await controller.runtimeStore.listGlobalTerminalGrants(selectedTerminal.terminalId);
			approvals = await controller.runtimeStore.listGlobalTerminalApprovalRequests({
				terminalId: selectedTerminal.terminalId,
				statuses: ['pending'],
			});
			activity = (await controller.runtimeStore.loadGlobalTerminalActivity(selectedTerminal.terminalId)).items.sort(
				(left, right) => left.createdAt - right.createdAt,
			);
			if (!callAsOptions.some((option) => option.accessToken === callAsToken)) {
				callAsToken = selectedTerminal.access?.accessToken ?? grants[0]?.accessToken ?? '';
			}
		} finally {
			terminalDetailLoading = false;
		}
	};

	const refreshSelectedTerminal = async (): Promise<void> => {
		if (!selectedTerminalId) {
			return;
		}
		await loadTerminals();
		await loadTerminalDetail(selectedTerminalId);
	};

	const describeActor = (actorId: string | undefined, fallback: string): ActorDirectoryEntry => {
		if (actorId && actorDirectoryMap.has(actorId)) {
			return actorDirectoryMap.get(actorId)!;
		}
		return {
			actorId: actorId ?? fallback,
			actorKind: actorId?.startsWith('session:')
				? 'session'
				: actorId?.startsWith('system:')
					? 'system'
					: 'auth',
			label: fallbackActorLabel(actorId ?? fallback),
			subtitle: actorId,
			iconUrl: null,
		};
	};

	onMount(() => {
		const refreshTimer = window.setInterval(() => {
			if (document.visibilityState === 'hidden') {
				return;
			}
			void loadTerminals({ background: true });
			if (selectedTerminalId) {
				void loadTerminalDetail(selectedTerminalId, { background: true });
			}
		}, globalTerminalRefreshMs);
		return () => {
			window.clearInterval(refreshTimer);
		};
	});

	$effect(() => {
		void loadTerminals();
	});

	$effect(() => {
		if (selectedTerminalId) {
			void loadTerminalDetail(selectedTerminalId);
		}
	});
</script>

<div class="grid h-full min-h-0 gap-4 p-4 md:grid-cols-[18rem_minmax(0,1fr)_24rem] md:p-6">
	<Card class="min-h-0 min-w-0 py-0">
		<CardHeader class="gap-2 border-b">
			<div class="flex items-center justify-between gap-3">
				<div class="min-w-0">
					<CardTitle>Terminals</CardTitle>
					<CardDescription>terminal-system is global and orthogonal. Focus belongs to a seat, not the terminal object.</CardDescription>
				</div>
				<Button
					size="icon-sm"
					variant="outline"
					class="shrink-0"
					onclick={() => (createDialogOpen = true)}
					aria-label="Create terminal"
				>
					<PlusIcon class="size-4" />
				</Button>
			</div>
		</CardHeader>
		<CardContent class="min-h-0 p-0">
			<ScrollView class="h-full" contentClass="divide-y">
				{#if terminalsLoading && terminals.length === 0}
					<div class="p-4 text-sm text-muted-foreground">Loading terminals…</div>
				{:else}
					{#each terminals as terminal (terminal.terminalId)}
						<button
							class={`grid w-full gap-2 px-4 py-4 text-left transition-colors hover:bg-muted/40 ${
								selectedTerminalId === terminal.terminalId ? 'bg-primary/5' : ''
							}`}
							onclick={() => {
								selectedTerminalId = terminal.terminalId;
							}}
						>
							<div class="flex items-center justify-between gap-3">
								<div class="min-w-0">
									<div class="truncate text-sm font-semibold">{terminal.title || terminal.terminalId}</div>
									<div class="truncate text-[11px] text-muted-foreground">{terminal.cwd}</div>
								</div>
								<div class="rounded-full border px-2 py-1 text-[11px]">{terminal.status}</div>
							</div>
						</button>
					{/each}
				{/if}
			</ScrollView>
		</CardContent>
	</Card>

	<Card class="min-h-0 min-w-0 py-0">
		<CardHeader class="gap-2 border-b">
			<div class="flex items-center justify-between gap-3">
				<div class="min-w-0">
					<CardTitle>{selectedTerminal?.title ?? 'Terminal view'}</CardTitle>
					<CardDescription>{selectedTerminal?.cwd ?? 'Select one terminal to inspect its shared runtime.'}</CardDescription>
				</div>
				{#if selectedTerminal}
					<Button
						variant="outline"
						size="icon-sm"
						class="shrink-0"
						onclick={async () => {
							const terminal = selectedTerminal;
							if (!terminal) return;
							await controller.runtimeStore.deleteGlobalTerminal({ terminalId: terminal.terminalId });
							selectedTerminalId = '';
							selectedTerminal = null;
							await loadTerminals();
						}}
						aria-label="Delete terminal"
					>
						<Trash2Icon class="size-4" />
					</Button>
				{/if}
			</div>
		</CardHeader>
		<CardContent class="grid min-h-0 grid-rows-[minmax(0,1fr)_auto] p-0">
			<div class="min-h-0 p-4">
				{#if selectedTerminal}
					<div class="grid h-full min-h-0 gap-3">
						<div class="rounded-2xl border bg-black p-2 text-white">
							<TerminalViewHost
								class="block h-[28rem] w-full"
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
					<div class="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">Select a terminal from the left rail.</div>
				{/if}
			</div>

			<div class="border-t p-4">
				<Tabs bind:value={actionToolTab}>
					<TabsList class="grid w-full grid-cols-2">
						<TabsTrigger value="write">Write</TabsTrigger>
						<TabsTrigger value="read">Read</TabsTrigger>
					</TabsList>

					<TabsContent value="write" class="mt-3 grid gap-3">
						<div class="grid items-start gap-3 md:grid-cols-[14rem_minmax(0,1fr)_auto]">
							<NativeSelect.Root bind:value={callAsToken}>
								{#each callAsOptions as option (option.accessToken)}
									<option value={option.accessToken}>{option.label} · {option.role}</option>
								{/each}
							</NativeSelect.Root>
							<Textarea bind:value={writeText} class="min-h-24" placeholder="Type terminal input…" />
							<Button
								class="shrink-0 self-start"
								onclick={async () => {
									if (!selectedTerminal || !callAsToken || !writeText.trim()) return;
									await controller.runtimeStore.writeGlobalTerminal({
										terminalId: selectedTerminal.terminalId,
										accessToken: callAsToken,
										text: writeText,
										returnRead: false,
									});
									writeText = '';
									await refreshSelectedTerminal();
								}}
							>
								<SendHorizontalIcon class="size-4" />
								Call tool
							</Button>
						</div>
					</TabsContent>

					<TabsContent value="read" class="mt-3 grid gap-3">
						<div class="grid items-start gap-3 md:grid-cols-[14rem_12rem_auto]">
							<NativeSelect.Root bind:value={callAsToken}>
								{#each callAsOptions as option (option.accessToken)}
									<option value={option.accessToken}>{option.label} · {option.role}</option>
								{/each}
							</NativeSelect.Root>
							<NativeSelect.Root bind:value={readMode}>
								<option value="auto">auto</option>
								<option value="diff">diff</option>
								<option value="snapshot">snapshot</option>
							</NativeSelect.Root>
							<Button
								class="shrink-0 self-start"
								onclick={async () => {
									if (!selectedTerminal || !callAsToken) return;
									await controller.runtimeStore.readGlobalTerminal({
										terminalId: selectedTerminal.terminalId,
										accessToken: callAsToken,
										mode: readMode,
									});
									await refreshSelectedTerminal();
								}}
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

	<Card class="min-h-0 min-w-0 py-0">
		<CardHeader class="gap-2 border-b">
			<CardTitle>Actions + Users</CardTitle>
			<CardDescription>Actions are tool-call facts. Users are seats, grants, approvals, and seat focus.</CardDescription>
		</CardHeader>
		<CardContent class="min-h-0 p-0">
			<Tabs bind:value={sidePanelTab} class="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)]">
				<TabsList class="mx-4 mt-4 grid grid-cols-2">
					<TabsTrigger value="actions">Actions</TabsTrigger>
					<TabsTrigger value="users">Users</TabsTrigger>
				</TabsList>

				<TabsContent value="actions" class="min-h-0">
					<ScrollView class="h-full" contentClass="grid gap-3 p-4">
						{#if activity.length}
							{#each activity as event (event.id)}
								{@const actor = describeActor(event.actorId, event.actorId ?? event.terminalId)}
								<div class="rounded-2xl border p-3">
									<div class="flex items-center gap-3">
										<ProfileAvatar label={actor.label} src={actor.iconUrl} class="size-8" />
										<div class="min-w-0">
											<div class="truncate text-sm font-semibold">{actor.label}</div>
											<div class="truncate text-xs text-muted-foreground">
												{event.kind} · {new Date(event.createdAt).toLocaleString()}
											</div>
										</div>
									</div>
									<div class="mt-3 rounded-xl bg-muted/40 px-3 py-2 text-sm">{event.title}</div>
									<div class="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">{event.content}</div>
								</div>
							{/each}
						{:else if terminalDetailLoading}
							<div class="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">Loading terminal activity…</div>
						{:else}
							<div class="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">No terminal actions yet.</div>
						{/if}
					</ScrollView>
				</TabsContent>

				<TabsContent value="users" class="min-h-0">
					<div class="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-4 p-4">
						<div class="grid gap-2">
							<div class="text-xs uppercase tracking-[0.18em] text-muted-foreground">Grant access</div>
							<NativeSelect.Root bind:value={grantParticipantId}>
								<option value="">Select actor</option>
								{#each actorDirectory as actor (actor.actorId)}
									<option value={actor.actorId}>{actor.label} · {actor.subtitle ?? actor.actorId}</option>
								{/each}
							</NativeSelect.Root>
							<NativeSelect.Root bind:value={grantRole}>
								<option value="writer">writer</option>
								<option value="requester">requester</option>
								<option value="readonly">readonly</option>
								<option value="admin">admin</option>
							</NativeSelect.Root>
							<Button onclick={async () => {
								const terminal = selectedTerminal;
								const participantId = asTerminalActorId(grantParticipantId);
								if (!terminal || !participantId) return;
								await controller.runtimeStore.issueGlobalTerminalGrant({
									terminalId: terminal.terminalId,
									role: grantRole,
									participantId,
									label: actorDirectoryMap.get(grantParticipantId)?.label,
								});
								grantParticipantId = '';
								await refreshSelectedTerminal();
							}} disabled={!selectedTerminal || !grantParticipantId}>
								<ShieldUserIcon class="size-4" />
								Grant seat
							</Button>
						</div>

						<ScrollView class="h-full" contentClass="grid gap-3">
							{#each selectedTerminal?.actors ?? [] as actorSeat (actorSeat.actorId)}
								{@const actor = describeActor(actorSeat.actorId, actorSeat.label ?? actorSeat.actorId)}
								{@const grant = grants.find((item) => item.participantId === actorSeat.actorId)}
								<div class="rounded-2xl border p-3">
									<div class="flex items-center justify-between gap-3">
										<div class="flex min-w-0 items-center gap-3">
											<ProfileAvatar label={actor.label} src={actor.iconUrl} class="size-9" />
											<div class="min-w-0">
												<div class="truncate text-sm font-semibold">{actor.label}</div>
												<div class="truncate text-xs text-muted-foreground">{actorSeat.actorId}</div>
											</div>
										</div>
										<div class="rounded-full border px-2 py-1 text-[11px]">{actorSeat.role}</div>
									</div>
									<div class="mt-3 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
										<div>{actorSeat.focused ? 'Focused' : 'Unfocused'}</div>
										{#if actorSeat.currentAdmin}
											<div>Current admin</div>
										{/if}
										{#if actorSeat.invalidCredential}
											<div>Credential invalid</div>
										{/if}
									</div>
									<div class="mt-3 flex flex-wrap gap-2">
										{#if grant?.accessToken}
											<Button
												size="sm"
												variant="outline"
												onclick={async () => {
													await controller.runtimeStore.focusGlobalTerminals({
														op: actorSeat.focused ? 'remove' : 'add',
														terminalIds: [selectedTerminal!.terminalId],
														accessToken: grant.accessToken,
													});
													await refreshSelectedTerminal();
												}}
											>
												{actorSeat.focused ? 'Unfocus seat' : 'Focus seat'}
											</Button>
											<Button
												size="sm"
												variant="outline"
												onclick={async () => {
													await controller.runtimeStore.revokeGlobalTerminalGrant({
														terminalId: selectedTerminal!.terminalId,
														grantId: grant.grantId,
													});
													await refreshSelectedTerminal();
												}}
											>
												Revoke
											</Button>
										{/if}
									</div>
								</div>
							{/each}

							{#if approvals.length}
								<div class="grid gap-2 rounded-2xl border border-amber-300 bg-amber-50/60 p-3">
									<div class="text-sm font-semibold">Pending approvals</div>
									{#each approvals as approval (approval.requestId)}
										<div class="rounded-xl border border-amber-200 bg-white/70 p-3">
											<div class="text-sm">{approval.participantId}</div>
											<div class="mt-1 text-xs text-muted-foreground">{approval.requestedInput?.text ?? 'write request'}</div>
											<div class="mt-3 flex gap-2">
												<Button size="sm" onclick={async () => {
													if (!selectedTerminal) return;
													await controller.runtimeStore.approveGlobalTerminalRequest({
														terminalId: selectedTerminal.terminalId,
														requestId: approval.requestId,
														durationMs: 30 * 60 * 1000,
													});
													await refreshSelectedTerminal();
												}}>
													Approve 30m
												</Button>
												<Button size="sm" variant="outline" onclick={async () => {
													if (!selectedTerminal) return;
													await controller.runtimeStore.denyGlobalTerminalRequest({
														terminalId: selectedTerminal.terminalId,
														requestId: approval.requestId,
													});
													await refreshSelectedTerminal();
												}}>
													Deny
												</Button>
											</div>
										</div>
									{/each}
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
		<Dialog.Header>
			<Dialog.Title>Create terminal</Dialog.Title>
			<Dialog.Description>Create a global terminal. Its cwd is absolute because terminal-system is no longer workspace-owned.</Dialog.Description>
		</Dialog.Header>
		<div class="grid gap-3">
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
		</div>
		<Dialog.Footer>
			<Button variant="ghost" onclick={() => (createDialogOpen = false)}>Cancel</Button>
			<Button onclick={async () => {
				const created = await controller.runtimeStore.createGlobalTerminal({
					terminalId: createTerminalId.trim() || undefined,
					processKind: createProcessKind.trim() || undefined,
					cwd: createCwd.trim() || undefined,
				});
				createDialogOpen = false;
				createTerminalId = '';
				createProcessKind = 'shell';
				createCwd = '';
				await loadTerminals();
				selectedTerminalId = created.terminal?.terminalId ?? '';
			}}>
				<TerminalSquareIcon class="size-4" />
				Create terminal
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
