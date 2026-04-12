<script lang="ts">
	import FolderRootIcon from '@lucide/svelte/icons/folder-root';

	import ProfileAvatar from '$lib/components/profile-avatar.svelte';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import * as Select from '$lib/components/ui/select/index.js';

	import { describeWorkspace } from './workspace-sorting';

	interface WorkspaceOption {
		path: string;
		favorite?: boolean;
	}

	interface AvatarOption {
		nickname: string;
		runtimeId: string;
	}

	let {
		objectivePath,
		selectedWorkspace,
		selectedAvatar,
		selectedAvatarEntry,
		avatars,
		onAvatarChange,
	}: {
		objectivePath: string | null;
		selectedWorkspace: WorkspaceOption | null;
		selectedAvatar: string;
		selectedAvatarEntry: AvatarOption | null;
		avatars: AvatarOption[];
		onAvatarChange: (avatar: string) => void;
	} = $props();

	const avatarItems = $derived(
		avatars.map((avatar) => ({
			value: avatar.nickname,
			label: avatar.nickname,
		})),
	);
	const objectiveLabel = $derived(
		objectivePath ?? (selectedWorkspace ? describeWorkspace(selectedWorkspace.path) : 'Select a workspace root'),
	);
</script>

<section
	class="rounded-[1.25rem] border bg-card/70 px-4 py-4 shadow-[0_18px_38px_-36px_color-mix(in_srgb,var(--foreground),transparent_18%)] md:px-6"
	data-testid="workspace-content-header"
>
	<div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
		<Select.Root
			type="single"
			items={avatarItems}
			value={selectedAvatar}
			onValueChange={(value) => {
				onAvatarChange(value as string);
			}}
		>
			<Select.Trigger
				aria-label="View as"
				class="h-auto min-h-10 min-w-[14rem] justify-start rounded-full border-border/80 bg-muted/35 px-2 py-2 shadow-none"
				data-testid="workspace-avatar-select"
			>
				<div class="flex min-w-0 items-center gap-3">
					<ProfileAvatar label={selectedAvatarEntry?.nickname ?? selectedAvatar} class="size-8 rounded-2xl border-0 bg-foreground text-background" />
					<div class="grid min-w-0 text-left leading-tight">
						<span class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">View as</span>
						<span class="truncate text-sm font-semibold text-foreground">
							{selectedAvatarEntry?.nickname ?? selectedAvatar}
						</span>
					</div>
				</div>
			</Select.Trigger>
			<Select.Content>
				{#each avatars as avatar (avatar.nickname)}
					<Select.Item value={avatar.nickname} label={avatar.nickname}>{avatar.nickname}</Select.Item>
				{/each}
			</Select.Content>
		</Select.Root>

		<div class="min-w-0 flex-1">
			<div class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Workspace root</div>
			<div class="mt-1 flex flex-wrap items-center gap-2 md:gap-3">
				<div class="flex min-w-0 items-center gap-2">
					<FolderRootIcon class="size-4 shrink-0 text-muted-foreground" />
					<div class="truncate text-sm font-medium text-foreground md:text-[15px]">{objectiveLabel}</div>
				</div>
				<Badge variant="outline" class="border-emerald-200 bg-emerald-50 text-emerald-700">Persistent</Badge>
				{#if selectedWorkspace?.favorite}
					<Badge variant="secondary">Favorite</Badge>
				{/if}
				{#if selectedWorkspace?.path === '~/'}
					<Badge variant="outline">Global</Badge>
				{/if}
			</div>
		</div>
	</div>
</section>
