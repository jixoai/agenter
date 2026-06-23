<script lang="ts">
	import * as Skeleton from '$lib/components/ui/skeleton/index.js';

	let {
		rows = 5,
		variant = 'config-list',
		'data-testid': testId,
	}: {
		rows?: number;
		variant?: 'config-list' | 'avatar-list' | 'server-list' | 'detail' | 'inspect' | 'app-preview';
		'data-testid'?: string;
	} = $props();

	const rowIndexes = $derived(Array.from({ length: rows }, (_, index) => index));
</script>

{#if variant === 'app-preview'}
	<div class="grid min-h-[20rem] gap-3 p-3" aria-hidden="true" data-testid={testId ?? 'mcp-app-preview-skeleton'}>
		<div class="flex items-center justify-between gap-3">
			<Skeleton.Root class="h-4 w-36" />
			<div class="flex items-center gap-2">
				<Skeleton.Root class="h-5 w-16 rounded-full" />
				<Skeleton.Root class="h-5 w-20 rounded-full" />
			</div>
		</div>
		<Skeleton.Root class="min-h-[18rem] w-full rounded-md" />
	</div>
{:else if variant === 'detail'}
	<div class="grid content-start gap-4 p-4" aria-hidden="true" data-testid={testId ?? 'mcp-detail-skeleton'}>
		<div class="grid gap-2">
			<Skeleton.Root class="h-5 w-2/5" />
			<Skeleton.Root class="h-3 w-3/5" />
		</div>
		<div class="grid gap-3 sm:grid-cols-2">
			<Skeleton.Root class="h-12 w-full" />
			<Skeleton.Root class="h-12 w-full" />
			<Skeleton.Root class="h-12 w-full" />
			<Skeleton.Root class="h-12 w-full" />
		</div>
		<div class="grid gap-2">
			<Skeleton.Root class="h-3 w-full" />
			<Skeleton.Root class="h-3 w-11/12" />
			<Skeleton.Root class="h-3 w-4/5" />
		</div>
	</div>
{:else if variant === 'inspect'}
	<div
		class="grid h-full min-h-[22rem] min-w-0 grid-rows-[auto_minmax(0,1fr)] gap-2 px-4 py-3"
		aria-hidden="true"
		data-testid={testId ?? 'mcp-inspect-skeleton'}
	>
		<div class="flex min-w-0 items-center justify-between gap-3">
			<div class="flex min-w-0 items-center gap-2">
				<Skeleton.Root class="h-4 w-24" />
				<Skeleton.Root class="h-5 w-12 rounded-full" />
			</div>
			<Skeleton.Root class="h-5 w-10 rounded-full" />
		</div>
		<div class="grid min-h-0 gap-3 md:grid-cols-[minmax(12rem,0.34fr)_minmax(0,1fr)]">
			<div class="grid min-h-0 content-start gap-2">
				{#each rowIndexes.slice(0, 5) as row (row)}
					<div class="grid grid-cols-[auto_minmax(0,1fr)] gap-2 rounded-lg px-2 py-2">
						<Skeleton.Root class="size-7 rounded-lg" />
						<div class="grid min-w-0 gap-1.5">
							<Skeleton.Root class="h-4 w-3/5" />
							<Skeleton.Root class="h-3 w-4/5" />
						</div>
					</div>
				{/each}
			</div>
			<div class="grid min-h-0 content-start gap-4 rounded-lg bg-muted/20 p-3">
				<div class="flex min-w-0 items-center gap-3">
					<Skeleton.Root class="size-10 rounded-lg" />
					<div class="grid min-w-0 flex-1 gap-2">
						<Skeleton.Root class="h-4 w-2/5" />
						<Skeleton.Root class="h-3 w-3/5" />
					</div>
					<Skeleton.Root class="h-5 w-14 rounded-full" />
				</div>
				<div class="grid gap-2">
					<Skeleton.Root class="h-3 w-full" />
					<Skeleton.Root class="h-3 w-11/12" />
					<Skeleton.Root class="h-3 w-4/5" />
				</div>
				<Skeleton.Root class="h-28 w-full rounded-md" />
			</div>
		</div>
	</div>
{:else}
	<div class="grid gap-0" aria-hidden="true" data-testid={testId ?? 'mcp-list-skeleton'}>
		{#each rowIndexes as row (row)}
			<div class="grid grid-cols-[auto_minmax(0,1fr)] gap-3 border-b border-border/45 px-3 py-3 md:px-4">
				<Skeleton.Root class={variant === 'avatar-list' ? 'size-10 rounded-xl' : 'size-8 rounded-lg'} />
				<div class="grid min-w-0 gap-2">
					<div class="flex min-w-0 items-center gap-2">
						<Skeleton.Root class={variant === 'server-list' ? 'h-4 w-1/3' : 'h-4 w-2/5'} />
						<Skeleton.Root class="h-5 w-14 rounded-full" />
					</div>
					<Skeleton.Root class="h-3 w-3/5" />
					<div class="flex min-w-0 gap-1.5">
						<Skeleton.Root class="h-5 w-16 rounded-full" />
						<Skeleton.Root class="h-5 w-20 rounded-full" />
						<Skeleton.Root class="h-5 w-14 rounded-full" />
					</div>
				</div>
			</div>
		{/each}
	</div>
{/if}
