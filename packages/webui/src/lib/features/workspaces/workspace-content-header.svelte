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
	class="min-w-0 w-full rounded-[0.95rem] border bg-card/70 px-3 py-2.5 shadow-[0_18px_38px_-36px_color-mix(in_srgb,var(--foreground),transparent_18%)] md:rounded-[1.25rem] md:px-6 md:py-4"
	data-testid="workspace-content-header"
>
	<div class="flex min-w-0 flex-col gap-2.5 md:flex-row md:items-center md:justify-between md:gap-4">
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
				class="h-10 min-h-10 w-full min-w-0 justify-start rounded-[1rem] border-border/70 bg-muted/25 px-2.5 py-1.5 shadow-none md:h-auto md:min-w-[14rem] md:w-auto md:rounded-full md:border-border/80 md:bg-muted/35 md:px-2 md:py-2"
				data-testid="workspace-avatar-select"
			>
				<div class="flex min-w-0 items-center gap-2.5">
					<ProfileAvatar
						label={selectedAvatarEntry?.nickname ?? selectedAvatar}
						class="size-7 rounded-[0.95rem] border-0 bg-foreground text-background md:size-8 md:rounded-2xl"
					/>
					<div class="grid min-w-0 text-left leading-tight">
						<span class="hidden text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground md:block">View as</span>
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
			<div class="mt-1 grid min-w-0 gap-1.5">
				<div class="flex min-w-0 items-start gap-2">
					<FolderRootIcon class="size-4 shrink-0 text-muted-foreground" />
					<div class="min-w-0">
						<div class="truncate text-sm font-semibold text-foreground md:hidden" title={objectiveLabel}>{objectiveCompactLabel}</div>
						<div class="hidden truncate text-sm font-medium text-foreground md:block md:text-[15px]" title={objectiveLabel}>
							{objectiveLabel}
						</div>
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
