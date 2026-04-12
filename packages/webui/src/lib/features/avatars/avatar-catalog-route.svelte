<script lang="ts">
	import ArrowUpRightIcon from '@lucide/svelte/icons/arrow-up-right';
	import BotIcon from '@lucide/svelte/icons/bot';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import PlayIcon from '@lucide/svelte/icons/play';
	import { ScrollView } from '@agenter/svelte-components';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';

	import { getAppControllerContext } from '$lib/app/controller-context';
	import ProfileAvatar from '$lib/components/profile-avatar.svelte';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import NoticeBanner from '$lib/components/ui/notice-banner.svelte';
	import * as Card from '$lib/components/ui/card/index.js';
	import WorkbenchPageToolbar from '$lib/features/navigation/workbench-page-toolbar.svelte';
	import { buildAvatarNewHref, createAvatarDraftId } from '$lib/features/avatars/avatar-workbench-location';
	import { buildWorkspaceIndexHref } from '$lib/features/workspaces/workspace-location';

	const controller = getAppControllerContext();

	let selectedAvatar = $state(page.url.searchParams.get('avatar') ?? '');
	let nextCatalogDraftId = $state(createAvatarDraftId());
	let runtimeBusy = $state(false);
	let runtimeError = $state<string | null>(null);
	let copyDialogOpen = $state(false);
	let copyNickname = $state('');
	let copyBusy = $state(false);
	let copyError = $state<string | null>(null);

	const catalogState = $derived(controller.runtimeState.globalAvatarCatalog);
	const avatars = $derived(catalogState.data);
	const selectedEntry = $derived(
		avatars.find((entry) => entry.nickname === selectedAvatar) ?? avatars[0] ?? null,
	);
	const selectedSession = $derived(
		selectedEntry ? controller.runtimeState.sessions.find((session) => session.id === selectedEntry.runtimeId) ?? null : null,
	);
	const copyNicknameConflict = $derived(
		copyNickname.trim().length > 0 && avatars.some((avatar) => avatar.nickname === copyNickname.trim().toLowerCase()),
	);

	$effect(() => {
		const release = controller.runtimeStore.retainGlobalAvatarCatalog();
		void controller.runtimeStore.hydrateGlobalAvatarCatalog();
		return () => {
			release();
		};
	});

	$effect(() => {
		if (!selectedEntry) {
			return;
		}
		if (selectedAvatar !== selectedEntry.nickname) {
			selectedAvatar = selectedEntry.nickname;
		}
	});

	const openAvatarRuntime = async (input: { autoStart: boolean; tab: 'heartbeat' | 'attention' }): Promise<void> => {
		if (!selectedEntry || runtimeBusy) {
			return;
		}
		runtimeBusy = true;
		runtimeError = null;
		try {
			const session =
				selectedSession ??
				(await controller.runtimeStore.createSession({
					cwd: selectedEntry.globalPath,
					avatar: selectedEntry.nickname,
					autoStart: input.autoStart,
				}));
			if (input.autoStart && session.status !== 'running' && session.status !== 'starting') {
				await controller.runtimeStore.startSession(session.id);
			}
			await goto(`/avatars/runtime/${encodeURIComponent(session.id)}/${input.tab}`);
		} catch (error) {
			runtimeError = error instanceof Error ? error.message : 'Failed to open avatar runtime.';
		} finally {
			runtimeBusy = false;
		}
	};

	const submitAvatarCopy = async (): Promise<void> => {
		const nickname = copyNickname.trim();
		if (!selectedEntry || nickname.length === 0 || copyBusy || copyNicknameConflict) {
			return;
		}
		copyBusy = true;
		copyError = null;
		try {
			const created = await controller.runtimeStore.createGlobalAvatar({
				nickname,
				displayName: nickname,
			});
			selectedAvatar = created.nickname;
			copyDialogOpen = false;
			copyNickname = '';
		} catch (error) {
			copyError = error instanceof Error ? error.message : 'Failed to copy avatar.';
		} finally {
			copyBusy = false;
		}
	};

</script>

<WorkbenchPageToolbar>
	<div class="flex h-full items-center justify-between gap-3 px-4 md:px-5">
		<div class="min-w-0">
			<div class="text-xs uppercase tracking-[0.18em] text-muted-foreground">Avatars</div>
			<div class="truncate text-sm font-semibold">
				{selectedEntry ? `${selectedEntry.nickname} runtime catalog` : 'Global avatar catalog'}
			</div>
		</div>
		{#if selectedEntry}
			<Badge variant="outline" class="bg-background/70">{selectedEntry.runtimeId}</Badge>
		{/if}
	</div>
</WorkbenchPageToolbar>

<div
	class="grid h-full gap-4 p-4 md:grid-cols-[minmax(18rem,24rem)_minmax(0,1fr)] md:p-5"
	style="min-block-size: 0;"
	data-testid="avatar-catalog-route"
>
	<Card.Root style="min-block-size: 0;">
		<Card.Header class="border-b">
			<Card.Title>Global catalog</Card.Title>
			<Card.Description>Avatar identities are global resources. Workspaces only project their lens.</Card.Description>
		</Card.Header>
		<Card.Content class="p-0" style="min-block-size: 0;">
			<ScrollView class="h-full" contentClass="grid gap-2 p-3">
				{#if avatars.length === 0}
					<div class="rounded-xl border border-dashed px-4 py-6 text-sm text-muted-foreground">
						{catalogState.error ?? 'No avatars are available yet.'}
					</div>
				{:else}
					{#each avatars as entry (entry.runtimeId)}
						<button
							type="button"
							class={`grid gap-2 rounded-2xl border px-4 py-3 text-left transition-colors hover:bg-muted/40 ${
								selectedEntry?.runtimeId === entry.runtimeId ? 'border-primary bg-primary/5' : 'bg-card/70'
							}`}
							onclick={() => {
								selectedAvatar = entry.nickname;
							}}
						>
							<div class="flex items-center gap-3">
								<ProfileAvatar label={entry.nickname} class="size-10 rounded-xl" />
								<div class="min-w-0 flex-1">
									<div class="flex items-center gap-2">
										<div class="truncate text-sm font-semibold">{entry.nickname}</div>
										{#if entry.defaultAvatar}
											<Badge variant="secondary">Default</Badge>
										{/if}
									</div>
									<div class="truncate text-xs text-muted-foreground">{entry.runtimeId}</div>
								</div>
							</div>
						</button>
					{/each}
				{/if}
			</ScrollView>
		</Card.Content>
	</Card.Root>

	<Card.Root style="min-block-size: 0;">
		<Card.Header class="border-b">
			<Card.Title>Runtime lens</Card.Title>
			<Card.Description>Open the canonical runtime shell or jump into workspace permissions from this avatar lens.</Card.Description>
		</Card.Header>
		<Card.Content class="grid gap-4 pt-6">
			{#if !selectedEntry}
				<div class="rounded-xl border border-dashed px-4 py-6 text-sm text-muted-foreground">
					Select one avatar to inspect its runtime identity.
				</div>
			{:else}
				{#if runtimeError}
					<NoticeBanner tone="warning" title="Avatar runtime failed" message={runtimeError} class="mb-2" />
				{/if}
				<div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
					<div class="flex items-start gap-4">
						<ProfileAvatar label={selectedEntry.nickname} class="size-16 rounded-2xl" />
						<div class="grid gap-2">
							<div class="flex flex-wrap items-center gap-2">
								<h1 class="text-xl font-semibold">{selectedEntry.nickname}</h1>
								{#if selectedSession}
									<Badge variant="outline">{selectedSession.status}</Badge>
								{:else}
									<Badge variant="outline">stopped</Badge>
								{/if}
							</div>
							<p class="text-sm text-muted-foreground">
								Canonical runtime id stays stable across workspace mounts and detaches.
							</p>
						</div>
					</div>

					<div class="flex flex-wrap gap-2 lg:justify-end">
						<Button
							variant="outline"
							onclick={() => void openAvatarRuntime({ autoStart: false, tab: 'heartbeat' })}
							disabled={runtimeBusy}
						>
							<BotIcon class="size-4" />
							Open avatar
						</Button>
						<Button
							onclick={() => void openAvatarRuntime({ autoStart: true, tab: 'attention' })}
							disabled={runtimeBusy}
						>
							<PlayIcon class="size-4" />
							{runtimeBusy ? 'Starting avatar…' : 'Start avatar'}
						</Button>
						<Button
							variant="outline"
							onclick={() => {
								copyDialogOpen = true;
								copyNickname = '';
								copyError = null;
							}}
						>
							Copy avatar
						</Button>
						<Button
							variant="ghost"
							href={buildAvatarNewHref({
								draftId: nextCatalogDraftId,
								sourceAvatarNickname: selectedEntry.nickname,
							})}
						>
							<PlusIcon class="size-4" />
							New avatar tab
						</Button>
						<Button
							variant="ghost"
							onclick={() => void goto(buildWorkspaceIndexHref({ avatar: selectedEntry.nickname }))}
						>
							<ArrowUpRightIcon class="size-4" />
							Open workspaces
						</Button>
					</div>
				</div>

				<div class="grid gap-3 md:grid-cols-3">
					<div class="rounded-xl border px-4 py-3">
						<div class="text-xs uppercase tracking-[0.18em] text-muted-foreground">Runtime id</div>
						<div class="mt-2 break-all text-sm font-semibold">{selectedEntry.runtimeId}</div>
					</div>
					<div class="rounded-xl border px-4 py-3">
						<div class="text-xs uppercase tracking-[0.18em] text-muted-foreground">Global source</div>
						<div class="mt-2 break-all text-sm font-semibold">{selectedEntry.globalPath}</div>
					</div>
					<div class="rounded-xl border px-4 py-3">
						<div class="text-xs uppercase tracking-[0.18em] text-muted-foreground">Private slot</div>
						<div class="mt-2 break-all text-sm font-semibold">{selectedEntry.workspacePrivatePath}</div>
					</div>
				</div>
			{/if}
		</Card.Content>
	</Card.Root>
</div>

<Dialog.Root bind:open={copyDialogOpen}>
	<Dialog.Content class="sm:max-w-lg">
		<form
			class="grid gap-6"
			onsubmit={(event) => {
				event.preventDefault();
				void submitAvatarCopy();
			}}
		>
			<Dialog.Header>
				<Dialog.Title>Copy avatar</Dialog.Title>
				<Dialog.Description>
					Create a new global avatar identity from the current lens. Template source stays informational until copy/import flows land.
				</Dialog.Description>
			</Dialog.Header>

			<div class="grid gap-4">
				<div class="rounded-xl border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
					Source avatar: <span class="font-medium text-foreground">{selectedEntry?.nickname ?? 'Unavailable'}</span>
				</div>

				<label class="grid gap-2 text-sm font-medium">
					<span>New avatar nickname</span>
					<Input bind:value={copyNickname} placeholder="reviewer" />
				</label>

				{#if copyNicknameConflict}
					<NoticeBanner tone="warning" message="An avatar with this nickname already exists in the global catalog." />
				{/if}
				{#if copyError}
					<NoticeBanner tone="warning" title="Copy avatar failed" message={copyError} />
				{/if}
			</div>

			<Dialog.Footer>
				<Button
					type="button"
					variant="ghost"
					onclick={() => {
						copyDialogOpen = false;
					}}
				>
					Cancel
				</Button>
				<Button
					type="submit"
					disabled={copyBusy || copyNickname.trim().length === 0 || copyNicknameConflict}
				>
					{copyBusy ? 'Copying avatar…' : 'Copy avatar'}
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
