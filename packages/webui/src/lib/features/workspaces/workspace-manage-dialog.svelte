<script lang="ts">
	import { ScrollView } from '@agenter/svelte-components';
	import XIcon from '@lucide/svelte/icons/x';

	import ProfileAvatar from '$lib/components/profile-avatar.svelte';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import * as Item from '$lib/components/ui/item/index.js';

	import type { WorkspaceManageAvatarRow } from './workspace-manage-dialog.types';

	interface Props {
		open?: boolean;
		workspacePath: string | null;
		selectedAvatar: string;
		rows: WorkspaceManageAvatarRow[];
		loading?: boolean;
		error?: string | null;
		disableManageDialogPortal?: boolean;
		onMountAvatar: (row: WorkspaceManageAvatarRow) => Promise<void>;
		onUnmountAvatar: (row: WorkspaceManageAvatarRow) => Promise<void>;
		onOpenAvatar: (nickname: string) => void;
	}

	let {
		open = $bindable(false),
		workspacePath,
		selectedAvatar,
		rows,
		loading = false,
		error = null,
		disableManageDialogPortal = false,
		onMountAvatar,
		onUnmountAvatar,
		onOpenAvatar,
	}: Props = $props();

	let busyRuntimeId = $state<string | null>(null);
	let actionError = $state<string | null>(null);

	const applyAction = async (
		row: WorkspaceManageAvatarRow,
		action: (target: WorkspaceManageAvatarRow) => Promise<void>,
	): Promise<void> => {
		if (busyRuntimeId) {
			return;
		}
		busyRuntimeId = row.runtimeId;
		actionError = null;
		try {
			await action(row);
		} catch (nextError) {
			actionError = nextError instanceof Error ? nextError.message : String(nextError);
		} finally {
			busyRuntimeId = null;
		}
	};
</script>

<Dialog.Root bind:open>
	<Dialog.Content
		class="left-0 top-0 h-svh w-svw max-w-none translate-x-0 translate-y-0 gap-0 rounded-none p-0 sm:left-[50%] sm:top-[50%] sm:h-auto sm:w-full sm:max-w-4xl sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-[1.4rem]"
		portalProps={disableManageDialogPortal ? { disabled: true } : undefined}
		showCloseButton={false}
		data-testid="workspace-manage-dialog"
	>
		<Dialog.Header class="sr-only">
			<Dialog.Title>Manage workspace</Dialog.Title>
			<Dialog.Description>Mount or unmount this workspace for each avatar.</Dialog.Description>
		</Dialog.Header>

		<div class="grid gap-0">
			<div class="flex items-start justify-between gap-4 border-b px-4 py-4 sm:px-6">
				<div class="grid gap-1">
					<div class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
						Workspace management
					</div>
					<div class="break-all text-base font-semibold text-foreground">
						{workspacePath ?? 'Select a workspace root'}
					</div>
					<div class="max-w-2xl text-sm text-muted-foreground">
						Mount or detach this workspace per avatar. Detailed file rules still live in the main Rules view.
					</div>
				</div>
				<Dialog.Close
					class="ring-offset-background focus:ring-ring inline-flex size-9 shrink-0 items-center justify-center rounded-full opacity-70 transition-opacity hover:bg-muted hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden"
				>
					<XIcon class="size-4" />
					<span class="sr-only">Close</span>
				</Dialog.Close>
			</div>

			<ScrollView class="max-h-[min(70svh,36rem)]" contentClass="grid auto-rows-max gap-3 p-4 sm:p-6">
				{#if error || actionError}
					<Item.Root size="sm" variant="muted" class="border-destructive/40 bg-destructive/5 text-destructive">
						{error ?? actionError}
					</Item.Root>
				{/if}

				{#if !workspacePath}
					<Item.Root size="sm" variant="muted" class="py-8 text-sm text-muted-foreground">
						Select a workspace root first.
					</Item.Root>
				{:else if loading}
					<Item.Root size="sm" variant="muted" class="py-8 text-sm text-muted-foreground">
						Loading avatar mount state…
					</Item.Root>
				{:else if rows.length === 0}
					<Item.Root size="sm" variant="muted" class="py-8 text-sm text-muted-foreground">
						No avatars are available for this workspace yet.
					</Item.Root>
				{:else}
					{#each rows as row (row.runtimeId)}
						<Item.Root
							size="sm"
							class="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"
							data-testid={`workspace-manage-row-${row.nickname}`}
						>
							<div class="flex min-w-0 items-start gap-3">
								<ProfileAvatar
									label={row.nickname}
									src={row.iconUrl ?? null}
									class="mt-0.5 size-10 rounded-2xl border-0 bg-foreground text-background"
								/>
								<div class="grid min-w-0 gap-1">
									<div class="flex flex-wrap items-center gap-2">
										<div class="truncate text-sm font-semibold">{row.nickname}</div>
										{#if selectedAvatar === row.nickname}
											<Badge variant="secondary" class="rounded-full text-[10px] uppercase tracking-[0.16em]">
												Current lens
											</Badge>
										{/if}
										{#if row.mountKind === 'avatar-root'}
											<Badge variant="outline" class="rounded-full text-[10px] uppercase tracking-[0.16em]">
												Root workspace
											</Badge>
										{:else if row.mountKind === 'workspace'}
											<Badge variant="secondary" class="rounded-full text-[10px] uppercase tracking-[0.16em]">
												Public workspace
											</Badge>
										{:else}
											<Badge variant="outline" class="rounded-full text-[10px] uppercase tracking-[0.16em]">
												Detached
											</Badge>
										{/if}
										{#if row.grantCount > 0}
											<Badge variant="outline" class="rounded-full text-[10px] uppercase tracking-[0.16em]">
												{row.grantCount} rules
											</Badge>
										{/if}
									</div>
									<div class="break-all text-xs text-muted-foreground">{row.accessSummary}</div>
								</div>
							</div>

							<div class="flex flex-wrap items-center gap-2 lg:justify-end">
								<Button
									size="sm"
									variant={selectedAvatar === row.nickname ? 'secondary' : 'outline'}
									data-testid={`workspace-manage-open-${row.nickname}`}
									onclick={() => {
										onOpenAvatar(row.nickname);
									}}
								>
									Open rules
								</Button>
								{#if row.mountKind === 'workspace'}
									<Button
										size="sm"
										variant="outline"
										disabled={busyRuntimeId === row.runtimeId}
										data-testid={`workspace-manage-unmount-${row.nickname}`}
										onclick={() => {
											void applyAction(row, onUnmountAvatar);
										}}
									>
										{busyRuntimeId === row.runtimeId ? 'Working…' : 'Unmount'}
									</Button>
								{:else if row.mountKind === null}
									<Button
										size="sm"
										disabled={busyRuntimeId === row.runtimeId}
										data-testid={`workspace-manage-mount-${row.nickname}`}
										onclick={() => {
											void applyAction(row, onMountAvatar);
										}}
									>
										{busyRuntimeId === row.runtimeId ? 'Working…' : 'Mount'}
									</Button>
								{/if}
							</div>
						</Item.Root>
					{/each}
				{/if}
			</ScrollView>
		</div>
	</Dialog.Content>
</Dialog.Root>
