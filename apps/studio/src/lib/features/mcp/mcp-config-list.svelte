<script lang="ts">
	import { ScrollView } from '@agenter/svelte-components';

	import ProfileAvatar from '$lib/components/profile-avatar.svelte';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { cn } from '$lib/utils.js';

	import { buildMcpConfigSelectionKey, type McpConfigCatalogRow } from './mcp-workbench-state';

	let {
		rows,
		selectedKey,
		onSelect,
		onOpenAvatar,
	}: {
		rows: readonly McpConfigCatalogRow[];
		selectedKey: string;
		onSelect: (key: string) => void;
		onOpenAvatar?: (avatarNickname: string) => void;
	} = $props();
</script>

<div class="grid h-full min-w-0" data-testid="mcp-config-list">
	<ScrollView class="h-full" contentClass="grid gap-0">
		<button
			type="button"
			class={cn(
				'grid w-full gap-1.5 border-b border-border/45 px-3 py-3 text-left transition-colors md:px-4',
				selectedKey === '__new__' ? 'bg-accent/45' : 'hover:bg-muted/22',
			)}
			aria-pressed={selectedKey === '__new__'}
			onclick={() => onSelect('__new__')}
		>
			<div class="flex min-w-0 items-center gap-2">
				<div class="truncate text-sm font-semibold">New config</div>
				<Badge variant="secondary">draft</Badge>
			</div>
			<div class="truncate text-xs text-muted-foreground">Install one Avatar-owned MCP config.</div>
		</button>

		{#each rows as row (buildMcpConfigSelectionKey(row))}
			{@const rowKey = buildMcpConfigSelectionKey(row)}
			<div
				class={cn(
					'grid grid-cols-[auto_minmax(0,1fr)] gap-3 border-b border-border/45 px-3 py-3 transition-colors last:border-b-0 md:px-4',
					selectedKey === rowKey ? 'bg-accent/45' : 'hover:bg-muted/22',
				)}
				data-testid={`mcp-config-row-${row.name}`}
			>
				<button
					type="button"
					class="mt-0.5 rounded-lg outline-none ring-offset-background transition focus-visible:ring-2 focus-visible:ring-ring/50"
					aria-label={`Open Avatar ${row.avatarLabel}`}
					title={row.avatarLabel}
					data-testid={`mcp-config-row-avatar-${row.name}`}
					onclick={() => onOpenAvatar?.(row.avatarNickname)}
				>
					<ProfileAvatar label={row.avatarLabel} src={row.avatarIconUrl ?? null} class="size-8 rounded-lg" />
				</button>

				<button
					type="button"
					class="grid min-w-0 gap-1.5 text-left"
					aria-pressed={selectedKey === rowKey}
					onclick={() => onSelect(rowKey)}
				>
					<div class="flex min-w-0 flex-wrap items-center gap-1.5">
						<div class="truncate text-sm font-semibold">{row.title}</div>
						<Badge variant="secondary" class="shrink-0">{row.transport}</Badge>
						{#if row.latestError}
							<Badge variant="destructive">error</Badge>
						{/if}
					</div>
					<div class="truncate text-xs text-muted-foreground">{row.description}</div>
					<div class="flex min-w-0 flex-wrap items-center gap-1.5">
						<Badge variant="outline">{row.name}</Badge>
						{#if row.projectCount > 0}
							<Badge variant="outline">{row.projectCount} instances</Badge>
						{/if}
						{#if row.runningInstanceCount > 0}
							<Badge variant="outline">{row.runningInstanceCount} running</Badge>
						{/if}
						{#if row.failedInstanceCount > 0}
							<Badge variant="destructive">{row.failedInstanceCount} failed</Badge>
						{/if}
					</div>
				</button>
			</div>
		{/each}
	</ScrollView>
</div>
