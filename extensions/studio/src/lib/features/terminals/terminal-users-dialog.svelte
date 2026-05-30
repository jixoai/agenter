<script lang="ts">
	import { ScrollView } from '@agenter/svelte-components';
	import CircleEllipsisIcon from '@lucide/svelte/icons/circle-ellipsis';
	import XIcon from '@lucide/svelte/icons/x';
	import type { GlobalTerminalApprovalRequest, GlobalTerminalEntry } from '@agenter/client-sdk';

	import type { ActorDirectoryEntry } from '$lib/features/collaboration/actor-directory';
	import ActorSelect from '$lib/features/collaboration/actor-select.svelte';
	import type { ActorSelectItem } from '$lib/features/collaboration/actor-select.types';
	import ProfileAvatar from '$lib/components/profile-avatar.svelte';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import * as Item from '$lib/components/ui/item/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import { resolveTerminalIdentitySubtitle, resolveTerminalInstanceName } from './terminal-display';

	import type {
		TerminalSystemApprovalDecisionInput,
		TerminalSystemGrantRole,
		TerminalSystemSeatFocusInput,
		TerminalSystemSeatRevokeInput,
		TerminalSystemSeatState,
	} from './terminal-system-surface.types';

	interface Props {
		open?: boolean;
		selectedTerminal: GlobalTerminalEntry | null;
		terminalApprovals: GlobalTerminalApprovalRequest[];
		selectableActors: ActorDirectoryEntry[];
		seatStates: TerminalSystemSeatState[];
		grantParticipantId: string;
		grantRole: TerminalSystemGrantRole;
		grantBusy: boolean;
		grantError: string | null;
		disablePortal?: boolean;
		formatTimestamp: (value?: number) => string;
		onGrantParticipantIdChange: (value: string) => void;
		onGrantRoleChange: (value: TerminalSystemGrantRole) => void;
		onGrantSeat: () => void;
		onApproveRequest: (input: TerminalSystemApprovalDecisionInput) => Promise<void>;
		onDenyRequest: (input: TerminalSystemApprovalDecisionInput) => Promise<void>;
		onToggleSeatFocus: (input: TerminalSystemSeatFocusInput) => Promise<void>;
		onRevokeSeat: (input: TerminalSystemSeatRevokeInput) => Promise<void>;
	}

	type SeatAction = {
		id: string;
		label: string;
		testId: string;
		tone?: 'default' | 'destructive';
		onSelect: () => void;
	};

	let {
		open = $bindable(false),
		selectedTerminal,
		terminalApprovals,
		selectableActors,
		seatStates,
		grantParticipantId,
		grantRole,
		grantBusy,
		grantError,
		disablePortal = false,
		formatTimestamp,
		onGrantParticipantIdChange,
		onGrantRoleChange,
		onGrantSeat,
		onApproveRequest,
		onDenyRequest,
		onToggleSeatFocus,
		onRevokeSeat,
	}: Props = $props();

	const actorItems = $derived(
		selectableActors.map((actor) => ({
			value: actor.actorId,
			label: actor.label,
			subtitle: actor.actorId,
			iconUrl: actor.iconUrl ?? null,
		})) satisfies ActorSelectItem[],
	);
	const selectedActorItem = $derived(
		actorItems.find((item) => item.value === grantParticipantId) ?? null,
	);
	const roleItems = [
		{ value: 'writer', label: 'writer' },
		{ value: 'guard', label: 'guard' },
		{ value: 'readonly', label: 'readonly' },
		{ value: 'admin', label: 'admin' },
	] as const satisfies { value: TerminalSystemGrantRole; label: string }[];
	const selectedRoleLabel = $derived(
		roleItems.find((item) => item.value === grantRole)?.label ?? 'writer',
	);

	const describeSeatIdentity = (state: TerminalSystemSeatState): string =>
		state.subtitle?.trim() || state.actorId;

	const describeSeatActionTarget = (state: TerminalSystemSeatState): string =>
		state.subtitle ? `${state.label} (${state.subtitle})` : state.label;

	const resolveSeatActions = (state: TerminalSystemSeatState): SeatAction[] => {
		const actions: SeatAction[] = [];

		if (state.accessToken) {
			actions.push({
				id: `${state.actorId}:focus`,
				label: state.focused ? 'Unfocus seat' : 'Focus seat',
				testId: `terminal-seat-focus-${state.actorId}`,
				onSelect: () =>
					void onToggleSeatFocus({
						actorId: state.actorId,
						accessToken: state.accessToken!,
						focused: state.focused,
					}),
			});
		}

		if (state.grantId) {
			actions.push({
				id: `${state.actorId}:revoke`,
				label: 'Revoke seat',
				testId: `terminal-seat-revoke-${state.actorId}`,
				tone: 'destructive',
				onSelect: () =>
					void onRevokeSeat({
						actorId: state.actorId,
						grantId: state.grantId!,
					}),
			});
		}

		return actions;
	};
</script>

<Dialog.Root bind:open>
	<Dialog.Content
		class="left-0 top-0 h-svh w-svw max-w-none translate-x-0 translate-y-0 gap-0 rounded-none p-0 sm:left-[50%] sm:top-[50%] sm:h-auto sm:w-full sm:max-w-5xl sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-[1.4rem]"
		preventScroll={false}
		portalProps={disablePortal ? { disabled: true } : undefined}
		showCloseButton={false}
		data-testid="terminal-users-dialog"
	>
		<Dialog.Header class="sr-only">
			<Dialog.Title>Terminal users</Dialog.Title>
			<Dialog.Description>Manage seats, approvals, and grants for the selected terminal.</Dialog.Description>
		</Dialog.Header>

		<div class="grid gap-0">
			<div class="flex items-start justify-between gap-4 border-b px-4 py-4 sm:px-6">
				<div class="grid gap-1">
					<div class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
						Terminal access
					</div>
					<div class="break-all text-base font-semibold text-foreground">
						{resolveTerminalInstanceName(selectedTerminal)}
					</div>
					<div class="break-all text-sm text-muted-foreground">
						{selectedTerminal ? resolveTerminalIdentitySubtitle(selectedTerminal) || selectedTerminal.terminalId : 'No terminal selected.'}
					</div>
				</div>
				<Dialog.Close
					class="ring-offset-background focus:ring-ring inline-flex size-9 shrink-0 items-center justify-center rounded-full opacity-70 transition-opacity hover:bg-muted hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden"
				>
					<XIcon class="size-4" />
					<span class="sr-only">Close</span>
				</Dialog.Close>
			</div>

			<ScrollView class="max-h-[min(78svh,44rem)]" contentClass="grid auto-rows-max gap-5 p-4 sm:p-6">
				{#if terminalApprovals.length > 0}
					<section class="grid gap-3">
						<div class="grid gap-1">
							<h3 class="text-sm font-semibold">Pending approvals</h3>
							<p class="text-xs text-muted-foreground">
									Guard seats can ask for temporary write approval without changing the durable seat list.
							</p>
						</div>
						<div class="grid auto-rows-max gap-2.5">
							{#each terminalApprovals as approval (approval.requestId)}
								<Item.Root size="sm" class="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
									<div class="grid gap-1">
										<div class="text-sm font-semibold">{approval.participantId}</div>
										<div class="text-xs text-muted-foreground">
											{approval.requestedInput?.text ?? 'write request'} · expires {formatTimestamp(approval.expiresAt)}
										</div>
									</div>
									<div class="flex flex-wrap items-center gap-2 lg:justify-end">
										<Button
											size="sm"
											data-testid={`terminal-approval-approve-${approval.requestId}`}
											onclick={() =>
												void onApproveRequest({
													requestId: approval.requestId,
													durationMs: 30 * 60 * 1000,
												})}
										>
											Approve 30m
										</Button>
										<Button
											size="sm"
											variant="outline"
											data-testid={`terminal-approval-deny-${approval.requestId}`}
											onclick={() => void onDenyRequest({ requestId: approval.requestId })}
										>
											Deny
										</Button>
									</div>
								</Item.Root>
							{/each}
						</div>
					</section>
				{/if}

				<section class="grid gap-3">
					<div class="grid gap-1">
						<h3 class="text-sm font-semibold">Granted seats</h3>
						<p class="text-xs text-muted-foreground">
							Inspect focus state, online state, and revoke grants without leaving the terminal route.
						</p>
					</div>

					{#if seatStates.length === 0}
						<Item.Root size="sm" variant="muted" class="py-8 text-sm text-muted-foreground">
							No terminal seats are visible yet.
						</Item.Root>
					{:else}
						<div class="grid auto-rows-max gap-2.5">
							{#each seatStates as seat (seat.actorId)}
								{@const seatActions = resolveSeatActions(seat)}
								<Item.Root size="sm" data-testid={`terminal-seat-${seat.actorId}`}>
									<ProfileAvatar label={seat.label} src={seat.iconUrl} class="mt-0.5 size-10 rounded-xl" />
									<div class="min-w-0 flex-1">
										<div class="flex items-start gap-3">
											<div class="min-w-0 flex-1">
												<div class="flex flex-wrap items-center gap-2">
													<div class="truncate text-sm font-semibold">{seat.label}</div>
													<Badge
														variant="outline"
														class="rounded-full text-[10px] font-semibold uppercase tracking-[0.16em]"
													>
														{seat.role}
													</Badge>
												</div>
												<div class="mt-1 truncate text-xs text-muted-foreground">
													{describeSeatIdentity(seat)}
												</div>
												{#if seat.leaseExpiresAt}
													<div class="mt-1 truncate text-xs text-muted-foreground">
														Lease until {formatTimestamp(seat.leaseExpiresAt)}
													</div>
												{/if}
											</div>
											{#if seatActions.length > 0}
												<DropdownMenu.Root>
													<DropdownMenu.Trigger>
														{#snippet child({ props })}
															<Button
																{...props}
																type="button"
																size="icon-sm"
																variant="ghost"
																class="rounded-full text-muted-foreground hover:text-foreground data-[state=open]:bg-accent"
																data-testid={`terminal-seat-actions-${seat.actorId}`}
																aria-label={`Seat actions for ${describeSeatActionTarget(seat)}`}
																title={`Seat actions for ${describeSeatActionTarget(seat)}`}
															>
																<CircleEllipsisIcon class="size-4" />
															</Button>
														{/snippet}
													</DropdownMenu.Trigger>
													<DropdownMenu.Content align="end" sideOffset={6}>
														{#each seatActions as action (action.id)}
															<DropdownMenu.Item
																variant={action.tone === 'destructive' ? 'destructive' : 'default'}
																data-testid={action.testId}
																onclick={() => action.onSelect()}
															>
																{action.label}
															</DropdownMenu.Item>
														{/each}
													</DropdownMenu.Content>
												</DropdownMenu.Root>
											{/if}
										</div>
										<div class="mt-3 flex flex-wrap gap-1.5">
											<Badge class="rounded-full text-[11px]" variant={seat.focused ? 'default' : 'outline'}>
												{seat.focused ? 'Focused' : 'Unfocused'}
											</Badge>
											<Badge class="rounded-full text-[11px]" variant={seat.online ? 'secondary' : 'outline'}>
												{seat.online ? 'Online' : 'Offline'}
											</Badge>
											{#if seat.invalidCredential}
												<Badge class="rounded-full text-[11px]" variant="destructive">
													Credential invalid
												</Badge>
											{/if}
										</div>
									</div>
								</Item.Root>
							{/each}
						</div>
					{/if}
				</section>

				<section class="grid gap-3">
					<div class="grid gap-1">
						<h3 class="text-sm font-semibold">Grant seat</h3>
						<p class="text-xs text-muted-foreground">
								Grant the smallest role the actor needs. Guard is the least-privileged write path.
						</p>
					</div>

					<Card.Root>
						<Card.Content class="grid gap-4 pt-6">
							<div class="grid gap-2">
								<Label for="terminal-users-dialog-actor">Actor</Label>
								<ActorSelect
									id="terminal-users-dialog-actor"
									ariaLabel="Grant actor"
									items={actorItems}
									value={grantParticipantId}
									selectedItem={selectedActorItem}
									placeholder="Select actor"
									density="detail"
									chrome="field"
									class="w-full"
									onValueChange={onGrantParticipantIdChange}
								/>
							</div>

							<div class="grid gap-2">
								<Label for="terminal-users-dialog-role">Role</Label>
								<Select.Root
									type="single"
									items={roleItems}
									value={grantRole}
									onValueChange={(value) => {
										onGrantRoleChange(value as TerminalSystemGrantRole);
									}}
								>
									<Select.Trigger id="terminal-users-dialog-role" aria-label="Grant role" class="w-full">
										{selectedRoleLabel}
									</Select.Trigger>
									<Select.Content>
										{#each roleItems as item (item.value)}
											<Select.Item value={item.value} label={item.label}>{item.label}</Select.Item>
										{/each}
									</Select.Content>
								</Select.Root>
							</div>

							{#if grantError}
								<div class="rounded-xl border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
									{grantError}
								</div>
							{/if}
						</Card.Content>

						<Card.Footer class="justify-end border-t pt-6">
							<Button
								data-testid="terminal-seat-grant"
								disabled={!selectedTerminal || !grantParticipantId || grantBusy}
								onclick={onGrantSeat}
							>
								{grantBusy ? 'Granting…' : 'Grant seat'}
							</Button>
						</Card.Footer>
					</Card.Root>
				</section>
			</ScrollView>
		</div>
	</Dialog.Content>
</Dialog.Root>
