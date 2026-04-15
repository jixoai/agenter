<script lang="ts">
	import FolderRootIcon from '@lucide/svelte/icons/folder-root';

	import ProfileAvatar from '$lib/components/profile-avatar.svelte';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import * as Select from '$lib/components/ui/select/index.js';

	import { describeCompactWorkspace, describeWorkspace } from './workspace-sorting';

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
	const objectiveCompactLabel = $derived(
		objectivePath
			? describeCompactWorkspace(objectivePath)
			: selectedWorkspace
				? describeCompactWorkspace(selectedWorkspace.path)
				: 'Workspace root',
	);
</script>

<section
	class="min-w-0 w-full rounded-[1.05rem] border bg-card/70 px-3 py-3 shadow-[0_18px_38px_-36px_color-mix(in_srgb,var(--foreground),transparent_18%)] md:rounded-[1.25rem] md:px-6 md:py-4"
	data-testid="workspace-content-header"
>
	<div class="flex min-w-0 flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-4">
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
				class="h-auto min-h-10 w-full min-w-0 justify-start rounded-2xl border-border/80 bg-muted/35 px-2 py-2 shadow-none md:min-w-[14rem] md:w-auto md:rounded-full"
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
			<div class="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground md:text-[11px]">Workspace root</div>
			<div class="mt-1.5 grid min-w-0 gap-2">
				<div class="flex min-w-0 items-start gap-2">
					<FolderRootIcon class="size-4 shrink-0 text-muted-foreground" />
					<div class="min-w-0">
						<div class="truncate text-sm font-semibold text-foreground md:hidden">{objectiveCompactLabel}</div>
						<div class="truncate text-sm font-medium text-foreground md:hidden">{objectiveLabel}</div>
						<div class="hidden truncate text-sm font-medium text-foreground md:block md:text-[15px]">{objectiveLabel}</div>
					</div>
				</div>
				<div class="flex flex-wrap items-center gap-1.5 md:gap-2">
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
	</div>
</section>
