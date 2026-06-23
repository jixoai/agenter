<script lang="ts">
	import * as Skeleton from '$lib/components/ui/skeleton/index.js';
	import { cn } from '$lib/utils.js';

	type AvatarLoadingSkeletonVariant = 'catalog-list' | 'catalog-detail' | 'draft' | 'skill-browser';

	let {
		variant,
		rows = 6,
		class: className,
	}: {
		variant: AvatarLoadingSkeletonVariant;
		rows?: number;
		class?: string;
	} = $props();

	const rowIndexes = $derived(Array.from({ length: Math.max(1, rows) }, (_, index) => index));
</script>

{#if variant === 'catalog-list'}
	<div
		aria-hidden="true"
		class={cn('divide-y divide-border/50', className)}
		data-testid="avatar-catalog-skeleton"
	>
		{#each rowIndexes as row (row)}
			<div class="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 px-3 py-3 md:px-4 md:py-3.5">
				<Skeleton.Root class="size-9 rounded-xl" />
				<div class="grid min-w-0 gap-2">
					<Skeleton.Root class="h-3.5 w-28" />
					<Skeleton.Root class="h-3 w-20" />
				</div>
			</div>
		{/each}
	</div>
{:else if variant === 'catalog-detail'}
	<div
		aria-hidden="true"
		class={cn('grid content-start gap-4 p-1', className)}
		data-testid="avatar-catalog-detail-skeleton"
	>
		<div class="flex items-start gap-3">
			<Skeleton.Root class="size-12 rounded-xl md:size-14" />
			<div class="grid min-w-0 flex-1 gap-2">
				<Skeleton.Root class="h-5 w-40" />
				<Skeleton.Root class="h-3 w-28" />
			</div>
		</div>
		<div class="grid gap-2 sm:grid-cols-2">
			<Skeleton.Root class="h-9 w-full" />
			<Skeleton.Root class="h-9 w-full" />
		</div>
		<div class="grid gap-3 rounded-[0.9rem] bg-muted/24 px-4 py-4">
			<Skeleton.Root class="h-3 w-28" />
			<Skeleton.Root class="h-4 w-full" />
			<Skeleton.Root class="h-4 w-3/4" />
		</div>
		<div class="grid gap-2 rounded-[0.9rem] border border-border/50 px-4 py-4">
			<Skeleton.Root class="h-3 w-24" />
			<Skeleton.Root class="h-4 w-full" />
			<Skeleton.Root class="h-4 w-5/6" />
		</div>
	</div>
{:else if variant === 'draft'}
	<div aria-hidden="true" class={cn('grid gap-6', className)} data-testid="avatar-create-skeleton">
		<div class="grid gap-4 rounded-[1rem] border border-border/60 bg-background/45 p-4 md:p-5">
			<div class="grid gap-2">
				<Skeleton.Root class="h-3 w-32" />
				<Skeleton.Root class="h-9 w-full" />
				<Skeleton.Root class="h-3 w-3/4" />
			</div>
			<div class="grid gap-2">
				<Skeleton.Root class="h-3 w-28" />
				<Skeleton.Root class="h-9 w-full" />
				<Skeleton.Root class="h-3 w-5/6" />
			</div>
		</div>
		<div class="grid gap-4 rounded-[1rem] border border-border/60 bg-background/45 p-4 md:grid-cols-[auto_minmax(0,1fr)] md:p-5">
			<Skeleton.Root class="size-14 rounded-2xl" />
			<div class="grid gap-4">
				<div class="grid gap-2">
					<Skeleton.Root class="h-4 w-40" />
					<Skeleton.Root class="h-3 w-56" />
				</div>
				<div class="grid gap-2 md:grid-cols-3">
					<Skeleton.Root class="h-20 w-full rounded-xl" />
					<Skeleton.Root class="h-20 w-full rounded-xl" />
					<Skeleton.Root class="h-20 w-full rounded-xl" />
				</div>
			</div>
		</div>
	</div>
{:else}
	<div aria-hidden="true" class={cn('grid gap-4 p-4', className)} data-testid="avatar-skill-browser-skeleton">
		<div class="grid gap-2">
			<Skeleton.Root class="h-4 w-44" />
			<Skeleton.Root class="h-3 w-64 max-w-full" />
		</div>
		<div class="grid gap-3">
			{#each rowIndexes as row (row)}
				<div class="grid gap-3 rounded-[1rem] border border-border/60 bg-background/45 p-4">
					<div class="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3">
						<Skeleton.Root class="size-4 rounded-md" />
						<div class="grid gap-2">
							<Skeleton.Root class="h-4 w-36" />
							<Skeleton.Root class="h-3 w-full" />
							<Skeleton.Root class="h-3 w-4/5" />
						</div>
						<Skeleton.Root class="h-5 w-14 rounded-full" />
					</div>
				</div>
			{/each}
		</div>
	</div>
{/if}
