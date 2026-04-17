<script lang="ts">
	import ArrowUpRightIcon from '@lucide/svelte/icons/arrow-up-right';
	import BotIcon from '@lucide/svelte/icons/bot';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import PlayIcon from '@lucide/svelte/icons/play';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import { ScrollView } from '@agenter/svelte-components';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';

	import { getAppControllerContext } from '$lib/app/controller-context';
	import ProfileAvatar from '$lib/components/profile-avatar.svelte';
	import HelpHint from '$lib/components/web-components/help-hint.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Collapsible from '$lib/components/ui/collapsible/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import NoticeBanner from '$lib/components/ui/notice-banner.svelte';
	import { buildAvatarNewHref, createAvatarDraftId } from '$lib/features/avatars/avatar-workbench-location';
	import { buildWorkspaceIndexHref } from '$lib/features/workspaces/workspace-location';

	const controller = getAppControllerContext();
	type AvatarCatalogEntry = (typeof controller.runtimeState.globalAvatarCatalog.data)[number];

	let selectedAvatar = $state(page.url.searchParams.get('avatar') ?? '');
	let runtimeBusy = $state(false);
	let runtimeError = $state<string | null>(null);
	let copyDialogOpen = $state(false);
	let copyNickname = $state('');
	let copyBusy = $state(false);
	let copyError = $state<string | null>(null);
	let detailsOpen = $state(false);

	const catalogState = $derived(controller.runtimeState.globalAvatarCatalog);
	const avatars = $derived(catalogState.data);
	const selectedEntry = $derived(
		avatars.find((entry) => entry.nickname === selectedAvatar) ?? avatars[0] ?? null,
	);
	const selectedSession = $derived(
		selectedEntry ? controller.runtimeState.sessions.find((session) => session.id === selectedEntry.runtimeId) ?? null : null,
	);
	const selectedStatusLabel = $derived(selectedSession?.status ?? 'stopped');
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

	$effect(() => {
		if (!selectedEntry) {
			return;
		}
		detailsOpen = false;
	});

	const compactRuntimeId = (runtimeId: string): string => {
		const prefix = runtimeId.slice(0, 8);
		return runtimeId.length > 8 ? `${prefix}…` : prefix;
	};

	const formatStatusLabel = (status: string): string => {
		return status.length > 0 ? `${status.slice(0, 1).toUpperCase()}${status.slice(1)}` : status;
	};

	const openAvatarDraft = async (): Promise<void> => {
		if (!selectedEntry) {
			return;
		}
		await goto(
			buildAvatarNewHref({
				draftId: createAvatarDraftId(),
				sourceAvatarNickname: selectedEntry.nickname,
			}),
			{
				keepFocus: true,
				noScroll: true,
			},
		);
	};

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

{#snippet avatarCatalogEntry(entry: AvatarCatalogEntry)}
	{@const isSelected = selectedEntry?.runtimeId === entry.runtimeId}
	<div
		class={`avatar-catalog-entry transition-colors ${
			isSelected ? 'bg-[color-mix(in_srgb,var(--accent),transparent_72%)]' : 'hover:bg-muted/20'
		}`}
	>
		<button
			type="button"
			class="grid w-full grid-cols-[auto_minmax(0,1fr)] items-center gap-2.5 px-2 py-2 text-left md:px-3 md:py-2.5"
			aria-pressed={isSelected}
			onclick={() => {
				selectedAvatar = entry.nickname;
			}}
		>
			<ProfileAvatar label={entry.nickname} class="size-8 rounded-lg border-border/65 bg-background/65" />
			<div class="grid min-w-0 gap-0.5">
				<div class="truncate text-[13px] font-semibold leading-tight md:text-sm">{entry.nickname}</div>
				<div class="truncate text-[10px] leading-4 text-muted-foreground md:text-[11px]">
					{compactRuntimeId(entry.runtimeId)}
				</div>
			</div>
		</button>
	</div>
{/snippet}

<div
	class="avatar-catalog-layout grid gap-3 p-2 md:mx-auto md:w-full md:max-w-[56rem] md:grid-cols-[minmax(13rem,15rem)_minmax(22rem,36rem)] md:justify-center md:items-start md:gap-5 md:p-4 lg:max-w-[58rem] lg:grid-cols-[15rem_minmax(24rem,38rem)] lg:p-5"
	style="min-block-size: 0;"
	data-testid="avatar-catalog-route"
>
	<section class="avatar-catalog-layout__rail grid gap-2.5 md:self-start">
		<div class="grid gap-1 pb-1">
			<h2 class="text-base font-semibold">Global catalog</h2>
		</div>

		{#if avatars.length === 0}
			<div class="rounded-xl border border-dashed px-4 py-6 text-sm text-muted-foreground">
				{catalogState.error ?? 'No avatars are available yet.'}
			</div>
		{:else}
			<div class="avatar-catalog-list grid gap-0 md:hidden">
				{#each avatars as entry (entry.runtimeId)}
					{@render avatarCatalogEntry(entry)}
				{/each}
			</div>
			<div class="avatar-catalog-list hidden md:block">
				<ScrollView class="max-h-52" contentClass="grid gap-0 pr-1">
					{#each avatars as entry (entry.runtimeId)}
						{@render avatarCatalogEntry(entry)}
					{/each}
				</ScrollView>
			</div>
		{/if}
	</section>

	<section class="avatar-catalog-layout__lens grid gap-4 pt-4 md:min-w-0 md:pt-0">
		<div class="grid gap-1 pb-1">
			<div class="flex items-center gap-2">
				<h2 class="text-base font-semibold">Runtime lens</h2>
				<HelpHint
					textContext="The runtime lens stays bound to the selected avatar identity. It opens the canonical runtime first, while workspace entry remains a secondary handoff."
				>
					<p>Use the runtime lens to open the canonical avatar runtime first. Workspace navigation remains a secondary handoff from the same identity.</p>
				</HelpHint>
			</div>
		</div>

		{#if !selectedEntry}
			<div class="rounded-xl border border-dashed px-4 py-6 text-sm text-muted-foreground">
				Select one avatar to inspect its runtime identity.
			</div>
		{:else}
			{#if runtimeError}
				<NoticeBanner tone="warning" title="Avatar runtime failed" message={runtimeError} />
			{/if}
			<div class="avatar-runtime-lens__hero grid gap-3 pb-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-start md:gap-4 md:pb-3">
				<div class="flex items-start gap-3">
					<ProfileAvatar
						label={selectedEntry.nickname}
						class="size-12 rounded-xl border-border/65 bg-background/70 md:size-14"
					/>
					<div class="grid min-w-0 gap-1.5">
						<div class="grid gap-1">
							<div class="grid min-w-0 gap-0.5 md:flex md:flex-wrap md:items-baseline md:gap-x-2 md:gap-y-1">
								<h1 class="truncate text-lg font-semibold md:text-xl">{selectedEntry.nickname}</h1>
								<div class="flex flex-wrap items-center gap-x-1.5 text-[11px] font-medium text-muted-foreground md:text-xs">
									<span>{formatStatusLabel(selectedStatusLabel)}</span>
									{#if selectedEntry.defaultAvatar}
										<span aria-hidden="true">·</span>
										<span>Default</span>
									{/if}
								</div>
							</div>
						</div>
					</div>
				</div>

				<div class="grid grid-cols-2 gap-1.5 md:flex md:flex-wrap md:justify-end">
					<Button
						variant="outline"
						size="sm"
						class="w-full md:w-auto"
						onclick={() => void openAvatarRuntime({ autoStart: false, tab: 'heartbeat' })}
						disabled={runtimeBusy}
					>
						<BotIcon class="size-4" />
						Open avatar
					</Button>
					<Button
						size="sm"
						class="w-full md:w-auto"
						onclick={() => void openAvatarRuntime({ autoStart: true, tab: 'attention' })}
						disabled={runtimeBusy}
					>
						<PlayIcon class="size-4" />
						{runtimeBusy ? 'Starting avatar…' : 'Start avatar'}
					</Button>
				</div>
			</div>

			<div class="avatar-runtime-primary-fact grid gap-1.5 py-2.5 md:gap-1 md:py-3">
				<div class="avatar-runtime-fact-label avatar-runtime-fact-label--primary">Canonical runtime</div>
				<div class="avatar-runtime-fact-value avatar-runtime-fact-value--primary break-all">{selectedEntry.runtimeId}</div>
			</div>

			<div class="avatar-runtime-secondary-actions flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] font-medium text-muted-foreground">
				<button
					type="button"
					class="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
					onclick={() => void openAvatarDraft()}
				>
					<PlusIcon class="size-3.5" />
					Create draft from this avatar
				</button>
				<button
					type="button"
					class="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
					onclick={() => void goto(buildWorkspaceIndexHref({ avatar: selectedEntry.nickname }))}
				>
					<ArrowUpRightIcon class="size-3.5" />
					Open workspaces
				</button>
			</div>

			<Collapsible.Root bind:open={detailsOpen}>
				<div class="avatar-runtime-facts avatar-runtime-details grid gap-0">
					<Collapsible.Trigger class="flex w-full items-center justify-between py-3 text-left text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
						<span>Runtime details</span>
						<ChevronDownIcon class={`size-4 transition-transform ${detailsOpen ? 'rotate-180' : ''}`} />
					</Collapsible.Trigger>
					<Collapsible.Content class="grid gap-0 pb-1">
						<div class="avatar-runtime-facts__block avatar-runtime-fact-row grid gap-1 py-3 md:grid-cols-[8rem_minmax(0,1fr)] md:gap-4 md:items-start">
							<div class="avatar-runtime-fact-label">Global source</div>
							<div class="avatar-runtime-fact-value break-all">{selectedEntry.globalPath}</div>
						</div>
						<div class="avatar-runtime-facts__block avatar-runtime-fact-row grid gap-1 py-3 md:grid-cols-[8rem_minmax(0,1fr)] md:gap-4 md:items-start">
							<div class="avatar-runtime-fact-label">Private slot</div>
							<div class="avatar-runtime-fact-value break-all">{selectedEntry.workspacePrivatePath}</div>
						</div>
						<div class="avatar-runtime-facts__block avatar-runtime-details__actions flex flex-wrap items-center gap-x-4 gap-y-2 py-3 text-sm">
							<button
								type="button"
								class="inline-flex items-center gap-1.5 font-medium text-muted-foreground transition-colors hover:text-foreground"
								onclick={() => {
									copyDialogOpen = true;
									copyNickname = '';
									copyError = null;
								}}
							>
								Copy avatar
							</button>
						</div>
					</Collapsible.Content>
				</div>
			</Collapsible.Root>
		{/if}
	</section>
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
				<div class="border-b border-border/40 pb-3 text-sm text-muted-foreground">
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

<style>
	.avatar-catalog-layout__rail,
	.avatar-catalog-layout__lens,
	.avatar-catalog-list,
	.avatar-catalog-entry,
	.avatar-runtime-lens__hero,
	.avatar-runtime-primary-fact,
	.avatar-runtime-facts,
	.avatar-runtime-facts__block {
		position: relative;
	}

	.avatar-catalog-layout__lens::before {
		content: '';
		position: absolute;
		inset-inline: 0;
		inset-block-start: 0;
		block-size: 1px;
		background: linear-gradient(
			90deg,
			transparent 0%,
			color-mix(in srgb, var(--border), transparent 18%) 18%,
			color-mix(in srgb, var(--border), transparent 68%) 100%
		);
	}

	.avatar-catalog-list::before,
	.avatar-catalog-list::after {
		content: '';
		position: absolute;
		inset-inline: 0.65rem;
		block-size: 1px;
		background: color-mix(in srgb, var(--border), transparent 28%);
	}

	.avatar-catalog-list::before {
		inset-block-start: 0;
	}

	.avatar-catalog-list::after {
		inset-block-end: 0;
	}

	.avatar-catalog-entry + .avatar-catalog-entry::before {
		content: '';
		position: absolute;
		inset-block-start: 0;
		inset-inline-start: 3.15rem;
		inset-inline-end: 0.65rem;
		block-size: 1px;
		background: color-mix(in srgb, var(--border), transparent 36%);
	}

	.avatar-runtime-primary-fact::before,
	.avatar-runtime-facts::before,
	.avatar-runtime-facts__block + .avatar-runtime-facts__block::before {
		content: '';
		position: absolute;
		inset-inline-start: 0.75rem;
		inset-inline-end: 0;
		inset-block-start: 0;
		block-size: 1px;
		background: linear-gradient(
			90deg,
			color-mix(in srgb, var(--border), transparent 14%) 0%,
			color-mix(in srgb, var(--border), transparent 44%) 72%,
			transparent 100%
		);
	}

	.avatar-runtime-secondary-actions {
		padding-block: 0.1rem 0.35rem;
	}

	.avatar-runtime-fact-label {
		font-size: 0.75rem;
		line-height: 1rem;
		font-weight: 500;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: var(--muted-foreground);
	}

	.avatar-runtime-fact-label--primary {
		font-size: 0.78rem;
		font-weight: 600;
		letter-spacing: 0.02em;
		text-transform: none;
	}

	.avatar-runtime-fact-value {
		font-size: 13px;
		line-height: 1.25rem;
		font-weight: 600;
	}

	.avatar-runtime-fact-value--primary {
		font-size: 0.95rem;
		line-height: 1.4rem;
	}

	@media (min-width: 768px) {
		.avatar-catalog-layout__rail {
			padding-inline-end: 0.25rem;
		}

		.avatar-catalog-layout__rail::after {
			content: '';
			position: absolute;
			inset-block: 0.5rem 0.25rem;
			inset-inline-end: -0.625rem;
			inline-size: 1px;
			background: linear-gradient(
				180deg,
				transparent 0%,
				color-mix(in srgb, var(--border), transparent 20%) 14%,
				color-mix(in srgb, var(--border), transparent 56%) 86%,
				transparent 100%
			);
		}

		.avatar-catalog-layout__lens::before {
			display: none;
		}

		.avatar-runtime-primary-fact {
			padding-inline-start: 4.25rem;
		}

		.avatar-runtime-primary-fact::before {
			inset-inline-start: 4.25rem;
			inset-inline-end: 0;
		}

		.avatar-runtime-secondary-actions {
			padding-inline-start: 4.25rem;
			padding-block: 0.05rem 0.45rem;
		}

		.avatar-runtime-facts::before,
		.avatar-runtime-facts__block + .avatar-runtime-facts__block::before {
			inset-inline-start: 8rem;
			inset-inline-end: 0;
		}

		.avatar-runtime-fact-label--primary {
			padding-block-start: 0.12rem;
		}

		.avatar-catalog-entry + .avatar-catalog-entry::before {
			inset-inline-start: 3.75rem;
			inset-inline-end: 0.9rem;
		}

		.avatar-catalog-list::before,
		.avatar-catalog-list::after {
			inset-inline: 0.9rem;
		}
	}
</style>
