<script lang="ts">
	import FolderRootIcon from '@lucide/svelte/icons/folder-root';

	import { Badge } from '$lib/components/ui/badge/index.js';

	import { describeCompactWorkspace, describeWorkspace } from './workspace-sorting';

	interface WorkspaceOption {
		path: string;
		favorite?: boolean;
	}

	let {
		objectivePath,
		selectedWorkspace,
		surfaceKind,
		surfaceSummary,
	}: {
		objectivePath: string | null;
		selectedWorkspace: WorkspaceOption | null;
		surfaceKind: 'root-workspace' | 'public-workspace';
		surfaceSummary: string;
	} = $props();
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
</section>
