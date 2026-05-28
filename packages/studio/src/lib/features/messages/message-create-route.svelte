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
		isPrincipalActorId,
		type ActorDirectoryEntry,
	} from '$lib/features/collaboration/actor-directory';
	import WorkbenchScaffold from '$lib/features/navigation/workbench-scaffold.svelte';
	import type { MessageSystemGrantRole } from '$lib/features/messages/message-system-surface.types';

	const controller = getAppControllerContext();
	const AUTH_REQUIRED_MESSAGE = 'auth token required';

	type InitialUserDraft = {
		selected: boolean;
		role: MessageSystemGrantRole;
	};

	let title = $state('');
	let initialUserDrafts = $state<Record<string, InitialUserDraft>>({});
	let createBusy = $state(false);
	let errorMessage = $state<string | null>(null);
	const authReady = $derived(!controller.initializing);
	const isAuthenticated = $derived(Boolean(controller.authSession));
	const showAuthNotice = $derived(authReady && !isAuthenticated);
	const routeErrorMessage = $derived(errorMessage ?? (showAuthNotice ? AUTH_REQUIRED_MESSAGE : null));

	const roleItems = [
		{ value: 'admin', label: 'Admin' },
		{ value: 'member', label: 'Member' },
		{ value: 'readonly', label: 'Readonly' },
	] as const satisfies { value: MessageSystemGrantRole; label: string }[];

	const creatorActorId = $derived.by(() => {
		const authId = controller.authSession?.claims.authId?.trim();
		return authId ? (`auth:${authId}` as const) : null;
	});
	const selectableActors = $derived.by(() => {
		const creator = creatorActorId;
		const actors = buildActorDirectory({
			sessions: controller.runtimeState.sessions,
			authActors: controller.authActors,
			profileIconUrl: (reference) => controller.runtimeStore.profileIconUrl(reference ?? ''),
			sessionIconUrl: (sessionId) => (sessionId ? controller.runtimeStore.sessionIconUrl(sessionId) : null),
		}).filter((actor) => actor.actorKind !== 'system');
		if (!creator) {
			return actors;
		}
		return [...actors].sort((left, right) => {
			if (left.actorId === creator && right.actorId !== creator) {
				return -1;
			}
			if (right.actorId === creator && left.actorId !== creator) {
				return 1;
			}
			return 0;
		});
	});
	const selectableActorMap = $derived(buildActorDirectoryMap(selectableActors));

	const isInitialUserActorId = (value: string): value is GlobalRoomActorId =>
		/^(auth|session|system):.+$/u.test(value) || isPrincipalActorId(value);

	const buildInitialUsers = (): Array<{
		contactId: GlobalRoomActorId;
		label: string;
		role: MessageSystemGrantRole;
		focused: true;
	}> => {
		const initialUsers: Array<{
			contactId: GlobalRoomActorId;
			label: string;
			role: MessageSystemGrantRole;
			focused: true;
		}> = [];
		for (const actor of selectableActors) {
			if (!readUserDraft(actor.actorId).selected || !isInitialUserActorId(actor.actorId)) {
				continue;
			}
			initialUsers.push({
				contactId: actor.actorId,
				label: selectableActorMap.get(actor.actorId)?.label ?? actor.label,
				role: readUserDraft(actor.actorId).role,
				focused: true,
			});
		}
		return initialUsers;
	};

	const isCreatorActor = (actorId: string): boolean => creatorActorId === actorId;

	const readUserDraft = (actorId: string): InitialUserDraft =>
		initialUserDrafts[actorId] ??
		(isCreatorActor(actorId)
			? {
					selected: true,
					role: 'admin',
				}
			: {
					selected: false,
					role: 'member',
				});
	const selectedUserCount = $derived(selectableActors.filter((actor) => readUserDraft(actor.actorId).selected).length);

	const setUserSelected = (actor: ActorDirectoryEntry, selected: boolean): void => {
		if (isCreatorActor(actor.actorId)) {
			selected = true;
		}
		initialUserDrafts = {
			...initialUserDrafts,
			[actor.actorId]: {
				...readUserDraft(actor.actorId),
				selected,
			},
		};
	};

	const setUserRole = (actorId: string, role: MessageSystemGrantRole): void => {
		if (isCreatorActor(actorId)) {
			role = 'admin';
		}
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
		if (!authReady || !isAuthenticated) {
			errorMessage = AUTH_REQUIRED_MESSAGE;
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
				<Input bind:value={title} placeholder="Room" />
				<span class="text-xs font-normal text-muted-foreground">Optional. Leave blank to use "Room".</span>
			</label>

			<div class="grid gap-3">
				<div class="grid gap-1">
					<div class="text-sm font-medium">Users</div>
					<p class="text-sm text-muted-foreground">
						The creator joins automatically as Admin. Select any additional Users that should join immediately.
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
										disabled={isCreatorActor(actor.actorId)}
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
											disabled={!readUserDraft(actor.actorId).selected || isCreatorActor(actor.actorId)}
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

		{#if routeErrorMessage}
			<NoticeBanner tone="destructive" message={routeErrorMessage} />
		{/if}

		<div class="flex justify-end">
			<Button type="submit" disabled={createBusy || !authReady || !isAuthenticated}>
				{createBusy ? 'Creating…' : 'Create room'}
			</Button>
		</div>
	</form>
</WorkbenchScaffold>
