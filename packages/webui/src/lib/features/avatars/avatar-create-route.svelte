<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';

	import { getAppControllerContext } from '$lib/app/controller-context';
	import ProfileAvatar from '$lib/components/profile-avatar.svelte';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import NoticeBanner from '$lib/components/ui/notice-banner.svelte';
	import * as Select from '$lib/components/ui/select/index.js';
	import WorkbenchScaffold from '$lib/features/navigation/workbench-scaffold.svelte';

	import { buildAvatarCatalogHref, readAvatarNewSourceNickname } from './avatar-workbench-location';
	import {
		AVATAR_CREATE_TABS_CHANGE_EVENT,
		readAvatarCreateTabs,
		removeAvatarCreateTab,
		upsertAvatarCreateTab,
	} from './avatar-create-tabs-state';

	let {
		draftId,
	}: {
		draftId: string;
	} = $props();

	const controller = getAppControllerContext();

	let draftNickname = $state('');
	let sourceAvatarNickname = $state(readAvatarNewSourceNickname(page.url.searchParams) ?? '');
	let draftReady = $state(false);
	let storedTabs = $state(readAvatarCreateTabs());
	let createBusy = $state(false);
	let createError = $state<string | null>(null);
	const activeDraftHref = $derived(`${page.url.pathname}${page.url.search}`);

	const avatars = $derived(controller.runtimeState.globalAvatarCatalog.data);
	const sourceItems = $derived(
		avatars.map((avatar) => ({
			value: avatar.nickname,
			label: avatar.nickname,
		})),
	);
	const selectedSource = $derived(avatars.find((avatar) => avatar.nickname === sourceAvatarNickname) ?? avatars[0] ?? null);
	const nicknameConflict = $derived(
		draftNickname.trim().length > 0 && avatars.some((avatar) => avatar.nickname === draftNickname.trim().toLowerCase()),
	);
	const templateHint =
		'Template source currently seeds the draft context only. Runtime memory and workspace-private content stay isolated until follow-up copy/import flows land.';

	$effect(() => {
		const release = controller.runtimeStore.retainGlobalAvatarCatalog();
		void controller.runtimeStore.hydrateGlobalAvatarCatalog();
		return () => {
			release();
		};
	});

	onMount(() => {
		const current = readAvatarCreateTabs().find((entry) => entry.draftId === draftId) ?? null;
		if (current) {
			draftNickname = current.draftNickname;
			sourceAvatarNickname = current.sourceAvatarNickname || sourceAvatarNickname;
		}
		draftReady = true;
	});

	$effect(() => {
		if (typeof window === 'undefined') {
			return;
		}
		const syncDrafts = (): void => {
			storedTabs = readAvatarCreateTabs();
		};
		window.addEventListener(AVATAR_CREATE_TABS_CHANGE_EVENT, syncDrafts);
		window.addEventListener('storage', syncDrafts);
		return () => {
			window.removeEventListener(AVATAR_CREATE_TABS_CHANGE_EVENT, syncDrafts);
			window.removeEventListener('storage', syncDrafts);
		};
	});

	$effect(() => {
		if (!draftReady || avatars.length === 0) {
			return;
		}
		if (!sourceAvatarNickname || !avatars.some((avatar) => avatar.nickname === sourceAvatarNickname)) {
			sourceAvatarNickname = avatars[0]!.nickname;
		}
	});

	$effect(() => {
		if (!draftReady) {
			return;
		}
		storedTabs = upsertAvatarCreateTab(storedTabs, {
			draftId,
			href: activeDraftHref,
			draftNickname,
			sourceAvatarNickname,
		});
	});

	const closeDraft = async (): Promise<void> => {
		const closingDraftId = draftId;
		const fallbackAvatar = sourceAvatarNickname || draftNickname || undefined;
		await goto(buildAvatarCatalogHref({ avatar: fallbackAvatar }), {
			keepFocus: true,
			noScroll: true,
		});
		storedTabs = removeAvatarCreateTab(storedTabs, closingDraftId);
	};

	const createAvatar = async (): Promise<void> => {
		const nickname = draftNickname.trim();
		if (nickname.length === 0 || createBusy || nicknameConflict) {
			return;
		}
		createBusy = true;
		createError = null;
		try {
			const created = await controller.runtimeStore.createGlobalAvatar({
				nickname,
				displayName: nickname,
			});
			storedTabs = removeAvatarCreateTab(storedTabs, draftId);
			await goto(buildAvatarCatalogHref({ avatar: created.nickname }), {
				keepFocus: true,
				noScroll: true,
			});
		} catch (error) {
			createError = error instanceof Error ? error.message : 'Failed to create avatar.';
		} finally {
			createBusy = false;
		}
	};
</script>

<WorkbenchScaffold
	tone="page"
	body="scroll"
	contentClass="mx-auto grid w-full max-w-5xl gap-6"
	data-testid="avatar-create-route"
>
	{#snippet header()}
		<div class="grid gap-2">
			<div class="flex flex-wrap items-center gap-2">
				<h2 class="text-base font-semibold">New avatar</h2>
				<Badge variant="outline">Draft {draftId.slice(0, 8)}</Badge>
			</div>
			<p class="text-sm text-muted-foreground">
				Each draft lives in its own browser-style tab so you can stage multiple avatar creations in parallel.
			</p>
		</div>
	{/snippet}

	<NoticeBanner tone="info" message={templateHint} />
	{#if createError}
		<NoticeBanner tone="warning" title="Create avatar failed" message={createError} />
	{/if}

	<section class="grid gap-6 rounded-[1rem] border border-border/60 bg-background/45 p-4 md:p-5">
		<label class="grid gap-2 text-sm font-medium">
			<span>Avatar nickname</span>
			<Input bind:value={draftNickname} placeholder="reviewer" />
			<span class="text-xs font-normal text-muted-foreground">
				The nickname becomes the durable global avatar identity and must stay unique across the catalog.
			</span>
		</label>

		<label class="grid gap-2 text-sm font-medium">
			<span>Template source</span>
			<Select.Root
				type="single"
				items={sourceItems}
				value={sourceAvatarNickname}
				onValueChange={(value) => {
					sourceAvatarNickname = value as string;
				}}
			>
				<Select.Trigger aria-label="Template source" class="w-full justify-start">
					{selectedSource?.nickname ?? 'Select template source'}
				</Select.Trigger>
				<Select.Content>
					{#each avatars as avatar (avatar.runtimeId)}
						<Select.Item value={avatar.nickname} label={avatar.nickname}>{avatar.nickname}</Select.Item>
					{/each}
				</Select.Content>
			</Select.Root>
			<span class="text-xs font-normal text-muted-foreground">
				The selected source is kept as draft context for future template/copy flows. It does not change the durable identity created today.
			</span>
		</label>
	</section>

	<section class="grid gap-4 rounded-[1rem] border border-border/60 bg-background/45 p-4 md:grid-cols-[auto_minmax(0,1fr)] md:items-start md:p-5">
		{#if selectedSource}
			<ProfileAvatar label={selectedSource.nickname} class="size-14 rounded-2xl" />
		{:else}
			<div class="size-14 rounded-2xl border border-dashed"></div>
		{/if}
		<div class="grid gap-3">
			<div>
				<div class="text-sm font-semibold">
					{draftNickname.trim().length > 0 ? draftNickname.trim() : 'Unnamed avatar draft'}
				</div>
				<div class="text-sm text-muted-foreground">
					{selectedSource
						? `Template source: ${selectedSource.nickname}`
						: 'Choose one source avatar once the global catalog finishes loading.'}
				</div>
			</div>
			<div class="grid gap-2 md:grid-cols-3">
				<div class="rounded-xl border px-4 py-3">
					<div class="text-xs uppercase tracking-[0.18em] text-muted-foreground">Target scope</div>
					<div class="mt-2 text-sm font-medium">Global avatar catalog</div>
				</div>
				<div class="rounded-xl border px-4 py-3">
					<div class="text-xs uppercase tracking-[0.18em] text-muted-foreground">Route</div>
					<div class="mt-2 break-all text-sm font-medium">/avatars/new/{draftId}</div>
				</div>
				<div class="rounded-xl border px-4 py-3">
					<div class="text-xs uppercase tracking-[0.18em] text-muted-foreground">State</div>
					<div class="mt-2 text-sm font-medium">{createBusy ? 'Creating…' : 'Ready to create'}</div>
				</div>
			</div>
		</div>
	</section>

	{#if nicknameConflict}
		<NoticeBanner tone="warning" message="An avatar with this nickname already exists in the global catalog." />
	{/if}

	<div class="flex flex-wrap justify-end gap-2">
		<Button variant="outline" onclick={() => void closeDraft()}>Close draft</Button>
		<Button
			onclick={() => void createAvatar()}
			disabled={createBusy || draftNickname.trim().length === 0 || nicknameConflict}
		>
			{createBusy ? 'Creating avatar…' : 'Create avatar'}
		</Button>
	</div>
</WorkbenchScaffold>
