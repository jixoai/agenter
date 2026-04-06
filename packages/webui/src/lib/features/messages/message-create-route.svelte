<script lang="ts">
	import { goto } from '$app/navigation';

	import type { GlobalRoomActorId } from '@agenter/client-sdk';

	import { getAppControllerContext } from '$lib/app/controller-context';
	import ProfileAvatar from '$lib/components/profile-avatar.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import * as Item from '$lib/components/ui/item/index.js';
	import NoticeBanner from '$lib/components/ui/notice-banner.svelte';
	import * as Select from '$lib/components/ui/select/index.js';
	import {
		buildActorDirectory,
		buildActorDirectoryMap,
		type ActorDirectoryEntry,
	} from '$lib/features/collaboration/actor-directory';
	import WorkbenchScaffold from '$lib/features/navigation/workbench-scaffold.svelte';
	import type { MessageSystemGrantRole } from '$lib/features/messages/message-system-surface.types';

	const controller = getAppControllerContext();

	type InitialUserDraft = {
		selected: boolean;
		role: MessageSystemGrantRole;
	};

	let title = $state('');
	let initialUserDrafts = $state<Record<string, InitialUserDraft>>({});
	let createBusy = $state(false);
	let errorMessage = $state<string | null>(null);

	const roleItems = [
		{ value: 'admin', label: 'Admin' },
		{ value: 'member', label: 'Member' },
		{ value: 'readonly', label: 'Readonly' },
	] as const satisfies { value: MessageSystemGrantRole; label: string }[];

	const selectableActors = $derived(
		buildActorDirectory({
			sessions: controller.runtimeState.sessions,
			authActors: controller.authActors,
			profileIconUrl: (reference) => controller.runtimeStore.profileIconUrl(reference ?? ''),
			sessionIconUrl: (sessionId) => (sessionId ? controller.runtimeStore.sessionIconUrl(sessionId) : null),
		}).filter((actor) => actor.actorKind !== 'system'),
	);
	const selectableActorMap = $derived(buildActorDirectoryMap(selectableActors));
	const selectedUserCount = $derived(
		selectableActors.filter((actor) => initialUserDrafts[actor.actorId]?.selected).length,
	);

	const initialUserActorIdPattern = /^(auth|session|system):.+$/u;

	const isInitialUserActorId = (
		value: string,
	): value is GlobalRoomActorId => initialUserActorIdPattern.test(value);

	const buildInitialUsers = (): Array<{
		actorId: GlobalRoomActorId;
		label: string;
		role: MessageSystemGrantRole;
		focused: true;
	}> => {
		const initialUsers: Array<{
			actorId: GlobalRoomActorId;
			label: string;
			role: MessageSystemGrantRole;
			focused: true;
		}> = [];
		for (const actor of selectableActors) {
			if (!readUserDraft(actor.actorId).selected || !isInitialUserActorId(actor.actorId)) {
				continue;
			}
			initialUsers.push({
				actorId: actor.actorId,
				label: selectableActorMap.get(actor.actorId)?.label ?? actor.label,
				role: readUserDraft(actor.actorId).role,
				focused: true,
			});
		}
		return initialUsers;
	};

	const readUserDraft = (actorId: string): InitialUserDraft => initialUserDrafts[actorId] ?? { selected: false, role: 'member' };

	const setUserSelected = (actor: ActorDirectoryEntry, selected: boolean): void => {
		initialUserDrafts = {
			...initialUserDrafts,
			[actor.actorId]: {
				...readUserDraft(actor.actorId),
				selected,
			},
		};
	};

	const setUserRole = (actorId: string, role: MessageSystemGrantRole): void => {
		initialUserDrafts = {
			...initialUserDrafts,
			[actorId]: {
				...readUserDraft(actorId),
				role,
			},
		};
	};

	const selectedRoleLabel = (actorId: string): string =>
		roleItems.find((item) => item.value === readUserDraft(actorId).role)?.label ?? 'Member';

	const handleSubmit = async (event: SubmitEvent): Promise<void> => {
		event.preventDefault();
		if (createBusy) {
			return;
		}
		createBusy = true;
		errorMessage = null;
		try {
			const created = await controller.runtimeStore.createGlobalRoom({
				title: title.trim() || undefined,
				initialUsers: buildInitialUsers(),
			});
			await goto(`/messages/room/${encodeURIComponent(created.chatId)}`, {
				keepFocus: true,
				noScroll: true,
			});
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : String(error);
		} finally {
			createBusy = false;
		}
	};
</script>

<WorkbenchScaffold
	tone="page"
	body="scroll"
	contentClass="mx-auto grid w-full max-w-5xl gap-6"
	data-testid="message-create-route"
>
	{#snippet header()}
		<div class="grid gap-2">
			<h2 class="text-base font-semibold">Create room</h2>
			<p class="text-sm text-muted-foreground">Open a new global room directly from a fixed workbench tab.</p>
		</div>
	{/snippet}

	<form class="grid gap-6" onsubmit={handleSubmit}>
		<section class="grid gap-4 rounded-[1rem] border border-border/60 bg-background/45 p-4 md:p-5">
			<label class="grid gap-2 text-sm font-medium">
				<span>Room title</span>
				<Input bind:value={title} placeholder="Incident bridge" />
			</label>

			<div class="grid gap-3">
				<div class="grid gap-1">
					<div class="text-sm font-medium">Initial users</div>
					<p class="text-sm text-muted-foreground">
						Select the Users that should join immediately. Every selected User opens this room by default.
					</p>
				</div>

				{#if selectableActors.length === 0}
					<div class="rounded-2xl border border-dashed px-4 py-5 text-sm text-muted-foreground">
						No eligible Users available yet.
					</div>
				{:else}
					<div class="grid gap-2">
						{#each selectableActors as actor (actor.actorId)}
							<Item.Root
								size="sm"
								class={`grid gap-3 md:grid-cols-[minmax(0,1fr)_11rem] md:items-center ${
									readUserDraft(actor.actorId).selected ? 'border-primary/50 bg-primary/5' : ''
								}`}
								data-testid={`new-room-user-${actor.actorId}`}
							>
								<label class="flex min-w-0 items-start gap-3">
									<Checkbox
										checked={readUserDraft(actor.actorId).selected}
										aria-label={`Include ${actor.label}`}
										onCheckedChange={(checked) => {
											setUserSelected(actor, !!checked);
										}}
									/>
									<ProfileAvatar label={actor.label} src={actor.iconUrl} class="size-10 rounded-xl" />
									<span class="grid min-w-0 gap-1">
										<span class="truncate text-sm font-semibold">{actor.label}</span>
										<span class="truncate text-xs text-muted-foreground">
											{actor.subtitle ?? actor.actorId}
										</span>
									</span>
								</label>

								<div class="grid gap-1.5 md:justify-items-end">
									<span class="text-[11px] font-medium tracking-[0.16em] text-muted-foreground uppercase">
										Role
									</span>
									<Select.Root
										type="single"
										items={roleItems}
										value={readUserDraft(actor.actorId).role}
										onValueChange={(value) => {
											if (value === 'admin' || value === 'member' || value === 'readonly') {
												setUserRole(actor.actorId, value);
											}
										}}
									>
										<Select.Trigger
											aria-label={`Role for ${actor.label}`}
											class="w-full min-w-32"
											data-testid={`new-room-user-role-${actor.actorId}`}
											disabled={!readUserDraft(actor.actorId).selected}
										>
											{selectedRoleLabel(actor.actorId)}
										</Select.Trigger>
										<Select.Content>
											{#each roleItems as item (item.value)}
												<Select.Item value={item.value} label={item.label}>{item.label}</Select.Item>
											{/each}
										</Select.Content>
									</Select.Root>
								</div>
							</Item.Root>
						{/each}
					</div>
					<div class="text-xs text-muted-foreground">
						{selectedUserCount} {selectedUserCount === 1 ? 'User' : 'Users'} selected.
					</div>
				{/if}
			</div>
		</section>

		{#if errorMessage}
			<NoticeBanner tone="destructive" message={errorMessage} />
		{/if}

		<div class="flex justify-end">
			<Button type="submit" disabled={createBusy}>
				{createBusy ? 'Creating…' : 'Create room'}
			</Button>
		</div>
	</form>
</WorkbenchScaffold>
