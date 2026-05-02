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
		iconUrl?: string | null;
	}

	let {
		objectivePath,
		selectedWorkspace,
		selectedAvatar,
		selectedAvatarEntry,
		surfaceKind,
		surfaceSummary,
		avatars,
		onAvatarChange,
	}: {
		objectivePath: string | null;
		selectedWorkspace: WorkspaceOption | null;
		selectedAvatar: string;
		selectedAvatarEntry: AvatarOption | null;
		surfaceKind: 'root-workspace' | 'public-workspace';
		surfaceSummary: string;
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
	const surfaceKindLabel = $derived(surfaceKind === 'root-workspace' ? 'Root workspace' : 'Public workspace');
	const surfaceKindClassName = $derived(
		surfaceKind === 'root-workspace'
			? 'border-amber-200 bg-amber-50 text-amber-700'
			: 'border-sky-200 bg-sky-50 text-sky-700',
	);
	const surfaceProfileLabel = $derived(
		surfaceKind === 'root-workspace' ? 'Root-exclusive env + CLI' : 'Collaboration env surface',
	);
</script>

<section
	class="min-w-0 w-full border-b border-border/45 px-0 py-2 md:py-2.5"
	data-testid="workspace-content-header"
>
	<div class="grid min-w-0 grid-cols-[minmax(0,10.5rem)_minmax(0,1fr)] items-center gap-2 md:grid-cols-[minmax(0,13rem)_minmax(0,1fr)] md:gap-3.5">
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
				class="h-10 min-h-10 w-full min-w-0 justify-start rounded-[0.8rem] border-0 bg-muted/35 px-2 py-1.5 shadow-none md:h-11 md:rounded-[0.9rem] md:px-2.5"
				data-testid="workspace-avatar-select"
			>
				<div class="flex min-w-0 items-center gap-2">
					<ProfileAvatar
						label={selectedAvatarEntry?.nickname ?? selectedAvatar}
						src={selectedAvatarEntry?.iconUrl ?? null}
						class="size-7 rounded-[0.72rem] border-0 bg-foreground text-background md:size-8 md:rounded-[0.82rem]"
					/>
					<div class="grid min-w-0 text-left leading-tight">
						<span class="hidden text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground md:block">View as</span>
						<span class="truncate text-sm font-semibold text-foreground md:text-[15px]">
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

		<div class="grid min-w-0 gap-1">
			<div class="text-[9px] font-medium uppercase tracking-[0.16em] text-muted-foreground md:text-[10px]">Workspace root</div>
			<div class="grid min-w-0 gap-1.5">
				<div class="flex min-w-0 items-center gap-2">
					<FolderRootIcon class="size-4 shrink-0 text-muted-foreground" />
					<div class="min-w-0 flex-1">
						<div class="truncate text-sm font-semibold leading-tight text-foreground md:hidden" title={objectiveLabel}>
							{objectiveCompactLabel}
						</div>
						<div
							class="hidden truncate text-sm font-medium leading-tight text-foreground md:block md:text-[15px]"
							title={objectiveLabel}
						>
							{objectiveLabel}
						</div>
					</div>
				</div>
				<div class="flex flex-wrap items-center gap-1.5">
					<Badge
						variant="outline"
						class={`h-5 px-1.5 text-[10px] ${surfaceKindClassName}`}
						data-testid="workspace-surface-kind"
					>
						{surfaceKindLabel}
					</Badge>
					<Badge variant="outline" class="h-5 px-1.5 text-[10px]" data-testid="workspace-surface-profile">
						{surfaceProfileLabel}
					</Badge>
					<Badge variant="outline" class="h-5 border-emerald-200 bg-emerald-50 px-1.5 text-[10px] text-emerald-700">
						Persistent
					</Badge>
					{#if selectedWorkspace?.favorite}
						<Badge variant="secondary" class="h-5 px-1.5 text-[10px]">Favorite</Badge>
					{/if}
					{#if selectedWorkspace?.path === '~/'}
						<Badge variant="outline" class="h-5 px-1.5 text-[10px]">Global</Badge>
					{/if}
				</div>
				<div class="text-[11px] leading-snug text-muted-foreground" data-testid="workspace-surface-summary">
					{surfaceSummary}
				</div>
			</div>
		</div>
	</div>
</section>
